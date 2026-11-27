const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const readline = require('readline');
const { pipeline } = require('stream/promises');
const mysql = require('mysql2');
const { Op } = require('sequelize');
const configs = require('../config/database');
const { Backup } = require('../models');
const configuracoes = require('./configuracaoService');
const notificacoes = require('./notificacaoService');
const AppError = require('../utils/AppError');

/*
 * Backup lógico do MySQL feito pela própria aplicação (não depende do mysqldump estar instalado).
 * Formato: arquivo .sql.gz com cabeçalho JSON, um comando SQL por linha e marcador de fim.
 * Integridade: SHA-256 do arquivo gravado no banco e em um arquivo .sha256 ao lado.
 */

const VERSAO_FORMATO = 1;
const PREFIXO_CABECALHO = '-- ESTOQUE-BACKUP ';
const LINHAS_POR_INSERT = 200;
// Na restauração pela interface, a auditoria e o histórico de backups atuais são preservados
const TABELAS_PRESERVADAS = ['auditorias', 'backups'];

const ambiente = process.env.NODE_ENV || 'development';
const configBanco = configs[ambiente];

function pastaBackups() {
  const pasta = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', '..', 'backups'));
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true, mode: 0o700 });
  if (!fs.statSync(pasta).isDirectory()) throw new AppError(`O caminho de backups não é uma pasta: ${pasta}`, 500);
  return pasta;
}

/** Só aceita nomes gerados pelo sistema (evita acesso a outros arquivos do servidor). */
function caminhoSeguro(arquivo) {
  if (!/^backup-[\w-]+\.sql\.gz$/.test(arquivo || '')) throw new AppError('Nome de arquivo de backup inválido.');
  return path.join(pastaBackups(), arquivo);
}

/** Conexão própria: datas, decimais e JSON chegam como texto, exatamente como estão no banco. */
function novaConexao() {
  return mysql.createConnection({
    host: configBanco.host,
    port: configBanco.port,
    user: configBanco.username,
    password: configBanco.password,
    database: configBanco.database,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    decimalNumbers: false,
    multipleStatements: false,
    typeCast: (campo, proximo) => (campo.type === 'JSON' ? campo.string('utf8') : proximo()),
  });
}

const consultar = (conexao, sql, valores) =>
  new Promise((resolve, reject) => conexao.query(sql, valores, (erro, linhas) => (erro ? reject(erro) : resolve(linhas))));

function sha256Arquivo(caminho) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(caminho).on('error', reject).on('data', (d) => hash.update(d)).on('end', () => resolve(hash.digest('hex')));
  });
}

async function migracoesAtuais(conexao) {
  const linhas = await consultar(conexao, 'SELECT name FROM `SequelizeMeta` ORDER BY name');
  return linhas.map((l) => l.name);
}

// ---------------------------------------------------------------------------
// Geração
// ---------------------------------------------------------------------------

/** Escreve o dump completo no caminho informado. Retorna { tabelas, registros }. */
async function gerarArquivo(caminho) {
  // Abre o arquivo ANTES de consultar o banco: sem permissão/espaço, falha aqui com uma mensagem clara
  const saida = fs.createWriteStream(caminho, { mode: 0o600 });
  await new Promise((ok, falha) => {
    saida.once('open', ok);
    saida.once('error', falha);
  });
  const conexao = novaConexao();
  const gzip = zlib.createGzip({ level: 6 });
  let erroGravacao = null;
  const gravacao = pipeline(gzip, saida).catch((erro) => {
    erroGravacao = erro;
    throw erro;
  });
  gravacao.catch(() => {}); // o erro é tratado em "escrever" e no final
  const escrever = (linha) =>
    new Promise((resolve, reject) => {
      if (erroGravacao) return reject(erroGravacao);
      if (gzip.write(`${linha}\n`)) return resolve();
      const aoDrenar = () => {
        gzip.off('error', aoErro);
        resolve();
      };
      const aoErro = (erro) => {
        gzip.off('drain', aoDrenar);
        reject(erro);
      };
      gzip.once('drain', aoDrenar);
      gzip.once('error', aoErro);
      return undefined;
    });

  let registros = 0;
  try {
    const tabelas = (await consultar(conexao, "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")).map((l) => Object.values(l)[0]);
    const cabecalho = {
      formato: VERSAO_FORMATO,
      criadoEm: new Date().toISOString(),
      banco: configBanco.database,
      migracoes: await migracoesAtuais(conexao),
      tabelas,
    };
    await escrever(`${PREFIXO_CABECALHO}${JSON.stringify(cabecalho)}`);

    for (const tabela of tabelas) {
      const [criacao] = await consultar(conexao, `SHOW CREATE TABLE \`${tabela}\``);
      await escrever(`-- TABELA ${tabela}`);
      await escrever(`DROP TABLE IF EXISTS \`${tabela}\`;`);
      await escrever(`${criacao['Create Table'].replace(/\s*\n\s*/g, ' ')};`);

      let lote = [];
      let colunas = null;
      const despejar = async () => {
        if (!lote.length) return;
        await escrever(`INSERT INTO \`${tabela}\` (${colunas}) VALUES ${lote.join(',')};`);
        lote = [];
      };
      const fluxo = conexao.query(`SELECT * FROM \`${tabela}\``).stream();
      for await (const linha of fluxo) {
        if (!colunas) colunas = Object.keys(linha).map((c) => `\`${c}\``).join(',');
        lote.push(`(${Object.values(linha).map((v) => mysql.escape(v)).join(',')})`);
        registros += 1;
        if (lote.length >= LINHAS_POR_INSERT) await despejar();
      }
      await despejar();
    }
    await escrever(`-- FIM ${JSON.stringify({ tabelas: tabelas.length, registros })}`);
    gzip.end();
    await gravacao;
    return { tabelas: tabelas.length, registros };
  } catch (erro) {
    gzip.destroy();
    await gravacao.catch(() => {});
    fs.rmSync(caminho, { force: true });
    throw erro;
  } finally {
    conexao.end();
  }
}

let operacaoEmAndamento = null;
let manutencao = false;

/** true enquanto uma restauração está em andamento (a API fica indisponível para os demais usuários). */
const emManutencao = () => manutencao;

function nomeArquivo(origem) {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const carimbo = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `backup-${carimbo}-${origem}-${crypto.randomBytes(3).toString('hex')}.sql.gz`;
}

/**
 * Cria um backup e registra no histórico. Notifica os administradores em caso de falha.
 * @param {'automatico'|'manual'|'pre_restauracao'} origem
 */
async function criarBackup({ origem = 'manual', usuario = null } = {}) {
  if (operacaoEmAndamento && origem !== 'pre_restauracao') {
    throw new AppError('Já existe um backup ou restauração em andamento. Aguarde alguns instantes.', 409);
  }
  const executar = async () => {
    const arquivo = nomeArquivo(origem);
    const registro = await Backup.create({ arquivo, origem, situacao: 'em_andamento', usuarioId: usuario?.id || null, iniciadoEm: new Date() });
    try {
      const caminho = path.join(pastaBackups(), arquivo);
      const { tabelas, registros } = await gerarArquivo(caminho);
      const sha256 = await sha256Arquivo(caminho);
      fs.writeFileSync(`${caminho}.sha256`, `${sha256}  ${arquivo}\n`, { mode: 0o600 });
      await registro.update({ situacao: 'sucesso', sha256, tamanho: fs.statSync(caminho).size, tabelas, registros, concluidoEm: new Date() });
      if (origem !== 'pre_restauracao') await aplicarRetencao();
      return registro;
    } catch (erro) {
      await registro.update({ situacao: 'falha', erro: String(erro.message).slice(0, 500), concluidoEm: new Date(), arquivo: null });
      await notificacoes.notificar({
        tipo: 'backup_falha',
        nivel: 'critico',
        titulo: 'Falha no backup do banco de dados',
        mensagem: `O backup ${origem === 'automatico' ? 'automático' : 'manual'} de ${new Date().toLocaleString('pt-BR')} falhou: ${erro.message}`,
        link: '/backups',
        perfis: ['admin'],
      });
      throw erro instanceof AppError ? erro : new AppError(`Falha ao gerar o backup: ${erro.message}`, 500);
    }
  };

  if (origem === 'pre_restauracao') return executar();
  operacaoEmAndamento = executar();
  try {
    return await operacaoEmAndamento;
  } finally {
    operacaoEmAndamento = null;
  }
}

// ---------------------------------------------------------------------------
// Integridade
// ---------------------------------------------------------------------------

/** Confere o SHA-256, o cabeçalho e o marcador de fim. Retorna o cabeçalho. */
async function validarArquivo(caminho, sha256Esperado) {
  if (!fs.existsSync(caminho)) throw new AppError('Arquivo de backup não encontrado na pasta de backups.', 404);
  if (sha256Esperado) {
    const atual = await sha256Arquivo(caminho);
    if (atual !== sha256Esperado) throw new AppError('O arquivo de backup foi alterado ou está corrompido (SHA-256 não confere).');
  }
  let cabecalho = null;
  let fim = null;
  let comandos = 0;
  const leitor = readline.createInterface({ input: fs.createReadStream(caminho).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  try {
    for await (const linha of leitor) {
      if (!cabecalho) {
        if (!linha.startsWith(PREFIXO_CABECALHO)) throw new AppError('Arquivo não é um backup deste sistema.');
        cabecalho = JSON.parse(linha.slice(PREFIXO_CABECALHO.length));
      } else if (linha.startsWith('-- FIM ')) {
        fim = JSON.parse(linha.slice(7));
      } else if (linha && !linha.startsWith('--')) {
        comandos += 1;
      }
    }
  } catch (erro) {
    if (erro instanceof AppError) throw erro;
    throw new AppError(`Arquivo de backup corrompido: ${erro.message}`);
  }
  if (!fim) throw new AppError('Backup incompleto: marcador de fim ausente.');
  if (cabecalho.formato !== VERSAO_FORMATO) throw new AppError('Formato de backup não suportado.');
  return { ...cabecalho, ...fim, comandos };
}

async function verificar(id) {
  const backup = await Backup.findByPk(id);
  if (!backup || backup.situacao !== 'sucesso') throw new AppError('Backup não encontrado ou indisponível.', 404);
  return validarArquivo(caminhoSeguro(backup.arquivo), backup.sha256);
}

// ---------------------------------------------------------------------------
// Restauração
// ---------------------------------------------------------------------------

/** Executa os comandos do arquivo. tabelasIgnoradas: tabelas mantidas como estão no banco atual. */
async function executarArquivo(caminho, tabelasIgnoradas = []) {
  const conexao = novaConexao();
  let tabelaAtual = null;
  try {
    await consultar(conexao, 'SET FOREIGN_KEY_CHECKS = 0');
    await consultar(conexao, 'SET UNIQUE_CHECKS = 0');
    // O leitor é criado só aqui, logo antes do laço: se fosse criado antes dos "await" acima, um arquivo
    // pequeno terminaria de ser lido antes do laço começar e o "for await" nunca receberia o fim.
    const leitor = readline.createInterface({ input: fs.createReadStream(caminho).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const linha of leitor) {
      if (linha.startsWith('-- TABELA ')) {
        tabelaAtual = linha.slice(10).trim();
      } else if (linha && !linha.startsWith('--') && !tabelasIgnoradas.includes(tabelaAtual)) {
        await consultar(conexao, linha);
      }
    }
  } finally {
    await consultar(conexao, 'SET FOREIGN_KEY_CHECKS = 1').catch(() => {});
    await consultar(conexao, 'SET UNIQUE_CHECKS = 1').catch(() => {});
    conexao.end();
  }
}

/**
 * Restauração segura:
 * 1. valida o arquivo (SHA-256 + estrutura) e a versão do banco (mesmas migrations)
 * 2. cria um backup de segurança do estado atual
 * 3. restaura (a auditoria e o histórico de backups atuais são preservados)
 * 4. se algo falhar no meio, volta automaticamente o backup de segurança
 */
async function restaurar(id, usuario) {
  if (operacaoEmAndamento) throw new AppError('Já existe um backup ou restauração em andamento.', 409);
  const backup = await Backup.findByPk(id);
  if (!backup || backup.situacao !== 'sucesso') throw new AppError('Backup não encontrado ou indisponível.', 404);
  const caminho = caminhoSeguro(backup.arquivo);

  const executar = async () => {
    const cabecalho = await validarArquivo(caminho, backup.sha256);
    const conexao = novaConexao();
    const atuais = await migracoesAtuais(conexao).finally(() => conexao.end());
    if (JSON.stringify(cabecalho.migracoes) !== JSON.stringify(atuais)) {
      throw new AppError(
        'Este backup foi gerado em outra versão do banco (migrations diferentes). Restaure pela linha de comando seguindo docs/BACKUP_RESTAURACAO.md.'
      );
    }

    const seguranca = await criarBackup({ origem: 'pre_restauracao', usuario });
    manutencao = true;
    try {
      await executarArquivo(caminho, TABELAS_PRESERVADAS);
    } catch (erro) {
      // Volta ao estado anterior
      await executarArquivo(caminhoSeguro(seguranca.arquivo), TABELAS_PRESERVADAS).catch((e) => {
        console.error('[backup] FALHA ao reverter a restauração:', e.message);
      });
      throw new AppError(`Falha na restauração; o banco foi revertido ao estado anterior. Detalhe: ${erro.message}`, 500);
    } finally {
      manutencao = false;
      configuracoes.limparCache();
    }
    await Backup.update({ restauradoEm: new Date() }, { where: { id: backup.id } });
    return { backup, seguranca, cabecalho };
  };

  operacaoEmAndamento = executar();
  try {
    return await operacaoEmAndamento;
  } finally {
    operacaoEmAndamento = null;
  }
}

/** Apaga todas as tabelas do banco (usado só na restauração completa pela linha de comando). */
async function apagarTodasTabelas() {
  const conexao = novaConexao();
  try {
    const tabelas = (await consultar(conexao, "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")).map((l) => Object.values(l)[0]);
    await consultar(conexao, 'SET FOREIGN_KEY_CHECKS = 0');
    for (const t of tabelas) await consultar(conexao, `DROP TABLE IF EXISTS \`${t}\``);
    await consultar(conexao, 'SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    conexao.end();
  }
}

/**
 * Restauração por linha de comando (recuperação de desastre ou arquivo de outra máquina).
 * - normal: exige a mesma versão do banco; mantém auditoria e histórico de backups atuais
 * - completo: apaga TODAS as tabelas atuais e carrega tudo do arquivo (inclusive auditoria).
 *   Depois, "npm run migrate" atualiza o banco se o backup for de uma versão anterior.
 */
async function restaurarArquivoExterno(caminho, { completo = false } = {}) {
  const cabecalho = await validarArquivo(caminho);
  const shaLateral = `${caminho}.sha256`;
  if (fs.existsSync(shaLateral)) {
    const esperado = fs.readFileSync(shaLateral, 'utf8').split(/\s+/)[0];
    if (esperado && esperado !== (await sha256Arquivo(caminho))) throw new AppError('SHA-256 não confere com o arquivo .sha256.');
  }
  if (completo) {
    await apagarTodasTabelas();
    await executarArquivo(caminho, []);
  } else {
    const conexao = novaConexao();
    const atuais = await migracoesAtuais(conexao).catch(() => []).finally(() => conexao.end());
    if (JSON.stringify(cabecalho.migracoes) !== JSON.stringify(atuais)) {
      throw new AppError('O backup é de outra versão do banco. Use --completo (substitui tudo, inclusive a auditoria) e depois rode "npm run migrate".');
    }
    await executarArquivo(caminho, TABELAS_PRESERVADAS);
  }
  configuracoes.limparCache();
  return cabecalho;
}

// ---------------------------------------------------------------------------
// Retenção e agendamento
// ---------------------------------------------------------------------------

/** Mantém os N backups mais recentes e remove os mais antigos que o limite de dias (sempre fica o último). */
async function aplicarRetencao() {
  const quantidade = Number(await configuracoes.obter('backup.retencaoQuantidade'));
  const dias = Number(await configuracoes.obter('backup.retencaoDias'));
  const sucesso = await Backup.findAll({ where: { situacao: 'sucesso' }, order: [['iniciadoEm', 'DESC'], ['id', 'DESC']] });
  const limiteData = Date.now() - dias * 86400000;
  const remover = sucesso.filter((b, i) => i > 0 && (i >= quantidade || new Date(b.iniciadoEm).getTime() < limiteData));
  for (const b of remover) {
    try {
      const caminho = caminhoSeguro(b.arquivo);
      fs.rmSync(caminho, { force: true });
      fs.rmSync(`${caminho}.sha256`, { force: true });
    } catch {
      /* arquivo já ausente */
    }
    await b.update({ situacao: 'removido' });
  }
  return remover.length;
}

/** Próximo horário agendado que já passou (para frequências diária/semanal). */
function ultimoAgendado(agora, horario, diaSemana) {
  const [h, m] = horario.split(':').map(Number);
  const alvo = new Date(agora);
  alvo.setHours(h, m, 0, 0);
  if (diaSemana === null) {
    if (alvo > agora) alvo.setDate(alvo.getDate() - 1);
  } else {
    const diff = (alvo.getDay() - diaSemana + 7) % 7;
    alvo.setDate(alvo.getDate() - diff);
    if (alvo > agora) alvo.setDate(alvo.getDate() - 7);
  }
  return alvo;
}

/** Decide se o backup automático deve rodar agora (chamado pelo agendador a cada minuto). */
async function backupAutomaticoPendente(agora = new Date()) {
  const cfg = await configuracoes.obterTodas();
  if (cfg['backup.frequencia'] === 'desativado') return false;

  // Evita repetir tentativas em sequência quando o backup falha: espera 30 minutos
  const ultimaTentativa = await Backup.findOne({ where: { origem: 'automatico' }, order: [['iniciadoEm', 'DESC']] });
  if (ultimaTentativa && agora - new Date(ultimaTentativa.iniciadoEm) < 30 * 60000) return false;

  const ultimoSucesso = await Backup.findOne({
    where: { origem: 'automatico', situacao: { [Op.in]: ['sucesso', 'removido'] } },
    order: [['iniciadoEm', 'DESC']],
  });
  const ultimo = ultimoSucesso ? new Date(ultimoSucesso.iniciadoEm) : null;

  if (cfg['backup.frequencia'] === 'horas') {
    return !ultimo || agora - ultimo >= Number(cfg['backup.intervaloHoras']) * 3600000;
  }
  const dia = cfg['backup.frequencia'] === 'semanal' ? Number(cfg['backup.diaSemana']) : null;
  const agendado = ultimoAgendado(agora, cfg['backup.horario'], dia);
  return !ultimo || ultimo < agendado;
}

async function executarSePendente() {
  if (operacaoEmAndamento || manutencao) return null;
  if (!(await backupAutomaticoPendente())) return null;
  try {
    return await criarBackup({ origem: 'automatico' });
  } catch (erro) {
    console.error('[backup] backup automático falhou:', erro.message);
    return null;
  }
}

/** Backups que ficaram "em andamento" porque o servidor parou no meio são marcados como falha. */
async function marcarInterrompidos() {
  await Backup.update(
    { situacao: 'falha', erro: 'Interrompido: o servidor foi reiniciado durante o backup.', concluidoEm: new Date() },
    { where: { situacao: 'em_andamento' } }
  );
}

async function listar({ pagina = 1, limite = 30 } = {}) {
  const { rows, count } = await Backup.findAndCountAll({
    include: [{ association: 'usuario', attributes: ['id', 'nome'] }],
    order: [['iniciadoEm', 'DESC'], ['id', 'DESC']],
    limit: limite,
    offset: (pagina - 1) * limite,
  });
  return { dados: rows, total: count, pagina, limite, paginas: Math.max(1, Math.ceil(count / limite)), pasta: pastaBackups() };
}

async function caminhoParaDownload(id) {
  const backup = await Backup.findByPk(id);
  if (!backup || backup.situacao !== 'sucesso') throw new AppError('Backup não encontrado ou indisponível.', 404);
  const caminho = caminhoSeguro(backup.arquivo);
  if (!fs.existsSync(caminho)) throw new AppError('Arquivo não encontrado na pasta de backups.', 404);
  return { caminho, backup };
}

module.exports = {
  criarBackup,
  validarArquivo,
  verificar,
  restaurar,
  restaurarArquivoExterno,
  backupAutomaticoPendente,
  executarSePendente,
  marcarInterrompidos,
  listar,
  caminhoParaDownload,
  pastaBackups,
  emManutencao,
  ultimoAgendado,
};

const { Configuracao } = require('../models');
const AppError = require('../utils/AppError');

/**
 * Configurações do sistema. Cada chave tem valor padrão e validação.
 * "publica" = pode ser lida por qualquer usuário logado (ex.: nome da organização nos relatórios).
 */
const DEFINICOES = {
  'organizacao.nome': { padrao: 'Provedor de Internet', publica: true, validar: (v) => texto(v, 2, 150, 'Nome da organização') },
  'organizacao.cnpj': { padrao: '', publica: true, validar: (v) => cnpj(v) },
  'organizacao.telefone': { padrao: '', publica: true, validar: (v) => texto(v, 0, 30, 'Telefone') },
  'organizacao.endereco': { padrao: '', publica: true, validar: (v) => texto(v, 0, 200, 'Endereço') },
  // Endereço usado pelo navegador para abrir o sistema (ex.: http://192.168.0.10:3333). Vai no QR Code das etiquetas.
  'sistema.urlPublica': { padrao: '', publica: true, validar: (v) => url(v) },
  'backup.frequencia': { padrao: 'diario', validar: (v) => opcao(v, ['desativado', 'horas', 'diario', 'semanal'], 'Frequência do backup') },
  'backup.horario': { padrao: '02:00', validar: (v) => horario(v) },
  'backup.intervaloHoras': { padrao: '6', validar: (v) => inteiro(v, 1, 168, 'Intervalo em horas') },
  'backup.diaSemana': { padrao: '0', validar: (v) => inteiro(v, 0, 6, 'Dia da semana') },
  'backup.retencaoQuantidade': { padrao: '14', validar: (v) => inteiro(v, 1, 365, 'Quantidade de backups mantidos') },
  'backup.retencaoDias': { padrao: '30', validar: (v) => inteiro(v, 1, 3650, 'Dias de retenção') },
  'notificacoes.email': { padrao: 'false', validar: (v) => booleano(v) },
};

function texto(v, min, max, nome) {
  const t = String(v ?? '').trim();
  if (t.length < min || t.length > max) throw new AppError(`${nome}: informe entre ${min} e ${max} caracteres.`);
  return t;
}
function cnpj(v) {
  const t = String(v ?? '').trim();
  if (t && !/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$/.test(t)) throw new AppError('CNPJ da organização inválido.');
  return t;
}
function url(v) {
  const t = String(v ?? '').trim().replace(/\/+$/, '');
  if (t && !/^https?:\/\/[^\s/]+(:\d+)?(\/[^\s]*)?$/i.test(t)) {
    throw new AppError('Endereço do sistema inválido. Exemplo: http://192.168.0.10:3333');
  }
  return t;
}
function opcao(v, opcoes, nome) {
  const t = String(v ?? '');
  if (!opcoes.includes(t)) throw new AppError(`${nome}: use ${opcoes.join(', ')}.`);
  return t;
}
function horario(v) {
  const t = String(v ?? '');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new AppError('Horário inválido. Use HH:MM (ex.: 02:00).');
  return t;
}
function inteiro(v, min, max, nome) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new AppError(`${nome}: informe um número inteiro entre ${min} e ${max}.`);
  return String(n);
}
function booleano(v) {
  return String(v === true || v === 'true');
}

let cache = null;

async function obterTodas() {
  if (cache) return cache;
  const salvas = await Configuracao.findAll();
  const valores = {};
  Object.entries(DEFINICOES).forEach(([chave, d]) => {
    valores[chave] = d.padrao;
  });
  salvas.forEach((c) => {
    if (DEFINICOES[c.chave]) valores[c.chave] = c.valor ?? '';
  });
  cache = valores;
  return valores;
}

async function obter(chave) {
  return (await obterTodas())[chave];
}

async function obterPublicas() {
  const todas = await obterTodas();
  const publicas = {};
  Object.entries(DEFINICOES).forEach(([chave, d]) => {
    if (d.publica) publicas[chave] = todas[chave];
  });
  return publicas;
}

/** Valida e grava as chaves informadas. Retorna { antes, depois } só com as chaves alteradas. */
async function definir(novos, usuario) {
  const atuais = await obterTodas();
  const validados = {};
  Object.entries(novos || {}).forEach(([chave, valor]) => {
    const def = DEFINICOES[chave];
    if (!def) throw new AppError(`Configuração desconhecida: ${chave}.`);
    validados[chave] = def.validar(valor);
  });

  const antes = {};
  const depois = {};
  for (const [chave, valor] of Object.entries(validados)) {
    if (atuais[chave] === valor) continue;
    antes[chave] = atuais[chave];
    depois[chave] = valor;
     
    await Configuracao.upsert({ chave, valor, atualizadoPor: usuario?.id || null });
  }
  cache = null;
  return { antes, depois };
}

function limparCache() {
  cache = null;
}

module.exports = { DEFINICOES, obterTodas, obter, obterPublicas, definir, limparCache };

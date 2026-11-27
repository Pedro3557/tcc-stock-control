/**
 * Configuração automática do projeto (rode na pasta principal):  npm run configurar
 *
 * 1. Cria backend/.env e frontend/.env a partir dos exemplos (com um JWT_SECRET aleatório)
 * 2. Confere a conexão com o MySQL; se o usuário do .env não existir ou a senha não bater,
 *    pede a senha do root do MySQL e cria o banco e o usuário automaticamente
 * 3. Roda as migrations e, se o banco estiver vazio, o seed (dados iniciais)
 *
 * Pode ser rodado quantas vezes quiser: o que já estiver pronto é mantido.
 * Com "npm run configurar -- --demo" também carrega dados de demonstração (só em banco vazio).
 * Sem perguntas (ex.: CI): defina MYSQL_ROOT_USER e MYSQL_ROOT_PASSWORD.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const readline = require('readline');
const { spawnSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const BACKEND = path.join(RAIZ, 'backend');
const FRONTEND = path.join(RAIZ, 'frontend');

const ok = (m) => console.log(`  ✔ ${m}`);
const info = (m) => console.log(`  • ${m}`);
const titulo = (m) => console.log(`\n▶ ${m}`);
function falhar(mensagem, dicas = []) {
  console.error(`\n  ✖ ${mensagem}`);
  dicas.forEach((d) => console.error(`    - ${d}`));
  console.error('');
  process.exit(1);
}

// As dependências ficam no backend: carrega de lá
function exigirDoBackend(modulo) {
  try {
    return require(require.resolve(modulo, { paths: [BACKEND] }));
  } catch {
    return falhar(`Dependências não instaladas (faltou "${modulo}").`, ['Rode "npm install" na pasta principal do projeto e tente de novo.']);
  }
}

// ---------------------------------------------------------------------------
// 1. Arquivos .env
// ---------------------------------------------------------------------------
function criarEnv() {
  titulo('Arquivos de configuração (.env)');
  const back = path.join(BACKEND, '.env');
  if (fs.existsSync(back)) {
    info('backend/.env já existe (mantido).');
  } else {
    const exemplo = fs.readFileSync(path.join(BACKEND, '.env.example'), 'utf8');
    const segredo = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(back, exemplo.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${segredo}`));
    ok('backend/.env criado (com JWT_SECRET aleatório).');
  }
  const front = path.join(FRONTEND, '.env');
  if (fs.existsSync(front)) {
    info('frontend/.env já existe (mantido).');
  } else {
    fs.copyFileSync(path.join(FRONTEND, '.env.example'), front);
    ok('frontend/.env criado.');
  }
}

// ---------------------------------------------------------------------------
// Perguntas no terminal (senha com asteriscos)
// ---------------------------------------------------------------------------
// Um único leitor para todas as perguntas (funciona também com respostas coladas/encadeadas)
let leitor = null;
let ocultar = false;
const filaLinhas = [];
const esperando = [];

function abrirLeitor() {
  if (leitor) return;
  leitor = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
   
  const escreverOriginal = leitor._writeToOutput.bind(leitor);
   
  leitor._writeToOutput = (s) => {
    if (!ocultar || /[\r\n]/.test(s)) escreverOriginal(s);
    else escreverOriginal('*'.repeat(s.length));
  };
  leitor.on('line', (linha) => {
    if (esperando.length) esperando.shift()(linha);
    else filaLinhas.push(linha);
  });
  leitor.on('close', () => {
    while (esperando.length) esperando.shift()(null);
  });
}

function fecharLeitor() {
  if (leitor) leitor.close();
  leitor = null;
}

function perguntar(texto, { oculto = false } = {}) {
  abrirLeitor();
  process.stdout.write(texto);
  ocultar = oculto;
  return new Promise((resolve) => {
    const responder = (linha) => {
      ocultar = false;
      if (linha === null) falhar('Entrada encerrada antes da resposta.');
      resolve(linha);
    };
    if (filaLinhas.length) responder(filaLinhas.shift());
    else esperando.push(responder);
  });
}

// ---------------------------------------------------------------------------
// 2. Banco de dados
// ---------------------------------------------------------------------------
const DICAS_MYSQL_PARADO = [
  'Docker: abra o Docker Desktop, espere "Engine running" e rode "docker compose up -d" na pasta principal.',
  'MySQL Installer: abra "Serviços" do Windows (services.msc) e inicie o serviço "MySQL80".',
  'XAMPP: abra o painel do XAMPP e clique em "Start" no MySQL.',
  'Se o MySQL usa outra porta, ajuste DB_PORT em backend/.env.',
];

async function conectar(mysql, cfg) {
  return mysql.createConnection({ ...cfg, connectTimeout: 8000, multipleStatements: false });
}

async function configurarBanco() {
  titulo('Banco de dados MySQL');
  const dotenv = exigirDoBackend('dotenv');
  const mysql = exigirDoBackend('mysql2/promise');
  const env = dotenv.parse(fs.readFileSync(path.join(BACKEND, '.env')));

  const base = { host: env.DB_HOST || 'localhost', port: Number(env.DB_PORT || 3306) };
  const banco = env.DB_NAME || 'estoque_provedor';
  const bancoTeste = env.DB_NAME_TEST || `${banco}_teste`;
  const usuario = env.DB_USER || 'estoque';
  const senha = env.DB_PASSWORD || '';
  info(`Servidor ${base.host}:${base.port} · banco "${banco}" · usuário "${usuario}"`);

  // Tenta com o usuário do .env
  try {
    const c = await conectar(mysql, { ...base, user: usuario, password: senha });
    try {
      await c.query(`CREATE DATABASE IF NOT EXISTS \`${banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    } catch {
      /* sem permissão para criar: o teste abaixo diz se o banco existe */
    }
    try {
      await c.query(`USE \`${banco}\``);
      ok(`Conexão com o usuário "${usuario}" funcionando.`);
      await c.end();
      return;
    } catch {
      await c.end();
      info(`O usuário "${usuario}" conecta, mas não tem acesso ao banco "${banco}".`);
    }
  } catch (erro) {
    if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'].includes(erro.code)) {
      falhar(`Não foi possível chegar ao MySQL em ${base.host}:${base.port} — ele está ligado?`, DICAS_MYSQL_PARADO);
    }
    if (erro.code !== 'ER_ACCESS_DENIED_ERROR' && erro.code !== 'ER_DBACCESS_DENIED_ERROR') {
      falhar(`Erro ao conectar no MySQL: ${erro.message}`);
    }
    info(`O usuário "${usuario}" ainda não existe ou a senha é outra. Vou criá-lo com a conta root do MySQL.`);
  }

  // Cria banco e usuário com a conta de administrador do MySQL
  const rootUser = process.env.MYSQL_ROOT_USER || 'root';
  let rootSenha = process.env.MYSQL_ROOT_PASSWORD;
  let admin = null;
  for (let tentativa = 1; tentativa <= 3 && !admin; tentativa += 1) {
    if (rootSenha === undefined) {
      rootSenha = await perguntar(`  Senha do usuário "${rootUser}" do MySQL (a que você criou na instalação; no XAMPP deixe em branco): `, { oculto: true });
    }
    try {
      admin = await conectar(mysql, { ...base, user: rootUser, password: rootSenha });
    } catch (erro) {
      if (erro.code !== 'ER_ACCESS_DENIED_ERROR' || process.env.MYSQL_ROOT_PASSWORD !== undefined) {
        falhar(`Não foi possível entrar como "${rootUser}": ${erro.message}`);
      }
      console.log('  ✖ Senha incorreta, tente de novo.');
      rootSenha = undefined;
    }
  }
  if (!admin) {
    fecharLeitor();
    falhar('Não consegui entrar como root do MySQL.', [
      'Se esqueceu a senha do root, a forma mais simples é reinstalar o MySQL ou usar o Docker (ver docs/GUIA_INSTALACAO.md).',
      `Ou coloque em backend/.env um usuário do MySQL que você saiba a senha (DB_USER e DB_PASSWORD).`,
    ]);
  }

  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${banco}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  // O Node pode conectar por "localhost", "127.0.0.1" ou "::1": cria o usuário para os três
  for (const host of ['localhost', '127.0.0.1', '::1']) {
    await admin.query('CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?', [usuario, host, senha]);
    await admin.query('ALTER USER ?@? IDENTIFIED BY ?', [usuario, host, senha]);
    await admin.query(`GRANT ALL PRIVILEGES ON \`${banco}\`.* TO ?@?`, [usuario, host]);
    // Banco separado usado só pelos testes automatizados (npm test)
    await admin.query(`GRANT ALL PRIVILEGES ON \`${bancoTeste}\`.* TO ?@?`, [usuario, host]);
  }
  fecharLeitor();
  await admin.query('FLUSH PRIVILEGES');
  await admin.end();
  ok(`Banco "${banco}" e usuário "${usuario}" prontos.`);

  // Confere
  try {
    const c = await conectar(mysql, { ...base, user: usuario, password: senha, database: banco });
    await c.end();
    ok('Conexão conferida.');
  } catch (erro) {
    falhar(`O usuário foi criado, mas a conexão ainda falhou: ${erro.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. Migrations e seed
// ---------------------------------------------------------------------------
function rodarNoBackend(script) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(npm, ['run', script], { cwd: BACKEND, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) falhar(`O comando "npm run ${script}" falhou (veja a mensagem acima).`);
}

const comDemo = process.argv.includes('--demo');

function prepararTabelas() {
  titulo('Tabelas (migrations)');
  rodarNoBackend('migrate');
  ok('Tabelas atualizadas.');

  titulo('Dados iniciais (seed)');
  rodarNoBackend('seed');
  if (comDemo) {
    titulo('Dados de demonstração (seed:demo)');
    rodarNoBackend('seed:demo');
  }
}

(async () => {
  console.log('\nConfiguração do Controle de Estoque — Provedor');
  criarEnv();
  await configurarBanco();
  prepararTabelas();
  console.log('\n✔ Tudo pronto! Agora rode:  npm run dev');
  console.log('  Depois abra http://localhost:5173 e entre com admin@provedor.com / admin123');
  console.log('  (no primeiro acesso o sistema pede para criar uma senha nova)\n');
})().catch((erro) => falhar(erro.message));

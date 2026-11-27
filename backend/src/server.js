const fs = require('fs');
const http = require('http');
const https = require('https');
const app = require('./app');
const config = require('./config');
const { sequelize } = require('./models');
const agendador = require('./services/agendador');

function criarServidor() {
  if (config.https.cert && config.https.key) {
    const opcoes = { cert: fs.readFileSync(config.https.cert), key: fs.readFileSync(config.https.key) };
    return { servidor: https.createServer(opcoes, app), protocolo: 'https' };
  }
  return { servidor: http.createServer(app), protocolo: 'http' };
}

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conectado ao MySQL.');
  } catch (erro) {
    const codigo = erro.original?.code || erro.parent?.code;
    console.error('\nNão foi possível conectar ao MySQL.');
    if (codigo === 'ER_ACCESS_DENIED_ERROR' || codigo === 'ER_DBACCESS_DENIED_ERROR') {
      console.error('Usuário ou senha do banco recusados. Na pasta principal do projeto rode: npm run configurar');
    } else if (codigo === 'ER_BAD_DB_ERROR') {
      console.error('O banco ainda não existe. Na pasta principal do projeto rode: npm run configurar');
    } else if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(codigo)) {
      console.error('O MySQL não está respondendo. Ligue o MySQL (Docker Desktop, serviço MySQL80 ou XAMPP) e tente de novo.');
    } else {
      console.error('Verifique o arquivo backend/.env e se o MySQL está rodando.');
    }
    console.error(`Detalhe técnico: ${erro.message}\n`);
    process.exit(1);
  }

  const { servidor, protocolo } = criarServidor();
  servidor.listen(config.porta, config.host, () => {
    console.log(`API de estoque rodando em ${protocolo}://localhost:${config.porta}/api`);
    if (config.servirFrontend) console.log(`Sistema disponível em ${protocolo}://localhost:${config.porta}`);
    agendador.iniciar();
  });

  // Encerramento limpo (PM2, Ctrl+C)
  const encerrar = () => {
    agendador.parar();
    servidor.close(() => sequelize.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', encerrar);
  process.on('SIGTERM', encerrar);
}

iniciar();

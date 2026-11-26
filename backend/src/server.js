const app = require('./app');
const { porta } = require('./config');
const { sequelize } = require('./models');

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

  app.listen(porta, () => {
    console.log(`API de estoque rodando em http://localhost:${porta}/api`);
  });
}

iniciar();

const app = require('./app');
const { porta } = require('./config');
const { sequelize } = require('./models');

async function iniciar() {
  try {
    await sequelize.authenticate();
    console.log('Conectado ao MySQL.');
  } catch (erro) {
    console.error('Não foi possível conectar ao MySQL. Verifique o .env e se o banco está rodando.');
    console.error(erro.message);
    process.exit(1);
  }

  app.listen(porta, () => {
    console.log(`API de estoque rodando em http://localhost:${porta}/api`);
  });
}

iniciar();

require('dotenv').config();

const base = {
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'estoque_provedor',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  dialect: 'mysql',
  timezone: '-03:00',
  logging: false,
  dialectOptions: {
    decimalNumbers: true,
    dateStrings: false,
  },
  define: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },
};

// Testes usam SEMPRE um banco separado (padrão: <DB_NAME>_teste), nunca o banco de trabalho
const bancoTeste = process.env.DB_NAME_TEST || `${base.database}_teste`;
if (bancoTeste === base.database) {
  throw new Error('DB_NAME_TEST não pode ser igual a DB_NAME: os testes apagam e recriam o banco de testes.');
}

module.exports = {
  development: base,
  test: { ...base, database: bancoTeste },
  production: base,
};

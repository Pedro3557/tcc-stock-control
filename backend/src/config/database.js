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

module.exports = {
  development: base,
  test: base,
  production: base,
};

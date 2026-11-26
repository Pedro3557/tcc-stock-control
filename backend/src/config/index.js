require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.warn('[aviso] JWT_SECRET não definido no .env — usando um valor inseguro apenas para desenvolvimento.');
}

module.exports = {
  porta: Number(process.env.PORT || 3333),
  jwtSecret: process.env.JWT_SECRET || 'segredo-inseguro-de-desenvolvimento',
  jwtExpiracao: '10h',
  corsOrigin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : true,
};

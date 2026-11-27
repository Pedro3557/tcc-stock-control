require('dotenv').config();

const producao = process.env.NODE_ENV === 'production';
const teste = process.env.NODE_ENV === 'test';

// Em produção o segredo do JWT é obrigatório e precisa ser forte
if (producao && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  console.error('[erro] Defina JWT_SECRET no .env com pelo menos 32 caracteres aleatórios antes de iniciar em produção.');
  console.error('       Dica: rode "npm run configurar" na pasta principal, que gera um segredo automaticamente.');
  process.exit(1);
}
if (!process.env.JWT_SECRET && !teste) {
  console.warn('[aviso] JWT_SECRET não definido no .env — usando um valor inseguro apenas para desenvolvimento.');
}

function listaOrigens(valor) {
  if (!valor) return null;
  return valor.split(',').map((o) => o.trim()).filter(Boolean);
}

module.exports = {
  producao,
  teste,
  porta: Number(process.env.PORT || 3333),
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'segredo-inseguro-de-desenvolvimento',
  jwtExpiracao: process.env.JWT_EXPIRACAO || '10h',
  // Em produção o front-end é servido pela própria API (mesma origem): CORS só se configurado
  corsOrigin: listaOrigens(process.env.CORS_ORIGIN) || (producao ? false : true),
  // Servir o build do front-end (frontend/dist) pela API — padrão em produção
  servirFrontend: process.env.SERVIR_FRONTEND ? process.env.SERVIR_FRONTEND === 'true' : producao,
  https: {
    cert: process.env.HTTPS_CERT || '',
    key: process.env.HTTPS_KEY || '',
  },
};

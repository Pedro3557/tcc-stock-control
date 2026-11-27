/**
 * Inicia o sistema em modo produção numa porta só (API + front-end compilado).
 * Funciona igual no Windows e no Linux:  npm run producao
 * Para rodar continuamente com reinício automático, prefira o PM2 (ver ecosystem.config.cjs).
 */
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
if (!fs.existsSync(path.join(raiz, 'frontend', 'dist', 'index.html'))) {
  console.error('\n  ✖ O front-end ainda não foi compilado. Rode antes:  npm run producao:preparar\n');
  process.exit(1);
}
if (!fs.existsSync(path.join(raiz, 'backend', '.env'))) {
  console.error('\n  ✖ backend/.env não encontrado. Rode antes:  npm run configurar\n');
  process.exit(1);
}

process.env.NODE_ENV = 'production';
process.chdir(path.join(raiz, 'backend'));
require(path.join(raiz, 'backend', 'src', 'server.js'));

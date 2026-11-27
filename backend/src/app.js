const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const rotas = require('./routes');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');

const app = express();
const usaHttps = Boolean(config.https.cert && config.https.key);

app.disable('x-powered-by');
// Atrás de proxy reverso (Nginx, etc.), use TRUST_PROXY=1 para o limite de login enxergar o IP real
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Cabeçalhos de segurança. Sem "upgrade-insecure-requests" e sem HSTS quando o sistema roda em HTTP na rede interna.
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:'],
        mediaSrc: ["'self'", 'blob:'],
        connectSrc: ["'self'"],
        workerSrc: ["'self'", 'blob:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: usaHttps ? { maxAge: 15552000 } : false,
    crossOriginEmbedderPolicy: false,
  })
);
// A câmera é usada para ler QR Codes
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});

app.use(cors({ origin: config.corsOrigin, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '2mb' }));

app.use('/api', rotas);
app.use('/api', rotaNaoEncontrada);

// Produção: a API também entrega o front-end (frontend/dist), numa porta só
const pastaFrontend = path.resolve(__dirname, '..', '..', 'frontend', 'dist');
if (config.servirFrontend) {
  if (fs.existsSync(path.join(pastaFrontend, 'index.html'))) {
    app.use(express.static(pastaFrontend, { index: false, maxAge: '7d', setHeaders: semCacheNoIndex }));
    // Rotas do React (ex.: /produtos, /e/CODIGO) devolvem o index.html
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(pastaFrontend, 'index.html'));
    });
  } else {
    console.warn('[aviso] SERVIR_FRONTEND ativo, mas frontend/dist não existe. Rode "npm run build" na pasta principal.');
  }
}

function semCacheNoIndex(res, arquivo) {
  if (arquivo.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
}

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;

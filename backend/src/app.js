const express = require('express');
const cors = require('cors');
const { corsOrigin } = require('./config');
const rotas = require('./routes');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/erros');

const app = express();

app.disable('x-powered-by');
// Atrás de proxy reverso (Nginx, etc.), use TRUST_PROXY=1 para o limite de login enxergar o IP real
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
app.use(cors({ origin: corsOrigin, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '2mb' }));

app.use('/api', rotas);

app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;

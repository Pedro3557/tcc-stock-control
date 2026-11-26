const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Limita tentativas de login (proteção contra força bruta):
 * 10 tentativas com erro a cada 15 minutos por IP + e-mail. Logins certos não contam.
 */
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${String(req.body?.email || '').trim().toLowerCase()}`,
  handler: (req, res) => {
    res.status(429).json({
      erro: 'Muitas tentativas de login sem sucesso. Aguarde 15 minutos e tente novamente.',
    });
  },
});

module.exports = { limiteLogin };

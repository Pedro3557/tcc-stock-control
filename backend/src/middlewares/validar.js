const { validationResult } = require('express-validator');

/** Executa as validações do express-validator e responde 400 com as mensagens. */
function validar(regras) {
  return [
    ...regras,
    (req, res, next) => {
      const resultado = validationResult(req);
      if (resultado.isEmpty()) return next();
      const detalhes = resultado.array().map((e) => ({ campo: e.path, mensagem: e.msg }));
      return res.status(400).json({ erro: detalhes[0].mensagem, detalhes });
    },
  ];
}

module.exports = validar;

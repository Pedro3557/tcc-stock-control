const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiracao } = require('../config');

/** "Versão" da senha: muda a cada troca e vai dentro do token. Token com versão antiga é recusado. */
const versaoSenha = (usuario) => (usuario.senhaAlteradaEm ? new Date(usuario.senhaAlteradaEm).getTime() : 0);

/** Momento da troca de senha sem milissegundos (o DATETIME do MySQL guarda segundos). */
const agoraSemMs = () => new Date(Math.floor(Date.now() / 1000) * 1000);

const emitirToken = (usuario) =>
  jwt.sign({ id: usuario.id, perfil: usuario.perfil, sa: versaoSenha(usuario) }, jwtSecret, { expiresIn: jwtExpiracao });

module.exports = { versaoSenha, agoraSemMs, emitirToken };

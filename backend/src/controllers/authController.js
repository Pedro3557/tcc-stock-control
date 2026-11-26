const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');
const { jwtSecret, jwtExpiracao } = require('../config');
const AppError = require('../utils/AppError');

async function login(req, res) {
  const email = String(req.body.email).trim().toLowerCase();
  const usuario = await Usuario.scope('comSenha').findOne({ where: { email } });

  const senhaOk = usuario ? await bcrypt.compare(req.body.senha, usuario.senhaHash) : false;
  if (!usuario || !senhaOk) throw new AppError('E-mail ou senha incorretos.', 401);
  if (!usuario.ativo) throw new AppError('Usuário inativo. Procure o administrador do sistema.', 401);

  const token = jwt.sign({ id: usuario.id, perfil: usuario.perfil }, jwtSecret, { expiresIn: jwtExpiracao });
  res.json({ token, usuario: usuario.toJSON() });
}

async function me(req, res) {
  res.json(req.usuario.toJSON());
}

async function trocarSenha(req, res) {
  const { senhaAtual, novaSenha } = req.body;
  const usuario = await Usuario.scope('comSenha').findByPk(req.usuario.id);

  const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!confere) throw new AppError('A senha atual está incorreta.', 400);
  if (await bcrypt.compare(novaSenha, usuario.senhaHash)) {
    throw new AppError('A nova senha precisa ser diferente da atual.', 400);
  }

  await usuario.update({ senhaHash: await bcrypt.hash(novaSenha, 10), precisaTrocarSenha: false });
  res.json({ mensagem: 'Senha alterada com sucesso.', usuario: usuario.toJSON() });
}

module.exports = { login, me, trocarSenha };

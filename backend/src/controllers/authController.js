const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Usuario } = require('../models');
const { jwtSecret, jwtExpiracao } = require('../config');
const AppError = require('../utils/AppError');
const auditoria = require('../services/auditoriaService');

const emitirToken = (usuario) => jwt.sign({ id: usuario.id, perfil: usuario.perfil }, jwtSecret, { expiresIn: jwtExpiracao });

async function login(req, res) {
  const email = String(req.body.email).trim().toLowerCase();
  const usuario = await Usuario.scope('comSenha').findOne({ where: { email } });

  const senhaOk = usuario ? await bcrypt.compare(req.body.senha, usuario.senhaHash) : false;
  if (!usuario || !senhaOk || !usuario.ativo) {
    await auditoria.registrar({
      req,
      usuario: usuario ? { id: usuario.id, nome: usuario.nome } : null,
      acao: 'login',
      modulo: 'autenticacao',
      resultado: 'falha',
      detalhe: !usuario || !senhaOk ? `Credenciais inválidas para ${email}` : `Usuário inativo: ${email}`,
    });
    if (usuario && senhaOk && !usuario.ativo) throw new AppError('Usuário inativo. Procure o administrador do sistema.', 401);
    throw new AppError('E-mail ou senha incorretos.', 401);
  }

  await auditoria.registrar({ req, usuario, acao: 'login', modulo: 'autenticacao', registroId: usuario.id });
  res.json({ token: emitirToken(usuario), usuario: usuario.toJSON() });
}

async function me(req, res) {
  res.json(req.usuario.toJSON());
}

async function trocarSenha(req, res) {
  const { senhaAtual, novaSenha } = req.body;
  const usuario = await Usuario.scope('comSenha').findByPk(req.usuario.id);

  const confere = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!confere) {
    await auditoria.registrar({ req, acao: 'trocar_senha', modulo: 'autenticacao', registroId: usuario.id, resultado: 'falha', detalhe: 'Senha atual incorreta' });
    throw new AppError('A senha atual está incorreta.', 400);
  }
  if (await bcrypt.compare(novaSenha, usuario.senhaHash)) {
    throw new AppError('A nova senha precisa ser diferente da atual.', 400);
  }

  await usuario.update({ senhaHash: await bcrypt.hash(novaSenha, 10), precisaTrocarSenha: false, senhaAlteradaEm: new Date() });
  await auditoria.registrar({ req, acao: 'trocar_senha', modulo: 'autenticacao', registroId: usuario.id });
  // Novo token: os emitidos antes da troca deixam de valer
  res.json({ mensagem: 'Senha alterada com sucesso.', token: emitirToken(usuario), usuario: usuario.toJSON() });
}

module.exports = { login, me, trocarSenha };

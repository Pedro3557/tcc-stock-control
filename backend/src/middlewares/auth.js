const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config');
const { Usuario } = require('../models');
const AppError = require('../utils/AppError');
const { versaoSenha } = require('../utils/sessao');

async function autenticar(req, res, next) {
  try {
    const cabecalho = req.headers.authorization || '';
    const [esquema, token] = cabecalho.split(' ');
    if (esquema !== 'Bearer' || !token) {
      throw new AppError('Sessão não informada. Faça login novamente.', 401);
    }

    let payload;
    try {
      payload = jwt.verify(token, jwtSecret);
    } catch {
      throw new AppError('Sessão expirada ou inválida. Faça login novamente.', 401);
    }

    const usuario = await Usuario.findByPk(payload.id);
    if (!usuario || !usuario.ativo) {
      throw new AppError('Usuário inativo ou inexistente. Faça login novamente.', 401);
    }
    // Senha trocada depois da emissão do token: a sessão antiga deixa de valer
    if ((payload.sa || 0) !== versaoSenha(usuario)) {
      throw new AppError('Sua senha foi alterada. Faça login novamente.', 401);
    }

    req.usuario = usuario;
    return next();
  } catch (erro) {
    return next(erro);
  }
}

/**
 * Enquanto o usuário não trocar a senha provisória, só pode acessar /auth/me e /auth/trocar-senha.
 */
function exigirSenhaDefinitiva(req, res, next) {
  if (req.usuario?.precisaTrocarSenha) {
    return res.status(403).json({
      erro: 'Troque a sua senha provisória antes de continuar.',
      codigo: 'TROCA_SENHA_OBRIGATORIA',
    });
  }
  return next();
}

/** Libera a rota apenas para os perfis informados. */
function permitir(...perfis) {
  return (req, res, next) => {
    if (!req.usuario || !perfis.includes(req.usuario.perfil)) {
      return next(new AppError('Você não tem permissão para realizar esta ação.', 403));
    }
    return next();
  };
}

module.exports = { autenticar, exigirSenhaDefinitiva, permitir };

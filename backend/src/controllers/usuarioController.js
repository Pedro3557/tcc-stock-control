const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const AppError = require('../utils/AppError');
const auditoria = require('../services/auditoriaService');

async function listar(req, res) {
  res.json(await Usuario.findAll({ order: [['nome', 'ASC']] }));
}

async function obter(req, res) {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);
  res.json(usuario);
}

async function criar(req, res) {
  const { nome, email, senha, perfil, recebeNotificacoes, recebeEmail } = req.body;
  const usuario = await Usuario.create({
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    perfil,
    senhaHash: await bcrypt.hash(senha, 10),
    // Senha definida pelo admin é provisória: o usuário troca no primeiro acesso
    precisaTrocarSenha: true,
    recebeNotificacoes: recebeNotificacoes ?? perfil !== 'consulta',
    recebeEmail: Boolean(recebeEmail),
    ativo: true,
  });
  await auditoria.registrar({ req, acao: 'criar', modulo: 'usuarios', registroId: usuario.id, depois: usuario });
  res.status(201).json(usuario);
}

async function atualizar(req, res) {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);
  const antes = usuario.toJSON();

  const proprio = usuario.id === req.usuario.id;
  const { nome, email, senha, perfil, ativo, recebeNotificacoes, recebeEmail } = req.body;
  if (proprio && perfil && perfil !== 'admin') {
    throw new AppError('Você não pode remover o seu próprio perfil de administrador.');
  }
  if (proprio && ativo === false) {
    throw new AppError('Você não pode desativar o seu próprio usuário.');
  }

  const dados = {};
  if (nome !== undefined) dados.nome = nome.trim();
  if (email !== undefined) dados.email = email.trim().toLowerCase();
  if (perfil !== undefined) dados.perfil = perfil;
  if (ativo !== undefined) dados.ativo = Boolean(ativo);
  if (recebeNotificacoes !== undefined) dados.recebeNotificacoes = Boolean(recebeNotificacoes);
  if (recebeEmail !== undefined) dados.recebeEmail = Boolean(recebeEmail);
  if (senha) {
    dados.senhaHash = await bcrypt.hash(senha, 10);
    dados.senhaAlteradaEm = new Date(); // encerra as sessões abertas com a senha antiga
    // Senha redefinida pelo admin para outra pessoa vira provisória
    dados.precisaTrocarSenha = !proprio;
  }

  await usuario.update(dados);
  await auditoria.registrar({
    req,
    acao: 'atualizar',
    modulo: 'usuarios',
    registroId: usuario.id,
    antes,
    depois: usuario,
    detalhe: [senha && 'senha redefinida', perfil && perfil !== antes.perfil && `perfil: ${antes.perfil} → ${perfil}`].filter(Boolean).join('; ') || null,
  });
  res.json(usuario);
}

async function excluir(req, res) {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);
  if (usuario.id === req.usuario.id) throw new AppError('Você não pode desativar o seu próprio usuário.');
  const antes = usuario.toJSON();
  // Exclusão lógica: o usuário continua aparecendo no histórico de movimentações
  await usuario.update({ ativo: false });
  await auditoria.registrar({ req, acao: 'inativar', modulo: 'usuarios', registroId: usuario.id, antes, depois: usuario });
  res.status(204).end();
}

module.exports = { listar, obter, criar, atualizar, excluir };

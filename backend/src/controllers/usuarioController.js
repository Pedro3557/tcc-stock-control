const bcrypt = require('bcryptjs');
const { Usuario } = require('../models');
const AppError = require('../utils/AppError');

async function listar(req, res) {
  res.json(await Usuario.findAll({ order: [['nome', 'ASC']] }));
}

async function obter(req, res) {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);
  res.json(usuario);
}

async function criar(req, res) {
  const { nome, email, senha, perfil } = req.body;
  const usuario = await Usuario.create({
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    perfil,
    senhaHash: await bcrypt.hash(senha, 10),
    // Senha definida pelo admin é provisória: o usuário troca no primeiro acesso
    precisaTrocarSenha: true,
    ativo: true,
  });
  res.status(201).json(usuario);
}

async function atualizar(req, res) {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);

  const proprio = usuario.id === req.usuario.id;
  const { nome, email, senha, perfil, ativo } = req.body;
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
  if (senha) {
    dados.senhaHash = await bcrypt.hash(senha, 10);
    // Senha redefinida pelo admin para outra pessoa vira provisória
    dados.precisaTrocarSenha = !proprio;
  }

  await usuario.update(dados);
  res.json(usuario);
}

async function excluir(req, res) {
  const usuario = await Usuario.findByPk(req.params.id);
  if (!usuario) throw new AppError('Usuário não encontrado.', 404);
  if (usuario.id === req.usuario.id) throw new AppError('Você não pode desativar o seu próprio usuário.');
  // Exclusão lógica: o usuário continua aparecendo no histórico de movimentações
  await usuario.update({ ativo: false });
  res.status(204).end();
}

module.exports = { listar, obter, criar, atualizar, excluir };

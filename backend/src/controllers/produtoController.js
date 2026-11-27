const { Op } = require('sequelize');
const { Produto, Categoria, Movimentacao, Equipamento, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { textoOuNull } = require('../utils/formatos');
const auditoria = require('../services/auditoriaService');
const notificacoes = require('../services/notificacaoService');

const CAMPOS_EDITAVEIS = ['categoriaId', 'codigo', 'nome', 'descricao', 'marca', 'modelo', 'tipoControle', 'unidade', 'local', 'estoqueMinimo', 'custoUnitario'];

function montarDados(body) {
  const dados = {};
  CAMPOS_EDITAVEIS.forEach((campo) => {
    if (body[campo] !== undefined) dados[campo] = typeof body[campo] === 'string' ? body[campo].trim() : body[campo];
  });
  ['descricao', 'marca', 'modelo', 'local'].forEach((c) => {
    if (c in dados) dados[c] = textoOuNull(dados[c]);
  });
  if (dados.codigo) dados.codigo = dados.codigo.toUpperCase();
  if (dados.tipoControle === 'serializado') dados.unidade = 'un';
  return dados;
}

async function listar(req, res) {
  const { busca, categoriaId, tipoControle, abaixoMinimo, incluirInativos } = req.query;
  const where = {};
  if (incluirInativos !== 'true') where.ativo = true;
  if (categoriaId) where.categoriaId = categoriaId;
  if (tipoControle) where.tipoControle = tipoControle;
  if (busca) {
    const termo = `%${busca.trim()}%`;
    where[Op.or] = [
      { codigo: { [Op.like]: termo } },
      { nome: { [Op.like]: termo } },
      { marca: { [Op.like]: termo } },
      { modelo: { [Op.like]: termo } },
      { descricao: { [Op.like]: termo } },
    ];
  }
  if (abaixoMinimo === 'true') {
    where[Op.and] = [sequelize.where(sequelize.col('Produto.quantidade'), Op.lt, sequelize.col('Produto.estoqueMinimo'))];
  }

  const produtos = await Produto.findAll({
    where,
    include: [{ model: Categoria, as: 'categoria', attributes: ['id', 'nome'] }],
    order: [['nome', 'ASC']],
  });
  res.json(produtos);
}

async function obter(req, res) {
  const produto = await Produto.findByPk(req.params.id, {
    include: [{ model: Categoria, as: 'categoria', attributes: ['id', 'nome'] }],
  });
  if (!produto) throw new AppError('Produto não encontrado.', 404);

  let resumoStatus = [];
  if (produto.tipoControle === 'serializado') {
    resumoStatus = await Equipamento.findAll({
      where: { produtoId: produto.id },
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
      group: ['status'],
      raw: true,
    });
  }
  res.json({ ...produto.toJSON(), resumoStatus });
}

async function criar(req, res) {
  const categoria = await Categoria.findByPk(req.body.categoriaId);
  if (!categoria) throw new AppError('Categoria não encontrada.', 400);
  const dados = montarDados(req.body);
  // O saldo inicial sempre começa em zero: entradas são feitas por movimentação (gera histórico)
  const produto = await Produto.create({ ...dados, quantidade: 0, ativo: true });
  await auditoria.registrar({ req, acao: 'criar', modulo: 'produtos', registroId: produto.id, depois: produto });
  res.status(201).json(produto);
}

async function atualizar(req, res) {
  const produto = await Produto.findByPk(req.params.id);
  if (!produto) throw new AppError('Produto não encontrado.', 404);
  const antes = produto.toJSON();

  const dados = montarDados(req.body);
  if (dados.categoriaId) {
    const categoria = await Categoria.findByPk(dados.categoriaId);
    if (!categoria) throw new AppError('Categoria não encontrada.', 400);
  }

  if (dados.tipoControle && dados.tipoControle !== produto.tipoControle) {
    const movimentos = await Movimentacao.count({ where: { produtoId: produto.id } });
    if (movimentos > 0) {
      throw new AppError('Não é possível alterar o tipo de controle de um produto que já possui movimentações.');
    }
  }
  if (produto.tipoControle === 'serializado' && dados.unidade && dados.unidade !== 'un') {
    throw new AppError('Produtos serializados usam sempre a unidade "un".');
  }

  if (req.body.ativo !== undefined) dados.ativo = Boolean(req.body.ativo);
  await produto.update(dados);
  await auditoria.registrar({ req, acao: 'atualizar', modulo: 'produtos', registroId: produto.id, antes, depois: produto });
  // Mudança de estoque mínimo ou reativação pode criar/encerrar alertas
  await notificacoes.verificarEstoque([produto.id]);
  res.json(produto);
}

async function excluir(req, res) {
  const produto = await Produto.findByPk(req.params.id);
  if (!produto) throw new AppError('Produto não encontrado.', 404);
  const antes = produto.toJSON();
  // Exclusão lógica: mantém o histórico de movimentações
  await produto.update({ ativo: false });
  await auditoria.registrar({ req, acao: 'inativar', modulo: 'produtos', registroId: produto.id, antes, depois: produto });
  await notificacoes.verificarEstoque([produto.id]);
  res.status(204).end();
}

module.exports = { listar, obter, criar, atualizar, excluir };

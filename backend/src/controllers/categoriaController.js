const { Categoria, Produto, sequelize } = require('../models');
const AppError = require('../utils/AppError');

async function listar(req, res) {
  const categorias = await Categoria.findAll({
    attributes: {
      include: [
        [
          sequelize.literal('(SELECT COUNT(*) FROM produtos p WHERE p.categoriaId = Categoria.id AND p.ativo = 1)'),
          'totalProdutos',
        ],
      ],
    },
    order: [['nome', 'ASC']],
  });
  res.json(categorias);
}

async function obter(req, res) {
  const categoria = await Categoria.findByPk(req.params.id);
  if (!categoria) throw new AppError('Categoria não encontrada.', 404);
  res.json(categoria);
}

async function criar(req, res) {
  const categoria = await Categoria.create({ nome: req.body.nome.trim() });
  res.status(201).json(categoria);
}

async function atualizar(req, res) {
  const categoria = await Categoria.findByPk(req.params.id);
  if (!categoria) throw new AppError('Categoria não encontrada.', 404);
  await categoria.update({ nome: req.body.nome.trim() });
  res.json(categoria);
}

async function excluir(req, res) {
  const categoria = await Categoria.findByPk(req.params.id);
  if (!categoria) throw new AppError('Categoria não encontrada.', 404);
  const produtos = await Produto.count({ where: { categoriaId: categoria.id } });
  if (produtos > 0) {
    throw new AppError(`Não é possível excluir: existem ${produtos} produto(s) nesta categoria (incluindo inativos).`);
  }
  await categoria.destroy();
  res.status(204).end();
}

module.exports = { listar, obter, criar, atualizar, excluir };

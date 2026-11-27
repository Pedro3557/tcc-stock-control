const { Categoria, Produto, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const auditoria = require('../services/auditoriaService');


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
  await auditoria.registrar({ req, acao: 'criar', modulo: 'categorias', registroId: categoria.id, depois: categoria });
  res.status(201).json(categoria);
}

async function atualizar(req, res) {
  const categoria = await Categoria.findByPk(req.params.id);
  if (!categoria) throw new AppError('Categoria não encontrada.', 404);
  const antes = categoria.toJSON();
  await categoria.update({ nome: req.body.nome.trim() });
  await auditoria.registrar({ req, acao: 'atualizar', modulo: 'categorias', registroId: categoria.id, antes, depois: categoria });
  res.json(categoria);
}

async function excluir(req, res) {
  const categoria = await Categoria.findByPk(req.params.id);
  if (!categoria) throw new AppError('Categoria não encontrada.', 404);
  const produtos = await Produto.count({ where: { categoriaId: categoria.id } });
  if (produtos > 0) {
    throw new AppError(`Não é possível excluir: existem ${produtos} produto(s) nesta categoria (incluindo inativos).`);
  }
  const antes = categoria.toJSON();
  await categoria.destroy();
  await auditoria.registrar({ req, acao: 'excluir', modulo: 'categorias', registroId: antes.id, antes });
  res.status(204).end();
}

module.exports = { listar, obter, criar, atualizar, excluir };

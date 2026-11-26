const { Movimentacao } = require('../models');
const movimentacaoService = require('../services/movimentacaoService');
const { montarFiltros, includesMovimentacao } = require('../services/filtrosMovimentacao');
const { lerPaginacao, respostaPaginada } = require('../utils/paginacao');

async function listar(req, res) {
  const where = montarFiltros(req.query);
  const paginacao = lerPaginacao(req.query, 50);
  const resultado = await Movimentacao.findAndCountAll({
    where,
    include: includesMovimentacao,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: paginacao.limite,
    offset: paginacao.offset,
    distinct: true,
  });
  res.json(respostaPaginada(resultado, paginacao));
}

async function obter(req, res) {
  const mov = await Movimentacao.findByPk(req.params.id, { include: includesMovimentacao });
  if (!mov) return res.status(404).json({ erro: 'Movimentação não encontrada.' });
  return res.json(mov);
}

async function registrar(req, res) {
  const criadas = await movimentacaoService.registrar(req.body, req.usuario);
  const movimentacoes = await Movimentacao.findAll({
    where: { id: criadas.map((m) => m.id) },
    include: includesMovimentacao,
    order: [['id', 'ASC']],
  });
  const n = movimentacoes.length;
  res.status(201).json({
    mensagem: n === 1 ? 'Movimentação registrada com sucesso.' : `${n} movimentações registradas com sucesso.`,
    movimentacoes,
  });
}

module.exports = { listar, obter, registrar };

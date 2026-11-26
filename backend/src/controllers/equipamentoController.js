const { Op } = require('sequelize');
const { Equipamento, Produto, Tecnico, Movimentacao, Categoria } = require('../models');
const AppError = require('../utils/AppError');
const { normalizarMac, pareceMac, textoOuNull } = require('../utils/formatos');
const { lerPaginacao, respostaPaginada } = require('../utils/paginacao');
const { includesMovimentacao } = require('../services/filtrosMovimentacao');

async function listar(req, res) {
  const { busca, status, produtoId, tecnicoId, categoriaId } = req.query;
  const where = {};
  if (status) where.status = String(status).includes(',') ? String(status).split(',') : status;
  if (produtoId) where.produtoId = produtoId;
  if (tecnicoId) where.tecnicoId = tecnicoId;

  const includeProduto = {
    model: Produto,
    as: 'produto',
    attributes: ['id', 'codigo', 'nome', 'marca', 'modelo', 'categoriaId'],
    include: [{ model: Categoria, as: 'categoria', attributes: ['id', 'nome'] }],
  };
  if (categoriaId) includeProduto.where = { categoriaId };

  if (busca) {
    const termo = String(busca).trim();
    const like = `%${termo}%`;
    const ou = [
      { numeroSerie: { [Op.like]: like } },
      { mac: { [Op.like]: like } },
      { clienteCodigo: { [Op.like]: like } },
      { clienteNome: { [Op.like]: like } },
      { '$tecnico.nome$': { [Op.like]: like } },
    ];
    if (pareceMac(termo)) {
      try {
        ou.push({ mac: normalizarMac(termo) });
      } catch {
        /* ignora */
      }
    }
    where[Op.or] = ou;
  }

  const paginacao = lerPaginacao(req.query, 50);
  const resultado = await Equipamento.findAndCountAll({
    where,
    include: [includeProduto, { model: Tecnico, as: 'tecnico', attributes: ['id', 'nome'] }],
    order: [['updatedAt', 'DESC']],
    limit: paginacao.limite,
    offset: paginacao.offset,
    distinct: true,
    subQuery: false,
  });
  res.json(respostaPaginada(resultado, paginacao));
}

async function buscarComHistorico(id) {
  const equipamento = await Equipamento.findByPk(id, {
    include: [
      {
        model: Produto,
        as: 'produto',
        include: [{ model: Categoria, as: 'categoria', attributes: ['id', 'nome'] }],
      },
      { model: Tecnico, as: 'tecnico', attributes: ['id', 'nome', 'telefone', 'equipe'] },
    ],
  });
  if (!equipamento) throw new AppError('Equipamento não encontrado.', 404);
  const historico = await Movimentacao.findAll({
    where: { equipamentoId: equipamento.id },
    include: includesMovimentacao.filter((i) => i.as !== 'equipamento' && i.as !== 'produto'),
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  return { equipamento, historico };
}

async function obter(req, res) {
  const { equipamento, historico } = await buscarComHistorico(req.params.id);
  res.json({ ...equipamento.toJSON(), historico });
}

async function historico(req, res) {
  const { historico: lista } = await buscarComHistorico(req.params.id);
  res.json(lista);
}

/** Edição de dados cadastrais (MAC e observação). O status só muda por movimentação. */
async function atualizar(req, res) {
  const equipamento = await Equipamento.findByPk(req.params.id);
  if (!equipamento) throw new AppError('Equipamento não encontrado.', 404);
  const dados = {};
  if (req.body.mac !== undefined) dados.mac = normalizarMac(req.body.mac);
  if (req.body.observacao !== undefined) dados.observacao = textoOuNull(req.body.observacao);
  if (req.body.numeroSerie !== undefined) {
    const serie = textoOuNull(req.body.numeroSerie);
    if (!serie) throw new AppError('O número de série não pode ficar vazio.');
    dados.numeroSerie = serie.toUpperCase();
  }
  await equipamento.update(dados);
  res.json(equipamento);
}

module.exports = { listar, obter, historico, atualizar };

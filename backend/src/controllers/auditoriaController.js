const { Op } = require('sequelize');
const { Auditoria } = require('../models');
const AppError = require('../utils/AppError');
const { lerPaginacao, respostaPaginada } = require('../utils/paginacao');

function montarFiltros(query) {
  const where = {};
  const data = (t) => /^\d{4}-\d{2}-\d{2}$/.test(t || '');
  if (query.inicio || query.fim) {
    where.createdAt = {};
    if (query.inicio) {
      if (!data(query.inicio)) throw new AppError('Data inicial inválida.');
      where.createdAt[Op.gte] = new Date(`${query.inicio}T00:00:00-03:00`);
    }
    if (query.fim) {
      if (!data(query.fim)) throw new AppError('Data final inválida.');
      where.createdAt[Op.lte] = new Date(`${query.fim}T23:59:59.999-03:00`);
    }
  }
  if (query.usuarioId) where.usuarioId = query.usuarioId;
  if (query.modulo) where.modulo = query.modulo;
  if (query.acao) where.acao = query.acao;
  if (query.resultado) where.resultado = query.resultado;
  if (query.registroId) where.registroId = query.registroId;
  return where;
}

async function listar(req, res) {
  const paginacao = lerPaginacao(req.query, 50);
  const resultado = await Auditoria.findAndCountAll({
    where: montarFiltros(req.query),
    attributes: { exclude: ['dadosAnteriores', 'dadosPosteriores'] },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: paginacao.limite,
    offset: paginacao.offset,
  });
  res.json(respostaPaginada(resultado, paginacao));
}

async function obter(req, res) {
  const registro = await Auditoria.findByPk(req.params.id);
  if (!registro) throw new AppError('Registro de auditoria não encontrado.', 404);
  res.json(registro);
}

/** Valores existentes para montar os filtros da tela. */
async function opcoes(req, res) {
  const [modulos, acoes] = await Promise.all([
    Auditoria.findAll({ attributes: ['modulo'], group: ['modulo'], order: [['modulo', 'ASC']], raw: true }),
    Auditoria.findAll({ attributes: ['acao'], group: ['acao'], order: [['acao', 'ASC']], raw: true }),
  ]);
  res.json({ modulos: modulos.map((m) => m.modulo), acoes: acoes.map((a) => a.acao) });
}

module.exports = { listar, obter, opcoes };

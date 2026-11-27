const { Op } = require('sequelize');
const { Produto, Equipamento, Usuario, Tecnico, Fornecedor } = require('../models');
const AppError = require('../utils/AppError');

function dataValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(new Date(`${texto}T00:00:00-03:00`).getTime());
}

/** Monta o WHERE das movimentações a partir da query string. Datas em YYYY-MM-DD (horário de Brasília). */
function montarFiltros(query) {
  const where = {};
  const { inicio, fim, tipo, produtoId, tecnicoId, fornecedorId, equipamentoId, cliente, clienteCodigo, os, numeroOS, usuarioId } = query;

  if (inicio || fim) {
    where.createdAt = {};
    if (inicio) {
      if (!dataValida(inicio)) throw new AppError('Data inicial inválida. Use o formato AAAA-MM-DD.');
      where.createdAt[Op.gte] = new Date(`${inicio}T00:00:00-03:00`);
    }
    if (fim) {
      if (!dataValida(fim)) throw new AppError('Data final inválida. Use o formato AAAA-MM-DD.');
      where.createdAt[Op.lte] = new Date(`${fim}T23:59:59.999-03:00`);
    }
  }
  if (tipo) where.tipo = String(tipo).includes(',') ? String(tipo).split(',') : tipo;
  if (produtoId) where.produtoId = produtoId;
  if (tecnicoId) where.tecnicoId = tecnicoId;
  if (fornecedorId) where.fornecedorId = fornecedorId;
  if (equipamentoId) where.equipamentoId = equipamentoId;
  if (usuarioId) where.usuarioId = usuarioId;
  const codCliente = clienteCodigo || cliente;
  if (codCliente) where.clienteCodigo = { [Op.like]: `%${String(codCliente).trim()}%` };
  const numOS = numeroOS || os;
  if (numOS) where.numeroOS = { [Op.like]: `%${String(numOS).trim()}%` };
  return where;
}

const includesMovimentacao = [
  { model: Produto, as: 'produto', attributes: ['id', 'codigo', 'nome', 'unidade', 'tipoControle'] },
  { model: Equipamento, as: 'equipamento', attributes: ['id', 'numeroSerie', 'mac'] },
  { model: Usuario, as: 'usuario', attributes: ['id', 'nome'] },
  { model: Tecnico, as: 'tecnico', attributes: ['id', 'nome'] },
  { model: Fornecedor, as: 'fornecedor', attributes: ['id', 'nome'] },
];

module.exports = { montarFiltros, includesMovimentacao };

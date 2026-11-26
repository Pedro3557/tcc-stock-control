const { Produto, Categoria, Equipamento, Tecnico, Movimentacao } = require('../models');
const AppError = require('../utils/AppError');
const { gerarCSV, numeroBR, quantidadeBR } = require('../services/csv');
const { montarFiltros, includesMovimentacao } = require('../services/filtrosMovimentacao');
const { STATUS_ROTULO, TIPO_ROTULO } = require('../config/constantes');
const { formatarDataHoraBR } = require('../utils/formatos');

async function csvEstoque() {
  const produtos = await Produto.findAll({
    where: { ativo: true },
    include: [{ model: Categoria, as: 'categoria', attributes: ['nome'] }],
    order: [['nome', 'ASC']],
  });
  return gerarCSV(
    [
      { titulo: 'Código', valor: (p) => p.codigo },
      { titulo: 'Produto', valor: (p) => p.nome },
      { titulo: 'Categoria', valor: (p) => p.categoria?.nome },
      { titulo: 'Marca', valor: (p) => p.marca },
      { titulo: 'Modelo', valor: (p) => p.modelo },
      { titulo: 'Controle', valor: (p) => (p.tipoControle === 'serializado' ? 'Serializado' : 'Quantidade') },
      { titulo: 'Unidade', valor: (p) => p.unidade },
      { titulo: 'Local', valor: (p) => p.local },
      { titulo: 'Quantidade', valor: (p) => quantidadeBR(p.quantidade) },
      { titulo: 'Estoque mínimo', valor: (p) => quantidadeBR(p.estoqueMinimo) },
      { titulo: 'Abaixo do mínimo', valor: (p) => (Number(p.quantidade) < Number(p.estoqueMinimo) ? 'Sim' : 'Não') },
      { titulo: 'Custo unitário (R$)', valor: (p) => numeroBR(p.custoUnitario) },
      { titulo: 'Valor total (R$)', valor: (p) => numeroBR(Number(p.quantidade) * Number(p.custoUnitario)) },
    ],
    produtos
  );
}

async function csvEquipamentos(query) {
  const where = {};
  if (query.status) where.status = String(query.status).split(',');
  if (query.produtoId) where.produtoId = query.produtoId;
  const equipamentos = await Equipamento.findAll({
    where,
    include: [
      { model: Produto, as: 'produto', attributes: ['codigo', 'nome', 'custoUnitario'] },
      { model: Tecnico, as: 'tecnico', attributes: ['nome'] },
    ],
    order: [['status', 'ASC'], ['produtoId', 'ASC'], ['numeroSerie', 'ASC']],
  });
  return gerarCSV(
    [
      { titulo: 'Status', valor: (e) => STATUS_ROTULO[e.status] },
      { titulo: 'Código', valor: (e) => e.produto?.codigo },
      { titulo: 'Produto', valor: (e) => e.produto?.nome },
      { titulo: 'Número de série', valor: (e) => e.numeroSerie },
      { titulo: 'MAC', valor: (e) => e.mac },
      { titulo: 'Técnico', valor: (e) => e.tecnico?.nome },
      { titulo: 'Código do cliente', valor: (e) => e.clienteCodigo },
      { titulo: 'Nome do cliente', valor: (e) => e.clienteNome },
      { titulo: 'Custo (R$)', valor: (e) => numeroBR(e.produto?.custoUnitario) },
      { titulo: 'Observação', valor: (e) => e.observacao },
      { titulo: 'Última atualização', valor: (e) => formatarDataHoraBR(e.updatedAt) },
    ],
    equipamentos
  );
}

async function csvMovimentacoes(query) {
  const movimentacoes = await Movimentacao.findAll({
    where: montarFiltros(query),
    include: includesMovimentacao,
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    limit: 50000,
  });
  return gerarCSV(
    [
      { titulo: 'Data/hora', valor: (m) => formatarDataHoraBR(m.createdAt) },
      { titulo: 'Tipo', valor: (m) => TIPO_ROTULO[m.tipo] },
      { titulo: 'Código', valor: (m) => m.produto?.codigo },
      { titulo: 'Produto', valor: (m) => m.produto?.nome },
      { titulo: 'Número de série', valor: (m) => m.equipamento?.numeroSerie },
      { titulo: 'MAC', valor: (m) => m.equipamento?.mac },
      { titulo: 'Quantidade', valor: (m) => quantidadeBR(m.quantidade) },
      { titulo: 'Unidade', valor: (m) => m.produto?.unidade },
      { titulo: 'Status anterior', valor: (m) => STATUS_ROTULO[m.statusAnterior] || '' },
      { titulo: 'Status novo', valor: (m) => STATUS_ROTULO[m.statusNovo] || '' },
      { titulo: 'Técnico', valor: (m) => m.tecnico?.nome },
      { titulo: 'Cliente', valor: (m) => m.clienteCodigo },
      { titulo: 'OS', valor: (m) => m.numeroOS },
      { titulo: 'Fornecedor', valor: (m) => m.fornecedor?.nome },
      { titulo: 'Nota fiscal', valor: (m) => m.notaFiscal },
      { titulo: 'Usuário', valor: (m) => m.usuario?.nome },
      { titulo: 'Observação', valor: (m) => m.observacao },
    ],
    movimentacoes
  );
}

const RELATORIOS = {
  estoque: { gerar: csvEstoque, arquivo: 'estoque-atual' },
  equipamentos: { gerar: csvEquipamentos, arquivo: 'equipamentos-por-status' },
  movimentacoes: { gerar: csvMovimentacoes, arquivo: 'movimentacoes' },
};

async function exportar(req, res) {
  const nome = req.query.relatorio || 'estoque';
  const relatorio = RELATORIOS[nome];
  if (!relatorio) throw new AppError('Relatório inválido. Use relatorio=estoque, equipamentos ou movimentacoes.');

  const csv = await relatorio.gerar(req.query);
  const data = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${relatorio.arquivo}-${data}.csv"`);
  res.send(csv);
}

module.exports = { exportar };

const { Produto, Categoria, Equipamento, Tecnico, Movimentacao } = require('../models');
const AppError = require('../utils/AppError');
const { gerarCSV, numeroBR, quantidadeBR } = require('../services/csv');
const { montarFiltros, includesMovimentacao } = require('../services/filtrosMovimentacao');
const { STATUS_ROTULO, TIPO_ROTULO } = require('../config/constantes');
const { formatarDataHoraBR } = require('../utils/formatos');

/*
 * Cada relatório tem:
 * - buscar(query): carrega os registros do banco
 * - colunas: usadas no CSV (valores já formatados no padrão brasileiro)
 * - linhaJSON: formato enviado ao front-end para montar o PDF
 */

const estoque = {
  arquivo: 'estoque-atual',
  titulo: 'Estoque atual',
  async buscar() {
    return Produto.findAll({
      where: { ativo: true },
      include: [{ model: Categoria, as: 'categoria', attributes: ['nome'] }],
      order: [['nome', 'ASC']],
    });
  },
  colunas: [
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
  linhaJSON: (p) => ({
    codigo: p.codigo,
    nome: p.nome,
    categoria: p.categoria?.nome || '',
    local: p.local || '',
    unidade: p.unidade,
    quantidade: Number(p.quantidade),
    estoqueMinimo: Number(p.estoqueMinimo),
    custoUnitario: Number(p.custoUnitario),
    valorTotal: Math.round(Number(p.quantidade) * Number(p.custoUnitario) * 100) / 100,
    abaixoMinimo: Number(p.quantidade) < Number(p.estoqueMinimo),
  }),
};

const equipamentos = {
  arquivo: 'equipamentos-por-status',
  titulo: 'Equipamentos por status',
  async buscar(query) {
    const where = {};
    if (query.status) where.status = String(query.status).split(',');
    if (query.produtoId) where.produtoId = query.produtoId;
    return Equipamento.findAll({
      where,
      include: [
        { model: Produto, as: 'produto', attributes: ['codigo', 'nome', 'custoUnitario'] },
        { model: Tecnico, as: 'tecnico', attributes: ['nome'] },
      ],
      order: [['status', 'ASC'], ['produtoId', 'ASC'], ['numeroSerie', 'ASC']],
    });
  },
  colunas: [
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
  linhaJSON: (e) => ({
    status: e.status,
    statusRotulo: STATUS_ROTULO[e.status],
    produto: e.produto?.nome || '',
    codigo: e.produto?.codigo || '',
    numeroSerie: e.numeroSerie,
    mac: e.mac || '',
    tecnico: e.tecnico?.nome || '',
    clienteCodigo: e.clienteCodigo || '',
    clienteNome: e.clienteNome || '',
    custo: Number(e.produto?.custoUnitario || 0),
  }),
};

const movimentacoes = {
  arquivo: 'movimentacoes',
  titulo: 'Movimentações do período',
  async buscar(query) {
    return Movimentacao.findAll({
      where: montarFiltros(query),
      include: includesMovimentacao,
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
      limit: 50000,
    });
  },
  colunas: [
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
  linhaJSON: (m) => ({
    data: m.createdAt,
    tipo: m.tipo,
    tipoRotulo: TIPO_ROTULO[m.tipo],
    produto: m.produto?.nome || '',
    unidade: m.produto?.unidade || '',
    numeroSerie: m.equipamento?.numeroSerie || '',
    quantidade: Number(m.quantidade),
    tecnico: m.tecnico?.nome || '',
    clienteCodigo: m.clienteCodigo || '',
    numeroOS: m.numeroOS || '',
    notaFiscal: m.notaFiscal || '',
    usuario: m.usuario?.nome || '',
    observacao: m.observacao || '',
  }),
};

const RELATORIOS = { estoque, equipamentos, movimentacoes };

function escolher(nome) {
  const relatorio = RELATORIOS[nome || 'estoque'];
  if (!relatorio) throw new AppError('Relatório inválido. Use relatorio=estoque, equipamentos ou movimentacoes.');
  return relatorio;
}

function dataHoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** GET /relatorios/exportar — CSV separado por ponto e vírgula */
async function exportar(req, res) {
  const relatorio = escolher(req.query.relatorio);
  const registros = await relatorio.buscar(req.query);
  const csv = gerarCSV(relatorio.colunas, registros);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${relatorio.arquivo}-${dataHoje()}.csv"`);
  res.send(csv);
}

/** GET /relatorios/dados — mesmos dados em JSON (o front-end gera o PDF) */
async function dados(req, res) {
  const relatorio = escolher(req.query.relatorio);
  const registros = await relatorio.buscar(req.query);
  res.json({
    relatorio: req.query.relatorio || 'estoque',
    titulo: relatorio.titulo,
    geradoEm: new Date(),
    total: registros.length,
    linhas: registros.map(relatorio.linhaJSON),
  });
}

module.exports = { exportar, dados };

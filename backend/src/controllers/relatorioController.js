const { Op } = require('sequelize');
const { Produto, Categoria, Equipamento, Tecnico, Movimentacao, Fornecedor, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { gerarCSV, numeroBR, quantidadeBR } = require('../services/csv');
const { montarFiltros, includesMovimentacao } = require('../services/filtrosMovimentacao');
const configuracoes = require('../services/configuracaoService');
const { materiaisComTecnicos } = require('./tecnicoController');
const { STATUS_ROTULO, TIPO_ROTULO } = require('../config/constantes');
const { formatarDataHoraBR } = require('../utils/formatos');

/*
 * Cada relatório tem:
 * - buscar(query): registros do banco
 * - colunas: colunas do CSV (valores no padrão brasileiro)
 * - linhaJSON: formato enviado ao front-end para montar o PDF
 * Todos saem com a organização configurada, a data de emissão, quem emitiu e os filtros aplicados.
 */

const dias = (data) => Math.floor((Date.now() - new Date(data).getTime()) / 86400000);
const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

/** Última movimentação de cada equipamento de um tipo (ex.: instalação → OS e técnico). */
async function ultimaMovimentacao(equipamentoIds, tipo) {
  if (!equipamentoIds.length) return new Map();
  const movs = await Movimentacao.findAll({
    where: { equipamentoId: equipamentoIds, tipo },
    include: [{ model: Tecnico, as: 'tecnico', attributes: ['nome'] }],
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
  });
  const mapa = new Map();
  movs.forEach((m) => {
    if (!mapa.has(m.equipamentoId)) mapa.set(m.equipamentoId, m);
  });
  return mapa;
}

const estoque = {
  arquivo: 'estoque-atual',
  titulo: 'Estoque atual',
  async buscar(query) {
    const where = { ativo: true };
    if (query.categoriaId) where.categoriaId = query.categoriaId;
    return Produto.findAll({
      where,
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

const abaixoMinimo = {
  arquivo: 'abaixo-do-minimo',
  titulo: 'Produtos abaixo do estoque mínimo',
  async buscar(query) {
    const where = { ativo: true, [Op.and]: [sequelize.where(sequelize.col('Produto.quantidade'), Op.lt, sequelize.col('Produto.estoqueMinimo'))] };
    if (query.categoriaId) where.categoriaId = query.categoriaId;
    return Produto.findAll({
      where,
      include: [{ model: Categoria, as: 'categoria', attributes: ['nome'] }],
      order: [[sequelize.literal('(Produto.quantidade / NULLIF(Produto.estoqueMinimo, 0))'), 'ASC'], ['nome', 'ASC']],
    });
  },
  colunas: [
    { titulo: 'Código', valor: (p) => p.codigo },
    { titulo: 'Produto', valor: (p) => p.nome },
    { titulo: 'Categoria', valor: (p) => p.categoria?.nome },
    { titulo: 'Unidade', valor: (p) => p.unidade },
    { titulo: 'Saldo', valor: (p) => quantidadeBR(p.quantidade) },
    { titulo: 'Estoque mínimo', valor: (p) => quantidadeBR(p.estoqueMinimo) },
    { titulo: 'Falta para o mínimo', valor: (p) => quantidadeBR(Number(p.estoqueMinimo) - Number(p.quantidade)) },
    { titulo: 'Situação', valor: (p) => (Number(p.quantidade) <= 0 ? 'Sem estoque' : 'Abaixo do mínimo') },
    { titulo: 'Custo unitário (R$)', valor: (p) => numeroBR(p.custoUnitario) },
    { titulo: 'Custo para repor (R$)', valor: (p) => numeroBR((Number(p.estoqueMinimo) - Number(p.quantidade)) * Number(p.custoUnitario)) },
  ],
  linhaJSON: (p) => ({
    codigo: p.codigo,
    nome: p.nome,
    categoria: p.categoria?.nome || '',
    unidade: p.unidade,
    quantidade: Number(p.quantidade),
    estoqueMinimo: Number(p.estoqueMinimo),
    falta: Number(p.estoqueMinimo) - Number(p.quantidade),
    semEstoque: Number(p.quantidade) <= 0,
    custoReposicao: Math.round((Number(p.estoqueMinimo) - Number(p.quantidade)) * Number(p.custoUnitario) * 100) / 100,
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

const comTecnicos = {
  arquivo: 'em-posse-dos-tecnicos',
  titulo: 'Equipamentos e materiais em posse dos técnicos',
  async buscar(query) {
    const where = { status: 'com_tecnico' };
    if (query.tecnicoId) where.tecnicoId = query.tecnicoId;
    const equips = await Equipamento.findAll({
      where,
      include: [
        { model: Produto, as: 'produto', attributes: ['codigo', 'nome', 'custoUnitario'] },
        { model: Tecnico, as: 'tecnico', attributes: ['id', 'nome'] },
      ],
      order: [['tecnicoId', 'ASC'], ['updatedAt', 'ASC']],
    });
    const tecnicos = new Map((await Tecnico.findAll({ attributes: ['id', 'nome'] })).map((t) => [t.id, t.nome]));
    const materiais = (await materiaisComTecnicos(query.tecnicoId || null)).map((m) => ({
      item: 'Material',
      tecnico: tecnicos.get(m.tecnicoId) || '',
      codigo: m.codigo,
      produto: m.nome,
      numeroSerie: '',
      quantidade: Number(m.quantidade),
      unidade: m.unidade,
      valor: Math.round(Number(m.quantidade) * Number(m.custoUnitario) * 100) / 100,
      desde: null,
      dias: null,
    }));
    return [
      ...equips.map((e) => ({
        item: 'Equipamento',
        tecnico: e.tecnico?.nome || '',
        codigo: e.produto?.codigo,
        produto: e.produto?.nome,
        numeroSerie: e.numeroSerie,
        quantidade: 1,
        unidade: 'un',
        valor: Number(e.produto?.custoUnitario || 0),
        desde: e.updatedAt,
        dias: dias(e.updatedAt),
      })),
      ...materiais,
    ].sort((a, b) => a.tecnico.localeCompare(b.tecnico, 'pt-BR') || a.item.localeCompare(b.item));
  },
  colunas: [
    { titulo: 'Técnico', valor: (l) => l.tecnico },
    { titulo: 'Tipo', valor: (l) => l.item },
    { titulo: 'Código', valor: (l) => l.codigo },
    { titulo: 'Produto', valor: (l) => l.produto },
    { titulo: 'Número de série', valor: (l) => l.numeroSerie },
    { titulo: 'Quantidade', valor: (l) => quantidadeBR(l.quantidade) },
    { titulo: 'Unidade', valor: (l) => l.unidade },
    { titulo: 'Valor (R$)', valor: (l) => numeroBR(l.valor) },
    { titulo: 'Em posse desde', valor: (l) => (l.desde ? formatarDataHoraBR(l.desde) : '') },
    { titulo: 'Dias', valor: (l) => (l.dias === null ? '' : String(l.dias)) },
  ],
  linhaJSON: (l) => l,
};

const comodato = {
  arquivo: 'equipamentos-em-comodato',
  titulo: 'Equipamentos em comodato (instalados em clientes)',
  async buscar(query) {
    const where = { status: 'instalado_cliente' };
    if (query.cliente) where.clienteCodigo = { [Op.like]: `%${String(query.cliente).trim()}%` };
    if (query.produtoId) where.produtoId = query.produtoId;
    const lista = await Equipamento.findAll({
      where,
      include: [{ model: Produto, as: 'produto', attributes: ['codigo', 'nome', 'custoUnitario'] }],
      order: [['clienteCodigo', 'ASC'], ['numeroSerie', 'ASC']],
    });
    const instalacoes = await ultimaMovimentacao(lista.map((e) => e.id), 'instalacao_cliente');
    return lista.map((e) => {
      const inst = instalacoes.get(e.id);
      return {
        clienteCodigo: e.clienteCodigo || '',
        clienteNome: e.clienteNome || '',
        produto: e.produto?.nome || '',
        codigo: e.produto?.codigo || '',
        numeroSerie: e.numeroSerie,
        mac: e.mac || '',
        instaladoEm: inst?.createdAt || e.updatedAt,
        numeroOS: inst?.numeroOS || '',
        tecnico: inst?.tecnico?.nome || '',
        valor: Number(e.produto?.custoUnitario || 0),
      };
    });
  },
  colunas: [
    { titulo: 'Código do cliente', valor: (l) => l.clienteCodigo },
    { titulo: 'Nome do cliente', valor: (l) => l.clienteNome },
    { titulo: 'Produto', valor: (l) => l.produto },
    { titulo: 'Número de série', valor: (l) => l.numeroSerie },
    { titulo: 'MAC', valor: (l) => l.mac },
    { titulo: 'Instalado em', valor: (l) => formatarDataHoraBR(l.instaladoEm) },
    { titulo: 'OS da instalação', valor: (l) => l.numeroOS },
    { titulo: 'Técnico', valor: (l) => l.tecnico },
    { titulo: 'Valor (R$)', valor: (l) => numeroBR(l.valor) },
  ],
  linhaJSON: (l) => l,
};

const manutencao = {
  arquivo: 'equipamentos-em-manutencao',
  titulo: 'Equipamentos em manutenção e com defeito',
  async buscar(query) {
    const status = query.status ? String(query.status).split(',') : ['em_manutencao', 'defeito'];
    const lista = await Equipamento.findAll({
      where: { status: status.filter((s) => ['em_manutencao', 'defeito'].includes(s)) },
      include: [{ model: Produto, as: 'produto', attributes: ['codigo', 'nome', 'custoUnitario'] }],
      order: [['status', 'ASC'], ['updatedAt', 'ASC']],
    });
    const envios = await ultimaMovimentacao(lista.map((e) => e.id), 'envio_manutencao');
    return lista.map((e) => {
      const envio = envios.get(e.id);
      return {
        status: e.status,
        statusRotulo: STATUS_ROTULO[e.status],
        produto: e.produto?.nome || '',
        numeroSerie: e.numeroSerie,
        mac: e.mac || '',
        problema: (e.status === 'em_manutencao' ? envio?.observacao : null) || e.observacao || '',
        desde: e.updatedAt,
        dias: dias(e.updatedAt),
        valor: Number(e.produto?.custoUnitario || 0),
      };
    });
  },
  colunas: [
    { titulo: 'Situação', valor: (l) => l.statusRotulo },
    { titulo: 'Produto', valor: (l) => l.produto },
    { titulo: 'Número de série', valor: (l) => l.numeroSerie },
    { titulo: 'MAC', valor: (l) => l.mac },
    { titulo: 'Problema / observação', valor: (l) => l.problema },
    { titulo: 'Desde', valor: (l) => formatarDataHoraBR(l.desde) },
    { titulo: 'Dias', valor: (l) => String(l.dias) },
    { titulo: 'Valor (R$)', valor: (l) => numeroBR(l.valor) },
  ],
  linhaJSON: (l) => l,
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

const RELATORIOS = {
  estoque,
  abaixo_minimo: abaixoMinimo,
  equipamentos,
  com_tecnicos: comTecnicos,
  comodato,
  manutencao,
  movimentacoes,
};

function escolher(nome) {
  const relatorio = RELATORIOS[nome || 'estoque'];
  if (!relatorio) throw new AppError(`Relatório inválido. Opções: ${Object.keys(RELATORIOS).join(', ')}.`);
  return relatorio;
}

/** Texto legível dos filtros aplicados (com nomes em vez de ids). */
async function descreverFiltros(query) {
  const partes = [];
  if (query.inicio || query.fim) partes.push(`Período: ${query.inicio ? dataBR(query.inicio) : 'início'} a ${query.fim ? dataBR(query.fim) : 'hoje'}`);
  if (query.tipo) partes.push(`Tipo: ${String(query.tipo).split(',').map((t) => TIPO_ROTULO[t] || t).join(', ')}`);
  if (query.status) partes.push(`Status: ${String(query.status).split(',').map((s) => STATUS_ROTULO[s] || s).join(', ')}`);
  const nome = async (Model, id, campo = 'nome') => (await Model.findByPk(id, { attributes: [campo] }))?.[campo] || `#${id}`;
  if (query.produtoId) partes.push(`Produto: ${await nome(Produto, query.produtoId)}`);
  if (query.categoriaId) partes.push(`Categoria: ${await nome(Categoria, query.categoriaId)}`);
  if (query.tecnicoId) partes.push(`Técnico: ${await nome(Tecnico, query.tecnicoId)}`);
  if (query.fornecedorId) partes.push(`Fornecedor: ${await nome(Fornecedor, query.fornecedorId)}`);
  if (query.cliente) partes.push(`Cliente: ${query.cliente}`);
  if (query.os) partes.push(`OS: ${query.os}`);
  return partes.join(' · ');
}

async function identificacao(req, relatorio) {
  const org = await configuracoes.obterPublicas();
  return {
    organizacao: org['organizacao.nome'],
    organizacaoCnpj: org['organizacao.cnpj'],
    titulo: relatorio.titulo,
    emitidoEm: formatarDataHoraBR(new Date()),
    emitidoPor: req.usuario.nome,
    filtros: await descreverFiltros(req.query),
  };
}

function dataHoje() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

/** GET /relatorios/exportar — CSV separado por ponto e vírgula, com identificação no topo */
async function exportar(req, res) {
  const relatorio = escolher(req.query.relatorio);
  const registros = await relatorio.buscar(req.query);
  const meta = await identificacao(req, relatorio);
  const csv = gerarCSV(relatorio.colunas, registros, {
    ...meta,
    organizacao: meta.organizacaoCnpj ? `${meta.organizacao} (CNPJ ${meta.organizacaoCnpj})` : meta.organizacao,
  });
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
    ...(await identificacao(req, relatorio)),
    geradoEm: new Date(),
    total: registros.length,
    linhas: registros.map(relatorio.linhaJSON),
  });
}

module.exports = { exportar, dados, RELATORIOS, descreverFiltros };

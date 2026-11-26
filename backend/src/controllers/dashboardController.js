const { sequelize, Movimentacao } = require('../models');
const { materiaisComTecnicos } = require('./tecnicoController');
const { includesMovimentacao } = require('../services/filtrosMovimentacao');

const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

function inicioDoDiaBrasilia() {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
  return new Date(`${hoje}T00:00:00-03:00`);
}

const TIPOS_ENTRADA = ['entrada_compra', 'devolucao_tecnico', 'retirada_cliente', 'retorno_manutencao'];
const TIPOS_SAIDA = ['saida_tecnico', 'instalacao_cliente', 'envio_manutencao', 'baixa'];

/**
 * Registros de entrada e saída por dia (horário de Brasília) nos últimos N dias, com zeros nos dias sem movimento.
 * Cada unidade serializada conta como um registro. Ajustes de inventário ficam de fora.
 */
async function serieMovimentacoes(dias) {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const inicio = new Date(`${hoje}T00:00:00-03:00`);
  inicio.setDate(inicio.getDate() - (dias - 1));

  const linhas = await q(
    `SELECT DATE_FORMAT(createdAt, '%Y-%m-%d') AS dia,
            SUM(tipo IN (:entradas)) AS entradas,
            SUM(tipo IN (:saidas)) AS saidas
       FROM movimentacoes
      WHERE createdAt >= :inicio
      GROUP BY dia`,
    { inicio, entradas: TIPOS_ENTRADA, saidas: TIPOS_SAIDA }
  );

  const serie = [];
  for (let i = 0; i < dias; i += 1) {
    const d = new Date(inicio.getTime() + i * 86400000);
    const dia = d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const linha = linhas.find((l) => l.dia === dia);
    serie.push({ dia, entradas: Number(linha?.entradas || 0), saidas: Number(linha?.saidas || 0) });
  }
  return serie;
}

async function resumo(req, res) {
  const [[totais], abaixoMinimo, statusEquip, disponiveisPorCategoria, materiais, [movDia]] = await Promise.all([
    q(`SELECT COUNT(*) AS produtos,
              COALESCE(SUM(CASE WHEN tipoControle = 'quantidade' THEN quantidade ELSE 0 END), 0) AS unidadesMaterial,
              COALESCE(SUM(quantidade * custoUnitario), 0) AS valorEstoque
         FROM produtos WHERE ativo = 1`),
    q(`SELECT p.id, p.codigo, p.nome, p.unidade, p.quantidade, p.estoqueMinimo, p.tipoControle, c.nome AS categoria
         FROM produtos p JOIN categorias c ON c.id = p.categoriaId
        WHERE p.ativo = 1 AND p.quantidade < p.estoqueMinimo
        ORDER BY (p.quantidade / NULLIF(p.estoqueMinimo, 0)) ASC, p.nome`),
    q(`SELECT e.status, COUNT(*) AS total, COALESCE(SUM(p.custoUnitario), 0) AS valor
         FROM equipamentos e JOIN produtos p ON p.id = e.produtoId
        GROUP BY e.status`),
    q(`SELECT c.id, c.nome AS categoria, COUNT(e.id) AS disponiveis
         FROM categorias c
         JOIN produtos p ON p.categoriaId = c.id AND p.tipoControle = 'serializado' AND p.ativo = 1
         LEFT JOIN equipamentos e ON e.produtoId = p.id AND e.status = 'em_estoque'
        GROUP BY c.id, c.nome
        ORDER BY c.nome`),
    materiaisComTecnicos(),
    q(`SELECT COUNT(*) AS total FROM movimentacoes WHERE createdAt >= :inicio`, { inicio: inicioDoDiaBrasilia() }),
  ]);

  const porStatus = (s) => statusEquip.find((x) => x.status === s) || { total: 0, valor: 0 };
  const contarCategoria = (regex) =>
    disponiveisPorCategoria.filter((c) => regex.test(c.categoria)).reduce((s, c) => s + Number(c.disponiveis), 0);

  const valorMateriaisTecnicos = materiais.reduce((s, m) => s + Number(m.quantidade) * Number(m.custoUnitario), 0);
  const movimentacoesPorDia = await serieMovimentacoes(14);
  const ultimasMovimentacoes = await Movimentacao.findAll({
    include: includesMovimentacao,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: 10,
  });

  res.json({
    totalProdutos: Number(totais.produtos),
    totalUnidadesMaterial: Number(totais.unidadesMaterial),
    totalEquipamentosEmEstoque: Number(porStatus('em_estoque').total),
    valorTotalEstoque: Math.round(Number(totais.valorEstoque) * 100) / 100,
    itensAbaixoMinimo: abaixoMinimo.length,
    listaAbaixoMinimo: abaixoMinimo.map((p) => ({
      ...p,
      quantidade: Number(p.quantidade),
      estoqueMinimo: Number(p.estoqueMinimo),
    })),
    onusDisponiveis: contarCategoria(/onu|ont/i),
    roteadoresDisponiveis: contarCategoria(/roteador|mesh/i),
    disponiveisPorCategoria: disponiveisPorCategoria.map((c) => ({ ...c, disponiveis: Number(c.disponiveis) })),
    equipamentos: {
      emEstoque: Number(porStatus('em_estoque').total),
      comTecnico: Number(porStatus('com_tecnico').total),
      emComodato: Number(porStatus('instalado_cliente').total),
      emManutencao: Number(porStatus('em_manutencao').total),
      comDefeito: Number(porStatus('defeito').total),
      baixados: Number(porStatus('baixado').total),
    },
    materialComTecnicos: {
      tecnicos: new Set(materiais.map((m) => m.tecnicoId)).size,
      itens: materiais.length,
      valor: Math.round(valorMateriaisTecnicos * 100) / 100,
      valorEquipamentos: Math.round(Number(porStatus('com_tecnico').valor) * 100) / 100,
    },
    movimentacoesHoje: Number(movDia.total),
    movimentacoesPorDia,
    ultimasMovimentacoes,
  });
}

module.exports = { resumo };

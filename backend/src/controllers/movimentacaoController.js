const { Movimentacao } = require('../models');
const movimentacaoService = require('../services/movimentacaoService');
const notificacoes = require('../services/notificacaoService');
const auditoria = require('../services/auditoriaService');
const AppError = require('../utils/AppError');
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
  if (!mov) throw new AppError('Movimentação não encontrada.', 404);
  return res.json(mov);
}

/** Resumo do pedido para a auditoria (sem a lista inteira de seriais quando ela é grande). */
function resumoPedido(body) {
  const { seriais, equipamentoIds, ...resto } = body;
  const lista = typeof seriais === 'string' ? seriais.split(/\r?\n/).filter((l) => l.trim()) : seriais || [];
  return { ...resto, seriais: lista.length > 20 ? `${lista.length} unidades` : lista, equipamentoIds };
}

async function registrar(req, res) {
  let criadas;
  try {
    criadas = await movimentacaoService.registrar(req.body, req.usuario);
  } catch (erro) {
    if (erro instanceof AppError) {
      await auditoria.registrar({
        req, acao: req.body.tipo || 'movimentar', modulo: 'movimentacoes', resultado: 'falha', detalhe: erro.message, depois: resumoPedido(req.body),
      });
    }
    throw erro;
  }

  const movimentacoes = await Movimentacao.findAll({
    where: { id: criadas.map((m) => m.id) },
    include: includesMovimentacao,
    order: [['id', 'ASC']],
  });
  await auditoria.registrar({
    req,
    acao: req.body.tipo,
    modulo: 'movimentacoes',
    registroId: movimentacoes.length === 1 ? movimentacoes[0].id : `${movimentacoes[0].id}-${movimentacoes[movimentacoes.length - 1].id}`,
    depois: movimentacoes.map((m) => ({
      id: m.id, tipo: m.tipo, produto: m.produto?.codigo, numeroSerie: m.equipamento?.numeroSerie,
      quantidade: m.quantidade, statusAnterior: m.statusAnterior, statusNovo: m.statusNovo,
      tecnicoId: m.tecnicoId, clienteCodigo: m.clienteCodigo, numeroOS: m.numeroOS, notaFiscal: m.notaFiscal, observacao: m.observacao,
    })),
  });
  await notificacoes.verificarEstoque([...new Set(movimentacoes.map((m) => m.produtoId))]);

  const n = movimentacoes.length;
  res.status(201).json({
    mensagem: n === 1 ? 'Movimentação registrada com sucesso.' : `${n} movimentações registradas com sucesso.`,
    movimentacoes,
  });
}

module.exports = { listar, obter, registrar };

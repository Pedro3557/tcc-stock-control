const inventarios = require('../services/inventarioService');
const auditoria = require('../services/auditoriaService');
const notificacoes = require('../services/notificacaoService');
const configuracoes = require('../services/configuracaoService');
const { gerarCSV, quantidadeBR } = require('../services/csv');
const { lerPaginacao } = require('../utils/paginacao');
const { formatarDataHoraBR } = require('../utils/formatos');
const { STATUS_ROTULO } = require('../config/constantes');

const SITUACAO_ROTULO = {
  ok: 'Conferido',
  divergente: 'Divergente',
  nao_contado: 'Não contado',
  serializado: 'Conferido por unidade',
  nao_encontrado: 'Não encontrado',
  localizacao_incorreta: 'Localização incorreta',
};
const ACAO_ROTULO = { pendente: 'Pendente', ajustar: 'Ajustar', manter: 'Manter' };

async function listar(req, res) {
  const { pagina, limite } = lerPaginacao(req.query, 30);
  res.json(await inventarios.listar({ situacao: req.query.situacao, pagina, limite }));
}

async function obter(req, res) {
  res.json(await inventarios.obter(req.params.id));
}

async function criar(req, res) {
  const inv = await inventarios.criar(req.body, req.usuario);
  await auditoria.registrar({ req, acao: 'criar', modulo: 'inventario', registroId: inv.id, depois: inv });
  res.status(201).json(await inventarios.obter(inv.id));
}

async function contar(req, res) {
  const item = await inventarios.contar(req.params.id, req.body, req.usuario);
  res.json(item);
}

async function ler(req, res) {
  const resultado = await inventarios.ler(req.params.id, req.body.valor, req.usuario);
  res.json(resultado);
}

async function desfazerLeitura(req, res) {
  await inventarios.desfazerLeitura(req.params.id, req.params.linhaId);
  res.status(204).end();
}

async function finalizar(req, res) {
  const detalhe = await inventarios.finalizar(req.params.id, req.usuario);
  await auditoria.registrar({ req, acao: 'finalizar_contagem', modulo: 'inventario', registroId: detalhe.id, depois: detalhe.resumo });
  if (detalhe.resumo.divergencias > 0) {
    const r = detalhe.resumo;
    await notificacoes.notificar({
      tipo: 'inventario_divergencia',
      nivel: 'aviso',
      titulo: `Divergências no inventário #${detalhe.id}`,
      mensagem:
        `${detalhe.descricao}: ${r.materiaisDivergentes} material(is) com quantidade diferente, ` +
        `${r.naoEncontrados} equipamento(s) não encontrado(s) e ${r.localizacaoIncorreta} em localização incorreta. ` +
        'Os ajustes aguardam justificativa e aprovação de um administrador.',
      link: `/inventarios/${detalhe.id}`,
      chave: `inventario:${detalhe.id}`,
    });
  }
  res.json(detalhe);
}

async function reabrir(req, res) {
  await inventarios.reabrir(req.params.id);
  await auditoria.registrar({ req, acao: 'reabrir', modulo: 'inventario', registroId: req.params.id });
  res.json(await inventarios.obter(req.params.id));
}

async function decidir(req, res) {
  const detalhe = await inventarios.decidir(req.params.id, req.body.decisoes);
  await auditoria.registrar({ req, acao: 'justificar', modulo: 'inventario', registroId: req.params.id, depois: req.body.decisoes });
  res.json(detalhe);
}

async function aprovar(req, res) {
  const antes = await inventarios.obter(req.params.id);
  try {
    const ajustes = await inventarios.aprovar(req.params.id, req.usuario);
    await auditoria.registrar({
      req,
      acao: 'aprovar_ajustes',
      modulo: 'inventario',
      registroId: req.params.id,
      antes: antes.resumo,
      depois: ajustes,
      detalhe: `${ajustes.materiais} ajuste(s) de material e ${ajustes.equipamentos} de equipamento aplicados`,
    });
    await notificacoes.verificarEstoque(ajustes.produtoIds);
    res.json({ mensagem: `Inventário aprovado: ${ajustes.materiais + ajustes.equipamentos} ajuste(s) aplicado(s) ao estoque.`, ajustes });
  } catch (erro) {
    await auditoria.registrar({ req, acao: 'aprovar_ajustes', modulo: 'inventario', registroId: req.params.id, resultado: 'falha', detalhe: erro.message });
    throw erro;
  }
}

async function cancelar(req, res) {
  await inventarios.cancelar(req.params.id, req.usuario);
  await auditoria.registrar({ req, acao: 'cancelar', modulo: 'inventario', registroId: req.params.id });
  res.status(204).end();
}

/** Linhas do resultado (materiais e equipamentos), usadas no CSV e no PDF. */
function linhasResultado(d) {
  const materiais = d.itens
    .filter((i) => i.produto.tipoControle === 'quantidade')
    .map((i) => ({
      tipo: 'Material',
      codigo: i.produto.codigo,
      produto: i.produto.nome,
      numeroSerie: '',
      sistema: `${quantidadeBR(i.quantidadeSistema)} ${i.produto.unidade}`,
      encontrado: i.quantidadeContada === null ? '' : `${quantidadeBR(i.quantidadeContada)} ${i.produto.unidade}`,
      diferenca: i.situacao === 'divergente' ? quantidadeBR(i.diferenca) : '',
      situacao: SITUACAO_ROTULO[i.situacao],
      divergente: i.situacao === 'divergente',
      acao: ACAO_ROTULO[i.acao],
      justificativa: i.justificativa || '',
    }));
  const equipamentos = d.equipamentos.map((e) => ({
    tipo: 'Equipamento',
    codigo: e.equipamento?.produto?.codigo || '',
    produto: e.equipamento?.produto?.nome || '',
    numeroSerie: e.equipamento?.numeroSerie || '',
    sistema: STATUS_ROTULO[e.statusSistema],
    encontrado: e.encontrado ? 'Encontrado' : 'Não encontrado',
    diferenca: '',
    situacao: SITUACAO_ROTULO[e.situacao],
    divergente: e.situacao !== 'ok',
    acao: e.acao === 'ajustar' ? `Ajustar para "${STATUS_ROTULO[e.statusAjuste]}"` : ACAO_ROTULO[e.acao],
    justificativa: e.justificativa || '',
  }));
  return [...materiais, ...equipamentos];
}

const COLUNAS = [
  { titulo: 'Tipo', valor: (l) => l.tipo },
  { titulo: 'Código', valor: (l) => l.codigo },
  { titulo: 'Produto', valor: (l) => l.produto },
  { titulo: 'Número de série', valor: (l) => l.numeroSerie },
  { titulo: 'No sistema', valor: (l) => l.sistema },
  { titulo: 'Encontrado', valor: (l) => l.encontrado },
  { titulo: 'Diferença', valor: (l) => l.diferenca },
  { titulo: 'Situação', valor: (l) => l.situacao },
  { titulo: 'Decisão', valor: (l) => l.acao },
  { titulo: 'Justificativa', valor: (l) => l.justificativa },
];

const SITUACAO_INVENTARIO = { em_contagem: 'Em contagem', em_revisao: 'Em revisão', concluido: 'Concluído', cancelado: 'Cancelado' };

async function meta(req, d) {
  const org = await configuracoes.obterPublicas();
  return {
    organizacao: org['organizacao.nome'],
    organizacaoCnpj: org['organizacao.cnpj'],
    titulo: `Inventário físico #${d.id} — ${d.descricao}`,
    emitidoEm: formatarDataHoraBR(new Date()),
    emitidoPor: req.usuario.nome,
    filtros: [
      `Situação: ${SITUACAO_INVENTARIO[d.situacao]}`,
      d.escopo?.categorias?.length ? `Categorias: ${d.escopo.categorias.map((c) => c.nome).join(', ')}` : null,
      d.escopo?.produtoIds?.length ? `${d.escopo.produtoIds.length} produto(s) selecionado(s)` : null,
      `Aberto em ${formatarDataHoraBR(d.createdAt)} por ${d.criador?.nome}`,
      d.aprovadoEm ? `Aprovado em ${formatarDataHoraBR(d.aprovadoEm)} por ${d.aprovador?.nome}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
  };
}

async function exportar(req, res) {
  const d = await inventarios.obter(req.params.id);
  const m = await meta(req, d);
  const csv = gerarCSV(COLUNAS, linhasResultado(d), { ...m, organizacao: m.organizacaoCnpj ? `${m.organizacao} (CNPJ ${m.organizacaoCnpj})` : m.organizacao });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="inventario-${d.id}.csv"`);
  res.send(csv);
}

async function relatorio(req, res) {
  const d = await inventarios.obter(req.params.id);
  res.json({ ...(await meta(req, d)), resumo: d.resumo, linhas: linhasResultado(d) });
}

module.exports = { listar, obter, criar, contar, ler, desfazerLeitura, finalizar, reabrir, decidir, aprovar, cancelar, exportar, relatorio };

const { Op } = require('sequelize');
const {
  sequelize,
  Inventario,
  InventarioItem,
  InventarioEquipamento,
  Produto,
  Categoria,
  Equipamento,
  Usuario,
} = require('../models');
const AppError = require('../utils/AppError');
const movimentacaoService = require('./movimentacaoService');
const { normalizarMac, pareceMac, textoOuNull } = require('../utils/formatos');
const { extrairCodigoEtiqueta } = require('../utils/codigos');
const { UNIDADES_INTEIRAS, STATUS_ROTULO } = require('../config/constantes');

/*
 * Inventário físico. Regras:
 * - Ao criar, o saldo do sistema é "fotografado" (quantidadeSistema / statusSistema).
 * - Contagem e leituras NÃO alteram o estoque.
 * - Ao finalizar, as divergências exigem decisão (ajustar ou manter) com justificativa.
 * - Só um administrador aprova; aí os ajustes viram movimentações "ajuste_inventario" numa única transação.
 * - Se o saldo mudou desde o início do inventário, a aprovação é bloqueada (é preciso recontar).
 */

// Equipamentos que deveriam estar fisicamente no almoxarifado
const STATUS_NO_ALMOXARIFADO = ['em_estoque', 'defeito'];
const ABERTOS = ['em_contagem', 'em_revisao'];

const arred = (n) => Math.round(Number(n) * 1000) / 1000;

function exigir(cond, msg, status = 400) {
  if (!cond) throw new AppError(msg, status);
}

async function carregar(id, opcoes = {}) {
  const inv = await Inventario.findByPk(id, opcoes);
  exigir(inv, 'Inventário não encontrado.', 404);
  return inv;
}

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------
async function criar({ descricao, categoriaIds = [], produtoIds = [], observacao }, usuario) {
  const cats = [...new Set((categoriaIds || []).map(Number).filter(Boolean))];
  const prods = [...new Set((produtoIds || []).map(Number).filter(Boolean))];
  exigir(cats.length || prods.length, 'Selecione ao menos uma categoria ou um produto para conferir.');

  return sequelize.transaction(async (t) => {
    const produtos = await Produto.findAll({
      where: { ativo: true, [Op.or]: [...(cats.length ? [{ categoriaId: cats }] : []), ...(prods.length ? [{ id: prods }] : [])] },
      order: [['nome', 'ASC']],
      transaction: t,
      lock: t.LOCK.SHARE,
    });
    exigir(produtos.length, 'Nenhum produto ativo encontrado na seleção.');

    // Um produto não pode estar em dois inventários abertos ao mesmo tempo
    const conflitos = await InventarioItem.findAll({
      where: { produtoId: produtos.map((p) => p.id) },
      include: [{ model: Inventario, as: 'inventario', where: { situacao: ABERTOS }, attributes: ['id', 'descricao'] }],
      transaction: t,
    });
    if (conflitos.length) {
      const invs = [...new Set(conflitos.map((c) => `#${c.inventario.id} (${c.inventario.descricao})`))];
      throw new AppError(`Há produtos desta seleção em inventário aberto: ${invs.join(', ')}. Conclua ou cancele antes.`);
    }

    const categorias = cats.length ? await Categoria.findAll({ where: { id: cats }, attributes: ['id', 'nome'], transaction: t }) : [];
    const inventario = await Inventario.create(
      {
        descricao: String(descricao || '').trim() || `Inventário de ${new Date().toLocaleDateString('pt-BR')}`,
        escopo: { categorias: categorias.map((c) => ({ id: c.id, nome: c.nome })), produtoIds: prods },
        observacao: textoOuNull(observacao),
        criadoPor: usuario.id,
        situacao: 'em_contagem',
      },
      { transaction: t }
    );

    await InventarioItem.bulkCreate(
      produtos.map((p) => ({ inventarioId: inventario.id, produtoId: p.id, quantidadeSistema: p.quantidade, acao: 'pendente' })),
      { transaction: t }
    );

    const serializados = produtos.filter((p) => p.tipoControle === 'serializado').map((p) => p.id);
    if (serializados.length) {
      const equipamentos = await Equipamento.findAll({
        where: { produtoId: serializados, status: STATUS_NO_ALMOXARIFADO },
        attributes: ['id', 'status'],
        transaction: t,
      });
      await InventarioEquipamento.bulkCreate(
        equipamentos.map((e) => ({ inventarioId: inventario.id, equipamentoId: e.id, statusSistema: e.status, esperado: true })),
        { transaction: t }
      );
    }
    return inventario;
  });
}

// ---------------------------------------------------------------------------
// Consulta com divergências calculadas
// ---------------------------------------------------------------------------

/** Classifica cada linha: ok | divergente | nao_contado (material); ok | nao_encontrado | localizacao_incorreta | pendente (equipamento). */
function situacaoItem(item, produto) {
  if (produto.tipoControle === 'serializado') return 'serializado';
  if (item.quantidadeContada === null || item.quantidadeContada === undefined) return 'nao_contado';
  return arred(item.quantidadeContada) === arred(item.quantidadeSistema) ? 'ok' : 'divergente';
}

function situacaoEquipamento(e) {
  if (e.esperado && e.encontrado) return 'ok';
  if (e.esperado && !e.encontrado) return 'nao_encontrado';
  return 'localizacao_incorreta';
}

async function obter(id) {
  const inv = await Inventario.findByPk(id, {
    include: [
      { model: Usuario, as: 'criador', attributes: ['id', 'nome'] },
      { model: Usuario, as: 'finalizador', attributes: ['id', 'nome'] },
      { model: Usuario, as: 'aprovador', attributes: ['id', 'nome'] },
    ],
  });
  exigir(inv, 'Inventário não encontrado.', 404);

  const itens = await InventarioItem.findAll({
    where: { inventarioId: id },
    include: [
      { model: Produto, as: 'produto', attributes: ['id', 'codigo', 'nome', 'unidade', 'tipoControle', 'quantidade', 'local'], include: [{ model: Categoria, as: 'categoria', attributes: ['nome'] }] },
      { model: Usuario, as: 'contador', attributes: ['id', 'nome'] },
    ],
    order: [[{ model: Produto, as: 'produto' }, 'nome', 'ASC']],
  });
  const equipamentos = await InventarioEquipamento.findAll({
    where: { inventarioId: id },
    include: [
      {
        model: Equipamento,
        as: 'equipamento',
        attributes: ['id', 'numeroSerie', 'mac', 'status', 'codigoEtiqueta', 'produtoId', 'clienteCodigo'],
        include: [{ model: Produto, as: 'produto', attributes: ['id', 'codigo', 'nome'] }],
      },
      { model: Usuario, as: 'leitor', attributes: ['id', 'nome'] },
    ],
    order: [['esperado', 'DESC'], ['id', 'ASC']],
  });

  const linhasItens = itens.map((i) => {
    const doProduto = equipamentos.filter((e) => e.equipamento?.produtoId === i.produtoId);
    const encontrados = doProduto.filter((e) => e.encontrado && STATUS_NO_ALMOXARIFADO.includes(e.statusSistema)).length;
    const situacao = situacaoItem(i, i.produto);
    return {
      ...i.toJSON(),
      situacao,
      // Serializados: "contado" = unidades em estoque lidas na conferência
      quantidadeContadaSerializado: i.produto.tipoControle === 'serializado' ? doProduto.filter((e) => e.encontrado && e.statusSistema === 'em_estoque').length : null,
      equipamentosEsperados: doProduto.filter((e) => e.esperado).length,
      equipamentosEncontrados: encontrados,
      diferenca: situacao === 'divergente' ? arred(Number(i.quantidadeContada) - Number(i.quantidadeSistema)) : 0,
    };
  });
  const linhasEquip = equipamentos.map((e) => ({ ...e.toJSON(), situacao: situacaoEquipamento(e) }));

  const resumo = {
    produtos: linhasItens.length,
    materiais: linhasItens.filter((i) => i.situacao !== 'serializado').length,
    materiaisContados: linhasItens.filter((i) => ['ok', 'divergente'].includes(i.situacao)).length,
    materiaisDivergentes: linhasItens.filter((i) => i.situacao === 'divergente').length,
    equipamentosEsperados: linhasEquip.filter((e) => e.esperado).length,
    equipamentosEncontrados: linhasEquip.filter((e) => e.esperado && e.encontrado).length,
    naoEncontrados: linhasEquip.filter((e) => e.situacao === 'nao_encontrado').length,
    localizacaoIncorreta: linhasEquip.filter((e) => e.situacao === 'localizacao_incorreta').length,
  };
  resumo.divergencias = resumo.materiaisDivergentes + resumo.naoEncontrados + resumo.localizacaoIncorreta;
  resumo.decisoesPendentes =
    linhasItens.filter((i) => i.situacao === 'divergente' && i.acao === 'pendente').length +
    linhasEquip.filter((e) => e.situacao !== 'ok' && e.acao === 'pendente').length;

  return { ...inv.toJSON(), itens: linhasItens, equipamentos: linhasEquip, resumo };
}

async function listar({ situacao, pagina = 1, limite = 30 }) {
  const where = {};
  if (situacao) where.situacao = situacao;
  const { rows, count } = await Inventario.findAndCountAll({
    where,
    include: [
      { model: Usuario, as: 'criador', attributes: ['id', 'nome'] },
      { model: Usuario, as: 'aprovador', attributes: ['id', 'nome'] },
    ],
    attributes: {
      include: [
        [sequelize.literal('(SELECT COUNT(*) FROM inventario_itens i WHERE i.inventarioId = Inventario.id)'), 'totalProdutos'],
        [sequelize.literal('(SELECT COUNT(*) FROM inventario_equipamentos e WHERE e.inventarioId = Inventario.id AND e.esperado = 1)'), 'totalEquipamentos'],
      ],
    },
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit: limite,
    offset: (pagina - 1) * limite,
    distinct: true,
  });
  return { dados: rows, total: count, pagina, limite, paginas: Math.max(1, Math.ceil(count / limite)) };
}

// ---------------------------------------------------------------------------
// Contagem e conferência (não mexem no estoque)
// ---------------------------------------------------------------------------
async function contar(id, { produtoId, quantidade }, usuario) {
  const inv = await carregar(id);
  exigir(inv.situacao === 'em_contagem', 'A contagem deste inventário já foi encerrada.');
  const item = await InventarioItem.findOne({ where: { inventarioId: id, produtoId }, include: [{ model: Produto, as: 'produto' }] });
  exigir(item, 'Este produto não faz parte do inventário.', 404);
  exigir(item.produto.tipoControle === 'quantidade', 'Equipamentos serializados são conferidos pela leitura da etiqueta, número de série ou MAC.');

  let valor = null;
  if (quantidade !== null && quantidade !== '' && quantidade !== undefined) {
    valor = Number(String(quantidade).replace(',', '.'));
    exigir(Number.isFinite(valor) && valor >= 0, 'Informe uma quantidade contada válida (zero ou maior).');
    if (UNIDADES_INTEIRAS.includes(item.produto.unidade)) {
      exigir(Number.isInteger(valor), `"${item.produto.nome}" usa a unidade "${item.produto.unidade}" e só aceita quantidades inteiras.`);
    }
  }
  await item.update({ quantidadeContada: valor, contadoPor: valor === null ? null : usuario.id, contadoEm: valor === null ? null : new Date() });
  return item;
}

async function localizarEquipamento(valor) {
  const texto = String(valor || '').trim();
  exigir(texto, 'Informe o código lido.');
  const condicoes = [{ numeroSerie: texto.toUpperCase() }];
  const codigo = extrairCodigoEtiqueta(texto);
  if (codigo) condicoes.push({ codigoEtiqueta: codigo });
  if (pareceMac(texto)) {
    try {
      condicoes.push({ mac: normalizarMac(texto) });
    } catch {
      /* ignora */
    }
  }
  const equipamento = await Equipamento.findOne({ where: { [Op.or]: condicoes }, include: [{ model: Produto, as: 'produto', attributes: ['id', 'nome'] }] });
  exigir(equipamento, `Nenhum equipamento encontrado para "${texto.slice(0, 60)}".`, 404);
  return equipamento;
}

/**
 * Registra a leitura de um equipamento na conferência.
 * Retorna { resultado: 'conferido' | 'ja_conferido' | 'localizacao_incorreta', equipamento }.
 */
async function ler(id, valor, usuario) {
  const inv = await carregar(id);
  exigir(inv.situacao === 'em_contagem', 'A conferência deste inventário já foi encerrada.');
  const equipamento = await localizarEquipamento(valor);

  const noEscopo = await InventarioItem.count({ where: { inventarioId: id, produtoId: equipamento.produtoId } });
  exigir(noEscopo, `${equipamento.numeroSerie} (${equipamento.produto?.nome}) não faz parte deste inventário.`, 422);

  const linha = await InventarioEquipamento.findOne({ where: { inventarioId: id, equipamentoId: equipamento.id } });
  if (linha) {
    if (linha.encontrado) return { resultado: 'ja_conferido', equipamento, linha };
    await linha.update({ encontrado: true, lidoPor: usuario.id, lidoEm: new Date() });
    return { resultado: linha.esperado ? 'conferido' : 'localizacao_incorreta', equipamento, linha };
  }
  // Achado no almoxarifado, mas o sistema diz que está com técnico, cliente, em manutenção ou baixado
  const nova = await InventarioEquipamento.create({
    inventarioId: id,
    equipamentoId: equipamento.id,
    statusSistema: equipamento.status,
    esperado: false,
    encontrado: true,
    lidoPor: usuario.id,
    lidoEm: new Date(),
  });
  return {
    resultado: 'localizacao_incorreta',
    equipamento,
    linha: nova,
    mensagem: `Atenção: pelo sistema, ${equipamento.numeroSerie} está "${STATUS_ROTULO[equipamento.status]}".`,
  };
}

async function desfazerLeitura(id, linhaId) {
  const inv = await carregar(id);
  exigir(inv.situacao === 'em_contagem', 'A conferência deste inventário já foi encerrada.');
  const linha = await InventarioEquipamento.findOne({ where: { id: linhaId, inventarioId: id } });
  exigir(linha, 'Leitura não encontrada.', 404);
  if (linha.esperado) await linha.update({ encontrado: false, lidoPor: null, lidoEm: null });
  else await linha.destroy();
}

// ---------------------------------------------------------------------------
// Finalização, decisões e aprovação
// ---------------------------------------------------------------------------
async function finalizar(id, usuario) {
  const inv = await carregar(id);
  exigir(inv.situacao === 'em_contagem', 'Este inventário não está em contagem.');
  const naoContados = await InventarioItem.count({
    where: { inventarioId: id, quantidadeContada: null },
    include: [{ model: Produto, as: 'produto', where: { tipoControle: 'quantidade' }, attributes: [] }],
  });
  exigir(!naoContados, `Ainda há ${naoContados} material(is) sem contagem. Informe a quantidade (pode ser zero) antes de finalizar.`);

  const detalhe = await obter(id);
  await sequelize.transaction(async (t) => {
    // O que não tem divergência fica decidido como "manter"
    for (const i of detalhe.itens) {
      const acao = i.situacao === 'divergente' ? 'pendente' : 'manter';
      await InventarioItem.update({ acao }, { where: { id: i.id }, transaction: t });
    }
    for (const e of detalhe.equipamentos) {
      const sugestao = e.situacao === 'nao_encontrado' ? 'baixado' : e.situacao === 'localizacao_incorreta' ? 'em_estoque' : null;
      await InventarioEquipamento.update(
        { acao: e.situacao === 'ok' ? 'manter' : 'pendente', statusAjuste: sugestao },
        { where: { id: e.id }, transaction: t }
      );
    }
    await inv.update({ situacao: 'em_revisao', finalizadoPor: usuario.id, finalizadoEm: new Date() }, { transaction: t });
  });
  return obter(id);
}

/** Volta para a contagem (ex.: recontar um item). As decisões já tomadas são descartadas. */
async function reabrir(id) {
  const inv = await carregar(id);
  exigir(inv.situacao === 'em_revisao', 'Só é possível reabrir um inventário em revisão.');
  await sequelize.transaction(async (t) => {
    await InventarioItem.update({ acao: 'pendente', justificativa: null }, { where: { inventarioId: id }, transaction: t });
    await InventarioEquipamento.update({ acao: 'pendente', justificativa: null, statusAjuste: null }, { where: { inventarioId: id }, transaction: t });
    await inv.update({ situacao: 'em_contagem', finalizadoPor: null, finalizadoEm: null }, { transaction: t });
  });
}

/**
 * Decisões sobre divergências: [{ tipo: 'item'|'equipamento', id, acao: 'ajustar'|'manter', justificativa, statusAjuste? }]
 * A justificativa é obrigatória em qualquer decisão sobre uma divergência.
 */
async function decidir(id, decisoes) {
  const inv = await carregar(id);
  exigir(inv.situacao === 'em_revisao', 'As decisões só podem ser registradas com o inventário em revisão.');
  exigir(Array.isArray(decisoes) && decisoes.length, 'Nenhuma decisão enviada.');

  await sequelize.transaction(async (t) => {
    for (const d of decisoes) {
      exigir(['ajustar', 'manter'].includes(d.acao), 'Ação inválida: use "ajustar" ou "manter".');
      const justificativa = textoOuNull(d.justificativa);
      exigir(justificativa && justificativa.length >= 5, 'A justificativa é obrigatória (mínimo de 5 caracteres) para cada divergência.');
      if (d.tipo === 'item') {
        const item = await InventarioItem.findOne({ where: { id: d.id, inventarioId: id }, include: [{ model: Produto, as: 'produto' }], transaction: t });
        exigir(item, 'Item do inventário não encontrado.', 404);
        exigir(item.produto.tipoControle === 'quantidade', 'Itens serializados são decididos por equipamento.');
        await item.update({ acao: d.acao, justificativa }, { transaction: t });
      } else if (d.tipo === 'equipamento') {
        const linha = await InventarioEquipamento.findOne({ where: { id: d.id, inventarioId: id }, transaction: t });
        exigir(linha, 'Equipamento do inventário não encontrado.', 404);
        let statusAjuste = null;
        if (d.acao === 'ajustar') {
          statusAjuste = d.statusAjuste || linha.statusAjuste;
          exigir(['em_estoque', 'em_manutencao', 'defeito', 'baixado'].includes(statusAjuste), 'Informe o novo status do equipamento.');
          exigir(statusAjuste !== linha.statusSistema, 'O novo status é igual ao atual: use "manter".');
        }
        await linha.update({ acao: d.acao, justificativa, statusAjuste: statusAjuste || linha.statusAjuste }, { transaction: t });
      } else {
        throw new AppError('Tipo de decisão inválido.');
      }
    }
  });
  return obter(id);
}

/** Aprovação (somente admin): aplica os ajustes decididos, tudo ou nada. */
async function aprovar(id, usuario) {
  const detalhe = await obter(id);
  exigir(detalhe.situacao === 'em_revisao', 'Só é possível aprovar um inventário em revisão.');
  exigir(detalhe.resumo.decisoesPendentes === 0, `Ainda há ${detalhe.resumo.decisoesPendentes} divergência(s) sem decisão e justificativa.`);

  const ajustes = { materiais: 0, equipamentos: 0, produtoIds: new Set() };
  await sequelize.transaction(async (t) => {
    const inv = await Inventario.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    exigir(inv.situacao === 'em_revisao', 'O inventário mudou de situação. Atualize a página.');

    for (const item of detalhe.itens.filter((i) => i.acao === 'ajustar')) {
      const produto = await Produto.findByPk(item.produtoId, { transaction: t, lock: t.LOCK.UPDATE });
      exigir(
        arred(produto.quantidade) === arred(item.quantidadeSistema),
        `O saldo de "${produto.nome}" mudou durante o inventário (era ${arred(item.quantidadeSistema)}, agora ${arred(produto.quantidade)}). Reabra e reconte este item.`
      );
      const [mov] = await movimentacaoService.registrar(
        {
          tipo: 'ajuste_inventario',
          produtoId: produto.id,
          novaQuantidade: item.quantidadeContada,
          observacao: `Inventário #${id}: ${item.justificativa}`,
        },
        usuario,
        { transaction: t }
      );
      await InventarioItem.update({ movimentacaoId: mov.id }, { where: { id: item.id }, transaction: t });
      ajustes.materiais += 1;
      ajustes.produtoIds.add(produto.id);
    }

    for (const linha of detalhe.equipamentos.filter((e) => e.acao === 'ajustar')) {
      const equipamento = await Equipamento.findByPk(linha.equipamentoId, { transaction: t, lock: t.LOCK.UPDATE });
      exigir(
        equipamento.status === linha.statusSistema,
        `O equipamento ${equipamento.numeroSerie} mudou de status durante o inventário. Reabra e confira de novo.`
      );
      const [mov] = await movimentacaoService.registrar(
        {
          tipo: 'ajuste_inventario',
          equipamentoIds: [equipamento.id],
          destino: linha.statusAjuste,
          observacao: `Inventário #${id}: ${linha.justificativa}`,
        },
        usuario,
        { transaction: t }
      );
      await InventarioEquipamento.update({ movimentacaoId: mov.id }, { where: { id: linha.id }, transaction: t });
      ajustes.equipamentos += 1;
      ajustes.produtoIds.add(equipamento.produtoId);
    }

    await inv.update({ situacao: 'concluido', aprovadoPor: usuario.id, aprovadoEm: new Date() }, { transaction: t });
  });
  return { ...ajustes, produtoIds: [...ajustes.produtoIds] };
}

async function cancelar(id, usuario) {
  const inv = await carregar(id);
  exigir(ABERTOS.includes(inv.situacao), 'Só é possível cancelar um inventário em andamento.');
  exigir(usuario.perfil === 'admin' || inv.criadoPor === usuario.id, 'Só o administrador ou quem criou o inventário pode cancelá-lo.', 403);
  await inv.update({ situacao: 'cancelado' });
  return inv;
}

module.exports = {
  criar,
  obter,
  listar,
  contar,
  ler,
  desfazerLeitura,
  finalizar,
  reabrir,
  decidir,
  aprovar,
  cancelar,
  situacaoEquipamento,
};

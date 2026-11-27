const { Op } = require('sequelize');
const { sequelize, Produto, Equipamento, Movimentacao, Tecnico, Fornecedor } = require('../models');
const AppError = require('../utils/AppError');
const { normalizarMac, pareceMac, textoOuNull } = require('../utils/formatos');
const { STATUS_ROTULO, TIPO_ROTULO, UNIDADES_INTEIRAS } = require('../config/constantes');

/**
 * Regras de transição de status para equipamentos serializados.
 * - de: status de origem aceitos
 * - para: status de destino (ou função que decide a partir dos dados)
 */
const REGRAS_SERIALIZADO = {
  saida_tecnico: { de: ['em_estoque'], para: () => 'com_tecnico' },
  devolucao_tecnico: { de: ['com_tecnico'], para: () => 'em_estoque' },
  instalacao_cliente: { de: ['em_estoque', 'com_tecnico'], para: () => 'instalado_cliente' },
  retirada_cliente: {
    de: ['instalado_cliente'],
    destinos: ['em_estoque', 'em_manutencao', 'defeito'],
    para: (d) => d.destino || 'em_estoque',
  },
  envio_manutencao: { de: ['em_estoque', 'defeito'], para: () => 'em_manutencao' },
  retorno_manutencao: {
    de: ['em_manutencao'],
    destinos: ['em_estoque', 'defeito'],
    para: (d) => d.destino || 'em_estoque',
  },
  baixa: { de: ['em_estoque', 'com_tecnico', 'em_manutencao', 'defeito'], para: () => 'baixado' },
  ajuste_inventario: {
    de: ['em_estoque', 'com_tecnico', 'instalado_cliente', 'em_manutencao', 'defeito', 'baixado'],
    destinos: ['em_estoque', 'em_manutencao', 'defeito', 'baixado'],
    para: (d) => d.destino,
  },
};

const rotuloStatus = (s) => STATUS_ROTULO[s] || s;
const rotuloTipo = (t) => TIPO_ROTULO[t] || t;

function arredondar(valor) {
  return Math.round(Number(valor) * 1000) / 1000;
}

function exigir(condicao, mensagem) {
  if (!condicao) throw new AppError(mensagem, 400);
}

/**
 * Saldo de um material (controle por quantidade) em posse de um técnico.
 * saídas - devoluções - baixas lançadas no nome do técnico (consumo em OS / perda).
 */
async function saldoTecnico(produtoId, tecnicoId, transaction) {
  const [linha] = await sequelize.query(
    `SELECT COALESCE(SUM(CASE tipo
        WHEN 'saida_tecnico' THEN quantidade
        WHEN 'devolucao_tecnico' THEN -quantidade
        WHEN 'baixa' THEN -quantidade
        ELSE 0 END), 0) AS saldo
     FROM movimentacoes
     WHERE produtoId = :produtoId AND tecnicoId = :tecnicoId AND equipamentoId IS NULL`,
    { replacements: { produtoId, tecnicoId }, type: sequelize.QueryTypes.SELECT, transaction }
  );
  return arredondar(linha?.saldo || 0);
}

/** Recalcula a quantidade de um produto serializado (= unidades com status em_estoque). */
async function recalcularSerializado(produtoId, transaction) {
  const total = await Equipamento.count({ where: { produtoId, status: 'em_estoque' }, transaction });
  await Produto.update({ quantidade: total }, { where: { id: produtoId }, transaction });
  return total;
}

/**
 * Converte a lista colada pelo usuário em [{ numeroSerie, mac }].
 * Aceita texto (uma unidade por linha: "SERIAL" ou "SERIAL;MAC", também com vírgula ou TAB)
 * ou um array de strings/objetos.
 */
function interpretarListaEntrada(lista) {
  let itens = [];
  if (typeof lista === 'string') {
    itens = lista.split(/\r?\n/);
  } else if (Array.isArray(lista)) {
    itens = lista;
  }

  const resultado = [];
  itens.forEach((item, indice) => {
    let numeroSerie;
    let mac;
    if (item && typeof item === 'object') {
      numeroSerie = textoOuNull(item.numeroSerie);
      mac = textoOuNull(item.mac);
    } else {
      const linha = String(item || '').trim();
      if (!linha) return;
      const partes = linha.split(/[;,\t]/).map((p) => p.trim()).filter(Boolean);
      [numeroSerie, mac] = partes;
    }
    if (!numeroSerie) return;
    try {
      resultado.push({ numeroSerie: numeroSerie.toUpperCase(), mac: normalizarMac(mac) });
    } catch (erro) {
      throw new AppError(`Linha ${indice + 1}: ${erro.message}`);
    }
  });
  return resultado;
}

/** Converte a lista de identificadores (série ou MAC) usada nas movimentações de unidades existentes. */
function interpretarIdentificadores(lista) {
  const itens = typeof lista === 'string' ? lista.split(/[\r\n;,\t]+/) : Array.isArray(lista) ? lista : [];
  return [...new Set(itens.map((i) => String(i || '').trim()).filter(Boolean))];
}

async function carregarTecnico(tecnicoId, transaction, obrigatorio, tipo) {
  if (!tecnicoId) {
    exigir(!obrigatorio, `Informe o técnico para a movimentação "${rotuloTipo(tipo)}".`);
    return null;
  }
  const tecnico = await Tecnico.findByPk(tecnicoId, { transaction });
  if (!tecnico) throw new AppError('Técnico não encontrado.', 404);
  if (!tecnico.ativo && ['saida_tecnico', 'instalacao_cliente'].includes(tipo)) {
    throw new AppError(`O técnico ${tecnico.nome} está inativo e não pode receber material.`);
  }
  return tecnico;
}

async function carregarFornecedor(fornecedorId, transaction) {
  if (!fornecedorId) return null;
  const fornecedor = await Fornecedor.findByPk(fornecedorId, { transaction });
  if (!fornecedor) throw new AppError('Fornecedor não encontrado.', 404);
  return fornecedor;
}

/** Validações comuns de campos obrigatórios por tipo. */
function validarCamposPorTipo(tipo, d) {
  if (tipo === 'entrada_compra') {
    exigir(d.fornecedorId, 'Informe o fornecedor da compra.');
    exigir(d.notaFiscal, 'Informe o número da nota fiscal.');
  }
  if (tipo === 'saida_tecnico') exigir(d.tecnicoId, 'Informe o técnico que vai receber o material.');
  if (tipo === 'instalacao_cliente') {
    exigir(d.clienteCodigo, 'Informe o código do cliente.');
    exigir(d.numeroOS, 'Informe o número da ordem de serviço (OS).');
  }
  if (tipo === 'baixa') exigir(d.observacao, 'Informe o motivo da baixa.');
  if (tipo === 'ajuste_inventario') exigir(d.observacao, 'Informe o motivo do ajuste de inventário.');
}

// ---------------------------------------------------------------------------
// Itens controlados por QUANTIDADE
// ---------------------------------------------------------------------------
async function movimentarQuantidade(d, produto, usuario, t) {
  const { tipo } = d;
  const atual = arredondar(produto.quantidade);
  const unidade = produto.unidade;

  const tiposPermitidos = ['entrada_compra', 'saida_tecnico', 'devolucao_tecnico', 'baixa', 'ajuste_inventario'];
  if (!tiposPermitidos.includes(tipo)) {
    throw new AppError(
      `A movimentação "${rotuloTipo(tipo)}" é exclusiva de equipamentos serializados. "${produto.nome}" é controlado por quantidade.`
    );
  }

  let quantidadeMov;
  let novaQuantidade = atual;

  if (tipo === 'ajuste_inventario') {
    const contada = Number(d.novaQuantidade);
    exigir(d.novaQuantidade !== undefined && d.novaQuantidade !== '' && Number.isFinite(contada) && contada >= 0,
      'Informe a quantidade contada no inventário (zero ou maior).');
    if (UNIDADES_INTEIRAS.includes(unidade)) {
      exigir(Number.isInteger(contada), `"${produto.nome}" usa a unidade "${unidade}" e só aceita quantidades inteiras.`);
    }
    quantidadeMov = arredondar(contada - atual);
    exigir(quantidadeMov !== 0, 'A quantidade contada é igual ao saldo atual. Nenhum ajuste necessário.');
    novaQuantidade = arredondar(contada);
  } else {
    const qtd = Number(d.quantidade);
    exigir(Number.isFinite(qtd) && qtd > 0, 'Informe uma quantidade maior que zero.');
    if (UNIDADES_INTEIRAS.includes(unidade)) {
      exigir(Number.isInteger(qtd), `"${produto.nome}" usa a unidade "${unidade}" e só aceita quantidades inteiras.`);
    }
    quantidadeMov = arredondar(qtd);

    if (tipo === 'entrada_compra') {
      novaQuantidade = arredondar(atual + quantidadeMov);
    } else if (tipo === 'saida_tecnico') {
      exigir(quantidadeMov <= atual,
        `Saldo insuficiente de "${produto.nome}": disponível ${atual} ${unidade}, solicitado ${quantidadeMov} ${unidade}.`);
      novaQuantidade = arredondar(atual - quantidadeMov);
    } else if (tipo === 'devolucao_tecnico') {
      const saldo = await saldoTecnico(produto.id, d.tecnicoId, t);
      exigir(quantidadeMov <= saldo,
        `O técnico tem apenas ${saldo} ${unidade} de "${produto.nome}" em mãos e não pode devolver ${quantidadeMov} ${unidade}.`);
      novaQuantidade = arredondar(atual + quantidadeMov);
    } else if (tipo === 'baixa') {
      if (d.tecnicoId) {
        // Baixa do material que está com o técnico (consumo em OS, perda em campo): não altera o estoque central
        const saldo = await saldoTecnico(produto.id, d.tecnicoId, t);
        exigir(quantidadeMov <= saldo,
          `O técnico tem apenas ${saldo} ${unidade} de "${produto.nome}" em mãos; não é possível baixar ${quantidadeMov} ${unidade}.`);
      } else {
        exigir(quantidadeMov <= atual,
          `Saldo insuficiente de "${produto.nome}": disponível ${atual} ${unidade}, baixa de ${quantidadeMov} ${unidade}.`);
        novaQuantidade = arredondar(atual - quantidadeMov);
      }
    }
  }

  const alteracoes = { quantidade: novaQuantidade };
  if (tipo === 'entrada_compra' && d.custoUnitario !== undefined && d.custoUnitario !== null && d.custoUnitario !== '') {
    const custo = Number(d.custoUnitario);
    exigir(Number.isFinite(custo) && custo >= 0, 'Custo unitário inválido.');
    alteracoes.custoUnitario = custo;
  }
  await produto.update(alteracoes, { transaction: t });

  const mov = await Movimentacao.create(
    {
      produtoId: produto.id,
      usuarioId: usuario.id,
      tecnicoId: d.tecnicoId || null,
      fornecedorId: tipo === 'entrada_compra' ? d.fornecedorId : null,
      tipo,
      quantidade: quantidadeMov,
      clienteCodigo: d.clienteCodigo,
      numeroOS: d.numeroOS,
      notaFiscal: d.notaFiscal,
      observacao: d.observacao,
    },
    { transaction: t }
  );

  return [mov];
}

// ---------------------------------------------------------------------------
// Entrada de equipamentos SERIALIZADOS (cadastro de novas unidades)
// ---------------------------------------------------------------------------
async function entradaSerializados(d, produto, usuario, t) {
  const unidades = interpretarListaEntrada(d.seriais);
  exigir(unidades.length > 0, 'Informe ao menos um número de série (um por linha, opcionalmente "SERIAL;MAC").');
  exigir(unidades.length <= 1000, 'Limite de 1000 unidades por entrada.');

  // Duplicidades dentro da própria lista
  const vistosSerie = new Set();
  const vistosMac = new Set();
  const repetidos = [];
  unidades.forEach((u) => {
    if (vistosSerie.has(u.numeroSerie)) repetidos.push(u.numeroSerie);
    vistosSerie.add(u.numeroSerie);
    if (u.mac) {
      if (vistosMac.has(u.mac)) repetidos.push(u.mac);
      vistosMac.add(u.mac);
    }
  });
  exigir(repetidos.length === 0, `Valores repetidos na lista: ${[...new Set(repetidos)].join(', ')}.`);

  // Duplicidades no banco
  const macs = unidades.map((u) => u.mac).filter(Boolean);
  const existentes = await Equipamento.findAll({
    where: {
      [Op.or]: [
        { numeroSerie: unidades.map((u) => u.numeroSerie) },
        ...(macs.length ? [{ mac: macs }] : []),
      ],
    },
    attributes: ['numeroSerie', 'mac'],
    transaction: t,
  });
  if (existentes.length) {
    const conflitos = [];
    existentes.forEach((e) => {
      if (vistosSerie.has(e.numeroSerie.toUpperCase())) conflitos.push(`série ${e.numeroSerie}`);
      if (e.mac && vistosMac.has(e.mac)) conflitos.push(`MAC ${e.mac}`);
    });
    throw new AppError(`Já cadastrado(s) no sistema: ${conflitos.join(', ')}.`, 400);
  }

  if (d.custoUnitario !== undefined && d.custoUnitario !== null && d.custoUnitario !== '') {
    const custo = Number(d.custoUnitario);
    exigir(Number.isFinite(custo) && custo >= 0, 'Custo unitário inválido.');
    await produto.update({ custoUnitario: custo }, { transaction: t });
  }

  const movimentacoes = [];
  for (const u of unidades) {
     
    const equipamento = await Equipamento.create(
      { produtoId: produto.id, numeroSerie: u.numeroSerie, mac: u.mac, status: 'em_estoque' },
      { transaction: t }
    );
     
    const mov = await Movimentacao.create(
      {
        produtoId: produto.id,
        equipamentoId: equipamento.id,
        usuarioId: usuario.id,
        fornecedorId: d.fornecedorId,
        tipo: 'entrada_compra',
        quantidade: 1,
        notaFiscal: d.notaFiscal,
        observacao: d.observacao,
        statusAnterior: null,
        statusNovo: 'em_estoque',
      },
      { transaction: t }
    );
    movimentacoes.push(mov);
  }

  await recalcularSerializado(produto.id, t);
  return movimentacoes;
}

// ---------------------------------------------------------------------------
// Movimentação de unidades SERIALIZADAS já cadastradas
// ---------------------------------------------------------------------------
async function localizarEquipamentos(d, t) {
  const ids = Array.isArray(d.equipamentoIds) ? d.equipamentoIds.map(Number).filter(Boolean) : [];
  const identificadores = interpretarIdentificadores(d.seriais);
  exigir(ids.length || identificadores.length, 'Informe ao menos um equipamento (número de série ou MAC).');

  const condicoes = [];
  if (ids.length) condicoes.push({ id: ids });
  if (identificadores.length) {
    condicoes.push({ numeroSerie: identificadores });
    const macs = [];
    identificadores.forEach((i) => {
      if (pareceMac(i)) macs.push(normalizarMac(i));
    });
    if (macs.length) condicoes.push({ mac: macs });
  }

  const equipamentos = await Equipamento.findAll({
    where: { [Op.or]: condicoes },
    include: [{ model: Produto, as: 'produto' }],
    order: [['id', 'ASC']],
    lock: t.LOCK.UPDATE,
    transaction: t,
  });

  // Informa claramente quais identificadores não foram encontrados
  const naoEncontrados = identificadores.filter((i) => {
    const iu = i.toUpperCase();
    const mac = pareceMac(i) ? normalizarMac(i) : null;
    return !equipamentos.some((e) => e.numeroSerie.toUpperCase() === iu || (mac && e.mac === mac));
  });
  const idsNaoEncontrados = ids.filter((id) => !equipamentos.some((e) => e.id === id));
  if (naoEncontrados.length || idsNaoEncontrados.length) {
    const lista = [...naoEncontrados, ...idsNaoEncontrados.map((id) => `#${id}`)];
    throw new AppError(`Equipamento(s) não encontrado(s): ${lista.join(', ')}.`, 404);
  }
  return equipamentos;
}

async function movimentarSerializados(d, usuario, t, produtoInformado) {
  const { tipo } = d;
  const regra = REGRAS_SERIALIZADO[tipo];
  exigir(regra, `Tipo de movimentação inválido para equipamentos: ${tipo}.`);

  if (regra.destinos) {
    if (tipo === 'ajuste_inventario') exigir(d.destino, 'Informe o novo status do equipamento no ajuste de inventário.');
    if (d.destino) {
      exigir(regra.destinos.includes(d.destino),
        `Destino inválido para "${rotuloTipo(tipo)}". Opções: ${regra.destinos.map(rotuloStatus).join(', ')}.`);
    }
  }

  const equipamentos = await localizarEquipamentos(d, t);

  const produtosAfetados = new Set();
  const movimentacoes = [];

  for (const eq of equipamentos) {
    const produto = eq.produto;
    if (produtoInformado) {
      exigir(eq.produtoId === produtoInformado.id,
        `O equipamento ${eq.numeroSerie} pertence ao produto "${produto.nome}", e não a "${produtoInformado.nome}".`);
    }
    exigir(produto.tipoControle === 'serializado', `O produto "${produto.nome}" não é serializado.`);
    exigir(produto.ativo || ['retirada_cliente', 'devolucao_tecnico', 'baixa', 'ajuste_inventario'].includes(tipo),
      `O produto "${produto.nome}" está inativo e não pode ser movimentado neste tipo de operação.`);

    const statusAnterior = eq.status;
    if (!regra.de.includes(statusAnterior)) {
      throw new AppError(
        `O equipamento ${eq.numeroSerie} está com status "${rotuloStatus(statusAnterior)}" e não pode passar por "${rotuloTipo(tipo)}". ` +
          `Status permitido(s): ${regra.de.map(rotuloStatus).join(', ')}.`
      );
    }
    const statusNovo = regra.para(d);
    exigir(statusNovo !== statusAnterior,
      `O equipamento ${eq.numeroSerie} já está com status "${rotuloStatus(statusNovo)}".`);

    let tecnicoMov = d.tecnicoId ? Number(d.tecnicoId) : null;
    let clienteMov = textoOuNull(d.clienteCodigo);
    const alteracoes = { status: statusNovo };

    switch (tipo) {
      case 'saida_tecnico':
        alteracoes.tecnicoId = tecnicoMov;
        break;
      case 'devolucao_tecnico':
        if (tecnicoMov && eq.tecnicoId !== tecnicoMov) {
          throw new AppError(`O equipamento ${eq.numeroSerie} não está com o técnico informado.`);
        }
        tecnicoMov = eq.tecnicoId;
        alteracoes.tecnicoId = null;
        break;
      case 'instalacao_cliente':
        if (statusAnterior === 'com_tecnico') {
          if (tecnicoMov && eq.tecnicoId !== tecnicoMov) {
            throw new AppError(`O equipamento ${eq.numeroSerie} está com outro técnico. Faça a devolução antes ou selecione o técnico correto.`);
          }
          tecnicoMov = eq.tecnicoId;
        }
        alteracoes.tecnicoId = null;
        alteracoes.clienteCodigo = clienteMov;
        alteracoes.clienteNome = textoOuNull(d.clienteNome);
        break;
      case 'retirada_cliente':
        clienteMov = clienteMov || eq.clienteCodigo;
        if (d.clienteCodigo && eq.clienteCodigo && eq.clienteCodigo !== clienteMov) {
          throw new AppError(`O equipamento ${eq.numeroSerie} está instalado no cliente ${eq.clienteCodigo}, e não no cliente ${clienteMov}.`);
        }
        alteracoes.clienteCodigo = null;
        alteracoes.clienteNome = null;
        break;
      case 'baixa':
      case 'ajuste_inventario':
      case 'envio_manutencao':
        if (statusAnterior === 'com_tecnico') tecnicoMov = tecnicoMov || eq.tecnicoId;
        if (statusAnterior === 'instalado_cliente') clienteMov = clienteMov || eq.clienteCodigo;
        alteracoes.tecnicoId = null;
        alteracoes.clienteCodigo = null;
        alteracoes.clienteNome = null;
        break;
      default:
        break;
    }

    if (d.observacao && tipo !== 'entrada_compra') {
      alteracoes.observacao = d.observacao;
    }

     
    await eq.update(alteracoes, { transaction: t });

    let quantidade = 1;
    if (tipo === 'ajuste_inventario') {
      if (statusNovo === 'em_estoque') quantidade = 1;
      else if (statusAnterior === 'em_estoque') quantidade = -1;
      else quantidade = 0;
    }

     
    const mov = await Movimentacao.create(
      {
        produtoId: eq.produtoId,
        equipamentoId: eq.id,
        usuarioId: usuario.id,
        tecnicoId: tecnicoMov,
        tipo,
        quantidade,
        clienteCodigo: clienteMov,
        numeroOS: d.numeroOS,
        notaFiscal: d.notaFiscal,
        observacao: d.observacao,
        statusAnterior,
        statusNovo,
      },
      { transaction: t }
    );
    movimentacoes.push(mov);
    produtosAfetados.add(eq.produtoId);
  }

  for (const produtoId of produtosAfetados) {
     
    await recalcularSerializado(produtoId, t);
  }

  return movimentacoes;
}

/**
 * Registra uma movimentação de estoque. Tudo acontece dentro de uma única transação:
 * o(s) registro(s) de movimentação e a atualização de saldo/status são gravados juntos.
 * opcoes.transaction permite incluir o registro em uma transação maior (importação).
 */
/** Usa a transação recebida (ex.: importação de planilha) ou abre uma nova. */
function emTransacao(transacaoExterna, fn) {
  return transacaoExterna ? fn(transacaoExterna) : sequelize.transaction(fn);
}

async function registrar(dadosBrutos, usuario, opcoes = {}) {
  const d = {
    ...dadosBrutos,
    clienteCodigo: textoOuNull(dadosBrutos.clienteCodigo),
    clienteNome: textoOuNull(dadosBrutos.clienteNome),
    numeroOS: textoOuNull(dadosBrutos.numeroOS),
    notaFiscal: textoOuNull(dadosBrutos.notaFiscal),
    observacao: textoOuNull(dadosBrutos.observacao),
    destino: textoOuNull(dadosBrutos.destino),
    produtoId: dadosBrutos.produtoId ? Number(dadosBrutos.produtoId) : null,
    tecnicoId: dadosBrutos.tecnicoId ? Number(dadosBrutos.tecnicoId) : null,
    fornecedorId: dadosBrutos.fornecedorId ? Number(dadosBrutos.fornecedorId) : null,
  };
  const { tipo } = d;

  if (tipo === 'ajuste_inventario' && usuario.perfil !== 'admin') {
    throw new AppError('Somente administradores podem fazer ajuste de inventário.', 403);
  }

  validarCamposPorTipo(tipo, d);

  const movimentacoes = await emTransacao(opcoes.transaction, async (t) => {
    await carregarTecnico(d.tecnicoId, t, tipo === 'saida_tecnico', tipo);
    if (tipo === 'entrada_compra') await carregarFornecedor(d.fornecedorId, t);

    let produto = null;
    if (d.produtoId) {
      produto = await Produto.findByPk(d.produtoId, { transaction: t, lock: t.LOCK.UPDATE });
      if (!produto) throw new AppError('Produto não encontrado.', 404);
    }

    const informouUnidades =
      (Array.isArray(d.equipamentoIds) && d.equipamentoIds.length > 0) ||
      (typeof d.seriais === 'string' ? d.seriais.trim() !== '' : Array.isArray(d.seriais) && d.seriais.length > 0);

    if (tipo === 'entrada_compra') {
      exigir(produto, 'Selecione o produto da entrada.');
      exigir(produto.ativo, `O produto "${produto.nome}" está inativo. Reative-o antes de dar entrada.`);
      if (produto.tipoControle === 'serializado') return entradaSerializados(d, produto, usuario, t);
      return movimentarQuantidade(d, produto, usuario, t);
    }

    if (informouUnidades || (produto && produto.tipoControle === 'serializado')) {
      if (produto) exigir(produto.tipoControle === 'serializado',
        `"${produto.nome}" é controlado por quantidade: informe a quantidade, não números de série.`);
      return movimentarSerializados(d, usuario, t, produto);
    }

    exigir(produto, 'Selecione o produto ou informe os números de série dos equipamentos.');
    exigir(produto.ativo || ['devolucao_tecnico', 'baixa', 'ajuste_inventario'].includes(tipo),
      `O produto "${produto.nome}" está inativo.`);
    return movimentarQuantidade(d, produto, usuario, t);
  });

  return movimentacoes;
}

module.exports = {
  registrar,
  saldoTecnico,
  recalcularSerializado,
  interpretarListaEntrada,
  REGRAS_SERIALIZADO,
};

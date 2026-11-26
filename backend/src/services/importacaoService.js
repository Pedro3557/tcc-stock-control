const ExcelJS = require('exceljs');
const { sequelize, Produto, Categoria, Movimentacao } = require('../models');
const AppError = require('../utils/AppError');
const { textoOuNull } = require('../utils/formatos');
const { UNIDADES, UNIDADES_INTEIRAS } = require('../config/constantes');
const movimentacaoService = require('./movimentacaoService');

const LIMITE_LINHAS = 5000;

/** Erro usado só para desfazer a transação na simulação (prévia) ou quando há erros. */
class Desfazer extends Error {}

// ---------------------------------------------------------------------------
// Leitura da planilha
// ---------------------------------------------------------------------------

/** "Número de série" -> "numero_de_serie" */
function normalizarCabecalho(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Converte o valor de uma célula do ExcelJS em texto/número simples. */
function valorCelula(valor) {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor;
  if (typeof valor === 'object') {
    if ('result' in valor) return valorCelula(valor.result); // fórmula
    if (Array.isArray(valor.richText)) return valor.richText.map((p) => p.text).join('');
    if ('text' in valor) return valor.text; // hiperlink
    if ('error' in valor) return null;
    return String(valor);
  }
  return valor;
}

/** Sinônimos aceitos nos cabeçalhos (planilhas feitas à mão variam muito). */
const SINONIMOS = {
  codigo: ['codigo', 'sku', 'codigo_sku', 'cod', 'codigo_do_produto', 'codigo_produto'],
  nome: ['nome', 'produto', 'descricao', 'nome_do_produto'],
  categoria: ['categoria', 'grupo'],
  marca: ['marca', 'fabricante'],
  modelo: ['modelo'],
  tipo_controle: ['tipo_controle', 'tipo_de_controle', 'controle', 'tipo'],
  unidade: ['unidade', 'un', 'unid'],
  local: ['local', 'prateleira', 'localizacao'],
  estoque_minimo: ['estoque_minimo', 'minimo', 'est_minimo'],
  custo_unitario: ['custo_unitario', 'custo', 'valor_unitario', 'preco', 'preco_unitario', 'custo_unitario_r'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'quant'],
  numero_serie: ['numero_serie', 'numero_de_serie', 'n_serie', 'no_serie', 'serie', 'serial', 'sn', 'gpon_sn'],
  mac: ['mac', 'endereco_mac', 'mac_address'],
};

function mapearCabecalhos(cabecalhos) {
  const mapa = {};
  cabecalhos.forEach((cab, indice) => {
    const normal = normalizarCabecalho(cab);
    Object.entries(SINONIMOS).forEach(([campo, nomes]) => {
      if (mapa[campo] === undefined && nomes.includes(normal)) mapa[campo] = indice;
    });
  });
  return mapa;
}

/**
 * Lê a primeira aba de um .xlsx. A primeira linha preenchida é o cabeçalho.
 * Retorna [{ linha: númeroDaLinhaNoExcel, ...campos }].
 */
async function lerPlanilha(buffer) {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new AppError('Não foi possível ler o arquivo. Envie uma planilha do Excel (.xlsx).');
  }
  const aba = workbook.worksheets.find((w) => w.actualRowCount > 0);
  if (!aba) throw new AppError('A planilha está vazia.');

  let cabecalho = null;
  let mapa = null;
  const linhas = [];

  aba.eachRow({ includeEmpty: false }, (row, numero) => {
    const valores = [];
    for (let c = 1; c <= row.cellCount; c += 1) valores.push(valorCelula(row.getCell(c).value));

    if (!cabecalho) {
      cabecalho = valores;
      mapa = mapearCabecalhos(valores);
      return;
    }
    if (valores.every((v) => v === null || String(v).trim() === '')) return;

    const registro = { linha: numero };
    Object.entries(mapa).forEach(([campo, indice]) => {
      const v = valores[indice];
      registro[campo] = v === null || v === undefined ? null : v;
    });
    linhas.push(registro);
  });

  if (!cabecalho) throw new AppError('A planilha está vazia.');
  if (linhas.length === 0) throw new AppError('A planilha não tem linhas de dados abaixo do cabeçalho.');
  if (linhas.length > LIMITE_LINHAS) throw new AppError(`Limite de ${LIMITE_LINHAS} linhas por importação.`);
  return { linhas, colunasReconhecidas: Object.keys(mapa) };
}

// ---------------------------------------------------------------------------
// Conversões
// ---------------------------------------------------------------------------

/** Aceita 1234,56 · 1.234,56 · 1234.56 · número do Excel. Retorna null se vazio, NaN se inválido. */
function numeroPlanilha(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === '') return null;
  if (typeof valor === 'number') return valor;
  let texto = String(valor).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (texto.includes(',')) texto = texto.replace(/\./g, '').replace(',', '.');
  const n = Number(texto);
  return Number.isFinite(n) ? n : NaN;
}

function tipoControlePlanilha(valor) {
  const t = normalizarCabecalho(valor);
  if (['serializado', 'serial', 'serie', 's', 'numero_de_serie'].includes(t)) return 'serializado';
  if (['quantidade', 'qtd', 'q', 'consumo', 'material'].includes(t)) return 'quantidade';
  return null;
}

function texto(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return textoOuNull(valor === null || valor === undefined ? null : String(valor));
}

// ---------------------------------------------------------------------------
// Execução com prévia (simulação)
// ---------------------------------------------------------------------------

/**
 * Roda a importação em uma transação. Na simulação, ou se houver qualquer erro,
 * a transação é desfeita — nada é gravado pela metade.
 */
async function executar(simular, fn) {
  const resultado = { simulado: simular, erros: [] };
  try {
    await sequelize.transaction(async (t) => {
      await fn(t, resultado);
      if (simular || resultado.erros.length) throw new Desfazer();
    });
  } catch (erro) {
    if (!(erro instanceof Desfazer)) throw erro;
  }
  resultado.gravado = !simular && resultado.erros.length === 0;
  return resultado;
}

// ---------------------------------------------------------------------------
// Importação de PRODUTOS (cadastro)
// ---------------------------------------------------------------------------
async function importarProdutos(buffer, { simular = true } = {}) {
  const { linhas, colunasReconhecidas } = await lerPlanilha(buffer);
  ['codigo', 'nome', 'categoria'].forEach((c) => {
    if (!colunasReconhecidas.includes(c)) {
      throw new AppError(`Coluna obrigatória não encontrada: "${c}". Baixe o modelo para ver o formato.`);
    }
  });

  return executar(simular, async (t, resultado) => {
    resultado.criados = [];
    resultado.atualizados = [];
    resultado.categoriasCriadas = [];
    const vistos = new Set();
    const categorias = new Map(
      (await Categoria.findAll({ transaction: t })).map((c) => [c.nome.toLowerCase(), c])
    );

    for (const l of linhas) {
      const erro = (mensagem) => resultado.erros.push({ linha: l.linha, mensagem });
      const codigo = texto(l.codigo)?.toUpperCase();
      const nome = texto(l.nome);
      const nomeCategoria = texto(l.categoria);

      if (!codigo) { erro('Código (SKU) em branco.'); continue; }
      if (codigo.length > 40) { erro(`Código "${codigo}" tem mais de 40 caracteres.`); continue; }
      if (vistos.has(codigo)) { erro(`Código "${codigo}" repetido na planilha.`); continue; }
      vistos.add(codigo);
      if (!nome || nome.length < 2) { erro(`Produto ${codigo}: informe o nome.`); continue; }
      if (!nomeCategoria) { erro(`Produto ${codigo}: informe a categoria.`); continue; }

      const existente = await Produto.findOne({ where: { codigo }, transaction: t });

      let tipoControle = l.tipo_controle ? tipoControlePlanilha(l.tipo_controle) : null;
      if (l.tipo_controle && !tipoControle) {
        erro(`Produto ${codigo}: tipo de controle "${l.tipo_controle}" inválido (use "serializado" ou "quantidade").`);
        continue;
      }
      if (!tipoControle) tipoControle = existente ? existente.tipoControle : 'quantidade';

      let unidade = texto(l.unidade)?.toLowerCase() || (existente ? existente.unidade : 'un');
      if (unidade === 'metro' || unidade === 'metros') unidade = 'm';
      if (tipoControle === 'serializado') unidade = 'un';
      if (!UNIDADES.includes(unidade)) {
        erro(`Produto ${codigo}: unidade "${unidade}" inválida (use ${UNIDADES.join(', ')}).`);
        continue;
      }

      const estoqueMinimo = numeroPlanilha(l.estoque_minimo);
      const custoUnitario = numeroPlanilha(l.custo_unitario);
      if (Number.isNaN(estoqueMinimo) || (estoqueMinimo !== null && estoqueMinimo < 0)) {
        erro(`Produto ${codigo}: estoque mínimo inválido.`);
        continue;
      }
      if (Number.isNaN(custoUnitario) || (custoUnitario !== null && custoUnitario < 0)) {
        erro(`Produto ${codigo}: custo unitário inválido.`);
        continue;
      }

      let categoria = categorias.get(nomeCategoria.toLowerCase());
      if (!categoria) {
        categoria = await Categoria.create({ nome: nomeCategoria }, { transaction: t });
        categorias.set(nomeCategoria.toLowerCase(), categoria);
        resultado.categoriasCriadas.push(nomeCategoria);
      }

      const dados = {
        codigo,
        nome,
        categoriaId: categoria.id,
        tipoControle,
        unidade,
        marca: texto(l.marca),
        modelo: texto(l.modelo),
        local: texto(l.local),
      };
      if (estoqueMinimo !== null) dados.estoqueMinimo = estoqueMinimo;
      if (custoUnitario !== null) dados.custoUnitario = custoUnitario;

      if (existente) {
        if (existente.tipoControle !== tipoControle) {
          const movimentos = await Movimentacao.count({ where: { produtoId: existente.id }, transaction: t });
          if (movimentos > 0) {
            erro(`Produto ${codigo}: o tipo de controle não pode mudar porque já há movimentações.`);
            continue;
          }
        }
        await existente.update({ ...dados, ativo: true }, { transaction: t });
        resultado.atualizados.push({ linha: l.linha, codigo, nome });
      } else {
        await Produto.create({ ...dados, quantidade: 0, ativo: true }, { transaction: t });
        resultado.criados.push({ linha: l.linha, codigo, nome });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Importação de ENTRADA (compra): quantidades e números de série/MAC
// ---------------------------------------------------------------------------
async function importarEntrada(buffer, usuario, { simular = true, fornecedorId, notaFiscal, observacao } = {}) {
  if (!fornecedorId) throw new AppError('Selecione o fornecedor da compra.');
  if (!textoOuNull(notaFiscal)) throw new AppError('Informe o número da nota fiscal.');

  const { linhas, colunasReconhecidas } = await lerPlanilha(buffer);
  if (!colunasReconhecidas.includes('codigo')) {
    throw new AppError('Coluna obrigatória não encontrada: "codigo". Baixe o modelo para ver o formato.');
  }
  if (!colunasReconhecidas.includes('quantidade') && !colunasReconhecidas.includes('numero_serie')) {
    throw new AppError('A planilha precisa ter a coluna "quantidade" (materiais) e/ou "numero_serie" (equipamentos).');
  }

  return executar(simular, async (t, resultado) => {
    resultado.itens = [];
    const produtos = new Map();
    const grupos = new Map(); // produtoId -> { produto, quantidade, seriais[], custo, linhas[] }

    for (const l of linhas) {
      const erro = (mensagem) => resultado.erros.push({ linha: l.linha, mensagem });
      const codigo = texto(l.codigo)?.toUpperCase();
      if (!codigo) { erro('Código do produto em branco.'); continue; }

      if (!produtos.has(codigo)) {
        produtos.set(codigo, await Produto.findOne({ where: { codigo }, transaction: t }));
      }
      const produto = produtos.get(codigo);
      if (!produto) { erro(`Produto "${codigo}" não cadastrado. Importe ou cadastre o produto antes.`); continue; }
      if (!produto.ativo) { erro(`Produto "${codigo}" está inativo.`); continue; }

      if (!grupos.has(produto.id)) grupos.set(produto.id, { produto, quantidade: 0, seriais: [], custo: null, linhas: [] });
      const grupo = grupos.get(produto.id);
      grupo.linhas.push(l.linha);

      const custo = numeroPlanilha(l.custo_unitario);
      if (Number.isNaN(custo) || (custo !== null && custo < 0)) { erro(`${codigo}: custo unitário inválido.`); continue; }
      if (custo !== null) grupo.custo = custo;

      if (produto.tipoControle === 'serializado') {
        const serie = texto(l.numero_serie);
        if (!serie) { erro(`${codigo} é serializado: informe o número de série.`); continue; }
        grupo.seriais.push({ numeroSerie: serie, mac: texto(l.mac) });
      } else {
        const qtd = numeroPlanilha(l.quantidade);
        if (qtd === null || Number.isNaN(qtd) || qtd <= 0) { erro(`${codigo}: informe uma quantidade maior que zero.`); continue; }
        if (UNIDADES_INTEIRAS.includes(produto.unidade) && !Number.isInteger(qtd)) {
          erro(`${codigo}: a unidade "${produto.unidade}" só aceita quantidades inteiras.`);
          continue;
        }
        grupo.quantidade += qtd;
      }
    }

    if (resultado.erros.length) return;

    // Uma movimentação de entrada por produto, todas na mesma transação
    for (const grupo of grupos.values()) {
      const { produto } = grupo;
      const dados = {
        tipo: 'entrada_compra',
        produtoId: produto.id,
        fornecedorId,
        notaFiscal,
        observacao: textoOuNull(observacao) || 'Entrada importada de planilha',
        custoUnitario: grupo.custo ?? undefined,
      };
      if (produto.tipoControle === 'serializado') dados.seriais = grupo.seriais;
      else dados.quantidade = Math.round(grupo.quantidade * 1000) / 1000;

      try {
        await movimentacaoService.registrar(dados, usuario, { transaction: t });
        resultado.itens.push({
          codigo: produto.codigo,
          nome: produto.nome,
          tipoControle: produto.tipoControle,
          unidade: produto.unidade,
          quantidade: produto.tipoControle === 'serializado' ? grupo.seriais.length : dados.quantidade,
        });
      } catch (falha) {
        if (!(falha instanceof AppError)) throw falha;
        resultado.erros.push({ linha: grupo.linhas.join(', '), mensagem: `${produto.codigo}: ${falha.message}` });
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Modelos para download
// ---------------------------------------------------------------------------
const MODELOS = {
  produtos: {
    arquivo: 'modelo-importacao-produtos.xlsx',
    colunas: ['codigo', 'nome', 'categoria', 'marca', 'modelo', 'tipo_controle', 'unidade', 'local', 'estoque_minimo', 'custo_unitario'],
    exemplos: [
      ['ONU-ZTE-F670L', 'ONU GPON Wi-Fi Dual Band', 'ONU/ONT', 'ZTE', 'F670L', 'serializado', 'un', 'A1-03', 5, 175.9],
      ['CABO-DROP-2F', 'Cabo drop flat 2 fibras', 'Cabos', 'Furukawa', 'Drop 2F', 'quantidade', 'm', 'B1-03', 500, 0.62],
      ['CON-APC-CAMPO', 'Conector de campo SC/APC', 'Conectores', 'Genérico', 'Fast', 'quantidade', 'un', 'C1-03', 100, 3.1],
    ],
    instrucoes: [
      'Uma linha por produto. Obrigatórios: codigo, nome e categoria.',
      'Se o código já existir, o cadastro do produto é ATUALIZADO (o saldo não muda).',
      'Categoria que não existir é criada automaticamente.',
      'tipo_controle: "serializado" (nº de série/MAC) ou "quantidade" (material de consumo). Padrão: quantidade.',
      'unidade: un, m, cx, pct ou rolo. Serializados sempre usam "un".',
      'Valores podem usar vírgula decimal (ex.: 0,62).',
      'O saldo NÃO é importado aqui: use "Entrada por planilha" para lançar quantidades e números de série.',
    ],
  },
  entrada: {
    arquivo: 'modelo-entrada-compra.xlsx',
    colunas: ['codigo', 'quantidade', 'numero_serie', 'mac', 'custo_unitario'],
    exemplos: [
      ['CABO-DROP-1F', 1000, '', '', 0.45],
      ['CON-SC-APC', 200, '', '', ''],
      ['ONU-HW-EG8145', '', 'HWTC1A2B3C90', 'E0:24:7F:10:00:90', 189.9],
      ['ONU-HW-EG8145', '', 'HWTC1A2B3C91', 'E0247F100091', ''],
    ],
    instrucoes: [
      'Fornecedor e nota fiscal são escolhidos na tela, para a planilha inteira.',
      'Materiais (controle por quantidade): preencha codigo e quantidade. Linhas repetidas do mesmo código são somadas.',
      'Equipamentos serializados: UMA LINHA POR UNIDADE, com codigo, numero_serie e (opcional) mac.',
      'custo_unitario é opcional e atualiza o custo do produto.',
      'Tudo ou nada: se houver qualquer erro, nada é gravado. Use a prévia antes de confirmar.',
    ],
  },
};

async function gerarModelo(tipo) {
  const modelo = MODELOS[tipo];
  if (!modelo) throw new AppError('Modelo inválido. Use "produtos" ou "entrada".', 404);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Estoque Provedor';
  const aba = workbook.addWorksheet('Dados');
  aba.addRow(modelo.colunas);
  modelo.exemplos.forEach((e) => aba.addRow(e));
  aba.getRow(1).font = { bold: true };
  aba.views = [{ state: 'frozen', ySplit: 1 }];
  aba.columns.forEach((col, i) => {
    col.width = Math.max(14, modelo.colunas[i].length + 4, ...modelo.exemplos.map((e) => String(e[i] ?? '').length + 2));
  });

  const instrucoes = workbook.addWorksheet('Instruções');
  instrucoes.getColumn(1).width = 110;
  instrucoes.addRow(['Como preencher (apague as linhas de exemplo da aba "Dados" antes de importar)']).font = { bold: true };
  modelo.instrucoes.forEach((t) => instrucoes.addRow([`• ${t}`]));

  if (tipo === 'produtos') {
    const categorias = await Categoria.findAll({ order: [['nome', 'ASC']] });
    instrucoes.addRow([]);
    instrucoes.addRow(['Categorias já cadastradas:']).font = { bold: true };
    categorias.forEach((c) => instrucoes.addRow([c.nome]));
  }

  return { arquivo: modelo.arquivo, buffer: await workbook.xlsx.writeBuffer() };
}

module.exports = {
  lerPlanilha,
  importarProdutos,
  importarEntrada,
  gerarModelo,
  normalizarCabecalho,
  numeroPlanilha,
  tipoControlePlanilha,
};

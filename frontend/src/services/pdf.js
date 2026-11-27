import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatarDataHora, formatarMoeda, formatarQtd, STATUS } from './formatos.js';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const MARGEM = 14;
const PRETO = [17, 17, 17];
const CINZA = [110, 110, 110];
const VERMELHO = [200, 16, 46];

function dataExtenso(data = new Date()) {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

function nomeArquivo(base) {
  const hoje = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${base}-${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}.pdf`;
}

const slug = (texto) =>
  String(texto).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Cabeçalho padrão de todos os relatórios: organização, título, data de emissão, quem emitiu e filtros.
 * meta = { organizacao, organizacaoCnpj, titulo, emitidoEm, emitidoPor, filtros }
 */
function novoDocumento(meta, { paisagem = false } = {}) {
  const doc = new jsPDF({ orientation: paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  let y = 15;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  const org = meta.organizacaoCnpj ? `${meta.organizacao} · CNPJ ${meta.organizacaoCnpj}` : meta.organizacao;
  doc.text(String(org || '').toUpperCase(), MARGEM, y);
  doc.text('CONTROLE DE ESTOQUE', largura - MARGEM, y, { align: 'right' });
  y += 8;

  doc.setTextColor(...PRETO);
  doc.setFontSize(15);
  doc.text(meta.titulo, MARGEM, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...CINZA);
  const linhas = [
    `Emitido em ${meta.emitidoEm || formatarDataHora(new Date())}${meta.emitidoPor ? ` por ${meta.emitidoPor}` : ''}`,
    `Filtros aplicados: ${meta.filtros || 'nenhum'}`,
  ];
  linhas.forEach((l) => {
    const quebrado = doc.splitTextToSize(l, largura - MARGEM * 2);
    doc.text(quebrado, MARGEM, y);
    y += quebrado.length * 4;
  });
  y += 1;
  doc.setDrawColor(200);
  doc.line(MARGEM, y, largura - MARGEM, y);
  return { doc, y: y + 5, largura };
}

/** Rodapé com organização e "Página X de Y". */
function numerarPaginas(doc, organizacao) {
  const total = doc.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(organizacao || '', MARGEM, altura - 8);
    doc.text(`Página ${i} de ${total}`, largura - MARGEM, altura - 8, { align: 'right' });
  }
}

const ESTILO_TABELA = {
  theme: 'plain',
  margin: { left: MARGEM, right: MARGEM, bottom: 16 },
  styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: PRETO, lineColor: [225, 225, 225], lineWidth: { bottom: 0.2 } },
  headStyles: { fontStyle: 'bold', fillColor: [242, 242, 242], textColor: [70, 70, 70], fontSize: 7.5 },
  footStyles: { fontStyle: 'bold', fillColor: [242, 242, 242] },
};

/** Bloco de totais em linha, abaixo do cabeçalho. */
function resumo(doc, y, itens) {
  if (!itens?.length) return y;
  const largura = doc.internal.pageSize.getWidth();
  doc.setFontSize(9);
  let x = MARGEM;
  itens.forEach(([rotulo, valor]) => {
    const passo = Math.max(36, doc.getTextWidth(String(valor)) + 12, doc.getTextWidth(rotulo) + 10);
    if (x + passo > largura - MARGEM) {
      x = MARGEM;
      y += 11;
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CINZA);
    doc.text(rotulo, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRETO);
    doc.text(String(valor), x, y + 5);
    x += passo;
  });
  return y + 11;
}

/**
 * Relatório tabular genérico.
 * colunas: [{ titulo, valor: (linha) => texto, direita?, mono?, largura? }]
 * destacar: (linha, indiceColuna) => true para pintar a célula de vermelho (alertas)
 */
function relatorioTabela({ meta, linhas, colunas, resumoItens, rodapeTotal, nota, paisagem = true, destacar, arquivo }) {
  const { doc, y } = novoDocumento(meta, { paisagem });
  const inicio = resumo(doc, y, resumoItens);
  const estilosColunas = {};
  colunas.forEach((c, i) => {
    estilosColunas[i] = {
      ...(c.direita ? { halign: 'right' } : {}),
      ...(c.mono ? { font: 'courier' } : {}),
      ...(c.largura ? { cellWidth: c.largura } : {}),
    };
  });

  autoTable(doc, {
    ...ESTILO_TABELA,
    startY: inicio,
    head: [colunas.map((c) => c.titulo)],
    body: linhas.length ? linhas.map((l) => colunas.map((c) => c.valor(l) ?? '')) : [[{ content: 'Nenhum registro encontrado.', colSpan: colunas.length }]],
    foot: rodapeTotal ? [rodapeTotal] : undefined,
    columnStyles: estilosColunas,
    didParseCell: (d) => {
      if (d.section === 'head' && colunas[d.column.index]?.direita) d.cell.styles.halign = 'right';
      if (d.section === 'body' && destacar && linhas[d.row.index] && destacar(linhas[d.row.index], d.column.index)) {
        d.cell.styles.textColor = VERMELHO;
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });

  if (nota) {
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(nota, MARGEM, doc.lastAutoTable.finalY + 6);
  }
  numerarPaginas(doc, meta.organizacao);
  doc.save(nomeArquivo(arquivo));
}

// ---------------------------------------------------------------------------
// Relatórios (dados vindos de GET /relatorios/dados)
// ---------------------------------------------------------------------------

export function pdfEstoque(dados) {
  const { linhas } = dados;
  const valorTotal = linhas.reduce((s, l) => s + l.valorTotal, 0);
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'estoque-atual',
    resumoItens: [['Valor total do estoque', formatarMoeda(valorTotal)], ['Produtos', linhas.length], ['Abaixo do mínimo', linhas.filter((l) => l.abaixoMinimo).length]],
    colunas: [
      { titulo: 'Código', valor: (l) => l.codigo },
      { titulo: 'Produto', valor: (l) => l.nome },
      { titulo: 'Categoria', valor: (l) => l.categoria },
      { titulo: 'Local', valor: (l) => l.local || '-' },
      { titulo: 'Quantidade', valor: (l) => formatarQtd(l.quantidade, l.unidade), direita: true },
      { titulo: 'Mínimo', valor: (l) => formatarQtd(l.estoqueMinimo), direita: true },
      { titulo: 'Custo unit.', valor: (l) => formatarMoeda(l.custoUnitario), direita: true },
      { titulo: 'Valor total', valor: (l) => formatarMoeda(l.valorTotal), direita: true },
    ],
    rodapeTotal: ['', '', '', '', '', '', 'Total', formatarMoeda(valorTotal)],
    destacar: (l, col) => l.abaixoMinimo && [1, 4].includes(col),
    nota: 'Em vermelho: abaixo do estoque mínimo.',
  });
}

export function pdfAbaixoMinimo(dados) {
  const { linhas } = dados;
  const custo = linhas.reduce((s, l) => s + Math.max(0, l.custoReposicao), 0);
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'abaixo-do-minimo',
    resumoItens: [['Produtos abaixo do mínimo', linhas.length], ['Sem estoque', linhas.filter((l) => l.semEstoque).length], ['Custo estimado para repor', formatarMoeda(custo)]],
    colunas: [
      { titulo: 'Código', valor: (l) => l.codigo },
      { titulo: 'Produto', valor: (l) => l.nome },
      { titulo: 'Categoria', valor: (l) => l.categoria },
      { titulo: 'Saldo', valor: (l) => formatarQtd(l.quantidade, l.unidade), direita: true },
      { titulo: 'Mínimo', valor: (l) => formatarQtd(l.estoqueMinimo, l.unidade), direita: true },
      { titulo: 'Falta', valor: (l) => formatarQtd(l.falta, l.unidade), direita: true },
      { titulo: 'Situação', valor: (l) => (l.semEstoque ? 'Sem estoque' : 'Abaixo do mínimo') },
      { titulo: 'Custo para repor', valor: (l) => formatarMoeda(l.custoReposicao), direita: true },
    ],
    destacar: (l, col) => l.semEstoque && [1, 6].includes(col),
    nota: 'Custo para repor = (mínimo − saldo) × custo unitário. Em vermelho: sem estoque.',
  });
}

export function pdfEquipamentos(dados) {
  const { linhas } = dados;
  const contagem = {};
  linhas.forEach((l) => { contagem[l.status] = (contagem[l.status] || 0) + 1; });
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'equipamentos-por-status',
    resumoItens: [['Total de unidades', linhas.length], ...Object.entries(contagem).map(([s, n]) => [STATUS[s], n])],
    colunas: [
      { titulo: 'Status', valor: (l) => l.statusRotulo },
      { titulo: 'Produto', valor: (l) => l.produto },
      { titulo: 'Nº de série', valor: (l) => l.numeroSerie, mono: true },
      { titulo: 'MAC', valor: (l) => l.mac || '-', mono: true },
      { titulo: 'Técnico', valor: (l) => l.tecnico || '-' },
      { titulo: 'Cliente', valor: (l) => [l.clienteCodigo, l.clienteNome].filter(Boolean).join(' - ') || '-' },
      { titulo: 'Custo', valor: (l) => formatarMoeda(l.custo), direita: true },
    ],
    destacar: (l, col) => l.status === 'defeito' && col === 0,
  });
}

export function pdfComTecnicos(dados) {
  const { linhas } = dados;
  const tecnicos = new Set(linhas.map((l) => l.tecnico)).size;
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'em-posse-dos-tecnicos',
    resumoItens: [
      ['Técnicos', tecnicos],
      ['Equipamentos', linhas.filter((l) => l.item === 'Equipamento').length],
      ['Itens de material', linhas.filter((l) => l.item === 'Material').length],
      ['Valor total', formatarMoeda(linhas.reduce((s, l) => s + l.valor, 0))],
    ],
    colunas: [
      { titulo: 'Técnico', valor: (l) => l.tecnico },
      { titulo: 'Tipo', valor: (l) => l.item },
      { titulo: 'Produto', valor: (l) => l.produto },
      { titulo: 'Nº de série', valor: (l) => l.numeroSerie || '-', mono: true },
      { titulo: 'Quantidade', valor: (l) => formatarQtd(l.quantidade, l.unidade), direita: true },
      { titulo: 'Valor', valor: (l) => formatarMoeda(l.valor), direita: true },
      { titulo: 'Desde', valor: (l) => (l.desde ? formatarDataHora(l.desde) : '-') },
      { titulo: 'Dias', valor: (l) => (l.dias === null ? '-' : String(l.dias)), direita: true },
    ],
    destacar: (l, col) => l.dias !== null && l.dias >= 7 && col === 7,
    nota: 'Em vermelho: equipamento com o técnico há 7 dias ou mais (pendente de instalação ou devolução).',
  });
}

export function pdfComodato(dados) {
  const { linhas } = dados;
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'equipamentos-em-comodato',
    resumoItens: [
      ['Equipamentos em comodato', linhas.length],
      ['Clientes', new Set(linhas.map((l) => l.clienteCodigo)).size],
      ['Valor em comodato', formatarMoeda(linhas.reduce((s, l) => s + l.valor, 0))],
    ],
    colunas: [
      { titulo: 'Cliente', valor: (l) => [l.clienteCodigo, l.clienteNome].filter(Boolean).join(' - ') },
      { titulo: 'Produto', valor: (l) => l.produto },
      { titulo: 'Nº de série', valor: (l) => l.numeroSerie, mono: true },
      { titulo: 'MAC', valor: (l) => l.mac || '-', mono: true },
      { titulo: 'Instalado em', valor: (l) => formatarDataHora(l.instaladoEm) },
      { titulo: 'OS', valor: (l) => l.numeroOS || '-' },
      { titulo: 'Técnico', valor: (l) => l.tecnico || '-' },
      { titulo: 'Valor', valor: (l) => formatarMoeda(l.valor), direita: true },
    ],
  });
}

export function pdfManutencao(dados) {
  const { linhas } = dados;
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'equipamentos-em-manutencao',
    resumoItens: [
      ['Em manutenção', linhas.filter((l) => l.status === 'em_manutencao').length],
      ['Com defeito', linhas.filter((l) => l.status === 'defeito').length],
      ['Valor parado', formatarMoeda(linhas.reduce((s, l) => s + l.valor, 0))],
    ],
    colunas: [
      { titulo: 'Situação', valor: (l) => l.statusRotulo },
      { titulo: 'Produto', valor: (l) => l.produto },
      { titulo: 'Nº de série', valor: (l) => l.numeroSerie, mono: true },
      { titulo: 'Problema / observação', valor: (l) => l.problema || '-', largura: 70 },
      { titulo: 'Desde', valor: (l) => formatarDataHora(l.desde) },
      { titulo: 'Dias', valor: (l) => String(l.dias), direita: true },
      { titulo: 'Valor', valor: (l) => formatarMoeda(l.valor), direita: true },
    ],
    destacar: (l, col) => l.status === 'defeito' && col === 0,
  });
}

export function pdfMovimentacoes(dados) {
  const { linhas } = dados;
  const porTipo = {};
  linhas.forEach((l) => { porTipo[l.tipoRotulo] = (porTipo[l.tipoRotulo] || 0) + 1; });
  relatorioTabela({
    meta: dados,
    linhas,
    arquivo: 'movimentacoes',
    resumoItens: [['Registros', linhas.length], ...Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 5)],
    colunas: [
      { titulo: 'Data/hora', valor: (l) => formatarDataHora(l.data) },
      { titulo: 'Tipo', valor: (l) => l.tipoRotulo },
      { titulo: 'Produto', valor: (l) => l.produto },
      { titulo: 'Nº de série', valor: (l) => l.numeroSerie || '-', mono: true },
      { titulo: 'Qtd.', valor: (l) => formatarQtd(l.quantidade, l.unidade), direita: true },
      { titulo: 'Técnico', valor: (l) => l.tecnico || '-' },
      { titulo: 'Cliente / OS', valor: (l) => [l.clienteCodigo, l.numeroOS].filter(Boolean).join(' / ') || '-' },
      { titulo: 'NF', valor: (l) => l.notaFiscal || '-' },
      { titulo: 'Usuário', valor: (l) => l.usuario },
      { titulo: 'Observação', valor: (l) => l.observacao || '', largura: 45 },
    ],
    destacar: (l, col) => l.tipo === 'baixa' && col === 1,
  });
}

/** Mapa relatório → gerador (usado pela tela Relatórios). */
export const GERADORES = {
  estoque: pdfEstoque,
  abaixo_minimo: pdfAbaixoMinimo,
  equipamentos: pdfEquipamentos,
  com_tecnicos: pdfComTecnicos,
  comodato: pdfComodato,
  manutencao: pdfManutencao,
  movimentacoes: pdfMovimentacoes,
};

/**
 * Termo de responsabilidade: o que está em posse do técnico, com linhas para assinatura.
 * organizacao = { nome, cnpj } (configurações públicas do sistema).
 */
export function pdfTermoTecnico({ dados, usuario, organizacao }) {
  const { tecnico, equipamentos, materiais, totais } = dados;
  const nomeOrg = organizacao?.nome || 'a empresa';
  const { doc, y: inicio, largura } = novoDocumento(
    {
      organizacao: organizacao?.nome,
      organizacaoCnpj: organizacao?.cnpj,
      titulo: 'Termo de responsabilidade de material',
      emitidoEm: formatarDataHora(new Date()),
      emitidoPor: usuario,
      filtros: `Técnico: ${tecnico.nome}${tecnico.equipe ? ` (${tecnico.equipe})` : ''}`,
    },
    {}
  );
  let y = inicio;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PRETO);
  const texto =
    `Eu, ${tecnico.nome}, declaro estar em posse dos equipamentos e materiais listados abaixo, ` +
    `pertencentes a ${nomeOrg}, e me comprometo a utilizá-los exclusivamente nos serviços da empresa, ` +
    'devolvendo ao almoxarifado o que não for utilizado e informando perdas ou defeitos.';
  const linhasTexto = doc.splitTextToSize(texto, largura - MARGEM * 2);
  doc.text(linhasTexto, MARGEM, y);
  y += linhasTexto.length * 5 + 4;

  y = resumo(doc, y, [['Equipamentos', totais.equipamentos], ['Itens de material', totais.materiais], ['Valor total', formatarMoeda(totais.valor)]]);

  autoTable(doc, {
    ...ESTILO_TABELA,
    startY: y,
    head: [['Equipamento', 'Nº de série', 'MAC', 'Valor']],
    body: equipamentos.length
      ? equipamentos.map((e) => [e.produto?.nome, e.numeroSerie, e.mac || '-', formatarMoeda(e.produto?.custoUnitario)])
      : [['Nenhum equipamento em posse do técnico.', '', '', '']],
    columnStyles: { 1: { font: 'courier' }, 2: { font: 'courier' }, 3: { halign: 'right' } },
  });

  autoTable(doc, {
    ...ESTILO_TABELA,
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Código', 'Material', 'Quantidade', 'Valor']],
    body: materiais.length
      ? materiais.map((m) => [m.codigo, m.nome, formatarQtd(m.quantidade, m.unidade), formatarMoeda(m.valor)])
      : [['', 'Nenhum material em posse do técnico.', '', '']],
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' } },
  });

  // Assinaturas (nova página se não couber)
  const altura = doc.internal.pageSize.getHeight();
  y = doc.lastAutoTable.finalY + 16;
  if (y > altura - 60) {
    doc.addPage();
    y = 30;
  }
  doc.setFontSize(10);
  doc.setTextColor(...PRETO);
  doc.text(`${dataExtenso()}.`, MARGEM, y);
  y += 28;

  const meio = largura / 2;
  doc.setDrawColor(...PRETO);
  doc.line(MARGEM, y, meio - 8, y);
  doc.line(meio + 8, y, largura - MARGEM, y);
  doc.setFontSize(9);
  doc.text(tecnico.nome, MARGEM, y + 5);
  doc.text('Técnico responsável', MARGEM, y + 10);
  doc.text(usuario || 'Almoxarifado', meio + 8, y + 5);
  doc.text('Almoxarifado', meio + 8, y + 10);

  numerarPaginas(doc, organizacao?.nome);
  doc.save(nomeArquivo(`termo-${slug(tecnico.nome)}`));
}

export { relatorioTabela };

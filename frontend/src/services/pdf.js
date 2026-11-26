import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { formatarDataHora, formatarMoeda, formatarQtd, STATUS } from './formatos.js';

/** Nome que aparece no cabeçalho dos PDFs (configure em VITE_EMPRESA_NOME). */
export const NOME_EMPRESA = import.meta.env.VITE_EMPRESA_NOME || 'Provedor de Internet';

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const MARGEM = 14;
const PRETO = [17, 17, 17];
const CINZA = [110, 110, 110];
const VERMELHO = [200, 16, 46];

function dataExtenso(data = new Date()) {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

/** Converte AAAA-MM-DD em DD/MM/AAAA. */
export function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function nomeArquivo(base) {
  const hoje = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${base}-${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}.pdf`;
}

/** Cria o documento com cabeçalho padrão e devolve a posição Y onde o conteúdo começa. */
function novoDocumento({ titulo, subtitulo, usuario, paisagem = false }) {
  const doc = new jsPDF({ orientation: paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const largura = doc.internal.pageSize.getWidth();
  let y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  doc.text(NOME_EMPRESA.toUpperCase(), MARGEM, y);
  doc.text('CONTROLE DE ESTOQUE', largura - MARGEM, y, { align: 'right' });
  y += 8;

  doc.setTextColor(...PRETO);
  doc.setFontSize(15);
  doc.text(titulo, MARGEM, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...CINZA);
  const linhaInfo = [subtitulo, `Gerado em ${formatarDataHora(new Date())}${usuario ? ` por ${usuario}` : ''}`].filter(Boolean).join('  ·  ');
  doc.text(doc.splitTextToSize(linhaInfo, largura - MARGEM * 2), MARGEM, y);
  y += 4;

  doc.setDrawColor(200);
  doc.line(MARGEM, y, largura - MARGEM, y);
  return { doc, y: y + 5, largura };
}

/** Rodapé com numeração "Página X de Y" em todas as páginas. */
function numerarPaginas(doc) {
  const total = doc.getNumberOfPages();
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= total; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...CINZA);
    doc.text(NOME_EMPRESA, MARGEM, altura - 8);
    doc.text(`Página ${i} de ${total}`, largura - MARGEM, altura - 8, { align: 'right' });
  }
}

const ESTILO_TABELA = {
  theme: 'plain',
  margin: { left: MARGEM, right: MARGEM, bottom: 16 },
  styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: PRETO, lineColor: [225, 225, 225], lineWidth: { bottom: 0.2 } },
  headStyles: { fontStyle: 'bold', fillColor: [242, 242, 242], textColor: [70, 70, 70], fontSize: 7.5 },
};

/** Bloco de totais em linha, logo abaixo do título. */
function resumo(doc, y, itens) {
  doc.setFontSize(9);
  let x = MARGEM;
  itens.forEach(([rotulo, valor]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CINZA);
    doc.text(rotulo, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRETO);
    doc.text(String(valor), x, y + 5);
    x += Math.max(36, doc.getTextWidth(String(valor)) + 12, doc.getTextWidth(rotulo) + 10);
  });
  return y + 11;
}

// ---------------------------------------------------------------------------
// Relatórios
// ---------------------------------------------------------------------------

export function pdfEstoque({ linhas, usuario }) {
  const { doc, y } = novoDocumento({ titulo: 'Relatório de estoque atual', subtitulo: `${linhas.length} produtos ativos`, usuario, paisagem: true });
  const valorTotal = linhas.reduce((s, l) => s + l.valorTotal, 0);
  const abaixo = linhas.filter((l) => l.abaixoMinimo).length;
  const inicio = resumo(doc, y, [['Valor total do estoque', formatarMoeda(valorTotal)], ['Produtos', linhas.length], ['Abaixo do mínimo', abaixo]]);

  autoTable(doc, {
    ...ESTILO_TABELA,
    startY: inicio,
    head: [['Código', 'Produto', 'Categoria', 'Local', 'Quantidade', 'Mínimo', 'Custo unit.', 'Valor total']],
    body: linhas.map((l) => [
      l.codigo, l.nome, l.categoria, l.local || '-',
      formatarQtd(l.quantidade, l.unidade), formatarQtd(l.estoqueMinimo),
      formatarMoeda(l.custoUnitario), formatarMoeda(l.valorTotal),
    ]),
    foot: [['', '', '', '', '', '', 'Total', formatarMoeda(valorTotal)]],
    footStyles: { fontStyle: 'bold', fillColor: [242, 242, 242] },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
    didParseCell: (d) => {
      if (d.section === 'body' && linhas[d.row.index]?.abaixoMinimo && [1, 4].includes(d.column.index)) {
        d.cell.styles.textColor = VERMELHO;
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });
  doc.setFontSize(8);
  doc.setTextColor(...CINZA);
  doc.text('Em vermelho: abaixo do estoque mínimo.', MARGEM, doc.lastAutoTable.finalY + 6);

  numerarPaginas(doc);
  doc.save(nomeArquivo('estoque-atual'));
}

export function pdfEquipamentos({ linhas, usuario, filtroStatus }) {
  const subtitulo = filtroStatus ? `Status: ${STATUS[filtroStatus]}` : 'Todos os status';
  const { doc, y } = novoDocumento({ titulo: 'Equipamentos por status', subtitulo, usuario, paisagem: true });

  const contagem = {};
  linhas.forEach((l) => { contagem[l.status] = (contagem[l.status] || 0) + 1; });
  const inicio = resumo(doc, y, [['Total de unidades', linhas.length], ...Object.entries(contagem).map(([s, n]) => [STATUS[s], n])]);

  autoTable(doc, {
    ...ESTILO_TABELA,
    startY: inicio,
    head: [['Status', 'Produto', 'Nº de série', 'MAC', 'Técnico', 'Cliente', 'Custo']],
    body: linhas.map((l) => [
      l.statusRotulo, l.produto, l.numeroSerie, l.mac || '-', l.tecnico || '-',
      [l.clienteCodigo, l.clienteNome].filter(Boolean).join(' - ') || '-', formatarMoeda(l.custo),
    ]),
    columnStyles: { 2: { font: 'courier' }, 3: { font: 'courier' }, 6: { halign: 'right' } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 0 && linhas[d.row.index]?.status === 'defeito') {
        d.cell.styles.textColor = VERMELHO;
        d.cell.styles.fontStyle = 'bold';
      }
    },
  });

  numerarPaginas(doc);
  doc.save(nomeArquivo('equipamentos-por-status'));
}

export function pdfMovimentacoes({ linhas, usuario, inicio, fim }) {
  const periodo = inicio || fim ? `Período: ${inicio ? dataBR(inicio) : 'início'} a ${fim ? dataBR(fim) : 'hoje'}` : 'Todo o período';
  const { doc, y } = novoDocumento({ titulo: 'Movimentações do período', subtitulo: periodo, usuario, paisagem: true });

  const porTipo = {};
  linhas.forEach((l) => { porTipo[l.tipoRotulo] = (porTipo[l.tipoRotulo] || 0) + 1; });
  const destaques = Object.entries(porTipo).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const comeco = resumo(doc, y, [['Registros', linhas.length], ...destaques]);

  autoTable(doc, {
    ...ESTILO_TABELA,
    startY: comeco,
    head: [['Data/hora', 'Tipo', 'Produto', 'Nº de série', 'Qtd.', 'Técnico', 'Cliente / OS', 'NF', 'Usuário', 'Observação']],
    body: linhas.map((l) => [
      formatarDataHora(l.data), l.tipoRotulo, l.produto, l.numeroSerie || '-',
      formatarQtd(l.quantidade, l.unidade), l.tecnico || '-',
      [l.clienteCodigo, l.numeroOS].filter(Boolean).join(' / ') || '-', l.notaFiscal || '-', l.usuario, l.observacao || '',
    ]),
    columnStyles: { 3: { font: 'courier' }, 4: { halign: 'right' }, 9: { cellWidth: 45 } },
    didParseCell: (d) => {
      if (d.section === 'body' && d.column.index === 1 && linhas[d.row.index]?.tipo === 'baixa') {
        d.cell.styles.textColor = VERMELHO;
      }
    },
  });

  numerarPaginas(doc);
  doc.save(nomeArquivo('movimentacoes'));
}

/**
 * Termo de responsabilidade: lista o que está em posse do técnico, com espaço para assinaturas.
 * Útil para conferência mensal ou desligamento do técnico.
 */
export function pdfTermoTecnico({ dados, usuario }) {
  const { tecnico, equipamentos, materiais, totais } = dados;
  const { doc, y: inicio, largura } = novoDocumento({
    titulo: 'Termo de responsabilidade de material',
    subtitulo: `Técnico: ${tecnico.nome}${tecnico.equipe ? ` (${tecnico.equipe})` : ''}`,
    usuario,
  });
  let y = inicio;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...PRETO);
  const texto =
    `Eu, ${tecnico.nome}, declaro estar em posse dos equipamentos e materiais listados abaixo, ` +
    `pertencentes a ${NOME_EMPRESA}, e me comprometo a utilizá-los exclusivamente nos serviços da empresa, ` +
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

  numerarPaginas(doc);
  doc.save(nomeArquivo(`termo-${tecnico.nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}`));
}

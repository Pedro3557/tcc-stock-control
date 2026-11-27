import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { obterOrganizacao } from './organizacao.js';

/**
 * Conteúdo do QR Code: só o endereço de consulta com o código permanente da etiqueta.
 * Nenhum dado do equipamento vai na etiqueta; abrir o endereço exige login no sistema.
 */
export function conteudoQR(codigo, urlPublica) {
  const base = (urlPublica || window.location.origin).replace(/\/+$/, '');
  return `${base}/e/${codigo}`;
}

export function qrDataURL(texto, tamanho = 256) {
  return QRCode.toDataURL(texto, { errorCorrectionLevel: 'M', margin: 1, width: tamanho, color: { dark: '#000000', light: '#ffffff' } });
}

/** Formatos de etiqueta disponíveis (medidas em mm). */
export const FORMATOS = {
  'a4-3x7': {
    rotulo: 'Folha A4 — 21 etiquetas (3 × 7, 63,5 × 38,1 mm)',
    pagina: [210, 297],
    colunas: 3,
    linhas: 7,
    largura: 63.5,
    altura: 38.1,
    margemEsq: 7.2,
    margemTopo: 15.1,
    espacoH: 2.5,
    espacoV: 0,
  },
  'a4-2x5': {
    rotulo: 'Folha A4 — 10 etiquetas grandes (2 × 5, 99 × 57 mm)',
    pagina: [210, 297],
    colunas: 2,
    linhas: 5,
    largura: 99,
    altura: 57,
    margemEsq: 4.7,
    margemTopo: 6,
    espacoH: 2.6,
    espacoV: 0,
  },
  'termica-50x30': {
    rotulo: 'Impressora térmica — etiqueta avulsa 50 × 30 mm',
    pagina: [50, 30],
    colunas: 1,
    linhas: 1,
    largura: 50,
    altura: 30,
    margemEsq: 0,
    margemTopo: 0,
    espacoH: 0,
    espacoV: 0,
  },
};

function desenharEtiqueta(doc, x, y, f, e, qr, organizacao) {
  const pad = Math.min(2.5, f.altura * 0.07);
  const ladoQR = Math.min(f.altura - pad * 2, f.largura * 0.45);
  doc.addImage(qr, 'PNG', x + pad, y + (f.altura - ladoQR) / 2, ladoQR, ladoQR);

  const tx = x + pad * 2 + ladoQR;
  const larguraTexto = f.largura - (tx - x) - pad;
  const escala = f.altura / 38;
  let ty = y + pad + 3.2 * escala;

  if (organizacao) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5 * escala);
    doc.setTextColor(110);
    doc.text(doc.splitTextToSize(organizacao.toUpperCase(), larguraTexto)[0], tx, ty);
    ty += 3.4 * escala;
  }

  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5 * escala);
  const nome = doc.splitTextToSize(e.produto?.nome || '', larguraTexto).slice(0, 2);
  doc.text(nome, tx, ty);
  ty += nome.length * 3.2 * escala + 1.2 * escala;

  doc.setFont('courier', 'bold');
  doc.setFontSize(7 * escala);
  doc.text(doc.splitTextToSize(`S/N ${e.numeroSerie}`, larguraTexto).slice(0, 2), tx, ty);
  ty += (e.numeroSerie.length > 14 ? 6.2 : 3.4) * escala;
  if (e.mac) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(6 * escala);
    doc.text(e.mac, tx, ty);
    ty += 3.2 * escala;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6 * escala);
  doc.setTextColor(80);
  doc.text(`Cód. ${e.codigoEtiqueta}`, tx, Math.min(ty + 0.6 * escala, y + f.altura - pad));
}

/**
 * Gera o PDF de etiquetas (uma por equipamento).
 * equipamentos: [{ codigoEtiqueta, numeroSerie, mac, produto: { nome } }]
 * inicio: posição da primeira etiqueta na folha (para aproveitar folhas já usadas), começando em 1
 */
export async function gerarPDFEtiquetas(equipamentos, { formato = 'a4-3x7', inicio = 1, mostrarOrganizacao = true } = {}) {
  const f = FORMATOS[formato];
  const org = await obterOrganizacao().catch(() => null);
  const doc = new jsPDF({ unit: 'mm', format: f.pagina, orientation: f.pagina[0] > f.pagina[1] ? 'landscape' : 'portrait' });
  const porPagina = f.colunas * f.linhas;
  let posicao = Math.max(0, Math.min(porPagina - 1, inicio - 1));

  for (let i = 0; i < equipamentos.length; i += 1) {
    if (i > 0 && posicao === 0) doc.addPage(f.pagina, f.pagina[0] > f.pagina[1] ? 'landscape' : 'portrait');
    const coluna = posicao % f.colunas;
    const linha = Math.floor(posicao / f.colunas);
    const x = f.margemEsq + coluna * (f.largura + f.espacoH);
    const y = f.margemTopo + linha * (f.altura + f.espacoV);
    const e = equipamentos[i];
     
    const qr = await qrDataURL(conteudoQR(e.codigoEtiqueta, org?.urlPublica), 300);
    desenharEtiqueta(doc, x, y, f, e, qr, mostrarOrganizacao ? org?.nome : null);
    posicao = (posicao + 1) % porPagina;
  }

  const nome = equipamentos.length === 1 ? `etiqueta-${equipamentos[0].numeroSerie}` : `etiquetas-${equipamentos.length}`;
  doc.save(`${nome.replace(/[^\w-]+/g, '_')}.pdf`);
}

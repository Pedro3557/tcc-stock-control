/** Gera CSV separado por ponto e vírgula, com BOM para abrir corretamente no Excel. */
function escapar(valor) {
  if (valor === null || valor === undefined) return '';
  const texto = String(valor);
  if (/[;"\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function gerarCSV(colunas, linhas) {
  const cabecalho = colunas.map((c) => escapar(c.titulo)).join(';');
  const corpo = linhas.map((linha) => colunas.map((c) => escapar(c.valor(linha))).join(';'));
  return `﻿${[cabecalho, ...corpo].join('\r\n')}\r\n`;
}

/** Número no padrão brasileiro (vírgula decimal, sem separador de milhar para facilitar planilhas). */
function numeroBR(valor, casas = 2) {
  if (valor === null || valor === undefined || valor === '') return '';
  return Number(valor).toFixed(casas).replace('.', ',');
}

function quantidadeBR(valor) {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = Number(valor);
  return Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/0+$/, '').replace('.', ',');
}

module.exports = { gerarCSV, numeroBR, quantidadeBR };

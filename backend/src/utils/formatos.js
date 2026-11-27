const AppError = require('./AppError');

/** Normaliza um MAC para o formato AA:BB:CC:DD:EE:FF. Retorna null se vazio. */
function normalizarMac(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const hex = texto.replace(/[\s:.-]/g, '').toUpperCase();
  if (!/^[0-9A-F]{12}$/.test(hex)) {
    throw new AppError(`MAC inválido: "${texto}". Use 12 dígitos hexadecimais (ex.: AA:BB:CC:DD:EE:FF).`);
  }
  return hex.match(/.{2}/g).join(':');
}

/** Verifica se um texto parece um MAC (12 dígitos hexadecimais com ou sem separadores). */
function pareceMac(valor) {
  const texto = String(valor || '').trim();
  return /^([0-9a-fA-F]{2}[:\-.]?){5}[0-9a-fA-F]{2}$/.test(texto) || /^[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}$/.test(texto);
}

function textoOuNull(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

function formatarNumeroBR(valor, casas = 2) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas,
  });
}

function formatarDataHoraBR(data) {
  if (!data) return '';
  return new Date(data).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }).replace(', ', ' ');
}

module.exports = {
  normalizarMac,
  pareceMac,
  textoOuNull,
  formatarNumeroBR,
  formatarDataHoraBR,
};

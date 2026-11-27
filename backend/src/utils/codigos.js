const crypto = require('crypto');

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L): o código pode ser digitado a partir da etiqueta
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Código aleatório de 10 caracteres (~49 bits): identificador permanente da etiqueta do equipamento. */
function gerarCodigoEtiqueta() {
  return Array.from(crypto.randomBytes(10), (b) => ALFABETO[b % ALFABETO.length]).join('');
}

const PADRAO_CODIGO = /^[2-9A-HJKMNP-Z]{10}$/;

/**
 * Extrai o código da etiqueta de um texto lido (QR Code com endereço ".../e/CODIGO" ou o código puro).
 * Retorna null se o texto não for um código de etiqueta.
 */
function extrairCodigoEtiqueta(texto) {
  const valor = String(texto || '').trim();
  const daUrl = /\/e\/([A-Za-z0-9]{10})(?:[/?#]|$)/.exec(valor);
  const candidato = (daUrl ? daUrl[1] : valor).toUpperCase();
  return PADRAO_CODIGO.test(candidato) ? candidato : null;
}

module.exports = { gerarCodigoEtiqueta, extrairCodigoEtiqueta };

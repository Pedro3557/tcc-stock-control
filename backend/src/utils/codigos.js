const crypto = require('crypto');

// Alfabeto sem caracteres ambíguos (0/O, 1/I/L): o código pode ser digitado a partir da etiqueta
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Código aleatório de 10 caracteres (~49 bits): identificador permanente da etiqueta do equipamento. */
function gerarCodigoEtiqueta() {
  return Array.from(crypto.randomBytes(10), (b) => ALFABETO[b % ALFABETO.length]).join('');
}

const PADRAO_CODIGO = /^[2-9A-HJKMNP-Z]{10}$/;

module.exports = { gerarCodigoEtiqueta, PADRAO_CODIGO };

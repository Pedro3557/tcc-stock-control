const { Auditoria } = require('../models');

// Nunca registrar segredos: qualquer campo com estes nomes é removido antes de gravar
const CAMPO_SENSIVEL = /(senha|password|token|secret|segredo|hash|authorization|cookie|smtp_?pass)/i;
const LIMITE_TEXTO = 2000;

/** Copia "limpa" do objeto (sem segredos, datas em ISO, textos longos cortados). */
function limpar(valor, profundidade = 0) {
  if (valor === null || valor === undefined) return null;
  if (profundidade > 5) return '[…]';
  if (typeof valor.toJSON === 'function' && !(valor instanceof Date)) return limpar(valor.toJSON(), profundidade);
  if (valor instanceof Date) return valor.toISOString();
  if (Buffer.isBuffer(valor)) return `[arquivo de ${valor.length} bytes]`;
  if (Array.isArray(valor)) {
    const lista = valor.slice(0, 200).map((v) => limpar(v, profundidade + 1));
    if (valor.length > 200) lista.push(`[… mais ${valor.length - 200} itens]`);
    return lista;
  }
  if (typeof valor === 'object') {
    const saida = {};
    Object.entries(valor).forEach(([chave, v]) => {
      if (CAMPO_SENSIVEL.test(chave)) return;
      if (typeof v === 'function') return;
      saida[chave] = limpar(v, profundidade + 1);
    });
    return saida;
  }
  if (typeof valor === 'string' && valor.length > LIMITE_TEXTO) return `${valor.slice(0, LIMITE_TEXTO)}…`;
  return valor;
}

function ipDaRequisicao(req) {
  return req?.ip ? String(req.ip).replace(/^::ffff:/, '').slice(0, 45) : null;
}

/**
 * Registra uma operação na auditoria. Nunca interrompe a operação principal: se a gravação falhar, só registra no log.
 * @param {object} p
 * @param {object} [p.req] requisição (para usuário e IP)
 * @param {object} [p.usuario] usuário responsável (padrão: req.usuario)
 * @param {string} p.acao criar | atualizar | inativar | excluir | movimentar | importar | aprovar | login | backup | restaurar …
 * @param {string} p.modulo produtos | movimentacoes | equipamentos | usuarios | inventario | importacao | backup | …
 */
async function registrar({ req, usuario, acao, modulo, registroId, antes, depois, resultado = 'sucesso', detalhe, transaction }) {
  const responsavel = usuario || req?.usuario || null;
  try {
    await Auditoria.create(
      {
        usuarioId: responsavel?.id || null,
        usuarioNome: responsavel?.nome || null,
        acao,
        modulo,
        registroId: registroId === undefined || registroId === null ? null : String(registroId).slice(0, 60),
        dadosAnteriores: limpar(antes),
        dadosPosteriores: limpar(depois),
        resultado,
        detalhe: detalhe ? String(detalhe).slice(0, 500) : null,
        ip: ipDaRequisicao(req),
      },
      transaction ? { transaction } : {}
    );
  } catch (erro) {
    console.error('[auditoria] falha ao registrar:', erro.message);
  }
}

module.exports = { registrar };

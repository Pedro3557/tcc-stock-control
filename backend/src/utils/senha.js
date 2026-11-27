/**
 * Política de senha forte (a mesma lista é exibida na tela, item por item).
 * Aceita letras acentuadas (Á, ç…) como maiúsculas/minúsculas.
 */
const REGRAS_SENHA = [
  { id: 'tamanho', texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
  { id: 'maiuscula', texto: 'Uma letra maiúscula', ok: (s) => /\p{Lu}/u.test(s) },
  { id: 'minuscula', texto: 'Uma letra minúscula', ok: (s) => /\p{Ll}/u.test(s) },
  { id: 'numero', texto: 'Um número', ok: (s) => /\p{N}/u.test(s) },
  { id: 'especial', texto: 'Um caractere especial (ex.: ! @ # $ % & * -)', ok: (s) => /[^\p{L}\p{N}\s]/u.test(s) },
];

/** Lista do que falta na senha (vazia = senha forte). */
function faltasSenha(senha) {
  const s = String(senha ?? '');
  return REGRAS_SENHA.filter((r) => !r.ok(s)).map((r) => r.texto.replace(/ \(ex\.:.*\)$/, '').toLowerCase());
}

/** Mensagem única, para a API e para o terminal. */
function mensagemSenhaFraca(senha) {
  const faltas = faltasSenha(senha);
  return faltas.length ? `A senha precisa ter: ${faltas.join(', ')}.` : null;
}

module.exports = { REGRAS_SENHA, faltasSenha, mensagemSenhaFraca };

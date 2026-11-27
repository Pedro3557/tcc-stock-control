/** Mesmas regras da API (backend/src/utils/senha.js). */
export const REGRAS_SENHA = [
  { texto: 'Pelo menos 8 caracteres', ok: (s) => s.length >= 8 },
  { texto: 'Uma letra maiúscula', ok: (s) => /\p{Lu}/u.test(s) },
  { texto: 'Uma letra minúscula', ok: (s) => /\p{Ll}/u.test(s) },
  { texto: 'Um número', ok: (s) => /\p{N}/u.test(s) },
  { texto: 'Um caractere especial (ex.: ! @ # $ % & * -)', ok: (s) => /[^\p{L}\p{N}\s]/u.test(s) },
];

export const senhaForte = (senha) => REGRAS_SENHA.every((r) => r.ok(senha || ''));

/** Lista das regras: em vermelho o que falta, com ✓ o que já foi atendido. */
export default function RegrasSenha({ senha = '' }) {
  return (
    <ul className="regras-senha" aria-label="Requisitos da senha" aria-live="polite">
      {REGRAS_SENHA.map((r) => {
        const ok = r.ok(senha);
        return (
          <li key={r.texto} className={ok ? 'ok' : 'falta'}>
            <span aria-hidden="true">{ok ? '✓' : '✗'}</span> {r.texto}
            <span className="sr-only">{ok ? ' — atendido' : ' — pendente'}</span>
          </li>
        );
      })}
    </ul>
  );
}

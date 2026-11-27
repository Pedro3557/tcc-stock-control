/**
 * Sessão de login guardada por aba (sessionStorage): ao fechar o navegador (todas as abas do sistema),
 * a pessoa precisa entrar de novo. Útil em computadores compartilhados.
 *
 * Para não pedir login a cada aba nova (ex.: abrir um equipamento pelo QR Code ou com Ctrl+clique),
 * as abas abertas compartilham a sessão pelo BroadcastChannel:
 * - aba nova sem sessão pergunta às outras; se alguma responder, usa a mesma sessão;
 * - "Sair" em uma aba encerra a sessão em todas;
 * - token renovado (ex.: troca de senha) é repassado às outras abas.
 */
const CHAVE = 'estoque_token';
const canal = typeof window !== 'undefined' && 'BroadcastChannel' in window ? new BroadcastChannel('estoque-sessao') : null;

// Versões anteriores guardavam o token permanentemente: remove para valer a nova regra
try {
  localStorage.removeItem(CHAVE);
} catch {
  /* armazenamento indisponível */
}

function ler() {
  try {
    return sessionStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

function gravar(valor) {
  try {
    if (valor) sessionStorage.setItem(CHAVE, valor);
    else sessionStorage.removeItem(CHAVE);
  } catch {
    /* armazenamento indisponível */
  }
}

canal?.addEventListener('message', ({ data }) => {
  if (data?.tipo === 'pedir' && ler()) canal.postMessage({ tipo: 'token', token: ler() });
  if (data?.tipo === 'atualizar' && ler()) gravar(data.token);
  if (data?.tipo === 'sair' && ler()) {
    gravar(null);
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }
});

export const sessao = {
  ler,
  /** Grava o token nesta aba e atualiza as outras abas que já estão logadas. */
  salvar(valor) {
    gravar(valor);
    canal?.postMessage({ tipo: 'atualizar', token: valor });
  },
  /** Remove só nesta aba (ex.: token expirado). */
  limpar() {
    gravar(null);
  },
  /** "Sair": encerra a sessão em todas as abas. */
  sairDeTodas() {
    gravar(null);
    canal?.postMessage({ tipo: 'sair' });
  },
  /** Aba nova: tenta pegar a sessão de outra aba aberta do sistema. */
  pedirDeOutraAba(espera = 400) {
    if (!canal || ler()) return Promise.resolve(ler());
    return new Promise((resolve) => {
      const aoReceber = ({ data }) => {
        if (data?.tipo === 'token' && data.token) {
          fim(data.token);
        }
      };
      const fim = (valor) => {
        clearTimeout(timer);
        canal.removeEventListener('message', aoReceber);
        if (valor) gravar(valor);
        resolve(valor || null);
      };
      const timer = setTimeout(() => fim(null), espera);
      canal.addEventListener('message', aoReceber);
      canal.postMessage({ tipo: 'pedir' });
    });
  },
};

import axios from 'axios';

const CHAVE_TOKEN = 'estoque_token';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3333/api',
  timeout: 30000,
});

export const token = {
  ler: () => {
    try {
      return localStorage.getItem(CHAVE_TOKEN);
    } catch {
      return null;
    }
  },
  salvar: (valor) => {
    try {
      localStorage.setItem(CHAVE_TOKEN, valor);
    } catch {
      /* armazenamento indisponível */
    }
  },
  limpar: () => {
    try {
      localStorage.removeItem(CHAVE_TOKEN);
    } catch {
      /* armazenamento indisponível */
    }
  },
};

api.interceptors.request.use((config) => {
  const t = token.ler();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Se a API responder 401 (sessão expirada/inválida), volta para o login
api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const ehLogin = erro.config?.url?.includes('/auth/login');
    if (erro.response?.status === 401 && !ehLogin) {
      token.limpar();
      if (window.location.pathname !== '/login') {
        window.location.assign('/login?expirada=1');
      }
    }
    return Promise.reject(erro);
  }
);

/** Extrai a mensagem de erro amigável enviada pela API. */
export function mensagemErro(erro, padrao = 'Não foi possível concluir a operação.') {
  if (!erro?.response) return 'Sem conexão com o servidor. Verifique sua internet ou se a API está no ar.';
  return erro.response.data?.erro || padrao;
}

/** Baixa um relatório CSV da API (com o token no cabeçalho). */
export async function baixarCSV(params) {
  const resposta = await api.get('/relatorios/exportar', { params, responseType: 'blob' });
  const disposicao = resposta.headers['content-disposition'] || '';
  const nome = /filename="([^"]+)"/.exec(disposicao)?.[1] || 'relatorio.csv';
  const url = URL.createObjectURL(resposta.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

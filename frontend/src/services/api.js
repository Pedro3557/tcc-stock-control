import axios from 'axios';

import { sessao } from './sessao.js';

export const api = axios.create({
  // Padrão: mesma origem (/api). Em desenvolvimento o Vite repassa /api para a API (ver vite.config.js).
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30000,
});

// Token de login: guardado por aba e compartilhado entre as abas abertas (ver sessao.js)
export const token = sessao;

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
    if (erro.response?.data?.codigo === 'TROCA_SENHA_OBRIGATORIA' && window.location.pathname !== '/trocar-senha') {
      window.location.assign('/trocar-senha');
    }
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
  if (erro.response.data?.erro) return erro.response.data.erro;
  // Sem mensagem da API (ex.: API desligada atrás do proxy do Vite ou de um proxy reverso)
  if ([500, 502, 503, 504].includes(erro.response.status)) {
    return 'O servidor do sistema (API) não respondeu. Confira se ele está rodando: no terminal do "npm run dev" deve aparecer "[API] API de estoque rodando".';
  }
  return padrao;
}

// Em downloads (responseType blob) o JSON de erro chega como Blob: converte para a mensagem continuar aparecendo
api.interceptors.response.use(undefined, async (erro) => {
  const dados = erro.response?.data;
  if (dados instanceof Blob && dados.type.includes('json')) {
    try {
      erro.response.data = JSON.parse(await dados.text());
    } catch {
      /* mantém o original */
    }
  }
  return Promise.reject(erro);
});

/** Baixa um relatório CSV da API (com o token no cabeçalho). */
export function baixarCSV(params) {
  return baixarArquivo('/relatorios/exportar', params, 'relatorio.csv');
}

/** Baixa qualquer arquivo da API usando o nome enviado no Content-Disposition. */
export async function baixarArquivo(caminho, params, nomePadrao = 'arquivo') {
  const resposta = await api.get(caminho, { params, responseType: 'blob' });
  const disposicao = resposta.headers['content-disposition'] || '';
  const nome = /filename="([^"]+)"/.exec(disposicao)?.[1] || nomePadrao;
  const url = URL.createObjectURL(resposta.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

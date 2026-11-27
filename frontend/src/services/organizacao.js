import { api } from './api.js';

/** Configurações públicas (nome da organização, CNPJ, endereço do sistema), lidas uma vez e guardadas em memória. */
let cache = null;

export async function obterOrganizacao() {
  if (!cache) {
    cache = api.get('/configuracoes/publicas').then(({ data }) => ({
      nome: data['organizacao.nome'],
      cnpj: data['organizacao.cnpj'],
      telefone: data['organizacao.telefone'],
      endereco: data['organizacao.endereco'],
      urlPublica: data['sistema.urlPublica'],
    }));
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** Chamado depois que o admin altera as configurações. */
export function limparOrganizacao() {
  cache = null;
}

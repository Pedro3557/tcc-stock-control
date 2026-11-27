import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, token } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    // Aba nova: aproveita a sessão de outra aba aberta do sistema, se houver
    token.pedirDeOutraAba().then((atual) => {
      if (!ativo) return;
      if (!atual) {
        setCarregando(false);
        return;
      }
      api
        .get('/auth/me')
        .then(({ data }) => ativo && setUsuario(data))
        .catch(() => token.limpar())
        .finally(() => ativo && setCarregando(false));
    });
    return () => {
      ativo = false;
    };
  }, []);

  const entrar = useCallback(async (email, senha) => {
    const { data } = await api.post('/auth/login', { email, senha });
    token.salvar(data.token);
    setUsuario(data.usuario);
    return data.usuario;
  }, []);

  /** Atualiza os dados do usuário logado (ex.: depois de trocar a senha). */
  const atualizarUsuario = useCallback((dados) => setUsuario((u) => ({ ...u, ...dados })), []);

  const sair = useCallback(() => {
    token.sairDeTodas();
    setUsuario(null);
  }, []);

  const valor = useMemo(() => {
    const perfil = usuario?.perfil;
    return {
      usuario,
      carregando,
      entrar,
      sair,
      atualizarUsuario,
      precisaTrocarSenha: Boolean(usuario?.precisaTrocarSenha),
      ehAdmin: perfil === 'admin',
      podeMovimentar: perfil === 'admin' || perfil === 'almoxarife',
      podeEditar: perfil === 'admin' || perfil === 'almoxarife',
      podeExcluir: perfil === 'admin',
    };
  }, [usuario, carregando, entrar, sair, atualizarUsuario]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

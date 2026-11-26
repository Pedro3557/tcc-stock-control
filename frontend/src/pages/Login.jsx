import { useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { mensagemErro } from '../services/api.js';
import Campo from '../components/Campo.jsx';

export default function Login() {
  const { usuario, entrar } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();
  const local = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  if (usuario) return <Navigate to={usuario.precisaTrocarSenha ? '/trocar-senha' : '/'} replace />;

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      const u = await entrar(email.trim(), senha);
      if (u.precisaTrocarSenha) {
        navegar('/trocar-senha', { replace: true });
        return;
      }
      toast.sucesso(`Bem-vindo(a), ${u.nome}!`);
      navegar(local.state?.de || '/', { replace: true });
    } catch (falha) {
      setErro(mensagemErro(falha, 'Não foi possível entrar.'));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-cartao" onSubmit={enviar}>
        <div className="login-marca">
          <img src="/icone.svg" alt="" width="40" height="40" />
          <div>
            <h1>Controle de Estoque</h1>
            <p className="texto-suave">Almoxarifado do provedor</p>
          </div>
        </div>

        {params.get('expirada') && !erro && <div className="aviso">Sua sessão expirou. Entre novamente.</div>}
        {erro && <div className="aviso aviso-erro">{erro}</div>}

        <Campo rotulo="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
        </Campo>
        <Campo rotulo="Senha">
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required />
        </Campo>
        <button type="submit" className="botao botao-primario botao-bloco" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

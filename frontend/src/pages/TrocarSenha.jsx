import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { api, mensagemErro, token } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Campo from '../components/Campo.jsx';
import Carregando from '../components/Carregando.jsx';
import RegrasSenha, { senhaForte } from '../components/RegrasSenha.jsx';


export default function TrocarSenha() {
  const { usuario, carregando, precisaTrocarSenha, atualizarUsuario, sair } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();
  const [form, setForm] = useState({ senhaAtual: '', novaSenha: '', confirmacao: '' });
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  if (carregando) return <Carregando tela />;
  if (!usuario) return <Navigate to="/login" replace />;

  const regrasOk = senhaForte(form.novaSenha);
  const confere = form.novaSenha === form.confirmacao;
  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    if (!regrasOk) return setErro('A nova senha ainda não atende a todos os requisitos (em vermelho).');
    if (!confere) return setErro('A confirmação não é igual à nova senha.');
    setEnviando(true);
    try {
      const { data } = await api.post('/auth/trocar-senha', { senhaAtual: form.senhaAtual, novaSenha: form.novaSenha });
      // A troca de senha encerra as sessões antigas: guarda o novo token
      token.salvar(data.token);
      atualizarUsuario(data.usuario);
      toast.sucesso('Senha alterada com sucesso.');
      navegar('/', { replace: true });
    } catch (falha) {
      setErro(mensagemErro(falha));
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
            <h1>{precisaTrocarSenha ? 'Defina sua senha' : 'Trocar senha'}</h1>
            <p className="texto-suave">{usuario.email}</p>
          </div>
        </div>

        {precisaTrocarSenha && (
          <div className="aviso">
            Você entrou com uma senha provisória. Para continuar, crie uma senha pessoal.
          </div>
        )}
        {erro && <div className="aviso aviso-erro">{erro}</div>}

        <Campo rotulo={precisaTrocarSenha ? 'Senha provisória' : 'Senha atual'}>
          <input type="password" value={form.senhaAtual} onChange={set('senhaAtual')} autoComplete="current-password" required autoFocus />
        </Campo>
        <Campo rotulo="Nova senha">
          <input type="password" value={form.novaSenha} onChange={set('novaSenha')} autoComplete="new-password" required />
        </Campo>
        <RegrasSenha senha={form.novaSenha} />
        <Campo rotulo="Confirme a nova senha">
          <input type="password" value={form.confirmacao} onChange={set('confirmacao')} autoComplete="new-password" required />
        </Campo>

        <button type="submit" className="botao botao-primario botao-bloco" disabled={enviando}>
          {enviando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
        {precisaTrocarSenha ? (
          <button type="button" className="botao botao-bloco" onClick={() => { sair(); navegar('/login', { replace: true }); }}>
            Sair
          </button>
        ) : (
          <Link to="/" className="botao botao-bloco">Cancelar</Link>
        )}
      </form>
    </div>
  );
}

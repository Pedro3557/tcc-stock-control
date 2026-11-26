import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Carregando from './Carregando.jsx';

export default function RotaProtegida({ children, perfis }) {
  const { usuario, carregando } = useAuth();
  const local = useLocation();

  if (carregando) return <Carregando tela />;
  if (!usuario) return <Navigate to="/login" replace state={{ de: local.pathname }} />;
  // Senha provisória: obriga a troca antes de usar o sistema
  if (usuario.precisaTrocarSenha) return <Navigate to="/trocar-senha" replace />;
  if (perfis && !perfis.includes(usuario.perfil)) {
    return (
      <div className="vazio">
        <h2>Acesso restrito</h2>
        <p>Seu perfil não tem permissão para acessar esta tela.</p>
      </div>
    );
  }
  return children;
}

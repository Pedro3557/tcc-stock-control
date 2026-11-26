import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PERFIS } from '../services/formatos.js';
import Icone from './Icone.jsx';

export default function Layout() {
  const { usuario, sair, ehAdmin, podeMovimentar } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();
  const navegar = useNavigate();

  useEffect(() => setMenuAberto(false), [local.pathname]);

  const itens = [
    { para: '/', rotulo: 'Painel', icone: 'painel', fim: true },
    { para: '/produtos', rotulo: 'Produtos', icone: 'produtos' },
    { para: '/equipamentos', rotulo: 'Equipamentos', icone: 'equipamentos' },
    podeMovimentar && { para: '/movimentacoes/nova', rotulo: 'Nova movimentação', icone: 'movimentar' },
    { para: '/movimentacoes', rotulo: 'Histórico', icone: 'historico', fim: true },
    { para: '/tecnicos', rotulo: 'Técnicos', icone: 'tecnicos' },
    { para: '/fornecedores', rotulo: 'Fornecedores', icone: 'fornecedores' },
    { para: '/categorias', rotulo: 'Categorias', icone: 'categorias' },
    ehAdmin && { para: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' },
  ].filter(Boolean);

  function fazerLogout() {
    sair();
    navegar('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className="topo">
        <button type="button" className="botao-icone so-celular" onClick={() => setMenuAberto((v) => !v)} aria-label="Abrir menu">
          <Icone nome={menuAberto ? 'fechar' : 'menu'} tamanho={22} />
        </button>
        <span className="marca">
          <img src="/icone.svg" alt="" width="26" height="26" />
          Estoque <strong>Provedor</strong>
        </span>
        {podeMovimentar && (
          <NavLink to="/movimentacoes/nova" className="botao botao-primario botao-pequeno so-celular">
            <Icone nome="mais" tamanho={16} /> Movimentar
          </NavLink>
        )}
      </header>

      <aside className={`lateral ${menuAberto ? 'aberta' : ''}`}>
        <div className="lateral-marca so-desktop">
          <img src="/icone.svg" alt="" width="28" height="28" />
          <div>
            <strong>Estoque</strong>
            <small>Provedor de internet</small>
          </div>
        </div>
        <nav className="menu">
          {itens.map((i) => (
            <NavLink key={i.para} to={i.para} end={i.fim} className={({ isActive }) => `menu-item ${isActive ? 'ativo' : ''}`}>
              <Icone nome={i.icone} />
              {i.rotulo}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-usuario">
          <div>
            <strong>{usuario?.nome}</strong>
            <small>{PERFIS[usuario?.perfil]}</small>
          </div>
          <button type="button" className="botao-icone" onClick={fazerLogout} title="Sair" aria-label="Sair">
            <Icone nome="sair" />
          </button>
        </div>
      </aside>
      {menuAberto && <div className="fundo-menu" onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  );
}

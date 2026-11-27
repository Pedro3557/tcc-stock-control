import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../services/api.js';
import { obterOrganizacao } from '../services/organizacao.js';
import { PERFIS } from '../services/formatos.js';
import Icone from './Icone.jsx';

/** Quantidade de notificações não lidas, atualizada a cada minuto e ao trocar de página. */
function useNaoLidas(caminho) {
  const [naoLidas, setNaoLidas] = useState(0);
  const atualizar = useCallback(() => {
    api.get('/notificacoes/contagem').then(({ data }) => setNaoLidas(data.naoLidas)).catch(() => {});
  }, []);
  useEffect(() => {
    atualizar();
    const timer = setInterval(atualizar, 60000);
    window.addEventListener('notificacoes-atualizadas', atualizar);
    return () => {
      clearInterval(timer);
      window.removeEventListener('notificacoes-atualizadas', atualizar);
    };
  }, [atualizar]);
  useEffect(atualizar, [caminho, atualizar]);
  return naoLidas;
}

function Sino({ naoLidas, className = '' }) {
  return (
    <Link to="/notificacoes" className={`sino ${className}`} aria-label={`Notificações: ${naoLidas} não lida(s)`} title="Notificações">
      <Icone nome="sino" tamanho={20} />
      {naoLidas > 0 && <span className="sino-contador">{naoLidas > 99 ? '99+' : naoLidas}</span>}
    </Link>
  );
}

export default function Layout() {
  const { usuario, sair, ehAdmin, podeMovimentar } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const [organizacao, setOrganizacao] = useState('');
  const local = useLocation();
  const navegar = useNavigate();
  const naoLidas = useNaoLidas(local.pathname);

  useEffect(() => setMenuAberto(false), [local.pathname]);
  useEffect(() => {
    obterOrganizacao().then((o) => setOrganizacao(o.nome)).catch(() => {});
  }, []);

  // Menu por seções; cada item aparece só para os perfis com acesso
  const secoes = [
    {
      titulo: 'Operação',
      itens: [
        { para: '/', rotulo: 'Painel', icone: 'painel', fim: true },
        podeMovimentar && { para: '/movimentacoes/nova', rotulo: 'Nova movimentação', icone: 'movimentar' },
        { para: '/ler', rotulo: 'Ler etiqueta', icone: 'qrcode' },
        { para: '/movimentacoes', rotulo: 'Histórico', icone: 'historico', fim: true },
      ],
    },
    {
      titulo: 'Estoque',
      itens: [
        { para: '/produtos', rotulo: 'Produtos', icone: 'produtos' },
        { para: '/equipamentos', rotulo: 'Equipamentos', icone: 'equipamentos' },
        { para: '/inventarios', rotulo: 'Inventário físico', icone: 'inventario' },
        podeMovimentar && { para: '/etiquetas', rotulo: 'Etiquetas QR Code', icone: 'etiqueta' },
        podeMovimentar && { para: '/importar', rotulo: 'Importar planilha', icone: 'planilha' },
      ],
    },
    {
      titulo: 'Cadastros',
      itens: [
        { para: '/tecnicos', rotulo: 'Técnicos', icone: 'tecnicos' },
        { para: '/fornecedores', rotulo: 'Fornecedores', icone: 'fornecedores' },
        { para: '/categorias', rotulo: 'Categorias', icone: 'categorias' },
      ],
    },
    {
      titulo: 'Acompanhamento',
      itens: [
        { para: '/relatorios', rotulo: 'Relatórios', icone: 'relatorio' },
        { para: '/notificacoes', rotulo: 'Notificações', icone: 'sino', contador: naoLidas },
      ],
    },
    ehAdmin && {
      titulo: 'Administração',
      itens: [
        { para: '/usuarios', rotulo: 'Usuários', icone: 'usuarios' },
        { para: '/auditoria', rotulo: 'Auditoria', icone: 'auditoria' },
        { para: '/backups', rotulo: 'Backups', icone: 'backup' },
        { para: '/configuracoes', rotulo: 'Configurações', icone: 'configuracoes' },
      ],
    },
  ]
    .filter(Boolean)
    .map((s) => ({ ...s, itens: s.itens.filter(Boolean) }));

  function fazerLogout() {
    sair();
    navegar('/login', { replace: true });
  }

  return (
    <div className="app">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <header className="topo">
        <button
          type="button"
          className="botao-icone so-celular"
          onClick={() => setMenuAberto((v) => !v)}
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={menuAberto}
        >
          <Icone nome={menuAberto ? 'fechar' : 'menu'} tamanho={22} />
        </button>
        <span className="marca">
          <img src="/icone.svg" alt="" width="26" height="26" />
          Estoque
        </span>
        <Sino naoLidas={naoLidas} className="so-celular" />
        {podeMovimentar && (
          <NavLink to="/movimentacoes/nova" className="botao botao-primario botao-pequeno so-celular">
            <Icone nome="mais" tamanho={16} /> Movimentar
          </NavLink>
        )}
      </header>

      <aside className={`lateral ${menuAberto ? 'aberta' : ''}`} aria-label="Menu principal">
        <div className="lateral-marca so-desktop">
          <img src="/icone.svg" alt="" width="28" height="28" />
          <div>
            <strong>Estoque</strong>
            <small title={organizacao}>{organizacao || 'Controle de estoque'}</small>
          </div>
          <Sino naoLidas={naoLidas} />
        </div>
        <nav className="menu">
          {secoes.map((secao) => (
            <div key={secao.titulo} className="menu-secao">
              <span className="menu-secao-titulo">{secao.titulo}</span>
              {secao.itens.map((i) => (
                <NavLink key={i.para} to={i.para} end={i.fim} className={({ isActive }) => `menu-item ${isActive ? 'ativo' : ''}`}>
                  <Icone nome={i.icone} />
                  <span className="menu-rotulo">{i.rotulo}</span>
                  {i.contador > 0 && <span className="menu-contador">{i.contador > 99 ? '99+' : i.contador}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="lateral-usuario">
          <div>
            <strong>{usuario?.nome}</strong>
            <small>{PERFIS[usuario?.perfil]}</small>
            <NavLink to="/trocar-senha" className="link-suave">Trocar senha</NavLink>
          </div>
          <button type="button" className="botao-icone" onClick={fazerLogout} title="Sair" aria-label="Sair do sistema">
            <Icone nome="sair" />
          </button>
        </div>
      </aside>
      {menuAberto && <div className="fundo-menu" onClick={() => setMenuAberto(false)} aria-hidden="true" />}

      <main className="conteudo" id="conteudo" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  );
}

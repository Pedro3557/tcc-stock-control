import { useCallback, useEffect, useState } from 'react';
import { api, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatarDataHora, hojeISO } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Paginacao from '../components/Paginacao.jsx';
import Modal from '../components/Modal.jsx';

const MODULOS = {
  autenticacao: 'Autenticação',
  usuarios: 'Usuários',
  produtos: 'Produtos',
  categorias: 'Categorias',
  fornecedores: 'Fornecedores',
  tecnicos: 'Técnicos',
  equipamentos: 'Equipamentos',
  movimentacoes: 'Movimentações',
  inventario: 'Inventário',
  importacao: 'Importação',
  configuracoes: 'Configurações',
  backup: 'Backup',
};
const rotuloAcao = (a) => (a || '').replace(/_/g, ' ');

/** Mostra só os campos que mudaram entre "antes" e "depois". */
function Diferencas({ antes, depois }) {
  if (!antes && !depois) return <p className="texto-suave">Sem dados registrados.</p>;
  const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!ehObjeto(antes) || !ehObjeto(depois)) {
    return (
      <div className="auditoria-json">
        {antes && <><strong>Antes</strong><pre>{JSON.stringify(antes, null, 2)}</pre></>}
        {depois && <><strong>Depois</strong><pre>{JSON.stringify(depois, null, 2)}</pre></>}
      </div>
    );
  }
  const chaves = [...new Set([...Object.keys(antes), ...Object.keys(depois)])].filter(
    (k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]) && !['updatedAt'].includes(k)
  );
  if (!chaves.length) return <p className="texto-suave">Nenhum campo alterado.</p>;
  return (
    <table className="tabela tabela-compacta">
      <thead><tr><th>Campo</th><th>Antes</th><th>Depois</th></tr></thead>
      <tbody>
        {chaves.map((k) => (
          <tr key={k}>
            <td data-rotulo="Campo" className="mono">{k}</td>
            <td data-rotulo="Antes">{JSON.stringify(antes[k]) ?? '—'}</td>
            <td data-rotulo="Depois">{JSON.stringify(depois[k]) ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Auditoria() {
  const toast = useToast();
  const [filtros, setFiltros] = useState({ inicio: hojeISO(-7), fim: hojeISO(), usuarioId: '', modulo: '', acao: '', resultado: '' });
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [opcoes, setOpcoes] = useState({ modulos: [], acoes: [] });
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => {
    api.get('/usuarios').then(({ data }) => setUsuarios(data)).catch(() => {});
    api.get('/auditoria/opcoes').then(({ data }) => setOpcoes(data)).catch(() => {});
  }, []);

  const carregar = useCallback(() => {
    const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
    api
      .get('/auditoria', { params: { ...params, pagina } })
      .then(({ data }) => setResultado(data))
      .catch((e) => toast.erro(mensagemErro(e)));
  }, [filtros, pagina, toast]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  async function abrir(id) {
    try {
      const { data } = await api.get(`/auditoria/${id}`);
      setDetalhe(data);
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  const set = (campo) => (e) => {
    setFiltros({ ...filtros, [campo]: e.target.value });
    setPagina(1);
  };
  const lista = resultado?.dados || [];

  return (
    <>
      <Cabecalho titulo="Auditoria" subtitulo="Registro de quem fez o quê e quando. Somente leitura: os registros não podem ser alterados nem apagados." />
      <div className="cartao filtros-grade">
        <Campo rotulo="De"><input type="date" value={filtros.inicio} onChange={set('inicio')} /></Campo>
        <Campo rotulo="Até"><input type="date" value={filtros.fim} onChange={set('fim')} /></Campo>
        <Campo rotulo="Usuário">
          <select value={filtros.usuarioId} onChange={set('usuarioId')}>
            <option value="">Todos</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Módulo">
          <select value={filtros.modulo} onChange={set('modulo')}>
            <option value="">Todos</option>
            {opcoes.modulos.map((m) => <option key={m} value={m}>{MODULOS[m] || m}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Operação">
          <select value={filtros.acao} onChange={set('acao')}>
            <option value="">Todas</option>
            {opcoes.acoes.map((a) => <option key={a} value={a}>{rotuloAcao(a)}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Resultado">
          <select value={filtros.resultado} onChange={set('resultado')}>
            <option value="">Todos</option>
            <option value="sucesso">Sucesso</option>
            <option value="falha">Falha</option>
          </select>
        </Campo>
      </div>

      <div className="cartao sem-padding">
        {!resultado ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum registro no período" texto="Ajuste os filtros." />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr><th>Data/hora</th><th>Usuário</th><th>Módulo</th><th>Operação</th><th>Registro</th><th>Resultado</th><th>Detalhe</th><th className="acoes" /></tr>
              </thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id} className={r.resultado === 'falha' ? 'linha-alerta' : ''}>
                    <td data-rotulo="Data/hora" className="nowrap">{formatarDataHora(r.createdAt)}</td>
                    <td data-rotulo="Usuário">{r.usuarioNome || '—'}<small className="texto-suave bloco">{r.ip}</small></td>
                    <td data-rotulo="Módulo">{MODULOS[r.modulo] || r.modulo}</td>
                    <td data-rotulo="Operação">{rotuloAcao(r.acao)}</td>
                    <td data-rotulo="Registro" className="mono">{r.registroId || '—'}</td>
                    <td data-rotulo="Resultado">{r.resultado === 'falha' ? <span className="badge badge-defeito">Falha</span> : <span className="badge">Sucesso</span>}</td>
                    <td data-rotulo="Detalhe" className="auditoria-detalhe">{r.detalhe || '—'}</td>
                    <td className="acoes"><button type="button" className="botao botao-pequeno" onClick={() => abrir(r.id)}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {resultado && <Paginacao pagina={resultado.pagina} paginas={resultado.paginas} total={resultado.total} aoMudar={setPagina} />}

      <Modal titulo={detalhe ? `Registro #${detalhe.id}` : ''} aberto={!!detalhe} aoFechar={() => setDetalhe(null)} largura={760}>
        {detalhe && (
          <div className="formulario">
            <dl className="detalhes">
              <div><dt>Data/hora</dt><dd>{formatarDataHora(detalhe.createdAt)}</dd></div>
              <div><dt>Usuário</dt><dd>{detalhe.usuarioNome || '—'} {detalhe.ip && <small className="texto-suave">({detalhe.ip})</small>}</dd></div>
              <div><dt>Módulo / operação</dt><dd>{MODULOS[detalhe.modulo] || detalhe.modulo} · {rotuloAcao(detalhe.acao)}</dd></div>
              <div><dt>Resultado</dt><dd>{detalhe.resultado === 'falha' ? 'Falha' : 'Sucesso'}</dd></div>
              {detalhe.detalhe && <div className="largura-total"><dt>Detalhe</dt><dd>{detalhe.detalhe}</dd></div>}
            </dl>
            <h3>Alterações</h3>
            <Diferencas antes={detalhe.dadosAnteriores} depois={detalhe.dadosPosteriores} />
          </div>
        )}
      </Modal>
    </>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, baixarCSV, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS, formatarDataHora } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Paginacao from '../components/Paginacao.jsx';
import Icone from '../components/Icone.jsx';

export default function Equipamentos() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState(params.get('busca') || '');
  const [resultado, setResultado] = useState(null);
  const [produtos, setProdutos] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const status = params.get('status') || '';
  const produtoId = params.get('produtoId') || '';

  const filtro = (chave, valor) => {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo, { replace: true });
    setPagina(1);
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/equipamentos', {
        params: { busca: busca.trim() || undefined, status: status || undefined, produtoId: produtoId || undefined, pagina, limite: 50 },
      });
      setResultado(data);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [busca, status, produtoId, pagina, toast]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    api.get('/produtos', { params: { tipoControle: 'serializado' } }).then(({ data }) => setProdutos(data)).catch(() => {});
  }, []);

  async function exportar() {
    try {
      await baixarCSV({ relatorio: 'equipamentos', status: status || undefined, produtoId: produtoId || undefined });
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  const lista = resultado?.dados || [];

  return (
    <>
      <Cabecalho titulo="Equipamentos" subtitulo="ONUs, roteadores e demais unidades controladas por nº de série / MAC">
        <button type="button" className="botao" onClick={exportar}><Icone nome="baixar" tamanho={16} /> CSV</button>
      </Cabecalho>

      <div className="filtros">
        <div className="busca busca-grande">
          <Icone nome="busca" />
          <input
            type="search"
            placeholder="Nº de série, MAC, cliente ou técnico"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(1); }}
            autoFocus
            autoCapitalize="characters"
            enterKeyHint="search"
          />
        </div>
        <select value={status} onChange={(e) => filtro('status', e.target.value)} aria-label="Status">
          <option value="">Todos os status</option>
          {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
        <select value={produtoId} onChange={(e) => filtro('produtoId', e.target.value)} aria-label="Produto">
          <option value="">Todos os produtos</option>
          {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </div>

      <div className="chips">
        {['', ...Object.keys(STATUS)].map((s) => (
          <button key={s || 'todos'} type="button" className={`chip ${status === s ? 'chip-ativo' : ''}`} onClick={() => filtro('status', s)}>
            {s ? STATUS[s] : 'Todos'}
          </button>
        ))}
      </div>

      <div className="cartao sem-padding">
        {carregando && !resultado ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum equipamento encontrado" texto={busca ? `Nada encontrado para "${busca}".` : 'Ajuste os filtros ou registre uma entrada.'} />
        ) : (
          <div className={`tabela-rolagem ${carregando ? 'atualizando' : ''}`}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nº de série</th>
                  <th>MAC</th>
                  <th>Produto</th>
                  <th>Status</th>
                  <th>Com / onde</th>
                  <th>Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id}>
                    <td data-rotulo="Nº de série"><Link to={`/equipamentos/${e.id}`} className="link-forte mono">{e.numeroSerie}</Link></td>
                    <td data-rotulo="MAC" className="mono">{e.mac || '—'}</td>
                    <td data-rotulo="Produto">{e.produto?.nome}<small className="texto-suave bloco">{e.produto?.categoria?.nome}</small></td>
                    <td data-rotulo="Status"><StatusBadge status={e.status} /></td>
                    <td data-rotulo="Com / onde">
                      {e.status === 'com_tecnico' && e.tecnico?.nome}
                      {e.status === 'instalado_cliente' && `Cliente ${e.clienteCodigo}${e.clienteNome ? ` · ${e.clienteNome}` : ''}`}
                      {!['com_tecnico', 'instalado_cliente'].includes(e.status) && <span className="texto-suave">—</span>}
                    </td>
                    <td data-rotulo="Atualizado" className="nowrap">{formatarDataHora(e.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {resultado && <Paginacao pagina={resultado.pagina} paginas={resultado.paginas} total={resultado.total} aoMudar={setPagina} />}
    </>
  );
}

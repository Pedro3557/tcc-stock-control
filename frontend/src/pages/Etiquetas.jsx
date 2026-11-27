import { useCallback, useEffect, useState } from 'react';
import { api, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Icone from '../components/Icone.jsx';

const LIMITE = 500;

/** Impressão de etiquetas com QR Code em lote. */
export default function Etiquetas() {
  const toast = useToast();
  const [produtos, setProdutos] = useState([]);
  const [filtros, setFiltros] = useState({ produtoId: '', status: 'em_estoque', busca: '' });
  const [lista, setLista] = useState(null);
  const [total, setTotal] = useState(0);
  const [selecionados, setSelecionados] = useState(new Set());
  const [formato, setFormato] = useState('a4-3x7');
  const [inicio, setInicio] = useState(1);
  const [formatos, setFormatos] = useState({});
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    api.get('/produtos', { params: { tipoControle: 'serializado' } }).then(({ data }) => setProdutos(data)).catch(() => {});
    import('../services/etiquetas.js').then((m) => setFormatos(m.FORMATOS));
  }, []);

  const carregar = useCallback(async () => {
    setLista(null);
    try {
      const { data } = await api.get('/equipamentos', {
        params: { produtoId: filtros.produtoId || undefined, status: filtros.status || undefined, busca: filtros.busca.trim() || undefined, limite: LIMITE },
      });
      setLista(data.dados);
      setTotal(data.total);
      setSelecionados(new Set(data.dados.map((e) => e.id)));
    } catch (e) {
      toast.erro(mensagemErro(e));
      setLista([]);
    }
  }, [filtros, toast]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  function alternar(id) {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  }

  async function gerar() {
    const escolhidos = (lista || []).filter((e) => selecionados.has(e.id));
    if (!escolhidos.length) {
      toast.erro('Selecione ao menos um equipamento.');
      return;
    }
    setGerando(true);
    try {
      const { gerarPDFEtiquetas } = await import('../services/etiquetas.js');
      await gerarPDFEtiquetas(escolhidos, { formato, inicio: Number(inicio) || 1 });
      toast.sucesso(`${escolhidos.length} etiqueta(s) gerada(s).`);
    } catch (e) {
      toast.erro(`Não foi possível gerar as etiquetas: ${e.message}`);
    } finally {
      setGerando(false);
    }
  }

  const set = (campo) => (e) => setFiltros({ ...filtros, [campo]: e.target.value });
  const porFolha = formatos[formato] ? formatos[formato].colunas * formatos[formato].linhas : 1;

  return (
    <>
      <Cabecalho titulo="Etiquetas com QR Code" subtitulo="Selecione os equipamentos e gere um PDF pronto para imprimir em folha de etiquetas ou impressora térmica" />

      <div className="cartao filtros-grade">
        <Campo rotulo="Produto">
          <select value={filtros.produtoId} onChange={set('produtoId')}>
            <option value="">Todos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Status">
          <select value={filtros.status} onChange={set('status')}>
            <option value="">Todos</option>
            {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Busca"><input value={filtros.busca} onChange={set('busca')} placeholder="Série, MAC ou cliente" /></Campo>
        <Campo rotulo="Formato">
          <select value={formato} onChange={(e) => { setFormato(e.target.value); setInicio(1); }}>
            {Object.entries(formatos).map(([v, f]) => <option key={v} value={v}>{f.rotulo}</option>)}
          </select>
        </Campo>
        {porFolha > 1 && (
          <Campo rotulo="Começar na etiqueta nº" dica="Para reaproveitar uma folha já usada.">
            <input type="number" min="1" max={porFolha} value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </Campo>
        )}
        <div className="campo campo-acao">
          <button type="button" className="botao botao-primario" onClick={gerar} disabled={gerando || !selecionados.size}>
            <Icone nome="pdf" tamanho={16} /> {gerando ? 'Gerando…' : `Gerar PDF (${selecionados.size})`}
          </button>
        </div>
      </div>

      <div className="cartao sem-padding">
        {!lista ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum equipamento com esses filtros" />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos"
                      checked={selecionados.size === lista.length}
                      onChange={(e) => setSelecionados(new Set(e.target.checked ? lista.map((x) => x.id) : []))}
                    />
                  </th>
                  <th>Nº de série</th>
                  <th>Produto</th>
                  <th>Código da etiqueta</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((e) => (
                  <tr key={e.id} onClick={() => alternar(e.id)} className="linha-clicavel">
                    <td className="col-check"><input type="checkbox" checked={selecionados.has(e.id)} onChange={() => alternar(e.id)} onClick={(ev) => ev.stopPropagation()} aria-label={`Selecionar ${e.numeroSerie}`} /></td>
                    <td data-rotulo="Nº de série" className="mono">{e.numeroSerie}</td>
                    <td data-rotulo="Produto">{e.produto?.nome}</td>
                    <td data-rotulo="Código" className="mono">{e.codigoEtiqueta}</td>
                    <td data-rotulo="Status"><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {total > LIMITE && <p className="aviso nota">Mostrando os {LIMITE} primeiros de {total}. Use os filtros para gerar o restante.</p>}
    </>
  );
}

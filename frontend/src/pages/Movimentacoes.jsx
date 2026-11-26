import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, baixarCSV, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { TIPOS, formatarDataHora, formatarQtd, hojeISO } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Paginacao from '../components/Paginacao.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Campo from '../components/Campo.jsx';
import Icone from '../components/Icone.jsx';

const FILTROS_INICIAIS = { inicio: hojeISO(-30), fim: hojeISO(), tipo: '', produtoId: '', tecnicoId: '', cliente: '', os: '' };

export default function Movimentacoes() {
  const { podeMovimentar } = useAuth();
  const toast = useToast();
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [pagina, setPagina] = useState(1);
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [produtos, setProdutos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);

  useEffect(() => {
    api.get('/produtos', { params: { incluirInativos: true } }).then(({ data }) => setProdutos(data)).catch(() => {});
    api.get('/tecnicos', { params: { incluirInativos: true } }).then(({ data }) => setTecnicos(data)).catch(() => {});
  }, []);

  const paramsApi = useCallback(() => {
    const p = {};
    Object.entries(filtros).forEach(([k, v]) => {
      if (v) p[k] = v;
    });
    return p;
  }, [filtros]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/movimentacoes', { params: { ...paramsApi(), pagina, limite: 50 } });
      setResultado(data);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [paramsApi, pagina, toast]);

  useEffect(() => {
    const t = setTimeout(carregar, 300);
    return () => clearTimeout(t);
  }, [carregar]);

  const set = (campo) => (e) => {
    setFiltros((f) => ({ ...f, [campo]: e.target.value }));
    setPagina(1);
  };

  async function exportar() {
    try {
      await baixarCSV({ relatorio: 'movimentacoes', ...paramsApi() });
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  const lista = resultado?.dados || [];

  return (
    <>
      <Cabecalho titulo="Histórico de movimentações" subtitulo="Entradas, saídas, instalações, retiradas, manutenção e baixas">
        <button type="button" className="botao" onClick={exportar}><Icone nome="baixar" tamanho={16} /> CSV</button>
        {podeMovimentar && <Link to="/movimentacoes/nova" className="botao botao-primario"><Icone nome="mais" tamanho={16} /> Nova</Link>}
      </Cabecalho>

      <div className="cartao filtros-grade">
        <Campo rotulo="De"><input type="date" value={filtros.inicio} onChange={set('inicio')} /></Campo>
        <Campo rotulo="Até"><input type="date" value={filtros.fim} onChange={set('fim')} /></Campo>
        <Campo rotulo="Tipo">
          <select value={filtros.tipo} onChange={set('tipo')}>
            <option value="">Todos</option>
            {Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Produto">
          <select value={filtros.produtoId} onChange={set('produtoId')}>
            <option value="">Todos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Técnico">
          <select value={filtros.tecnicoId} onChange={set('tecnicoId')}>
            <option value="">Todos</option>
            {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Cliente"><input value={filtros.cliente} onChange={set('cliente')} placeholder="Código" /></Campo>
        <Campo rotulo="OS"><input value={filtros.os} onChange={set('os')} placeholder="Nº da OS" /></Campo>
        <div className="campo campo-acao">
          <button type="button" className="botao" onClick={() => { setFiltros(FILTROS_INICIAIS); setPagina(1); }}>Limpar filtros</button>
        </div>
      </div>

      <div className="cartao sem-padding">
        {carregando && !resultado ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhuma movimentação no período" texto="Ajuste os filtros para ver outros registros." />
        ) : (
          <div className={`tabela-rolagem ${carregando ? 'atualizando' : ''}`}>
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data/hora</th>
                  <th>Tipo</th>
                  <th>Produto / unidade</th>
                  <th className="num">Qtd.</th>
                  <th>Técnico</th>
                  <th>Cliente / OS</th>
                  <th>Documento</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((m) => (
                  <tr key={m.id} className={m.tipo === 'baixa' ? 'linha-baixa' : ''}>
                    <td data-rotulo="Data/hora" className="nowrap">{formatarDataHora(m.createdAt)}</td>
                    <td data-rotulo="Tipo">
                      <strong className="nowrap">{TIPOS[m.tipo]}</strong>
                      {m.statusNovo && m.statusAnterior && <small className="bloco"><StatusBadge status={m.statusNovo} /></small>}
                    </td>
                    <td data-rotulo="Produto">
                      {m.produto?.nome}
                      {m.equipamento && (
                        <Link to={`/equipamentos/${m.equipamento.id}`} className="bloco link-forte mono">{m.equipamento.numeroSerie}</Link>
                      )}
                      {m.observacao && <small className="texto-suave bloco">{m.observacao}</small>}
                    </td>
                    <td data-rotulo="Qtd." className="num nowrap">
                      {Number(m.quantidade) > 0 && m.tipo === 'ajuste_inventario' ? '+' : ''}
                      {formatarQtd(m.quantidade, m.produto?.unidade)}
                    </td>
                    <td data-rotulo="Técnico">{m.tecnico?.nome || '—'}</td>
                    <td data-rotulo="Cliente / OS">{[m.clienteCodigo, m.numeroOS].filter(Boolean).join(' · ') || '—'}</td>
                    <td data-rotulo="Documento">{m.notaFiscal ? `NF ${m.notaFiscal}` : '—'}{m.fornecedor && <small className="texto-suave bloco">{m.fornecedor.nome}</small>}</td>
                    <td data-rotulo="Usuário">{m.usuario?.nome}</td>
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

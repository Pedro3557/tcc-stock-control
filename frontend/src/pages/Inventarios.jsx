import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatarDataHora } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Modal from '../components/Modal.jsx';
import Campo from '../components/Campo.jsx';
import Paginacao from '../components/Paginacao.jsx';
import Icone from '../components/Icone.jsx';

export const SITUACAO_INVENTARIO = {
  em_contagem: 'Em contagem',
  em_revisao: 'Em revisão',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

export function SituacaoInventario({ situacao }) {
  return <span className={`badge badge-inv-${situacao}`}>{SITUACAO_INVENTARIO[situacao]}</span>;
}

export default function Inventarios() {
  const { podeMovimentar } = useAuth();
  const toast = useToast();
  const navegar = useNavigate();
  const [resultado, setResultado] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [situacao, setSituacao] = useState('');
  const [novo, setNovo] = useState(false);
  const [categorias, setCategorias] = useState([]);
  const [produtos, setProdutos] = useState([]);
  const [form, setForm] = useState({ descricao: '', categoriaIds: [], produtoIds: [], observacao: '' });
  const [buscaProduto, setBuscaProduto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(() => {
    api
      .get('/inventarios', { params: { pagina, situacao: situacao || undefined } })
      .then(({ data }) => setResultado(data))
      .catch((e) => toast.erro(mensagemErro(e)));
  }, [pagina, situacao, toast]);

  useEffect(carregar, [carregar]);

  function abrirNovo() {
    setForm({ descricao: `Inventário de ${new Date().toLocaleDateString('pt-BR')}`, categoriaIds: [], produtoIds: [], observacao: '' });
    setBuscaProduto('');
    setNovo(true);
    if (!categorias.length) api.get('/categorias').then(({ data }) => setCategorias(data)).catch(() => {});
    if (!produtos.length) api.get('/produtos').then(({ data }) => setProdutos(data)).catch(() => {});
  }

  const alternar = (campo, id) =>
    setForm((f) => ({ ...f, [campo]: f[campo].includes(id) ? f[campo].filter((x) => x !== id) : [...f[campo], id] }));

  async function criar(e) {
    e.preventDefault();
    if (!form.categoriaIds.length && !form.produtoIds.length) {
      toast.erro('Selecione ao menos uma categoria ou um produto.');
      return;
    }
    setSalvando(true);
    try {
      const { data } = await api.post('/inventarios', form);
      toast.sucesso('Inventário aberto. O saldo atual foi registrado para comparação.');
      navegar(`/inventarios/${data.id}`);
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  const produtosFiltrados = produtos.filter((p) =>
    `${p.codigo} ${p.nome}`.toLowerCase().includes(buscaProduto.trim().toLowerCase())
  );
  const lista = resultado?.dados || [];

  return (
    <>
      <Cabecalho titulo="Inventário físico" subtitulo="Conferência do estoque: contagem de materiais e leitura dos equipamentos. O estoque só muda depois da aprovação dos ajustes.">
        {podeMovimentar && (
          <button type="button" className="botao botao-primario" onClick={abrirNovo}>
            <Icone nome="mais" tamanho={16} /> Novo inventário
          </button>
        )}
      </Cabecalho>

      <div className="chips">
        {['', ...Object.keys(SITUACAO_INVENTARIO)].map((s) => (
          <button key={s || 'todos'} type="button" className={`chip ${situacao === s ? 'chip-ativo' : ''}`} onClick={() => { setSituacao(s); setPagina(1); }}>
            {s ? SITUACAO_INVENTARIO[s] : 'Todos'}
          </button>
        ))}
      </div>

      <div className="cartao sem-padding">
        {!resultado ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum inventário" texto="Abra um inventário para conferir o estoque físico com o sistema." />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Descrição</th>
                  <th>Situação</th>
                  <th className="num">Produtos</th>
                  <th className="num">Equipamentos</th>
                  <th>Aberto em</th>
                  <th>Aprovado por</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i) => (
                  <tr key={i.id}>
                    <td data-rotulo="#">{i.id}</td>
                    <td data-rotulo="Descrição"><Link to={`/inventarios/${i.id}`} className="link-forte">{i.descricao}</Link></td>
                    <td data-rotulo="Situação"><SituacaoInventario situacao={i.situacao} /></td>
                    <td data-rotulo="Produtos" className="num">{i.totalProdutos}</td>
                    <td data-rotulo="Equipamentos" className="num">{i.totalEquipamentos}</td>
                    <td data-rotulo="Aberto em" className="nowrap">{formatarDataHora(i.createdAt)}<small className="texto-suave bloco">{i.criador?.nome}</small></td>
                    <td data-rotulo="Aprovado por">{i.aprovador?.nome || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {resultado && <Paginacao pagina={resultado.pagina} paginas={resultado.paginas} total={resultado.total} aoMudar={setPagina} />}

      <Modal titulo="Novo inventário" aberto={novo} aoFechar={() => setNovo(false)} largura={720}>
        <form className="formulario" onSubmit={criar}>
          <Campo rotulo="Descrição" obrigatorio>
            <input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} maxLength={150} required />
          </Campo>
          <fieldset className="selecao">
            <legend className="campo-rotulo">Categorias a conferir</legend>
            <div className="selecao-opcoes">
              {categorias.map((c) => (
                <label key={c.id} className="check">
                  <input type="checkbox" checked={form.categoriaIds.includes(c.id)} onChange={() => alternar('categoriaIds', c.id)} />
                  {c.nome} <small className="texto-suave">({c.totalProdutos ?? 0})</small>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="selecao">
            <legend className="campo-rotulo">E/ou produtos específicos {form.produtoIds.length > 0 && `(${form.produtoIds.length})`}</legend>
            <input type="search" placeholder="Filtrar produtos" value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} />
            <div className="selecao-opcoes selecao-lista">
              {produtosFiltrados.map((p) => (
                <label key={p.id} className="check">
                  <input type="checkbox" checked={form.produtoIds.includes(p.id)} onChange={() => alternar('produtoIds', p.id)} />
                  <span className="mono">{p.codigo}</span> {p.nome}
                </label>
              ))}
            </div>
          </fieldset>
          <Campo rotulo="Observação">
            <textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} maxLength={2000} />
          </Campo>
          <p className="texto-suave nota">Ao abrir, o sistema registra o saldo atual de cada produto. Movimentações feitas durante a contagem bloqueiam a aprovação do item afetado até ele ser recontado.</p>
          <div className="formulario-acoes">
            <button type="button" className="botao" onClick={() => setNovo(false)}>Cancelar</button>
            <button type="submit" className="botao botao-primario" disabled={salvando}>{salvando ? 'Abrindo…' : 'Abrir inventário'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

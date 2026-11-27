import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, baixarCSV, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatarMoeda, UNIDADES } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Modal from '../components/Modal.jsx';
import Campo from '../components/Campo.jsx';
import NivelEstoque from '../components/NivelEstoque.jsx';
import Icone from '../components/Icone.jsx';
import Paginacao from '../components/Paginacao.jsx';

const POR_PAGINA = 50;

const VAZIO = {
  codigo: '', nome: '', descricao: '', marca: '', modelo: '', categoriaId: '', tipoControle: 'quantidade',
  unidade: 'un', local: '', estoqueMinimo: 0, custoUnitario: 0,
};

export default function Produtos() {
  const { podeEditar, podeExcluir, podeMovimentar } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [produtos, setProdutos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState(params.get('busca') || '');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [pagina, setPagina] = useState(1);

  const categoriaId = params.get('categoriaId') || '';
  const tipoControle = params.get('tipoControle') || '';
  const abaixoMinimo = params.get('abaixoMinimo') === 'true';

  const filtro = (chave, valor) => {
    const novo = new URLSearchParams(params);
    if (valor) novo.set(chave, valor);
    else novo.delete(chave);
    setParams(novo, { replace: true });
  };

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get('/produtos', {
        params: { busca: busca || undefined, categoriaId: categoriaId || undefined, tipoControle: tipoControle || undefined, abaixoMinimo: abaixoMinimo || undefined },
      });
      setProdutos(data);
      setPagina(1);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [busca, categoriaId, tipoControle, abaixoMinimo, toast]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  useEffect(() => {
    api.get('/categorias').then(({ data }) => setCategorias(data)).catch(() => {});
  }, []);

  function abrir(produto) {
    setForm(produto ? { ...VAZIO, ...produto, descricao: produto.descricao || '', marca: produto.marca || '', modelo: produto.modelo || '', local: produto.local || '' } : { ...VAZIO, categoriaId: categorias[0]?.id || '' });
    setEditando(produto || {});
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    const dados = {
      codigo: form.codigo, nome: form.nome, descricao: form.descricao, marca: form.marca, modelo: form.modelo,
      categoriaId: Number(form.categoriaId), tipoControle: form.tipoControle,
      unidade: form.tipoControle === 'serializado' ? 'un' : form.unidade, local: form.local,
      estoqueMinimo: Number(form.estoqueMinimo || 0), custoUnitario: Number(String(form.custoUnitario).replace(',', '.') || 0),
    };
    try {
      if (editando.id) await api.put(`/produtos/${editando.id}`, dados);
      else await api.post('/produtos', dados);
      toast.sucesso(editando.id ? 'Produto atualizado.' : 'Produto cadastrado. Registre uma entrada para lançar o saldo.');
      setEditando(null);
      carregar();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  async function inativar(p) {
    if (!window.confirm(`Inativar o produto "${p.nome}"? O histórico será mantido.`)) return;
    try {
      await api.delete(`/produtos/${p.id}`);
      toast.sucesso('Produto inativado.');
      carregar();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    }
  }

  async function exportar() {
    try {
      await baixarCSV({ relatorio: 'estoque' });
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  const set = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });
  const travarTipo = Boolean(editando?.id);

  return (
    <>
      <Cabecalho titulo="Produtos" subtitulo="Equipamentos e materiais cadastrados">
        <button type="button" className="botao" onClick={exportar}><Icone nome="baixar" tamanho={16} /> CSV</button>
        {podeEditar && (
          <button type="button" className="botao botao-primario" onClick={() => abrir(null)}>
            <Icone nome="mais" tamanho={16} /> Novo produto
          </button>
        )}
      </Cabecalho>

      <div className="filtros">
        <div className="busca">
          <Icone nome="busca" />
          <input type="search" placeholder="Código, nome, marca ou modelo" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select value={categoriaId} onChange={(e) => filtro('categoriaId', e.target.value)} aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <select value={tipoControle} onChange={(e) => filtro('tipoControle', e.target.value)} aria-label="Tipo de controle">
          <option value="">Serializados e materiais</option>
          <option value="serializado">Só serializados</option>
          <option value="quantidade">Só por quantidade</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={abaixoMinimo} onChange={(e) => filtro('abaixoMinimo', e.target.checked ? 'true' : '')} />
          Abaixo do mínimo
        </label>
      </div>

      <div className="cartao sem-padding">
        {carregando ? (
          <Carregando />
        ) : produtos.length === 0 ? (
          <Vazio titulo="Nenhum produto encontrado" texto={busca || categoriaId || abaixoMinimo ? 'Ajuste os filtros.' : 'Cadastre o primeiro produto.'} />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Código</th>
                  <th className="col-produto">Produto</th>
                  <th>Categoria / local</th>
                  <th className="col-nivel">Nível do estoque</th>
                  <th className="num">Valor em estoque</th>
                  <th className="acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {produtos.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((p) => {
                  const abaixo = Number(p.quantidade) < Number(p.estoqueMinimo);
                  return (
                    <tr key={p.id} className={abaixo ? 'linha-alerta' : ''}>
                      <td data-rotulo="Código" className="mono">{p.codigo}</td>
                      <td data-rotulo="Produto" className="col-produto">
                        <strong>{p.nome}</strong>
                        <small className="texto-suave bloco">
                          {[p.marca, p.modelo].filter(Boolean).join(' ')}
                          {' · '}
                          {p.tipoControle === 'serializado' ? 'Serializado' : 'Por quantidade'}
                        </small>
                        {p.descricao && <small className="texto-suave bloco descricao-curta" title={p.descricao}>{p.descricao}</small>}
                        {abaixo && <span className="tag-alerta">Abaixo do mínimo</span>}
                      </td>
                      <td data-rotulo="Categoria">{p.categoria?.nome}<small className="texto-suave bloco">{p.local ? `Local ${p.local}` : 'Sem local'}</small></td>
                      <td data-rotulo="Nível"><NivelEstoque quantidade={p.quantidade} minimo={p.estoqueMinimo} unidade={p.unidade} /></td>
                      <td data-rotulo="Valor" className="num nowrap">
                        {formatarMoeda(Number(p.quantidade) * Number(p.custoUnitario))}
                        <small className="texto-suave bloco">{formatarMoeda(p.custoUnitario)} / {p.unidade}</small>
                      </td>
                      <td className="acoes">
                        {p.tipoControle === 'serializado' && (
                          <Link to={`/equipamentos?produtoId=${p.id}`} className="botao botao-pequeno">Unidades</Link>
                        )}
                        <Link to={`/movimentacoes?produtoId=${p.id}`} className="botao botao-pequeno">Histórico</Link>
                        {podeMovimentar && (
                          <Link to={`/movimentacoes/nova?tipo=entrada_compra&produtoId=${p.id}`} className="botao botao-pequeno">Entrada</Link>
                        )}
                        {podeEditar && <button type="button" className="botao botao-pequeno" onClick={() => abrir(p)}>Editar</button>}
                        {podeExcluir && <button type="button" className="botao botao-pequeno botao-perigo" onClick={() => inativar(p)}>Inativar</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!carregando && produtos.length > POR_PAGINA && (
        <Paginacao pagina={pagina} paginas={Math.ceil(produtos.length / POR_PAGINA)} total={produtos.length} aoMudar={setPagina} />
      )}

      <Modal titulo={editando?.id ? 'Editar produto' : 'Novo produto'} aberto={!!editando} aoFechar={() => setEditando(null)} largura={680}>
        <form onSubmit={salvar} className="formulario grade-form">
          <Campo rotulo="Código (SKU)" obrigatorio>
            <input value={form.codigo} onChange={set('codigo')} required maxLength={40} placeholder="Ex.: ONU-HW-EG8145" />
          </Campo>
          <Campo rotulo="Categoria" obrigatorio>
            <select value={form.categoriaId} onChange={set('categoriaId')} required>
              <option value="">Selecione…</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Nome" obrigatorio className="largura-total">
            <input value={form.nome} onChange={set('nome')} required maxLength={150} />
          </Campo>
          <Campo rotulo="Descrição" className="largura-total" dica="Opcional: características, aplicação, observações de uso.">
            <textarea rows={2} value={form.descricao} onChange={set('descricao')} maxLength={2000} />
          </Campo>
          <Campo rotulo="Marca"><input value={form.marca} onChange={set('marca')} maxLength={80} /></Campo>
          <Campo rotulo="Modelo"><input value={form.modelo} onChange={set('modelo')} maxLength={80} /></Campo>
          <Campo rotulo="Tipo de controle" obrigatorio dica={travarTipo ? 'Não pode ser alterado depois de haver movimentações.' : 'Serializado: cada unidade tem nº de série/MAC.'}>
            <select value={form.tipoControle} onChange={set('tipoControle')}>
              <option value="quantidade">Por quantidade (material de consumo)</option>
              <option value="serializado">Serializado (nº de série / MAC)</option>
            </select>
          </Campo>
          <Campo rotulo="Unidade" obrigatorio>
            <select value={form.tipoControle === 'serializado' ? 'un' : form.unidade} onChange={set('unidade')} disabled={form.tipoControle === 'serializado'}>
              {Object.entries(UNIDADES).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Local (prateleira)"><input value={form.local} onChange={set('local')} maxLength={60} placeholder="Ex.: A1-02" /></Campo>
          <Campo rotulo="Estoque mínimo">
            <input type="number" min="0" step="any" inputMode="decimal" value={form.estoqueMinimo} onChange={set('estoqueMinimo')} />
          </Campo>
          <Campo rotulo="Custo unitário (R$)">
            <input type="number" min="0" step="0.01" inputMode="decimal" value={form.custoUnitario} onChange={set('custoUnitario')} />
          </Campo>
          {!editando?.id && (
            <p className="texto-suave largura-total nota">O saldo começa em zero. Use <strong>Nova movimentação → Entrada (compra)</strong> para lançar as quantidades ou números de série.</p>
          )}
          <div className="formulario-acoes largura-total">
            <button type="button" className="botao" onClick={() => setEditando(null)}>Cancelar</button>
            <button type="submit" className="botao botao-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

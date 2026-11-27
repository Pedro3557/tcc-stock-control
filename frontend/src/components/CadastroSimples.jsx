import { useCallback, useEffect, useState } from 'react';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Cabecalho from './Cabecalho.jsx';
import Carregando from './Carregando.jsx';
import Vazio from './Vazio.jsx';
import Modal from './Modal.jsx';
import Campo from './Campo.jsx';
import Icone from './Icone.jsx';
import RegrasSenha, { senhaForte } from './RegrasSenha.jsx';

/**
 * Tela genérica de cadastro (lista + formulário em modal).
 * campos: [{ nome, rotulo, tipo, obrigatorio, opcoes, dica }]
 * colunas: [{ titulo, valor: (item) => ReactNode }]
 */
export default function CadastroSimples({
  titulo,
  subtitulo,
  endpoint,
  nomeSingular,
  campos,
  colunas,
  textoExcluir = 'excluir',
  podeCriar,
  podeEditar,
  podeExcluir,
  acoesExtras,
  filtroBusca = true,
}) {
  const auth = useAuth();
  const toast = useToast();
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  const criar = podeCriar ?? auth.podeEditar;
  const editar = podeEditar ?? auth.podeEditar;
  const excluir = podeExcluir ?? auth.podeExcluir;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const { data } = await api.get(endpoint, { params: busca && filtroBusca ? { busca } : {} });
      setItens(data);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }, [endpoint, busca, filtroBusca, toast]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  function abrir(item) {
    const inicial = {};
    campos.forEach((c) => {
      inicial[c.nome] = item ? item[c.nome] ?? (c.tipo === 'checkbox' ? false : '') : c.padrao ?? (c.tipo === 'checkbox' ? true : '');
    });
    setForm(inicial);
    setEditando(item || {});
  }

  async function salvar(e) {
    e.preventDefault();
    const fraca = campos.find((c) => c.regrasSenha && form[c.nome] && !senhaForte(form[c.nome]));
    if (fraca) {
      toast.erro('A senha ainda não atende a todos os requisitos (em vermelho).');
      return;
    }
    setSalvando(true);
    try {
      const dados = { ...form };
      campos.forEach((c) => {
        if (c.somenteCriacao && editando.id) delete dados[c.nome];
        if (c.tipo === 'password' && editando.id && !dados[c.nome]) delete dados[c.nome];
      });
      if (editando.id) await api.put(`${endpoint}/${editando.id}`, dados);
      else await api.post(endpoint, dados);
      toast.sucesso(`${nomeSingular} ${editando.id ? 'atualizado(a)' : 'cadastrado(a)'} com sucesso.`);
      setEditando(null);
      carregar();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  async function remover(item) {
    if (!window.confirm(`Deseja ${textoExcluir} "${item.nome}"?`)) return;
    try {
      await api.delete(`${endpoint}/${item.id}`);
      toast.sucesso(`${nomeSingular} removido(a).`);
      carregar();
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    }
  }

  return (
    <>
      <Cabecalho titulo={titulo} subtitulo={subtitulo}>
        {criar && (
          <button type="button" className="botao botao-primario" onClick={() => abrir(null)}>
            <Icone nome="mais" tamanho={16} /> Novo(a) {nomeSingular.toLowerCase()}
          </button>
        )}
      </Cabecalho>

      {filtroBusca && (
        <div className="filtros">
          <div className="busca">
            <Icone nome="busca" />
            <input type="search" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
      )}

      <div className="cartao sem-padding">
        {carregando ? (
          <Carregando />
        ) : itens.length === 0 ? (
          <Vazio titulo="Nenhum registro encontrado" texto={busca ? 'Tente outra busca.' : `Cadastre o primeiro registro de ${titulo.toLowerCase()}.`} />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  {colunas.map((c) => (
                    <th key={c.titulo} className={c.className}>{c.titulo}</th>
                  ))}
                  {(editar || excluir || acoesExtras) && <th className="acoes">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className={item.ativo === false ? 'linha-inativa' : ''}>
                    {colunas.map((c) => (
                      <td key={c.titulo} data-rotulo={c.titulo} className={c.className}>{c.valor(item)}</td>
                    ))}
                    {(editar || excluir || acoesExtras) && (
                      <td className="acoes">
                        {acoesExtras?.(item)}
                        {editar && (
                          <button type="button" className="botao botao-pequeno" onClick={() => abrir(item)}>
                            Editar
                          </button>
                        )}
                        {excluir && item.ativo !== false && (
                          <button type="button" className="botao botao-pequeno botao-perigo" onClick={() => remover(item)}>
                            {textoExcluir === 'excluir' ? 'Excluir' : 'Inativar'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal titulo={editando?.id ? `Editar ${nomeSingular.toLowerCase()}` : `Novo(a) ${nomeSingular.toLowerCase()}`} aberto={!!editando} aoFechar={() => setEditando(null)}>
        <form onSubmit={salvar} className="formulario">
          {campos
            .filter((c) => !(c.somenteEdicao && !editando?.id))
            .map((c) => (
              <Campo key={c.nome} rotulo={c.rotulo} obrigatorio={c.obrigatorio && !(c.tipo === 'password' && editando?.id)} dica={c.tipo === 'password' && editando?.id ? 'Deixe em branco para manter a senha atual.' : c.dica} className={c.tipo === 'checkbox' ? 'campo-checkbox' : ''}>
                {c.tipo === 'select' ? (
                  <select value={form[c.nome] ?? ''} required={c.obrigatorio} onChange={(e) => setForm({ ...form, [c.nome]: e.target.value })}>
                    {Object.entries(c.opcoes).map(([valor, rotulo]) => (
                      <option key={valor} value={valor}>{rotulo}</option>
                    ))}
                  </select>
                ) : c.tipo === 'checkbox' ? (
                  <input type="checkbox" checked={!!form[c.nome]} onChange={(e) => setForm({ ...form, [c.nome]: e.target.checked })} />
                ) : (
                  <input
                    type={c.tipo || 'text'}
                    value={form[c.nome] ?? ''}
                    required={c.obrigatorio && !(c.tipo === 'password' && editando?.id)}
                    placeholder={c.placeholder}
                    autoComplete={c.tipo === 'password' ? 'new-password' : 'off'}
                    onChange={(e) => setForm({ ...form, [c.nome]: e.target.value })}
                  />
                )}
                {c.regrasSenha && (!editando?.id || form[c.nome]) && <RegrasSenha senha={form[c.nome] || ''} />}
              </Campo>
            ))}
          <div className="formulario-acoes">
            <button type="button" className="botao" onClick={() => setEditando(null)}>Cancelar</button>
            <button type="submit" className="botao botao-primario" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, baixarArquivo, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatarQtd } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';
import Icone from '../components/Icone.jsx';

const ABAS = {
  produtos: {
    rotulo: 'Cadastro de produtos',
    descricao: 'Cria produtos novos e atualiza os existentes (pelo código). O saldo não muda.',
  },
  entrada: {
    rotulo: 'Entrada de compra',
    descricao: 'Lança quantidades de material e números de série/MAC de equipamentos recebidos de um fornecedor.',
  },
};

function Resultado({ aba, resultado }) {
  const temErros = resultado.erros.length > 0;
  return (
    <section className={`cartao resultado-importacao ${temErros ? 'resultado-erro' : ''}`}>
      {temErros ? (
        <>
          <h2>Corrija a planilha: {resultado.erros.length} problema(s)</h2>
          <p className="texto-suave">Nada foi gravado. Ajuste as linhas abaixo e envie o arquivo de novo.</p>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Linha</th><th>Problema</th></tr></thead>
              <tbody>
                {resultado.erros.map((e, i) => (
                  <tr key={i}>
                    <td data-rotulo="Linha" className="nowrap">{e.linha}</td>
                    <td data-rotulo="Problema">{e.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <h2>{resultado.gravado ? '✓ Importação concluída' : 'Prévia: tudo certo para importar'}</h2>
          {aba === 'produtos' ? (
            <>
              <p className="texto-suave">
                {resultado.criados.length} produto(s) {resultado.gravado ? 'criado(s)' : 'a criar'} ·{' '}
                {resultado.atualizados.length} {resultado.gravado ? 'atualizado(s)' : 'a atualizar'}
                {resultado.categoriasCriadas.length > 0 && ` · nova(s) categoria(s): ${resultado.categoriasCriadas.join(', ')}`}
              </p>
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr><th>Linha</th><th>Código</th><th>Produto</th><th>Ação</th></tr></thead>
                  <tbody>
                    {[...resultado.criados.map((p) => ({ ...p, acao: 'Novo' })), ...resultado.atualizados.map((p) => ({ ...p, acao: 'Atualizar' }))]
                      .sort((a, b) => a.linha - b.linha)
                      .map((p) => (
                        <tr key={p.linha}>
                          <td data-rotulo="Linha">{p.linha}</td>
                          <td data-rotulo="Código" className="mono">{p.codigo}</td>
                          <td data-rotulo="Produto">{p.nome}</td>
                          <td data-rotulo="Ação">{p.acao}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead><tr><th>Código</th><th>Produto</th><th className="num">Entrada</th></tr></thead>
                <tbody>
                  {resultado.itens.map((i) => (
                    <tr key={i.codigo}>
                      <td data-rotulo="Código" className="mono">{i.codigo}</td>
                      <td data-rotulo="Produto">{i.nome}</td>
                      <td data-rotulo="Entrada" className="num">
                        {i.tipoControle === 'serializado' ? `${i.quantidade} unidade(s)` : formatarQtd(i.quantidade, i.unidade)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function Importar() {
  const toast = useToast();
  const [aba, setAba] = useState('entrada');
  const [arquivo, setArquivo] = useState(null);
  const [fornecedores, setFornecedores] = useState([]);
  const [form, setForm] = useState({ fornecedorId: '', notaFiscal: '', observacao: '' });
  const [resultado, setResultado] = useState(null);
  const [enviando, setEnviando] = useState('');
  const inputArquivo = useRef(null);

  useEffect(() => {
    api.get('/fornecedores').then(({ data }) => setFornecedores(data)).catch(() => {});
  }, []);

  function trocarAba(nova) {
    setAba(nova);
    limpar();
  }

  function limpar() {
    setArquivo(null);
    setResultado(null);
    if (inputArquivo.current) inputArquivo.current.value = '';
  }

  async function baixarModelo() {
    try {
      await baixarArquivo(`/importacao/modelo/${aba}`, undefined, `modelo-${aba}.xlsx`);
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  async function enviar(simular) {
    if (!arquivo) return toast.erro('Selecione a planilha (.xlsx).');
    if (aba === 'entrada' && (!form.fornecedorId || !form.notaFiscal.trim())) {
      return toast.erro('Informe o fornecedor e a nota fiscal.');
    }
    const dados = new FormData();
    dados.append('arquivo', arquivo);
    dados.append('simular', String(simular));
    if (aba === 'entrada') Object.entries(form).forEach(([k, v]) => dados.append(k, v));

    setEnviando(simular ? 'previa' : 'gravar');
    try {
      const { data } = await api.post(`/importacao/${aba}`, dados);
      setResultado(data);
      if (data.gravado) {
        toast.sucesso('Planilha importada com sucesso.');
        setArquivo(null);
        if (inputArquivo.current) inputArquivo.current.value = '';
      } else if (data.erros.length) {
        toast.erro(`A planilha tem ${data.erros.length} problema(s). Nada foi gravado.`);
      }
    } catch (e) {
      toast.erro(mensagemErro(e));
      setResultado(null);
    } finally {
      setEnviando('');
    }
    return undefined;
  }

  const previaOk = resultado && !resultado.gravado && resultado.simulado && resultado.erros.length === 0;

  return (
    <>
      <Cabecalho titulo="Importar planilha" subtitulo="Cadastre produtos ou dê entrada em lote a partir de um arquivo do Excel (.xlsx)" />

      <div className="segmentado segmentado-abas" role="tablist">
        {Object.entries(ABAS).map(([chave, a]) => (
          <button key={chave} type="button" role="tab" aria-selected={aba === chave} className={aba === chave ? 'ativo' : ''} onClick={() => trocarAba(chave)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      <section className="cartao passos">
        <p className="texto-suave">{ABAS[aba].descricao}</p>

        <div className="passo">
          <span className="passo-numero">1</span>
          <div>
            <strong>Baixe o modelo e preencha</strong>
            <p className="texto-suave">A aba “Instruções” do arquivo explica cada coluna. Apague as linhas de exemplo antes de importar.</p>
            <button type="button" className="botao botao-pequeno" onClick={baixarModelo}>
              <Icone nome="baixar" tamanho={15} /> Baixar modelo (.xlsx)
            </button>
          </div>
        </div>

        <div className="passo">
          <span className="passo-numero">2</span>
          <div className="passo-conteudo">
            <strong>Envie a planilha</strong>
            {aba === 'entrada' && (
              <div className="grade-form">
                <Campo rotulo="Fornecedor" obrigatorio>
                  <select value={form.fornecedorId} onChange={(e) => setForm({ ...form, fornecedorId: e.target.value })}>
                    <option value="">Selecione…</option>
                    {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                  </select>
                </Campo>
                <Campo rotulo="Nota fiscal" obrigatorio>
                  <input value={form.notaFiscal} onChange={(e) => setForm({ ...form, notaFiscal: e.target.value })} maxLength={60} inputMode="numeric" />
                </Campo>
                <Campo rotulo="Observação" className="largura-total">
                  <input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} maxLength={500} placeholder="Opcional" />
                </Campo>
              </div>
            )}
            <label className="arquivo">
              <Icone nome="subir" />
              <span>{arquivo ? arquivo.name : 'Escolher arquivo .xlsx'}</span>
              <input
                ref={inputArquivo}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => { setArquivo(e.target.files?.[0] || null); setResultado(null); }}
              />
            </label>
          </div>
        </div>

        <div className="passo">
          <span className="passo-numero">3</span>
          <div>
            <strong>Confira a prévia e confirme</strong>
            <p className="texto-suave">A prévia não grava nada. Se houver qualquer erro, nenhuma linha é importada.</p>
            <div className="formulario-acoes formulario-acoes-esquerda">
              <button type="button" className="botao" onClick={() => enviar(true)} disabled={!arquivo || Boolean(enviando)}>
                {enviando === 'previa' ? 'Conferindo…' : 'Ver prévia'}
              </button>
              <button type="button" className="botao botao-primario" onClick={() => enviar(false)} disabled={!previaOk || Boolean(enviando)}>
                {enviando === 'gravar' ? 'Importando…' : 'Confirmar importação'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {resultado && <Resultado aba={aba} resultado={resultado} />}
      {resultado?.gravado && (
        <p className="nota">
          <Link to={aba === 'produtos' ? '/produtos' : '/movimentacoes'} className="link-forte">
            {aba === 'produtos' ? 'Ver produtos' : 'Ver no histórico de movimentações'}
          </Link>
        </p>
      )}
    </>
  );
}

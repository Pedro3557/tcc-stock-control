import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS, formatarDataHora, formatarQtd } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import LeitorCodigo from '../components/LeitorCodigo.jsx';
import Icone from '../components/Icone.jsx';
import { SituacaoInventario } from './Inventarios.jsx';

const SITUACAO = {
  ok: 'Conferido',
  divergente: 'Divergente',
  nao_contado: 'Não contado',
  serializado: 'Por unidade',
  nao_encontrado: 'Não encontrado',
  localizacao_incorreta: 'Localização incorreta',
};
const ALERTA = ['divergente', 'nao_encontrado', 'localizacao_incorreta'];

function Situacao({ valor }) {
  return <span className={`badge ${ALERTA.includes(valor) ? 'badge-defeito' : valor === 'ok' ? 'badge-em_estoque' : ''}`}>{SITUACAO[valor]}</span>;
}

/** Campo de contagem de um material: grava ao sair do campo ou com Enter. */
function CampoContagem({ item, aoSalvar, desabilitado }) {
  const [valor, setValor] = useState(item.quantidadeContada ?? '');
  useEffect(() => setValor(item.quantidadeContada ?? ''), [item.quantidadeContada]);
  const salvar = () => {
    const atual = item.quantidadeContada ?? '';
    if (String(valor) !== String(atual)) aoSalvar(item.produtoId, valor);
  };
  return (
    <input
      type="number"
      min="0"
      step={item.produto.unidade === 'm' ? 'any' : '1'}
      inputMode="decimal"
      className="campo-contagem"
      value={valor}
      disabled={desabilitado}
      aria-label={`Quantidade contada de ${item.produto.nome}`}
      onChange={(e) => setValor(e.target.value)}
      onBlur={salvar}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), salvar())}
    />
  );
}

export default function InventarioDetalhe() {
  const { id } = useParams();
  const { podeMovimentar, ehAdmin, usuario } = useAuth();
  const toast = useToast();
  const [inv, setInv] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [decisoes, setDecisoes] = useState({});
  const [ultimaLeitura, setUltimaLeitura] = useState(null);

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get(`/inventarios/${id}`);
      setInv(data);
      // Pré-carrega as decisões já registradas
      const d = {};
      data.itens.filter((i) => i.situacao === 'divergente').forEach((i) => {
        d[`item-${i.id}`] = { tipo: 'item', id: i.id, acao: i.acao === 'pendente' ? 'ajustar' : i.acao, justificativa: i.justificativa || '' };
      });
      data.equipamentos.filter((e) => e.situacao !== 'ok').forEach((e) => {
        d[`equipamento-${e.id}`] = {
          tipo: 'equipamento',
          id: e.id,
          acao: e.acao === 'pendente' ? 'ajustar' : e.acao,
          statusAjuste: e.statusAjuste || (e.situacao === 'nao_encontrado' ? 'baixado' : 'em_estoque'),
          justificativa: e.justificativa || '',
        };
      });
      setDecisoes(d);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function acao(nome, fn, sucesso) {
    setOcupado(nome);
    try {
      const r = await fn();
      if (sucesso) toast.sucesso(typeof sucesso === 'function' ? sucesso(r) : sucesso);
      await carregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function contar(produtoId, quantidade) {
    try {
      await api.post(`/inventarios/${id}/contagens`, { produtoId, quantidade });
      await carregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  async function aoLer(valor) {
    try {
      const { data } = await api.post(`/inventarios/${id}/leituras`, { valor });
      setUltimaLeitura({ ...data, valor });
      if (data.resultado === 'conferido') toast.sucesso(`${data.equipamento.numeroSerie} conferido.`);
      else if (data.resultado === 'ja_conferido') toast.info(`${data.equipamento.numeroSerie} já tinha sido conferido.`);
      else toast.erro(data.mensagem || `${data.equipamento.numeroSerie}: localização incorreta.`);
      await carregar();
    } catch (e) {
      setUltimaLeitura({ erro: mensagemErro(e), valor });
      toast.erro(mensagemErro(e));
    }
  }

  async function exportarPDF() {
    setOcupado('pdf');
    try {
      const [{ data }, { relatorioTabela }] = await Promise.all([api.get(`/inventarios/${id}/relatorio`), import('../services/pdf.js')]);
      const r = data.resumo;
      relatorioTabela({
        meta: data,
        linhas: data.linhas,
        arquivo: `inventario-${id}`,
        resumoItens: [
          ['Produtos', r.produtos],
          ['Materiais divergentes', r.materiaisDivergentes],
          ['Equip. encontrados', `${r.equipamentosEncontrados}/${r.equipamentosEsperados}`],
          ['Não encontrados', r.naoEncontrados],
          ['Localização incorreta', r.localizacaoIncorreta],
        ],
        colunas: [
          { titulo: 'Tipo', valor: (l) => l.tipo },
          { titulo: 'Produto', valor: (l) => l.produto },
          { titulo: 'Nº de série', valor: (l) => l.numeroSerie || '-', mono: true },
          { titulo: 'No sistema', valor: (l) => l.sistema },
          { titulo: 'Encontrado', valor: (l) => l.encontrado || '-' },
          { titulo: 'Diferença', valor: (l) => l.diferenca || '-', direita: true },
          { titulo: 'Situação', valor: (l) => l.situacao },
          { titulo: 'Decisão', valor: (l) => l.acao },
          { titulo: 'Justificativa', valor: (l) => l.justificativa || '-', largura: 55 },
        ],
        destacar: (l, col) => l.divergente && col === 6,
      });
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function exportarCSV() {
    const { baixarArquivo } = await import('../services/api.js');
    baixarArquivo(`/inventarios/${id}/exportar`, undefined, `inventario-${id}.csv`).catch((e) => toast.erro(mensagemErro(e)));
  }

  if (erro) return <Vazio titulo="Inventário não encontrado" texto={erro}><Link to="/inventarios" className="botao">Voltar</Link></Vazio>;
  if (!inv) return <Carregando />;

  const r = inv.resumo;
  const emContagem = inv.situacao === 'em_contagem';
  const emRevisao = inv.situacao === 'em_revisao';
  const podeContar = podeMovimentar && emContagem;
  const materiais = inv.itens.filter((i) => i.produto.tipoControle === 'quantidade');
  const serializados = inv.itens.filter((i) => i.produto.tipoControle === 'serializado');
  const divergentes = [
    ...inv.itens.filter((i) => i.situacao === 'divergente').map((i) => ({ chave: `item-${i.id}`, tipo: 'item', linha: i })),
    ...inv.equipamentos.filter((e) => e.situacao !== 'ok').map((e) => ({ chave: `equipamento-${e.id}`, tipo: 'equipamento', linha: e })),
  ];
  const setDecisao = (chave, campo, valor) => setDecisoes((d) => ({ ...d, [chave]: { ...d[chave], [campo]: valor } }));

  return (
    <>
      <Link to="/inventarios" className="link-voltar"><Icone nome="voltar" tamanho={16} /> Inventários</Link>
      <Cabecalho
        titulo={`#${inv.id} · ${inv.descricao}`}
        subtitulo={`Aberto em ${formatarDataHora(inv.createdAt)} por ${inv.criador?.nome}${inv.escopo?.categorias?.length ? ` · Categorias: ${inv.escopo.categorias.map((c) => c.nome).join(', ')}` : ''}`}
      >
        <SituacaoInventario situacao={inv.situacao} />
        <button type="button" className="botao" onClick={exportarCSV}><Icone nome="baixar" tamanho={16} /> CSV</button>
        <button type="button" className="botao" onClick={exportarPDF} disabled={ocupado === 'pdf'}><Icone nome="pdf" tamanho={16} /> PDF</button>
      </Cabecalho>

      <div className="indicadores">
        <div className="indicador"><span>Materiais contados</span><strong>{r.materiaisContados}/{r.materiais}</strong></div>
        <div className="indicador"><span>Equipamentos encontrados</span><strong>{r.equipamentosEncontrados}/{r.equipamentosEsperados}</strong></div>
        {emContagem ? (
          <div className={`indicador ${r.localizacaoIncorreta ? 'indicador-alerta' : ''}`}>
            <span>Localização incorreta</span>
            <strong>{r.localizacaoIncorreta}</strong>
            <small>lidos aqui, mas no sistema estão em outro lugar</small>
          </div>
        ) : (
          <div className={`indicador ${r.divergencias ? 'indicador-alerta' : ''}`}>
            <span>Divergências</span>
            <strong>{r.divergencias}</strong>
            <small>{r.materiaisDivergentes} qtd. · {r.naoEncontrados} não encontr. · {r.localizacaoIncorreta} local incorreto</small>
          </div>
        )}
        <div className="indicador">
          <span>Situação</span>
          <strong className="indicador-texto">{emContagem ? 'Contando' : emRevisao ? `${r.decisoesPendentes} decisão(ões) pendente(s)` : inv.situacao === 'concluido' ? 'Ajustes aplicados' : 'Cancelado'}</strong>
          {inv.aprovador && <small>Aprovado por {inv.aprovador.nome} em {formatarDataHora(inv.aprovadoEm)}</small>}
        </div>
      </div>

      {podeMovimentar && (emContagem || emRevisao) && (
        <div className="barra-acoes">
          {emContagem && (
            <button
              type="button"
              className="botao botao-primario"
              disabled={!!ocupado}
              onClick={() => window.confirm('Encerrar a contagem e ir para a revisão das divergências?') && acao('finalizar', () => api.post(`/inventarios/${id}/finalizar`), 'Contagem encerrada. Revise as divergências.')}
            >
              Encerrar contagem
            </button>
          )}
          {emRevisao && (
            <button type="button" className="botao" disabled={!!ocupado} onClick={() => window.confirm('Voltar para a contagem? As decisões registradas serão descartadas.') && acao('reabrir', () => api.post(`/inventarios/${id}/reabrir`), 'Inventário reaberto para contagem.')}>
              Voltar para a contagem
            </button>
          )}
          {(ehAdmin || inv.criadoPor === usuario?.id) && (
            <button type="button" className="botao botao-perigo" disabled={!!ocupado} onClick={() => window.confirm('Cancelar este inventário? Nenhum ajuste será aplicado.') && acao('cancelar', () => api.post(`/inventarios/${id}/cancelar`), 'Inventário cancelado.')}>
              Cancelar inventário
            </button>
          )}
        </div>
      )}

      {emContagem && podeContar && serializados.length > 0 && (
        <section className="cartao inventario-leitor">
          <div>
            <h2 className="cartao-subtitulo">Conferir equipamentos</h2>
            <p className="texto-suave nota-topo">Leia o QR Code da etiqueta, o código de barras do fabricante ou digite o nº de série/MAC. Cada leitura marca a unidade como encontrada.</p>
            {ultimaLeitura && (
              <div className={`aviso ${ultimaLeitura.erro || ultimaLeitura.resultado === 'localizacao_incorreta' ? 'aviso-erro' : ''}`} role="status">
                {ultimaLeitura.erro
                  ? ultimaLeitura.erro
                  : `${ultimaLeitura.equipamento.numeroSerie} — ${ultimaLeitura.resultado === 'conferido' ? 'conferido' : ultimaLeitura.resultado === 'ja_conferido' ? 'já conferido antes' : ultimaLeitura.mensagem || 'localização incorreta'}`}
              </div>
            )}
          </div>
          <LeitorCodigo onLeitura={aoLer} autoFocoManual />
        </section>
      )}

      {materiais.length > 0 && (
        <>
          <h2 className="secao-titulo">Materiais (contagem manual)</h2>
          <div className="cartao sem-padding">
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Material</th>
                    <th>Local</th>
                    <th className="num">No sistema</th>
                    <th className="num">Contado</th>
                    <th className="num">Diferença</th>
                    <th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {materiais.map((i) => (
                    <tr key={i.id} className={i.situacao === 'divergente' ? 'linha-alerta' : ''}>
                      <td data-rotulo="Código" className="mono">{i.produto.codigo}</td>
                      <td data-rotulo="Material">{i.produto.nome}</td>
                      <td data-rotulo="Local">{i.produto.local || '—'}</td>
                      <td data-rotulo="No sistema" className="num">{emContagem && !ehAdmin ? <span className="texto-suave" title="Contagem às cegas">—</span> : formatarQtd(i.quantidadeSistema, i.produto.unidade)}</td>
                      <td data-rotulo="Contado" className="num">
                        {podeContar ? <CampoContagem item={i} aoSalvar={contar} /> : i.quantidadeContada === null ? '—' : formatarQtd(i.quantidadeContada, i.produto.unidade)}
                      </td>
                      <td data-rotulo="Diferença" className="num">{i.situacao === 'divergente' && !(emContagem && !ehAdmin) ? `${i.diferenca > 0 ? '+' : ''}${formatarQtd(i.diferenca)}` : '—'}</td>
                      <td data-rotulo="Situação">{emContagem && !ehAdmin && i.situacao !== 'nao_contado' ? <span className="badge">Contado</span> : <Situacao valor={i.situacao} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {emContagem && !ehAdmin && <p className="texto-suave nota">Contagem às cegas: o saldo do sistema aparece só depois de encerrar a contagem.</p>}
        </>
      )}

      {inv.equipamentos.length > 0 && (
        <>
          <h2 className="secao-titulo">Equipamentos (conferência por unidade)</h2>
          <div className="cartao sem-padding">
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Nº de série</th>
                    <th>Produto</th>
                    <th>Status no sistema</th>
                    <th>Conferência</th>
                    <th>Lido por</th>
                    {podeContar && <th className="acoes">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {inv.equipamentos.map((e) => (
                    <tr key={e.id} className={!emContagem && e.situacao !== 'ok' ? 'linha-alerta' : ''}>
                      <td data-rotulo="Nº de série"><Link to={`/equipamentos/${e.equipamento.id}`} className="link-forte mono">{e.equipamento.numeroSerie}</Link></td>
                      <td data-rotulo="Produto">{e.equipamento.produto?.nome}</td>
                      <td data-rotulo="No sistema"><StatusBadge status={e.statusSistema} /></td>
                      <td data-rotulo="Conferência">
                        {e.encontrado ? (e.esperado ? <span className="badge badge-em_estoque">Encontrado</span> : <Situacao valor="localizacao_incorreta" />) : emContagem ? <span className="badge">Aguardando leitura</span> : <Situacao valor="nao_encontrado" />}
                      </td>
                      <td data-rotulo="Lido por">{e.leitor ? <>{e.leitor.nome}<small className="texto-suave bloco">{formatarDataHora(e.lidoEm)}</small></> : '—'}</td>
                      {podeContar && (
                        <td className="acoes">
                          {e.encontrado && (
                            <button type="button" className="botao botao-pequeno" onClick={() => acao('desfazer', () => api.delete(`/inventarios/${id}/leituras/${e.id}`))}>
                              Desfazer leitura
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!emContagem && divergentes.length > 0 && (
        <>
          <h2 className="secao-titulo">Divergências e ajustes</h2>
          {emRevisao && (
            <p className="texto-suave nota-topo">
              Para cada divergência escolha <strong>Ajustar</strong> (o estoque passa a refletir o que foi encontrado) ou <strong>Manter</strong>, sempre com justificativa.
              Os ajustes só são aplicados quando um administrador aprovar.
            </p>
          )}
          <div className="divergencias">
            {divergentes.map(({ chave, tipo, linha }) => {
              const d = decisoes[chave] || {};
              const editavel = emRevisao && podeMovimentar;
              return (
                <div key={chave} className="cartao divergencia">
                  <div className="divergencia-titulo">
                    {tipo === 'item' ? (
                      <>
                        <strong>{linha.produto.nome}</strong>
                        <span>Sistema {formatarQtd(linha.quantidadeSistema, linha.produto.unidade)} · contado {formatarQtd(linha.quantidadeContada, linha.produto.unidade)} ({linha.diferenca > 0 ? '+' : ''}{formatarQtd(linha.diferenca)})</span>
                      </>
                    ) : (
                      <>
                        <strong className="mono">{linha.equipamento.numeroSerie}</strong>
                        <span>{linha.equipamento.produto?.nome} · <Situacao valor={linha.situacao} /> · no sistema: {STATUS[linha.statusSistema]}</span>
                      </>
                    )}
                  </div>
                  {editavel ? (
                    <div className="divergencia-campos">
                      <label className="campo">
                        <span className="campo-rotulo">Decisão</span>
                        <select value={d.acao} onChange={(e) => setDecisao(chave, 'acao', e.target.value)}>
                          <option value="ajustar">Ajustar o estoque</option>
                          <option value="manter">Manter como está</option>
                        </select>
                      </label>
                      {tipo === 'equipamento' && d.acao === 'ajustar' && (
                        <label className="campo">
                          <span className="campo-rotulo">Novo status</span>
                          <select value={d.statusAjuste} onChange={(e) => setDecisao(chave, 'statusAjuste', e.target.value)}>
                            {['em_estoque', 'em_manutencao', 'defeito', 'baixado'].filter((s) => s !== linha.statusSistema).map((s) => (
                              <option key={s} value={s}>{STATUS[s]}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label className="campo divergencia-justificativa">
                        <span className="campo-rotulo">Justificativa <span className="obrigatorio">*</span></span>
                        <input value={d.justificativa} onChange={(e) => setDecisao(chave, 'justificativa', e.target.value)} maxLength={500} placeholder="Ex.: recontado duas vezes; extravio na obra X" />
                      </label>
                    </div>
                  ) : (
                    <p className="texto-suave">
                      Decisão: <strong>{linha.acao === 'ajustar' ? (tipo === 'equipamento' ? `ajustar para "${STATUS[linha.statusAjuste]}"` : 'ajustar') : linha.acao === 'manter' ? 'manter' : 'pendente'}</strong>
                      {linha.justificativa && ` — ${linha.justificativa}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {emRevisao && podeMovimentar && (
            <div className="barra-acoes">
              <button
                type="button"
                className="botao"
                disabled={!!ocupado}
                onClick={() => acao('decisoes', () => api.put(`/inventarios/${id}/decisoes`, { decisoes: Object.values(decisoes) }), 'Decisões e justificativas salvas.')}
              >
                Salvar decisões
              </button>
              {ehAdmin && (
                <button
                  type="button"
                  className="botao botao-primario"
                  disabled={!!ocupado || r.decisoesPendentes > 0}
                  title={r.decisoesPendentes > 0 ? 'Salve as decisões de todas as divergências antes de aprovar' : undefined}
                  onClick={() =>
                    window.confirm('Aprovar e aplicar os ajustes ao estoque? Esta ação gera movimentações de ajuste de inventário.') &&
                    acao('aprovar', () => api.post(`/inventarios/${id}/aprovar`), (res) => res.data.mensagem)
                  }
                >
                  Aprovar e aplicar ajustes
                </button>
              )}
              {!ehAdmin && <span className="texto-suave">Depois de salvar, um administrador aprova os ajustes.</span>}
            </div>
          )}
        </>
      )}
      {emRevisao && divergentes.length === 0 && ehAdmin && (
        <div className="barra-acoes">
          <span className="texto-suave">Nenhuma divergência encontrada.</span>
          <button type="button" className="botao botao-primario" disabled={!!ocupado} onClick={() => acao('aprovar', () => api.post(`/inventarios/${id}/aprovar`), 'Inventário concluído sem ajustes.')}>
            Concluir inventário
          </button>
        </div>
      )}
    </>
  );
}

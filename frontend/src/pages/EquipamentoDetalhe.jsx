import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { TIPOS, formatarDataHora, formatarMoeda } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import Campo from '../components/Campo.jsx';
import Icone from '../components/Icone.jsx';
import { obterOrganizacao } from '../services/organizacao.js';

/** QR Code da etiqueta (gerado no navegador; o QR só contém o endereço de consulta). */
function QRCodeEtiqueta({ equipamento }) {
  const [imagem, setImagem] = useState('');
  const [endereco, setEndereco] = useState('');
  const [gerando, setGerando] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let ativo = true;
    Promise.all([import('../services/etiquetas.js'), obterOrganizacao().catch(() => null)]).then(async ([m, org]) => {
      const texto = m.conteudoQR(equipamento.codigoEtiqueta, org?.urlPublica);
      const url = await m.qrDataURL(texto, 320);
      if (ativo) {
        setEndereco(texto);
        setImagem(url);
      }
    });
    return () => {
      ativo = false;
    };
  }, [equipamento.codigoEtiqueta]);

  async function imprimir(formato) {
    setGerando(true);
    try {
      const { gerarPDFEtiquetas } = await import('../services/etiquetas.js');
      await gerarPDFEtiquetas([equipamento], { formato });
    } catch (e) {
      toast.erro(`Não foi possível gerar a etiqueta: ${e.message}`);
    } finally {
      setGerando(false);
    }
  }

  return (
    <section className="cartao qr-cartao">
      <h2 className="cartao-subtitulo">Etiqueta com QR Code</h2>
      <div className="qr-conteudo">
        {imagem ? <img src={imagem} alt={`QR Code do equipamento ${equipamento.numeroSerie}`} width="140" height="140" /> : <div className="qr-vazio" />}
        <div>
          <p className="texto-suave">Código permanente</p>
          <p className="mono qr-codigo">{equipamento.codigoEtiqueta}</p>
          <p className="texto-suave qr-endereco" title={endereco}>{endereco}</p>
          <div className="acoes-rapidas">
            <button type="button" className="botao botao-pequeno" onClick={() => imprimir('termica-50x30')} disabled={gerando}>
              <Icone nome="etiqueta" tamanho={14} /> Etiqueta 50×30
            </button>
            <button type="button" className="botao botao-pequeno" onClick={() => imprimir('a4-3x7')} disabled={gerando}>
              <Icone nome="pdf" tamanho={14} /> Folha A4
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Ações possíveis a partir do status atual da unidade. */
const ACOES = {
  em_estoque: ['saida_tecnico', 'instalacao_cliente', 'envio_manutencao', 'baixa'],
  com_tecnico: ['instalacao_cliente', 'devolucao_tecnico', 'baixa'],
  instalado_cliente: ['retirada_cliente'],
  em_manutencao: ['retorno_manutencao', 'baixa'],
  defeito: ['envio_manutencao', 'baixa'],
  baixado: [],
};

export default function EquipamentoDetalhe() {
  const { id } = useParams();
  const { podeMovimentar, podeEditar } = useAuth();
  const toast = useToast();
  const [eq, setEq] = useState(null);
  const [erro, setErro] = useState('');
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({ mac: '', observacao: '' });

  const carregar = useCallback(() => {
    api.get(`/equipamentos/${id}`).then(({ data }) => setEq(data)).catch((e) => setErro(mensagemErro(e)));
  }, [id]);

  useEffect(carregar, [carregar]);

  async function salvar(e) {
    e.preventDefault();
    try {
      await api.put(`/equipamentos/${id}`, { mac: form.mac || null, observacao: form.observacao || null });
      toast.sucesso('Dados do equipamento atualizados.');
      setEditando(false);
      carregar();
    } catch (falha) {
      toast.erro(mensagemErro(falha));
    }
  }

  if (erro) return <Vazio titulo="Equipamento não encontrado" texto={erro}><Link to="/equipamentos" className="botao">Voltar</Link></Vazio>;
  if (!eq) return <Carregando />;

  const acoes = ACOES[eq.status] || [];

  return (
    <>
      <Link to="/equipamentos" className="link-voltar"><Icone nome="voltar" tamanho={16} /> Equipamentos</Link>
      <Cabecalho titulo={eq.numeroSerie} subtitulo={`${eq.produto?.nome} · ${[eq.produto?.marca, eq.produto?.modelo].filter(Boolean).join(' ')}`}>
        {podeEditar && (
          <button type="button" className="botao" onClick={() => { setForm({ mac: eq.mac || '', observacao: eq.observacao || '' }); setEditando(true); }}>
            Editar dados
          </button>
        )}
      </Cabecalho>

      <div className="grade-2">
        <section className="cartao">
          <dl className="detalhes">
            <div><dt>Status</dt><dd><StatusBadge status={eq.status} /></dd></div>
            <div><dt>MAC</dt><dd className="mono">{eq.mac || '—'}</dd></div>
            <div><dt>Produto</dt><dd>{eq.produto?.codigo} · {eq.produto?.categoria?.nome}</dd></div>
            <div><dt>Custo</dt><dd>{formatarMoeda(eq.produto?.custoUnitario)}</dd></div>
            {eq.status === 'com_tecnico' && (
              <div><dt>Técnico</dt><dd><Link to={`/tecnicos/${eq.tecnico?.id}`} className="link-forte">{eq.tecnico?.nome}</Link></dd></div>
            )}
            {eq.status === 'instalado_cliente' && (
              <div><dt>Cliente (comodato)</dt><dd>{eq.clienteCodigo}{eq.clienteNome ? ` · ${eq.clienteNome}` : ''}</dd></div>
            )}
            <div className="largura-total"><dt>Observação</dt><dd>{eq.observacao || '—'}</dd></div>
          </dl>
        </section>

        {podeMovimentar && (
          <section className="cartao">
            <h2 className="cartao-subtitulo">Movimentar esta unidade</h2>
            {acoes.length === 0 ? (
              <p className="texto-suave">Unidade baixada: nenhuma movimentação disponível (somente ajuste de inventário pelo administrador).</p>
            ) : (
              <div className="acoes-rapidas">
                {acoes.map((tipo) => (
                  <Link key={tipo} to={`/movimentacoes/nova?tipo=${tipo}&seriais=${encodeURIComponent(eq.numeroSerie)}`} className={`botao ${tipo === 'baixa' ? 'botao-perigo' : ''}`}>
                    {TIPOS[tipo]}
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <QRCodeEtiqueta equipamento={eq} />

      <div className="cabecalho-secao">
        <h2 className="secao-titulo">Histórico da unidade</h2>
        <Link to={`/movimentacoes?equipamentoId=${eq.id}`} className="link-suave">Ver no histórico geral</Link>
      </div>
      <div className="cartao">
        {eq.historico.length === 0 ? (
          <Vazio titulo="Sem histórico" />
        ) : (
          <ol className="linha-tempo">
            {eq.historico.map((m) => (
              <li key={m.id}>
                <div className="linha-tempo-cabecalho">
                  <strong>{TIPOS[m.tipo]}</strong>
                  <small className="texto-suave">{formatarDataHora(m.createdAt)} · {m.usuario?.nome}</small>
                </div>
                <div className="linha-tempo-corpo">
                  {m.statusAnterior && <><StatusBadge status={m.statusAnterior} /> → </>}
                  {m.statusNovo && <StatusBadge status={m.statusNovo} />}
                </div>
                <small className="linha-tempo-info">
                  {[
                    m.tecnico && `Técnico: ${m.tecnico.nome}`,
                    m.clienteCodigo && `Cliente: ${m.clienteCodigo}`,
                    m.numeroOS && `OS: ${m.numeroOS}`,
                    m.fornecedor && `Fornecedor: ${m.fornecedor.nome}`,
                    m.notaFiscal && `NF: ${m.notaFiscal}`,
                  ].filter(Boolean).join(' · ')}
                </small>
                {m.observacao && <p className="linha-tempo-obs">{m.observacao}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <Modal titulo="Editar equipamento" aberto={editando} aoFechar={() => setEditando(false)}>
        <form className="formulario" onSubmit={salvar}>
          <Campo rotulo="MAC" dica="Formato AA:BB:CC:DD:EE:FF (aceita também sem separadores).">
            <input value={form.mac} onChange={(e) => setForm({ ...form, mac: e.target.value })} className="mono" />
          </Campo>
          <Campo rotulo="Observação">
            <textarea rows={3} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </Campo>
          <p className="texto-suave nota">O status só muda por meio de uma movimentação.</p>
          <div className="formulario-acoes">
            <button type="button" className="botao" onClick={() => setEditando(false)}>Cancelar</button>
            <button type="submit" className="botao botao-primario">Salvar</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

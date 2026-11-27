import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS, TIPOS, formatarQtd } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';

/**
 * Configuração de cada tipo de movimentação:
 * modos: 'serial' (equipamentos por nº de série) e/ou 'qtd' (material por quantidade)
 */
const CONFIG = {
  entrada_compra: { modos: ['serial', 'qtd'], descricao: 'Compra recebida de fornecedor, com nota fiscal.' },
  saida_tecnico: { modos: ['serial', 'qtd'], descricao: 'Material ou equipamento entregue a um técnico.' },
  devolucao_tecnico: { modos: ['serial', 'qtd'], descricao: 'Técnico devolve o que não usou.' },
  instalacao_cliente: { modos: ['serial'], descricao: 'Equipamento instalado no cliente em comodato.' },
  retirada_cliente: { modos: ['serial'], descricao: 'Equipamento recolhido do cliente (cancelamento ou troca).' },
  envio_manutencao: { modos: ['serial'], descricao: 'Equipamento enviado para assistência / conserto.' },
  retorno_manutencao: { modos: ['serial'], descricao: 'Equipamento volta da manutenção.' },
  baixa: { modos: ['serial', 'qtd'], descricao: 'Perda, defeito sem conserto ou consumo. Motivo obrigatório.' },
  ajuste_inventario: { modos: ['serial', 'qtd'], descricao: 'Correção após contagem física (somente administrador).', admin: true },
};

const DESTINOS = {
  retirada_cliente: ['em_estoque', 'em_manutencao', 'defeito'],
  retorno_manutencao: ['em_estoque', 'defeito'],
  ajuste_inventario: ['em_estoque', 'em_manutencao', 'defeito', 'baixado'],
};

const FORM_INICIAL = {
  produtoId: '', tecnicoId: '', fornecedorId: '', quantidade: '', novaQuantidade: '', custoUnitario: '',
  seriais: '', clienteCodigo: '', clienteNome: '', numeroOS: '', notaFiscal: '', observacao: '', destino: '', origemBaixa: 'estoque',
};

function contarLinhas(texto) {
  return texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length;
}

export default function NovaMovimentacao() {
  const { ehAdmin } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const tipoInicial = CONFIG[params.get('tipo')] ? params.get('tipo') : 'saida_tecnico';

  const [tipo, setTipo] = useState(tipoInicial);
  const [modo, setModo] = useState(params.get('seriais') ? 'serial' : 'qtd');
  const [form, setForm] = useState({
    ...FORM_INICIAL,
    produtoId: params.get('produtoId') || '',
    tecnicoId: params.get('tecnicoId') || '',
    seriais: params.get('seriais') || '',
  });
  const [produtos, setProdutos] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [estoqueTecnico, setEstoqueTecnico] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [ultimo, setUltimo] = useState(null);
  const [leitura, setLeitura] = useState('');
  const leituraRef = useRef(null);

  useEffect(() => {
    Promise.all([api.get('/produtos'), api.get('/tecnicos'), api.get('/fornecedores')])
      .then(([p, t, f]) => {
        setProdutos(p.data);
        setTecnicos(t.data);
        setFornecedores(f.data);
      })
      .catch((e) => toast.erro(mensagemErro(e)));
  }, [toast]);

  const config = CONFIG[tipo];
  const produto = produtos.find((p) => String(p.id) === String(form.produtoId));

  // Na entrada o modo vem do produto escolhido; nos tipos exclusivos de equipamento, sempre serial
  const modoEfetivo = tipo === 'entrada_compra'
    ? (produto?.tipoControle === 'serializado' ? 'serial' : 'qtd')
    : config.modos.length === 1 ? config.modos[0] : modo;

  // Saldo do técnico (para devolução e baixa de material em posse dele)
  const precisaSaldoTecnico = modoEfetivo === 'qtd' && form.tecnicoId && (tipo === 'devolucao_tecnico' || (tipo === 'baixa' && form.origemBaixa === 'tecnico'));
  useEffect(() => {
    if (!precisaSaldoTecnico) {
      setEstoqueTecnico(null);
      return;
    }
    api.get(`/tecnicos/${form.tecnicoId}/estoque`).then(({ data }) => setEstoqueTecnico(data)).catch(() => setEstoqueTecnico(null));
  }, [precisaSaldoTecnico, form.tecnicoId, ultimo]);

  const produtosDoModo = useMemo(() => {
    if (tipo === 'entrada_compra') return produtos;
    return produtos.filter((p) => p.tipoControle === 'quantidade');
  }, [produtos, tipo]);

  const saldoTecnicoProduto = estoqueTecnico?.materiais.find((m) => String(m.produtoId) === String(form.produtoId));

  const set = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  function trocarTipo(novo) {
    setTipo(novo);
    setUltimo(null);
    setForm((f) => ({ ...f, destino: '', quantidade: '', novaQuantidade: '' }));
    if (CONFIG[novo].modos.length === 1) setModo(CONFIG[novo].modos[0]);
  }

  function adicionarLeitura(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const valor = leitura.trim();
    if (!valor) return;
    setForm((f) => ({ ...f, seriais: f.seriais ? `${f.seriais.replace(/\s+$/, '')}\n${valor}` : valor }));
    setLeitura('');
  }

  async function enviar(e) {
    e.preventDefault();
    const corpo = {
      tipo,
      tecnicoId: mostraTecnico ? form.tecnicoId || undefined : undefined,
      numeroOS: form.numeroOS || undefined,
      observacao: form.observacao || undefined,
    };

    if (tipo === 'entrada_compra') {
      Object.assign(corpo, { produtoId: form.produtoId, fornecedorId: form.fornecedorId, notaFiscal: form.notaFiscal, custoUnitario: form.custoUnitario || undefined });
    }
    if (modoEfetivo === 'serial') {
      corpo.seriais = form.seriais;
      if (tipo === 'entrada_compra') corpo.produtoId = form.produtoId;
    } else {
      corpo.produtoId = form.produtoId;
      if (tipo === 'ajuste_inventario') corpo.novaQuantidade = form.novaQuantidade;
      else corpo.quantidade = String(form.quantidade).replace(',', '.');
    }
    if (tipo === 'instalacao_cliente') Object.assign(corpo, { clienteCodigo: form.clienteCodigo, clienteNome: form.clienteNome || undefined });
    if (tipo === 'retirada_cliente') corpo.clienteCodigo = form.clienteCodigo || undefined;
    if (DESTINOS[tipo] && modoEfetivo === 'serial') corpo.destino = form.destino || undefined;
    if (tipo === 'baixa' && modoEfetivo === 'qtd' && form.origemBaixa === 'estoque') delete corpo.tecnicoId;

    setEnviando(true);
    try {
      const { data } = await api.post('/movimentacoes', corpo);
      toast.sucesso(data.mensagem);
      setUltimo(data.movimentacoes);
      // Mantém tipo, técnico, fornecedor e NF para agilizar lançamentos em sequência
      setForm((f) => ({ ...FORM_INICIAL, tecnicoId: f.tecnicoId, fornecedorId: f.fornecedorId, notaFiscal: f.notaFiscal, origemBaixa: f.origemBaixa, produtoId: modoEfetivo === 'qtd' || tipo === 'entrada_compra' ? f.produtoId : '' }));
      const { data: lista } = await api.get('/produtos');
      setProdutos(lista);
    } catch (falha) {
      toast.erro(mensagemErro(falha));
    } finally {
      setEnviando(false);
    }
  }

  const tiposVisiveis = Object.keys(CONFIG).filter((t) => !CONFIG[t].admin || ehAdmin);
  const qtdSeriais = contarLinhas(form.seriais);
  const exigeTecnico = tipo === 'saida_tecnico' || (tipo === 'devolucao_tecnico' && modoEfetivo === 'qtd') || (tipo === 'baixa' && modoEfetivo === 'qtd' && form.origemBaixa === 'tecnico');
  const mostraTecnico = ['saida_tecnico', 'devolucao_tecnico', 'instalacao_cliente'].includes(tipo) || (tipo === 'baixa' && modoEfetivo === 'qtd' && form.origemBaixa === 'tecnico');

  return (
    <>
      <Cabecalho titulo="Nova movimentação" subtitulo={config.descricao} />

      <div className="tipos" role="radiogroup" aria-label="Tipo de movimentação">
        {tiposVisiveis.map((t) => (
          <button key={t} type="button" role="radio" aria-checked={tipo === t} className={`tipo ${tipo === t ? 'tipo-ativo' : ''}`} onClick={() => trocarTipo(t)}>
            {TIPOS[t]}
          </button>
        ))}
      </div>

      <form className="cartao formulario grade-form" onSubmit={enviar}>
        {config.modos.length > 1 && tipo !== 'entrada_compra' && (
          <div className="segmentado largura-total" role="radiogroup" aria-label="O que será movimentado">
            <button type="button" className={modoEfetivo === 'qtd' ? 'ativo' : ''} onClick={() => setModo('qtd')}>Material (quantidade)</button>
            <button type="button" className={modoEfetivo === 'serial' ? 'ativo' : ''} onClick={() => setModo('serial')}>Equipamentos (nº de série)</button>
          </div>
        )}

        {tipo === 'baixa' && modoEfetivo === 'qtd' && (
          <Campo rotulo="Origem da baixa" className="largura-total">
            <select value={form.origemBaixa} onChange={set('origemBaixa')}>
              <option value="estoque">Estoque central (almoxarifado)</option>
              <option value="tecnico">Material em posse de técnico (consumo em OS / perda em campo)</option>
            </select>
          </Campo>
        )}

        {mostraTecnico && (
          <Campo rotulo="Técnico" obrigatorio={exigeTecnico} dica={tipo === 'instalacao_cliente' ? 'Opcional: técnico que fez a instalação.' : tipo === 'devolucao_tecnico' && modoEfetivo === 'serial' ? 'Opcional: confere se o equipamento está com ele.' : undefined}>
            <select value={form.tecnicoId} onChange={set('tecnicoId')} required={exigeTecnico}>
              <option value="">Selecione…</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}{t.equipe ? ` (${t.equipe})` : ''}</option>)}
            </select>
          </Campo>
        )}

        {(tipo === 'entrada_compra' || modoEfetivo === 'qtd') && (
          <Campo rotulo="Produto" obrigatorio className={tipo === 'entrada_compra' ? 'largura-total' : ''}>
            <select value={form.produtoId} onChange={set('produtoId')} required>
              <option value="">Selecione…</option>
              {(precisaSaldoTecnico && estoqueTecnico
                ? produtosDoModo.filter((p) => estoqueTecnico.materiais.some((m) => m.produtoId === p.id))
                : produtosDoModo
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} — {p.nome} ({p.tipoControle === 'serializado' ? 'serializado' : `saldo ${formatarQtd(p.quantidade, p.unidade)}`})
                </option>
              ))}
            </select>
          </Campo>
        )}

        {tipo === 'entrada_compra' && (
          <>
            <Campo rotulo="Fornecedor" obrigatorio>
              <select value={form.fornecedorId} onChange={set('fornecedorId')} required>
                <option value="">Selecione…</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </Campo>
            <Campo rotulo="Nota fiscal" obrigatorio>
              <input value={form.notaFiscal} onChange={set('notaFiscal')} required maxLength={60} inputMode="numeric" />
            </Campo>
            <Campo rotulo="Custo unitário (R$)" dica="Opcional: atualiza o custo do produto.">
              <input type="number" min="0" step="0.01" inputMode="decimal" value={form.custoUnitario} onChange={set('custoUnitario')} placeholder={produto ? String(produto.custoUnitario) : ''} />
            </Campo>
          </>
        )}

        {modoEfetivo === 'qtd' && tipo !== 'ajuste_inventario' && (
          <Campo
            rotulo={`Quantidade${produto ? ` (${produto.unidade})` : ''}`}
            obrigatorio
            dica={
              precisaSaldoTecnico && produto
                ? `Em posse do técnico: ${formatarQtd(saldoTecnicoProduto?.quantidade || 0, produto.unidade)}`
                : produto && tipo !== 'entrada_compra'
                  ? `Disponível no estoque: ${formatarQtd(produto.quantidade, produto.unidade)}`
                  : undefined
            }
          >
            <input type="number" min="0" step={produto && produto.unidade !== 'm' ? '1' : 'any'} inputMode="decimal" value={form.quantidade} onChange={set('quantidade')} required />
          </Campo>
        )}

        {modoEfetivo === 'qtd' && tipo === 'ajuste_inventario' && (
          <Campo rotulo="Quantidade contada" obrigatorio dica={produto ? `Saldo atual no sistema: ${formatarQtd(produto.quantidade, produto.unidade)}` : undefined}>
            <input type="number" min="0" step="any" inputMode="decimal" value={form.novaQuantidade} onChange={set('novaQuantidade')} required />
          </Campo>
        )}

        {modoEfetivo === 'serial' && (
          <div className="largura-total campo">
            <span className="campo-rotulo">
              {tipo === 'entrada_compra' ? 'Números de série / MAC das unidades recebidas' : 'Números de série ou MAC'}
              <span className="obrigatorio"> *</span>
            </span>
            {tipo !== 'entrada_compra' && (
              <input
                ref={leituraRef}
                className="mono"
                value={leitura}
                onChange={(e) => setLeitura(e.target.value)}
                onKeyDown={adicionarLeitura}
                placeholder="Bipe ou digite e pressione Enter para adicionar"
                autoCapitalize="characters"
                enterKeyHint="next"
              />
            )}
            <textarea
              className="mono"
              rows={tipo === 'entrada_compra' ? 8 : 4}
              value={form.seriais}
              onChange={set('seriais')}
              required
              placeholder={tipo === 'entrada_compra' ? 'Um por linha. Exemplos:\nHWTC1A2B3C09;E0:24:7F:10:00:09\nHWTC1A2B3C10;E0247F10000A\nSFP20KM0004' : 'Um por linha (nº de série ou MAC)'}
            />
            <small className="campo-dica">
              {qtdSeriais} unidade(s){tipo === 'entrada_compra' ? ' · formato: SERIAL ou SERIAL;MAC (aceita também vírgula ou TAB — pode colar de planilha)' : ''}
            </small>
          </div>
        )}

        {DESTINOS[tipo] && modoEfetivo === 'serial' && (
          <Campo rotulo={tipo === 'ajuste_inventario' ? 'Novo status' : 'Destino do equipamento'} obrigatorio={tipo === 'ajuste_inventario'}>
            <select value={form.destino} onChange={set('destino')} required={tipo === 'ajuste_inventario'}>
              {tipo === 'ajuste_inventario' && <option value="">Selecione…</option>}
              {DESTINOS[tipo].map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
            </select>
          </Campo>
        )}

        {['instalacao_cliente', 'retirada_cliente'].includes(tipo) && (
          <Campo rotulo="Código do cliente" obrigatorio={tipo === 'instalacao_cliente'} dica={tipo === 'retirada_cliente' ? 'Opcional: confere se o equipamento está neste cliente.' : undefined}>
            <input value={form.clienteCodigo} onChange={set('clienteCodigo')} required={tipo === 'instalacao_cliente'} maxLength={40} />
          </Campo>
        )}
        {tipo === 'instalacao_cliente' && (
          <Campo rotulo="Nome do cliente">
            <input value={form.clienteNome} onChange={set('clienteNome')} maxLength={150} />
          </Campo>
        )}

        {!['entrada_compra', 'envio_manutencao', 'retorno_manutencao', 'ajuste_inventario'].includes(tipo) && (
          <Campo rotulo="Nº da OS" obrigatorio={tipo === 'instalacao_cliente'}>
            <input value={form.numeroOS} onChange={set('numeroOS')} required={tipo === 'instalacao_cliente'} maxLength={40} />
          </Campo>
        )}

        <Campo
          rotulo={tipo === 'baixa' ? 'Motivo da baixa' : tipo === 'ajuste_inventario' ? 'Motivo do ajuste' : tipo === 'envio_manutencao' ? 'Descrição do problema' : 'Observação'}
          obrigatorio={['baixa', 'ajuste_inventario', 'envio_manutencao'].includes(tipo)}
          className="largura-total"
        >
          <textarea rows={2} value={form.observacao} onChange={set('observacao')} required={['baixa', 'ajuste_inventario', 'envio_manutencao'].includes(tipo)} maxLength={2000} placeholder={tipo === 'envio_manutencao' ? 'Ex.: não liga, LOS aceso, reinicia sozinho…' : undefined} />
        </Campo>

        <div className="formulario-acoes largura-total">
          <Link to="/movimentacoes" className="botao">Ver histórico</Link>
          <button type="submit" className={`botao ${tipo === 'baixa' ? 'botao-perigo-cheio' : 'botao-primario'}`} disabled={enviando}>
            {enviando ? 'Registrando…' : `Registrar ${TIPOS[tipo].toLowerCase()}`}
          </button>
        </div>
      </form>

      {ultimo && (
        <div className="cartao confirmacao">
          <strong>✓ {ultimo.length === 1 ? 'Movimentação registrada' : `${ultimo.length} movimentações registradas`}</strong>
          <ul>
            {ultimo.slice(0, 10).map((m) => (
              <li key={m.id}>
                {m.produto?.nome}
                {m.equipamento ? (
                  <> · <Link to={`/equipamentos/${m.equipamentoId}`} className="link-forte mono">{m.equipamento.numeroSerie}</Link></>
                ) : (
                  ` · ${formatarQtd(m.quantidade, m.produto?.unidade)}`
                )}
                {m.statusNovo && ` → ${STATUS[m.statusNovo]}`}
              </li>
            ))}
            {ultimo.length > 10 && <li>… e mais {ultimo.length - 10}</li>}
          </ul>
        </div>
      )}
    </>
  );
}

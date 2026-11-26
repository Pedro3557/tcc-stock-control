import { useEffect, useState } from 'react';
import { api, baixarCSV, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS, TIPOS, hojeISO } from '../services/formatos.js';

// O gerador de PDF (jsPDF) é carregado só quando alguém pede um PDF
const carregarPDF = () => import('../services/pdf.js');
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';
import Icone from '../components/Icone.jsx';

function primeiroDiaDoMes() {
  const hoje = hojeISO();
  return `${hoje.slice(0, 8)}01`;
}

/** Cartão de um relatório: descrição, filtros e botões PDF/CSV. */
function CartaoRelatorio({ titulo, descricao, children, aoGerarPDF, aoBaixarCSV, ocupado }) {
  return (
    <section className="cartao relatorio">
      <div>
        <h2>{titulo}</h2>
        <p className="texto-suave">{descricao}</p>
      </div>
      {children && <div className="relatorio-filtros">{children}</div>}
      <div className="relatorio-acoes">
        <button type="button" className="botao botao-primario" onClick={aoGerarPDF} disabled={ocupado}>
          <Icone nome="pdf" tamanho={16} /> {ocupado ? 'Gerando…' : 'Gerar PDF'}
        </button>
        {aoBaixarCSV && (
          <button type="button" className="botao" onClick={aoBaixarCSV} disabled={ocupado}>
            <Icone nome="baixar" tamanho={16} /> CSV (Excel)
          </button>
        )}
      </div>
    </section>
  );
}

export default function Relatorios() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [ocupado, setOcupado] = useState('');
  const [statusEquip, setStatusEquip] = useState('');
  const [periodo, setPeriodo] = useState({ inicio: primeiroDiaDoMes(), fim: hojeISO(), tipo: '' });
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoId, setTecnicoId] = useState('');

  useEffect(() => {
    api.get('/tecnicos').then(({ data }) => setTecnicos(data)).catch(() => {});
  }, []);

  /** Busca os dados na API e gera o PDF; avisa quando não há nada para imprimir. */
  async function gerar(chave, params, nomeGerador, extras = {}) {
    setOcupado(chave);
    try {
      const [{ data }, modulo] = await Promise.all([api.get('/relatorios/dados', { params }), carregarPDF()]);
      const gerador = modulo[nomeGerador];
      if (data.total === 0) {
        toast.info('Nenhum registro encontrado com esses filtros.');
        return;
      }
      gerador({ linhas: data.linhas, usuario: usuario?.nome, ...extras });
      toast.sucesso('PDF gerado.');
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function csv(chave, params) {
    setOcupado(chave);
    try {
      await baixarCSV(params);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function termo() {
    if (!tecnicoId) return toast.erro('Selecione o técnico.');
    setOcupado('termo');
    try {
      const [{ data }, { pdfTermoTecnico }] = await Promise.all([api.get(`/tecnicos/${tecnicoId}/estoque`), carregarPDF()]);
      pdfTermoTecnico({ dados: data, usuario: usuario?.nome });
      toast.sucesso('Termo gerado.');
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
    return undefined;
  }

  const paramsPeriodo = {
    relatorio: 'movimentacoes',
    inicio: periodo.inicio || undefined,
    fim: periodo.fim || undefined,
    tipo: periodo.tipo || undefined,
  };

  return (
    <>
      <Cabecalho titulo="Relatórios" subtitulo="PDF para imprimir ou arquivar, CSV para abrir no Excel" />

      <div className="relatorios">
        <CartaoRelatorio
          titulo="Estoque atual"
          descricao="Todos os produtos ativos com saldo, mínimo, custo e valor total. Itens abaixo do mínimo saem destacados."
          ocupado={ocupado === 'estoque'}
          aoGerarPDF={() => gerar('estoque', { relatorio: 'estoque' }, 'pdfEstoque')}
          aoBaixarCSV={() => csv('estoque', { relatorio: 'estoque' })}
        />

        <CartaoRelatorio
          titulo="Equipamentos por status"
          descricao="ONUs, roteadores e demais unidades com nº de série, MAC, técnico ou cliente (comodato)."
          ocupado={ocupado === 'equipamentos'}
          aoGerarPDF={() => gerar('equipamentos', { relatorio: 'equipamentos', status: statusEquip || undefined }, 'pdfEquipamentos', { filtroStatus: statusEquip })}
          aoBaixarCSV={() => csv('equipamentos', { relatorio: 'equipamentos', status: statusEquip || undefined })}
        >
          <Campo rotulo="Status">
            <select value={statusEquip} onChange={(e) => setStatusEquip(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
        </CartaoRelatorio>

        <CartaoRelatorio
          titulo="Movimentações do período"
          descricao="Entradas, saídas, instalações, retiradas, manutenção e baixas, com técnico, cliente, OS e nota fiscal."
          ocupado={ocupado === 'movimentacoes'}
          aoGerarPDF={() => gerar('movimentacoes', paramsPeriodo, 'pdfMovimentacoes', { inicio: periodo.inicio, fim: periodo.fim })}
          aoBaixarCSV={() => csv('movimentacoes', paramsPeriodo)}
        >
          <Campo rotulo="De"><input type="date" value={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} /></Campo>
          <Campo rotulo="Até"><input type="date" value={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} /></Campo>
          <Campo rotulo="Tipo">
            <select value={periodo.tipo} onChange={(e) => setPeriodo({ ...periodo, tipo: e.target.value })}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
        </CartaoRelatorio>

        <CartaoRelatorio
          titulo="Termo de responsabilidade do técnico"
          descricao="Lista o que está em posse do técnico, com valor e linhas para assinatura. Útil na conferência mensal ou no desligamento."
          ocupado={ocupado === 'termo'}
          aoGerarPDF={termo}
        >
          <Campo rotulo="Técnico">
            <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)}>
              <option value="">Selecione…</option>
              {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Campo>
        </CartaoRelatorio>
      </div>
    </>
  );
}

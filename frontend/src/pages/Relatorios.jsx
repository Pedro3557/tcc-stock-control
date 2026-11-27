import { useEffect, useState } from 'react';
import { api, baixarCSV, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { STATUS, TIPOS, hojeISO } from '../services/formatos.js';
import { obterOrganizacao } from '../services/organizacao.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';
import Icone from '../components/Icone.jsx';

// O gerador de PDF (jsPDF) é carregado só quando alguém pede um PDF
const carregarPDF = () => import('../services/pdf.js');

const primeiroDiaDoMes = () => `${hojeISO().slice(0, 8)}01`;

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

const sem = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null));

export default function Relatorios() {
  const { usuario } = useAuth();
  const toast = useToast();
  const [ocupado, setOcupado] = useState('');
  const [tecnicos, setTecnicos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [f, setF] = useState({
    categoriaEstoque: '',
    categoriaMinimo: '',
    statusEquip: '',
    tecnicoPosse: '',
    cliente: '',
    situacaoManutencao: '',
    inicio: primeiroDiaDoMes(),
    fim: hojeISO(),
    tipo: '',
    tecnicoTermo: '',
  });
  const set = (campo) => (e) => setF({ ...f, [campo]: e.target.value });

  useEffect(() => {
    api.get('/tecnicos').then(({ data }) => setTecnicos(data)).catch(() => {});
    api.get('/categorias').then(({ data }) => setCategorias(data)).catch(() => {});
  }, []);

  /** Parâmetros de cada relatório (os filtros vão para a API e aparecem no cabeçalho do PDF/CSV). */
  const params = {
    estoque: sem({ relatorio: 'estoque', categoriaId: f.categoriaEstoque }),
    abaixo_minimo: sem({ relatorio: 'abaixo_minimo', categoriaId: f.categoriaMinimo }),
    equipamentos: sem({ relatorio: 'equipamentos', status: f.statusEquip }),
    com_tecnicos: sem({ relatorio: 'com_tecnicos', tecnicoId: f.tecnicoPosse }),
    comodato: sem({ relatorio: 'comodato', cliente: f.cliente.trim() }),
    manutencao: sem({ relatorio: 'manutencao', status: f.situacaoManutencao }),
    movimentacoes: sem({ relatorio: 'movimentacoes', inicio: f.inicio, fim: f.fim, tipo: f.tipo }),
  };

  async function gerarPDF(chave) {
    setOcupado(chave);
    try {
      const [{ data }, modulo] = await Promise.all([api.get('/relatorios/dados', { params: params[chave] }), carregarPDF()]);
      if (data.total === 0) toast.info('Nenhum registro com esses filtros — o PDF sairá vazio.');
      modulo.GERADORES[chave](data);
      toast.sucesso('PDF gerado.');
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function csv(chave) {
    setOcupado(chave);
    try {
      await baixarCSV(params[chave]);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  async function termo() {
    if (!f.tecnicoTermo) {
      toast.erro('Selecione o técnico.');
      return;
    }
    setOcupado('termo');
    try {
      const [{ data }, { pdfTermoTecnico }, organizacao] = await Promise.all([
        api.get(`/tecnicos/${f.tecnicoTermo}/estoque`),
        carregarPDF(),
        obterOrganizacao(),
      ]);
      pdfTermoTecnico({ dados: data, usuario: usuario?.nome, organizacao });
      toast.sucesso('Termo gerado.');
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  const acoes = (chave) => ({ ocupado: ocupado === chave, aoGerarPDF: () => gerarPDF(chave), aoBaixarCSV: () => csv(chave) });
  const selectCategoria = (campo) => (
    <Campo rotulo="Categoria">
      <select value={f[campo]} onChange={set(campo)}>
        <option value="">Todas</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>
    </Campo>
  );
  const selectTecnico = (campo, todos = true) => (
    <Campo rotulo="Técnico">
      <select value={f[campo]} onChange={set(campo)}>
        <option value="">{todos ? 'Todos' : 'Selecione…'}</option>
        {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
      </select>
    </Campo>
  );

  return (
    <>
      <Cabecalho titulo="Relatórios" subtitulo="PDF para imprimir ou arquivar, CSV para abrir no Excel. Todos trazem a organização, a data de emissão e os filtros aplicados." />

      <div className="relatorios">
        <CartaoRelatorio titulo="Estoque atual" descricao="Produtos ativos com saldo, mínimo, custo e valor total. Itens abaixo do mínimo saem destacados." {...acoes('estoque')}>
          {selectCategoria('categoriaEstoque')}
        </CartaoRelatorio>

        <CartaoRelatorio titulo="Abaixo do estoque mínimo" descricao="O que precisa ser comprado: saldo, mínimo, quanto falta e o custo estimado para repor." {...acoes('abaixo_minimo')}>
          {selectCategoria('categoriaMinimo')}
        </CartaoRelatorio>

        <CartaoRelatorio titulo="Em posse dos técnicos" descricao="Equipamentos e materiais com cada técnico, com valor e há quantos dias (pendências de devolução)." {...acoes('com_tecnicos')}>
          {selectTecnico('tecnicoPosse')}
        </CartaoRelatorio>

        <CartaoRelatorio titulo="Equipamentos em comodato" descricao="Equipamentos instalados em clientes: cliente, série, MAC, data e OS da instalação e técnico." {...acoes('comodato')}>
          <Campo rotulo="Código do cliente"><input value={f.cliente} onChange={set('cliente')} placeholder="Todos" /></Campo>
        </CartaoRelatorio>

        <CartaoRelatorio titulo="Equipamentos em manutenção" descricao="Unidades em manutenção ou com defeito, com o problema informado e há quantos dias." {...acoes('manutencao')}>
          <Campo rotulo="Situação">
            <select value={f.situacaoManutencao} onChange={set('situacaoManutencao')}>
              <option value="">Em manutenção e com defeito</option>
              <option value="em_manutencao">Só em manutenção</option>
              <option value="defeito">Só com defeito</option>
            </select>
          </Campo>
        </CartaoRelatorio>

        <CartaoRelatorio titulo="Equipamentos por status" descricao="Todas as unidades serializadas com série, MAC, técnico ou cliente." {...acoes('equipamentos')}>
          <Campo rotulo="Status">
            <select value={f.statusEquip} onChange={set('statusEquip')}>
              <option value="">Todos</option>
              {Object.entries(STATUS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
        </CartaoRelatorio>

        <CartaoRelatorio titulo="Movimentações do período" descricao="Entradas, saídas, instalações, retiradas, manutenção, baixas e ajustes, com técnico, cliente, OS e nota fiscal." {...acoes('movimentacoes')}>
          <Campo rotulo="De"><input type="date" value={f.inicio} onChange={set('inicio')} /></Campo>
          <Campo rotulo="Até"><input type="date" value={f.fim} onChange={set('fim')} /></Campo>
          <Campo rotulo="Tipo">
            <select value={f.tipo} onChange={set('tipo')}>
              <option value="">Todos</option>
              {Object.entries(TIPOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
        </CartaoRelatorio>

        <CartaoRelatorio
          titulo="Termo de responsabilidade do técnico"
          descricao="O que está em posse do técnico, com valor e linhas para assinatura. Para a conferência mensal ou o desligamento."
          ocupado={ocupado === 'termo'}
          aoGerarPDF={termo}
        >
          {selectTecnico('tecnicoTermo', false)}
        </CartaoRelatorio>
      </div>
      <p className="texto-suave nota">O relatório de inventário físico é emitido na tela de cada inventário.</p>
    </>
  );
}

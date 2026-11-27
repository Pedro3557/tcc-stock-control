import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatarMoeda, formatarQtd, formatarDataHora, hojeISO, TIPOS } from '../services/formatos.js';
import Campo from '../components/Campo.jsx';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import NivelEstoque from '../components/NivelEstoque.jsx';
import Icone from '../components/Icone.jsx';
import { GraficoMovimentacoes, GraficoStatus } from '../components/Graficos.jsx';

function Indicador({ rotulo, valor, detalhe, alerta, para }) {
  const conteudo = (
    <>
      <span>{rotulo}</span>
      <strong>{valor}</strong>
      {detalhe && <small>{detalhe}</small>}
    </>
  );
  const classe = `indicador ${alerta ? 'indicador-alerta' : ''}`;
  return para ? <Link to={para} className={`${classe} indicador-link`}>{conteudo}</Link> : <div className={classe}>{conteudo}</div>;
}

const PERIODOS = {
  7: 'Últimos 7 dias',
  14: 'Últimos 14 dias',
  30: 'Últimos 30 dias',
  90: 'Últimos 90 dias',
  365: 'Últimos 12 meses',
  personalizado: 'Personalizado',
};

const dataBR = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export default function Painel() {
  const { podeMovimentar } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [preset, setPreset] = useState('14');
  const [periodo, setPeriodo] = useState({ inicio: hojeISO(-13), fim: hojeISO() });

  function escolherPreset(valor) {
    setPreset(valor);
    if (valor !== 'personalizado') setPeriodo({ inicio: hojeISO(-(Number(valor) - 1)), fim: hojeISO() });
  }

  const carregar = useCallback(() => {
    setErro('');
    if (!periodo.inicio || !periodo.fim) return;
    api.get('/dashboard', { params: periodo }).then(({ data }) => setDados(data)).catch((e) => setErro(mensagemErro(e)));
  }, [periodo]);

  useEffect(carregar, [carregar]);

  if (erro) {
    return (
      <Vazio titulo="Não foi possível carregar o painel" texto={erro}>
        <button type="button" className="botao" onClick={carregar}>Tentar novamente</button>
      </Vazio>
    );
  }
  if (!dados) return <Carregando />;

  const eq = dados.equipamentos;
  const mt = dados.materialComTecnicos;

  return (
    <>
      <Cabecalho titulo="Painel" subtitulo="Visão geral do almoxarifado">
        <div className="periodo-painel">
          <Campo rotulo="Período">
            <select value={preset} onChange={(e) => escolherPreset(e.target.value)}>
              {Object.entries(PERIODOS).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Campo>
          {preset === 'personalizado' && (
            <>
              <Campo rotulo="De"><input type="date" value={periodo.inicio} max={periodo.fim} onChange={(e) => setPeriodo({ ...periodo, inicio: e.target.value })} /></Campo>
              <Campo rotulo="Até"><input type="date" value={periodo.fim} min={periodo.inicio} onChange={(e) => setPeriodo({ ...periodo, fim: e.target.value })} /></Campo>
            </>
          )}
        </div>
        {podeMovimentar && (
          <Link to="/movimentacoes/nova" className="botao botao-primario so-desktop">
            <Icone nome="mais" tamanho={16} /> Nova movimentação
          </Link>
        )}
      </Cabecalho>

      <div className="indicadores">
        <Indicador rotulo="Produtos cadastrados" valor={dados.totalProdutos} detalhe="ativos" para="/produtos" />
        <Indicador rotulo="Valor total do estoque" valor={formatarMoeda(dados.valorTotalEstoque)} detalhe="custo × saldo em estoque" />
        <Indicador rotulo="Itens abaixo do mínimo" valor={dados.itensAbaixoMinimo} alerta={dados.itensAbaixoMinimo > 0} detalhe="precisam de reposição" para="/produtos?abaixoMinimo=true" />
        <Indicador rotulo="ONUs disponíveis" valor={dados.onusDisponiveis} detalhe="em estoque" para="/equipamentos?status=em_estoque" />
        <Indicador rotulo="Roteadores disponíveis" valor={dados.roteadoresDisponiveis} detalhe="inclui mesh" para="/equipamentos?status=em_estoque" />
        <Indicador rotulo="Em comodato" valor={eq.emComodato} detalhe="instalados em clientes" para="/equipamentos?status=instalado_cliente" />
        <Indicador rotulo="Em manutenção" valor={eq.emManutencao} para="/equipamentos?status=em_manutencao" />
        <Indicador rotulo="Com defeito" valor={eq.comDefeito} alerta={eq.comDefeito > 0} para="/equipamentos?status=defeito" />
        <Indicador
          rotulo="Com técnicos"
          valor={formatarMoeda(mt.valor + mt.valorEquipamentos)}
          detalhe={`${eq.comTecnico} equip. · ${mt.itens} materiais`}
          para="/tecnicos"
        />
        <Indicador
          rotulo="Entradas × saídas no período"
          valor={`${dados.periodo.entradas} × ${dados.periodo.saidas}`}
          detalhe={`${dataBR(dados.periodo.inicio)} a ${dataBR(dados.periodo.fim)} · hoje: ${dados.movimentacoesHoje}`}
          para={`/movimentacoes?inicio=${dados.periodo.inicio}&fim=${dados.periodo.fim}`}
        />
        <Indicador rotulo="Equipamentos disponíveis" valor={dados.totalEquipamentosEmEstoque} detalhe="unidades serializadas em estoque" para="/equipamentos?status=em_estoque" />
        <Indicador
          rotulo="Materiais disponíveis"
          valor={dados.materiaisDisponiveis.itens}
          detalhe={`itens com saldo · ${formatarMoeda(dados.materiaisDisponiveis.valor)}`}
          para="/produtos?tipoControle=quantidade"
        />
      </div>

      <div className="grade-2">
        <GraficoMovimentacoes
          dados={dados.movimentacoesPorDia}
          agrupamento={dados.periodo.agrupamento}
          descricaoPeriodo={preset === 'personalizado' ? `${dataBR(dados.periodo.inicio)} a ${dataBR(dados.periodo.fim)}` : PERIODOS[preset]}
        />
        <GraficoStatus equipamentos={eq} />
      </div>

      <div className="grade-2">
        <section className="cartao sem-padding">
          <div className="cartao-titulo">
            <h2>Abaixo do estoque mínimo</h2>
            <Link to="/produtos?abaixoMinimo=true" className="link-suave">Ver produtos</Link>
          </div>
          {dados.listaAbaixoMinimo.length === 0 ? (
            <Vazio titulo="Tudo em dia" texto="Nenhum item abaixo do estoque mínimo." />
          ) : (
            <ul className="lista">
              {dados.listaAbaixoMinimo.map((p) => (
                <li key={p.id} className="lista-item">
                  <div>
                    <strong>{p.nome}</strong>
                    <small className="texto-suave">{p.codigo} · {p.categoria}</small>
                  </div>
                  <NivelEstoque quantidade={p.quantidade} minimo={p.estoqueMinimo} unidade={p.unidade} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cartao sem-padding">
          <div className="cartao-titulo">
            <h2>Últimas movimentações</h2>
            <Link to="/movimentacoes" className="link-suave">Ver histórico</Link>
          </div>
          {dados.ultimasMovimentacoes.length === 0 ? (
            <Vazio titulo="Sem movimentações" texto="As movimentações registradas aparecem aqui." />
          ) : (
            <ul className="lista">
              {dados.ultimasMovimentacoes.map((m) => (
                <li key={m.id} className="lista-item">
                  <div>
                    <strong>{TIPOS[m.tipo]}</strong>
                    <small className="texto-suave">
                      {m.produto?.nome}
                      {m.equipamento ? ` · ${m.equipamento.numeroSerie}` : ` · ${formatarQtd(Math.abs(m.quantidade), m.produto?.unidade)}`}
                      {m.tecnico ? ` · ${m.tecnico.nome}` : ''}
                    </small>
                  </div>
                  <small className="texto-suave nowrap">{formatarDataHora(m.createdAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

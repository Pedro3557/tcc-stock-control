import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatarMoeda, formatarQtd, formatarDataHora, TIPOS } from '../services/formatos.js';
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

export default function Painel() {
  const { podeMovimentar } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = useCallback(() => {
    setErro('');
    api.get('/dashboard').then(({ data }) => setDados(data)).catch((e) => setErro(mensagemErro(e)));
  }, []);

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
        {podeMovimentar && (
          <Link to="/movimentacoes/nova" className="botao botao-primario so-desktop">
            <Icone nome="mais" tamanho={16} /> Nova movimentação
          </Link>
        )}
      </Cabecalho>

      <div className="indicadores">
        <Indicador rotulo="Valor total do estoque" valor={formatarMoeda(dados.valorTotalEstoque)} detalhe={`${dados.totalProdutos} produtos ativos`} />
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
        <Indicador rotulo="Movimentações hoje" valor={dados.movimentacoesHoje} para="/movimentacoes" />
        <Indicador rotulo="Equipamentos em estoque" valor={dados.totalEquipamentosEmEstoque} detalhe={`${formatarQtd(dados.totalUnidadesMaterial)} unid./m de material`} />
      </div>

      <div className="grade-2">
        <GraficoMovimentacoes dados={dados.movimentacoesPorDia} />
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

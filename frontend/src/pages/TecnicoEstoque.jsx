import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatarMoeda, formatarQtd, formatarDataHora } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Icone from '../components/Icone.jsx';


export default function TecnicoEstoque() {
  const { id } = useParams();
  const { podeMovimentar, usuario } = useAuth();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api.get(`/tecnicos/${id}/estoque`).then(({ data }) => setDados(data)).catch((e) => setErro(mensagemErro(e)));
  }, [id]);

  if (erro) return <Vazio titulo="Não foi possível carregar" texto={erro} />;
  if (!dados) return <Carregando />;

  const { tecnico, equipamentos, materiais, totais } = dados;
  const vazio = equipamentos.length === 0 && materiais.length === 0;

  return (
    <>
      <Link to="/tecnicos" className="link-voltar"><Icone nome="voltar" tamanho={16} /> Técnicos</Link>
      <Cabecalho titulo={tecnico.nome} subtitulo={[tecnico.equipe, tecnico.telefone].filter(Boolean).join(' · ') || 'Técnico'}>
        <button type="button" className="botao" onClick={async () => (await import('../services/pdf.js')).pdfTermoTecnico({ dados, usuario: usuario?.nome })}>
          <Icone nome="pdf" tamanho={16} /> Termo (PDF)
        </button>
        {podeMovimentar && !vazio && (
          <Link to={`/movimentacoes/nova?tipo=devolucao_tecnico&tecnicoId=${tecnico.id}`} className="botao">Registrar devolução</Link>
        )}
        {podeMovimentar && (
          <Link to={`/movimentacoes/nova?tipo=saida_tecnico&tecnicoId=${tecnico.id}`} className="botao botao-primario">Entregar material</Link>
        )}
      </Cabecalho>

      <div className="indicadores indicadores-3">
        <div className="indicador"><span>Equipamentos em mãos</span><strong>{totais.equipamentos}</strong></div>
        <div className="indicador"><span>Itens de material</span><strong>{totais.materiais}</strong></div>
        <div className="indicador"><span>Valor total em mãos</span><strong>{formatarMoeda(totais.valor)}</strong></div>
      </div>

      {vazio ? (
        <div className="cartao"><Vazio titulo="Nada em posse deste técnico" texto="Quando houver saídas para ele, os itens aparecem aqui." /></div>
      ) : (
        <>
          <h2 className="secao-titulo">Equipamentos (serializados)</h2>
          <div className="cartao sem-padding">
            {equipamentos.length === 0 ? (
              <Vazio titulo="Nenhum equipamento" />
            ) : (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr><th>Produto</th><th>Nº de série</th><th>MAC</th><th>Desde</th></tr></thead>
                  <tbody>
                    {equipamentos.map((e) => (
                      <tr key={e.id}>
                        <td data-rotulo="Produto">{e.produto?.nome}</td>
                        <td data-rotulo="Nº de série"><Link to={`/equipamentos/${e.id}`} className="link-forte mono">{e.numeroSerie}</Link></td>
                        <td data-rotulo="MAC" className="mono">{e.mac || '—'}</td>
                        <td data-rotulo="Desde">{formatarDataHora(e.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <h2 className="secao-titulo">Materiais de consumo</h2>
          <div className="cartao sem-padding">
            {materiais.length === 0 ? (
              <Vazio titulo="Nenhum material" />
            ) : (
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead><tr><th>Código</th><th>Material</th><th className="num">Quantidade</th><th className="num">Valor</th></tr></thead>
                  <tbody>
                    {materiais.map((m) => (
                      <tr key={m.produtoId}>
                        <td data-rotulo="Código" className="mono">{m.codigo}</td>
                        <td data-rotulo="Material">{m.nome}</td>
                        <td data-rotulo="Quantidade" className="num">{formatarQtd(m.quantidade, m.unidade)}</td>
                        <td data-rotulo="Valor" className="num">{formatarMoeda(m.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="texto-suave nota">
            Material consumido em OS deve ser lançado como <strong>Baixa</strong> com origem “em posse do técnico”.
          </p>
        </>
      )}
    </>
  );
}

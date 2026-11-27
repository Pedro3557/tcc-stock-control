import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { formatarDataHora } from '../services/formatos.js';
import Carregando from './Carregando.jsx';
import Vazio from './Vazio.jsx';

/** Equipamentos em posse de técnicos, do mais antigo para o mais recente (com destaque a partir de N dias). */
export default function PendenciasDevolucao({ tecnicoId, diasAlerta = 7 }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/tecnicos/pendencias', { params: { tecnicoId: tecnicoId || undefined } })
      .then(({ data }) => setLista(data))
      .catch((e) => setErro(mensagemErro(e)));
  }, [tecnicoId]);

  if (erro) return <Vazio titulo="Não foi possível carregar as pendências" texto={erro} />;
  if (!lista) return <Carregando />;
  if (lista.length === 0) return <Vazio titulo="Nenhum equipamento pendente" texto="Nenhum técnico está com equipamentos em mãos." />;

  return (
    <div className="tabela-rolagem">
      <table className="tabela">
        <thead>
          <tr>
            {!tecnicoId && <th>Técnico</th>}
            <th>Equipamento</th>
            <th>Nº de série</th>
            <th>Em posse desde</th>
            <th className="num">Dias</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => (
            <tr key={p.id} className={p.dias >= diasAlerta ? 'linha-alerta' : ''}>
              {!tecnicoId && (
                <td data-rotulo="Técnico"><Link to={`/tecnicos/${p.tecnico?.id}`} className="link-forte">{p.tecnico?.nome}</Link></td>
              )}
              <td data-rotulo="Equipamento">{p.produto?.nome}</td>
              <td data-rotulo="Nº de série"><Link to={`/equipamentos/${p.id}`} className="link-forte mono">{p.numeroSerie}</Link></td>
              <td data-rotulo="Desde" className="nowrap">{formatarDataHora(p.desde)}</td>
              <td data-rotulo="Dias" className="num">
                {p.dias}
                {p.dias >= diasAlerta && <span className="tag-alerta"> há mais de {diasAlerta} dias</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

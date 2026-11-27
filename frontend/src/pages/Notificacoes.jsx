import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatarDataHora } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Paginacao from '../components/Paginacao.jsx';

const NIVEL = { critico: 'Crítico', aviso: 'Aviso', info: 'Informação' };

/** Avisa o contador do menu para se atualizar. */
const avisarMenu = () => window.dispatchEvent(new Event('notificacoes-atualizadas'));

export default function Notificacoes() {
  const toast = useToast();
  const [resultado, setResultado] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [somenteNaoLidas, setSomenteNaoLidas] = useState(false);

  const carregar = useCallback(() => {
    api
      .get('/notificacoes', { params: { pagina, naoLidas: somenteNaoLidas || undefined } })
      .then(({ data }) => setResultado(data))
      .catch((e) => toast.erro(mensagemErro(e)));
  }, [pagina, somenteNaoLidas, toast]);

  useEffect(carregar, [carregar]);

  async function marcar(n) {
    if (n.lida) return;
    try {
      await api.patch(`/notificacoes/${n.id}/lida`);
      setResultado((r) => ({ ...r, dados: r.dados.map((x) => (x.id === n.id ? { ...x, lida: true } : x)) }));
      avisarMenu();
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  async function marcarTodas() {
    try {
      const { data } = await api.post('/notificacoes/marcar-todas-lidas');
      toast.sucesso(data.alteradas ? `${data.alteradas} notificação(ões) marcada(s) como lida(s).` : 'Nada para marcar.');
      avisarMenu();
      carregar();
    } catch (e) {
      toast.erro(mensagemErro(e));
    }
  }

  const lista = resultado?.dados || [];

  return (
    <>
      <Cabecalho titulo="Notificações" subtitulo="Alertas de estoque mínimo, falta de estoque, divergências de inventário e falhas de backup">
        <button type="button" className="botao" onClick={marcarTodas}>Marcar todas como lidas</button>
      </Cabecalho>
      <div className="filtros">
        <label className="check">
          <input type="checkbox" checked={somenteNaoLidas} onChange={(e) => { setSomenteNaoLidas(e.target.checked); setPagina(1); }} />
          Só não lidas
        </label>
      </div>
      <div className="cartao sem-padding">
        {!resultado ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo={somenteNaoLidas ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'} texto="Os alertas do sistema aparecem aqui." />
        ) : (
          <ul className="lista notificacoes">
            {lista.map((n) => (
              <li key={n.id} className={`lista-item notificacao ${n.lida ? 'lida' : 'nao-lida'} nivel-${n.nivel}`}>
                <div>
                  <span className="notificacao-nivel">{NIVEL[n.nivel]}{!n.lida && ' · nova'}</span>
                  <strong>{n.titulo}</strong>
                  <p className="texto-suave">{n.mensagem}</p>
                  <small className="texto-suave">{formatarDataHora(n.createdAt)}</small>
                </div>
                <div className="notificacao-acoes">
                  {n.link && (
                    <Link to={n.link} className="botao botao-pequeno" onClick={() => marcar(n)}>Abrir</Link>
                  )}
                  {!n.lida && (
                    <button type="button" className="botao botao-pequeno" onClick={() => marcar(n)}>Marcar como lida</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      {resultado && <Paginacao pagina={resultado.pagina} paginas={resultado.paginas} total={resultado.total} aoMudar={setPagina} />}
      <p className="texto-suave nota">
        Quem recebe as notificações (e o e-mail) é definido por usuário na tela Usuários. Um mesmo alerta não é repetido enquanto a situação continuar; ele volta a ser enviado se o problema for resolvido e acontecer de novo.
      </p>
    </>
  );
}

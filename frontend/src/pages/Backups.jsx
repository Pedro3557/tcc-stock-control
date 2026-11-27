import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, baixarArquivo, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { formatarDataHora } from '../services/formatos.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';
import Paginacao from '../components/Paginacao.jsx';
import Modal from '../components/Modal.jsx';
import Campo from '../components/Campo.jsx';
import Icone from '../components/Icone.jsx';

const ORIGEM = { automatico: 'Automático', manual: 'Manual', pre_restauracao: 'Segurança (antes de restaurar)' };
const SITUACAO = { em_andamento: 'Em andamento', sucesso: 'Concluído', falha: 'Falhou', removido: 'Removido (retenção)' };
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

function tamanho(bytes) {
  if (!bytes) return '—';
  const n = Number(bytes);
  return n > 1048576 ? `${(n / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function descreverAgenda(c) {
  if (!c) return '';
  if (c['backup.frequencia'] === 'desativado') return 'Backup automático desativado';
  if (c['backup.frequencia'] === 'horas') return `Automático a cada ${c['backup.intervaloHoras']} hora(s)`;
  if (c['backup.frequencia'] === 'semanal') return `Automático toda ${DIAS[Number(c['backup.diaSemana'])]} às ${c['backup.horario']}`;
  return `Automático todo dia às ${c['backup.horario']}`;
}

export default function Backups() {
  const toast = useToast();
  const [resultado, setResultado] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [ocupado, setOcupado] = useState('');
  const [restaurando, setRestaurando] = useState(null);
  const [confirmacao, setConfirmacao] = useState({ texto: '', senha: '' });

  const carregar = useCallback(() => {
    api.get('/backups', { params: { pagina } }).then(({ data }) => setResultado(data)).catch((e) => toast.erro(mensagemErro(e)));
  }, [pagina, toast]);

  useEffect(carregar, [carregar]);

  async function executar(nome, fn) {
    setOcupado(nome);
    try {
      await fn();
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setOcupado('');
      carregar();
    }
  }

  const backupAgora = () =>
    executar('novo', async () => {
      const { data } = await api.post('/backups', null, { timeout: 600000 });
      toast.sucesso(`${data.mensagem} ${data.backup.registros} registros em ${data.backup.tabelas} tabelas.`);
    });

  const verificar = (b) =>
    executar(`verificar-${b.id}`, async () => {
      const { data } = await api.post(`/backups/${b.id}/verificar`);
      toast.sucesso(`${data.mensagem} ${data.registros} registros.`);
    });

  const baixar = (b) => executar(`baixar-${b.id}`, () => baixarArquivo(`/backups/${b.id}/download`, undefined, b.arquivo));

  async function restaurar(e) {
    e.preventDefault();
    const b = restaurando;
    setOcupado('restaurar');
    try {
      const { data } = await api.post(`/backups/${b.id}/restaurar`, { confirmacao: confirmacao.texto, senha: confirmacao.senha }, { timeout: 600000 });
      toast.sucesso(data.mensagem);
      setRestaurando(null);
      // Os dados mudaram: recarrega a aplicação (a sessão pode ter de ser refeita)
      setTimeout(() => window.location.assign('/'), 1500);
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    } finally {
      setOcupado('');
      carregar();
    }
  }

  const lista = resultado?.dados || [];
  const ultimoOk = lista.find((b) => b.situacao === 'sucesso');

  return (
    <>
      <Cabecalho titulo="Backups" subtitulo={resultado ? `${descreverAgenda(resultado.configuracao)} · pasta: ${resultado.pasta}` : 'Cópias de segurança do banco de dados'}>
        <Link to="/configuracoes" className="botao">Agendamento e retenção</Link>
        <button type="button" className="botao botao-primario" onClick={backupAgora} disabled={!!ocupado}>
          <Icone nome="backup" tamanho={16} /> {ocupado === 'novo' ? 'Gerando backup…' : 'Fazer backup agora'}
        </button>
      </Cabecalho>

      {resultado && (
        <div className="indicadores indicadores-3">
          <div className="indicador"><span>Último backup concluído</span><strong className="indicador-texto">{ultimoOk ? formatarDataHora(ultimoOk.iniciadoEm) : 'Nenhum'}</strong>{ultimoOk && <small>{ORIGEM[ultimoOk.origem]} · {tamanho(ultimoOk.tamanho)}</small>}</div>
          <div className="indicador"><span>Retenção</span><strong className="indicador-texto">{resultado.configuracao['backup.retencaoQuantidade']} backups / {resultado.configuracao['backup.retencaoDias']} dias</strong><small>os mais antigos são removidos automaticamente</small></div>
          <div className={`indicador ${lista[0]?.situacao === 'falha' ? 'indicador-alerta' : ''}`}><span>Situação do último</span><strong className="indicador-texto">{lista[0] ? SITUACAO[lista[0].situacao] : '—'}</strong>{lista[0]?.erro && <small>{lista[0].erro}</small>}</div>
        </div>
      )}

      <div className="cartao sem-padding">
        {!resultado ? (
          <Carregando />
        ) : lista.length === 0 ? (
          <Vazio titulo="Nenhum backup ainda" texto="Faça o primeiro backup agora ou aguarde o horário agendado." />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead><tr><th>Data/hora</th><th>Origem</th><th>Situação</th><th className="num">Tamanho</th><th className="num">Registros</th><th>Responsável</th><th className="acoes">Ações</th></tr></thead>
              <tbody>
                {lista.map((b) => (
                  <tr key={b.id} className={b.situacao === 'falha' ? 'linha-alerta' : ''}>
                    <td data-rotulo="Data/hora" className="nowrap">{formatarDataHora(b.iniciadoEm)}{b.restauradoEm && <small className="texto-suave bloco">restaurado em {formatarDataHora(b.restauradoEm)}</small>}</td>
                    <td data-rotulo="Origem">{ORIGEM[b.origem]}</td>
                    <td data-rotulo="Situação">{b.situacao === 'falha' ? <span className="badge badge-defeito" title={b.erro}>Falhou</span> : SITUACAO[b.situacao]}{b.erro && <small className="texto-suave bloco">{b.erro}</small>}</td>
                    <td data-rotulo="Tamanho" className="num">{tamanho(b.tamanho)}</td>
                    <td data-rotulo="Registros" className="num">{b.registros ?? '—'}</td>
                    <td data-rotulo="Responsável">{b.usuario?.nome || (b.origem === 'automatico' ? 'Agendamento' : '—')}</td>
                    <td className="acoes">
                      {b.situacao === 'sucesso' && (
                        <>
                          <button type="button" className="botao botao-pequeno" onClick={() => verificar(b)} disabled={!!ocupado}>Verificar</button>
                          <button type="button" className="botao botao-pequeno" onClick={() => baixar(b)} disabled={!!ocupado}>Baixar</button>
                          <button type="button" className="botao botao-pequeno botao-perigo" onClick={() => { setConfirmacao({ texto: '', senha: '' }); setRestaurando(b); }} disabled={!!ocupado}>Restaurar</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {resultado && <Paginacao pagina={resultado.pagina} paginas={resultado.paginas} total={resultado.total} aoMudar={setPagina} />}
      <p className="texto-suave nota">
        Os arquivos ficam na pasta do servidor indicada acima, acessível só pelos administradores. Guarde cópias fora do servidor (baixe periodicamente).
        Procedimento completo em docs/BACKUP_RESTAURACAO.md.
      </p>

      <Modal titulo="Restaurar backup" aberto={!!restaurando} aoFechar={() => ocupado !== 'restaurar' && setRestaurando(null)}>
        {restaurando && (
          <form className="formulario" onSubmit={restaurar}>
            <div className="aviso aviso-erro">
              <strong>Atenção:</strong> todos os dados atuais (produtos, estoque, movimentações, usuários…) serão substituídos pelos do backup de{' '}
              <strong>{formatarDataHora(restaurando.iniciadoEm)}</strong>. O que foi feito depois disso será perdido.
            </div>
            <ul className="lista-simples">
              <li>Antes de restaurar, o sistema cria automaticamente um backup de segurança do estado atual.</li>
              <li>A integridade do arquivo (SHA-256) é conferida antes de começar.</li>
              <li>A auditoria e o histórico de backups atuais são preservados.</li>
              <li>Durante a restauração o sistema fica indisponível para os demais usuários.</li>
            </ul>
            <Campo rotulo="Digite RESTAURAR para confirmar" obrigatorio>
              <input value={confirmacao.texto} onChange={(e) => setConfirmacao({ ...confirmacao, texto: e.target.value })} autoComplete="off" required />
            </Campo>
            <Campo rotulo="Sua senha" obrigatorio>
              <input type="password" value={confirmacao.senha} onChange={(e) => setConfirmacao({ ...confirmacao, senha: e.target.value })} autoComplete="current-password" required />
            </Campo>
            <div className="formulario-acoes">
              <button type="button" className="botao" onClick={() => setRestaurando(null)} disabled={ocupado === 'restaurar'}>Cancelar</button>
              <button type="submit" className="botao botao-perigo-cheio" disabled={ocupado === 'restaurar' || confirmacao.texto !== 'RESTAURAR' || !confirmacao.senha}>
                {ocupado === 'restaurar' ? 'Restaurando…' : 'Restaurar backup'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

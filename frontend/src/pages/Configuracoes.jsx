import { useEffect, useState } from 'react';
import { api, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { limparOrganizacao } from '../services/organizacao.js';
import Cabecalho from '../components/Cabecalho.jsx';
import Campo from '../components/Campo.jsx';
import Carregando from '../components/Carregando.jsx';

const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

export default function Configuracoes() {
  const toast = useToast();
  const [valores, setValores] = useState(null);
  const [smtp, setSmtp] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    api
      .get('/configuracoes')
      .then(({ data }) => {
        setValores(data.valores);
        setSmtp(data.smtpConfigurado);
      })
      .catch((e) => toast.erro(mensagemErro(e)));
  }, [toast]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      const { data } = await api.put('/configuracoes', { valores });
      setValores(data.valores);
      limparOrganizacao();
      toast.sucesso('Configurações salvas.');
    } catch (erro) {
      toast.erro(mensagemErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  if (!valores) return <Carregando />;
  const set = (chave) => (e) => setValores({ ...valores, [chave]: e.target.type === 'checkbox' ? String(e.target.checked) : e.target.value });
  const freq = valores['backup.frequencia'];

  return (
    <>
      <Cabecalho titulo="Configurações" subtitulo="Dados da organização, endereço do sistema, backups automáticos e e-mail" />
      <form className="formulario" onSubmit={salvar}>
        <section className="cartao grade-form">
          <h2 className="largura-total">Organização</h2>
          <p className="texto-suave largura-total nota-topo">Aparece no cabeçalho de todos os relatórios (PDF e CSV), nas etiquetas e nos e-mails.</p>
          <Campo rotulo="Nome da organização" obrigatorio className="largura-total">
            <input value={valores['organizacao.nome']} onChange={set('organizacao.nome')} maxLength={150} required />
          </Campo>
          <Campo rotulo="CNPJ"><input value={valores['organizacao.cnpj']} onChange={set('organizacao.cnpj')} placeholder="00.000.000/0000-00" /></Campo>
          <Campo rotulo="Telefone"><input value={valores['organizacao.telefone']} onChange={set('organizacao.telefone')} maxLength={30} /></Campo>
          <Campo rotulo="Endereço" className="largura-total"><input value={valores['organizacao.endereco']} onChange={set('organizacao.endereco')} maxLength={200} /></Campo>
        </section>

        <section className="cartao grade-form">
          <h2 className="largura-total">Endereço do sistema na rede</h2>
          <Campo
            rotulo="Endereço usado nos QR Codes"
            className="largura-total"
            dica={`Ex.: http://192.168.0.10:3333. Em branco, usa o endereço de quem gera a etiqueta (agora: ${window.location.origin}). Defina para que os QR Codes funcionem em qualquer aparelho da rede.`}
          >
            <input value={valores['sistema.urlPublica']} onChange={set('sistema.urlPublica')} placeholder="http://192.168.0.10:3333" />
          </Campo>
        </section>

        <section className="cartao grade-form">
          <h2 className="largura-total">Backup automático</h2>
          <Campo rotulo="Frequência">
            <select value={freq} onChange={set('backup.frequencia')}>
              <option value="diario">Diário</option>
              <option value="semanal">Semanal</option>
              <option value="horas">A cada N horas</option>
              <option value="desativado">Desativado</option>
            </select>
          </Campo>
          {(freq === 'diario' || freq === 'semanal') && (
            <Campo rotulo="Horário"><input type="time" value={valores['backup.horario']} onChange={set('backup.horario')} /></Campo>
          )}
          {freq === 'semanal' && (
            <Campo rotulo="Dia da semana">
              <select value={valores['backup.diaSemana']} onChange={set('backup.diaSemana')}>
                {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </Campo>
          )}
          {freq === 'horas' && (
            <Campo rotulo="Intervalo (horas)"><input type="number" min="1" max="168" value={valores['backup.intervaloHoras']} onChange={set('backup.intervaloHoras')} /></Campo>
          )}
          <Campo rotulo="Manter os últimos (backups)"><input type="number" min="1" max="365" value={valores['backup.retencaoQuantidade']} onChange={set('backup.retencaoQuantidade')} /></Campo>
          <Campo rotulo="Apagar backups com mais de (dias)"><input type="number" min="1" max="3650" value={valores['backup.retencaoDias']} onChange={set('backup.retencaoDias')} /></Campo>
          <p className="texto-suave largura-total nota">O horário é o do servidor. O backup mais recente nunca é apagado pela retenção. Em caso de falha, os administradores recebem uma notificação.</p>
        </section>

        <section className="cartao grade-form">
          <h2 className="largura-total">Notificações por e-mail</h2>
          <label className="check largura-total">
            <input type="checkbox" checked={valores['notificacoes.email'] === 'true'} onChange={set('notificacoes.email')} />
            Enviar as notificações também por e-mail (para os usuários marcados na tela Usuários)
          </label>
          <p className={`largura-total nota ${smtp ? 'texto-suave' : 'aviso'}`}>
            {smtp
              ? 'Servidor SMTP configurado no servidor.'
              : 'O servidor de e-mail (SMTP) ainda não foi configurado. Um técnico deve preencher SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e SMTP_FROM no arquivo backend/.env (as senhas nunca ficam no banco).'}
          </p>
        </section>

        <div className="formulario-acoes">
          <button type="submit" className="botao botao-primario" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar configurações'}</button>
        </div>
      </form>
    </>
  );
}

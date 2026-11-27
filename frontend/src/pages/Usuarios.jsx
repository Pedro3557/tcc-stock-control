import CadastroSimples from '../components/CadastroSimples.jsx';
import { PERFIS } from '../services/formatos.js';

export default function Usuarios() {
  return (
    <CadastroSimples
      titulo="Usuários"
      subtitulo="Admin: acesso total · Almoxarife: movimenta o estoque · Consulta: só visualiza"
      endpoint="/usuarios"
      nomeSingular="Usuário"
      textoExcluir="inativar"
      podeCriar
      podeEditar
      podeExcluir
      filtroBusca={false}
      campos={[
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'email', rotulo: 'E-mail', tipo: 'email', obrigatorio: true },
        { nome: 'perfil', rotulo: 'Perfil', tipo: 'select', opcoes: PERFIS, obrigatorio: true, padrao: 'almoxarife' },
        { nome: 'senha', rotulo: 'Senha provisória', tipo: 'password', obrigatorio: true, regrasSenha: true, dica: 'O usuário troca no primeiro acesso.' },
        { nome: 'recebeNotificacoes', rotulo: 'Recebe notificações no sistema', tipo: 'checkbox' },
        { nome: 'recebeEmail', rotulo: 'Recebe notificações por e-mail (se o SMTP estiver configurado)', tipo: 'checkbox', padrao: false },
        { nome: 'ativo', rotulo: 'Usuário ativo', tipo: 'checkbox', somenteEdicao: true },
      ]}
      colunas={[
        { titulo: 'Nome', valor: (u) => <strong>{u.nome}</strong> },
        { titulo: 'E-mail', valor: (u) => u.email },
        { titulo: 'Perfil', valor: (u) => PERFIS[u.perfil] },
        { titulo: 'Notificações', valor: (u) => [u.recebeNotificacoes && 'Sistema', u.recebeEmail && 'E-mail'].filter(Boolean).join(' + ') || '—' },
        { titulo: 'Situação', valor: (u) => (u.ativo ? 'Ativo' : <span className="texto-suave">Inativo</span>) },
      ]}
    />
  );
}

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
        { nome: 'senha', rotulo: 'Senha', tipo: 'password', obrigatorio: true, dica: 'Mínimo de 6 caracteres.' },
        { nome: 'ativo', rotulo: 'Usuário ativo', tipo: 'checkbox', somenteEdicao: true },
      ]}
      colunas={[
        { titulo: 'Nome', valor: (u) => <strong>{u.nome}</strong> },
        { titulo: 'E-mail', valor: (u) => u.email },
        { titulo: 'Perfil', valor: (u) => PERFIS[u.perfil] },
        { titulo: 'Situação', valor: (u) => (u.ativo ? 'Ativo' : <span className="texto-suave">Inativo</span>) },
      ]}
    />
  );
}

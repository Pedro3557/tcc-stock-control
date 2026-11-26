import CadastroSimples from '../components/CadastroSimples.jsx';

export default function Fornecedores() {
  return (
    <CadastroSimples
      titulo="Fornecedores"
      subtitulo="Distribuidores de equipamentos e materiais"
      endpoint="/fornecedores"
      nomeSingular="Fornecedor"
      campos={[
        { nome: 'nome', rotulo: 'Razão social / nome', obrigatorio: true },
        { nome: 'cnpj', rotulo: 'CNPJ', placeholder: '00.000.000/0000-00' },
        { nome: 'telefone', rotulo: 'Telefone', tipo: 'tel', placeholder: '(00) 0000-0000' },
        { nome: 'email', rotulo: 'E-mail', tipo: 'email' },
      ]}
      colunas={[
        { titulo: 'Nome', valor: (f) => <strong>{f.nome}</strong> },
        { titulo: 'CNPJ', valor: (f) => f.cnpj || '—' },
        { titulo: 'Telefone', valor: (f) => f.telefone || '—' },
        { titulo: 'E-mail', valor: (f) => f.email || '—' },
      ]}
    />
  );
}

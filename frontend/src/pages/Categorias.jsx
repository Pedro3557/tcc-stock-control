import CadastroSimples from '../components/CadastroSimples.jsx';

export default function Categorias() {
  return (
    <CadastroSimples
      titulo="Categorias"
      subtitulo="Agrupamento dos produtos (ONU/ONT, roteadores, cabos, conectores…)"
      endpoint="/categorias"
      nomeSingular="Categoria"
      filtroBusca={false}
      campos={[{ nome: 'nome', rotulo: 'Nome', obrigatorio: true, placeholder: 'Ex.: Splitters' }]}
      colunas={[
        { titulo: 'Nome', valor: (c) => <strong>{c.nome}</strong> },
        { titulo: 'Produtos ativos', valor: (c) => c.totalProdutos ?? 0, className: 'num' },
      ]}
    />
  );
}

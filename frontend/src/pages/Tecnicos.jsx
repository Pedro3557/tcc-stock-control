import { Link } from 'react-router-dom';
import CadastroSimples from '../components/CadastroSimples.jsx';
import { formatarMoeda } from '../services/formatos.js';

export default function Tecnicos() {
  return (
    <CadastroSimples
      titulo="Técnicos"
      subtitulo="Equipe de campo e o que cada um tem em mãos"
      endpoint="/tecnicos"
      nomeSingular="Técnico"
      textoExcluir="inativar"
      campos={[
        { nome: 'nome', rotulo: 'Nome', obrigatorio: true },
        { nome: 'telefone', rotulo: 'Telefone', tipo: 'tel', placeholder: '(00) 00000-0000' },
        { nome: 'equipe', rotulo: 'Equipe', placeholder: 'Ex.: Instalação' },
      ]}
      colunas={[
        { titulo: 'Nome', valor: (t) => <Link to={`/tecnicos/${t.id}`} className="link-forte">{t.nome}</Link> },
        { titulo: 'Equipe', valor: (t) => t.equipe || '—' },
        { titulo: 'Telefone', valor: (t) => t.telefone || '—' },
        { titulo: 'Equipamentos', valor: (t) => t.totalEquipamentos, className: 'num' },
        { titulo: 'Materiais', valor: (t) => t.totalItensMaterial, className: 'num' },
        { titulo: 'Valor em material', valor: (t) => formatarMoeda(t.valorMateriais), className: 'num' },
      ]}
      acoesExtras={(t) => (
        <Link to={`/tecnicos/${t.id}`} className="botao botao-pequeno">Em mãos</Link>
      )}
    />
  );
}

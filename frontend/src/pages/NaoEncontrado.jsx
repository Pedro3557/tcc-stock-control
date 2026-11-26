import { Link } from 'react-router-dom';
import Vazio from '../components/Vazio.jsx';

export default function NaoEncontrado() {
  return (
    <Vazio titulo="Página não encontrada" texto="O endereço acessado não existe.">
      <Link to="/" className="botao">Voltar ao painel</Link>
    </Vazio>
  );
}

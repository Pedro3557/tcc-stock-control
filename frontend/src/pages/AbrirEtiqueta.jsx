import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import Carregando from '../components/Carregando.jsx';
import Vazio from '../components/Vazio.jsx';

/** Endereço gravado no QR Code (/e/CODIGO): identifica o equipamento e abre a página dele. */
export default function AbrirEtiqueta() {
  const { codigo } = useParams();
  const navegar = useNavigate();
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/equipamentos/leitura', { params: { valor: codigo } })
      .then(({ data }) => navegar(`/equipamentos/${data.id}`, { replace: true }))
      .catch((e) => setErro(mensagemErro(e)));
  }, [codigo, navegar]);

  if (erro) {
    return (
      <Vazio titulo="Etiqueta não reconhecida" texto={erro}>
        <Link to="/ler" className="botao">Ler outra etiqueta</Link>
      </Vazio>
    );
  }
  return <Carregando texto="Abrindo equipamento…" />;
}

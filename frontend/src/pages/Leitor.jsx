import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, mensagemErro } from '../services/api.js';
import { useToast } from '../context/ToastContext.jsx';
import Cabecalho from '../components/Cabecalho.jsx';
import LeitorCodigo from '../components/LeitorCodigo.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

/** Consulta rápida: lê o QR Code (ou série/MAC) e abre o equipamento automaticamente. */
export default function Leitor() {
  const navegar = useNavigate();
  const toast = useToast();
  const [ultimos, setUltimos] = useState([]);
  const [buscando, setBuscando] = useState(false);

  async function aoLer(valor) {
    setBuscando(true);
    try {
      const { data } = await api.get('/equipamentos/leitura', { params: { valor } });
      setUltimos((lista) => [data, ...lista.filter((e) => e.id !== data.id)].slice(0, 5));
      navegar(`/equipamentos/${data.id}`);
    } catch (e) {
      toast.erro(mensagemErro(e));
    } finally {
      setBuscando(false);
    }
  }

  return (
    <>
      <Cabecalho titulo="Ler etiqueta" subtitulo="QR Code, código de barras, número de série ou MAC — o equipamento abre automaticamente" />
      <div className="grade-2 grade-leitor">
        <section className="cartao">
          <LeitorCodigo onLeitura={aoLer} />
          {buscando && <p className="texto-suave nota">Consultando…</p>}
        </section>
        <section className="cartao">
          <h2 className="cartao-subtitulo">Como usar</h2>
          <ul className="lista-simples">
            <li><strong>Celular:</strong> toque em “Ligar câmera” e aponte para o QR Code da etiqueta.</li>
            <li><strong>Sem câmera liberada:</strong> use “Ler por foto” e fotografe a etiqueta.</li>
            <li><strong>Leitor USB/Bluetooth:</strong> clique no campo e bipe a etiqueta ou o código de barras do fabricante.</li>
            <li>Também funciona digitando o número de série, o MAC ou o código impresso na etiqueta.</li>
          </ul>
          {ultimos.length > 0 && (
            <>
              <h3 className="secao-titulo">Últimas leituras</h3>
              <ul className="lista">
                {ultimos.map((e) => (
                  <li key={e.id} className="lista-item">
                    <div>
                      <Link to={`/equipamentos/${e.id}`} className="link-forte mono">{e.numeroSerie}</Link>
                      <small className="texto-suave">{e.produto?.nome}</small>
                    </div>
                    <StatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}

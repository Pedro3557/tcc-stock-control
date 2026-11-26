import { useEffect } from 'react';
import Icone from './Icone.jsx';

export default function Modal({ titulo, aberto, aoFechar, children, largura = 560 }) {
  useEffect(() => {
    if (!aberto) return undefined;
    const tecla = (e) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: largura }}>
        <div className="modal-cabecalho">
          <h2>{titulo}</h2>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}

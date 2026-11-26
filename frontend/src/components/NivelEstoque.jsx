import { formatarQtd } from '../services/formatos.js';

/** Barra de nível: compara o saldo com o estoque mínimo (100% = 2x o mínimo). */
export default function NivelEstoque({ quantidade, minimo, unidade }) {
  const qtd = Number(quantidade || 0);
  const min = Number(minimo || 0);
  const abaixo = min > 0 && qtd < min;
  const referencia = min > 0 ? min * 2 : Math.max(qtd, 1);
  const percentual = Math.max(qtd > 0 ? 4 : 0, Math.min(100, (qtd / referencia) * 100));

  return (
    <div className={`nivel ${abaixo ? 'nivel-alerta' : ''}`} title={`Saldo ${formatarQtd(qtd, unidade)} · mínimo ${formatarQtd(min, unidade)}`}>
      <div className="nivel-trilho">
        <div className="nivel-barra" style={{ width: `${percentual}%` }} />
        {min > 0 && <div className="nivel-minimo" style={{ left: '50%' }} />}
      </div>
      <small>
        {formatarQtd(qtd, unidade)} <span className="texto-suave">/ mín. {formatarQtd(min)}</span>
      </small>
    </div>
  );
}

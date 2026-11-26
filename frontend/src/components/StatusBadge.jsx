import { STATUS } from '../services/formatos.js';

export default function StatusBadge({ status }) {
  if (!status) return <span className="texto-suave">—</span>;
  return <span className={`badge badge-${status}`}>{STATUS[status] || status}</span>;
}

export default function Carregando({ tela = false, texto = 'Carregando…' }) {
  return (
    <div className={tela ? 'carregando carregando-tela' : 'carregando'} role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

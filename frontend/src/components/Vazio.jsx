export default function Vazio({ titulo = 'Nada por aqui', texto, children }) {
  return (
    <div className="vazio">
      <h3>{titulo}</h3>
      {texto && <p>{texto}</p>}
      {children}
    </div>
  );
}

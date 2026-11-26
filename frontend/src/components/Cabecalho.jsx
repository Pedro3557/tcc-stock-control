export default function Cabecalho({ titulo, subtitulo, children }) {
  return (
    <div className="cabecalho">
      <div>
        <h1>{titulo}</h1>
        {subtitulo && <p className="texto-suave">{subtitulo}</p>}
      </div>
      {children && <div className="cabecalho-acoes">{children}</div>}
    </div>
  );
}

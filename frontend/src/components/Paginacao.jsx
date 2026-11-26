export default function Paginacao({ pagina, paginas, total, aoMudar }) {
  if (!total) return null;
  return (
    <div className="paginacao">
      <span className="texto-suave">{total.toLocaleString('pt-BR')} registro(s)</span>
      {paginas > 1 && (
        <div className="paginacao-botoes">
          <button type="button" className="botao botao-pequeno" disabled={pagina <= 1} onClick={() => aoMudar(pagina - 1)}>
            Anterior
          </button>
          <span>
            {pagina} de {paginas}
          </span>
          <button type="button" className="botao botao-pequeno" disabled={pagina >= paginas} onClick={() => aoMudar(pagina + 1)}>
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}

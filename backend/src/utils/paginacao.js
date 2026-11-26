function lerPaginacao(query, limitePadrao = 50) {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
  const limite = Math.min(500, Math.max(1, parseInt(query.limite, 10) || limitePadrao));
  return { pagina, limite, offset: (pagina - 1) * limite };
}

function respostaPaginada({ rows, count }, { pagina, limite }) {
  return {
    dados: rows,
    total: count,
    pagina,
    limite,
    paginas: Math.max(1, Math.ceil(count / limite)),
  };
}

module.exports = { lerPaginacao, respostaPaginada };

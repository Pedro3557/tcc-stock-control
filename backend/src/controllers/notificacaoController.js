const notificacoes = require('../services/notificacaoService');
const { lerPaginacao } = require('../utils/paginacao');

async function listar(req, res) {
  const { pagina, limite } = lerPaginacao(req.query, 30);
  res.json(await notificacoes.listar(req.usuario.id, { somenteNaoLidas: req.query.naoLidas === 'true', pagina, limite }));
}

async function contagem(req, res) {
  res.json({ naoLidas: await notificacoes.contarNaoLidas(req.usuario.id) });
}

async function marcarLida(req, res) {
  await notificacoes.marcarLida(req.usuario.id, req.params.id);
  res.status(204).end();
}

async function marcarTodasLidas(req, res) {
  const alteradas = await notificacoes.marcarTodasLidas(req.usuario.id);
  res.json({ alteradas });
}

module.exports = { listar, contagem, marcarLida, marcarTodasLidas };

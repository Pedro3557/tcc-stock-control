const configuracoes = require('../services/configuracaoService');
const auditoria = require('../services/auditoriaService');

async function obterTodas(req, res) {
  res.json({ valores: await configuracoes.obterTodas(), smtpConfigurado: Boolean(process.env.SMTP_HOST) });
}

async function obterPublicas(req, res) {
  res.json(await configuracoes.obterPublicas());
}

async function atualizar(req, res) {
  const { antes, depois } = await configuracoes.definir(req.body.valores, req.usuario);
  if (Object.keys(depois).length) {
    await auditoria.registrar({ req, acao: 'atualizar', modulo: 'configuracoes', antes, depois });
  }
  res.json({ mensagem: 'Configurações salvas.', valores: await configuracoes.obterTodas() });
}

module.exports = { obterTodas, obterPublicas, atualizar };

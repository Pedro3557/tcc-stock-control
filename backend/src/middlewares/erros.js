const { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } = require('sequelize');
const AppError = require('../utils/AppError');

const CAMPOS = {
  email: 'e-mail',
  codigo: 'código (SKU)',
  numeroSerie: 'número de série',
  mac: 'MAC',
  cnpj: 'CNPJ',
  nome: 'nome',
};

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

 
function tratarErros(erro, req, res, next) {
  if (erro instanceof AppError) {
    return res.status(erro.status).json({ erro: erro.message, detalhes: erro.detalhes });
  }

  if (erro instanceof UniqueConstraintError) {
    const campo = erro.errors?.[0]?.path?.replace(/^.*\./, '');
    const nomeCampo = CAMPOS[campo] || campo || 'valor';
    return res.status(409).json({ erro: `Já existe um registro com este ${nomeCampo}.` });
  }

  if (erro instanceof ForeignKeyConstraintError) {
    return res.status(400).json({
      erro: 'Operação não permitida: o registro está vinculado a outros dados ou referencia um registro inexistente.',
    });
  }

  if (erro instanceof ValidationError) {
    const detalhes = erro.errors.map((e) => ({ campo: e.path, mensagem: e.message }));
    return res.status(400).json({ erro: 'Dados inválidos.', detalhes });
  }

  if (erro.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }

  console.error('[erro]', erro);
  return res.status(500).json({ erro: 'Erro interno no servidor. Tente novamente ou contate o suporte.' });
}

module.exports = { rotaNaoEncontrada, tratarErros };

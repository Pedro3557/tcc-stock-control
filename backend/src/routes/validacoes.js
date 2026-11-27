const { body, param, query } = require('express-validator');
const { PERFIS, TIPOS_CONTROLE, UNIDADES, TIPOS_MOVIMENTACAO, STATUS_EQUIPAMENTO } = require('../config/constantes');

const id = [param('id').isInt({ min: 1 }).withMessage('ID inválido.')];

const login = [
  body('email').trim().notEmpty().withMessage('Informe o e-mail.').bail().isEmail().withMessage('E-mail inválido.'),
  body('senha').notEmpty().withMessage('Informe a senha.'),
];

const trocarSenha = [
  body('senhaAtual').notEmpty().withMessage('Informe a senha atual.'),
  body('novaSenha')
    .isString().withMessage('Informe a nova senha.').bail()
    .isLength({ min: 8 }).withMessage('A nova senha deve ter pelo menos 8 caracteres.').bail()
    .matches(/[A-Za-z]/).withMessage('A nova senha deve ter ao menos uma letra.').bail()
    .matches(/\d/).withMessage('A nova senha deve ter ao menos um número.'),
];

const categoria = [
  body('nome').isString().withMessage('Informe o nome.').bail().trim().isLength({ min: 2, max: 80 }).withMessage('O nome da categoria deve ter entre 2 e 80 caracteres.'),
];

const produto = (parcial = false) => {
  const opc = (campo) => (parcial ? body(campo).optional() : body(campo));
  return [
    opc('categoriaId').isInt({ min: 1 }).withMessage('Selecione a categoria.'),
    opc('codigo').isString().withMessage('Informe o código (SKU).').bail().trim().isLength({ min: 1, max: 40 }).withMessage('Informe o código (SKU) com até 40 caracteres.'),
    opc('nome').isString().withMessage('Informe o nome do produto.').bail().trim().isLength({ min: 2, max: 150 }).withMessage('Informe o nome do produto (2 a 150 caracteres).'),
    opc('tipoControle').isIn(TIPOS_CONTROLE).withMessage('Tipo de controle deve ser "serializado" ou "quantidade".'),
    body('unidade').optional().isIn(UNIDADES).withMessage(`Unidade inválida. Use: ${UNIDADES.join(', ')}.`),
    body('descricao').optional({ values: 'null' }).isString().isLength({ max: 2000 }).withMessage('Descrição muito longa (máx. 2000 caracteres).'),
    body('marca').optional({ values: 'null' }).isString().isLength({ max: 80 }).withMessage('Marca muito longa.'),
    body('modelo').optional({ values: 'null' }).isString().isLength({ max: 80 }).withMessage('Modelo muito longo.'),
    body('local').optional({ values: 'null' }).isString().isLength({ max: 60 }).withMessage('Local muito longo.'),
    body('estoqueMinimo').optional().isFloat({ min: 0 }).withMessage('Estoque mínimo deve ser zero ou maior.').toFloat(),
    body('custoUnitario').optional().isFloat({ min: 0, max: 99999999.99 }).withMessage('Custo unitário inválido.').toFloat(),
    body('ativo').optional().isBoolean().withMessage('Campo "ativo" inválido.').toBoolean(),
  ];
};

const tecnico = [
  body('nome').isString().withMessage('Informe o nome.').bail().trim().isLength({ min: 2, max: 120 }).withMessage('Informe o nome do técnico (2 a 120 caracteres).'),
  body('telefone').optional({ values: 'falsy' }).isString().isLength({ max: 20 }).withMessage('Telefone muito longo.'),
  body('equipe').optional({ values: 'falsy' }).isString().isLength({ max: 60 }).withMessage('Equipe muito longa.'),
  body('ativo').optional().isBoolean().toBoolean(),
];

const fornecedor = [
  body('nome').isString().withMessage('Informe o nome.').bail().trim().isLength({ min: 2, max: 150 }).withMessage('Informe o nome do fornecedor (2 a 150 caracteres).'),
  body('cnpj')
    .optional({ values: 'falsy' })
    .matches(/^(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})$/)
    .withMessage('CNPJ inválido. Use o formato 00.000.000/0000-00.'),
  body('telefone').optional({ values: 'falsy' }).isString().isLength({ max: 20 }).withMessage('Telefone muito longo.'),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('E-mail do fornecedor inválido.'),
];

const usuario = (parcial = false) => {
  const opc = (campo) => (parcial ? body(campo).optional() : body(campo));
  return [
    opc('nome').isString().withMessage('Informe o nome.').bail().trim().isLength({ min: 2, max: 120 }).withMessage('Informe o nome (2 a 120 caracteres).'),
    opc('email').isEmail().withMessage('E-mail inválido.'),
    opc('perfil').isIn(PERFIS).withMessage('Perfil inválido. Use admin, almoxarife ou consulta.'),
    (parcial ? body('senha').optional({ values: 'falsy' }) : body('senha'))
      .isLength({ min: 8 })
      .withMessage('A senha deve ter pelo menos 8 caracteres.')
      .bail()
      .matches(/[A-Za-z]/)
      .withMessage('A senha deve ter ao menos uma letra.')
      .bail()
      .matches(/\d/)
      .withMessage('A senha deve ter ao menos um número.'),
    body('ativo').optional().isBoolean().toBoolean(),
    body('recebeNotificacoes').optional().isBoolean().withMessage('Campo "recebe notificações" inválido.').toBoolean(),
    body('recebeEmail').optional().isBoolean().withMessage('Campo "recebe e-mail" inválido.').toBoolean(),
  ];
};

const equipamento = [
  body('mac').optional({ values: 'null' }).isString().withMessage('MAC inválido.'),
  body('observacao').optional({ values: 'null' }).isString(),
  body('numeroSerie').optional().isString().isLength({ max: 80 }).withMessage('Número de série muito longo.'),
];

const movimentacao = [
  body('tipo').isIn(TIPOS_MOVIMENTACAO).withMessage('Tipo de movimentação inválido.'),
  body('produtoId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Produto inválido.'),
  body('tecnicoId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Técnico inválido.'),
  body('fornecedorId').optional({ values: 'falsy' }).isInt({ min: 1 }).withMessage('Fornecedor inválido.'),
  body('quantidade').optional({ values: 'falsy' }).isFloat({ gt: 0 }).withMessage('A quantidade deve ser maior que zero.'),
  body('novaQuantidade').optional({ values: 'null' }).isFloat({ min: 0 }).withMessage('A quantidade contada deve ser zero ou maior.'),
  body('custoUnitario').optional({ values: 'falsy' }).isFloat({ min: 0 }).withMessage('Custo unitário inválido.'),
  body('equipamentoIds').optional().isArray().withMessage('equipamentoIds deve ser uma lista.'),
  body('seriais').optional().custom((v) => typeof v === 'string' || Array.isArray(v)).withMessage('Lista de números de série inválida.'),
  body('destino').optional({ values: 'falsy' }).isIn(STATUS_EQUIPAMENTO).withMessage('Destino inválido.'),
  body('clienteCodigo').optional({ values: 'null' }).isString().isLength({ max: 40 }).withMessage('Código do cliente muito longo.'),
  body('clienteNome').optional({ values: 'null' }).isString().isLength({ max: 150 }).withMessage('Nome do cliente muito longo.'),
  body('numeroOS').optional({ values: 'null' }).isString().isLength({ max: 40 }).withMessage('Número da OS muito longo.'),
  body('notaFiscal').optional({ values: 'null' }).isString().isLength({ max: 60 }).withMessage('Nota fiscal muito longa.'),
  body('observacao').optional({ values: 'null' }).isString().isLength({ max: 2000 }).withMessage('Observação muito longa.'),
];

const filtrosMovimentacao = [
  query('tipo').optional().custom((v) => String(v).split(',').every((t) => TIPOS_MOVIMENTACAO.includes(t))).withMessage('Tipo inválido.'),
  query('produtoId').optional().isInt({ min: 1 }).withMessage('Produto inválido.'),
  query('tecnicoId').optional().isInt({ min: 1 }).withMessage('Técnico inválido.'),
  query('fornecedorId').optional().isInt({ min: 1 }).withMessage('Fornecedor inválido.'),
  query('equipamentoId').optional().isInt({ min: 1 }).withMessage('Equipamento inválido.'),
];

const configuracoes = [
  body('valores').isObject().withMessage('Envie as configurações no campo "valores".'),
];

const filtrosAuditoria = [
  query('usuarioId').optional().isInt({ min: 1 }).withMessage('Usuário inválido.'),
  query('resultado').optional().isIn(['sucesso', 'falha']).withMessage('Resultado inválido.'),
];

const restauracao = [
  body('confirmacao').isString().withMessage('Digite RESTAURAR para confirmar.'),
  body('senha').isString().notEmpty().withMessage('Informe a sua senha para confirmar.'),
];

const filtrosEquipamento = [
  query('status').optional().custom((v) => String(v).split(',').every((s) => STATUS_EQUIPAMENTO.includes(s))).withMessage('Status inválido.'),
  query('produtoId').optional().isInt({ min: 1 }).withMessage('Produto inválido.'),
];

module.exports = {
  id,
  login,
  trocarSenha,
  categoria,
  produto,
  tecnico,
  fornecedor,
  usuario,
  equipamento,
  movimentacao,
  filtrosMovimentacao,
  filtrosEquipamento,
  configuracoes,
  filtrosAuditoria,
  restauracao,
};

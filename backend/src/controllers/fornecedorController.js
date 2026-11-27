const { Op } = require('sequelize');
const { Fornecedor, Movimentacao } = require('../models');
const AppError = require('../utils/AppError');
const { textoOuNull } = require('../utils/formatos');
const auditoria = require('../services/auditoriaService');


function dadosFornecedor(body) {
  return {
    nome: body.nome?.trim(),
    cnpj: textoOuNull(body.cnpj),
    telefone: textoOuNull(body.telefone),
    email: textoOuNull(body.email)?.toLowerCase() || null,
  };
}

async function listar(req, res) {
  const where = {};
  if (req.query.busca) {
    const termo = `%${req.query.busca.trim()}%`;
    where[Op.or] = [{ nome: { [Op.like]: termo } }, { cnpj: { [Op.like]: termo } }];
  }
  res.json(await Fornecedor.findAll({ where, order: [['nome', 'ASC']] }));
}

async function obter(req, res) {
  const fornecedor = await Fornecedor.findByPk(req.params.id);
  if (!fornecedor) throw new AppError('Fornecedor não encontrado.', 404);
  res.json(fornecedor);
}

async function criar(req, res) {
  const fornecedor = await Fornecedor.create(dadosFornecedor(req.body));
  await auditoria.registrar({ req, acao: 'criar', modulo: 'fornecedores', registroId: fornecedor.id, depois: fornecedor });
  res.status(201).json(fornecedor);
}

async function atualizar(req, res) {
  const fornecedor = await Fornecedor.findByPk(req.params.id);
  if (!fornecedor) throw new AppError('Fornecedor não encontrado.', 404);
  const antes = fornecedor.toJSON();
  await fornecedor.update(dadosFornecedor(req.body));
  await auditoria.registrar({ req, acao: 'atualizar', modulo: 'fornecedores', registroId: fornecedor.id, antes, depois: fornecedor });
  res.json(fornecedor);
}

async function excluir(req, res) {
  const fornecedor = await Fornecedor.findByPk(req.params.id);
  if (!fornecedor) throw new AppError('Fornecedor não encontrado.', 404);
  const usos = await Movimentacao.count({ where: { fornecedorId: fornecedor.id } });
  if (usos > 0) {
    throw new AppError(`Não é possível excluir: o fornecedor possui ${usos} movimentação(ões) registrada(s).`);
  }
  const antes = fornecedor.toJSON();
  await fornecedor.destroy();
  await auditoria.registrar({ req, acao: 'excluir', modulo: 'fornecedores', registroId: antes.id, antes });
  res.status(204).end();
}

module.exports = { listar, obter, criar, atualizar, excluir };

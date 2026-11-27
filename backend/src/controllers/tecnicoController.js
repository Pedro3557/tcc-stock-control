const { Op } = require('sequelize');
const { Tecnico, Equipamento, Produto, sequelize } = require('../models');
const AppError = require('../utils/AppError');
const { textoOuNull } = require('../utils/formatos');
const auditoria = require('../services/auditoriaService');


function dadosTecnico(body) {
  return {
    nome: body.nome?.trim(),
    telefone: textoOuNull(body.telefone),
    equipe: textoOuNull(body.equipe),
  };
}

/** Materiais (por quantidade) em posse de técnicos, agrupados por técnico e produto. */
async function materiaisComTecnicos(tecnicoId) {
  return sequelize.query(
    `SELECT m.tecnicoId, p.id AS produtoId, p.codigo, p.nome, p.unidade, p.custoUnitario,
            SUM(CASE m.tipo WHEN 'saida_tecnico' THEN m.quantidade
                            WHEN 'devolucao_tecnico' THEN -m.quantidade
                            WHEN 'baixa' THEN -m.quantidade ELSE 0 END) AS quantidade
       FROM movimentacoes m
       JOIN produtos p ON p.id = m.produtoId
      WHERE m.equipamentoId IS NULL AND m.tecnicoId IS NOT NULL
        ${tecnicoId ? 'AND m.tecnicoId = :tecnicoId' : ''}
      GROUP BY m.tecnicoId, p.id, p.codigo, p.nome, p.unidade, p.custoUnitario
     HAVING quantidade > 0
      ORDER BY p.nome`,
    { replacements: { tecnicoId }, type: sequelize.QueryTypes.SELECT }
  );
}

async function listar(req, res) {
  const where = {};
  if (req.query.incluirInativos !== 'true') where.ativo = true;
  if (req.query.busca) {
    const termo = `%${req.query.busca.trim()}%`;
    where[Op.or] = [{ nome: { [Op.like]: termo } }, { equipe: { [Op.like]: termo } }];
  }
  const tecnicos = await Tecnico.findAll({ where, order: [['nome', 'ASC']] });

  // Resumo do que cada técnico tem em mãos
  const equipamentos = await Equipamento.findAll({
    where: { status: 'com_tecnico' },
    attributes: ['tecnicoId', [sequelize.fn('COUNT', sequelize.col('id')), 'total']],
    group: ['tecnicoId'],
    raw: true,
  });
  const materiais = await materiaisComTecnicos();

  const resultado = tecnicos.map((t) => {
    const eq = equipamentos.find((e) => e.tecnicoId === t.id);
    const mats = materiais.filter((m) => m.tecnicoId === t.id);
    const valorMateriais = mats.reduce((s, m) => s + Number(m.quantidade) * Number(m.custoUnitario), 0);
    return {
      ...t.toJSON(),
      totalEquipamentos: Number(eq?.total || 0),
      totalItensMaterial: mats.length,
      valorMateriais: Math.round(valorMateriais * 100) / 100,
    };
  });
  res.json(resultado);
}

async function obter(req, res) {
  const tecnico = await Tecnico.findByPk(req.params.id);
  if (!tecnico) throw new AppError('Técnico não encontrado.', 404);
  res.json(tecnico);
}

async function estoque(req, res) {
  const tecnico = await Tecnico.findByPk(req.params.id);
  if (!tecnico) throw new AppError('Técnico não encontrado.', 404);

  const equipamentos = await Equipamento.findAll({
    where: { tecnicoId: tecnico.id, status: 'com_tecnico' },
    include: [{ model: Produto, as: 'produto', attributes: ['id', 'codigo', 'nome', 'marca', 'modelo', 'custoUnitario'] }],
    order: [['updatedAt', 'DESC']],
  });
  const materiais = (await materiaisComTecnicos(tecnico.id)).map((m) => ({
    produtoId: m.produtoId,
    codigo: m.codigo,
    nome: m.nome,
    unidade: m.unidade,
    quantidade: Number(m.quantidade),
    custoUnitario: Number(m.custoUnitario),
    valor: Math.round(Number(m.quantidade) * Number(m.custoUnitario) * 100) / 100,
  }));

  const valorEquipamentos = equipamentos.reduce((s, e) => s + Number(e.produto?.custoUnitario || 0), 0);
  const valorMateriais = materiais.reduce((s, m) => s + m.valor, 0);

  res.json({
    tecnico,
    equipamentos,
    materiais,
    totais: {
      equipamentos: equipamentos.length,
      materiais: materiais.length,
      valor: Math.round((valorEquipamentos + valorMateriais) * 100) / 100,
    },
  });
}

async function criar(req, res) {
  const tecnico = await Tecnico.create({ ...dadosTecnico(req.body), ativo: true });
  await auditoria.registrar({ req, acao: 'criar', modulo: 'tecnicos', registroId: tecnico.id, depois: tecnico });
  res.status(201).json(tecnico);
}

async function atualizar(req, res) {
  const tecnico = await Tecnico.findByPk(req.params.id);
  if (!tecnico) throw new AppError('Técnico não encontrado.', 404);
  const dados = dadosTecnico(req.body);
  if (req.body.ativo !== undefined) dados.ativo = Boolean(req.body.ativo);
  const antes = tecnico.toJSON();
  await tecnico.update(dados);
  await auditoria.registrar({ req, acao: 'atualizar', modulo: 'tecnicos', registroId: tecnico.id, antes, depois: tecnico });
  res.json(tecnico);
}

async function excluir(req, res) {
  const tecnico = await Tecnico.findByPk(req.params.id);
  if (!tecnico) throw new AppError('Técnico não encontrado.', 404);
  const comEquipamentos = await Equipamento.count({ where: { tecnicoId: tecnico.id, status: 'com_tecnico' } });
  const materiais = await materiaisComTecnicos(tecnico.id);
  if (comEquipamentos > 0 || materiais.length > 0) {
    throw new AppError('O técnico ainda tem equipamentos ou materiais em mãos. Registre a devolução ou baixa antes de inativá-lo.');
  }
  const antes = tecnico.toJSON();
  // Exclusão lógica para manter o histórico
  await tecnico.update({ ativo: false });
  await auditoria.registrar({ req, acao: 'inativar', modulo: 'tecnicos', registroId: tecnico.id, antes, depois: tecnico });
  res.status(204).end();
}

/**
 * Equipamentos em posse de técnicos (pendentes de devolução ou de instalação), do mais antigo para o mais recente.
 * "dias" = tempo desde a última movimentação da unidade.
 */
async function pendencias(req, res) {
  const where = { status: 'com_tecnico' };
  if (req.query.tecnicoId) where.tecnicoId = req.query.tecnicoId;
  const equipamentos = await Equipamento.findAll({
    where,
    include: [
      { model: Produto, as: 'produto', attributes: ['id', 'codigo', 'nome', 'custoUnitario'] },
      { model: Tecnico, as: 'tecnico', attributes: ['id', 'nome', 'equipe', 'telefone'] },
    ],
    order: [['updatedAt', 'ASC']],
  });
  const agora = Date.now();
  res.json(
    equipamentos.map((e) => ({
      id: e.id,
      numeroSerie: e.numeroSerie,
      mac: e.mac,
      produto: e.produto,
      tecnico: e.tecnico,
      desde: e.updatedAt,
      dias: Math.floor((agora - new Date(e.updatedAt).getTime()) / 86400000),
    }))
  );
}

module.exports = { listar, obter, estoque, pendencias, criar, atualizar, excluir, materiaisComTecnicos };

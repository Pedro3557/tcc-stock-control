const importacaoService = require('../services/importacaoService');
const AppError = require('../utils/AppError');
const auditoria = require('../services/auditoriaService');
const notificacoes = require('../services/notificacaoService');
const { Produto } = require('../models');

/** Importações que gravam (simular=false) ficam na auditoria, com o resultado. */
async function auditar(req, tipo, resultado) {
  if (resultado.simulado) return;
  await auditoria.registrar({
    req,
    acao: 'importar',
    modulo: 'importacao',
    registroId: tipo,
    resultado: resultado.gravado ? 'sucesso' : 'falha',
    detalhe: `Planilha "${req.file?.originalname}" — ${resultado.gravado ? 'gravada' : `${resultado.erros.length} erro(s), nada gravado`}`,
    depois: resultado,
  });
}

function arquivoObrigatorio(req) {
  if (!req.file) throw new AppError('Selecione a planilha (.xlsx) para importar.');
  return req.file.buffer;
}

// "simular" vem como texto no multipart: só grava quando simular=false
const ehSimulacao = (req) => String(req.body.simular ?? 'true') !== 'false';

async function produtos(req, res) {
  const resultado = await importacaoService.importarProdutos(arquivoObrigatorio(req), { simular: ehSimulacao(req) });
  await auditar(req, 'produtos', resultado);
  res.json(resultado);
}

async function entrada(req, res) {
  const resultado = await importacaoService.importarEntrada(arquivoObrigatorio(req), req.usuario, {
    simular: ehSimulacao(req),
    fornecedorId: Number(req.body.fornecedorId) || null,
    notaFiscal: req.body.notaFiscal,
    observacao: req.body.observacao,
  });
  await auditar(req, 'entrada', resultado);
  if (resultado.gravado) {
    const produtos = await Produto.findAll({ where: { codigo: resultado.itens.map((i) => i.codigo) }, attributes: ['id'] });
    await notificacoes.verificarEstoque(produtos.map((p) => p.id));
  }
  res.json(resultado);
}

async function modelo(req, res) {
  const { arquivo, buffer } = await importacaoService.gerarModelo(req.params.tipo);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${arquivo}"`);
  res.send(Buffer.from(buffer));
}

module.exports = { produtos, entrada, modelo };

const importacaoService = require('../services/importacaoService');
const AppError = require('../utils/AppError');

function arquivoObrigatorio(req) {
  if (!req.file) throw new AppError('Selecione a planilha (.xlsx) para importar.');
  return req.file.buffer;
}

// "simular" vem como texto no multipart: só grava quando simular=false
const ehSimulacao = (req) => String(req.body.simular ?? 'true') !== 'false';

async function produtos(req, res) {
  const resultado = await importacaoService.importarProdutos(arquivoObrigatorio(req), { simular: ehSimulacao(req) });
  res.json(resultado);
}

async function entrada(req, res) {
  const resultado = await importacaoService.importarEntrada(arquivoObrigatorio(req), req.usuario, {
    simular: ehSimulacao(req),
    fornecedorId: Number(req.body.fornecedorId) || null,
    notaFiscal: req.body.notaFiscal,
    observacao: req.body.observacao,
  });
  res.json(resultado);
}

async function modelo(req, res) {
  const { arquivo, buffer } = await importacaoService.gerarModelo(req.params.tipo);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${arquivo}"`);
  res.send(Buffer.from(buffer));
}

module.exports = { produtos, entrada, modelo };

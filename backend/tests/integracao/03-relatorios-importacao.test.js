const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const amb = require('./ambiente');

let app;
let admin;
let c;

async function planilha(linhas) {
  const wb = new ExcelJS.Workbook();
  const aba = wb.addWorksheet('Dados');
  linhas.forEach((l) => aba.addRow(l));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Supertest não decodifica binários por padrão: junta os bytes da resposta. */
const binario = (req) =>
  req.buffer(true).parse((res, cb) => {
    const partes = [];
    res.on('data', (d) => partes.push(d));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });

before(async () => {
  await amb.prepararBanco();
  app = require('../../src/app');
  admin = await amb.entrar(app, 'admin@provedor.com', 'admin123');
  c = await amb.cadastrosBasicos(admin);
  await admin.put('/configuracoes', { valores: { 'organizacao.nome': 'Provedor Teste Ltda', 'organizacao.cnpj': '12.345.678/0001-90' } });
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 10, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-1' });
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-1', seriais: 'R-1\nR-2\nR-3' });
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', seriais: 'R-1', tecnicoId: c.tecnico.id });
  await admin.post('/movimentacoes', { tipo: 'instalacao_cliente', seriais: 'R-2', clienteCodigo: '555', numeroOS: 'OS-55' });
  await admin.post('/movimentacoes', { tipo: 'envio_manutencao', seriais: 'R-3', observacao: 'Porta PON queimada' });
});
after(amb.encerrar);

const RELATORIOS = ['estoque', 'abaixo_minimo', 'equipamentos', 'com_tecnicos', 'comodato', 'manutencao', 'movimentacoes'];

test('todos os relatórios geram dados para PDF com organização, emissão e filtros', async () => {
  for (const nome of RELATORIOS) {
     
    const r = await admin.get(`/relatorios/dados?relatorio=${nome}`);
    assert.equal(r.status, 200, nome);
    assert.equal(r.body.organizacao, 'Provedor Teste Ltda', nome);
    assert.ok(r.body.emitidoEm && r.body.emitidoPor, nome);
    assert.ok(Array.isArray(r.body.linhas), nome);
  }
  const abaixo = (await admin.get('/relatorios/dados?relatorio=abaixo_minimo')).body;
  assert.ok(abaixo.linhas.some((l) => l.codigo === 'T-CONECTOR'), 'conector (10 < 20) está abaixo do mínimo');
  const tec = (await admin.get(`/relatorios/dados?relatorio=com_tecnicos&tecnicoId=${c.tecnico.id}`)).body;
  assert.equal(tec.filtros, 'Técnico: Técnico Teste', 'filtro descrito com o nome');
  assert.ok(tec.linhas.some((l) => l.numeroSerie === 'R-1'));
  assert.equal((await admin.get('/relatorios/dados?relatorio=comodato')).body.linhas[0].clienteCodigo, '555');
  assert.equal((await admin.get('/relatorios/dados?relatorio=manutencao')).body.linhas[0].problema, 'Porta PON queimada');
  assert.equal((await admin.get('/relatorios/dados?relatorio=inexistente')).status, 400);
});

test('CSV separado por ponto e vírgula, com BOM e identificação no topo', async () => {
  const r = await admin.get('/relatorios/exportar?relatorio=movimentacoes&tipo=entrada_compra&inicio=2020-01-01');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/csv/);
  assert.match(r.headers['content-disposition'], /movimentacoes-\d{4}-\d{2}-\d{2}\.csv/);
  assert.ok(r.text.startsWith('﻿Organização;Provedor Teste Ltda (CNPJ 12.345.678/0001-90)'));
  assert.match(r.text, /Filtros;Período: 01\/01\/2020 a hoje · Tipo: Entrada \(compra\)/);
  assert.match(r.text, /Data\/hora;Tipo;Código;Produto/);
  const linhasDados = r.text.split('\r\n').filter((l) => l.includes(';Entrada (compra);'));
  assert.equal(linhasDados.length, 4, '1 material + 3 equipamentos');
});

test('modelos de planilha para download são .xlsx válidos', async () => {
  for (const tipo of ['produtos', 'entrada']) {
     
    const r = await binario(admin.get(`/importacao/modelo/${tipo}`));
    assert.equal(r.status, 200);
    assert.equal(r.body.subarray(0, 2).toString(), 'PK', 'arquivo .xlsx (zip)');
    const wb = new ExcelJS.Workbook();
     
    await wb.xlsx.load(r.body);
    assert.ok(wb.getWorksheet('Instruções'));
  }
});

test('importação de produtos: prévia não grava, erros por linha e duplicados identificados', async () => {
  const comErros = await planilha([
    ['Código', 'Nome', 'Categoria', 'Tipo de controle', 'Unidade', 'Estoque mínimo', 'Custo unitário'],
    ['NOVO-1', 'Produto novo', 'Categoria Nova', 'quantidade', 'm', '10', '1,50'],
    ['NOVO-1', 'Repetido', 'Categoria Nova', 'quantidade', 'un', '', ''],
    ['', 'Sem código', 'X', '', '', '', ''],
    ['NOVO-2', 'Tipo inválido', 'X', 'qualquer', '', '', ''],
  ]);
  const r = await admin.upload('/importacao/produtos', { simular: 'false' }, comErros, 'produtos.xlsx');
  assert.equal(r.status, 200);
  assert.equal(r.body.gravado, false);
  assert.deepEqual(r.body.erros.map((e) => e.linha), [3, 4, 5]);
  assert.match(r.body.erros[0].mensagem, /repetido/);
  assert.equal((await admin.get('/produtos?busca=NOVO-1')).body.length, 0, 'com erro, nada é gravado');

  const ok = await planilha([
    ['codigo', 'nome', 'categoria', 'descricao', 'tipo_controle', 'unidade', 'estoque_minimo', 'custo_unitario'],
    ['NOVO-1', 'Produto novo', 'Categoria Nova', '', 'quantidade', 'metro', '10', '1,50'],
    ['T-CONECTOR', 'Conector renomeado', 'Categoria de teste', '', '', 'un', '25', ''],
  ]);
  const previa = await admin.upload('/importacao/produtos', {}, ok, 'produtos.xlsx');
  assert.equal(previa.body.simulado, true);
  assert.equal(previa.body.criados.length, 1);
  assert.equal(previa.body.atualizados.length, 1, 'código existente é identificado e atualizado');
  assert.equal((await admin.get('/produtos?busca=NOVO-1')).body.length, 0, 'prévia não grava');

  const gravar = await admin.upload('/importacao/produtos', { simular: 'false' }, ok, 'produtos.xlsx');
  assert.equal(gravar.body.gravado, true);
  const novo = (await admin.get('/produtos?busca=NOVO-1')).body[0];
  assert.equal(novo.unidade, 'm');
  assert.equal(Number(novo.custoUnitario), 1.5);
  assert.equal(novo.categoria.nome, 'Categoria Nova', 'categoria criada automaticamente');
  const conector = (await admin.get(`/produtos/${c.conector.id}`)).body;
  assert.equal(conector.nome, 'Conector renomeado');
  assert.equal(Number(conector.quantidade), 10, 'importação de cadastro não muda o saldo');
});

test('importação de entrada: materiais e seriais numa transação única (tudo ou nada)', async () => {
  const sheet = await planilha([
    ['codigo', 'quantidade', 'numero_serie', 'mac', 'custo_unitario'],
    ['T-CONECTOR', '5', '', '', ''],
    ['T-CONECTOR', '5', '', '', '3,00'],
    ['T-ONU', '', 'IMP-1', 'aa:bb:cc:dd:ee:10', ''],
    ['T-ONU', '', 'R-1', '', ''],
  ]);
  const semNota = await admin.upload('/importacao/entrada', { fornecedorId: c.fornecedor.id }, sheet, 'entrada.xlsx');
  assert.equal(semNota.status, 400);

  const duplicado = await admin.upload('/importacao/entrada', { fornecedorId: c.fornecedor.id, notaFiscal: 'NF-9', simular: 'false' }, sheet, 'entrada.xlsx');
  assert.equal(duplicado.body.gravado, false);
  assert.match(duplicado.body.erros[0].mensagem, /R-1/);
  assert.equal(Number((await admin.get(`/produtos/${c.conector.id}`)).body.quantidade), 10, 'material não entrou porque a ONU falhou');

  const ok = await planilha([
    ['codigo', 'quantidade', 'numero_serie', 'mac'],
    ['T-CONECTOR', '5', '', ''],
    ['T-CONECTOR', '5', '', ''],
    ['T-ONU', '', 'IMP-1', 'aa:bb:cc:dd:ee:10'],
  ]);
  const r = await admin.upload('/importacao/entrada', { fornecedorId: c.fornecedor.id, notaFiscal: 'NF-9', simular: 'false' }, ok, 'entrada.xlsx');
  assert.equal(r.body.gravado, true);
  assert.equal(Number((await admin.get(`/produtos/${c.conector.id}`)).body.quantidade), 20, 'linhas do mesmo código somadas');
  const { Auditoria } = require('../../src/models');
  assert.ok(await Auditoria.findOne({ where: { modulo: 'importacao', acao: 'importar', resultado: 'sucesso' } }));
});

test('upload recusa arquivos que não são .xlsx', async () => {
  const r = await admin.upload('/importacao/produtos', {}, Buffer.from('a;b;c'), 'planilha.csv');
  assert.equal(r.status, 400);
  assert.match(r.body.erro, /xlsx/);
});

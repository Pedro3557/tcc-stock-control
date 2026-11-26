/**
 * Testes das regras puras (não precisam de banco de dados).
 * Rodar com: npm test
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');

const { normalizarMac, pareceMac } = require('../src/utils/formatos');
const { interpretarListaEntrada, REGRAS_SERIALIZADO } = require('../src/services/movimentacaoService');
const { gerarCSV, numeroBR, quantidadeBR } = require('../src/services/csv');
const {
  lerPlanilha,
  normalizarCabecalho,
  numeroPlanilha,
  tipoControlePlanilha,
} = require('../src/services/importacaoService');

test('normaliza MAC em vários formatos para AA:BB:CC:DD:EE:FF', () => {
  assert.equal(normalizarMac('aabbccddeeff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizarMac('aa-bb-cc-dd-ee-ff'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizarMac('AABB.CCDD.EEFF'), 'AA:BB:CC:DD:EE:FF');
  assert.equal(normalizarMac(''), null);
  assert.equal(normalizarMac(null), null);
});

test('rejeita MAC inválido com mensagem em português', () => {
  assert.throws(() => normalizarMac('ZZ:BB:CC:DD:EE:FF'), /MAC inválido/);
  assert.throws(() => normalizarMac('AA:BB:CC'), /MAC inválido/);
});

test('reconhece texto que parece MAC', () => {
  assert.ok(pareceMac('E0:24:7F:10:00:01'));
  assert.ok(pareceMac('e0247f100001'));
  assert.ok(!pareceMac('HWTC1A2B3C01'));
});

test('interpreta a lista de seriais colada na entrada (SERIAL;MAC, vírgula ou TAB)', () => {
  const lista = interpretarListaEntrada('hwtc01;aabbccddee01\nHWTC02,AA-BB-CC-DD-EE-02\n\nHWTC03\tAABBCCDDEE03\nSFP001');
  assert.deepEqual(lista, [
    { numeroSerie: 'HWTC01', mac: 'AA:BB:CC:DD:EE:01' },
    { numeroSerie: 'HWTC02', mac: 'AA:BB:CC:DD:EE:02' },
    { numeroSerie: 'HWTC03', mac: 'AA:BB:CC:DD:EE:03' },
    { numeroSerie: 'SFP001', mac: null },
  ]);
});

test('aponta a linha com MAC inválido na lista de entrada', () => {
  assert.throws(() => interpretarListaEntrada('A1;AABBCCDDEE01\nA2;xyz'), /Linha 2: MAC inválido/);
});

test('regras de status: ONU com defeito não pode ser instalada no cliente', () => {
  assert.ok(!REGRAS_SERIALIZADO.instalacao_cliente.de.includes('defeito'));
  assert.ok(REGRAS_SERIALIZADO.instalacao_cliente.de.includes('em_estoque'));
  assert.ok(REGRAS_SERIALIZADO.instalacao_cliente.de.includes('com_tecnico'));
  assert.deepEqual(REGRAS_SERIALIZADO.retirada_cliente.de, ['instalado_cliente']);
  assert.equal(REGRAS_SERIALIZADO.retirada_cliente.para({}), 'em_estoque');
  assert.equal(REGRAS_SERIALIZADO.retirada_cliente.para({ destino: 'defeito' }), 'defeito');
  assert.ok(!REGRAS_SERIALIZADO.baixa.de.includes('instalado_cliente'));
});

test('CSV usa ponto e vírgula, BOM e escapa aspas', () => {
  const csv = gerarCSV(
    [
      { titulo: 'Produto', valor: (l) => l.nome },
      { titulo: 'Valor', valor: (l) => numeroBR(l.valor) },
    ],
    [{ nome: 'Conector "SC;APC"', valor: 2.8 }]
  );
  assert.ok(csv.startsWith('﻿Produto;Valor\r\n'));
  assert.ok(csv.includes('"Conector ""SC;APC""";2,80'));
});

test('quantidades no padrão brasileiro', () => {
  assert.equal(quantidadeBR(10), '10');
  assert.equal(quantidadeBR(12.5), '12,5');
  assert.equal(quantidadeBR(0.125), '0,125');
  assert.equal(numeroBR(1234.5), '1234,50');
});

test('cabeçalhos da planilha são normalizados', () => {
  assert.equal(normalizarCabecalho('Número de Série'), 'numero_de_serie');
  assert.equal(normalizarCabecalho('  Custo Unitário (R$) '), 'custo_unitario_r');
});

test('números da planilha aceitam vírgula decimal e milhar', () => {
  assert.equal(numeroPlanilha('1.234,56'), 1234.56);
  assert.equal(numeroPlanilha('0,45'), 0.45);
  assert.equal(numeroPlanilha('R$ 12,00'), 12);
  assert.equal(numeroPlanilha(7), 7);
  assert.equal(numeroPlanilha(''), null);
  assert.ok(Number.isNaN(numeroPlanilha('abc')));
});

test('tipo de controle da planilha aceita variações', () => {
  assert.equal(tipoControlePlanilha('Serializado'), 'serializado');
  assert.equal(tipoControlePlanilha('qtd'), 'quantidade');
  assert.equal(tipoControlePlanilha('outro'), null);
});

test('lê planilha .xlsx com cabeçalhos em português e ignora linhas vazias', async () => {
  const wb = new ExcelJS.Workbook();
  const aba = wb.addWorksheet('Dados');
  aba.addRow(['Código', 'Qtd', 'Número de série', 'MAC']);
  aba.addRow(['CABO-DROP-1F', 1000, null, null]);
  aba.addRow([]);
  aba.addRow(['ONU-HW', null, 'HWTC99', 'aabbccddee99']);
  const buffer = await wb.xlsx.writeBuffer();

  const { linhas, colunasReconhecidas } = await lerPlanilha(Buffer.from(buffer));
  assert.deepEqual(colunasReconhecidas.sort(), ['codigo', 'mac', 'numero_serie', 'quantidade']);
  assert.equal(linhas.length, 2);
  assert.equal(linhas[0].codigo, 'CABO-DROP-1F');
  assert.equal(linhas[0].quantidade, 1000);
  assert.equal(linhas[1].linha, 4);
  assert.equal(linhas[1].numero_serie, 'HWTC99');
});

test('recusa arquivo que não é planilha', async () => {
  await assert.rejects(() => lerPlanilha(Buffer.from('não sou uma planilha')), /Não foi possível ler o arquivo/);
});

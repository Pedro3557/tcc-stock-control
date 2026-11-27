const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const amb = require('./ambiente');

let app;
let admin;
let c; // cadastros básicos

const saldo = async (id) => Number((await admin.get(`/produtos/${id}`)).body.quantidade);
const mov = (corpo) => admin.post('/movimentacoes', corpo);
const equipamentoPorSerie = async (serie) => (await admin.get(`/equipamentos?busca=${serie}`)).body.dados.find((e) => e.numeroSerie === serie);

before(async () => {
  await amb.prepararBanco();
  app = require('../../src/app');
  admin = await amb.entrar(app, 'admin@provedor.com', 'admin123');
  c = await amb.cadastrosBasicos(admin);
});
after(amb.encerrar);

test('cadastro de produtos: campos obrigatórios, código único, saldo inicial zero e descrição', async () => {
  const sem = await admin.post('/produtos', { categoriaId: c.categoria.id, nome: 'Sem código', tipoControle: 'quantidade' });
  assert.equal(sem.status, 400);
  const dup = await admin.post('/produtos', { categoriaId: c.categoria.id, codigo: 't-conector', nome: 'Duplicado', tipoControle: 'quantidade' });
  assert.equal(dup.status, 409, 'código (SKU) é único, sem diferenciar maiúsculas');
  const p = await admin.post('/produtos', {
    categoriaId: c.categoria.id, codigo: 'T-SPLIT', nome: 'Splitter', descricao: 'Splitter PLC 1x8', tipoControle: 'quantidade', unidade: 'un', quantidade: 999,
  });
  assert.equal(p.status, 201);
  assert.equal(Number(p.body.quantidade), 0, 'o saldo nunca é informado no cadastro: entra por movimentação');
  assert.equal(p.body.descricao, 'Splitter PLC 1x8');
  const busca = await admin.get('/produtos?busca=PLC');
  assert.ok(busca.body.some((x) => x.codigo === 'T-SPLIT'), 'busca também pela descrição');
});

test('entrada e saída de material atualizam o saldo; estoque nunca fica negativo', async () => {
  const e = await mov({ tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 100, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-1' });
  assert.equal(e.status, 201);
  assert.equal(await saldo(c.conector.id), 100);

  const semNF = await mov({ tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 1, fornecedorId: c.fornecedor.id });
  assert.equal(semNF.status, 400);

  assert.equal((await mov({ tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 30, tecnicoId: c.tecnico.id })).status, 201);
  assert.equal(await saldo(c.conector.id), 70);

  const demais = await mov({ tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 1000, tecnicoId: c.tecnico.id });
  assert.equal(demais.status, 400);
  assert.match(demais.body.erro, /Saldo insuficiente/);
  assert.equal(await saldo(c.conector.id), 70, 'nada muda quando a operação é recusada');

  const fracao = await mov({ tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 1.5, tecnicoId: c.tecnico.id });
  assert.equal(fracao.status, 400, 'unidade "un" só aceita inteiros');

  const baixaDemais = await mov({ tipo: 'baixa', produtoId: c.conector.id, quantidade: 71, observacao: 'Perda' });
  assert.equal(baixaDemais.status, 400);
});

test('operações simultâneas não deixam o saldo negativo (bloqueio de linha)', async () => {
  await mov({ tipo: 'entrada_compra', produtoId: c.cabo.id, quantidade: 100, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-2' });
  const pedidos = Array.from({ length: 6 }, () => mov({ tipo: 'saida_tecnico', produtoId: c.cabo.id, quantidade: 30, tecnicoId: c.tecnico2.id }));
  const respostas = await Promise.all(pedidos);
  const aceitas = respostas.filter((r) => r.status === 201).length;
  assert.equal(aceitas, 3, '100 m só comportam 3 saídas de 30 m');
  assert.equal(await saldo(c.cabo.id), 10);
});

test('material com o técnico: devolução e consumo limitados ao que ele tem', async () => {
  const demais = await mov({ tipo: 'devolucao_tecnico', produtoId: c.conector.id, quantidade: 31, tecnicoId: c.tecnico.id });
  assert.equal(demais.status, 400);
  assert.equal((await mov({ tipo: 'devolucao_tecnico', produtoId: c.conector.id, quantidade: 10, tecnicoId: c.tecnico.id })).status, 201);
  assert.equal(await saldo(c.conector.id), 80);
  // consumo em OS: baixa do material em posse do técnico (não mexe no estoque central)
  assert.equal((await mov({ tipo: 'baixa', produtoId: c.conector.id, quantidade: 5, tecnicoId: c.tecnico.id, observacao: 'Consumo OS-9', numeroOS: 'OS-9' })).status, 201);
  assert.equal(await saldo(c.conector.id), 80);
  const posse = (await admin.get(`/tecnicos/${c.tecnico.id}/estoque`)).body;
  assert.equal(posse.materiais.find((m) => m.produtoId === c.conector.id).quantidade, 15);
});

test('equipamentos serializados: entrada em lote e bloqueio de série/MAC duplicados', async () => {
  const lista = 'onu-001;aa:bb:cc:00:00:01\nONU-002;AABBCC000002\nONU-003';
  const e = await mov({ tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-3', seriais: lista });
  assert.equal(e.status, 201);
  assert.equal(e.body.movimentacoes.length, 3);
  assert.equal(await saldo(c.onu.id), 3);
  const u1 = await equipamentoPorSerie('ONU-001');
  assert.equal(u1.mac, 'AA:BB:CC:00:00:01', 'MAC normalizado');
  assert.match(u1.codigoEtiqueta, /^[2-9A-HJKMNP-Z]{10}$/, 'cada unidade ganha um código de etiqueta');

  const repetidaNaLista = await mov({ tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-4', seriais: 'ONU-009\nonu-009' });
  assert.equal(repetidaNaLista.status, 400);
  const serieExistente = await mov({ tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-4', seriais: 'ONU-010\nONU-001' });
  assert.equal(serieExistente.status, 400);
  assert.match(serieExistente.body.erro, /ONU-001/);
  const macExistente = await mov({ tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-4', seriais: 'ONU-011;aa-bb-cc-00-00-02' });
  assert.equal(macExistente.status, 400);
  assert.equal(await saldo(c.onu.id), 3, 'nenhuma unidade gravada quando há duplicidade (tudo ou nada)');
});

test('transferência para técnico, devolução, comodato (instalação e retirada) e manutenção', async () => {
  // saída para técnico e devolução
  assert.equal((await mov({ tipo: 'saida_tecnico', seriais: 'ONU-001', tecnicoId: c.tecnico.id })).status, 201);
  assert.equal((await equipamentoPorSerie('ONU-001')).status, 'com_tecnico');
  assert.equal(await saldo(c.onu.id), 2);
  const pend = (await admin.get('/tecnicos/pendencias')).body;
  assert.ok(pend.some((p) => p.numeroSerie === 'ONU-001'), 'aparece nas pendências de devolução');
  const outroTecnico = await mov({ tipo: 'devolucao_tecnico', seriais: 'ONU-001', tecnicoId: c.tecnico2.id });
  assert.equal(outroTecnico.status, 400, 'só o técnico que está com a unidade pode devolvê-la');
  assert.equal((await mov({ tipo: 'devolucao_tecnico', seriais: 'ONU-001' })).status, 201);
  assert.equal((await equipamentoPorSerie('ONU-001')).status, 'em_estoque');

  // comodato
  const semOS = await mov({ tipo: 'instalacao_cliente', seriais: 'ONU-001', clienteCodigo: 'C-100' });
  assert.equal(semOS.status, 400);
  assert.equal((await mov({ tipo: 'instalacao_cliente', seriais: 'ONU-001', clienteCodigo: 'C-100', clienteNome: 'Cliente Teste', numeroOS: 'OS-1' })).status, 201);
  let u = await equipamentoPorSerie('ONU-001');
  assert.equal(u.status, 'instalado_cliente');
  assert.equal(u.clienteCodigo, 'C-100');
  const comodato = (await admin.get('/relatorios/dados?relatorio=comodato')).body;
  assert.equal(comodato.linhas.find((l) => l.numeroSerie === 'ONU-001').numeroOS, 'OS-1');
  assert.equal((await mov({ tipo: 'retirada_cliente', seriais: 'ONU-001', destino: 'defeito', numeroOS: 'OS-2', observacao: 'Troca' })).status, 201);
  u = await equipamentoPorSerie('ONU-001');
  assert.equal(u.status, 'defeito');
  assert.equal(u.clienteCodigo, null);

  // equipamento com defeito não pode ser instalado
  const defeituosa = await mov({ tipo: 'instalacao_cliente', seriais: 'ONU-001', clienteCodigo: 'C-200', numeroOS: 'OS-3' });
  assert.equal(defeituosa.status, 400);
  assert.match(defeituosa.body.erro, /Defeito/);

  // manutenção
  const semDescricao = await mov({ tipo: 'envio_manutencao', seriais: 'ONU-001' });
  assert.equal(semDescricao.status, 400, 'descrição do problema obrigatória');
  assert.equal((await mov({ tipo: 'envio_manutencao', seriais: 'ONU-001', observacao: 'Não sincroniza' })).status, 201);
  const manut = (await admin.get('/relatorios/dados?relatorio=manutencao')).body;
  assert.equal(manut.linhas.find((l) => l.numeroSerie === 'ONU-001').problema, 'Não sincroniza');
  assert.equal((await mov({ tipo: 'retorno_manutencao', seriais: 'ONU-001', destino: 'em_estoque' })).status, 201);
  assert.equal((await equipamentoPorSerie('ONU-001')).status, 'em_estoque');

  // baixa definitiva com motivo
  assert.equal((await mov({ tipo: 'baixa', seriais: 'ONU-003' })).status, 400);
  assert.equal((await mov({ tipo: 'baixa', seriais: 'ONU-003', observacao: 'Queimada' })).status, 201);
  assert.equal((await equipamentoPorSerie('ONU-003')).status, 'baixado');
  assert.equal(await saldo(c.onu.id), 2, 'saldo do serializado = unidades em estoque');

  // histórico individual completo, do mais recente para o mais antigo
  const detalhe = (await admin.get(`/equipamentos/${u.id}`)).body;
  assert.deepEqual(
    detalhe.historico.map((h) => h.tipo),
    ['retorno_manutencao', 'envio_manutencao', 'retirada_cliente', 'instalacao_cliente', 'devolucao_tecnico', 'saida_tecnico', 'entrada_compra']
  );
});

test('ajuste de inventário pelo admin exige motivo e registra a diferença', async () => {
  assert.equal((await mov({ tipo: 'ajuste_inventario', produtoId: c.conector.id, novaQuantidade: 75 })).status, 400);
  const r = await mov({ tipo: 'ajuste_inventario', produtoId: c.conector.id, novaQuantidade: 75, observacao: 'Contagem' });
  assert.equal(r.status, 201);
  assert.equal(Number(r.body.movimentacoes[0].quantidade), -5);
  assert.equal(await saldo(c.conector.id), 75);
});

test('consistência: saldo de cada produto bate com o histórico de movimentações', async () => {
  const { sequelize } = require('../../src/models');
  const [linhas] = await sequelize.query(`
    SELECT p.id, p.codigo, p.quantidade,
      COALESCE(SUM(CASE m.tipo
        WHEN 'entrada_compra' THEN m.quantidade
        WHEN 'saida_tecnico' THEN -m.quantidade
        WHEN 'devolucao_tecnico' THEN m.quantidade
        WHEN 'ajuste_inventario' THEN m.quantidade
        WHEN 'baixa' THEN IF(m.tecnicoId IS NULL, -m.quantidade, 0)
        ELSE 0 END), 0) AS calculado
    FROM produtos p LEFT JOIN movimentacoes m ON m.produtoId = p.id
    WHERE p.tipoControle = 'quantidade' GROUP BY p.id`);
  linhas.forEach((l) => assert.equal(Number(l.quantidade), Number(l.calculado), `saldo de ${l.codigo}`));
});

test('exclusão lógica preserva histórico; categoria com produtos não pode ser excluída', async () => {
  assert.equal((await admin.delete(`/produtos/${c.cabo.id}`)).status, 204);
  const p = (await admin.get(`/produtos/${c.cabo.id}`)).body;
  assert.equal(p.ativo, false);
  const hist = (await admin.get(`/movimentacoes?produtoId=${c.cabo.id}&inicio=`)).body;
  assert.ok(hist.total > 0, 'movimentações continuam no histórico');
  const r = await admin.delete(`/categorias/${c.categoria.id}`);
  assert.equal(r.status, 400);
  const forn = await admin.delete(`/fornecedores/${c.fornecedor.id}`);
  assert.equal(forn.status, 400, 'fornecedor com entradas não pode ser excluído');
  const hf = (await admin.get(`/movimentacoes?fornecedorId=${c.fornecedor.id}`)).body;
  assert.ok(hf.total >= 3, 'histórico do fornecedor');
});

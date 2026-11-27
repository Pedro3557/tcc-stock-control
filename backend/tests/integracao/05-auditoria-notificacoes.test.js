const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const amb = require('./ambiente');

let app;
let admin;
let c;
let models;

before(async () => {
  await amb.prepararBanco();
  app = require('../../src/app');
  models = require('../../src/models');
  admin = await amb.entrar(app, 'admin@provedor.com', 'admin123');
  c = await amb.cadastrosBasicos(admin);
});
after(amb.encerrar);

test('auditoria registra usuário, data, operação, módulo, registro, antes/depois e resultado', async () => {
  await admin.put(`/produtos/${c.conector.id}`, { nome: 'Conector alterado', estoqueMinimo: 30 });
  const lista = (await admin.get(`/auditoria?modulo=produtos&acao=atualizar&registroId=${c.conector.id}`)).body;
  assert.equal(lista.total, 1);
  const reg = (await admin.get(`/auditoria/${lista.dados[0].id}`)).body;
  assert.equal(reg.usuarioNome, 'Administrador');
  assert.equal(reg.resultado, 'sucesso');
  assert.ok(reg.createdAt && reg.ip);
  assert.equal(reg.dadosAnteriores.nome, 'Conector de teste');
  assert.equal(reg.dadosPosteriores.nome, 'Conector alterado');

  // movimentação recusada também é registrada, com o motivo
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 5, tecnicoId: c.tecnico.id });
  const falha = (await admin.get('/auditoria?modulo=movimentacoes&resultado=falha')).body;
  assert.equal(falha.total, 1);
  assert.match(falha.dados[0].detalhe, /Saldo insuficiente/);

  // filtros por usuário e período
  const eu = (await admin.get('/auth/me')).body;
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  assert.ok((await admin.get(`/auditoria?usuarioId=${eu.id}&inicio=${hoje}&fim=${hoje}`)).body.total > 3);
  assert.equal((await admin.get('/auditoria?inicio=2000-01-01&fim=2000-01-02')).body.total, 0);
});

test('auditoria nunca guarda senhas, hashes ou tokens', async () => {
  await admin.post('/usuarios', { nome: 'Fulano', email: 'fulano@teste.com', senha: 'SenhaSecreta99', perfil: 'consulta' });
  const id = (await admin.get('/usuarios')).body.find((u) => u.email === 'fulano@teste.com').id;
  await admin.put(`/usuarios/${id}`, { senha: 'OutraSecreta77', perfil: 'almoxarife' });
  const [linhas] = await models.sequelize.query('SELECT dadosAnteriores, dadosPosteriores, detalhe FROM auditorias');
  const tudo = JSON.stringify(linhas);
  for (const proibido of ['SenhaSecreta99', 'OutraSecreta77', 'senhaHash', '$2a$', '"token"', admin.token]) {
    assert.ok(!tudo.includes(proibido), `auditoria contém "${proibido}"`);
  }
  const alteracao = (await admin.get(`/auditoria?modulo=usuarios&acao=atualizar&registroId=${id}`)).body.dados[0];
  assert.match(alteracao.detalhe, /senha redefinida; perfil: consulta → almoxarife/);
});

test('registros de auditoria são imutáveis e só o admin consulta', async () => {
  const reg = await models.Auditoria.findOne();
  await assert.rejects(() => reg.update({ acao: 'adulterado' }), /não podem ser alterados/);
  await assert.rejects(() => models.Auditoria.destroy({ where: {} }), /não podem ser alterados/);
  assert.equal((await admin.put('/auditoria/1', {})).status, 404, 'não existe rota de edição');
  await admin.post('/usuarios', { nome: 'Almox', email: 'almox@teste.com', senha: 'Provisoria123', perfil: 'almoxarife' });
  const almox = await amb.entrar(app, 'almox@teste.com', 'Provisoria123', 'Almox-Definitiva-1');
  assert.equal((await almox.get('/auditoria')).status, 403);
});

test('notificações de estoque mínimo e sem estoque, sem duplicar enquanto a situação continua', async () => {
  const contar = (tipo) => models.Notificacao.count({ where: { tipo } });
  const eu = (await admin.get('/auth/me')).body;
  const destinatarios = await models.Usuario.count({ where: { ativo: true, recebeNotificacoes: true, perfil: ['admin', 'almoxarife'] } });

  // mínimo do conector é 30: entrada de 40 (normal), saídas até ficar abaixo
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 40, fornecedorId: c.fornecedor.id, notaFiscal: 'NF' });
  assert.equal(await contar('estoque_minimo'), 0);
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 15, tecnicoId: c.tecnico.id });
  assert.equal(await contar('estoque_minimo'), destinatarios, 'um alerta por destinatário');
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 5, tecnicoId: c.tecnico.id });
  assert.equal(await contar('estoque_minimo'), destinatarios, 'nada novo: a situação continua a mesma');

  // zerou: alerta de sem estoque (o teste anterior já gerou um, quando o mínimo foi definido com saldo zero)
  const semAntes = await contar('sem_estoque');
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 20, tecnicoId: c.tecnico.id });
  assert.equal(await contar('sem_estoque'), semAntes + destinatarios);

  // reposição encerra os alertas; nova queda gera notificação de novo
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 50, fornecedorId: c.fornecedor.id, notaFiscal: 'NF' });
  assert.equal(await models.AlertaAtivo.count({ where: { chave: [`sem_estoque:${c.conector.id}`, `estoque_minimo:${c.conector.id}`] } }), 0);
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 25, tecnicoId: c.tecnico.id });
  assert.equal(await contar('estoque_minimo'), destinatarios * 2);

  // central do usuário: não lidas, marcar uma e marcar todas
  const minhas = (await admin.get('/notificacoes?naoLidas=true')).body;
  assert.ok(minhas.total >= 3);
  assert.equal((await admin.get('/notificacoes/contagem')).body.naoLidas, minhas.total);
  await admin.patch(`/notificacoes/${minhas.dados[0].id}/lida`);
  assert.equal((await admin.get('/notificacoes/contagem')).body.naoLidas, minhas.total - 1);
  await admin.post('/notificacoes/marcar-todas-lidas');
  assert.equal((await admin.get('/notificacoes/contagem')).body.naoLidas, 0);
  assert.ok(minhas.dados.every((n) => n.usuarioId === eu.id), 'cada um vê só as suas');
});

test('destinatários configuráveis e envio opcional por e-mail', async () => {
  const email = require('../../src/services/emailService');
  const eu = (await admin.get('/auth/me')).body;
  await admin.put(`/usuarios/${eu.id}`, { recebeEmail: true });
  await admin.put('/configuracoes', { valores: { 'notificacoes.email': 'true', 'organizacao.nome': 'Provedor X' } });
  const antes = email.enviadosEmTeste.length;
  // cabo: mínimo 0 → sem alerta; define mínimo e fica abaixo
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.cabo.id, quantidade: 5, fornecedorId: c.fornecedor.id, notaFiscal: 'NF' });
  await admin.put(`/produtos/${c.cabo.id}`, { estoqueMinimo: 100 });
  assert.equal(email.enviadosEmTeste.length, antes + 1);
  const msg = email.enviadosEmTeste.at(-1);
  assert.match(msg.subject, /^\[Provedor X\] Abaixo do mínimo: Cabo de teste/);
  assert.deepEqual(msg.to.map((t) => t.address), ['admin@provedor.com']);

  // quem desliga as notificações deixa de receber
  await admin.put(`/usuarios/${eu.id}`, { recebeNotificacoes: false });
  const antesNotif = await models.Notificacao.count({ where: { usuarioId: eu.id } });
  await admin.put(`/produtos/${c.cabo.id}`, { estoqueMinimo: 0 });
  await admin.put(`/produtos/${c.cabo.id}`, { estoqueMinimo: 200 });
  assert.equal(await models.Notificacao.count({ where: { usuarioId: eu.id } }), antesNotif);
});

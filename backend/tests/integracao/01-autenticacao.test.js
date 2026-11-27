const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const amb = require('./ambiente');

let app;
let jwt;

before(async () => {
  await amb.prepararBanco();
  app = require('../../src/app');
  jwt = require('jsonwebtoken');
});
after(amb.encerrar);

test('login com senha errada é recusado e auditado sem registrar a senha', async () => {
  const r = await amb.request(app).post('/api/auth/login').send({ email: 'admin@provedor.com', senha: 'errada-123' });
  assert.equal(r.status, 401);
  assert.equal(r.body.erro, 'E-mail ou senha incorretos.');
  const { Auditoria } = require('../../src/models');
  const reg = await Auditoria.findOne({ where: { acao: 'login', resultado: 'falha' } });
  assert.ok(reg, 'falha de login deve ir para a auditoria');
  assert.ok(!JSON.stringify(reg.toJSON()).includes('errada-123'), 'a senha nunca pode aparecer na auditoria');
});

test('senha provisória: o acesso fica bloqueado até a troca, e a troca invalida o token antigo', async () => {
  const login = await amb.request(app).post('/api/auth/login').send({ email: 'admin@provedor.com', senha: 'admin123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.usuario.precisaTrocarSenha, true);
  assert.equal(login.body.usuario.senhaHash, undefined, 'hash da senha nunca sai na API');
  const antigo = amb.cliente(app, login.body.token);

  const bloqueado = await antigo.get('/produtos');
  assert.equal(bloqueado.status, 403);
  assert.equal(bloqueado.body.codigo, 'TROCA_SENHA_OBRIGATORIA');

  const fraca = await antigo.post('/auth/trocar-senha', { senhaAtual: 'admin123', novaSenha: 'abc' });
  assert.equal(fraca.status, 400);

  const troca = await antigo.post('/auth/trocar-senha', { senhaAtual: 'admin123', novaSenha: amb.SENHA_ADMIN });
  assert.equal(troca.status, 200);
  assert.ok(troca.body.token);

  const depois = await antigo.get('/auth/me');
  assert.equal(depois.status, 401, 'token emitido antes da troca de senha deixa de valer');

  const novo = amb.cliente(app, troca.body.token);
  assert.equal((await novo.get('/produtos')).status, 200);
});

test('rotas protegidas exigem token válido e não expirado', async () => {
  assert.equal((await amb.request(app).get('/api/produtos')).status, 401);
  assert.equal((await amb.cliente(app, 'token-invalido').get('/produtos')).status, 401);
  const expirado = jwt.sign({ id: 1, perfil: 'admin', sa: 0, exp: Math.floor(Date.now() / 1000) - 60 }, process.env.JWT_SECRET);
  const r = await amb.cliente(app, expirado).get('/produtos');
  assert.equal(r.status, 401);
  assert.match(r.body.erro, /expirada|inválida/);
});

test('permissões por perfil no back-end (admin, almoxarife, consulta)', async () => {
  const admin = await amb.entrar(app, 'admin@provedor.com', amb.SENHA_ADMIN);

  const novoAlmox = await admin.post('/usuarios', { nome: 'Almox', email: 'almox@teste.com', senha: 'Provisoria123', perfil: 'almoxarife' });
  assert.equal(novoAlmox.status, 201);
  assert.equal(novoAlmox.body.precisaTrocarSenha, true);
  await admin.post('/usuarios', { nome: 'Consulta', email: 'consulta@teste.com', senha: 'Provisoria123', perfil: 'consulta' });

  const almox = await amb.entrar(app, 'almox@teste.com', 'Provisoria123', 'Almox-Definitiva-1');
  const consulta = await amb.entrar(app, 'consulta@teste.com', 'Provisoria123', 'Consulta-Definitiva-1');

  // consulta só lê
  assert.equal((await consulta.get('/produtos')).status, 200);
  assert.equal((await consulta.get('/dashboard')).status, 200);
  assert.equal((await consulta.post('/movimentacoes', { tipo: 'baixa' })).status, 403);
  assert.equal((await consulta.post('/categorias', { nome: 'X' })).status, 403);
  assert.equal((await consulta.get('/usuarios')).status, 403);
  assert.equal((await consulta.get('/auditoria')).status, 403);
  assert.equal((await consulta.get('/backups')).status, 403);

  // almoxarife movimenta e cadastra, mas não administra
  assert.equal((await almox.post('/categorias', { nome: 'Categoria do almox' })).status, 201);
  assert.equal((await almox.get('/usuarios')).status, 403);
  assert.equal((await almox.get('/configuracoes')).status, 403);
  assert.equal((await almox.post('/backups')).status, 403);
  const cat = (await almox.get('/categorias')).body[0];
  assert.equal((await almox.delete(`/categorias/${cat.id}`)).status, 403, 'exclusão só pelo admin');
  const ajuste = await almox.post('/movimentacoes', { tipo: 'ajuste_inventario', produtoId: 1, novaQuantidade: 1, observacao: 'teste' });
  assert.equal(ajuste.status, 403, 'ajuste de inventário só pelo admin');

  // admin não pode tirar o próprio perfil nem se desativar
  const eu = (await admin.get('/auth/me')).body;
  assert.equal((await admin.put(`/usuarios/${eu.id}`, { perfil: 'consulta' })).status, 400);
  assert.equal((await admin.delete(`/usuarios/${eu.id}`)).status, 400);

  // usuário desativado perde o acesso na hora
  const idConsulta = (await admin.get('/usuarios')).body.find((u) => u.email === 'consulta@teste.com').id;
  assert.equal((await admin.delete(`/usuarios/${idConsulta}`)).status, 204);
  assert.equal((await consulta.get('/produtos')).status, 401);
});

test('limite de tentativas de login (força bruta)', async () => {
  let ultima;
  for (let i = 0; i < 11; i += 1) {
     
    ultima = await amb.request(app).post('/api/auth/login').send({ email: 'alvo@teste.com', senha: `tentativa-${i}` });
  }
  assert.equal(ultima.status, 429);
  assert.match(ultima.body.erro, /Muitas tentativas/);
});

test('validação de entrada e erro padronizado', async () => {
  const admin = await amb.entrar(app, 'admin@provedor.com', amb.SENHA_ADMIN);
  const r = await admin.post('/produtos', { nome: 'x' });
  assert.equal(r.status, 400);
  assert.ok(r.body.erro);
  assert.ok(Array.isArray(r.body.detalhes));
  assert.equal((await admin.get('/rota-inexistente')).status, 404);
});

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const amb = require('./ambiente');

let app;
let admin;
let c;
let models;
let backups;

before(async () => {
  await amb.prepararBanco();
  app = require('../../src/app');
  models = require('../../src/models');
  backups = require('../../src/services/backupService');
  admin = await amb.entrar(app, 'admin@provedor.com', 'admin123');
  c = await amb.cadastrosBasicos(admin);
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 100, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-B' });
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-B', seriais: 'B-1;aa:bb:cc:dd:00:01\nB-2' });
});
after(amb.encerrar);

let backupId;

test('backup manual: arquivo .sql.gz com SHA-256, histórico e auditoria (só admin)', async () => {
  const r = await admin.post('/backups');
  assert.equal(r.status, 201);
  const b = r.body.backup;
  backupId = b.id;
  assert.equal(b.situacao, 'sucesso');
  assert.match(b.sha256, /^[0-9a-f]{64}$/);
  assert.ok(b.registros > 10 && b.tabelas >= 16);
  const arquivo = path.join(process.env.BACKUP_DIR, b.arquivo);
  assert.ok(fs.existsSync(arquivo) && fs.existsSync(`${arquivo}.sha256`));
  const conteudo = zlib.gunzipSync(fs.readFileSync(arquivo)).toString();
  assert.ok(conteudo.startsWith('-- ESTOQUE-BACKUP '));
  assert.match(conteudo, /INSERT INTO `produtos`/);
  assert.ok(!/admin123|Admin-de-teste/.test(conteudo), 'senhas só aparecem como hash');

  const lista = (await admin.get('/backups')).body;
  assert.equal(lista.dados[0].id, backupId);
  assert.ok((await admin.get('/auditoria?modulo=backup&acao=backup')).body.total >= 1);

  const verif = await admin.post(`/backups/${backupId}/verificar`);
  assert.equal(verif.status, 200);
  assert.equal(verif.body.registros, b.registros);

  const download = await admin.get(`/backups/${backupId}/download`).buffer(true).parse((res, cb) => {
    const partes = [];
    res.on('data', (d) => partes.push(d));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });
  assert.equal(download.status, 200);
  assert.equal(download.body[0], 0x1f, 'gzip');
});

test('restauração exige confirmação + senha, cria backup de segurança, reverte os dados e preserva a auditoria', async () => {
  // muda dados depois do backup
  await admin.put(`/produtos/${c.conector.id}`, { nome: 'ALTERADO DEPOIS' });
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 40, tecnicoId: c.tecnico.id });
  const novaCategoria = (await admin.post('/categorias', { nome: 'Criada depois do backup' })).body;
  const auditoriaAntes = await models.Auditoria.count();

  assert.equal((await admin.post(`/backups/${backupId}/restaurar`, { confirmacao: 'restaurar', senha: amb.SENHA_ADMIN })).status, 400);
  const senhaErrada = await admin.post(`/backups/${backupId}/restaurar`, { confirmacao: 'RESTAURAR', senha: 'errada' });
  assert.equal(senhaErrada.status, 400);
  assert.equal((await admin.get(`/produtos/${c.conector.id}`)).body.nome, 'ALTERADO DEPOIS', 'nada restaurado sem confirmação');

  const r = await admin.post(`/backups/${backupId}/restaurar`, { confirmacao: 'RESTAURAR', senha: amb.SENHA_ADMIN });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.backupSeguranca, /pre_restauracao/);

  const p = (await admin.get(`/produtos/${c.conector.id}`)).body;
  assert.equal(p.nome, 'Conector de teste');
  assert.equal(Number(p.quantidade), 100);
  assert.equal((await admin.get(`/categorias/${novaCategoria.id}`)).status, 404);
  assert.ok((await models.Auditoria.count()) > auditoriaAntes, 'auditoria atual preservada (e a restauração registrada)');
  const seg = await models.Backup.findOne({ where: { origem: 'pre_restauracao' } });
  assert.equal(seg.situacao, 'sucesso');
  assert.ok((await models.Backup.findByPk(backupId)).restauradoEm);

  // o backup de segurança desfaz a restauração (volta ao estado "ALTERADO DEPOIS")
  const desfazer = await admin.post(`/backups/${seg.id}/restaurar`, { confirmacao: 'RESTAURAR', senha: amb.SENHA_ADMIN });
  assert.equal(desfazer.status, 200);
  assert.equal((await admin.get(`/produtos/${c.conector.id}`)).body.nome, 'ALTERADO DEPOIS');
  assert.equal(Number((await admin.get(`/produtos/${c.conector.id}`)).body.quantidade), 60);
});

test('arquivo adulterado é detectado e não é restaurado', async () => {
  const b = (await admin.post('/backups')).body.backup;
  const arquivo = path.join(process.env.BACKUP_DIR, b.arquivo);
  const original = fs.readFileSync(arquivo);
  const adulterado = zlib.gzipSync(zlib.gunzipSync(original).toString().replace('ALTERADO DEPOIS', 'ADULTERADO!!!!!'));
  fs.writeFileSync(arquivo, adulterado);
  const v = await admin.post(`/backups/${b.id}/verificar`);
  assert.equal(v.status, 400);
  assert.match(v.body.erro, /SHA-256/);
  const r = await admin.post(`/backups/${b.id}/restaurar`, { confirmacao: 'RESTAURAR', senha: amb.SENHA_ADMIN });
  assert.equal(r.status, 400);
  assert.equal((await admin.get(`/produtos/${c.conector.id}`)).body.nome, 'ALTERADO DEPOIS');
  fs.writeFileSync(arquivo, original);
});

test('retenção: mantém só os N mais recentes e apaga os arquivos antigos', async () => {
  await admin.put('/configuracoes', { valores: { 'backup.retencaoQuantidade': '2' } });
  for (let i = 0; i < 2; i += 1) {
     
    await admin.post('/backups');
  }
  const ok = await models.Backup.findAll({ where: { situacao: 'sucesso' } });
  assert.equal(ok.length, 2);
  const removidos = await models.Backup.findAll({ where: { situacao: 'removido' } });
  assert.ok(removidos.length >= 2);
  removidos.forEach((b) => assert.ok(!fs.existsSync(path.join(process.env.BACKUP_DIR, b.arquivo)), `${b.arquivo} apagado`));
});

test('agendamento: frequência configurável decide quando o backup automático roda', async () => {
  await admin.put('/configuracoes', { valores: { 'backup.frequencia': 'desativado' } });
  assert.equal(await backups.backupAutomaticoPendente(), false);
  await admin.put('/configuracoes', { valores: { 'backup.frequencia': 'horas', 'backup.intervaloHoras': '6' } });
  assert.equal(await backups.backupAutomaticoPendente(), true, 'nunca houve backup automático');
  const auto = await backups.executarSePendente();
  assert.equal(auto.origem, 'automatico');
  assert.equal(await backups.backupAutomaticoPendente(), false, 'acabou de rodar');
  assert.equal(await backups.backupAutomaticoPendente(new Date(Date.now() + 7 * 3600000)), true, 'passadas 6 horas');

  // diário às 02:00: o último horário agendado que já passou
  const agora = new Date(2026, 10, 27, 10, 0);
  assert.equal(backups.ultimoAgendado(agora, '02:00', null).getDate(), 27);
  assert.equal(backups.ultimoAgendado(new Date(2026, 10, 27, 1, 0), '02:00', null).getDate(), 26);
  assert.equal(backups.ultimoAgendado(agora, '02:00', 0).getDay(), 0, 'semanal no domingo');
});

test('falha de backup gera notificação aos administradores', async () => {
  const pastaOriginal = process.env.BACKUP_DIR;
  const arquivoNoLugarDaPasta = path.join(pastaOriginal, 'nao-e-pasta');
  fs.writeFileSync(arquivoNoLugarDaPasta, 'x');
  process.env.BACKUP_DIR = arquivoNoLugarDaPasta;
  const r = await admin.post('/backups');
  process.env.BACKUP_DIR = pastaOriginal;
  assert.equal(r.status >= 400, true);
  assert.ok(await models.Notificacao.findOne({ where: { tipo: 'backup_falha' } }));
  assert.ok((await admin.get('/auditoria?modulo=backup&resultado=falha')).body.total >= 1);
});

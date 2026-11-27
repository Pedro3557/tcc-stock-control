const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const amb = require('./ambiente');

const PASTA_BACKEND = path.join(__dirname, '..', '..');

function cli(...args) {
  const bin = require.resolve('sequelize-cli/lib/sequelize');
  const r = spawnSync(process.execPath, [bin, ...args], { cwd: PASTA_BACKEND, env: { ...process.env, NODE_ENV: 'test' }, encoding: 'utf8' });
  assert.equal(r.status, 0, `${args.join(' ')}\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

after(amb.encerrar);

test('migrations novas são compatíveis com um banco antigo já preenchido e reversíveis', async () => {
  await amb.prepararBanco(); // estado atual completo
  const { sequelize } = require('../../src/models');

  // volta o banco à versão original (8 migrations) e insere dados "legados"
  cli('db:migrate:undo:all', '--to', '20260101000009-criar-configuracoes.js');
  const [[{ versao }]] = await sequelize.query('SELECT COUNT(*) AS versao FROM SequelizeMeta');
  assert.equal(Number(versao), 8);
  await sequelize.query(`INSERT INTO categorias (id, nome, createdAt, updatedAt) VALUES (900, 'Legado', NOW(), NOW())`);
  await sequelize.query(`INSERT INTO produtos (id, categoriaId, codigo, nome, tipoControle, unidade, estoqueMinimo, custoUnitario, quantidade, ativo, createdAt, updatedAt)
                         VALUES (900, 900, 'LEG-ONU', 'ONU legada', 'serializado', 'un', 0, 100, 2, 1, NOW(), NOW())`);
  await sequelize.query(`INSERT INTO equipamentos (produtoId, numeroSerie, mac, status, createdAt, updatedAt) VALUES
                         (900, 'LEG-1', NULL, 'em_estoque', NOW(), NOW()), (900, 'LEG-2', NULL, 'em_estoque', NOW(), NOW())`);

  // aplica as migrations novas sobre os dados existentes
  cli('db:migrate');
  const [equip] = await sequelize.query("SELECT numeroSerie, codigoEtiqueta FROM equipamentos WHERE numeroSerie LIKE 'LEG-%'");
  assert.equal(equip.length, 2, 'dados preservados');
  equip.forEach((e) => assert.match(e.codigoEtiqueta, /^[2-9A-HJKMNP-Z]{10}$/, 'código de etiqueta gerado para unidades antigas'));
  assert.notEqual(equip[0].codigoEtiqueta, equip[1].codigoEtiqueta);
  const [[prod]] = await sequelize.query('SELECT nome, quantidade, descricao FROM produtos WHERE id = 900');
  assert.equal(prod.nome, 'ONU legada');
  assert.equal(prod.descricao, null);

  // as migrations novas podem ser desfeitas e refeitas
  cli('db:migrate:undo:all', '--to', '20260101000009-criar-configuracoes.js');
  cli('db:migrate');
  const [[{ total }]] = await sequelize.query("SELECT COUNT(*) AS total FROM equipamentos WHERE numeroSerie LIKE 'LEG-%'");
  assert.equal(Number(total), 2);

  // o seed essencial pode rodar de novo sem duplicar nada
  const antes = (await sequelize.query('SELECT COUNT(*) AS n FROM usuarios'))[0][0].n;
  cli('db:seed:all');
  const depois = (await sequelize.query('SELECT COUNT(*) AS n FROM usuarios'))[0][0].n;
  assert.equal(Number(depois), Number(antes));
});

/**
 * Ambiente dos testes integrados:
 * - usa SEMPRE o banco de testes (DB_NAME_TEST, padrão <DB_NAME>_teste), apagado e recriado a cada arquivo
 * - roda as migrations e o seed essencial de verdade (sequelize-cli)
 * - backups vão para uma pasta temporária
 * Importe este arquivo ANTES de qualquer módulo da aplicação.
 */
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

process.env.NODE_ENV = 'test';
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
process.env.JWT_SECRET = process.env.JWT_SECRET || 'segredo-apenas-para-os-testes-automatizados-0123456789';
process.env.BACKUP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'estoque-testes-backups-'));

const mysql = require('mysql2/promise');
const request = require('supertest');
const configs = require('../../src/config/database');

const PASTA_BACKEND = path.join(__dirname, '..', '..');
const SENHA_ADMIN = 'Admin-de-teste-2026';

function sequelizeCli(...args) {
  const bin = require.resolve('sequelize-cli/lib/sequelize');
  const r = spawnSync(process.execPath, [bin, ...args], {
    cwd: PASTA_BACKEND,
    env: { ...process.env, NODE_ENV: 'test' },
    encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`sequelize-cli ${args.join(' ')} falhou:\n${r.stdout}\n${r.stderr}`);
}

/** Recria o banco de testes do zero com migrations + seed essencial. */
async function prepararBanco() {
  const cfg = configs.test;
  if (cfg.database === configs.development.database) throw new Error('Banco de testes igual ao banco de trabalho!');
  const conexao = await mysql.createConnection({ host: cfg.host, port: cfg.port, user: cfg.username, password: cfg.password });
  try {
    await conexao.query(`DROP DATABASE IF EXISTS \`${cfg.database}\``);
    await conexao.query(`CREATE DATABASE \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } catch (erro) {
    if (/ACCESS_DENIED/.test(erro.code || '')) {
      throw new Error(
        `O usuário "${cfg.username}" não tem permissão no banco de testes "${cfg.database}". ` +
          'Rode "npm run configurar" na pasta principal do projeto (ele pede a senha do root do MySQL e libera o acesso).'
      );
    }
    throw erro;
  } finally {
    // Fecha mesmo em caso de erro: conexão aberta impedia o processo de testes de terminar
    await conexao.end();
  }
  sequelizeCli('db:migrate');
  sequelizeCli('db:seed:all');
}

/** Cliente HTTP autenticado sobre a aplicação (sem abrir porta). */
function cliente(app, token) {
  const comToken = (req) => (token ? req.set('Authorization', `Bearer ${token}`) : req);
  return {
    token,
    get: (url) => comToken(request(app).get(`/api${url}`)),
    post: (url, corpo) => comToken(request(app).post(`/api${url}`)).send(corpo),
    put: (url, corpo) => comToken(request(app).put(`/api${url}`)).send(corpo),
    patch: (url, corpo) => comToken(request(app).patch(`/api${url}`)).send(corpo),
    delete: (url) => comToken(request(app).delete(`/api${url}`)),
    upload: (url, campos, arquivo, nome) => {
      let req = comToken(request(app).post(`/api${url}`));
      Object.entries(campos).forEach(([k, v]) => {
        req = req.field(k, String(v));
      });
      return req.attach('arquivo', arquivo, nome);
    },
  };
}

/** Faz login (trocando a senha provisória se preciso) e devolve um cliente autenticado. */
async function entrar(app, email, senhaProvisoria, senhaDefinitiva = SENHA_ADMIN) {
  let r = await request(app).post('/api/auth/login').send({ email, senha: senhaProvisoria });
  if (r.status !== 200) r = await request(app).post('/api/auth/login').send({ email, senha: senhaDefinitiva });
  if (r.status !== 200) throw new Error(`Login falhou para ${email}: ${JSON.stringify(r.body)}`);
  let { token } = r.body;
  if (r.body.usuario.precisaTrocarSenha) {
    const t = await request(app).post('/api/auth/trocar-senha').set('Authorization', `Bearer ${token}`).send({ senhaAtual: senhaProvisoria, novaSenha: senhaDefinitiva });
    if (t.status !== 200) throw new Error(`Troca de senha falhou: ${JSON.stringify(t.body)}`);
    token = t.body.token;
  }
  return cliente(app, token);
}

/** Cadastros mínimos para os testes de estoque, criados pela própria API. */
async function cadastrosBasicos(admin) {
  const categoria = (await admin.post('/categorias', { nome: 'Categoria de teste' })).body;
  const fornecedor = (await admin.post('/fornecedores', { nome: 'Fornecedor de teste', cnpj: '11.111.111/0001-11' })).body;
  const tecnico = (await admin.post('/tecnicos', { nome: 'Técnico Teste', equipe: 'Instalação' })).body;
  const tecnico2 = (await admin.post('/tecnicos', { nome: 'Técnico Dois' })).body;
  const conector = (await admin.post('/produtos', {
    categoriaId: categoria.id, codigo: 'T-CONECTOR', nome: 'Conector de teste', tipoControle: 'quantidade', unidade: 'un', estoqueMinimo: 20, custoUnitario: 2.5,
  })).body;
  const cabo = (await admin.post('/produtos', {
    categoriaId: categoria.id, codigo: 'T-CABO', nome: 'Cabo de teste', tipoControle: 'quantidade', unidade: 'm', estoqueMinimo: 0, custoUnitario: 0.5,
  })).body;
  const onu = (await admin.post('/produtos', {
    categoriaId: categoria.id, codigo: 'T-ONU', nome: 'ONU de teste', tipoControle: 'serializado', estoqueMinimo: 1, custoUnitario: 150,
  })).body;
  return { categoria, fornecedor, tecnico, tecnico2, conector, cabo, onu };
}

async function encerrar() {
  const { sequelize } = require('../../src/models');
  await sequelize.close();
  fs.rmSync(process.env.BACKUP_DIR, { recursive: true, force: true });
}

module.exports = { prepararBanco, cliente, entrar, cadastrosBasicos, encerrar, SENHA_ADMIN, request };

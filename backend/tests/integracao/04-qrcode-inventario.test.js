const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const amb = require('./ambiente');

let app;
let admin;
let almox;
let c;

/** Gera a imagem do QR (como o front-end faz) e lê de volta com o jsQR (como a câmera faz). */
function gerarELerQR(texto) {
  const qr = QRCode.create(texto, { errorCorrectionLevel: 'M' });
  const modulos = qr.modules.size;
  const escala = 6;
  const margem = 4 * escala;
  const lado = modulos * escala + margem * 2;
  const pixels = new Uint8ClampedArray(lado * lado * 4).fill(255);
  for (let y = 0; y < modulos; y += 1) {
    for (let x = 0; x < modulos; x += 1) {
      if (!qr.modules.get(y, x)) continue;
      for (let dy = 0; dy < escala; dy += 1) {
        for (let dx = 0; dx < escala; dx += 1) {
          const i = ((margem + y * escala + dy) * lado + (margem + x * escala + dx)) * 4;
          pixels[i] = 0;
          pixels[i + 1] = 0;
          pixels[i + 2] = 0;
        }
      }
    }
  }
  return jsQR(pixels, lado, lado)?.data;
}

before(async () => {
  await amb.prepararBanco();
  app = require('../../src/app');
  admin = await amb.entrar(app, 'admin@provedor.com', 'admin123');
  c = await amb.cadastrosBasicos(admin);
  await admin.post('/usuarios', { nome: 'Almox', email: 'almox@teste.com', senha: 'Provisoria123', perfil: 'almoxarife' });
  almox = await amb.entrar(app, 'almox@teste.com', 'Provisoria123', 'Almox-Definitiva-1');
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.conector.id, quantidade: 50, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-1' });
  await admin.post('/movimentacoes', { tipo: 'entrada_compra', produtoId: c.onu.id, fornecedorId: c.fornecedor.id, notaFiscal: 'NF-1', seriais: 'Q-1;aa:bb:cc:00:10:01\nQ-2\nQ-3\nQ-4' });
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', seriais: 'Q-4', tecnicoId: c.tecnico.id });
});
after(amb.encerrar);

test('QR Code: código permanente, conteúdo sem dados sensíveis, leitura identifica o equipamento', async () => {
  const eq = (await admin.get('/equipamentos?busca=Q-1')).body.dados[0];
  const conteudo = `http://192.168.0.10:3333/e/${eq.codigoEtiqueta}`;
  assert.ok(!conteudo.includes(eq.numeroSerie) && !conteudo.includes('AA:BB'), 'o QR não leva série, MAC ou cliente');

  const lido = gerarELerQR(conteudo);
  assert.equal(lido, conteudo, 'a imagem gerada é lida de volta');

  for (const valor of [lido, eq.codigoEtiqueta, eq.codigoEtiqueta.toLowerCase(), 'q-1', 'AABBCC001001']) {
     
    const r = await admin.get(`/equipamentos/leitura?valor=${encodeURIComponent(valor)}`);
    assert.equal(r.status, 200, valor);
    assert.equal(r.body.id, eq.id, valor);
  }
  assert.equal((await admin.get('/equipamentos/leitura?valor=NAO-EXISTE')).status, 404);
  const semLogin = await amb.request(app).get(`/api/equipamentos/leitura?valor=${eq.codigoEtiqueta}`);
  assert.equal(semLogin.status, 401, 'consultar o QR exige login');

  // a etiqueta também serve como identificador nas movimentações
  const r = await admin.post('/movimentacoes', { tipo: 'saida_tecnico', seriais: lido, tecnicoId: c.tecnico2.id });
  assert.equal(r.status, 201);
  await admin.post('/movimentacoes', { tipo: 'devolucao_tecnico', seriais: eq.codigoEtiqueta });

  // o código não muda quando o equipamento é editado
  await admin.put(`/equipamentos/${eq.id}`, { observacao: 'editado' });
  assert.equal((await admin.get(`/equipamentos/${eq.id}`)).body.codigoEtiqueta, eq.codigoEtiqueta);
});

test('inventário: contagem não mexe no estoque; divergências exigem justificativa e aprovação do admin', async () => {
  const criado = await almox.post('/inventarios', { descricao: 'Inventário de teste', categoriaIds: [c.categoria.id] });
  assert.equal(criado.status, 201);
  const id = criado.body.id;
  assert.equal(criado.body.resumo.equipamentosEsperados, 3, 'Q-1, Q-2, Q-3 (Q-4 está com o técnico)');

  const conflito = await almox.post('/inventarios', { produtoIds: [c.conector.id] });
  assert.equal(conflito.status, 400, 'produto não pode estar em dois inventários abertos');

  assert.equal((await almox.post(`/inventarios/${id}/finalizar`)).status, 400, 'materiais sem contagem');
  await almox.post(`/inventarios/${id}/contagens`, { produtoId: c.conector.id, quantidade: 48 });
  await almox.post(`/inventarios/${id}/contagens`, { produtoId: c.cabo.id, quantidade: 0 });

  const eq1 = (await admin.get('/equipamentos?busca=Q-1')).body.dados[0];
  assert.equal((await almox.post(`/inventarios/${id}/leituras`, { valor: `http://x/e/${eq1.codigoEtiqueta}` })).body.resultado, 'conferido');
  assert.equal((await almox.post(`/inventarios/${id}/leituras`, { valor: 'Q-1' })).body.resultado, 'ja_conferido');
  assert.equal((await almox.post(`/inventarios/${id}/leituras`, { valor: 'Q-2' })).body.resultado, 'conferido');
  const errada = await almox.post(`/inventarios/${id}/leituras`, { valor: 'Q-4' });
  assert.equal(errada.body.resultado, 'localizacao_incorreta', 'Q-4 está com técnico no sistema, mas foi achado no almoxarifado');

  // o estoque NÃO muda antes da aprovação
  assert.equal(Number((await admin.get(`/produtos/${c.conector.id}`)).body.quantidade), 50);
  const fin = await almox.post(`/inventarios/${id}/finalizar`);
  assert.equal(fin.status, 200);
  const r = fin.body.resumo;
  assert.equal(r.materiaisDivergentes, 1);
  assert.equal(r.naoEncontrados, 1, 'Q-3 não foi lido');
  assert.equal(r.localizacaoIncorreta, 1);
  assert.equal(r.decisoesPendentes, 3);

  const { Notificacao } = require('../../src/models');
  assert.ok(await Notificacao.findOne({ where: { tipo: 'inventario_divergencia' } }), 'divergências geram notificação');

  assert.equal((await admin.post(`/inventarios/${id}/aprovar`)).status, 400, 'sem justificativas não aprova');
  const det = fin.body;
  const item = det.itens.find((i) => i.situacao === 'divergente');
  const naoEnc = det.equipamentos.find((e) => e.situacao === 'nao_encontrado');
  const local = det.equipamentos.find((e) => e.situacao === 'localizacao_incorreta');
  const curta = await almox.put(`/inventarios/${id}/decisoes`, { decisoes: [{ tipo: 'item', id: item.id, acao: 'ajustar', justificativa: 'x' }] });
  assert.equal(curta.status, 400, 'justificativa obrigatória');
  const decide = await almox.put(`/inventarios/${id}/decisoes`, {
    decisoes: [
      { tipo: 'item', id: item.id, acao: 'ajustar', justificativa: 'Recontado duas vezes' },
      { tipo: 'equipamento', id: naoEnc.id, acao: 'ajustar', statusAjuste: 'baixado', justificativa: 'Extraviado' },
      { tipo: 'equipamento', id: local.id, acao: 'ajustar', statusAjuste: 'em_estoque', justificativa: 'Devolvido sem registro' },
    ],
  });
  assert.equal(decide.body.resumo.decisoesPendentes, 0);

  assert.equal((await almox.post(`/inventarios/${id}/aprovar`)).status, 403, 'só admin aprova');
  const aprovado = await admin.post(`/inventarios/${id}/aprovar`);
  assert.equal(aprovado.status, 200);
  assert.equal(Number((await admin.get(`/produtos/${c.conector.id}`)).body.quantidade), 48);
  const status = async (s) => (await admin.get(`/equipamentos?busca=${s}`)).body.dados[0].status;
  assert.equal(await status('Q-3'), 'baixado');
  assert.equal(await status('Q-4'), 'em_estoque');
  const ajustes = (await admin.get('/movimentacoes?tipo=ajuste_inventario')).body;
  assert.equal(ajustes.total, 3);
  assert.ok(ajustes.dados.every((m) => m.observacao.startsWith(`Inventário #${id}:`)));

  const csv = await admin.get(`/inventarios/${id}/exportar`);
  assert.match(csv.text, /Relatório;Inventário físico #\d+ — Inventário de teste/);
  assert.match(csv.text, /Não encontrado/);
  assert.equal((await admin.get(`/inventarios/${id}/relatorio`)).body.linhas.length, 6);
});

test('inventário bloqueia a aprovação se o saldo mudou durante a contagem', async () => {
  const id = (await admin.post('/inventarios', { produtoIds: [c.conector.id] })).body.id;
  await admin.post(`/inventarios/${id}/contagens`, { produtoId: c.conector.id, quantidade: 40 });
  await admin.post('/movimentacoes', { tipo: 'saida_tecnico', produtoId: c.conector.id, quantidade: 1, tecnicoId: c.tecnico.id });
  const fin = (await admin.post(`/inventarios/${id}/finalizar`)).body;
  const item = fin.itens[0];
  await admin.put(`/inventarios/${id}/decisoes`, { decisoes: [{ tipo: 'item', id: item.id, acao: 'ajustar', justificativa: 'Contagem física' }] });
  const r = await admin.post(`/inventarios/${id}/aprovar`);
  assert.equal(r.status, 400);
  assert.match(r.body.erro, /mudou durante o inventário/);
  assert.equal(Number((await admin.get(`/produtos/${c.conector.id}`)).body.quantidade), 47, 'nenhum ajuste aplicado');
  assert.equal((await admin.post(`/inventarios/${id}/cancelar`)).status, 204);
  assert.equal((await admin.get('/inventarios?situacao=cancelado')).body.total, 1, 'histórico de inventários');
});

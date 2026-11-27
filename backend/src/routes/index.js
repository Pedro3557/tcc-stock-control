const { Router } = require('express');
const a = require('../utils/async');
const validar = require('../middlewares/validar');
const { autenticar, exigirSenhaDefinitiva, permitir } = require('../middlewares/auth');
const { limiteLogin } = require('../middlewares/limites');
const v = require('./validacoes');

const auth = require('../controllers/authController');
const categorias = require('../controllers/categoriaController');
const produtos = require('../controllers/produtoController');
const tecnicos = require('../controllers/tecnicoController');
const fornecedores = require('../controllers/fornecedorController');
const usuarios = require('../controllers/usuarioController');
const equipamentos = require('../controllers/equipamentoController');
const movimentacoes = require('../controllers/movimentacaoController');
const dashboard = require('../controllers/dashboardController');
const relatorios = require('../controllers/relatorioController');
const importacao = require('../controllers/importacaoController');
const notificacoesCtrl = require('../controllers/notificacaoController');
const auditoriaCtrl = require('../controllers/auditoriaController');
const configuracoesCtrl = require('../controllers/configuracaoController');
const backupsCtrl = require('../controllers/backupController');
const { uploadPlanilha } = require('../middlewares/upload');
const backupService = require('../services/backupService');

const router = Router();

const ESCRITA = permitir('admin', 'almoxarife');
const ADMIN = permitir('admin');

router.get('/saude', (req, res) => res.json({ status: 'ok', horario: new Date().toISOString() }));

// Durante uma restauração de backup a API fica indisponível
router.use((req, res, next) => {
  if (backupService.emManutencao()) {
    return res.status(503).json({ erro: 'Sistema em manutenção: restauração de backup em andamento. Tente em alguns minutos.' });
  }
  return next();
});

// Autenticação
router.post('/auth/login', limiteLogin, validar(v.login), a(auth.login));
router.get('/auth/me', autenticar, a(auth.me));
router.post('/auth/trocar-senha', autenticar, validar(v.trocarSenha), a(auth.trocarSenha));

// Daqui para baixo, todas as rotas exigem login e senha definitiva
router.use(autenticar, exigirSenhaDefinitiva);

/** Registra um CRUD padrão: leitura para todos, criação/edição para admin+almoxarife e exclusão só para admin. */
function crud(caminho, controller, regras, regrasParciais = regras) {
  router.get(`/${caminho}`, a(controller.listar));
  router.get(`/${caminho}/:id`, validar(v.id), a(controller.obter));
  router.post(`/${caminho}`, ESCRITA, validar(regras), a(controller.criar));
  router.put(`/${caminho}/:id`, ESCRITA, validar([...v.id, ...regrasParciais]), a(controller.atualizar));
  router.delete(`/${caminho}/:id`, ADMIN, validar(v.id), a(controller.excluir));
}

crud('categorias', categorias, v.categoria);
crud('produtos', produtos, v.produto(false), v.produto(true));
router.get('/tecnicos/pendencias', a(tecnicos.pendencias));
router.get('/tecnicos/:id/estoque', validar(v.id), a(tecnicos.estoque));
crud('tecnicos', tecnicos, v.tecnico);
crud('fornecedores', fornecedores, v.fornecedor);

// Usuários: somente administradores
router.get('/usuarios', ADMIN, a(usuarios.listar));
router.get('/usuarios/:id', ADMIN, validar(v.id), a(usuarios.obter));
router.post('/usuarios', ADMIN, validar(v.usuario(false)), a(usuarios.criar));
router.put('/usuarios/:id', ADMIN, validar([...v.id, ...v.usuario(true)]), a(usuarios.atualizar));
router.delete('/usuarios/:id', ADMIN, validar(v.id), a(usuarios.excluir));

// Equipamentos (unidades serializadas)
router.get('/equipamentos', validar(v.filtrosEquipamento), a(equipamentos.listar));
router.get('/equipamentos/leitura', a(equipamentos.porLeitura));
router.get('/equipamentos/:id', validar(v.id), a(equipamentos.obter));
router.get('/equipamentos/:id/historico', validar(v.id), a(equipamentos.historico));
router.put('/equipamentos/:id', ESCRITA, validar([...v.id, ...v.equipamento]), a(equipamentos.atualizar));

// Movimentações
router.get('/movimentacoes', validar(v.filtrosMovimentacao), a(movimentacoes.listar));
router.get('/movimentacoes/:id', validar(v.id), a(movimentacoes.obter));
router.post('/movimentacoes', ESCRITA, validar(v.movimentacao), a(movimentacoes.registrar));

// Painel e relatórios
router.get('/dashboard', a(dashboard.resumo));
router.get('/relatorios/exportar', validar(v.filtrosMovimentacao), a(relatorios.exportar));
router.get('/relatorios/dados', validar(v.filtrosMovimentacao), a(relatorios.dados));

// Importação de planilhas (.xlsx). simular=true (padrão) só mostra a prévia; simular=false grava.
router.get('/importacao/modelo/:tipo', ESCRITA, a(importacao.modelo));
router.post('/importacao/produtos', ESCRITA, uploadPlanilha, a(importacao.produtos));
router.post('/importacao/entrada', ESCRITA, uploadPlanilha, a(importacao.entrada));

// Notificações do usuário logado
router.get('/notificacoes', a(notificacoesCtrl.listar));
router.get('/notificacoes/contagem', a(notificacoesCtrl.contagem));
router.post('/notificacoes/marcar-todas-lidas', a(notificacoesCtrl.marcarTodasLidas));
router.patch('/notificacoes/:id/lida', validar(v.id), a(notificacoesCtrl.marcarLida));

// Configurações: nome da organização etc. são lidos por todos; alteração só pelo admin
router.get('/configuracoes/publicas', a(configuracoesCtrl.obterPublicas));
router.get('/configuracoes', ADMIN, a(configuracoesCtrl.obterTodas));
router.put('/configuracoes', ADMIN, validar(v.configuracoes), a(configuracoesCtrl.atualizar));

// Auditoria: somente consulta, somente admin
router.get('/auditoria', ADMIN, validar(v.filtrosAuditoria), a(auditoriaCtrl.listar));
router.get('/auditoria/opcoes', ADMIN, a(auditoriaCtrl.opcoes));
router.get('/auditoria/:id', ADMIN, validar(v.id), a(auditoriaCtrl.obter));

// Backups: somente admin
router.get('/backups', ADMIN, a(backupsCtrl.listar));
router.post('/backups', ADMIN, a(backupsCtrl.criar));
router.post('/backups/:id/verificar', ADMIN, validar(v.id), a(backupsCtrl.verificar));
router.get('/backups/:id/download', ADMIN, validar(v.id), a(backupsCtrl.baixar));
router.post('/backups/:id/restaurar', ADMIN, validar([...v.id, ...v.restauracao]), a(backupsCtrl.restaurar));

module.exports = router;

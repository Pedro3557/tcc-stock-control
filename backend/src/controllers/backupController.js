const bcrypt = require('bcryptjs');
const backups = require('../services/backupService');
const configuracoes = require('../services/configuracaoService');
const auditoria = require('../services/auditoriaService');
const { Usuario } = require('../models');
const AppError = require('../utils/AppError');
const { lerPaginacao } = require('../utils/paginacao');

async function listar(req, res) {
  const { pagina, limite } = lerPaginacao(req.query, 30);
  const resultado = await backups.listar({ pagina, limite });
  const cfg = await configuracoes.obterTodas();
  res.json({
    ...resultado,
    configuracao: Object.fromEntries(Object.entries(cfg).filter(([k]) => k.startsWith('backup.'))),
  });
}

async function criar(req, res) {
  try {
    const backup = await backups.criarBackup({ origem: 'manual', usuario: req.usuario });
    await auditoria.registrar({ req, acao: 'backup', modulo: 'backup', registroId: backup.id, depois: backup });
    res.status(201).json({ mensagem: 'Backup concluído com sucesso.', backup });
  } catch (erro) {
    await auditoria.registrar({ req, acao: 'backup', modulo: 'backup', resultado: 'falha', detalhe: erro.message });
    throw erro;
  }
}

async function verificar(req, res) {
  const resultado = await backups.verificar(req.params.id);
  res.json({ mensagem: 'Backup íntegro: SHA-256 e estrutura conferidos.', ...resultado });
}

async function baixar(req, res) {
  const { caminho, backup } = await backups.caminhoParaDownload(req.params.id);
  await auditoria.registrar({ req, acao: 'download', modulo: 'backup', registroId: backup.id, detalhe: backup.arquivo });
  res.download(caminho, backup.arquivo);
}

/** Exige a senha do administrador e a palavra RESTAURAR digitada, além do backup de segurança automático. */
async function restaurar(req, res) {
  if (req.body.confirmacao !== 'RESTAURAR') {
    throw new AppError('Para confirmar, digite RESTAURAR (em maiúsculas).');
  }
  const admin = await Usuario.scope('comSenha').findByPk(req.usuario.id);
  if (!(await bcrypt.compare(String(req.body.senha || ''), admin.senhaHash))) {
    await auditoria.registrar({ req, acao: 'restaurar', modulo: 'backup', registroId: req.params.id, resultado: 'falha', detalhe: 'Senha de confirmação incorreta' });
    throw new AppError('Senha incorreta. A restauração não foi feita.', 400);
  }

  try {
    const { backup, seguranca, cabecalho } = await backups.restaurar(req.params.id, req.usuario);
    await auditoria.registrar({
      req,
      acao: 'restaurar',
      modulo: 'backup',
      registroId: backup.id,
      detalhe: `Restaurado ${backup.arquivo} (gerado em ${cabecalho.criadoEm}). Backup de segurança: ${seguranca.arquivo}`,
    });
    res.json({
      mensagem: 'Banco restaurado com sucesso. Antes disso foi criado um backup de segurança do estado anterior.',
      backupSeguranca: seguranca.arquivo,
    });
  } catch (erro) {
    await auditoria.registrar({ req, acao: 'restaurar', modulo: 'backup', registroId: req.params.id, resultado: 'falha', detalhe: erro.message });
    throw erro;
  }
}

module.exports = { listar, criar, verificar, baixar, restaurar };

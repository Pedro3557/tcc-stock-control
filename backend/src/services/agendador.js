const backups = require('./backupService');
const notificacoes = require('./notificacaoService');

/**
 * Tarefas periódicas da API:
 * - a cada minuto: confere se o backup automático está na hora (frequência configurável)
 * - a cada 15 minutos: confere alertas de estoque (garante alertas mesmo para mudanças feitas fora da API)
 * - uma vez por dia: limpa notificações lidas antigas
 * Rode UMA instância da API (PM2 em modo fork) para não duplicar as tarefas.
 */
const timers = [];

function iniciar() {
  if (timers.length) return;
  const seguro = (fn) => () => fn().catch((erro) => console.error('[agendador]', erro.message));
  timers.push(setInterval(seguro(backups.executarSePendente), 60 * 1000));
  timers.push(setInterval(seguro(() => notificacoes.verificarEstoque()), 15 * 60 * 1000));
  timers.push(setInterval(seguro(notificacoes.limparAntigas), 24 * 60 * 60 * 1000));
  // Primeira verificação logo após subir
  timers.push(setTimeout(seguro(() => notificacoes.verificarEstoque()), 10 * 1000));
  timers.push(setTimeout(seguro(backups.executarSePendente), 30 * 1000));
  timers.forEach((t) => t.unref?.());
}

function parar() {
  timers.splice(0).forEach((t) => {
    clearInterval(t);
    clearTimeout(t);
  });
}

module.exports = { iniciar, parar };

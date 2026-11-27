/**
 * Configuração do PM2 para manter a API (e o front-end já compilado) rodando continuamente,
 * com reinício automático em caso de falha.
 *
 *   npm install -g pm2
 *   npm run producao:preparar      (build do front-end + migrations)
 *   pm2 start ecosystem.config.cjs
 *   pm2 save                       (lembra os processos)
 *   pm2 startup                    (Linux: inicia junto com o sistema — siga a instrução exibida)
 *
 * Use UMA instância (modo fork): o agendador de backups e alertas roda dentro da API.
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'estoque',
      cwd: path.join(__dirname, 'backend'),
      script: 'src/server.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      max_memory_restart: '500M',
      kill_timeout: 8000,
      time: true,
      out_file: path.join(__dirname, 'logs', 'estoque-saida.log'),
      error_file: path.join(__dirname, 'logs', 'estoque-erros.log'),
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};

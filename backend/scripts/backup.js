/**
 * Backup e restauração pela linha de comando (rode na pasta backend):
 *
 *   npm run backup -- criar                         cria um backup agora
 *   npm run backup -- listar                        lista os backups registrados
 *   npm run backup -- verificar <arquivo.sql.gz>    confere integridade (SHA-256 + estrutura)
 *   npm run backup -- restaurar <arquivo.sql.gz> --confirmar [--completo]
 *
 * "restaurar" cria antes um backup de segurança do estado atual. Sem --completo, a auditoria e o
 * histórico de backups atuais são mantidos; com --completo (recuperação de desastre em banco novo),
 * tudo vem do arquivo. Depois de restaurar um backup de versão anterior, rode "npm run migrate".
 */
const path = require('path');
const fs = require('fs');
const backups = require('../src/services/backupService');
const { sequelize } = require('../src/models');

async function main() {
  const [comando, arquivo, ...flags] = process.argv.slice(2);
  switch (comando) {
    case 'criar': {
      const b = await backups.criarBackup({ origem: 'manual' });
      console.log(`Backup criado: ${path.join(backups.pastaBackups(), b.arquivo)}`);
      console.log(`SHA-256: ${b.sha256} · ${b.tabelas} tabelas · ${b.registros} registros`);
      break;
    }
    case 'listar': {
      const { dados, pasta } = await backups.listar({ limite: 100 });
      console.log(`Pasta: ${pasta}`);
      dados.forEach((b) => console.log(`#${b.id}  ${b.iniciadoEm.toISOString()}  ${b.origem.padEnd(15)} ${b.situacao.padEnd(10)} ${b.arquivo || ''}`));
      break;
    }
    case 'verificar': {
      if (!arquivo) throw new Error('Informe o arquivo.');
      const info = await backups.validarArquivo(path.resolve(arquivo));
      console.log(`Arquivo íntegro. Gerado em ${info.criadoEm} · ${info.tabelas} tabelas · ${info.registros} registros.`);
      break;
    }
    case 'restaurar': {
      if (!arquivo) throw new Error('Informe o arquivo.');
      if (!flags.includes('--confirmar')) {
        throw new Error('A restauração SUBSTITUI os dados atuais. Repita o comando com --confirmar para prosseguir.');
      }
      const caminho = path.resolve(arquivo);
      if (!fs.existsSync(caminho)) throw new Error(`Arquivo não encontrado: ${caminho}`);
      try {
        const seguranca = await backups.criarBackup({ origem: 'pre_restauracao' });
        console.log(`Backup de segurança do estado atual: ${path.join(backups.pastaBackups(), seguranca.arquivo)}`);
      } catch (erro) {
        console.warn(`Aviso: não foi possível criar o backup de segurança (${erro.message}). Banco vazio ou novo?`);
      }
      const info = await backups.restaurarArquivoExterno(caminho, { completo: flags.includes('--completo') });
      console.log(`Restaurado: backup de ${info.criadoEm} (${info.registros} registros).`);
      console.log('Se o backup for de uma versão anterior do sistema, rode agora: npm run migrate');
      break;
    }
    default:
      console.log('Uso: npm run backup -- criar | listar | verificar <arquivo> | restaurar <arquivo> --confirmar [--completo]');
  }
}

main()
  .catch((erro) => {
    console.error(`Erro: ${erro.message}`);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());

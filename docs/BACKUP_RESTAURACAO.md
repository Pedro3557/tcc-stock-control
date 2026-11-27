# Backup e restauração

## Como o backup funciona

- O backup é gerado pela própria aplicação: não depende do `mysqldump` estar instalado nem no PATH.
- O arquivo `backup-AAAAMMDD-HHMMSS-<origem>-<id>.sql.gz` tem a estrutura (`CREATE TABLE`) e os dados (`INSERT`) de **todas** as tabelas, inclusive a lista de migrations aplicadas.
- Integridade: o SHA-256 do arquivo fica no banco (tabela `backups`) e num arquivo `.sha256` ao lado. A verificação confere o hash, o cabeçalho e o marcador de fim.
- Os arquivos ficam em `BACKUP_DIR` (padrão `backend/backups`), criados com permissão só para o usuário que roda a API.
- Senhas aparecem no backup apenas como hash bcrypt. Mesmo assim, o arquivo contém **todos os dados da empresa**: guarde-o com o mesmo cuidado que o servidor.

| Origem | Quando |
|---|---|
| Automático | Pela agenda definida em **Configurações** |
| Manual | Botão **Fazer backup agora** (admin) ou `npm --prefix backend run backup -- criar` |
| Segurança (antes de restaurar) | Sempre, automaticamente, antes de qualquer restauração |

## Configuração (tela Configurações → Backup automático)

| Opção | Valores | Padrão |
|---|---|---|
| Frequência | Diário, Semanal, A cada N horas, Desativado | Diário |
| Horário | HH:MM (horário do servidor) | 02:00 |
| Dia da semana | Domingo a sábado (frequência semanal) | Domingo |
| Intervalo | 1 a 168 horas (frequência "a cada N horas") | 6 |
| Manter os últimos | 1 a 365 backups | 14 |
| Apagar com mais de | 1 a 3650 dias | 30 |

- O agendador confere a cada minuto. Se o servidor estava desligado no horário, o backup roda assim que ele voltar.
- Se um backup falha, os administradores recebem uma notificação (e e-mail, se configurado), e uma nova tentativa acontece 30 minutos depois.
- A retenção apaga os arquivos que passam dos limites, mas **o backup mais recente nunca é apagado**.

## Rotina recomendada

1. Backup automático diário (padrão).
2. **Uma vez por semana**, baixe o último backup (**Backups → Baixar**) e guarde **fora do servidor**: outro computador, HD externo ou nuvem da empresa.
3. **Uma vez por mês**, clique em **Verificar** no backup mais recente.
4. **A cada 6 meses**, faça o [teste de recuperação](#teste-de-recuperação-em-ambiente-separado).

## Restaurar pela tela (mesma versão do sistema)

1. Entre como **admin** → **Backups**.
2. No backup desejado, clique em **Restaurar**.
3. Leia o aviso, digite **RESTAURAR** e a **sua senha**.
4. O sistema então:
   1. confere o SHA-256 e a estrutura do arquivo;
   2. confere se o backup é da mesma versão do banco (mesmas migrations);
   3. cria um **backup de segurança** do estado atual;
   4. bloqueia o uso do sistema pelos demais usuários (eles veem "manutenção");
   5. restaura os dados, **preservando a auditoria e o histórico de backups atuais**;
   6. se algo falhar no meio, **volta sozinho** ao backup de segurança.
5. A tela recarrega. Se a sua senha no backup era outra, entre com a senha daquela época.

**Para desfazer uma restauração**, restaure o backup marcado como "Segurança (antes de restaurar)" criado naquele momento.

Tudo fica registrado em **Auditoria** (módulo Backup): quem restaurou, quando e qual arquivo.

## Restaurar pela linha de comando

Use para um arquivo vindo de outra máquina, para um backup de versão anterior ou para recuperação de desastre. Na pasta `backend`:

```bash
npm run backup -- listar
npm run backup -- verificar caminho/do/backup.sql.gz
npm run backup -- restaurar caminho/do/backup.sql.gz --confirmar
```

- Sem `--confirmar`, nada é feito.
- Antes de restaurar, um backup de segurança do estado atual é criado.
- **Mesma versão:** mantém a auditoria e o histórico de backups atuais.
- **Versão diferente** (o backup foi gerado antes de uma atualização) ou **banco novo/vazio**: use `--completo`. Isso **apaga todas as tabelas** e carrega tudo do arquivo, inclusive a auditoria. Depois rode `npm run migrate` para atualizar o banco à versão atual.

```bash
npm run backup -- restaurar backup-antigo.sql.gz --confirmar --completo
npm run migrate
```

Pare a API antes de uma restauração pela linha de comando (`pm2 stop estoque`) e inicie depois (`pm2 start estoque`).

## Recuperação de desastre (servidor perdido)

1. Instale o sistema num servidor novo ([GUIA_INSTALACAO.md](GUIA_INSTALACAO.md), passos 1 a 5).
2. Copie o último backup guardado fora do servidor (o `.sql.gz` e, se tiver, o `.sha256`).
3. `pm2 stop estoque` (se já estiver rodando).
4. `npm --prefix backend run backup -- restaurar /caminho/backup.sql.gz --confirmar --completo`
5. `npm --prefix backend run migrate`
6. `pm2 start estoque` e confira o sistema.

## Teste de recuperação em ambiente separado

Faça periodicamente, **sem tocar no banco de produção**:

1. Num computador de teste (ou no mesmo servidor, com outro banco), copie o projeto e crie um `backend/.env` com `DB_NAME=estoque_restauracao_teste` (e `PORT=3334`, se for a mesma máquina).
2. `npm run configurar` para criar o banco vazio com as migrations.
3. `npm --prefix backend run backup -- restaurar /caminho/do/backup.sql.gz --confirmar --completo`
4. `npm --prefix backend run migrate`
5. Inicie (`npm run producao`) e confira: login, quantidade de produtos, saldos de alguns itens, equipamentos de um técnico e últimas movimentações.
6. Apague o banco de teste quando terminar.

### Validação automatizada

A suíte de testes (`npm test`) faz esse ciclo num banco separado (`DB_NAME_TEST`), a cada execução:

- gera backup e confere SHA-256, conteúdo e download;
- altera dados, tenta restaurar sem confirmação e com senha errada (recusado), restaura e confere que os dados voltaram ao estado do backup, que a auditoria foi preservada e que o backup de segurança foi criado;
- desfaz a restauração usando o backup de segurança;
- detecta arquivo adulterado (SHA-256) e recusa a restauração;
- aplica a retenção;
- testa o agendamento (diário, semanal, a cada N horas);
- confirma que uma falha gera notificação.

Resultado da última execução em [TESTES.md](TESTES.md).

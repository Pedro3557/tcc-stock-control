# Testes

## Como rodar

Na pasta principal do projeto:

```bash
npm test        # testes unitários + integrados (todos)
npm run lint    # ESLint no back-end e no front-end
npm run build   # build de produção do front-end
```

Só os testes unitários (não precisam de banco): `npm --prefix backend run test:unidade`.

### Banco separado

Os testes integrados **nunca usam o banco de trabalho**. Eles usam `DB_NAME_TEST` (padrão `<DB_NAME>_teste`, ex.: `estoque_provedor_teste`), que é **apagado e recriado** no início de cada arquivo de teste com as migrations e o seed essencial reais. A configuração recusa rodar se `DB_NAME_TEST` for igual a `DB_NAME`.

O usuário do banco precisa de permissão nesse banco. O `npm run configurar` concede essa permissão, inclusive em instalações antigas (pede a senha do root do MySQL), e no Docker ela vem do script `docker/mysql-init/01-banco-teste.sql`.

Se só os 13 testes unitários passarem e os demais acusarem falta de permissão no banco de testes, rode `npm run configurar` na pasta principal e repita o `npm test`. Se o container Docker foi criado antes desta versão, libere uma vez: `docker compose exec mysql mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS estoque_provedor_teste; GRANT ALL ON estoque_provedor_teste.* TO 'estoque'@'%';"`. Os backups dos testes vão para uma pasta temporária, apagada no final.

### Ferramentas

- `node:test` (executor nativo do Node.js) e `supertest` (requisições HTTP direto na aplicação Express, sem abrir porta);
- `qrcode` + `jsqr` para gerar a imagem de um QR Code e lê-la de volta;
- `exceljs` para montar planilhas de teste.

## O que é testado

| Arquivo | Área | Verificações principais |
|---|---|---|
| `regras.test.js` | Unidade | MAC (formatos e inválidos), lista de seriais `SERIAL;MAC`, regras de status, CSV (ponto e vírgula, BOM, aspas), números brasileiros, leitura de planilhas |
| `integracao/01-autenticacao` | Autenticação e permissões | Login errado auditado sem a senha; senha provisória bloqueia até a troca; troca invalida o token antigo; token ausente, inválido ou expirado → 401; permissões dos perfis admin/almoxarife/consulta; usuário desativado perde o acesso; limite de tentativas (429); erros padronizados |
| `integracao/02-estoque` | Estoque | Campos obrigatórios e código único; saldo inicial zero; entradas e saídas; **estoque negativo impedido**; quantidades inteiras; **6 saídas simultâneas** (só as que cabem no saldo passam); material com técnico (devolução e consumo limitados); série e **MAC duplicados** (na lista e no banco, tudo ou nada); saída/devolução de técnico; **comodato** (instalação com cliente e OS, retirada); equipamento com defeito não é instalado; **manutenção** (descrição obrigatória, retorno); baixa com motivo; histórico individual; ajuste de inventário; **saldo = soma do histórico**; exclusão lógica; bloqueio de exclusão de categoria e fornecedor com histórico |
| `integracao/03-relatorios-importacao` | Relatórios e importação | Os 7 relatórios (dados de PDF) com organização, emissão e filtros descritos; CSV com BOM, identificação, ponto e vírgula e filtros; modelos `.xlsx` válidos; importação de produtos com erros por linha, duplicados, prévia que não grava e gravação; importação de entrada tudo-ou-nada; recusa de arquivo não `.xlsx` |
| `integracao/04-qrcode-inventario` | QR Code e inventário | Gera o QR, lê a imagem e identifica o equipamento; o QR não leva dados sensíveis; leitura por código, série e MAC; consulta exige login; código permanente; inventário completo (conflito, contagem, leituras, localização incorreta, não encontrado, estoque intocado antes da aprovação, justificativa obrigatória, só admin aprova, ajustes aplicados, CSV/PDF); aprovação bloqueada se o saldo mudou; cancelamento |
| `integracao/05-auditoria-notificacoes` | Auditoria e notificações | Usuário, data, operação, módulo, registro, antes/depois e resultado; falhas registradas; filtros; **nenhuma senha, hash ou token** na auditoria; registros imutáveis; só admin consulta; alertas de mínimo e sem estoque **sem duplicar**; reabertura após normalizar; lidas/não lidas; marcar todas; destinatários por usuário; **e-mail** (transporte de teste) |
| `integracao/06-backup` | Backup e restauração | Arquivo `.sql.gz` com SHA-256 e sem senhas em texto; histórico e auditoria; verificação; download; restauração recusada sem confirmação e com senha errada; **restauração reverte os dados**, preserva a auditoria e cria o backup de segurança; desfazer pela cópia de segurança; arquivo adulterado detectado; retenção; agendamento (desativado, a cada N horas, diário, semanal); falha notifica os admins |
| `integracao/07-migrations` | Banco | Banco antigo **com dados** recebe as migrations novas sem perda (códigos de etiqueta gerados para unidades antigas); migrations novas **desfeitas e refeitas**; seed essencial repetido não duplica |

## Resultado da última execução

Executado em 27/11/2026, Node.js 22, MySQL 8.0.46, banco `estoque_provedor_teste`:

```
ℹ tests 49
ℹ pass 49
ℹ fail 0
ℹ cancelled 0
ℹ duration_ms 21872
```

| Verificação | Resultado |
|---|---|
| `npm test` (Linux, MySQL 8.0.46) | **49/49 testes aprovados** (~22 s) |
| `npm test` (Windows, MySQL 8 instalado pelo MySQL Installer) | **49/49 testes aprovados** (~49 s) |
| `npm run lint` | sem erros nem avisos |
| `npm run build` | build concluído (`frontend/dist`) |

### Defeitos encontrados pelos testes e corrigidos

| Defeito | Correção |
|---|---|
| Token emitido no mesmo segundo da troca de senha continuava válido | A "versão da senha" passou a ir dentro do token |
| Restauração de backup travava com arquivos pequenos (o leitor de linhas era criado antes dos comandos `SET`) | Leitor criado imediatamente antes do laço de leitura |
| Pasta de backups inacessível travava a API e o sistema de backup | O arquivo é aberto antes de começar; falhas são registradas e notificadas |
| Migration de cadastros não podia ser desfeita (índice usado pela chave estrangeira) | `down` cria um índice simples antes de remover o composto |
| Em instalações antigas o `npm run configurar` não liberava o banco de testes, e o `npm test` ficava travado | O `configurar` detecta e libera o acesso (pede a senha do root); os testes falham em segundos com a instrução |

## Verificações manuais (navegador)

Feitas com Playwright/Chromium em modo produção (`npm run producao`, porta 3333, com a política de segurança CSP ativa):

- As **22 telas**, com os **3 perfis**, em **desktop (1366 px)** e **celular (390 px)**: nenhum erro no console, nenhuma rolagem lateral e nenhum botão de alteração visível para o perfil consulta. O menu de cada perfil mostra só os módulos permitidos.
- Fluxos completos pela interface:
  - troca de senha obrigatória;
  - movimentações e bloqueio de instalação de equipamento com defeito;
  - geração de todos os PDFs;
  - etiquetas em PDF (os QR Codes impressos na folha A4 foram lidos e conferidos com o banco: 12 de 12);
  - leitura de etiqueta **por foto** e por digitação (simulando o leitor USB);
  - inventário de ponta a ponta;
  - configurações, backup, verificação, download e restauração;
  - auditoria e notificações.
- **PM2:** a aplicação voltou sozinha depois de um `kill -9`.
- **HTTPS:** sobe com certificado autoassinado e envia HSTS.

### Limitações conhecidas dos testes

- A leitura pela **câmera** depende de um dispositivo físico e não é coberta pelos testes automatizados. A decodificação da imagem e o fluxo de foto e de digitação são testados, e a câmera usa o mesmo decodificador.
- O envio real de e-mail depende do servidor SMTP da empresa. Os testes usam o transporte de teste do Nodemailer (conferem destinatário, assunto e corpo).

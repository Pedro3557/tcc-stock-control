# Arquitetura

## Visão geral

```
┌──────────────────────────── Navegador (computador / celular) ────────────────────────────┐
│ React 18 + React Router                                                                  │
│  páginas → componentes → services/api.js (Axios, token JWT)                              │
│  PDF (jsPDF) · QR Code (qrcode) · leitura por câmera/foto (BarcodeDetector ou jsQR)      │
└──────────────────────────────────────────────┬───────────────────────────────────────────┘
                                               │ HTTP ou HTTPS, mesma origem (/api)
┌──────────────────────────────────────────────▼───────────────────────────────────────────┐
│ Node.js + Express (backend/src)                                                          │
│  helmet/CSP → CORS → JSON → rotas (/api)                                                 │
│    └─ autenticar (JWT) → senha definitiva → permitir(perfis) → validar (express-validator)│
│        └─ controllers  → services (regras + transações)  → models (Sequelize)            │
│  auditoria · notificações/e-mail · configurações · agendador (backup e alertas)          │
│  em produção: entrega frontend/dist (SPA) na mesma porta                                 │
└──────────────────────────────────────────────┬───────────────────────────────────────────┘
                                               │ mysql2 (pool) + transações + SELECT … FOR UPDATE
┌──────────────────────────────────────────────▼───────────────────────────────────────────┐
│ MySQL 8 — estrutura só por migrations (sequelize-cli)                                    │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Decisões principais:

- **Uma única organização**, sem multiempresa. Os dados da organização ficam em `configuracoes`.
- **Regras no back-end**: o front-end esconde o que o perfil não pode fazer, mas toda permissão e validação é refeita na API.
- **Toda alteração de estoque passa por `movimentacaoService.registrar`**, inclusive importação e inventário. Isso garante uma regra só, numa transação só.
- **Histórico imutável**: movimentações nunca são editadas nem apagadas; correções são novas movimentações (ajuste).
- **Exclusão lógica** de produtos, técnicos e usuários (`ativo = false`).

## Back-end (`backend/src`)

| Pasta | Responsabilidade |
|---|---|
| `config/` | `database.js` (conexões por ambiente; o de teste usa `DB_NAME_TEST`), `index.js` (porta, JWT, CORS, HTTPS), `constantes.js` (status, tipos, unidades) |
| `models/` | Modelos Sequelize e associações |
| `migrations/` | Estrutura do banco, aditiva e versionada |
| `seeders/` / `seeders-demo/` | Dados essenciais / de demonstração |
| `routes/` | `index.js` (rotas e perfis) e `validacoes.js` |
| `middlewares/` | `auth` (JWT, senha provisória, perfis), `validar`, `upload` (xlsx), `limites` (força bruta), `erros` |
| `controllers/` | Tradução HTTP ↔ serviços, auditoria das operações |
| `services/` | `movimentacaoService`, `inventarioService`, `importacaoService`, `backupService`, `notificacaoService`, `emailService`, `auditoriaService`, `configuracaoService`, `agendador`, `csv`, `filtrosMovimentacao` |
| `utils/` | Erros (`AppError`), formatos (MAC, datas), paginação, códigos de etiqueta, sessão (token) |

### Movimentações (`services/movimentacaoService.js`)

Cada registro roda em **uma transação** com bloqueio de linha (`SELECT … FOR UPDATE`) do produto e dos equipamentos envolvidos. Assim, duas pessoas não conseguem tirar o mesmo saldo ao mesmo tempo (há teste com 6 saídas simultâneas).

| Tipo | Material (quantidade) | Equipamento (status) |
|---|---|---|
| `entrada_compra` | + quantidade (fornecedor e NF obrigatórios) | cria unidades `em_estoque` (série/MAC únicos) |
| `saida_tecnico` | − quantidade (não passa do saldo) | `em_estoque → com_tecnico` |
| `devolucao_tecnico` | + quantidade (até o que o técnico tem) | `com_tecnico → em_estoque` (mesmo técnico) |
| `instalacao_cliente` | — | `em_estoque/com_tecnico → instalado_cliente` (cliente e OS obrigatórios) |
| `retirada_cliente` | — | `instalado_cliente → em_estoque / em_manutencao / defeito` |
| `envio_manutencao` | — | `em_estoque/defeito → em_manutencao` (descrição do problema obrigatória) |
| `retorno_manutencao` | — | `em_manutencao → em_estoque / defeito` |
| `baixa` | − do estoque central, ou do que está com o técnico (consumo) | qualquer status físico `→ baixado` (motivo obrigatório) |
| `ajuste_inventario` | define a quantidade contada (só admin, motivo obrigatório) | define o novo status (só admin) |

- O saldo de produto serializado é sempre a contagem de unidades `em_estoque`, recalculada na mesma transação.
- O saldo de material com cada técnico é calculado pelas movimentações: saídas − devoluções − baixas no nome dele.
- Unidades `un`, `cx`, `pct` e `rolo` só aceitam quantidades inteiras; `m` aceita decimais.

### Inventário físico (`services/inventarioService.js`)

```
em_contagem ──finalizar──▶ em_revisao ──aprovar (admin)──▶ concluido
     ▲                        │
     └──────reabrir───────────┘        (em_contagem/em_revisao) ──cancelar──▶ cancelado
```

- Ao criar, guarda o saldo do sistema de cada produto (`quantidadeSistema`) e as unidades que deveriam estar no almoxarifado (`em_estoque` e `defeito`). Um produto não pode estar em dois inventários abertos.
- Contagens e leituras **não** mexem no estoque.
- Divergências: quantidade diferente; unidade esperada e não lida (**não encontrada**); unidade lida mas que, no sistema, está com técnico, cliente, manutenção ou baixada (**localização incorreta**).
- Cada divergência precisa de uma decisão (ajustar ou manter) com justificativa. Na aprovação, o admin aplica os ajustes como `ajuste_inventario` numa **única transação**. Se o saldo ou o status mudou desde o início, a aprovação é bloqueada.

### QR Code

- Cada equipamento recebe um `codigoEtiqueta`: 10 caracteres aleatórios sem letras ambíguas, permanente e único.
- O QR contém só `ENDEREÇO/e/CÓDIGO`, sem série, MAC ou cliente. Abrir o endereço exige login.
- `GET /equipamentos/leitura?valor=` resolve QR, código, número de série ou MAC; as movimentações e o inventário aceitam os mesmos valores.

### Notificações (`services/notificacaoService.js`)

- Destinatários: usuários ativos admin/almoxarife com `recebeNotificacoes`; e-mail para quem tem `recebeEmail` quando **Configurações → e-mail** está ativo e o SMTP está definido no `.env`.
- **Sem duplicidade:** a tabela `alertas_ativos` guarda as situações em alerta (`estoque_minimo:<id>`, `sem_estoque:<id>`). Enquanto a chave existir, não há nova notificação; quando o estoque volta ao normal, a chave é removida.
- A verificação roda após cada movimentação, importação, edição de produto e aprovação de inventário, e a cada 15 minutos pelo agendador.
- Também geram notificação as divergências de inventário (ao encerrar a contagem) e as falhas de backup (só para admins).

### Auditoria (`services/auditoriaService.js`)

Registra usuário (id + nome no momento), data/hora, operação, módulo, id do registro, dados anteriores e posteriores (JSON), resultado (sucesso/falha), detalhe e IP. Campos com nomes como senha, hash, token, segredo e similares são removidos antes de gravar. O model bloqueia `update`/`destroy` e não há rota de alteração.

Operações auditadas: login (sucesso e falha), troca de senha, usuários, produtos, categorias, fornecedores, técnicos, equipamentos, movimentações (inclusive as recusadas), inventário (criar, encerrar, justificar, aprovar, cancelar), importações, configurações, backup, download e restauração.

### Backup (`services/backupService.js`)

O backup é lógico e gerado pela própria aplicação, sem depender do `mysqldump`: estrutura e dados de todas as tabelas num `.sql.gz` com cabeçalho e marcador de fim, mais um SHA-256 no banco e num arquivo `.sha256`. Agendamento, retenção, restauração e recuperação estão em [BACKUP_RESTAURACAO.md](BACKUP_RESTAURACAO.md).

### Agendador (`services/agendador.js`)

Roda dentro da API (por isso PM2 com uma instância):

- a cada minuto, confere se é hora do backup automático;
- a cada 15 minutos, confere os alertas de estoque;
- uma vez por dia, remove notificações lidas há mais de 180 dias;
- ao iniciar, marca como falha os backups interrompidos por reinício.

## Banco de dados

```
usuarios ─┬─< movimentacoes >─┬─ produtos >── categorias
          │        │          │      │
          │        │          │      └─< equipamentos >── tecnicos
          │        ├─ tecnicos│             │
          │        ├─ fornecedores          │
          │        └─ equipamentos ─────────┘
          ├─< auditorias          ├─< notificacoes        alertas_ativos
          ├─< backups             └─< inventarios ─┬─< inventario_itens >── produtos
          └─ configuracoes (atualizadoPor)         └─< inventario_equipamentos >── equipamentos
```

| Tabela | Conteúdo | Restrições e índices |
|---|---|---|
| `usuarios` | nome, e-mail, hash da senha, perfil, ativo, senha provisória, versão da senha, preferências de notificação | e-mail único |
| `categorias` | nome | nome único; exclusão bloqueada se houver produtos |
| `produtos` | código (SKU), nome, descrição, marca, modelo, tipo de controle, unidade, local, mínimo, custo, saldo, ativo | código único; FK categoria (RESTRICT); índice por nome |
| `equipamentos` | código da etiqueta, série, MAC, status, técnico, cliente, observação | série, MAC e código únicos; índices por status e cliente |
| `tecnicos`, `fornecedores` | cadastros | CNPJ único |
| `movimentacoes` | tipo, quantidade, produto, equipamento, usuário, técnico, fornecedor, cliente, OS, NF, observação, status anterior/novo | FKs RESTRICT; índices por data, tipo, cliente, OS e (técnico, produto) |
| `inventarios`, `inventario_itens`, `inventario_equipamentos` | sessões, contagens, leituras, decisões e vínculo com o ajuste aplicado | (inventário, produto) e (inventário, equipamento) únicos |
| `notificacoes`, `alertas_ativos` | central de notificações e situações em alerta | índices (usuário, lida) e data |
| `auditorias` | registro de operações | índices por data, (módulo, ação) e (módulo, registro) |
| `backups` | histórico de backups | índice por data |
| `configuracoes` | chave/valor das configurações | — |

**Integridade:** as chaves estrangeiras usam `RESTRICT` onde apagar quebraria o histórico, e `SET NULL` onde a referência é opcional. Cadastros com histórico não são apagados (exclusão lógica). Datas são gravadas no fuso de Brasília (`-03:00`).

## Segurança

| Item | Como é feito |
|---|---|
| Senhas | bcrypt (custo 10); mínimo de 8 caracteres com maiúscula, minúscula, número e caractere especial (regra única em `utils/senha.js`, espelhada na tela); senha definida pelo admin é provisória (troca obrigatória) |
| Sessão | JWT (`JWT_SECRET` obrigatório e forte em produção; validade `JWT_EXPIRACAO`). O token leva a "versão da senha": ao trocá-la, os tokens antigos deixam de valer. Usuário inativado perde o acesso na hora |
| Força bruta | 10 erros de login a cada 15 min por IP + e-mail → 429 |
| Permissões | `permitir(...)` em cada rota de alteração; front-end esconde o que o perfil não pode usar |
| Entrada | express-validator em todas as rotas de escrita; upload aceita só `.xlsx` de até 5 MB |
| Cabeçalhos | helmet com CSP restrita (`self` + Google Fonts), `frame-ancestors 'none'`, HSTS só com HTTPS, `Permissions-Policy` (câmera só no próprio site) |
| CORS | desligado em produção (mesma origem), configurável por `CORS_ORIGIN` |
| Segredos | somente em `.env` (fora do Git); a auditoria nunca grava senha, hash ou token; o QR não contém dados |
| Backups | pasta com permissão restrita, download e restauração só para admin, restauração com senha + confirmação |

## API

Todas as rotas estão em `backend/src/routes/index.js` e listadas no [README](../README.md#rotas-da-api). Convenções:

- Listas grandes são paginadas: `?pagina=1&limite=50` → `{ dados, total, pagina, limite, paginas }`.
- Datas de filtro no formato `AAAA-MM-DD`, no horário de Brasília.
- Erros: `{ erro, detalhes? }` com 400 (validação/regra), 401 (sessão), 403 (perfil ou senha provisória: `codigo: TROCA_SENHA_OBRIGATORIA`), 404, 409 (duplicidade), 429 (tentativas), 503 (restauração em andamento) ou 500.
- `POST /movimentacoes` — corpo: `tipo`, `produtoId`, `quantidade`, `novaQuantidade` (ajuste), `seriais` (texto ou lista; na entrada, `SERIAL;MAC` por linha; nos demais tipos, série, MAC ou QR), `equipamentoIds`, `tecnicoId`, `fornecedorId`, `clienteCodigo`, `clienteNome`, `numeroOS`, `notaFiscal`, `destino` (novo status), `custoUnitario`, `observacao`.
- Importação: `multipart/form-data` com `arquivo` (.xlsx) e `simular=true|false`.

## Front-end (`frontend/src`)

| Pasta | Conteúdo |
|---|---|
| `pages/` | uma tela por arquivo (Painel, Produtos, Equipamentos, NovaMovimentacao, Inventarios, Relatorios, Auditoria, Backups…) |
| `components/` | Layout (menu por seções e notificações), LeitorCodigo (câmera/foto/USB), CadastroSimples, Modal, Paginacao, Graficos, StatusBadge… |
| `services/` | `api.js` (Axios, token, 401 → login, troca de senha obrigatória), `pdf.js`, `etiquetas.js`, `organizacao.js`, `formatos.js` |
| `context/` | `AuthContext` (usuário e permissões), `ToastContext` (mensagens) |

O jsPDF, o gerador de etiquetas e o jsQR são carregados sob demanda, então não pesam na abertura do sistema. Em desenvolvimento, o Vite repassa `/api` para a porta 3333.

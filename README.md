# Controle de Estoque — Provedor de Internet

Sistema web de **gestão e controle de estoque** para o almoxarifado de **uma** empresa provedora de internet (ISP / fibra óptica), de uso interno, acessado pela rede da empresa no computador ou no celular.

## Objetivos

- Controlar **materiais de consumo** (cabo drop, conectores, splitters, CTOs…) por quantidade e **equipamentos** (ONU/ONT, roteadores, SFP…) unidade por unidade, pelo número de série e MAC.
- Saber a qualquer momento **onde está cada equipamento**: em estoque, com um técnico, instalado em um cliente (comodato), em manutenção, com defeito ou baixado.
- Registrar toda entrada e saída com **histórico, responsável e motivo**, sem permitir estoque negativo.
- Apoiar a rotina com **QR Code**, **inventário físico**, **relatórios**, **alertas** e **backup**.

## Tecnologias

| Camada | Tecnologias |
|---|---|
| Front-end | React 18, Vite 5, React Router, Axios, Recharts (gráficos), jsPDF (PDF), qrcode e jsQR (QR Code) |
| Back-end | Node.js 20+, Express, Sequelize (ORM), express-validator, JWT, bcrypt (bcryptjs), helmet, multer + ExcelJS (planilhas), Nodemailer (e-mail) |
| Banco | MySQL 8 (migrations e seeders com sequelize-cli) |
| Operação | PM2 (execução contínua), Docker Compose (MySQL de desenvolvimento) |
| Qualidade | node:test + supertest (testes integrados), ESLint |

## Arquitetura (resumo)

```
Navegador (React)  ──HTTP/HTTPS──▶  API Express (/api)  ──Sequelize──▶  MySQL 8
   telas, PDF, QR                   rotas → validação → controllers → services (transações)
                                    + auditoria, notificações, agendador (backup/alertas)
Em produção a própria API entrega o front-end compilado: uma porta só na rede interna.
```

Detalhes em [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Painel** | Indicadores reais (produtos, valor do estoque, abaixo do mínimo, materiais e equipamentos disponíveis, com técnicos, em comodato, em manutenção, com defeito), gráfico de entradas × saídas com **filtro de período**, equipamentos por status e movimentações recentes |
| **Produtos** | Cadastro, edição, consulta, inativação (exclusão lógica), descrição, categoria, unidade, mínimo, custo, busca e filtros, barra de nível, destaque de abaixo do mínimo, paginação e atalho para o histórico |
| **Equipamentos** | Unidades serializadas com nº de série e MAC únicos, situação atual (técnico/cliente), histórico individual e **QR Code** |
| **Movimentações** | Entrada (compra), saída e devolução de técnico, instalação e retirada no cliente (comodato), envio e retorno de manutenção, baixa e ajuste de inventário — sempre em **transação**, sem estoque negativo e com validação de status |
| **Ler etiqueta** | Leitura de **QR Code pela câmera** (computador/celular), por **foto** ou por **leitor de código de barras**, abrindo o equipamento automaticamente |
| **Etiquetas QR Code** | Etiqueta individual ou em lote, em **PDF** (folha A4 ou impressora térmica 50 × 30 mm) |
| **Inventário físico** | Sessões por categoria/produto, contagem de materiais, conferência de equipamentos por leitura, divergências (quantidade, não encontrado, localização incorreta), justificativa obrigatória, **aprovação pelo administrador**, histórico e PDF/CSV |
| **Técnicos** | Cadastro, o que cada um tem em mãos, **pendências de devolução**, histórico e **termo de responsabilidade em PDF** |
| **Fornecedores e categorias** | Cadastros, histórico de entradas por fornecedor e bloqueio de exclusões que quebrariam o histórico |
| **Relatórios** | Estoque atual, abaixo do mínimo, em posse dos técnicos, comodato, manutenção, equipamentos por status, movimentações por período e termo de responsabilidade — em **PDF e CSV**, com organização, data de emissão e filtros |
| **Importar planilha** | Cadastro de produtos e entrada de compra por **Excel (.xlsx)**, com modelo, prévia, erros por linha e gravação tudo-ou-nada |
| **Notificações** | Central com lidas/não lidas: abaixo do mínimo, sem estoque, divergências de inventário e falhas de backup, sem repetir o mesmo alerta; **e-mail opcional (SMTP)** |
| **Auditoria** | Quem fez o quê e quando (antes/depois, resultado, IP), somente leitura, com filtros |
| **Backups** | Automáticos (frequência configurável), manual, retenção, verificação de integridade (SHA-256), download e **restauração segura** |
| **Usuários e segurança** | Perfis admin / almoxarife / consulta, JWT, senhas com bcrypt, troca obrigatória da senha provisória, limite de tentativas de login, sessões encerradas ao trocar a senha |
| **Configurações** | Dados da organização (usados em relatórios e etiquetas), endereço do sistema para os QR Codes, agenda de backup e e-mail |

Guia de uso de cada tela: [docs/MANUAL_USUARIO.md](docs/MANUAL_USUARIO.md).

### Perfis de acesso

| Ação | admin | almoxarife | consulta |
|---|:-:|:-:|:-:|
| Consultar painel, produtos, equipamentos, histórico, inventários, relatórios | ✓ | ✓ | ✓ |
| Registrar movimentações, importar planilhas, imprimir etiquetas | ✓ | ✓ | — |
| Abrir inventário, contar e justificar divergências | ✓ | ✓ | — |
| Aprovar ajustes de inventário e fazer ajuste direto | ✓ | — | — |
| Cadastrar/editar produtos, categorias, técnicos, fornecedores | ✓ | ✓ | — |
| Excluir/inativar cadastros | ✓ | — | — |
| Usuários, auditoria, backups e configurações | ✓ | — | — |

As permissões valem no back-end (403) e o front-end esconde o que o perfil não pode usar.

## Estrutura do projeto

```
backend/
  src/
    app.js, server.js        aplicação Express e inicialização (HTTP/HTTPS, agendador)
    config/                  conexão, configurações, constantes
    models/                  modelos Sequelize
    migrations/              estrutura do banco (somente por migrations)
    seeders/                 dados essenciais (admin + categorias padrão)
    seeders-demo/            dados de DEMONSTRAÇÃO (opcionais)
    routes/                  rotas e validações
    controllers/             entrada/saída HTTP de cada módulo
    middlewares/             autenticação, perfis, validação, upload, limites, erros
    services/                regras: movimentações, inventário, importação, backup,
                             notificações, e-mail, auditoria, configurações, agendador
    utils/
  scripts/                   backup.js (linha de comando), redefinir-senha.js
  tests/                     testes unitários e integrados
frontend/
  src/
    pages/                   telas
    components/              layout, leitor de QR, tabelas, modais, gráficos…
    services/                API, PDF, etiquetas, formatação
    context/                 autenticação e mensagens
scripts/                     configurar.js (instalação), producao.js
docs/                        manual, instalação, arquitetura, testes, backup, changelog
docker-compose.yml           MySQL 8 para desenvolvimento
ecosystem.config.cjs         PM2 (produção)
```

## Requisitos

- **Node.js 20** ou superior
- **MySQL 8** — instalado (MySQL Installer, XAMPP, serviço Linux) **ou** pelo **Docker**
- Navegador atualizado (Chrome, Edge, Firefox, Safari)

## Instalação rápida (desenvolvimento)

Na pasta principal do projeto, com o MySQL ligado (Docker: `docker compose up -d`):

```bash
npm install          # instala back-end e front-end
npm run configurar   # .env, banco, usuário "estoque", tabelas e dados essenciais
npm run dev          # API em :3333 e tela em :5173, juntas
```

Abra http://localhost:5173 e entre com **admin@provedor.com / admin123**. A troca da senha é obrigatória no primeiro acesso.

- Se o usuário `estoque` não existir no MySQL, o `npm run configurar` pede a senha do **root** do MySQL e cria o banco e o usuário.
- Para ter dados de exemplo (treinamento): `npm run configurar -- --demo` em um banco vazio.

Passo a passo completo (Windows e Linux, sem Docker, rede interna, HTTPS, PM2): [docs/GUIA_INSTALACAO.md](docs/GUIA_INSTALACAO.md).

## Variáveis de ambiente

Arquivo `backend/.env` (modelo comentado em [backend/.env.example](backend/.env.example)):

| Variável | Uso | Padrão |
|---|---|---|
| `PORT`, `HOST` | Porta e interface da API | `3333`, `0.0.0.0` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Banco MySQL | `localhost`, `3306`, `estoque_provedor`, `estoque`, `estoque123` |
| `DB_NAME_TEST` | Banco separado dos testes (apagado a cada execução) | `<DB_NAME>_teste` |
| `JWT_SECRET` | Segredo dos tokens (**obrigatório e forte em produção**) | gerado pelo `configurar` |
| `JWT_EXPIRACAO` | Validade da sessão | `10h` |
| `CORS_ORIGIN` | Origens extras permitidas | desligado em produção |
| `SERVIR_FRONTEND` | API entrega `frontend/dist` | `true` em produção |
| `HTTPS_CERT`, `HTTPS_KEY` | Certificado para HTTPS (câmera pela rede) | — |
| `BACKUP_DIR` | Pasta dos backups | `backend/backups` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | E-mail das notificações | — |
| `TRUST_PROXY` | Atrás de proxy reverso | — |

O front-end não precisa de variáveis: ele chama a API em `/api` (mesma origem). `VITE_API_URL` só é necessária se a API estiver em outro endereço.

## Banco de dados e migrations

A estrutura do banco é criada e atualizada **somente por migrations** (nunca `sync`). Todas são aditivas e compatíveis com bancos já em uso (testado em [docs/TESTES.md](docs/TESTES.md)).

```bash
npm --prefix backend run migrate          # aplica as migrations pendentes
npm --prefix backend run migrate:desfazer # desfaz só a última
npm --prefix backend run seed             # dados essenciais (pode repetir sem duplicar)
npm --prefix backend run seed:demo        # dados de demonstração (só em banco vazio)
```

## Testes, lint e build

```bash
npm test        # 49 testes: unitários + integrados no banco DB_NAME_TEST
npm run lint    # ESLint em todo o projeto
npm run build   # build de produção do front-end
```

Cobertura e resultados: [docs/TESTES.md](docs/TESTES.md).

## Produção na rede interna

```bash
npm install
npm run configurar
npm run producao:preparar      # build do front-end + migrations
npm install -g pm2
pm2 start ecosystem.config.cjs # roda continuamente e reinicia sozinho
pm2 save
```

O sistema fica em `http://IP-DO-SERVIDOR:3333` para toda a rede. Para usar a **câmera do celular** pela rede é preciso **HTTPS** (`HTTPS_CERT`/`HTTPS_KEY`); sem HTTPS, a leitura por foto e o leitor USB continuam funcionando. Portas, firewall, HTTPS e início automático: [docs/GUIA_INSTALACAO.md](docs/GUIA_INSTALACAO.md#7-produção-na-rede-interna).

## Backup e restauração

- Backups **automáticos** (diário, semanal ou a cada N horas) e **manuais**, com retenção, SHA-256 e histórico, em **Backups** (admin).
- **Restauração** pela tela, com senha + confirmação, backup de segurança automático antes e reversão em caso de falha.
- Linha de comando: `npm --prefix backend run backup -- criar | listar | verificar <arq> | restaurar <arq> --confirmar`.

Procedimentos e teste de recuperação: [docs/BACKUP_RESTAURACAO.md](docs/BACKUP_RESTAURACAO.md).

## Rotas da API

Base `/api`. JSON em todas as respostas (exceto CSV, XLSX, backup). Erros: `{ "erro": "mensagem", "detalhes": [...] }`. Exceto `GET /saude` e `POST /auth/login`, todas exigem `Authorization: Bearer <token>` e senha definitiva já trocada.

| Grupo | Rotas |
|---|---|
| Autenticação | `POST /auth/login` · `GET /auth/me` · `POST /auth/trocar-senha` |
| Cadastros | `GET/POST /categorias`, `GET/PUT/DELETE /categorias/:id` (idem `produtos`, `tecnicos`, `fornecedores`) · `GET /tecnicos/:id/estoque` · `GET /tecnicos/pendencias` |
| Usuários (admin) | `GET/POST /usuarios` · `GET/PUT/DELETE /usuarios/:id` |
| Equipamentos | `GET /equipamentos` · `GET /equipamentos/leitura?valor=` · `GET /equipamentos/:id` · `GET /equipamentos/:id/historico` · `PUT /equipamentos/:id` |
| Movimentações | `GET /movimentacoes` · `GET /movimentacoes/:id` · `POST /movimentacoes` |
| Inventário | `GET/POST /inventarios` · `GET /inventarios/:id` · `POST /inventarios/:id/contagens` · `POST /inventarios/:id/leituras` · `DELETE /inventarios/:id/leituras/:linhaId` · `POST /inventarios/:id/finalizar` · `POST /inventarios/:id/reabrir` · `PUT /inventarios/:id/decisoes` · `POST /inventarios/:id/aprovar` (admin) · `POST /inventarios/:id/cancelar` · `GET /inventarios/:id/exportar` · `GET /inventarios/:id/relatorio` |
| Painel e relatórios | `GET /dashboard?inicio&fim` · `GET /relatorios/dados?relatorio=` · `GET /relatorios/exportar?relatorio=` (`estoque`, `abaixo_minimo`, `equipamentos`, `com_tecnicos`, `comodato`, `manutencao`, `movimentacoes`) |
| Importação | `GET /importacao/modelo/:tipo` · `POST /importacao/produtos` · `POST /importacao/entrada` |
| Notificações | `GET /notificacoes` · `GET /notificacoes/contagem` · `PATCH /notificacoes/:id/lida` · `POST /notificacoes/marcar-todas-lidas` |
| Configurações | `GET /configuracoes/publicas` · `GET/PUT /configuracoes` (admin) |
| Auditoria (admin) | `GET /auditoria` · `GET /auditoria/opcoes` · `GET /auditoria/:id` |
| Backups (admin) | `GET/POST /backups` · `POST /backups/:id/verificar` · `GET /backups/:id/download` · `POST /backups/:id/restaurar` |

Regras e parâmetros de cada operação: [docs/ARQUITETURA.md](docs/ARQUITETURA.md#api).

## Documentação

- [Manual do usuário](docs/MANUAL_USUARIO.md) — uso de cada módulo, para treinamento
- [Guia de instalação](docs/GUIA_INSTALACAO.md) — Windows e Linux, desenvolvimento e produção
- [Arquitetura](docs/ARQUITETURA.md) — camadas, banco, regras e segurança
- [Testes](docs/TESTES.md) — como rodar e resultados
- [Backup e restauração](docs/BACKUP_RESTAURACAO.md)
- [Histórico de mudanças](docs/CHANGELOG.md)

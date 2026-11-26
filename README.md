# Estoque — Provedor de Internet

Sistema web de **controle de estoque** para o almoxarifado de **uma** empresa provedora de internet (ISP / fibra óptica).
É de uso interno: não há cadastro de várias empresas.

- **Front-end:** React + Vite + React Router + Axios (`/frontend`)
- **Back-end:** Node.js + Express + Sequelize + MySQL (`/backend`)
- **Banco:** MySQL 8 (via `docker-compose.yml` para desenvolvimento)

> 🪟 **Vai instalar no Windows?** Siga o [guia passo a passo para Windows](GUIA_INSTALACAO_WINDOWS.md).

Principais recursos: estoque de equipamentos serializados e materiais por quantidade, movimentações com regras de status, painel com gráficos, relatórios em **PDF** e **CSV**, termo de responsabilidade do técnico, **importação de planilhas do Excel**, troca de senha obrigatória no primeiro acesso e limite de tentativas de login.

O sistema controla dois tipos de item:

| Tipo | Como é controlado | Exemplos |
|---|---|---|
| **Equipamentos serializados** | Unidade por unidade, pelo **número de série** e/ou **MAC**, cada uma com um status | ONU/ONT, roteador Wi-Fi, mesh, switch, rádio, módulo SFP |
| **Materiais de consumo** | Por **quantidade** (un, m, cx, pct, rolo) | Cabo drop, cabo UTP, conector SC/APC, RJ45, splitter, CTO, caixa de emenda, fita, abraçadeira, fonte |

Status de um equipamento: `em_estoque`, `com_tecnico`, `instalado_cliente` (comodato), `em_manutencao`, `defeito` e `baixado`.

---

## 1. Requisitos

- **Node.js 20 ou superior** (`node -v`)
- **MySQL 8**, instalado na máquina **ou** pelo **Docker** (Docker Desktop / Docker Engine com Compose)

## 2. Subir o MySQL com Docker

Na raiz do projeto:

```bash
docker compose up -d
```

Isso cria um MySQL 8 em `localhost:3306` com:

| Item | Valor |
|---|---|
| Banco | `estoque_provedor` |
| Usuário | `estoque` |
| Senha | `estoque123` |
| Senha do root | `root` |

Os dados ficam no volume `mysql_dados` (sobrevivem a reinícios). Para conferir se está pronto: `docker compose ps` (status *healthy*).

> **Sem Docker?** Crie o banco e o usuário no seu MySQL 8:
>
> ```sql
> CREATE DATABASE estoque_provedor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'estoque'@'localhost' IDENTIFIED BY 'estoque123';
> GRANT ALL PRIVILEGES ON estoque_provedor.* TO 'estoque'@'localhost';
> FLUSH PRIVILEGES;
> ```

## 3. Back-end

```bash
cd backend
npm install
cp .env.example .env        # no Windows (PowerShell): copy .env.example .env
```

Variáveis do `.env`:

| Variável | Descrição | Padrão do exemplo |
|---|---|---|
| `PORT` | Porta da API | `3333` |
| `DB_HOST` | Host do MySQL | `localhost` |
| `DB_PORT` | Porta do MySQL | `3306` |
| `DB_NAME` | Nome do banco | `estoque_provedor` |
| `DB_USER` | Usuário do banco | `estoque` |
| `DB_PASSWORD` | Senha do banco | `estoque123` |
| `JWT_SECRET` | Segredo para assinar o token de login — **troque por um valor longo e aleatório** | — |
| `CORS_ORIGIN` | (opcional) Origens permitidas, separadas por vírgula | `http://localhost:5173` |

Crie as tabelas (migrations) e carregue os dados iniciais (seed):

```bash
npm run migrate
npm run seed
```

Inicie a API:

```bash
npm run dev      # desenvolvimento (reinicia ao salvar)
npm start        # produção
```

A API fica em `http://localhost:3333/api` (teste: `http://localhost:3333/api/saude`).

Outros scripts: `npm test` (testes automatizados), `npm run migrate:undo` (desfaz todas as migrations), `npm run seed:undo` (remove os dados do seed) e `npm run redefinir-senha -- <email> <senha>` (redefine a senha de um usuário).
O banco é sempre criado por **migrations** — o sistema não usa `sync({ force: true })`.

### Usuários criados pelo seed

| Perfil | E-mail | Senha |
|---|---|---|
| **admin** | `admin@provedor.com` | `admin123` |
| almoxarife | `almoxarife@provedor.com` | `almox123` |
| consulta | `consulta@provedor.com` | `consulta123` |

> No primeiro acesso, cada usuário é **obrigado a trocar a senha** (mínimo de 8 caracteres, com letras e números). O mesmo vale para usuários criados pelo admin ou com senha redefinida por ele.

O seed também cria: categorias (ONU/ONT, Roteadores, Mesh, Switches, Rádios, Módulos SFP, Cabos, Conectores, Splitters, Caixas, Acessórios, Ferramentas), 15 produtos típicos de provedor, 19 unidades de ONU/roteador/SFP com números de série e MAC de exemplo (algumas em estoque, com técnico, em comodato, em manutenção e com defeito), 2 técnicos, 1 fornecedor e as movimentações que geram esses saldos.

## 4. Front-end

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env        # VITE_API_URL e VITE_EMPRESA_NOME
npm run dev
```

Acesse `http://localhost:5173` e entre com `admin@provedor.com` / `admin123`.

`VITE_EMPRESA_NOME` é o nome que aparece no cabeçalho dos PDFs.

Para gerar a versão de produção: `npm run build` (arquivos em `frontend/dist`, que podem ser servidos por qualquer servidor web — configure o fallback de rotas para `index.html`).

> **Usar no celular na mesma rede Wi-Fi:** o Vite já escuta na rede (`host: true`). No `.env` do front-end use o IP da máquina, ex.: `VITE_API_URL=http://192.168.0.10:3333/api`, e no `.env` do back-end inclua a origem em `CORS_ORIGIN` (ex.: `http://192.168.0.10:5173`).

---

## 5. Perfis de usuário

| Ação | admin | almoxarife | consulta |
|---|:-:|:-:|:-:|
| Ver painel, produtos, equipamentos, histórico, técnicos, relatórios | ✓ | ✓ | ✓ |
| Registrar movimentações | ✓ | ✓ | — |
| Ajuste de inventário | ✓ | — | — |
| Cadastrar/editar produtos, categorias, técnicos, fornecedores | ✓ | ✓ | — |
| Excluir/inativar cadastros | ✓ | — | — |
| Gerenciar usuários | ✓ | — | — |

Os botões são escondidos no front-end conforme o perfil, e a API também bloqueia (403).

## 6. Recursos

### Segurança no login
- Senha guardada com hash **bcrypt** e login por **JWT** (validade de 10 h).
- **Troca de senha obrigatória** no primeiro acesso: enquanto a senha for provisória, a API só responde a `/auth/me` e `/auth/trocar-senha` (as outras rotas devolvem 403 com `codigo: "TROCA_SENHA_OBRIGATORIA"`).
- **Limite de tentativas**: após 10 logins errados em 15 minutos (por IP + e-mail) a API responde 429. Logins certos não contam.
- Qualquer usuário pode trocar a própria senha pelo link **Trocar senha** no menu.

### Relatórios (tela **Relatórios**)
| Relatório | PDF | CSV |
|---|:-:|:-:|
| Estoque atual (itens abaixo do mínimo em vermelho) | ✓ | ✓ |
| Equipamentos por status (filtro de status) | ✓ | ✓ |
| Movimentações do período (filtros de data e tipo) | ✓ | ✓ |
| **Termo de responsabilidade do técnico** (o que ele tem em mãos + linhas para assinatura) | ✓ | — |

O PDF é gerado no navegador (jsPDF), com cabeçalho da empresa, resumo, tabela e numeração de páginas. O termo também pode ser gerado na tela do técnico.

### Importação de planilha (tela **Importar planilha** — admin e almoxarife)
1. **Baixe o modelo** (.xlsx). A aba *Instruções* explica cada coluna.
2. Preencha e envie. Duas opções:
   - **Cadastro de produtos** — colunas `codigo`, `nome`, `categoria` (obrigatórias), `marca`, `modelo`, `tipo_controle`, `unidade`, `local`, `estoque_minimo`, `custo_unitario`. Código existente = atualiza o cadastro; categoria nova é criada.
   - **Entrada de compra** — fornecedor e nota fiscal escolhidos na tela; colunas `codigo` + `quantidade` (materiais) ou `codigo` + `numero_serie` + `mac` (uma linha por equipamento) e `custo_unitario` opcional.
3. **Ver prévia**: confere tudo sem gravar e lista os erros com o número da linha.
4. **Confirmar importação**: grava tudo em **uma única transação** — se houver qualquer erro, nada é gravado.

Cabeçalhos aceitam variações (ex.: "Número de série", "Serial", "SN"); números aceitam vírgula decimal (`0,45`, `1.234,56`). Limite: 5 MB e 5.000 linhas.

### Painel com gráficos
- **Movimentações por dia** (últimos 14 dias): entradas × saídas, com dica ao passar o mouse e opção "Ver em tabela".
- **Equipamentos por status**: quantas unidades estão em estoque, com técnico, em comodato, em manutenção, com defeito e baixadas.

### Testes automatizados
```bash
cd backend
npm test
```
Testam as regras que não dependem do banco: MAC, lista de seriais, regras de status, CSV e leitura das planilhas.

## 7. Movimentações e regras

| Tipo | Serializado | Quantidade | Efeito |
|---|:-:|:-:|---|
| `entrada_compra` | ✓ | ✓ | Fornecedor e nota fiscal obrigatórios. Para serializados, cole uma lista (uma unidade por linha: `SERIAL` ou `SERIAL;MAC` — aceita vírgula ou TAB, pode colar do Excel). Custo unitário opcional atualiza o custo do produto. |
| `saida_tecnico` | ✓ | ✓ | Técnico obrigatório. `em_estoque → com_tecnico`; material sai do estoque central. |
| `devolucao_tecnico` | ✓ | ✓ | `com_tecnico → em_estoque`; material volta (limitado ao que o técnico tem). |
| `instalacao_cliente` | ✓ | — | Código do cliente e nº da OS obrigatórios. `em_estoque`/`com_tecnico → instalado_cliente`. |
| `retirada_cliente` | ✓ | — | `instalado_cliente →` estoque, manutenção ou defeito (campo `destino`). |
| `envio_manutencao` | ✓ | — | `em_estoque`/`defeito → em_manutencao`. |
| `retorno_manutencao` | ✓ | — | `em_manutencao →` estoque ou defeito. |
| `baixa` | ✓ | ✓ | Motivo obrigatório. Equipamento `→ baixado`. Para material, a baixa pode ser do **estoque central** ou do **material em posse de um técnico** (consumo em OS / perda em campo — informe o `tecnicoId`). |
| `ajuste_inventario` | ✓ | ✓ | **Só admin.** Material: informe a quantidade contada (`novaQuantidade`); a diferença é registrada. Equipamento: informe o novo status (`destino`). Motivo obrigatório. |

Regras garantidas pela API:

- Toda movimentação roda em **uma transação** do Sequelize: o registro e a atualização de saldo/status são gravados juntos (ou nada é gravado). Linhas de produto e equipamento são travadas (`SELECT … FOR UPDATE`) para evitar corrida entre dois usuários.
- Saída maior que o saldo e movimentação de equipamento no status errado retornam **400** com mensagem clara (ex.: *“O equipamento HWTC… está com status "Defeito" e não pode passar por "Instalação no cliente"”*).
- Número de série e MAC são únicos (verificados na lista colada e no banco). O MAC é normalizado para `AA:BB:CC:DD:EE:FF`.
- Unidades `un`, `cx`, `pct` e `rolo` só aceitam quantidades inteiras; `m` aceita decimais.
- Para produtos serializados, `quantidade` = número de unidades com status `em_estoque` (recalculado a cada movimentação).
- Produtos novos começam com saldo zero: o saldo entra por movimentação, para ter histórico.
- Exclusão de produto, técnico e usuário é **lógica** (`ativo = false`), mantendo o histórico.

---

## 8. Rotas da API

Base: `http://localhost:3333/api`. Todas as respostas são JSON (exceto o CSV). Erros vêm como `{ "erro": "mensagem", "detalhes": [...] }`.
Exceto login e saúde, todas exigem o cabeçalho `Authorization: Bearer <token>`.

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| GET | `/saude` | Verifica se a API está no ar (sem login) |
| POST | `/auth/login` | `{ email, senha }` → `{ token, usuario }`. Máx. 10 erros a cada 15 min (429) |
| GET | `/auth/me` | Dados do usuário logado (inclui `precisaTrocarSenha`) |
| POST | `/auth/trocar-senha` | `{ senhaAtual, novaSenha }` — mínimo 8 caracteres, com letra e número |

### Cadastros

Leitura: todos os perfis · criar/editar: admin e almoxarife · excluir: admin.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/categorias` | Lista (com total de produtos ativos) |
| GET | `/categorias/:id` | Detalhe |
| POST | `/categorias` | `{ nome }` |
| PUT | `/categorias/:id` | `{ nome }` |
| DELETE | `/categorias/:id` | Exclui (só se não houver produtos) |
| GET | `/produtos` | Filtros: `busca`, `categoriaId`, `tipoControle`, `abaixoMinimo=true`, `incluirInativos=true` |
| GET | `/produtos/:id` | Detalhe (+ resumo por status para serializados) |
| POST | `/produtos` | `{ categoriaId, codigo, nome, marca, modelo, tipoControle, unidade, local, estoqueMinimo, custoUnitario }` |
| PUT | `/produtos/:id` | Mesmos campos (+ `ativo`). O tipo de controle não muda se já houver movimentações |
| DELETE | `/produtos/:id` | Inativa (exclusão lógica) |
| GET | `/tecnicos` | Lista com resumo do que cada um tem em mãos. Filtros: `busca`, `incluirInativos=true` |
| GET | `/tecnicos/:id` | Detalhe |
| GET | `/tecnicos/:id/estoque` | Equipamentos e materiais em posse do técnico agora, com valores |
| POST | `/tecnicos` | `{ nome, telefone, equipe }` |
| PUT | `/tecnicos/:id` | Mesmos campos (+ `ativo`) |
| DELETE | `/tecnicos/:id` | Inativa (só se não tiver nada em mãos) |
| GET | `/fornecedores` | Lista. Filtro: `busca` |
| GET | `/fornecedores/:id` | Detalhe |
| POST | `/fornecedores` | `{ nome, cnpj, telefone, email }` |
| PUT | `/fornecedores/:id` | Mesmos campos |
| DELETE | `/fornecedores/:id` | Exclui (só se não houver movimentações) |

Exceto login, saúde, `/auth/me` e `/auth/trocar-senha`, as rotas também exigem que o usuário já tenha trocado a senha provisória.

### Usuários (somente admin)

| Método | Rota | Descrição |
|---|---|---|
| GET | `/usuarios` | Lista |
| GET | `/usuarios/:id` | Detalhe |
| POST | `/usuarios` | `{ nome, email, senha, perfil }` |
| PUT | `/usuarios/:id` | `{ nome, email, perfil, ativo, senha? }` (senha em branco mantém a atual) |
| DELETE | `/usuarios/:id` | Inativa (não é possível inativar a si mesmo) |

### Equipamentos

| Método | Rota | Descrição |
|---|---|---|
| GET | `/equipamentos` | Paginado (`pagina`, `limite`). Filtros: `busca` (série, MAC, cliente ou técnico), `status` (aceita vários separados por vírgula), `produtoId`, `tecnicoId`, `categoriaId` |
| GET | `/equipamentos/:id` | Detalhe com `historico` completo da unidade |
| GET | `/equipamentos/:id/historico` | Somente o histórico da unidade |
| PUT | `/equipamentos/:id` | Edita `mac`, `numeroSerie` e `observacao` (o status só muda por movimentação) — admin/almoxarife |

### Movimentações

| Método | Rota | Descrição |
|---|---|---|
| GET | `/movimentacoes` | Paginado. Filtros: `inicio` e `fim` (AAAA-MM-DD), `tipo`, `produtoId`, `tecnicoId`, `equipamentoId`, `cliente`, `os`, `usuarioId` |
| GET | `/movimentacoes/:id` | Detalhe |
| POST | `/movimentacoes` | Registra (admin/almoxarife; ajuste só admin) |

Campos do `POST /movimentacoes`:

| Campo | Uso |
|---|---|
| `tipo` | Obrigatório (ver tabela da seção 7) |
| `produtoId` | Material por quantidade e toda entrada de compra |
| `quantidade` | Material por quantidade |
| `novaQuantidade` | Ajuste de inventário de material (quantidade contada) |
| `seriais` | Serializados. Entrada: texto com uma linha por unidade (`SERIAL;MAC`). Demais tipos: números de série ou MACs (texto ou array) |
| `equipamentoIds` | Alternativa a `seriais`: array de IDs |
| `tecnicoId`, `fornecedorId` | Conforme o tipo |
| `clienteCodigo`, `clienteNome`, `numeroOS`, `notaFiscal` | Conforme o tipo |
| `destino` | Retirada, retorno da manutenção e ajuste de equipamento: novo status |
| `custoUnitario` | Entrada de compra: atualiza o custo do produto (opcional) |
| `observacao` | Motivo (obrigatório em baixa e ajuste) |

Exemplos:

```json
{ "tipo": "entrada_compra", "produtoId": 1, "fornecedorId": 1, "notaFiscal": "004600",
  "seriais": "HWTC1A2B3C20;E0:24:7F:10:00:20\nHWTC1A2B3C21;E0247F100021" }

{ "tipo": "saida_tecnico", "tecnicoId": 1, "produtoId": 6, "quantidade": 150 }

{ "tipo": "instalacao_cliente", "seriais": ["HWTC1A2B3C06"], "clienteCodigo": "10890",
  "clienteNome": "Ana Costa", "numeroOS": "OS-2450" }

{ "tipo": "baixa", "tecnicoId": 1, "produtoId": 6, "quantidade": 80,
  "numeroOS": "OS-2450", "observacao": "Consumo na instalação" }
```

### Painel e relatórios

| Método | Rota | Descrição |
|---|---|---|
| GET | `/dashboard` | Total de produtos, valor total do estoque, itens abaixo do mínimo (com lista), ONUs e roteadores disponíveis, disponíveis por categoria, equipamentos em comodato/manutenção/defeito/com técnico, material com técnicos (valor), movimentações do dia e as últimas 10 |
| GET | `/relatorios/dados` | Os mesmos relatórios em JSON (`relatorio=estoque|equipamentos|movimentacoes` + filtros) — usados para montar o PDF |
| GET | `/relatorios/exportar` | CSV separado por **ponto e vírgula** (com BOM, abre direto no Excel). `relatorio=estoque` (padrão) — estoque atual; `relatorio=equipamentos` — equipamentos por status (filtros `status`, `produtoId`); `relatorio=movimentacoes` — movimentações por período (mesmos filtros da listagem: `inicio`, `fim`, `tipo`, …) |

### Importação de planilhas (admin e almoxarife)

Envio em `multipart/form-data` com o arquivo no campo `arquivo`. `simular=true` (padrão) só confere; `simular=false` grava.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/importacao/modelo/produtos` | Modelo .xlsx de cadastro de produtos |
| GET | `/importacao/modelo/entrada` | Modelo .xlsx de entrada de compra |
| POST | `/importacao/produtos` | `arquivo`, `simular` → `{ criados, atualizados, categoriasCriadas, erros, gravado }` |
| POST | `/importacao/entrada` | `arquivo`, `fornecedorId`, `notaFiscal`, `observacao`, `simular` → `{ itens, erros, gravado }` |

---

## 9. Telas

1. **Login**
2. **Painel** — indicadores e lista de itens abaixo do mínimo
3. **Produtos** — busca, filtros, barra de nível do estoque e destaque em vermelho para itens abaixo do mínimo
4. **Equipamentos** — busca rápida por nº de série/MAC (funciona com leitor de código de barras), filtro por status e tela de detalhe com o histórico da unidade
5. **Nova movimentação** — o formulário muda conforme o tipo (técnico, cliente, OS, fornecedor, nota fiscal, lista de seriais)
6. **Histórico** de movimentações com filtros e exportação CSV
7. **Técnicos** — com o que cada um tem em mãos e o termo de responsabilidade em PDF
8. **Relatórios** — PDF e CSV
9. **Importar planilha** — cadastro de produtos e entrada de compra em lote
10. **Trocar senha** — obrigatória no primeiro acesso
11. **Fornecedores**, **Categorias** e **Usuários** (só admin)

Layout responsivo: no celular o menu vira gaveta e as tabelas viram cartões.

## 10. Estrutura de pastas

```
backend/
  .sequelizerc
  src/
    app.js, server.js
    config/        conexão (database.js), configurações e constantes
    models/        Usuario, Categoria, Produto, Equipamento, Tecnico, Fornecedor, Movimentacao
    migrations/    criação das tabelas
    seeders/       dados iniciais
    routes/        rotas e validações (express-validator)
    controllers/   regras de cada recurso
    middlewares/   autenticação JWT, perfis, validação, erros
    services/      movimentações (transações), importação de planilhas, filtros, CSV
    utils/
  scripts/         redefinir-senha.js
  tests/           testes automatizados (npm test)
frontend/
  src/
    pages/         telas
    components/    layout, modal, tabela de cadastro, badges, barra de nível…
    services/      cliente da API (Axios), geração de PDF e formatação (R$, datas)
    context/       autenticação e toasts
docker-compose.yml
```

## 11. Problemas comuns

- **`Não foi possível conectar ao MySQL`** — confira se o container está *healthy* (`docker compose ps`) e se os dados do `.env` batem com o `docker-compose.yml`. Na primeira subida o MySQL leva alguns segundos para ficar pronto.
- **Porta 3306 ocupada** — você já tem um MySQL local. Pare-o ou mude a porta no `docker-compose.yml` (ex.: `"3307:3306"`) e em `DB_PORT`.
- **Tela volta para o login** — o token expirou (10 h) ou o usuário foi inativado. Entre novamente.
- **Erro de CORS** — inclua a URL do front-end em `CORS_ORIGIN` no `.env` do back-end.
- **"Muitas tentativas de login"** — aguarde 15 minutos ou reinicie a API (o contador fica em memória).
- **Esqueci a senha do admin** — outro admin pode redefini-la na tela Usuários. Se não houver outro, na pasta `backend` rode `npm run redefinir-senha -- admin@provedor.com SenhaTemporaria1` (ela precisará ser trocada no próximo login).
- **Planilha não é aceita** — salve como "Pasta de Trabalho do Excel (*.xlsx)". Arquivos .xls (antigo) e .csv não são aceitos na importação.

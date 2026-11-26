# Guia de instalação no Windows

Passo a passo para colocar o **Controle de Estoque do Provedor** para rodar em um computador com Windows 10 ou 11.
Siga na ordem. Todos os comandos são digitados no **PowerShell**.

> Tempo estimado: 30 a 40 minutos (a maior parte é download).

---

## PASSO 1 — Instalar o Node.js 20 (ou mais novo)

1. Acesse **https://nodejs.org** e baixe a versão **LTS** (botão verde, "Windows Installer .msi").
2. Instale clicando em **Next** em todas as telas. Na tela *Custom Setup*, deixe **Add to PATH** marcado.
3. **Reinicie o computador.**
4. Abra o PowerShell (menu Iniciar → digite `PowerShell`) e confira:

```powershell
node -v
npm -v
```

Deve aparecer algo como `v20.x.x` (ou maior) e `10.x.x`.

> ⚠️ Se aparecer *"o termo 'node' não é reconhecido"*, o Node não entrou no PATH: reinstale marcando **Add to PATH** e reinicie.

---

## PASSO 2 — Instalar o banco de dados MySQL 8

Escolha **uma** das opções.

### Opção A — Docker Desktop (recomendada para desenvolvimento)

1. Baixe e instale o **Docker Desktop**: https://www.docker.com/products/docker-desktop/
2. Reinicie o computador e abra o Docker Desktop. Espere aparecer **"Engine running"** (canto inferior esquerdo).
3. O banco será criado no PASSO 5.

### Opção B — MySQL Installer (sem Docker)

1. Baixe o **MySQL Installer for Windows**: https://dev.mysql.com/downloads/installer/
2. Escolha **Server only**, versão **8.x**.
3. Em *Authentication Method*, mantenha **Use Strong Password Encryption**.
4. Defina uma senha para o usuário **root** e **anote**.
5. Conclua a instalação (deixe o serviço iniciar com o Windows).
6. Abra o **MySQL 8.0 Command Line Client** (menu Iniciar), digite a senha do root e cole:

```sql
CREATE DATABASE estoque_provedor CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'estoque'@'localhost' IDENTIFIED BY 'estoque123';
GRANT ALL PRIVILEGES ON estoque_provedor.* TO 'estoque'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

---

## PASSO 3 — Copiar o projeto para o computador

**Com Git** (https://git-scm.com/download/win):

```powershell
cd $HOME\Desktop
git clone https://github.com/Pedro3557/tcc-stock-control.git
```

**Sem Git:** no GitHub, clique em **Code → Download ZIP**, extraia na Área de Trabalho e renomeie a pasta para `tcc-stock-control`.

> 💡 Evite pastas dentro do OneDrive: a sincronização pode travar a instalação das dependências.

---

## PASSO 4 — Abrir o PowerShell na pasta do projeto

```powershell
cd $HOME\Desktop\tcc-stock-control
```

> Se o seu Windows estiver em outra pasta (ex.: `C:\Users\Joao\Desktop`), ajuste o caminho.
> Dica: abra a pasta no Explorador de Arquivos, clique na barra de endereço, digite `powershell` e aperte Enter.

---

## PASSO 5 — Subir o MySQL (só para a Opção A — Docker)

Com o Docker Desktop aberto:

```powershell
docker compose up -d
```

Confira se está pronto (coluna *STATUS* deve mostrar **healthy** — pode levar 30 segundos):

```powershell
docker compose ps
```

---

## PASSO 6 — Instalar as dependências

### Back-end

```powershell
cd backend
npm install
```

### Front-end

```powershell
cd ..\frontend
npm install
```

> ⚠️ Se aparecer *"a execução de scripts foi desabilitada neste sistema"*, rode uma vez:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
>
> Responda **S** e repita o comando que falhou.

---

## PASSO 7 — Criar os arquivos de configuração (.env)

```powershell
cd ..\backend
copy .env.example .env
cd ..\frontend
copy .env.example .env
```

Abra o arquivo `backend\.env` no Bloco de Notas:

```powershell
notepad ..\backend\.env
```

- **Docker (Opção A):** não precisa mudar nada nos dados do banco.
- **MySQL Installer (Opção B):** confira `DB_USER=estoque` e `DB_PASSWORD=estoque123` (os do PASSO 2).
- **Em ambos:** troque `JWT_SECRET` por uma frase longa e aleatória (ex.: `minha-frase-secreta-do-estoque-2026-xyz`).

Salve e feche. No `frontend\.env`, ajuste `VITE_EMPRESA_NOME` com o nome do provedor (aparece nos PDFs).

---

## PASSO 8 — Criar as tabelas e os dados iniciais

```powershell
cd ..\backend
npm run migrate
npm run seed
```

Deve aparecer várias linhas terminando em `migrated`. Isso cria as tabelas, o usuário administrador e alguns produtos de exemplo.

> ⚠️ Rode o `npm run seed` **apenas uma vez**. Rodar de novo dá erro de registro duplicado.

---

## PASSO 9 — Rodar o sistema

São necessárias **duas janelas** do PowerShell abertas ao mesmo tempo.

**Janela 1 — API (back-end):**

```powershell
cd $HOME\Desktop\tcc-stock-control\backend
npm run dev
```

Espere aparecer: `API de estoque rodando em http://localhost:3333/api`

**Janela 2 — Tela (front-end):**

```powershell
cd $HOME\Desktop\tcc-stock-control\frontend
npm run dev
```

Espere aparecer: `Local: http://localhost:5173/`

---

## PASSO 10 — Acessar

Abra o navegador em **http://localhost:5173**

| Campo | Valor |
|---|---|
| E-mail | `admin@provedor.com` |
| Senha | `admin123` |

No primeiro acesso o sistema pede para **criar uma senha nova** (mínimo de 8 caracteres, com letras e números). Guarde-a.

Outros usuários de teste: `almoxarife@provedor.com` / `almox123` e `consulta@provedor.com` / `consulta123` (também pedem troca de senha).

---

## Usar todo dia (depois de instalado)

1. Abra o **Docker Desktop** (só na Opção A) e espere "Engine running".
2. Janela 1: `cd $HOME\Desktop\tcc-stock-control\backend` → `npm run dev`
3. Janela 2: `cd $HOME\Desktop\tcc-stock-control\frontend` → `npm run dev`
4. Acesse http://localhost:5173

Para parar: aperte **Ctrl + C** em cada janela.

---

## Usar no celular (mesma rede Wi-Fi)

1. Descubra o IP do computador:

```powershell
ipconfig
```

Anote o **Endereço IPv4** do adaptador Wi-Fi (ex.: `192.168.0.10`).

2. Em `frontend\.env`: `VITE_API_URL=http://192.168.0.10:3333/api`
3. Em `backend\.env`: `CORS_ORIGIN=http://localhost:5173,http://192.168.0.10:5173`
4. Pare e inicie de novo as duas janelas (PASSO 9).
5. No celular, acesse `http://192.168.0.10:5173`.

> Se não abrir, o Firewall do Windows pode estar bloqueando: quando aparecer o aviso do Node.js, clique em **Permitir acesso** para *Redes privadas*.

---

## Problemas comuns

| Mensagem | Solução |
|---|---|
| `Não foi possível conectar ao MySQL` | Docker: abra o Docker Desktop e rode `docker compose up -d`. MySQL Installer: confira se o serviço **MySQL80** está em execução (`services.msc`) e os dados do `backend\.env`. |
| `port is already allocated` (porta 3306) | Já existe um MySQL instalado. Use a Opção B, ou pare o outro MySQL em `services.msc`. |
| `EADDRINUSE: 3333` ou `5173` | O sistema já está aberto em outra janela. Feche-a ou aperte Ctrl + C nela. |
| `Validation error` / registro duplicado no seed | O seed já foi rodado antes — pode ignorar. |
| Tela fica voltando para o login | Sessão expirou (10 h). Entre de novo. |
| "Muitas tentativas de login" | Aguarde 15 minutos ou pare e inicie de novo a Janela 1. |
| Esqueci a senha do admin | Na pasta `backend`: `npm run redefinir-senha -- admin@provedor.com SenhaTemporaria1`. Entre com ela e crie uma nova. |
| Planilha não é aceita na importação | No Excel: **Arquivo → Salvar como → Pasta de Trabalho do Excel (*.xlsx)**. |

---

## Conferir se está tudo certo (opcional)

```powershell
cd $HOME\Desktop\tcc-stock-control\backend
npm test
```

Deve terminar com `# fail 0`.

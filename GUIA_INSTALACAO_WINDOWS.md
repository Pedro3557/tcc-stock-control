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

1. Baixe o **MySQL Installer for Windows**: https://dev.mysql.com/downloads/installer/ (o arquivo maior; na tela seguinte clique em *"No thanks, just start my download"*).
2. Escolha **Server only**, versão **8.x**.
3. Em *Authentication Method*, mantenha **Use Strong Password Encryption**.
4. Defina uma senha para o usuário **root** e **anote** — ela será pedida no PASSO 6.
5. Conclua a instalação (deixe o serviço iniciar com o Windows).

Não precisa criar banco nem usuário: o PASSO 6 faz isso automaticamente.

> Já tem **XAMPP**? Pode usar o MySQL dele: abra o painel do XAMPP e clique em **Start** no MySQL. No PASSO 6, deixe a senha do root em branco.

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

Abra o PowerShell **normal** — **não** use "Executar como administrador" (como administrador ele começa em `C:\WINDOWS\system32`, que não é lugar para o projeto).

```powershell
cd $HOME\Desktop\tcc-stock-control
```

> Se o seu Windows estiver em outra pasta (ex.: `C:\Users\Joao\Desktop`), ajuste o caminho.
> Dica: abra a pasta no Explorador de Arquivos, clique na barra de endereço, digite `powershell` e aperte Enter.

Confira: a linha do PowerShell deve terminar em `\tcc-stock-control>`.

> ⚠️ Se em algum comando `npm` aparecer *"a execução de scripts foi desabilitada neste sistema"*, rode uma vez:
>
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
>
> Responda **S** e repita o comando que falhou.

---

## PASSO 5 — Instalar as dependências

Ainda na pasta principal do projeto (com o Docker, rode antes o `docker compose up -d`):

```powershell
docker compose up -d
```

*(Pule a linha acima se você usou o MySQL Installer ou o XAMPP.)*

```powershell
npm install
```

Esse comando instala o back-end e o front-end de uma vez. Pode levar alguns minutos.

---

## PASSO 6 — Configurar tudo automaticamente

```powershell
npm run configurar
```

Esse comando:

1. cria os arquivos de configuração (`backend\.env` e `frontend\.env`);
2. confere a conexão com o MySQL e, se precisar, **pede a senha do root do MySQL** e cria sozinho o banco `estoque_provedor` e o usuário `estoque`;
3. cria as tabelas e os dados iniciais.

Ao digitar a senha aparecem `*` — é normal. Com Docker, normalmente ele nem pergunta.

Deve terminar com **"✔ Tudo pronto!"**. Pode rodar de novo quando quiser: o que já estiver pronto é mantido.

> Opcional: no arquivo `frontend\.env`, ajuste `VITE_EMPRESA_NOME` com o nome do provedor (aparece nos PDFs).

---

## PASSO 7 — Rodar o sistema

```powershell
npm run dev
```

Isso liga a API e a tela juntas, na mesma janela. Espere aparecer:

- `[API] API de estoque rodando em http://localhost:3333/api`
- `[TELA] Local: http://localhost:5173/`

Para parar: aperte **Ctrl + C**.

---

## PASSO 8 — Acessar

Abra o navegador em **http://localhost:5173**

| Campo | Valor |
|---|---|
| E-mail | `admin@provedor.com` |
| Senha | `admin123` |

No primeiro acesso o sistema pede para **criar uma senha nova** (mínimo de 8 caracteres, com letras e números). Guarde-a.

Outros usuários de teste: `almoxarife@provedor.com` / `almox123` e `consulta@provedor.com` / `consulta123` (também pedem troca de senha).

---

## Usar todo dia (depois de instalado)

1. Ligue o MySQL: abra o **Docker Desktop** (Opção A) ou o **XAMPP**. Com o MySQL Installer ele já liga sozinho.
2. No PowerShell:

```powershell
cd $HOME\Desktop\tcc-stock-control
npm run dev
```

3. Acesse http://localhost:5173

Para parar: **Ctrl + C**.

---

## Usar no celular (mesma rede Wi-Fi)

1. Descubra o IP do computador:

```powershell
ipconfig
```

Anote o **Endereço IPv4** do adaptador Wi-Fi (ex.: `192.168.0.10`).

2. Em `frontend\.env`: `VITE_API_URL=http://192.168.0.10:3333/api`
3. Em `backend\.env`: `CORS_ORIGIN=http://localhost:5173,http://192.168.0.10:5173`
4. Pare (Ctrl + C) e rode `npm run dev` de novo.
5. No celular, acesse `http://192.168.0.10:5173`.

> Se não abrir, o Firewall do Windows pode estar bloqueando: quando aparecer o aviso do Node.js, clique em **Permitir acesso** para *Redes privadas*.

---

## Problemas comuns

| Mensagem | Solução |
|---|---|
| `'docker' não é reconhecido` | O Docker Desktop não está instalado (ou o PowerShell foi aberto antes de instalar). Instale e reinicie, ou use a Opção B (MySQL Installer). |
| `a execução de scripts foi desabilitada` | Rode `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, responda **S** e repita o comando. |
| `ENOENT ... package.json` ou caminho com `system32` | O PowerShell está na pasta errada. Abra um PowerShell **normal** (sem administrador) e faça `cd $HOME\Desktop\tcc-stock-control`. |
| `Access denied for user 'estoque'` | Rode `npm run configurar` na pasta principal: ele cria o usuário com a senha do root. |
| `Não foi possível chegar ao MySQL` | O MySQL está desligado. Docker: abra o Docker Desktop e rode `docker compose up -d`. MySQL Installer: inicie o serviço **MySQL80** em `services.msc`. XAMPP: **Start** no MySQL. |
| `port is already allocated` (porta 3306) | Já existe outro MySQL no computador. Use esse MySQL (Opção B) ou pare-o em `services.msc`. |
| `EADDRINUSE: 3333` ou `5173` | O sistema já está aberto em outra janela. Feche-a ou aperte Ctrl + C nela. |
| Tela fica voltando para o login | Sessão expirou (10 h). Entre de novo. |
| "Muitas tentativas de login" | Aguarde 15 minutos ou pare (Ctrl + C) e rode `npm run dev` de novo. |
| Esqueci a senha do admin | Na pasta `backend`: `npm run redefinir-senha -- admin@provedor.com SenhaTemporaria1`. Entre com ela e crie uma nova. |
| Esqueci a senha do root do MySQL | A forma mais simples é desinstalar e instalar o MySQL de novo, ou usar o Docker. |
| Planilha não é aceita na importação | No Excel: **Arquivo → Salvar como → Pasta de Trabalho do Excel (*.xlsx)**. |

---

## Conferir se está tudo certo (opcional)

```powershell
cd $HOME\Desktop\tcc-stock-control
npm test
```

Deve terminar com `# fail 0`.

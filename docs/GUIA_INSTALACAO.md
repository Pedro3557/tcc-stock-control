# Guia de instalação

Como instalar o **Controle de Estoque** em um computador (desenvolvimento/teste) e em um servidor da rede interna (produção).
Os comandos funcionam no **Windows (PowerShell)** e no **Linux**; quando houver diferença, os dois aparecem.

> Resumo para quem já tem Node.js e MySQL: `npm install` → `npm run configurar` → `npm run dev`.

## Sumário

1. [Requisitos e portas](#1-requisitos-e-portas)
2. [Instalar o Node.js](#2-instalar-o-nodejs)
3. [Instalar o MySQL 8](#3-instalar-o-mysql-8)
4. [Baixar o projeto](#4-baixar-o-projeto)
5. [Instalar e configurar](#5-instalar-e-configurar)
6. [Rodar em desenvolvimento](#6-rodar-em-desenvolvimento)
7. [Produção na rede interna](#7-produção-na-rede-interna)
8. [HTTPS (câmera do celular)](#8-https-câmera-do-celular)
9. [Atualizar para uma nova versão](#9-atualizar-para-uma-nova-versão)
10. [Problemas comuns](#10-problemas-comuns)

---

## 1. Requisitos e portas

| Item | Requisito |
|---|---|
| Sistema | Windows 10/11, Windows Server 2016+ ou Linux (Ubuntu 22.04+, Debian 12+) |
| Node.js | **20 ou superior** |
| MySQL | **8.0** (MySQL Installer, XAMPP/MariaDB 10.6+ ou Docker) |
| Memória | 2 GB livres (a API usa ~100 MB) |
| Disco | 1 GB + espaço para os backups |
| Navegador | Chrome, Edge, Firefox ou Safari atualizados |

| Porta | Uso | Abrir no firewall? |
|---|---|---|
| **3333** | API — em produção também a tela do sistema | **Sim**, para a rede interna |
| 5173 | Tela em desenvolvimento (`npm run dev`) | Só se for testar pelo celular |
| 3306 | MySQL | **Não** (só a própria máquina) |

---

## 2. Instalar o Node.js

**Windows:** baixe a versão **LTS** em https://nodejs.org, instale com **Next** em todas as telas (mantenha *Add to PATH*) e **reinicie o computador**.

**Linux (Ubuntu/Debian):**

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Confira:

```bash
node -v
npm -v
```

> **Windows — "a execução de scripts foi desabilitada neste sistema":** rode uma vez
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, responda **S** e repita o comando.

---

## 3. Instalar o MySQL 8

Escolha **uma** opção.

### Opção A — MySQL Installer (Windows, recomendado para produção)

1. Baixe o **MySQL Installer for Windows** em https://dev.mysql.com/downloads/installer/.
2. Escolha **Server only**, versão **8.x**.
3. Defina uma senha para o usuário **root** e **anote** (o passo 5 vai pedir).
4. Conclua deixando o serviço **MySQL80** iniciar com o Windows.

Não é preciso criar banco nem usuário: o `npm run configurar` faz isso.

### Opção B — Linux

```bash
sudo apt-get install -y mysql-server
sudo systemctl enable --now mysql
```

No Ubuntu o root do MySQL entra sem senha pelo `sudo mysql`. Para o `npm run configurar` conseguir criar o banco, crie um administrador com senha (troque a senha):

```bash
sudo mysql -e "CREATE USER 'admin_mysql'@'localhost' IDENTIFIED BY 'Troque-Esta-Senha-1'; GRANT ALL ON *.* TO 'admin_mysql'@'localhost' WITH GRANT OPTION;"
```

Depois, no passo 5, rode `MYSQL_ROOT_USER=admin_mysql npm run configurar`.

### Opção C — Docker (desenvolvimento)

1. Instale o **Docker Desktop** (Windows/Mac) ou Docker Engine (Linux).
   No Windows, se aparecer erro de *Virtual Machine Platform*/WSL, rode `wsl --install` no PowerShell **como administrador**, reinicie e instale de novo.
2. Na pasta do projeto: `docker compose up -d`. O banco, o usuário `estoque` e o banco de testes são criados automaticamente.

> Se já houver outro MySQL usando a porta 3306, pare-o (`Stop-Service MySQL80` como administrador) ou troque a porta no `docker-compose.yml` e em `DB_PORT`.

### Opção D — XAMPP

Abra o painel do XAMPP e clique em **Start** no MySQL. O root vem **sem senha** (aperte Enter quando o `configurar` perguntar).

---

## 4. Baixar o projeto

Use um terminal **normal** (no Windows, **não** use "Executar como administrador", que abre em `C:\Windows\system32`).

```bash
cd ~/Desktop
git clone https://github.com/Pedro3557/tcc-stock-control.git
cd tcc-stock-control
```

No Windows, `~/Desktop` equivale a `$HOME\Desktop`. Sem Git: baixe o ZIP pelo GitHub (**Code → Download ZIP**) e extraia. Evite pastas sincronizadas pelo OneDrive.

---

## 5. Instalar e configurar

Na **pasta principal** do projeto:

```bash
npm install
```

Instala o back-end e o front-end (alguns minutos). Depois:

```bash
npm run configurar
```

O `configurar`:

1. cria `backend/.env` (com um `JWT_SECRET` aleatório) e `frontend/.env`;
2. testa o MySQL; se o usuário `estoque` não existir, **pede a senha do root do MySQL** (aparecem `*` ao digitar) e cria o banco `estoque_provedor`, o usuário `estoque` e a permissão no banco de testes;
3. roda as **migrations** e o **seed essencial**: o administrador `admin@provedor.com` / `admin123` (troca obrigatória no 1º acesso) e as categorias padrão.

Pode ser repetido sem problema. Opções:

- `npm run configurar -- --demo` → carrega também **dados de demonstração** (produtos, técnicos, equipamentos e movimentações de exemplo) — **apenas em banco vazio**, para treinamento.
- Banco com outros dados de acesso: edite `backend/.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`) antes de rodar.

Todas as variáveis estão comentadas em [backend/.env.example](../backend/.env.example).

---

## 6. Rodar em desenvolvimento

```bash
npm run dev
```

Liga a API (porta 3333) e a tela (porta 5173) no mesmo terminal. Abra **http://localhost:5173**. Para parar: **Ctrl + C**.

- **Pelo celular na mesma rede:** abra `http://IP-DO-COMPUTADOR:5173` (descubra o IP com `ipconfig` no Windows ou `hostname -I` no Linux). O Vite repassa as chamadas para a API; nada mais precisa ser configurado.
- **Testes:** `npm test` (usa o banco separado `estoque_provedor_teste`; veja [TESTES.md](TESTES.md)).

---

## 7. Produção na rede interna

Em produção a API entrega também a tela compilada: **uma porta só (3333)**.

### 7.1 Preparar

```bash
npm install
npm run configurar
npm run producao:preparar
```

O último comando gera o build do front-end (`frontend/dist`) e aplica as migrations.

Confira em `backend/.env`:

- `JWT_SECRET` aleatório (o `configurar` já gera; em produção a API **não inicia** com o valor de exemplo);
- `HOST=0.0.0.0` para aceitar conexões da rede;
- `BACKUP_DIR` apontando para um disco com espaço (de preferência diferente do disco do sistema).

### 7.2 Testar

```bash
npm run producao
```

Abra `http://IP-DO-SERVIDOR:3333` em outra máquina da rede. Se não abrir, libere a porta no firewall:

- **Windows** (PowerShell como administrador):

  ```powershell
  New-NetFirewallRule -DisplayName "Estoque 3333" -Direction Inbound -Protocol TCP -LocalPort 3333 -Action Allow -Profile Private,Domain
  ```

- **Linux (ufw):** `sudo ufw allow from 192.168.0.0/16 to any port 3333 proto tcp`

### 7.3 Execução contínua com PM2

O PM2 mantém o sistema rodando e o **reinicia automaticamente** em caso de falha.

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Comandos úteis: `pm2 status`, `pm2 logs estoque`, `pm2 restart estoque`, `pm2 stop estoque`. Os logs ficam em `logs/`.

**Iniciar junto com o servidor:**

- **Linux:** `pm2 startup` e execute o comando que ele mostrar; depois `pm2 save`.
- **Windows:** `npm install -g pm2-windows-startup` e depois `pm2-startup install` (ou crie uma tarefa no Agendador de Tarefas, "Ao iniciar o computador", executando `pm2 resurrect`).

> Use **uma instância** (já configurado): o agendador de backups e de alertas roda dentro da API.

### 7.4 Depois de instalar

1. Entre como **admin**, troque a senha e cadastre os usuários reais (**Usuários**).
2. Em **Configurações**, preencha o **nome da organização** (sai nos relatórios e etiquetas), o **endereço do sistema na rede** (ex.: `http://192.168.0.10:3333`, usado nos QR Codes) e a **agenda de backup**.
3. Faça um **backup manual** e baixe uma cópia para fora do servidor.

---

## 8. HTTPS (câmera do celular)

Os navegadores só liberam a **câmera** em HTTPS (ou em `localhost`). Sem HTTPS, o sistema funciona normalmente e a leitura de etiquetas continua disponível **por foto** e por **leitor USB/Bluetooth**.

Para habilitar HTTPS na rede interna:

1. Gere um certificado. A forma mais simples é o [mkcert](https://github.com/FiloSottile/mkcert):

   ```bash
   mkcert -install
   mkcert -cert-file estoque.pem -key-file estoque-chave.pem 192.168.0.10 estoque.local localhost
   ```

   (Alternativa: `openssl req -x509 -newkey rsa:2048 -nodes -keyout estoque-chave.pem -out estoque.pem -days 825 -subj "/CN=estoque" -addext "subjectAltName=IP:192.168.0.10"`.)

2. Em `backend/.env`:

   ```
   HTTPS_CERT=C:\certificados\estoque.pem
   HTTPS_KEY=C:\certificados\estoque-chave.pem
   ```

3. Reinicie (`pm2 restart estoque`) e acesse `https://192.168.0.10:3333`.
4. Nos celulares, instale o certificado raiz do mkcert (arquivo `rootCA.pem`, mostrado por `mkcert -CAROOT`) ou aceite o aviso do navegador.
5. Atualize **Configurações → Endereço do sistema** para `https://…` e reimprima as etiquetas que forem usadas pelo celular.

Os arquivos de certificado nunca devem ser versionados (o `.gitignore` já ignora `*.pem`).

---

## 9. Atualizar para uma nova versão

```bash
pm2 stop estoque
npm --prefix backend run backup -- criar
git pull
npm install
npm run producao:preparar
pm2 restart estoque
```

As migrations só **adicionam** estruturas; os dados existentes são mantidos (ver [TESTES.md](TESTES.md#compatibilidade-das-migrations)).

---

## 10. Problemas comuns

| Mensagem | Solução |
|---|---|
| `'docker' não é reconhecido` | Docker não instalado ou terminal aberto antes da instalação. Use outra opção do passo 3 ou instale e reinicie. |
| `a execução de scripts foi desabilitada` | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, responda **S**. |
| `ENOENT … package.json` ou caminho com `system32` | Terminal na pasta errada. Abra um terminal normal e entre na pasta `tcc-stock-control`. |
| `Access denied for user 'estoque'` | Rode `npm run configurar` na pasta principal (cria o usuário com a senha do root). |
| `Não foi possível chegar ao MySQL` | MySQL desligado: Docker → `docker compose up -d`; Windows → serviço **MySQL80** em `services.msc`; XAMPP → **Start**. |
| Esqueci a senha do root do MySQL | Reinstale o MySQL Server (MySQL Installer) definindo uma nova senha, ou use o Docker. |
| `port is already allocated` (3306) | Outro MySQL usando a porta: pare-o ou troque a porta. |
| `EADDRINUSE: 3333` | O sistema já está rodando (outra janela ou PM2). |
| API não inicia em produção: `Defina JWT_SECRET…` | Gere um segredo: `npm run configurar` (em `.env` novo) ou coloque 32+ caracteres aleatórios em `JWT_SECRET`. |
| "Muitas tentativas de login" | Aguarde 15 minutos ou reinicie a API. |
| Esqueci a senha do admin | `npm --prefix backend run redefinir-senha -- admin@provedor.com Temp@Senha2026` (troca obrigatória no próximo login; a senha precisa ter maiúscula, minúscula, número e caractere especial). |
| Câmera não abre no celular | Precisa de HTTPS (passo 8). Use "Ler por foto" enquanto isso. |
| QR Code abre endereço errado | Ajuste **Configurações → Endereço do sistema na rede** e reimprima as etiquetas. |
| Planilha recusada | Salve como **Pasta de Trabalho do Excel (*.xlsx)**. |

# Histórico de mudanças

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [2.0.1] — 2026-11-27

### Alterado
- Senha forte obrigatória: 8+ caracteres com letra maiúscula, minúscula, número e caractere especial (na troca de senha, no cadastro de usuários e no script de redefinição). A tela mostra a lista de requisitos, em vermelho o que falta.

### Corrigido
- Laço infinito no `npm install` com npm 10.9 (postinstall da raiz).
- No Windows o login não funcionava em desenvolvimento: o proxy do Vite usava `localhost` (IPv6 `::1`), onde a API não escuta.
- Mensagem clara quando a API não está rodando.
- `npm run configurar` passou a liberar o banco de testes também em instalações antigas.

## [2.0.0] — 2026-11-27

Revisão, aprimoramento e finalização do sistema.

### Adicionado

- **QR Code:** código permanente por equipamento, QR na página da unidade, etiquetas individuais e em lote em PDF (A4 3×7, A4 2×5, térmica 50×30), leitura por câmera, foto e leitor USB, consulta automática e endereço `/e/CÓDIGO`.
- **Inventário físico:** sessões por categoria/produto, contagem às cegas de materiais, conferência de equipamentos por leitura, divergências (quantidade, não encontrado, localização incorreta), justificativa obrigatória, aprovação por admin aplicando ajustes numa única transação, histórico e exportação PDF/CSV.
- **Auditoria:** registro imutável de operações (antes/depois, resultado, IP, sem segredos) e tela de consulta com filtros.
- **Backups:** backup lógico `.sql.gz` com SHA-256, automático (diário/semanal/a cada N horas), manual, retenção, verificação, download, restauração com senha e confirmação, backup de segurança, reversão automática e linha de comando (`npm run backup`).
- **Notificações:** central com lidas/não lidas e alertas de abaixo do mínimo, sem estoque, divergência de inventário e falha de backup, sem duplicar; destinatários por usuário e e-mail opcional via SMTP.
- **Configurações:** dados da organização (relatórios e etiquetas), endereço do sistema na rede, agenda de backup e e-mail.
- **Relatórios novos:** abaixo do mínimo, em posse dos técnicos, comodato e manutenção. Todos com organização, data de emissão, emissor e filtros, em PDF e CSV.
- **Painel:** filtro de período (até 12 meses), produtos cadastrados e materiais disponíveis.
- **Produtos:** campo descrição, histórico por produto e paginação.
- **Técnicos:** pendências de devolução (com dias) e histórico por técnico. **Fornecedores:** histórico de entradas.
- **Produção:** a API entrega o front-end numa porta só, `npm run producao`, PM2 (`ecosystem.config.cjs`), HTTPS opcional e cabeçalhos de segurança (helmet/CSP).
- **Qualidade:** ESLint e 49 testes (unitários + integrados em banco separado).
- **Documentação:** manual do usuário, guia de instalação, arquitetura, testes, backup e changelog.

### Alterado

- O seed passou a criar só o **essencial** (admin + categorias). Produtos, técnicos, movimentações e usuários de exemplo foram para `npm run seed:demo` (opcional, só em banco vazio).
- Senhas definidas pelo admin passam a exigir 8+ caracteres com letras e números e são provisórias.
- Trocar ou redefinir a senha **encerra as sessões antigas**.
- O envio para manutenção exige a **descrição do problema**.
- O front-end chama a API em `/api` (mesma origem), com proxy do Vite em desenvolvimento, e funciona pelo IP da rede.
- O nome da organização vem das **Configurações** (antes, de `VITE_EMPRESA_NOME`).
- Menu lateral organizado por seções.
- Movimentações e importações aceitam QR Code/código da etiqueta como identificador.

### Removido

- `VITE_EMPRESA_NOME` (substituída pela configuração da organização, que não exige recompilar).
- Script `migrate:undo` (desfazia **todas** as migrations, apagando os dados). Substituído por `migrate:desfazer`, que desfaz só a última.
- `GUIA_INSTALACAO_WINDOWS.md` na raiz (conteúdo incorporado e ampliado em `docs/GUIA_INSTALACAO.md`).

### Corrigido

- Sem `JWT_SECRET`, a API iniciava com um segredo fixo mesmo em produção; agora exige um segredo forte.
- Token emitido no mesmo segundo da troca de senha continuava válido.
- O front-end apontava fixo para `localhost:3333`, o que impedia o acesso por outras máquinas da rede.
- Em produção, arquivos estáticos inexistentes devolviam a página HTML (agora 404).
- Restauração de backup podia travar com arquivos pequenos.
- Pasta de backups inacessível travava a API.
- Uma migration não podia ser desfeita por causa de um índice usado em chave estrangeira.

### Banco de dados (migrations 09 a 14, somente adições)

- Novas tabelas: `configuracoes`, `auditorias`, `inventarios`, `inventario_itens`, `inventario_equipamentos`, `notificacoes`, `alertas_ativos`, `backups`.
- Novas colunas: `produtos.descricao`, `usuarios.senhaAlteradaEm`, `usuarios.recebeNotificacoes`, `usuarios.recebeEmail`, `equipamentos.codigoEtiqueta` (único; preenchido para as unidades existentes).
- Novo índice: `movimentacoes (tecnicoId, produtoId)`.

## [1.2.0] — 2026-11-26

- Instalação automática: `npm install`, `npm run configurar` e `npm run dev` na pasta principal.

## [1.1.0] — 2026-11-26

- Relatórios em PDF, termo do técnico, importação de planilhas, troca de senha obrigatória, limite de tentativas de login, gráficos no painel e guia para Windows.

## [1.0.0] — 2026-11-26

- Versão inicial: produtos, equipamentos serializados, movimentações com transação, técnicos, fornecedores, categorias, usuários com perfis, painel, histórico e exportação CSV.

# Manual do usuário

Guia de uso do **Controle de Estoque**, módulo por módulo. Serve de apoio ao treinamento do almoxarifado, dos supervisores e da administração.

## Sumário

1. [Conceitos](#1-conceitos)
2. [Acesso, senha e perfis](#2-acesso-senha-e-perfis)
3. [Navegação](#3-navegação)
4. [Painel](#4-painel)
5. [Produtos](#5-produtos)
6. [Equipamentos](#6-equipamentos)
7. [Nova movimentação](#7-nova-movimentação)
8. [Ler etiqueta (QR Code)](#8-ler-etiqueta-qr-code)
9. [Etiquetas QR Code](#9-etiquetas-qr-code)
10. [Histórico de movimentações](#10-histórico-de-movimentações)
11. [Técnicos](#11-técnicos)
12. [Inventário físico](#12-inventário-físico)
13. [Importar planilha](#13-importar-planilha)
14. [Relatórios](#14-relatórios)
15. [Notificações](#15-notificações)
16. [Fornecedores e categorias](#16-fornecedores-e-categorias)
17. [Administração](#17-administração-somente-admin) (usuários, auditoria, backups, configurações)
18. [Rotinas recomendadas](#18-rotinas-recomendadas)
19. [Dúvidas frequentes](#19-dúvidas-frequentes)

---

## 1. Conceitos

O provedor trabalha com **dois tipos de item**:

| Tipo | Controle | Exemplos |
|---|---|---|
| **Equipamento serializado** | Unidade por unidade, pelo **número de série** e **MAC** | ONU/ONT, roteador, mesh, switch, rádio, módulo SFP |
| **Material de consumo** | Por **quantidade** (un, m, cx, pct, rolo) | Cabo drop, cabo UTP, conectores, splitter, CTO, fita, abraçadeira |

Cada equipamento está sempre em **uma situação (status)**:

| Status | Significado |
|---|---|
| Em estoque | No almoxarifado, disponível |
| Com técnico | Entregue a um técnico, ainda não instalado |
| Comodato (cliente) | Instalado na casa do cliente |
| Em manutenção | Enviado para conserto/assistência |
| Defeito | No almoxarifado, com defeito |
| Baixado | Fora do estoque definitivamente (perda, sem conserto) |

**Regra de ouro:** o estoque **só muda por movimentação**. Nada é apagado: erros são corrigidos com uma nova movimentação (ajuste), e tudo fica no histórico com quem fez, quando e por quê.

---

## 2. Acesso, senha e perfis

1. Abra o endereço do sistema informado pela TI (ex.: `http://192.168.0.10:3333`).
2. Entre com e-mail e senha.
3. **No primeiro acesso** (ou quando o administrador redefinir sua senha), o sistema pede uma **senha nova**: mínimo de 8 caracteres, com letras e números.
4. Para trocar a senha depois: **Trocar senha**, no rodapé do menu.
5. Para sair: ícone de saída ao lado do seu nome.

- Depois de 10 senhas erradas, o login fica bloqueado por 15 minutos.
- A sessão expira depois de algumas horas (padrão: 10). Basta entrar de novo.
- Trocar a senha encerra as sessões abertas em outros aparelhos.

| Perfil | Pode |
|---|---|
| **Consulta** | Ver tudo (painel, estoque, histórico, relatórios), sem alterar nada |
| **Almoxarife** | Tudo da consulta + movimentar, cadastrar, importar, imprimir etiquetas e fazer inventário |
| **Administrador** | Tudo + excluir/inativar, aprovar ajustes de inventário, usuários, auditoria, backups e configurações |

Botões e menus que o seu perfil não pode usar não aparecem.

---

## 3. Navegação

- **Menu lateral** (no celular, ícone ☰), por seções: **Operação**, **Estoque**, **Cadastros**, **Acompanhamento** e **Administração**.
- **Sino** 🔔: notificações não lidas.
- **Movimentar** (botão no topo, no celular): atalho para nova movimentação.
- Mensagens de sucesso e de erro aparecem no canto da tela. As de erro explicam o motivo (ex.: "Saldo insuficiente… disponível 70 un").
- Listas longas têm busca, filtros e páginas.

---

## 4. Painel

Visão geral com informações reais do banco de dados:

- **Período:** escolha 7, 14, 30 ou 90 dias, 12 meses ou datas personalizadas. Afeta o gráfico e o indicador "Entradas × saídas no período".
- **Indicadores:** produtos cadastrados, valor total do estoque, itens abaixo do mínimo (em vermelho), ONUs e roteadores disponíveis, comodato, manutenção, defeito, valor com técnicos, entradas × saídas, equipamentos e materiais disponíveis. Clique num indicador para abrir a lista correspondente.
- **Gráficos:** entradas e saídas no período (passe o mouse para ver os números; "Ver em tabela" mostra os valores) e equipamentos por status.
- **Abaixo do estoque mínimo** e **Últimas movimentações**.

---

## 5. Produtos

Lista de tudo o que existe no estoque, com **nível** (barra: o traço marca o mínimo; vermelho = abaixo do mínimo).

- **Buscar:** por código, nome, descrição, marca ou modelo. **Filtros:** categoria, tipo de controle, "Abaixo do mínimo".
- **Novo produto:** código (SKU único), nome, descrição, categoria, marca, modelo, tipo de controle, unidade, local (prateleira), estoque mínimo e custo unitário.
  - O saldo começa em **zero**: lance as quantidades por **Entrada (compra)**.
  - O tipo de controle não pode ser mudado depois que houver movimentações.
- **Ações por linha:**
  - **Unidades:** os equipamentos daquele produto.
  - **Entrada:** atalho para registrar uma compra.
  - **Histórico:** todas as movimentações do produto.
  - **Editar.**
  - **Inativar** (admin): o produto sai das listas, mas o histórico fica.
- **CSV:** exporta o estoque atual para o Excel.

---

## 6. Equipamentos

Todas as unidades serializadas.

- **Busca rápida:** nº de série, MAC, código da etiqueta, código do cliente ou nome do técnico. Funciona com leitor de código de barras (bipe no campo).
- **Filtros:** status (botões) e produto.
- **Página do equipamento:**
  - status atual, MAC, onde está (técnico ou cliente) e observação;
  - **Movimentar esta unidade:** só as operações possíveis no status atual;
  - **Etiqueta com QR Code:** veja a seção 9;
  - **Histórico da unidade:** linha do tempo com cada mudança de status, técnico, cliente, OS e motivo;
  - **Editar dados:** corrigir MAC ou observação. O status só muda por movimentação.

---

## 7. Nova movimentação

Escolha o **tipo** no topo. O formulário mostra só os campos daquele tipo.

| Tipo | Quando usar | Campos obrigatórios |
|---|---|---|
| **Entrada (compra)** | Material ou equipamento recebido do fornecedor | Produto, fornecedor, nota fiscal, quantidade ou lista de seriais |
| **Saída para técnico** | Entregar material/equipamento a um técnico | Técnico, produto e quantidade ou seriais |
| **Devolução do técnico** | Técnico devolve o que não usou | Material: técnico, produto, quantidade · Equipamento: seriais |
| **Instalação no cliente** | Equipamento instalado em comodato | Seriais, código do cliente, nº da OS |
| **Retirada do cliente** | Cancelamento ou troca | Seriais e destino (estoque, manutenção ou defeito) |
| **Envio para manutenção** | Mandar para conserto | Seriais e **descrição do problema** |
| **Retorno da manutenção** | Voltou do conserto | Seriais e destino (estoque ou defeito) |
| **Baixa** | Perda, defeito sem conserto, consumo | Motivo; para material, escolha a origem: estoque central ou material com técnico (consumo em OS) |
| **Ajuste de inventário** (admin) | Corrigir o saldo depois de uma contagem | Quantidade contada (material) ou novo status (equipamento) e motivo |

**Equipamentos — como informar os seriais:**

- **Entrada:** cole a lista, uma unidade por linha: `SERIAL` ou `SERIAL;MAC` (aceita vírgula e TAB; pode colar do Excel).
- **Demais tipos:** bipe com o leitor USB no campo "Bipe ou digite", cole a lista ou use **Ler com a câmera**. Valem o nº de série, o MAC ou o QR Code da etiqueta.

**O sistema bloqueia, com mensagem explicando o motivo:**

- saída maior que o saldo (o estoque nunca fica negativo);
- devolução maior do que o técnico tem;
- número de série ou MAC já cadastrado;
- equipamento no status errado (ex.: instalar uma ONU com defeito);
- quantidade fracionada em itens contados por unidade.

Depois de registrar, aparece a confirmação. O técnico, o fornecedor e a nota continuam preenchidos para o próximo lançamento.

---

## 8. Ler etiqueta (QR Code)

Menu **Ler etiqueta**. O equipamento abre sozinho depois da leitura.

- **Ligar câmera:** aponte para o QR Code da etiqueta. Também lê códigos de barras do fabricante nos navegadores que suportam isso, como Chrome e Edge.
- **Ler por foto:** tire ou escolha uma foto da etiqueta. Funciona mesmo quando a câmera ao vivo não está liberada.
- **Leitor USB/Bluetooth:** clique no campo e bipe a etiqueta.
- Também dá para digitar o nº de série, o MAC ou o código impresso.

> No celular, a **câmera ao vivo** só funciona se o sistema estiver em **HTTPS**. Sem HTTPS, use **Ler por foto**.

---

## 9. Etiquetas QR Code

Cada equipamento tem um **código permanente** (10 letras e números, ex.: `P3ZVJYWNE8`), que não muda mesmo se a unidade for editada. O QR Code guarda só o endereço de consulta, sem nenhum dado do equipamento ou do cliente: quem o lê precisa entrar no sistema para ver as informações.

- **Uma etiqueta:** página do equipamento → **Etiqueta 50×30** (impressora térmica) ou **Folha A4**.
- **Várias etiquetas:** menu **Etiquetas QR Code** → filtre (produto, status, busca), marque os equipamentos, escolha o formato:
  - folha A4 com 21 etiquetas (3 × 7, 63,5 × 38,1 mm);
  - folha A4 com 10 etiquetas (2 × 5, 99 × 57 mm);
  - térmica 50 × 30 mm.

  Clique em **Gerar PDF**. Para aproveitar uma folha já usada, informe **Começar na etiqueta nº**.
- A etiqueta traz o nome do produto, a série, o MAC e o código.
- Imprima em **tamanho real** (100%, sem "ajustar à página").

---

## 10. Histórico de movimentações

Todas as movimentações, das mais recentes para as mais antigas.

- **Filtros:** período, tipo, produto, técnico, fornecedor, cliente e OS. Os links "Histórico" de produtos, técnicos, fornecedores e equipamentos abrem esta tela já filtrada.
- **CSV:** exporta exatamente o que está filtrado.

---

## 11. Técnicos

- **Cadastro:** nome, telefone e equipe. **Inativar** (admin) só é possível se o técnico não tiver nada em mãos.
- **Em mãos:** equipamentos (com há quantos dias) e materiais com valor, mais os atalhos **Entregar material**, **Registrar devolução**, **Histórico** e **Termo (PDF)**.
- **Termo de responsabilidade (PDF):** lista o que o técnico tem, com valor e linhas para assinatura. Use na conferência mensal ou no desligamento.
- **Equipamentos pendentes de devolução** (fim da tela Técnicos): tudo o que está com técnicos, do mais antigo para o mais recente. Em vermelho, há 7 dias ou mais.
- **Consumo em OS:** registre como **Baixa** com origem "Material em posse de técnico".

---

## 12. Inventário físico

Conferência do estoque real com o sistema. **O estoque só muda depois da aprovação do administrador.**

1. **Abrir:** **Inventário físico → Novo inventário**. Escolha as categorias e/ou os produtos. O sistema registra o saldo atual de cada item.
2. **Contar materiais:** digite a quantidade contada de cada item (vale zero) e aperte Enter ou saia do campo. Para quem não é administrador, a contagem é **às cegas**: o saldo do sistema só aparece depois de encerrar.
3. **Conferir equipamentos:** leia cada unidade no quadro "Conferir equipamentos" (câmera, foto, leitor USB ou digitação):
   - **Conferido:** estava esperado no almoxarifado;
   - **Já conferido:** leitura repetida;
   - **Localização incorreta:** foi encontrado, mas no sistema está com técnico, cliente, manutenção ou baixado;
   - **Fora do inventário:** o produto não faz parte desta conferência.

   **Desfazer leitura** corrige uma leitura errada.
4. **Encerrar contagem:** o sistema aponta as **divergências**: quantidade diferente, **não encontrado** e **localização incorreta**. Os administradores recebem uma notificação.
5. **Decidir cada divergência:** **Ajustar** (o estoque passa a refletir o que foi encontrado; para equipamentos, escolha o novo status, ex.: "Baixado" para não encontrado) ou **Manter**. A **justificativa é obrigatória**. Clique em **Salvar decisões**.
6. **Aprovar** (admin): **Aprovar e aplicar ajustes**. Os ajustes viram movimentações "Ajuste de inventário" com o número do inventário e a justificativa.
   - Se o saldo de um item mudou durante o inventário (alguém movimentou), a aprovação é bloqueada. Use **Voltar para a contagem** e reconte o item.
7. **Exportar** o resultado em **PDF** ou **CSV** a qualquer momento.

- Um produto não pode estar em dois inventários abertos ao mesmo tempo.
- **Cancelar inventário:** encerra sem aplicar nada.

---

## 13. Importar planilha

Para cadastrar muitos produtos ou dar entrada em uma compra grande.

1. **Baixar modelo (.xlsx).** A aba **Instruções** explica cada coluna. Apague as linhas de exemplo.
2. Escolha a aba:
   - **Cadastro de produtos:** `codigo`, `nome`, `categoria` (obrigatórios), `descricao`, `marca`, `modelo`, `tipo_controle`, `unidade`, `local`, `estoque_minimo`, `custo_unitario`. Um código que já existe **atualiza** o cadastro (o saldo não muda). Uma categoria nova é criada.
   - **Entrada de compra:** escolha o fornecedor e a nota fiscal na tela. Materiais: `codigo` + `quantidade`. Equipamentos: uma linha por unidade, com `codigo` + `numero_serie` (+ `mac`). `custo_unitario` é opcional.
3. **Ver prévia:** confere tudo **sem gravar** e lista os problemas com o **número da linha**: códigos repetidos, séries já cadastradas, valores inválidos…
4. **Confirmar importação:** grava tudo de uma vez. Se houver **qualquer** erro, **nada** é gravado.

Aceita números com vírgula (`0,45`, `1.234,56`) e cabeçalhos com variações ("Número de série", "Serial", "SN"…). O arquivo precisa ser `.xlsx`, com até 5 MB.

---

## 14. Relatórios

Menu **Relatórios**. Cada relatório tem filtros, **Gerar PDF** e **CSV (Excel)**. Todos trazem o **nome da organização**, a **data de emissão**, **quem emitiu** e os **filtros aplicados**.

| Relatório | Para quê |
|---|---|
| Estoque atual | Saldo, mínimo, custo e valor de cada produto (filtro por categoria) |
| Abaixo do estoque mínimo | Lista de compras: quanto falta e custo estimado para repor |
| Em posse dos técnicos | Equipamentos e materiais com cada técnico, valor e dias |
| Equipamentos em comodato | Equipamentos instalados em clientes, com data, OS e técnico |
| Equipamentos em manutenção | Em manutenção/defeito, com o problema e há quantos dias |
| Equipamentos por status | Todas as unidades com série, MAC, técnico ou cliente |
| Movimentações do período | Tudo o que entrou e saiu, com filtros de data e tipo |
| Termo de responsabilidade | O que um técnico tem, com linhas para assinatura |

O relatório do inventário físico fica na tela de cada inventário.

---

## 15. Notificações

O **sino** mostra quantas notificações não lidas você tem. O sistema avisa quando:

- um produto fica **abaixo do mínimo** ou **sem estoque**;
- um inventário termina com **divergências**;
- um **backup falha** (só administradores).

Um mesmo alerta **não se repete** enquanto a situação continuar; ele volta a ser enviado se o problema for resolvido e acontecer de novo.

Na tela **Notificações**:

- **Abrir:** vai direto ao item;
- **Marcar como lida** ou **Marcar todas como lidas**;
- **Só não lidas:** filtra a lista.

Quem recebe (e quem recebe também por e-mail) é definido pelo administrador em **Usuários**.

---

## 16. Fornecedores e categorias

- **Fornecedores:** nome, CNPJ, telefone e e-mail. **Entradas** mostra o histórico de compras. Um fornecedor com entradas registradas não pode ser excluído.
- **Categorias:** agrupam os produtos (ONU/ONT, Cabos…). Uma categoria com produtos (inclusive inativos) não pode ser excluída.

---

## 17. Administração (somente admin)

### Usuários

- **Novo usuário:** nome, e-mail, perfil e **senha provisória** (a pessoa troca no 1º acesso).
- **Recebe notificações no sistema** / **por e-mail:** quem recebe os alertas.
- **Editar:** mudar o perfil, redefinir a senha (vira provisória e encerra as sessões da pessoa) ou desativar.
- **Inativar:** o acesso é bloqueado na hora, mas o histórico do usuário é mantido.

### Auditoria

Registro de **quem fez o quê e quando**: logins (inclusive falhas), cadastros, movimentações (inclusive as recusadas), inventários, importações, configurações e backups.

- **Filtros:** período, usuário, módulo, operação e resultado.
- **Ver:** mostra o detalhe e os campos alterados (antes → depois).
- Os registros **não podem ser alterados nem apagados**, e nunca guardam senhas.

### Backups

- **Fazer backup agora:** cópia completa do banco.
- **Verificar:** confere se o arquivo está íntegro.
- **Baixar:** guarde cópias **fora do servidor** toda semana.
- **Restaurar:** volta o sistema ao momento do backup. Exige digitar **RESTAURAR** e a sua senha. Antes, o sistema faz um **backup de segurança** do estado atual (é por ele que se desfaz uma restauração).

Detalhes: [BACKUP_RESTAURACAO.md](BACKUP_RESTAURACAO.md).

### Configurações

- **Organização:** nome, CNPJ, telefone e endereço. Aparecem nos relatórios, nas etiquetas e nos e-mails.
- **Endereço do sistema na rede:** ex.: `http://192.168.0.10:3333`. É usado no QR Code das etiquetas; defina-o **antes de imprimir** as etiquetas.
- **Backup automático:** frequência (diário, semanal, a cada N horas ou desativado), horário e retenção.
- **Notificações por e-mail:** liga o envio. O servidor de e-mail é configurado pela TI no arquivo `.env`.

---

## 18. Rotinas recomendadas

| Quando | O quê | Quem |
|---|---|---|
| A cada recebimento | Entrada (compra) com a nota fiscal; etiquetar os equipamentos novos | Almoxarife |
| Diariamente | Saídas e devoluções dos técnicos; instalações e retiradas com nº da OS | Almoxarife |
| Diariamente | Conferir notificações e itens abaixo do mínimo | Almoxarife |
| Semanalmente | Conferir **pendências de devolução**; baixar uma cópia do backup | Almoxarife / Admin |
| Mensalmente | Inventário físico (pode ser por categoria); termo de responsabilidade dos técnicos | Almoxarife + Admin |
| Mensalmente | Verificar um backup; revisar a auditoria | Admin |

---

## 19. Dúvidas frequentes

**Errei uma movimentação. Como desfaço?**
Movimentações não são apagadas (é o histórico). Faça a operação inversa (ex.: devolução para uma saída errada) ou peça ao administrador um **Ajuste de inventário** com o motivo.

**O sistema diz "Saldo insuficiente", mas o material está na prateleira.**
O saldo do sistema está menor que o real: alguma entrada não foi lançada. Registre a entrada pendente ou faça um inventário do item.

**Não consigo instalar uma ONU: "status Defeito".**
Equipamentos com defeito não podem ir para clientes. Envie-o para manutenção. Se foi engano, peça ao administrador um ajuste.

**A câmera não abre no celular.**
Use **Ler por foto**. Para a câmera ao vivo, a TI precisa habilitar o HTTPS.

**O QR Code abre um endereço que não funciona.**
O endereço do sistema mudou. Ajuste em **Configurações** e reimprima as etiquetas.

**Esqueci minha senha.**
Peça ao administrador para redefinir (ela será provisória). Se for a senha do único administrador, a TI usa o comando de redefinição descrito no [Guia de instalação](GUIA_INSTALACAO.md#10-problemas-comuns).

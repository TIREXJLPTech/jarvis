# Skills

Cada capacidade do Jarvis (agenda, casa, dev, trabalho, memoria, utilidades)
vira uma "skill": uma tool MCP (nome, descricao, schema Zod, handler),
criada com `tool()` do Claude Agent SDK. O orquestrador em `src/skills/index.ts`
junta todas num unico MCP server em processo (`createSdkMcpServer`) e exporta
a lista de nomes de tool pra liberar em `options.tools` (ver `src/core/conversation.ts`).

Convencao por skill:

```
src/skills/<nome-da-skill>/
  index.ts       # export da tool: tool(nome, descricao, schema, handler)
  <nome>.test.ts # testes, quando fizer sentido
```

Skills atuais:

Fase 1:
- **hora** (`src/skills/hora`) - data/hora atual em America/Sao_Paulo, sem
  dependencia externa.
- **clima** (`src/skills/clima`) - previsao do tempo atual por cidade, via
  API publica da Open-Meteo (sem necessidade de API key). Cidade e opcional:
  sem ela, usa a ultima localizacao que Jose compartilhou no Telegram
  (guardada em `AppState`, chave `homeLocation`).
- **busca na web** - nao e uma skill custom; usa a tool nativa `WebSearch`
  do Claude Agent SDK, liberada direto em `options.tools`.

Fase 2:
- **lembretes** (`src/skills/lembretes`) - `criar_lembrete`, `listar_lembretes`
  e `concluir_lembrete`, com tabela `Task` no Postgres. Lembretes com `dueAt`
  sao notificados por Telegram (ver `src/telegram/reminders.ts`), checagem a
  cada 60s, precisa de `TELEGRAM_OWNER_CHAT_ID` no `.env`.
- **notas** (`src/skills/notas`) - `criar_nota` e `listar_notas`, tabela
  `Note` no Postgres.
- **calendario** (`src/skills/calendario`) - `criar_evento` e `listar_eventos`,
  via Google Calendar API (`src/core/google.ts`, OAuth com refresh token de
  longa duracao - ver secao "Google Calendar" no README principal). Falha
  graciosamente (mensagem de texto, nao trava a conversa) se as credenciais
  nao estiverem configuradas.
- **email** (`src/skills/email`) - `listar_emails`, via Microsoft Graph API
  (`src/core/microsoft.ts`, MSAL com fluxo PKCE - ver secao "Outlook
  pessoal" no README principal). Acessa **so a conta pessoal** do Outlook de
  Jose, nunca a da Irapuru (ver `docs/POLITICA-DADOS.md`). Falha
  graciosamente igual a `calendario` se nao estiver configurada.

Fase 4:
- **casa** (`src/skills/casa`) - `listar_dispositivos` e `controlar_dispositivo`,
  via API REST do Home Assistant (`src/core/homeAssistant.ts`, token de
  longa duracao). Testado ponta a ponta contra um Home Assistant rodando
  via WSL2 em modo `demo:` (sem hardware real ainda - ver secao "Home
  Assistant" no README principal). Falha graciosamente igual as outras
  skills de integracao externa se nao estiver configurada.

Fase 5:
- **dev** (`src/skills/dev`) - `listar_repositorios`, `listar_prs`,
  `listar_issues` e `listar_commits`, via GitHub REST API
  (`src/core/github.ts`, Personal Access Token fine-grained). PRs/issues
  buscam em **todos os repositorios do usuario** (qualifier `user:` da
  Search API), sem precisar listar nomes fixos. Tambem `listar_deploys`,
  via API GraphQL do Railway (`src/core/railway.ts`, token de time - ver
  gotcha no README principal sobre `projects` vs `me { projects }`).

Fase 7:
- **memoria** (`src/skills/memoria`) - `lembrar` e `buscar_memorias`, tabela
  `Memory` no Postgres. Memoria de longo prazo de verdade: sobrevive a
  qualquer restart/redeploy, e funciona entre conversas totalmente
  diferentes (nao depende da sessao do Agent SDK). Busca hoje e por
  palavra-chave (ILIKE) - busca semantica de verdade (embeddings) fica pra
  quando tiver uma API de embeddings configurada. Persona instrui o modelo
  a usar `lembrar` proativamente, sem esperar o Jose pedir.

Fase 8:
- **custos** (`src/skills/custos`) - `resumo_custos`, soma o `costUsd` (ja
  logado em `Message` desde a Fase 1) dos ultimos N dias, com total e
  media diaria.

Além do blueprint original (pedido direto do José, 2026-08-27/28):
- **financas** (`src/skills/financas`) - `registrar_gasto`, `listar_gastos`,
  `resumo_gastos` (por categoria), `definir_limite_cartao` e
  `limite_disponivel`, tabelas `Expense` e `CreditCard`. **Registro manual**
  - Jose informa cada gasto por texto, nao e importado automaticamente de
  banco/Open Finance. `limite_disponivel` e uma estimativa (soma gastos do
  mes atual pra aquele metodo de pagamento) - nao considera data de
  fechamento de fatura.
- **projetos** (`src/skills/projetos`) - `criar_projeto`, `listar_projetos`,
  `adicionar_tarefa_projeto`, `listar_tarefas_projeto`,
  `atualizar_status_tarefa` e `resumo_projeto`, tabelas `Project` e
  `ProjectTask`. O JLP funciona como gerente de projetos: ajuda a desenhar
  escopo, quebrar em tarefas, acompanhar progresso e cobrar prazo -
  **nunca executa nada sozinho** (sem Bash/Write/Edit, por design - ver
  `src/core/conversation.ts`). Tarefas atrasadas tambem entram no briefing
  matinal (`src/telegram/briefing.ts`), pra cobrança proativa.

Fora das skills MCP:
- `src/telegram/briefing.ts` monta e manda um briefing diario (clima +
  lembretes) as 7h, reaproveitando os handlers de `clima` e
  `listar_lembretes` diretamente (sem passar pelo modelo) - checa a cada 60s
  se ja passou da hora e se ainda nao mandou hoje (`AppState`, chave
  `lastBriefingDate`), pra sobreviver a restart do container sem duplicar.
- `src/telegram/backup.ts` + `src/core/backup.ts` mandam um backup diario
  (as 3h) com um snapshot JSON de todas as tabelas, como arquivo pro
  proprio Jose no Telegram - mesmo padrao de envio unico por dia do
  briefing (`AppState.lastBackupDate`). Sem `pg_dump`/binario externo de
  proposito - usa o Prisma Client, que ja conhece o schema.

Pra adicionar uma skill nova: criar a pasta com seu `tool()`, adicionar ao
array `skills` em `src/skills/index.ts`, e pronto - o nome ja sai liberado
via `skillsToolNames`.

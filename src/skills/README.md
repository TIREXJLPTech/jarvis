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

Fora das skills MCP: `src/telegram/briefing.ts` monta e manda um briefing
diario (clima + lembretes) as 7h, reaproveitando os handlers de `clima` e
`listar_lembretes` diretamente (sem passar pelo modelo) - checa a cada 60s
se ja passou da hora e se ainda nao mandou hoje (`AppState`, chave
`lastBriefingDate`), pra sobreviver a restart do container sem duplicar.

Pra adicionar uma skill nova: criar a pasta com seu `tool()`, adicionar ao
array `skills` em `src/skills/index.ts`, e pronto - o nome ja sai liberado
via `skillsToolNames`.

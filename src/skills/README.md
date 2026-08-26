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

Skills atuais (Fase 1):

- **hora** (`src/skills/hora`) - data/hora atual em America/Sao_Paulo, sem
  dependencia externa.
- **clima** (`src/skills/clima`) - previsao do tempo atual por cidade, via
  API publica da Open-Meteo (sem necessidade de API key).
- **busca na web** - nao e uma skill custom; usa a tool nativa `WebSearch`
  do Claude Agent SDK, liberada direto em `options.tools`.

Pra adicionar uma skill nova: criar a pasta com seu `tool()`, adicionar ao
array `skills` em `src/skills/index.ts`, e pronto - o nome ja sai liberado
via `skillsToolNames`.

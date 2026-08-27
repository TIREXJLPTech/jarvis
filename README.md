# JLP (Jarvis Lieutenant Personal)

Assistente pessoal em desenvolvimento por fases. O blueprint completo
(arquitetura, stack, todas as fases) fica no painel do projeto no Claude —
este repositório é o código, e evolui junto com cada fase.

## Fase 0 — Fundação e Planejamento

O que já vem pronto neste scaffold:

- [x] Estrutura inicial do projeto (Node.js/TypeScript)
- [x] Núcleo autenticado via **Claude Agent SDK** — usa sua assinatura Pro/Max
      em vez de cobrança por token (ver abaixo)
- [x] Script de verificação da conexão com o Claude (`npm run test:anthropic`)
- [x] Política de separação de dados pessoal × Irapuru (`docs/POLITICA-DADOS.md`)
- [x] Convenção de skills plugáveis documentada (`src/skills/README.md`)

O que só você consegue fazer (contas pessoais):

- [x] Criar o repositório no GitHub e dar `git push` neste código
- [x] Criar um projeto no Railway para o núcleo em nuvem — em produção
      (ver seção "Deploy no Railway" abaixo)
- [x] Gerar um token de acesso com `claude setup-token` (usa sua assinatura
      Pro) — já validado
- [ ] Decidir qual será a "máquina local" (PC/notebook existente ou um
      Raspberry Pi dedicado) — só importa a partir da Fase 3 (voz) e Fase 4
      (casa)

## Fase 1 — Núcleo conversacional (essencialmente pronta, 2 débitos técnicos)

- [x] Persona do JLP (`src/persona.ts`)
- [x] Memória de sessão por conversa (Prisma/Postgres) — funciona, mas não
      sobrevive a reinício do container (ver "Limitação conhecida" abaixo)
- [x] Canal Telegram (`npm run start:telegram`)
- [x] Canal web (`npm run start:web`) — chat local em `http://localhost:3000`,
      protegido por token (`WEB_UI_TOKEN` no `.env`)
- [x] Skills plugáveis: `hora`, `clima` (Open-Meteo, sem API key) e busca na
      web (tool nativa `WebSearch` do Agent SDK) — ver `src/skills/README.md`
- [x] Deploy em produção no Railway (Telegram + web)

Débitos técnicos conhecidos (o blueprint original pedia isso na Fase 1, mas
foi decidido seguir pra Fase 2 e voltar aqui depois):
- [ ] Canal web deveria ser **Next.js**; o que existe é Express + HTML
      estático (funciona, mas não é o stack planejado)
- [ ] Memória de **longo prazo** persistente (que sobrevive a reinício do
      container) — hoje só existe memória de sessão via SDK, que se perde a
      cada redeploy (ver "Limitação conhecida" na seção do Railway)

Antes de rodar localmente, aplique a migration do Prisma:

```bash
npm run db:migrate
```

Se o Postgres for o do Railway, use a URL **pública** (Settings → Networking
→ TCP Proxy do serviço Postgres) no `DATABASE_URL` local — o host interno
(`postgres.railway.internal`) só funciona rodando de dentro do Railway.

## Fase 2 — Produtividade Pessoal (concluída)

- [x] Lembretes/tarefas (`criar_lembrete`, `listar_lembretes`,
      `concluir_lembrete`) com notificação proativa por Telegram quando o
      lembrete tem hora marcada — ver `src/skills/lembretes` e
      `src/telegram/reminders.ts`
- [x] Notas rápidas (`criar_nota`, `listar_notas`) — ver `src/skills/notas`
- [x] Localização atual — José compartilha a localização no Telegram (clipe
      → Localização) e o bot guarda em `AppState`; usada pela skill `clima`
      quando ele não informa cidade ("que tempo faz aqui") e pelo briefing
- [x] Briefing matinal automático — todo dia às 7h (horário de Brasília),
      manda clima + lembretes pendentes por Telegram; ver
      `src/telegram/briefing.ts`
- [x] Google Calendar (`criar_evento`, `listar_eventos`) — ver
      `src/skills/calendario` e "Google Calendar" abaixo
- [x] Triagem/resumo de e-mail (`listar_emails`) — só a conta **pessoal** do
      Outlook de José (nunca a da Irapuru, ver política de separação de
      dados); ver `src/skills/email` e "Outlook pessoal" abaixo

Novo na `.env` pra lembretes/briefing notificarem por Telegram:
```
TELEGRAM_OWNER_CHAT_ID=  # chat_id do José; descubra mandando /id pro bot
```

### Google Calendar

Credenciais em [console.cloud.google.com](https://console.cloud.google.com/):
projeto → habilitar "Google Calendar API" → configurar tela de permissão
OAuth (Externo, escopo `.../auth/calendar`, seu e-mail como usuário de
teste) → criar credencial OAuth tipo "App para computador" → `Client ID` e
`Client Secret` vão em `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no `.env`.

Depois, gera o refresh token (uma vez só, não expira sozinho):
```bash
npm run google:auth
# abre a URL impressa no navegador, autoriza, e o terminal imprime o refresh token
```
Cole o valor em `GOOGLE_REFRESH_TOKEN` no `.env` (e no Railway, serviços
`jlp-telegram` e `jlp-web`).

### Outlook pessoal

Credenciais em [entra.microsoft.com](https://entra.microsoft.com/) → Registros
de aplicativo → Novo registro → Tipos de conta: **"Contas em qualquer
diretório organizacional e contas pessoais da Microsoft"** → URI de
redirecionamento tipo "Cliente público/nativo (desktop)":
`http://localhost:53683`. Só o `Client ID` vai em `MICROSOFT_CLIENT_ID` no
`.env` - esse fluxo usa PKCE, sem client secret.

**Gotcha:** contas Microsoft pessoais sem nenhum tenant/diretório associado
não conseguem registrar apps direto (erro "a capacidade de criar
aplicativos fora de um diretório foi preterida"). Precisa de um tenant pra
"hospedar" o registro - qualquer um serve (mesmo um de outra
organização/negócio, como o `JLPTech`), já que o tipo de conta "contas
pessoais" no registro é o que determina quem consegue autenticar de
verdade, não o tenant onde o app foi criado.

Depois, autoriza uma vez:
```bash
npm run microsoft:auth
# abre a URL impressa no navegador, autoriza com a conta Outlook pessoal
```
Diferente do Google, **não precisa copiar nada pro `.env` depois** - o
cache de token (MSAL) é salvo direto no Postgres (`AppState`), que já é
compartilhado entre local e Railway. Só precisa de `MICROSOFT_CLIENT_ID`
configurado nos dois lugares.

## Deploy no Railway

O JLP roda em produção como **dois serviços separados** no mesmo projeto
Railway (junto com o Postgres): `jlp-telegram` e `jlp-web`, ambos apontando
pro mesmo repo GitHub, branch `main`.

Configuração de cada serviço (Settings → Deploy → Custom Start Command):

```
# jlp-telegram
npm run db:deploy && node dist/src/telegram/index.js

# jlp-web
npm run db:deploy && node dist/src/web/index.js
```

Repare no `dist/src/...`, não `dist/...` — o `tsconfig.json` usa
`rootDir: "."` (pra incluir também `scripts/`), então o `tsc` espelha a
pasta `src/` inteira dentro de `dist/`.

Variáveis necessárias em cada serviço (Variables):
- `CLAUDE_CODE_OAUTH_TOKEN` — igual nos dois serviços (ver seção de
  autenticação abaixo)
- `DATABASE_URL` — referência de variável (`{}`) pro `DATABASE_URL` do
  serviço Postgres, não digitar valor à mão
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` e
  `MICROSOFT_CLIENT_ID` — iguais nos dois serviços (Fase 2, calendário e
  e-mail)
- `jlp-telegram`: também `TELEGRAM_BOT_TOKEN` e `TELEGRAM_OWNER_CHAT_ID`
  (Fase 2, notificação de lembretes — sem essa variável o serviço sobe
  normal, só sem notificar lembretes vencidos)
- `jlp-web`: também `WEB_UI_TOKEN`, e domínio público habilitado em
  Settings → Networking → Generate Domain (porta precisa bater com o que o
  servidor realmente escuta — conferir no log `✅ JLP no ar na web:
  http://localhost:PORTA`, o Railway injeta a própria `PORT`)

Só o `jlp-web` precisa de domínio público — o `jlp-telegram` só faz polling
de saída pro Telegram, não recebe conexões.

**Limitação conhecida:** o Claude Agent SDK guarda o histórico de sessão em
disco local, não no Postgres. Como o container do Railway é efêmero, toda
vez que um serviço reinicia (redeploy, crash) as sessões em andamento
"esquecem" o contexto — o usuário só precisa mandar `/reset` (Telegram) ou
clicar em "Reiniciar conversa" (web). O log de mensagens no Postgres
continua intacto; só ainda não é usado pra reconstruir o contexto da
conversa. Resolver isso é candidato a uma fase futura.

## Autenticação: assinatura Pro em vez de pagar por token

Como você já tem o plano **Claude Pro**, o JLP usa o **Claude Agent SDK**
(não a API paga por token direto) — assim o uso do assistente conta dentro do
limite normal da sua assinatura, sem gerar cobrança extra por enquanto.
Ponto de atenção: esse consumo compartilha a mesma cota que você usa
conversando no claude.ai/app — se o JLP ficar muito ativo (lembretes
automáticos, briefing matinal, etc.), pode valer a pena acompanhar se o limite
do Pro está apertando; nesse caso dá pra trocar para a chave paga por token
(`ANTHROPIC_API_KEY`) a qualquer momento, sem mudar o código.

Passo a passo:

```bash
npm install -g @anthropic-ai/claude-code
claude setup-token
# abre o navegador, você autoriza com a conta Pro, e um token aparece no terminal
```

**Atenção pra não confundir dois valores parecidos nesse fluxo:** a página do
navegador mostra um "código de autenticação" curto que você cola *de volta
no terminal* onde o comando está esperando; só depois disso o terminal
imprime o **token final** (bem mais longo, começa com `sk-ant-oat01-`) — é
esse último que vai em `.env`/Railway, nunca o código da página.

Cole esse token em `.env`, na variável `CLAUDE_CODE_OAUTH_TOKEN`. O token vale
por 1 ano.

## Como rodar o teste de conexão

```bash
npm install
cp .env.example .env
# cole o token gerado acima em CLAUDE_CODE_OAUTH_TOKEN
npm run test:anthropic
```

Se aparecer "✅ Conexão com o Claude funcionando." no terminal, esse item da
Fase 0 está validado.

## Estrutura

```
src/
  config.ts        # leitura de variaveis de ambiente
  persona.ts        # system prompt do JLP
  core/
    conversation.ts # askJLP - fala com o Claude Agent SDK, com skills e resume de sessao
    memory.ts        # memoria persistente por conversa (Prisma)
  telegram/          # canal Telegram (bot.ts) + reminders.ts (checagem de lembretes vencidos)
  web/                # canal web (Express + pagina estatica)
  skills/             # capacidades plugaveis (hora, clima, lembretes, notas, ...)
scripts/
  test-anthropic.ts
docs/
  POLITICA-DADOS.md
```

## Próximas fases

O detalhamento de todas as fases está no blueprint mantido junto com este
projeto no Claude. Resumo: Fase 2 — Produtividade Pessoal (Google Calendar,
triagem de e-mail, tarefas/lembretes, notas, briefing matinal); Fase 3 — voz;
Fase 4 — casa conectada (Home Assistant); Fase 5 — assistente de
desenvolvimento (GitHub/Railway); Fase 6 — monitoramento de sistemas da
Irapuru (isolado, ver `docs/POLITICA-DADOS.md`); Fase 7 — memória de longo
prazo com busca semântica e inteligência proativa; Fase 8 — segurança,
mobilidade e polimento (transversal, começa junto com a Fase 1).

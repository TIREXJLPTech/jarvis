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

## Fase 2 — Produtividade Pessoal (em andamento)

- [x] Lembretes/tarefas (`criar_lembrete`, `listar_lembretes`,
      `concluir_lembrete`) com notificação proativa por Telegram quando o
      lembrete tem hora marcada — ver `src/skills/lembretes` e
      `src/telegram/reminders.ts`
- [x] Notas rápidas (`criar_nota`, `listar_notas`) — ver `src/skills/notas`
- [ ] Google Calendar (consultar, criar, lembrar) — precisa de credenciais
      OAuth no Google Cloud Console, ainda não criadas
- [ ] Triagem/resumo de e-mail (Gmail/Outlook) — precisa definir provedor +
      credenciais OAuth
- [ ] Briefing matinal automático

Novo na `.env` pra lembretes notificarem por Telegram:
```
TELEGRAM_OWNER_CHAT_ID=  # chat_id do José; descubra mandando /id pro bot
```

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

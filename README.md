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
- [x] Decidir a "máquina local" — usando o PC do José por enquanto
      (facilidade/rapidez); migrar pra Raspberry Pi dedicado fica em aberto
      pra mais adiante

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
- [x] Memória de **longo prazo** persistente — resolvida na Fase 7 (skills
      `lembrar`/`buscar_memorias`, tabela `Memory`). A memória de *sessão*
      via SDK ainda se perde a cada redeploy (ver "Limitação conhecida" na
      seção do Railway), mas fatos/preferências importantes agora
      sobrevivem via essa skill

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

## Fase 3 — Camada de Voz (pipeline validado, wake word pendente)

Roda **só localmente** (precisa de microfone/alto-falante) — não faz parte
do deploy no Railway. `npm run start:voice`.

- [x] STT (ElevenLabs Scribe) + núcleo conversacional (mesmo `askJLP` dos
      outros canais) + TTS (ElevenLabs) — testado ponta a ponta com áudio
      real, funcionando
- [ ] Wake word "Jarvis" (Picovoice Porcupine) — conta aguardando aprovação
      de "uso comercial" da Picovoice (mesmo pra uso pessoal, mudança
      recente deles). Enquanto isso, o gatilho é **push-to-talk** (aperta
      Enter, fala, o silêncio corta a gravação sozinho) — só o "gatilho"
      muda quando a wake word estiver disponível, o resto do pipeline é
      idêntico. Ver `src/voice/index.ts`.

Credenciais:
```
PICOVOICE_ACCESS_KEY=   # console.picovoice.ai - deixe vazio pra usar push-to-talk
ELEVENLABS_API_KEY=     # elevenlabs.io -> Settings -> API Keys
ELEVENLABS_VOICE_ID=    # elevenlabs.io -> Voices -> My Voices -> escolher uma voz -> copiar o ID
```

**Gotcha da API key da ElevenLabs:** por padrão a key não vem com permissão
pra nada — ao criar, marque **"Access"** em "Text to Speech" e "Speech to
Text" (as outras podem ficar "No Access").

**Gotcha do Voice ID:** o plano free da ElevenLabs **não permite usar vozes
de biblioteca via API** (erro 402 `paid_plan_required`), mesmo depois de
"adicionar" a voz em "My Voices" - isso não muda a categoria dela. Solução:
usar **Voice Design** (My Voices → Create Voice → gerar uma voz nova a
partir de uma descrição de texto) - aí sim o ID funciona no free tier,
porque é uma voz seu, não da biblioteca.

## Fase 4 — Automação Residencial (integração validada em modo demo)

- [x] Skills `listar_dispositivos` e `controlar_dispositivo`
      (`src/skills/casa`), via API REST do Home Assistant
      (`src/core/homeAssistant.ts`)
- [x] Home Assistant Core rodando via WSL2/Ubuntu neste PC (modo `demo:`,
      sem hardware real) - testado ponta a ponta: listar, ligar e confirmar
      o estado de uma luz simulada
- [ ] Dispositivos reais conectados (luzes, tomadas, sensores) — critério de
      conclusão do blueprint é controlar 3+ de verdade; migrar o Home
      Assistant pra um hub dedicado (ex: Raspberry Pi) fica pra quando
      tiver o hardware

Credenciais:
```
HOME_ASSISTANT_URL=    # ex: http://localhost:8123 (local/WSL) ou http://IP:8123 (hub na rede)
HOME_ASSISTANT_TOKEN=  # perfil do usuário no Home Assistant -> Long-Lived Access Tokens
```

### Instalando o Home Assistant (dev/teste, via WSL2)

Home Assistant **não roda em Windows nativo** (usa `os.fchmod`, só existe em
Linux/Mac) - precisa de WSL2:

```powershell
# PowerShell como Administrador
wsl --install
```

Dentro do Ubuntu (WSL):
```bash
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv python3-full python3-dev build-essential
python3 -m venv ~/home-assistant/venv
source ~/home-assistant/venv/bin/activate
pip install homeassistant

mkdir -p ~/home-assistant/config
cat > ~/home-assistant/config/configuration.yaml << 'EOF'
default_config:
demo:
EOF

hass -c ~/home-assistant/config
```

Depois, `http://localhost:8123` funciona direto no navegador do Windows
(WSL2 encaminha a porta automaticamente). Cria o usuário admin no
assistente inicial, depois gera o token em **perfil → Long-Lived Access
Tokens**.

**Gotcha:** `default_config:` tenta carregar o recurso de voz nativo do
Home Assistant (`assist_pipeline`), que depende de dois pacotes Python que
precisam compilar do zero (`pymicro-vad`, `pyspeex-noise` - sem wheel pronta
pra Python 3.14 ainda). Sem `python3-dev` + `build-essential` instalados
antes, a compilação falha e trava o front-end inteiro (erro genérico
`unknown_error` no console do navegador, tela fica presa em "A carregar...").
Instalar esses dois pacotes do sistema resolve.

## Fase 5 — Assistente de Desenvolvimento (GitHub + Railway prontos)

- [x] Skills `listar_repositorios`, `listar_prs`, `listar_issues`,
      `listar_commits` (`src/skills/dev`), via GitHub REST API
      (`src/core/github.ts`). PRs/issues cobrem **todos os repositórios**
      do usuário automaticamente (qualifier `user:` da Search API do
      GitHub) - não precisa listar nomes fixos
- [x] Skill `listar_deploys` (`src/skills/dev`), via API GraphQL do Railway
      (`src/core/railway.ts`) - status do último deploy de cada serviço,
      em todos os projetos
- [ ] Skill pra rodar/checar scripts locais com permissão explícita
- [ ] Alertas proativos de eventos importantes

Credenciais:
```
GITHUB_TOKEN=       # github.com/settings/tokens?type=beta - Fine-grained
                     # token, All repositories, Read-only em Contents/Issues/Pull requests
RAILWAY_API_TOKEN=  # railway.app/account/tokens - crie com Workspace = seu
                     # workspace de time (não "No workspace"), senão o token
                     # nao enxerga os projetos
```

**Gotcha da API do Railway:** é GraphQL (`https://backboard.railway.app/graphql/v2`),
não REST, e a doc oficial descreve o schema pra token de conta pessoal
(`me { projects { ... } }`). Com um **token de time/workspace** (o que
criamos aqui), esse campo `me` dá erro "Not Authorized" - a query certa é
`projects { ... }` direto na raiz. Descoberto testando ao vivo contra a
API, não pela documentação.

## Fase 6 — Monitoramento de Sistemas de Trabalho (bloqueada por design)

**Não iniciada de propósito.** Antes de qualquer credencial ou endpoint
real da Irapuru ser conectado a este projeto, precisa validar com a
segurança/TI da Irapuru se esse tipo de integração com um serviço de IA de
terceiros (Claude/Anthropic) é permitido - e em que condições (rede, dados
que podem trafegar pra API da Anthropic, retenção de logs). Ver
`docs/POLITICA-DADOS.md`.

Em 2026-08-27, José confirmou que essa validação **ainda não foi feita** -
por isso não existe nenhum código de integração desta fase no repo (nem
scaffolding especulativo contra endpoints que ainda não podemos tocar de
verdade). Quando a aprovação vier:

- Roda como **processo/serviço separado**, com seu próprio `.env` (nunca
  reaproveitar `DATABASE_URL`/credenciais do núcleo pessoal) - ver regra 1
  da política de dados
- Nenhum dado de sistemas da Irapuru entra na memória de longo prazo do
  Jarvis pessoal (regra 5 da política)
- Escopo do blueprint: endpoints de rejeição fiscal (CTe/NFe, efrete),
  alertas antes de virar incidente, dashboard resumido de status

**Nota de produto:** a intenção de longo prazo é o JLP virar um produto
vendável no mercado, não só uso pessoal - então quando esta fase for
implementada, desenhar pra conectar com **qualquer empresa** (config de
credenciais/endpoints por empresa), não hardcoded pra Irapuru, que seria só
o primeiro caso de uso.

## Fase 7 — Inteligência Proativa e Memória de Longo Prazo (núcleo pronto)

- [x] Memória de longo prazo persistente (`lembrar`, `buscar_memorias` -
      `src/skills/memoria`, tabela `Memory`) - sobrevive a qualquer
      restart/redeploy, funciona entre conversas completamente diferentes
      (testado: fato salvo numa conversa, recuperado do zero em outra).
      Fecha o débito técnico que ficou aberto desde a Fase 1
- [ ] Busca **semântica** de verdade (embeddings/RAG) - hoje é busca por
      palavra-chave (ILIKE); evoluir quando fizer sentido configurar uma
      API de embeddings
- [ ] Reconhecimento de padrões/preferências automático (hoje depende do
      modelo decidir usar `lembrar`, guiado pela persona)
- [ ] Automações condicionais ("se X acontecer, faça Y")

Esta é uma fase contínua (evolui junto com o uso real, sem "fim" definido).

## Fase 8 — Segurança, Mobilidade e Polimento (em andamento)

- [x] Monitoramento de custo de API (`resumo_custos` -
      `src/skills/custos`) - soma o `costUsd` já logado desde a Fase 1
- [x] Backup automático (`src/telegram/backup.ts` +
      `src/core/backup.ts`) - snapshot JSON diário (3h) de todas as
      tabelas, mandado como arquivo pro José via Telegram. Sem
      `pg_dump`/binário externo - usa o Prisma Client
- [x] Rate limiting no canal web (`express-rate-limit`) - 100 req/15min
      geral em `/api`, 20 req/10min no `/api/chat` especificamente (é o
      endpoint que custa dinheiro real, chamada ao Claude)
- [ ] Acesso remoto seguro via Tailscale - adiado até ter um caso de uso
      real (quando o Home Assistant sair do modo demo local pra um hub de
      verdade, ou a camada de voz precisar de acesso remoto)
- [ ] Logs de auditoria formais
- [ ] PWA (se necessário)

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
  voice/              # camada de voz local (Fase 3) - STT/TTS ElevenLabs, wake word Porcupine
  skills/             # capacidades plugaveis (hora, clima, lembretes, notas, calendario, email, casa, dev, memoria, custos, ...)
scripts/
  test-anthropic.ts
  google-auth-setup.ts
  microsoft-auth-setup.ts
docs/
  POLITICA-DADOS.md
```

## Próximas fases

O detalhamento de todas as fases está no blueprint mantido junto com este
projeto no Claude. Resumo do que falta: Fase 6 — monitoramento de sistemas
da Irapuru, bloqueada até aprovação de segurança/TI (ver
`docs/POLITICA-DADOS.md`); resto da Fase 8 — Tailscale, logs de auditoria
formais, rate limiting, PWA.

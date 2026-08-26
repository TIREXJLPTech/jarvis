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
- [ ] Criar um projeto no Railway para o núcleo em nuvem (pode ficar vazio por
      enquanto — só provisionar)
- [x] Gerar um token de acesso com `claude setup-token` (usa sua assinatura
      Pro) — já validado
- [ ] Decidir qual será a "máquina local" (PC/notebook existente ou um
      Raspberry Pi dedicado) — só importa a partir da Fase 3 (voz) e Fase 4
      (casa)

## Autenticação: assinatura Pro em vez de pagar por token

Como você já tem o plano **Claude Pro**, o JLP usa o **Claude Agent SDK**
(não a API paga por token direto) — assim o uso do assistente conta dentro do
limite normal da sua assinatura, sem gerar cobrança extra por enquanto.
Ponto de atenção: esse consumo compartilha a mesma cota que você usa
conversando no claude.ai/app — se o JLP ficar muito ativo (Fase 2 em
diante, com checagens automáticas), pode valer a pena acompanhar se o limite
do Pro está apertando; nesse caso dá pra trocar para a chave paga por token
(`ANTHROPIC_API_KEY`) a qualquer momento, sem mudar o código.

Passo a passo:

```bash
npm install -g @anthropic-ai/claude-code
claude setup-token
# abre o navegador, você autoriza com a conta Pro, e um token aparece no terminal
```

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
  skills/          # capacidades plugaveis (a partir da Fase 1)
scripts/
  test-anthropic.ts
docs/
  POLITICA-DADOS.md
```

## Próximas fases

Fase 1 adiciona o backend de chat (Telegram + web) e a primeira memória
persistente, construído em cima do mesmo Claude Agent SDK. O detalhamento de
todas as fases está no blueprint mantido junto com este projeto no Claude.

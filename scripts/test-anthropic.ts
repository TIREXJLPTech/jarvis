/**
 * Script de verificação da Fase 0.
 * Confirma que o JLP consegue conversar com o Claude — usando de
 * preferência a sua assinatura Pro/Max (via `claude setup-token`), com a
 * chave paga por token como alternativa.
 *
 * Uso (com a assinatura, recomendado pro plano Pro):
 *   1) npm install -g @anthropic-ai/claude-code
 *   2) claude setup-token   (abre o navegador, pede pra autorizar)
 *   3) cole o token em CLAUDE_CODE_OAUTH_TOKEN no .env
 *   4) npm install
 *   5) npm run test:anthropic
 *
 * Uso (com chave paga por token, alternativa):
 *   1) gere uma chave em console.anthropic.com -> API Keys
 *   2) cole em ANTHROPIC_API_KEY no .env
 *   3) npm install && npm run test:anthropic
 */
import { query } from '@anthropic-ai/claude-agent-sdk';
import { describeAuthMode } from '../src/config';

const DICA_AUTENTICACAO =
  'Verifique se CLAUDE_CODE_OAUTH_TOKEN (gerado com "claude setup-token") ou ' +
  'ANTHROPIC_API_KEY estão preenchidos no .env — ou se você está logado ' +
  'localmente com "claude login".';

async function main() {
  console.log(`Modo de autenticação detectado: ${describeAuthMode()}\n`);

  let respondeu = false;

  for await (const message of query({
    prompt:
      'Responda em uma frase curta, em português, confirmando que a conexão ' +
      'do JLP com o Claude está funcionando. Não use nenhuma ferramenta.',
    options: {
      model: 'claude-sonnet-5',
      maxTurns: 1,
      tools: [],
      maxBudgetUsd: 0.05,
    },
  })) {
    if (message.type === 'result') {
      respondeu = true;
      if (message.subtype === 'success' && !message.is_error) {
        console.log('✅ Conexão com o Claude funcionando.\n');
        console.log('Resposta do modelo:', message.result);
        console.log(`\nCusto estimado desta chamada: US$ ${message.total_cost_usd.toFixed(5)}`);
      } else {
        console.error('❌ A conversa terminou com erro:\n');
        console.error(JSON.stringify(message, null, 2));
        console.error(`\n${DICA_AUTENTICACAO}`);
        process.exitCode = 1;
      }
    }
  }

  if (!respondeu) {
    console.error('❌ Nenhuma resposta recebida do Claude.');
    console.error(DICA_AUTENTICACAO);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('❌ Falha ao conectar com o Claude.\n');
  console.error(err instanceof Error ? err.message : err);
  console.error(`\n${DICA_AUTENTICACAO}`);
  process.exitCode = 1;
});

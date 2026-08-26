import 'dotenv/config';

/**
 * Configuracao central do Jarvis.
 *
 * Autenticacao com o Claude (a partir da Fase 0): quem resolve isso e o
 * Claude Agent SDK sozinho, nesta ordem de prioridade:
 *   1) ANTHROPIC_API_KEY       - chave paga por token (console.anthropic.com)
 *   2) CLAUDE_CODE_OAUTH_TOKEN - assinatura Pro/Max, gerado com `claude setup-token`
 *   3) login local da Claude Code CLI (`claude login`), se nenhuma das duas acima existir
 *
 * Aqui a gente so verifica, pra fins de diagnostico, se pelo menos uma das
 * duas variaveis de ambiente esta presente - nao da pra enxergar um login
 * local da CLI a partir do Node.
 */
export const config = {
  hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
  hasOAuthToken: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN),
};

export function describeAuthMode(): string {
  if (config.hasApiKey) {
    return 'ANTHROPIC_API_KEY (cobrança por token)';
  }
  if (config.hasOAuthToken) {
    return 'CLAUDE_CODE_OAUTH_TOKEN (assinatura Pro/Max)';
  }
  return 'nenhuma variável encontrada em .env — tentando login local da Claude Code CLI (claude login)';
}

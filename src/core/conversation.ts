import { query } from '@anthropic-ai/claude-agent-sdk';
import { JLP_PERSONA } from '../persona';

export interface JlpReply {
  text: string;
  sessionId: string;
  costUsd: number;
}

/**
 * Manda uma mensagem para o JLP e devolve a resposta.
 *
 * `resumeSessionId`, quando informado, continua uma conversa anterior - o
 * Claude Agent SDK guarda o histórico da sessão em disco, e isso funciona
 * como nossa memória de curto prazo por enquanto (por canal/usuário).
 * Memória de longo prazo persistida em banco (Postgres, sobrevive a
 * reinícios) é um próximo passo dentro da Fase 1.
 */
export async function askJLP(prompt: string, resumeSessionId?: string): Promise<JlpReply> {
  let text = '';
  let sessionId = resumeSessionId ?? '';
  let costUsd = 0;

  for await (const message of query({
    prompt,
    options: {
      model: 'claude-sonnet-5',
      systemPrompt: JLP_PERSONA,
      tools: [],
      maxTurns: 1,
      maxBudgetUsd: 0.2,
      ...(resumeSessionId ? { resume: resumeSessionId } : {}),
    },
  })) {
    if (message.type === 'result') {
      sessionId = message.session_id;
      if (message.subtype === 'success' && !message.is_error) {
        text = message.result;
        costUsd = message.total_cost_usd;
      } else {
        throw new Error(`JLP terminou com erro (${message.subtype}): ${JSON.stringify(message)}`);
      }
    }
  }

  if (!text) {
    throw new Error('JLP não retornou nenhuma resposta.');
  }

  return { text, sessionId, costUsd };
}

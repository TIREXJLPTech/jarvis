import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma } from '../../core/memory';

export const resumoCustosSkill = tool(
  'resumo_custos',
  'Resume quanto foi gasto em custo de API do Claude nos últimos N dias (padrão 7), ' +
    'com total e média diária. Baseado no custo real de cada resposta, já registrado no banco.',
  { dias: z.number().int().min(1).max(90).optional().describe('Quantos dias pra trás considerar (padrão 7)') },
  async ({ dias }) => {
    const periodo = dias ?? 7;
    const desde = new Date(Date.now() - periodo * 24 * 60 * 60 * 1000);

    const mensagens = await prisma.message.findMany({
      where: { createdAt: { gte: desde }, costUsd: { not: null } },
      select: { costUsd: true, createdAt: true },
    });

    if (mensagens.length === 0) {
      return { content: [{ type: 'text', text: `Nenhum custo registrado nos últimos ${periodo} dias.` }] };
    }

    const total = mensagens.reduce((soma, m) => soma + (m.costUsd ?? 0), 0);
    const media = total / periodo;

    const texto =
      `Últimos ${periodo} dias: US$ ${total.toFixed(4)} em ${mensagens.length} respostas ` +
      `(média de US$ ${media.toFixed(4)}/dia).`;

    return { content: [{ type: 'text', text: texto }] };
  },
);

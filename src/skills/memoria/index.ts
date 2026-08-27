import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma } from '../../core/memory';

export const lembrarSkill = tool(
  'lembrar',
  'Salva um fato ou preferência sobre José pra lembrar pra sempre, mesmo depois de reiniciar ' +
    '(diferente do contexto normal da conversa, que se perde). Use quando José disser algo que ' +
    'vale guardar de verdade: preferências pessoais, contexto recorrente, decisões importantes. ' +
    'Não precisa perguntar permissão pra usar essa skill quando fizer sentido.',
  { fato: z.string().describe('O fato/preferência a guardar, em texto claro e autocontido') },
  async ({ fato }) => {
    await prisma.memory.create({ data: { content: fato } });
    return { content: [{ type: 'text', text: 'Guardado.' }] };
  },
);

export const buscarMemoriasSkill = tool(
  'buscar_memorias',
  'Busca fatos/preferências guardados sobre José anteriormente. Use no início de assuntos ' +
    'onde contexto de longo prazo pode ajudar, ou quando José perguntar "o que você sabe sobre..." ' +
    'ou similar. Sem termo de busca, lista os mais recentes.',
  { busca: z.string().optional().describe('Termo pra buscar nos fatos guardados. Opcional.') },
  async ({ busca }) => {
    const memorias = busca
      ? await prisma.memory.findMany({
          where: { content: { contains: busca, mode: 'insensitive' } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        })
      : await prisma.memory.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });

    if (memorias.length === 0) {
      return { content: [{ type: 'text', text: 'Nada guardado ainda sobre isso.' }] };
    }

    return { content: [{ type: 'text', text: memorias.map((m) => `- ${m.content}`).join('\n') }] };
  },
);

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma } from '../../core/memory';

export const criarNotaSkill = tool(
  'criar_nota',
  'Salva uma nota rápida de José (ideia, anotação, referência) pra consulta depois.',
  { content: z.string().describe('Conteúdo da nota') },
  async ({ content }) => {
    await prisma.note.create({ data: { content } });
    return { content: [{ type: 'text', text: 'Nota salva.' }] };
  },
);

export const listarNotasSkill = tool(
  'listar_notas',
  'Lista as notas mais recentes de José.',
  { limite: z.number().int().min(1).max(50).optional().describe('Quantas notas retornar (padrão 10)') },
  async ({ limite }) => {
    const notes = await prisma.note.findMany({
      orderBy: { createdAt: 'desc' },
      take: limite ?? 10,
    });

    if (notes.length === 0) {
      return { content: [{ type: 'text', text: 'Nenhuma nota salva ainda.' }] };
    }

    const formatado = notes
      .map((n) => {
        const data = new Intl.DateTimeFormat('pt-BR', {
          timeZone: 'America/Sao_Paulo',
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(n.createdAt);
        return `- [${data}] ${n.content}`;
      })
      .join('\n');

    return { content: [{ type: 'text', text: formatado }] };
  },
);

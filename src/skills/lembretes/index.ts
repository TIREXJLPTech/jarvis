import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma } from '../../core/memory';

function formatarLembrete(task: { content: string; dueAt: Date | null }): string {
  if (!task.dueAt) return `- ${task.content}`;
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(task.dueAt);
  return `- ${task.content} (${dataFormatada})`;
}

export const criarLembreteSkill = tool(
  'criar_lembrete',
  'Cria um lembrete/tarefa pra José. Se tiver uma data/hora especifica, informe ' +
    'em dueAt como ISO 8601 (ex: 2026-08-27T09:00:00-03:00) - use a skill "hora" ' +
    'primeiro se precisar saber a data/hora atual pra calcular datas relativas ' +
    '("amanhã", "sexta que vem"). Se for só um lembrete de lista, sem hora ' +
    'marcada, deixe dueAt de fora.',
  {
    content: z.string().describe('O que precisa ser lembrado, em texto claro'),
    dueAt: z.string().optional().describe('Data/hora em ISO 8601, com timezone. Opcional.'),
  },
  async ({ content, dueAt }) => {
    const task = await prisma.task.create({
      data: { content, dueAt: dueAt ? new Date(dueAt) : null },
    });

    return {
      content: [{ type: 'text', text: `Lembrete criado: ${formatarLembrete(task)}` }],
    };
  },
);

export const listarLembretesSkill = tool(
  'listar_lembretes',
  'Lista os lembretes/tarefas pendentes de José, mais recentes primeiro.',
  {},
  async () => {
    const tasks = await prisma.task.findMany({
      where: { done: false },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    if (tasks.length === 0) {
      return { content: [{ type: 'text', text: 'Nenhum lembrete pendente.' }] };
    }

    return { content: [{ type: 'text', text: tasks.map(formatarLembrete).join('\n') }] };
  },
);

export const concluirLembreteSkill = tool(
  'concluir_lembrete',
  'Marca um lembrete/tarefa pendente como concluído, buscando pelo texto dele.',
  { busca: z.string().describe('Trecho do texto do lembrete pra encontrar qual concluir') },
  async ({ busca }) => {
    const task = await prisma.task.findFirst({
      where: { done: false, content: { contains: busca, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
    });

    if (!task) {
      return { content: [{ type: 'text', text: `Não encontrei nenhum lembrete pendente com "${busca}".` }] };
    }

    await prisma.task.update({ where: { id: task.id }, data: { done: true } });

    return { content: [{ type: 'text', text: `Concluído: ${task.content}` }] };
  },
);

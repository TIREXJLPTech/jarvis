import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma } from '../../core/memory';

function formatarData(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(d);
}

async function encontrarProjeto(busca: string) {
  return prisma.project.findFirst({
    where: { name: { contains: busca, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
  });
}

export const criarProjetoSkill = tool(
  'criar_projeto',
  'Cria um novo projeto pra José gerenciar (design + plano + acompanhamento - o JLP não executa nada ' +
    'sozinho, só ajuda a planejar e cobra prazo).',
  {
    nome: z.string().describe('Nome do projeto'),
    descricao: z.string().optional().describe('Descrição/objetivo do projeto'),
  },
  async ({ nome, descricao }) => {
    await prisma.project.create({ data: { name: nome, description: descricao } });
    return { content: [{ type: 'text', text: `Projeto "${nome}" criado.` }] };
  },
);

export const listarProjetosSkill = tool(
  'listar_projetos',
  'Lista os projetos de José com progresso (tarefas concluídas / total). Filtra por status ' +
    '(ativo, pausado, concluido, cancelado) se informado; sem filtro, mostra os ativos.',
  { status: z.string().optional().describe('Status pra filtrar. Padrão: "ativo".') },
  async ({ status }) => {
    const projetos = await prisma.project.findMany({
      where: { status: status ?? 'ativo' },
      include: { tasks: true },
      orderBy: { createdAt: 'desc' },
    });

    if (projetos.length === 0) {
      return { content: [{ type: 'text', text: `Nenhum projeto com status "${status ?? 'ativo'}".` }] };
    }

    const linhas = projetos.map((p) => {
      const concluidas = p.tasks.filter((t) => t.status === 'concluida').length;
      return `- ${p.name} [${p.status}]: ${concluidas}/${p.tasks.length} tarefas concluídas`;
    });

    return { content: [{ type: 'text', text: linhas.join('\n') }] };
  },
);

export const adicionarTarefaProjetoSkill = tool(
  'adicionar_tarefa_projeto',
  'Adiciona uma tarefa/marco a um projeto existente, opcionalmente com prazo.',
  {
    projeto: z.string().describe('Nome (ou parte do nome) do projeto'),
    titulo: z.string().describe('Título da tarefa'),
    prazo: z.string().optional().describe('Prazo em ISO 8601. Opcional.'),
  },
  async ({ projeto, titulo, prazo }) => {
    const p = await encontrarProjeto(projeto);
    if (!p) {
      return { content: [{ type: 'text', text: `Não encontrei nenhum projeto com "${projeto}".` }] };
    }

    await prisma.projectTask.create({
      data: { projectId: p.id, title: titulo, dueAt: prazo ? new Date(prazo) : null },
    });

    return { content: [{ type: 'text', text: `Tarefa "${titulo}" adicionada ao projeto "${p.name}".` }] };
  },
);

export const listarTarefasProjetoSkill = tool(
  'listar_tarefas_projeto',
  'Lista as tarefas de um projeto, com status e prazo.',
  { projeto: z.string().describe('Nome (ou parte do nome) do projeto') },
  async ({ projeto }) => {
    const p = await encontrarProjeto(projeto);
    if (!p) {
      return { content: [{ type: 'text', text: `Não encontrei nenhum projeto com "${projeto}".` }] };
    }

    const tarefas = await prisma.projectTask.findMany({ where: { projectId: p.id }, orderBy: { createdAt: 'asc' } });
    if (tarefas.length === 0) {
      return { content: [{ type: 'text', text: `Projeto "${p.name}" ainda não tem tarefas.` }] };
    }

    const linhas = tarefas.map((t) => {
      const prazo = t.dueAt ? ` (prazo: ${formatarData(t.dueAt)})` : '';
      const atrasada = t.dueAt && t.dueAt < new Date() && t.status !== 'concluida' ? ' ⚠️ ATRASADA' : '';
      return `- [${t.status}] ${t.title}${prazo}${atrasada}`;
    });

    return { content: [{ type: 'text', text: `${p.name}:\n${linhas.join('\n')}` }] };
  },
);

export const atualizarStatusTarefaSkill = tool(
  'atualizar_status_tarefa',
  'Atualiza o status de uma tarefa de projeto: pendente, em_andamento, concluida ou bloqueada.',
  {
    tarefa: z.string().describe('Trecho do título da tarefa'),
    status: z.enum(['pendente', 'em_andamento', 'concluida', 'bloqueada']),
  },
  async ({ tarefa, status }) => {
    const t = await prisma.projectTask.findFirst({
      where: { title: { contains: tarefa, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
    });

    if (!t) {
      return { content: [{ type: 'text', text: `Não encontrei nenhuma tarefa com "${tarefa}".` }] };
    }

    await prisma.projectTask.update({ where: { id: t.id }, data: { status } });
    return { content: [{ type: 'text', text: `Tarefa "${t.title}" agora está "${status}".` }] };
  },
);

export const resumoProjetoSkill = tool(
  'resumo_projeto',
  'Resumo de um projeto: progresso, tarefas pendentes/em andamento, e quais estão atrasadas.',
  { projeto: z.string().describe('Nome (ou parte do nome) do projeto') },
  async ({ projeto }) => {
    const p = await encontrarProjeto(projeto);
    if (!p) {
      return { content: [{ type: 'text', text: `Não encontrei nenhum projeto com "${projeto}".` }] };
    }

    const tarefas = await prisma.projectTask.findMany({ where: { projectId: p.id } });
    const concluidas = tarefas.filter((t) => t.status === 'concluida').length;
    const atrasadas = tarefas.filter((t) => t.dueAt && t.dueAt < new Date() && t.status !== 'concluida');

    const texto =
      `${p.name} [${p.status}]${p.description ? ` - ${p.description}` : ''}\n` +
      `Progresso: ${concluidas}/${tarefas.length} tarefas concluídas.\n` +
      (atrasadas.length > 0
        ? `⚠️ ${atrasadas.length} atrasada(s): ${atrasadas.map((t) => t.title).join(', ')}`
        : 'Nenhuma tarefa atrasada.');

    return { content: [{ type: 'text', text: texto }] };
  },
);

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { listRepos, searchOpenItems, listRecentCommits } from '../../core/github';

function formatarData(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

export const listarRepositoriosSkill = tool(
  'listar_repositorios',
  'Lista os repositórios do GitHub de José, mais recentemente atualizados primeiro.',
  {},
  async () => {
    try {
      const repos = await listRepos();
      if (repos.length === 0) {
        return { content: [{ type: 'text', text: 'Nenhum repositório encontrado.' }] };
      }
      const texto = repos
        .map((r) => `- ${r.full_name}${r.private ? ' (privado)' : ''} - ${r.open_issues_count} issues/PRs abertos, atualizado em ${formatarData(r.updated_at)}`)
        .join('\n');
      return { content: [{ type: 'text', text: texto }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui consultar o GitHub: ${(err as Error).message}` }] };
    }
  },
);

export const listarPrsSkill = tool(
  'listar_prs',
  'Lista os Pull Requests abertos em todos os repositórios de José no GitHub.',
  {},
  async () => {
    try {
      const { items, total_count } = await searchOpenItems('pr');
      if (items.length === 0) {
        return { content: [{ type: 'text', text: 'Nenhum PR aberto.' }] };
      }
      const texto = items
        .map((i) => `- [${i.repository_url.split('/').slice(-2).join('/')}] #${i.number} ${i.title} (${formatarData(i.updated_at)})`)
        .join('\n');
      return { content: [{ type: 'text', text: `${total_count} PR(s) aberto(s):\n${texto}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui consultar o GitHub: ${(err as Error).message}` }] };
    }
  },
);

export const listarIssuesSkill = tool(
  'listar_issues',
  'Lista as issues abertas em todos os repositórios de José no GitHub.',
  {},
  async () => {
    try {
      const { items, total_count } = await searchOpenItems('issue');
      if (items.length === 0) {
        return { content: [{ type: 'text', text: 'Nenhuma issue aberta.' }] };
      }
      const texto = items
        .map((i) => `- [${i.repository_url.split('/').slice(-2).join('/')}] #${i.number} ${i.title} (${formatarData(i.updated_at)})`)
        .join('\n');
      return { content: [{ type: 'text', text: `${total_count} issue(s) aberta(s):\n${texto}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui consultar o GitHub: ${(err as Error).message}` }] };
    }
  },
);

export const listarCommitsSkill = tool(
  'listar_commits',
  'Lista os commits mais recentes de um repositório específico do GitHub.',
  { repositorio: z.string().describe('Nome completo do repositório, ex: "TIREXJLPTech/jarvis"') },
  async ({ repositorio }) => {
    try {
      const commits = await listRecentCommits(repositorio);
      const texto = commits
        .map((c) => `- ${c.sha.slice(0, 7)} ${c.commit.message.split('\n')[0]} - ${c.commit.author.name} (${formatarData(c.commit.author.date)})`)
        .join('\n');
      return { content: [{ type: 'text', text: texto || 'Nenhum commit encontrado.' }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui consultar o GitHub: ${(err as Error).message}` }] };
    }
  },
);

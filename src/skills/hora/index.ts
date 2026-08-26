import { tool } from '@anthropic-ai/claude-agent-sdk';

export const horaSkill = tool(
  'hora',
  'Devolve a data e a hora atuais no fuso horário de José (America/Sao_Paulo).',
  {},
  async () => {
    const texto = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date());

    return { content: [{ type: 'text', text: texto }] };
  },
);

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getCalendarClient } from '../../core/google';

const TIMEZONE = 'America/Sao_Paulo';

function formatarEvento(evento: { summary?: string | null; start?: { dateTime?: string | null; date?: string | null } | null }): string {
  const inicio = evento.start?.dateTime ?? evento.start?.date;
  if (!inicio) return `- ${evento.summary ?? '(sem título)'}`;

  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    dateStyle: 'short',
    timeStyle: evento.start?.dateTime ? 'short' : undefined,
  }).format(new Date(inicio));

  return `- ${evento.summary ?? '(sem título)'} (${dataFormatada})`;
}

export const criarEventoSkill = tool(
  'criar_evento',
  'Cria um evento no Google Calendar de José. Use a skill "hora" primeiro se ' +
    'precisar calcular datas relativas ("amanhã", "sexta que vem").',
  {
    titulo: z.string().describe('Título do evento'),
    inicio: z.string().describe('Data/hora de início, ISO 8601 com timezone (ex: 2026-08-28T14:00:00-03:00)'),
    fim: z.string().optional().describe('Data/hora de fim, ISO 8601. Se ausente, assume 1h de duração.'),
    descricao: z.string().optional().describe('Descrição/detalhes do evento'),
  },
  async ({ titulo, inicio, fim, descricao }) => {
    try {
      const calendar = getCalendarClient();
      const inicioDate = new Date(inicio);
      const fimDate = fim ? new Date(fim) : new Date(inicioDate.getTime() + 60 * 60 * 1000);

      const { data } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: titulo,
          description: descricao,
          start: { dateTime: inicioDate.toISOString(), timeZone: TIMEZONE },
          end: { dateTime: fimDate.toISOString(), timeZone: TIMEZONE },
        },
      });

      return { content: [{ type: 'text', text: `Evento criado: ${formatarEvento(data)}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui criar o evento: ${(err as Error).message}` }] };
    }
  },
);

export const listarEventosSkill = tool(
  'listar_eventos',
  'Lista os próximos eventos do Google Calendar de José.',
  {
    dataInicio: z.string().optional().describe('ISO 8601. Padrão: agora.'),
    dataFim: z.string().optional().describe('ISO 8601. Padrão: 7 dias a partir do início.'),
  },
  async ({ dataInicio, dataFim }) => {
    try {
      const calendar = getCalendarClient();
      const inicio = dataInicio ? new Date(dataInicio) : new Date();
      const fim = dataFim ? new Date(dataFim) : new Date(inicio.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data } = await calendar.events.list({
        calendarId: 'primary',
        timeMin: inicio.toISOString(),
        timeMax: fim.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 20,
      });

      const eventos = data.items ?? [];
      if (eventos.length === 0) {
        return { content: [{ type: 'text', text: 'Nenhum evento no período.' }] };
      }

      return { content: [{ type: 'text', text: eventos.map(formatarEvento).join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui consultar a agenda: ${(err as Error).message}` }] };
    }
  },
);

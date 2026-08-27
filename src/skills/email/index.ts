import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getMicrosoftAccessToken } from '../../core/microsoft';

interface GraphMessage {
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
  isRead?: boolean;
}

interface GraphMessagesResponse {
  value?: GraphMessage[];
}

function formatarEmail(msg: GraphMessage): string {
  const remetente = msg.from?.emailAddress?.name ?? msg.from?.emailAddress?.address ?? 'desconhecido';
  const data = msg.receivedDateTime
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(msg.receivedDateTime),
      )
    : '';
  const marca = msg.isRead ? '' : '🔵 ';
  const preview = (msg.bodyPreview ?? '').replace(/\s+/g, ' ').slice(0, 140);

  return `${marca}${msg.subject ?? '(sem assunto)'} — de ${remetente} (${data})\n  ${preview}`;
}

export const listarEmailsSkill = tool(
  'listar_emails',
  'Lista os e-mails mais recentes da caixa de entrada pessoal (Outlook) de José, ' +
    'pra triagem/resumo. 🔵 marca os não lidos.',
  { quantidade: z.number().int().min(1).max(25).optional().describe('Quantos e-mails retornar (padrão 10)') },
  async ({ quantidade }) => {
    try {
      const token = await getMicrosoftAccessToken();
      const top = quantidade ?? 10;
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages` +
          `?$top=${top}&$select=subject,from,receivedDateTime,isRead,bodyPreview&$orderby=receivedDateTime desc`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!resp.ok) {
        return { content: [{ type: 'text', text: `Não consegui consultar o e-mail (HTTP ${resp.status}).` }] };
      }

      const data = (await resp.json()) as GraphMessagesResponse;
      const mensagens = data.value ?? [];

      if (mensagens.length === 0) {
        return { content: [{ type: 'text', text: 'Caixa de entrada vazia.' }] };
      }

      return { content: [{ type: 'text', text: mensagens.map(formatarEmail).join('\n\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui acessar o e-mail: ${(err as Error).message}` }] };
    }
  },
);

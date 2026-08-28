import { Telegraf } from 'telegraf';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { climaSkill } from '../skills/clima';
import { listarLembretesSkill } from '../skills/lembretes';
import { getState, setState, prisma } from '../core/memory';

const CHECK_INTERVAL_MS = 60_000;
const BRIEFING_HOUR = 7; // horario de Brasilia (America/Sao_Paulo)

function textoDoResultado(result: CallToolResult): string {
  const bloco = result.content[0];
  return bloco && bloco.type === 'text' ? bloco.text : '';
}

function agoraEmSaoPaulo(): { data: string; hora: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const obter = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? '';
  return { data: `${obter('year')}-${obter('month')}-${obter('day')}`, hora: Number(obter('hour')) };
}

async function textoTarefasAtrasadas(): Promise<string> {
  const atrasadas = await prisma.projectTask.findMany({
    where: { dueAt: { lt: new Date() }, status: { not: 'concluida' } },
    include: { project: true },
    orderBy: { dueAt: 'asc' },
  });

  if (atrasadas.length === 0) return '';

  const linhas = atrasadas.map((t) => `- [${t.project.name}] ${t.title}`);
  return `\n⚠️ Tarefas de projeto atrasadas:\n${linhas.join('\n')}`;
}

async function montarBriefing(): Promise<string> {
  const dataFormatada = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'full',
  }).format(new Date());

  const clima = textoDoResultado(await climaSkill.handler({ cidade: undefined }, undefined));
  const lembretes = textoDoResultado(await listarLembretesSkill.handler({}, undefined));
  const tarefasAtrasadas = await textoTarefasAtrasadas();

  return [`☀️ Bom dia, José! ${dataFormatada}.`, '', clima, '', 'Lembretes pendentes:', lembretes, tarefasAtrasadas]
    .join('\n')
    .trimEnd();
}

/**
 * Briefing matinal (Fase 2): checa a cada minuto se já passou do horário e se
 * ainda não foi enviado hoje (estado persistido em `AppState`, sobrevive a
 * restart do container). Se o clima depender da localização de José e ela
 * não tiver sido compartilhada ainda, a skill `clima` retorna um aviso em
 * vez de travar o briefing.
 */
export function startMorningBriefing(bot: Telegraf, ownerChatId: string): void {
  setInterval(async () => {
    try {
      const { data, hora } = agoraEmSaoPaulo();
      if (hora < BRIEFING_HOUR) return;

      const ultimoEnviado = await getState('lastBriefingDate');
      if (ultimoEnviado === data) return;

      const texto = await montarBriefing();
      await bot.telegram.sendMessage(ownerChatId, texto);
      await setState('lastBriefingDate', data);
    } catch (err) {
      console.error('Erro ao montar/enviar briefing matinal:', err);
    }
  }, CHECK_INTERVAL_MS);
}

import { Telegraf } from 'telegraf';
import { prisma } from '../core/memory';

const CHECK_INTERVAL_MS = 60_000;

async function checkDueReminders(bot: Telegraf, ownerChatId: string): Promise<void> {
  const dueTasks = await prisma.task.findMany({
    where: { done: false, notifiedAt: null, dueAt: { lte: new Date() } },
  });

  for (const task of dueTasks) {
    try {
      await bot.telegram.sendMessage(ownerChatId, `⏰ Lembrete: ${task.content}`);
      await prisma.task.update({ where: { id: task.id }, data: { notifiedAt: new Date() } });
    } catch (err) {
      console.error(`Erro ao notificar lembrete ${task.id}:`, err);
    }
  }
}

/**
 * Checagem periódica de lembretes vencidos (Fase 2), notificando José por
 * Telegram. `ownerChatId` é fixo (assistente de usuário único) - vem de
 * `TELEGRAM_OWNER_CHAT_ID` no `.env`.
 */
export function startReminderScheduler(bot: Telegraf, ownerChatId: string): void {
  setInterval(() => {
    checkDueReminders(bot, ownerChatId).catch((err) => {
      console.error('Erro ao checar lembretes vencidos:', err);
    });
  }, CHECK_INTERVAL_MS);
}

import 'dotenv/config';
import { createJlpBot } from './bot';
import { startReminderScheduler } from './reminders';
import { startMorningBriefing } from './briefing';

const token = process.env.TELEGRAM_BOT_TOKEN;
const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env.');
  console.error('Crie um bot com o @BotFather no Telegram e cole o token gerado em TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}

const bot = createJlpBot(token);

bot.launch();
console.log('✅ JLP no ar no Telegram. Ctrl+C para encerrar.');

if (ownerChatId) {
  startReminderScheduler(bot, ownerChatId);
  startMorningBriefing(bot, ownerChatId);
  console.log('✅ Checagem de lembretes e briefing matinal ativos.');
} else {
  console.warn('⚠️ TELEGRAM_OWNER_CHAT_ID não configurado - lembretes e briefing não vão notificar. Use /id no bot pra descobrir o valor.');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

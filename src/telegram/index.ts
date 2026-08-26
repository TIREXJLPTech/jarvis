import 'dotenv/config';
import { createJlpBot } from './bot';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env.');
  console.error('Crie um bot com o @BotFather no Telegram e cole o token gerado em TELEGRAM_BOT_TOKEN.');
  process.exit(1);
}

const bot = createJlpBot(token);

bot.launch();
console.log('✅ JLP no ar no Telegram. Ctrl+C para encerrar.');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

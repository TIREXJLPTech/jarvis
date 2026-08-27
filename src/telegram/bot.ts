import { Telegraf } from 'telegraf';
import { askJLP } from '../core/conversation';
import { getOrCreateConversation, logMessage, updateSessionId } from '../core/memory';

export function createJlpBot(token: string): Telegraf {
  const bot = new Telegraf(token);

  bot.start(async (ctx) => {
    const conversation = await getOrCreateConversation('telegram', String(ctx.chat.id));
    await updateSessionId(conversation.id, null);
    return ctx.reply('JLP operacional. Pode falar, José.');
  });

  bot.command('reset', async (ctx) => {
    const conversation = await getOrCreateConversation('telegram', String(ctx.chat.id));
    await updateSessionId(conversation.id, null);
    return ctx.reply('Memória desta conversa reiniciada.');
  });

  bot.command('id', async (ctx) => {
    return ctx.reply(`Chat ID: ${ctx.chat.id}`);
  });

  bot.on('text', async (ctx) => {
    const chatId = String(ctx.chat.id);
    await ctx.sendChatAction('typing');
    try {
      const conversation = await getOrCreateConversation('telegram', chatId);
      const reply = await askJLP(ctx.message.text, conversation.sessionId ?? undefined);

      await updateSessionId(conversation.id, reply.sessionId);
      await logMessage(conversation.id, 'user', ctx.message.text);
      await logMessage(conversation.id, 'assistant', reply.text, reply.costUsd);

      await ctx.reply(reply.text);
    } catch (err) {
      console.error('Erro ao processar mensagem do Telegram:', err);
      await ctx.reply('Tive um problema para responder agora. Tente de novo em instantes.');
    }
  });

  return bot;
}

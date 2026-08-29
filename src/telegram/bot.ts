import { Telegraf } from 'telegraf';
import { askJLP } from '../core/conversation';
import { getOrCreateConversation, logMessage, updateSessionId, setState } from '../core/memory';
import { extractImageUrl } from '../core/imageReply';

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

  bot.on('location', async (ctx) => {
    const { latitude, longitude } = ctx.message.location;
    await setState('homeLocation', JSON.stringify({ lat: latitude, lon: longitude }));
    return ctx.reply('Localização atualizada. Já posso usar ela pra clima e briefing matinal.');
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

      const imageUrl = extractImageUrl(reply.text);
      if (imageUrl) {
        await ctx.replyWithPhoto(imageUrl, { caption: reply.text.slice(0, 1024) });
      } else {
        await ctx.reply(reply.text);
      }
    } catch (err) {
      console.error('Erro ao processar mensagem do Telegram:', err);
      await ctx.reply('Tive um problema para responder agora. Tente de novo em instantes.');
    }
  });

  return bot;
}

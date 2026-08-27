import { PrismaClient } from '@prisma/client';

/**
 * Memória persistente do JLP (Fase 1).
 *
 * Guarda, por canal + identificador externo (ex: chat do Telegram), qual é
 * a sessão atual do Claude Agent SDK - isso é o que sobrevive a um reinício
 * do bot. Também loga cada mensagem trocada, como base pra memória de longo
 * prazo mais robusta (Fase 7).
 */
export const prisma = new PrismaClient();

export async function getOrCreateConversation(channel: string, externalId: string) {
  return prisma.conversationSession.upsert({
    where: { channel_externalId: { channel, externalId } },
    update: {},
    create: { channel, externalId },
  });
}

export async function updateSessionId(conversationId: string, sessionId: string | null) {
  await prisma.conversationSession.update({
    where: { id: conversationId },
    data: { sessionId },
  });
}

export async function logMessage(
  conversationId: string,
  role: 'user' | 'assistant',
  content: string,
  costUsd?: number,
) {
  await prisma.message.create({
    data: { conversationId, role, content, costUsd },
  });
}

export async function getState(key: string): Promise<string | null> {
  const row = await prisma.appState.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  await prisma.appState.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

import { prisma } from './memory';

/**
 * Snapshot de todas as tabelas em JSON (Fase 8 - backup). Não usa `pg_dump`
 * de propósito - evita depender de um binário externo no container do
 * Railway; o Prisma Client já sabe ler tudo.
 */
export async function createBackupSnapshot(): Promise<string> {
  const [conversations, messages, tasks, notes, appState, memories] = await Promise.all([
    prisma.conversationSession.findMany(),
    prisma.message.findMany(),
    prisma.task.findMany(),
    prisma.note.findMany(),
    prisma.appState.findMany(),
    prisma.memory.findMany(),
  ]);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    conversationSessions: conversations,
    messages,
    tasks,
    notes,
    appState,
    memories,
  };

  return JSON.stringify(snapshot, null, 2);
}

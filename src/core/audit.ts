import { prisma } from './memory';

const SUMMARY_MAX_LENGTH = 500;

/**
 * Log de auditoria formal (Fase 8): uma linha por skill chamada, com o
 * input recebido e um resumo do resultado. Nunca deve travar a skill que
 * está sendo auditada - falha de log é engolida e só vai pro console.
 */
export async function logAudit(action: string, input: unknown, outcome: 'ok' | 'erro', summary: string): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        input: input === undefined ? null : JSON.stringify(input),
        outcome,
        summary: summary.slice(0, SUMMARY_MAX_LENGTH),
      },
    });
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
  }
}

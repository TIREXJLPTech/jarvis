import { Telegraf, Input } from 'telegraf';
import { createBackupSnapshot } from '../core/backup';
import { getState, setState } from '../core/memory';

const CHECK_INTERVAL_MS = 60_000;
const BACKUP_HOUR = 3; // horario de Brasilia (America/Sao_Paulo), fora do horario de uso

function hojeEmSaoPaulo(): { data: string; hora: number } {
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

/**
 * Backup diário (Fase 8): snapshot de todas as tabelas em JSON, mandado
 * como arquivo pro próprio José via Telegram - sem precisar de conta/
 * serviço de armazenamento novo. Mesmo padrão de "envio único por dia,
 * sobrevive a restart" do briefing matinal (`AppState.lastBackupDate`).
 */
export function startDailyBackup(bot: Telegraf, ownerChatId: string): void {
  setInterval(() => {
    (async () => {
      const { data, hora } = hojeEmSaoPaulo();
      if (hora < BACKUP_HOUR) return;

      const ultimoBackup = await getState('lastBackupDate');
      if (ultimoBackup === data) return;

      const snapshot = await createBackupSnapshot();
      const buffer = Buffer.from(snapshot, 'utf-8');

      await bot.telegram.sendDocument(ownerChatId, Input.fromBuffer(buffer, `jlp-backup-${data}.json`), {
        caption: `📦 Backup diário do JLP - ${data}`,
      });

      await setState('lastBackupDate', data);
    })().catch((err) => {
      console.error('Erro ao gerar/enviar backup diário:', err);
    });
  }, CHECK_INTERVAL_MS);
}

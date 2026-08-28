import { Telegraf } from 'telegraf';
import { listDeployStatuses } from '../core/railway';
import { searchOpenItems } from '../core/github';
import { getState, setState } from '../core/memory';

const CHECK_INTERVAL_MS = 5 * 60_000; // 5 min - eventos de dev nao sao tao urgentes quanto lembretes
const FAILED_STATUSES = new Set(['FAILED', 'CRASHED']);

const DEPLOY_STATE_KEY = 'devAlertsLastDeployStatuses';
const PR_STATE_KEY = 'devAlertsSeenPrUrls';

/**
 * Alerta quando um deploy do Railway ENTRA em estado de falha (nao repete
 * o aviso a cada checagem enquanto a falha continua). No primeiro run
 * (sem estado salvo ainda), so grava a foto atual sem alertar - senao todo
 * deploy que ja estivesse falho antes desse recurso existir dispararia
 * aviso de uma vez, misturando "evento novo" com "estado antigo".
 */
async function checarDeploys(bot: Telegraf, ownerChatId: string): Promise<void> {
  const deploys = await listDeployStatuses();
  const atual: Record<string, string> = {};
  for (const d of deploys) atual[`${d.project}::${d.service}`] = d.status;

  const anteriorRaw = await getState(DEPLOY_STATE_KEY);
  if (anteriorRaw === null) {
    await setState(DEPLOY_STATE_KEY, JSON.stringify(atual));
    return;
  }

  const anterior = JSON.parse(anteriorRaw) as Record<string, string>;
  for (const d of deploys) {
    const chave = `${d.project}::${d.service}`;
    const statusAnterior = anterior[chave];
    if (FAILED_STATUSES.has(d.status) && statusAnterior !== d.status) {
      await bot.telegram.sendMessage(ownerChatId, `⚠️ Deploy com problema: [${d.project}] ${d.service} está "${d.status}".`);
    }
  }

  await setState(DEPLOY_STATE_KEY, JSON.stringify(atual));
}

/**
 * Alerta sobre PRs abertos que ainda não tinham sido vistos. Mesmo cuidado
 * do primeiro run: só grava a foto inicial sem alertar, pra não notificar
 * sobre PRs que já estavam abertos antes desse recurso existir.
 */
async function checarPrs(bot: Telegraf, ownerChatId: string): Promise<void> {
  const { items } = await searchOpenItems('pr');
  const urlsAtuais = items.map((i) => i.html_url);

  const vistosRaw = await getState(PR_STATE_KEY);
  if (vistosRaw === null) {
    await setState(PR_STATE_KEY, JSON.stringify(urlsAtuais));
    return;
  }

  const vistos = new Set(JSON.parse(vistosRaw) as string[]);
  const novos = items.filter((i) => !vistos.has(i.html_url));
  for (const pr of novos) {
    const repo = pr.repository_url.split('/').slice(-2).join('/');
    await bot.telegram.sendMessage(ownerChatId, `🔀 PR novo em ${repo}: #${pr.number} ${pr.title}\n${pr.html_url}`);
  }

  await setState(PR_STATE_KEY, JSON.stringify(urlsAtuais));
}

/**
 * Alertas proativos de dev (Fase 5): checa a cada 5 min se algum deploy do
 * Railway entrou em estado de falha ou se surgiu um PR novo no GitHub, e
 * avisa no Telegram sem o José precisar perguntar. Falha graciosamente
 * (só loga no console) se GitHub/Railway não estiverem configurados.
 */
export function startDevAlerts(bot: Telegraf, ownerChatId: string): void {
  setInterval(async () => {
    try {
      await checarDeploys(bot, ownerChatId);
    } catch (err) {
      console.error('Erro ao checar deploys do Railway pra alerta proativo:', err);
    }
    try {
      await checarPrs(bot, ownerChatId);
    } catch (err) {
      console.error('Erro ao checar PRs do GitHub pra alerta proativo:', err);
    }
  }, CHECK_INTERVAL_MS);
}

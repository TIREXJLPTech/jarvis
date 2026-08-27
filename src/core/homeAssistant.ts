/**
 * Cliente HTTP pro Home Assistant (Fase 4) - API REST simples via fetch,
 * autenticada com um Long-Lived Access Token (gerado no próprio Home
 * Assistant: perfil do usuário → "Long-Lived Access Tokens").
 *
 * Sem SDK dedicado - a API REST do Home Assistant é estável e bem
 * documentada (https://developers.home-assistant.io/docs/api/rest/).
 */

export interface HaState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
}

function getConfig(): { url: string; token: string } {
  const url = process.env.HOME_ASSISTANT_URL;
  const token = process.env.HOME_ASSISTANT_TOKEN;

  if (!url || !token) {
    throw new Error('Home Assistant não configurado - faltam HOME_ASSISTANT_URL/HOME_ASSISTANT_TOKEN no .env.');
  }

  return { url: url.replace(/\/$/, ''), token };
}

async function haFetch(path: string, init?: RequestInit): Promise<Response> {
  const { url, token } = getConfig();
  const resp = await fetch(`${url}/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!resp.ok) {
    throw new Error(`Home Assistant respondeu ${resp.status} em ${path}`);
  }

  return resp;
}

export async function listStates(domain?: string): Promise<HaState[]> {
  const resp = await haFetch('/states');
  const states = (await resp.json()) as HaState[];
  return domain ? states.filter((s) => s.entity_id.startsWith(`${domain}.`)) : states;
}

export async function findEntity(busca: string, domain?: string): Promise<HaState | null> {
  const states = await listStates(domain);
  const termo = busca.toLowerCase();

  return (
    states.find((s) => s.entity_id.toLowerCase().includes(termo)) ??
    states.find((s) => String(s.attributes.friendly_name ?? '').toLowerCase().includes(termo)) ??
    null
  );
}

export async function callService(domain: string, service: string, entityId: string): Promise<void> {
  await haFetch(`/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
}

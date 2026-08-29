const API_BASE = 'https://pt.wikipedia.org';

export interface WikipediaImageResult {
  title: string;
  imageUrl: string;
  pageUrl: string;
  extract: string;
}

interface WikipediaSummaryResponse {
  title: string;
  extract?: string;
  originalimage?: { source: string };
  thumbnail?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

/**
 * Resolve um texto livre pro título exato de uma página da Wikipedia
 * (ex: "senna" -> "Ayrton Senna"), via API de busca (opensearch).
 */
async function resolveTitle(query: string): Promise<string | null> {
  const url = `${API_BASE}/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&namespace=0&format=json&origin=*`;
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = (await resp.json()) as [string, string[], string[], string[]];
  return data[1]?.[0] ?? null;
}

/**
 * Busca a foto principal de um assunto conhecido (pessoa pública, lugar,
 * animal, etc) via Wikipedia - gratuito, sem API key. Só funciona pra
 * assuntos com página própria na Wikipedia (não serve pra achar fotos de
 * pessoas privadas ou perfis específicos de rede social).
 */
export async function buscarFotoWikipedia(query: string): Promise<WikipediaImageResult | null> {
  const title = (await resolveTitle(query)) ?? query;
  const resp = await fetch(`${API_BASE}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  if (!resp.ok) return null;

  const data = (await resp.json()) as WikipediaSummaryResponse;
  const imageUrl = data.originalimage?.source ?? data.thumbnail?.source;
  if (!imageUrl) return null;

  return {
    title: data.title,
    imageUrl,
    pageUrl: data.content_urls?.desktop?.page ?? `${API_BASE}/wiki/${encodeURIComponent(title)}`,
    extract: data.extract ?? '',
  };
}

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getState } from '../../core/memory';

// Códigos de tempo (WMO) usados pela Open-Meteo, resumidos em pt-BR.
const DESCRICAO_POR_CODIGO: Record<number, string> = {
  0: 'céu limpo',
  1: 'poucas nuvens',
  2: 'parcialmente nublado',
  3: 'nublado',
  45: 'neblina',
  48: 'neblina com geada',
  51: 'garoa fraca',
  53: 'garoa moderada',
  55: 'garoa forte',
  61: 'chuva fraca',
  63: 'chuva moderada',
  65: 'chuva forte',
  71: 'neve fraca',
  73: 'neve moderada',
  75: 'neve forte',
  80: 'pancadas de chuva fracas',
  81: 'pancadas de chuva moderadas',
  82: 'pancadas de chuva fortes',
  95: 'trovoadas',
  96: 'trovoadas com granizo fraco',
  99: 'trovoadas com granizo forte',
};

interface GeocodingResponse {
  results?: Array<{ name: string; latitude: number; longitude: number; country: string }>;
}

interface ForecastResponse {
  current: {
    temperature_2m: number;
    relative_humidity_2m: number;
    weather_code: number;
  };
}

interface Local {
  nome: string;
  latitude: number;
  longitude: number;
}

async function resolverLocal(cidade?: string): Promise<Local | { erro: string }> {
  if (cidade) {
    const geoResp = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=1&language=pt`,
    );
    const geo = (await geoResp.json()) as GeocodingResponse;
    const encontrado = geo.results?.[0];
    if (!encontrado) return { erro: `Não encontrei a cidade "${cidade}".` };
    return { nome: `${encontrado.name}, ${encontrado.country}`, latitude: encontrado.latitude, longitude: encontrado.longitude };
  }

  const salvo = await getState('homeLocation');
  if (!salvo) {
    return {
      erro:
        'Não sei sua localização atual ainda. Peça pra José compartilhar a localização no Telegram ' +
        '(clipe/anexo → Localização), ou informe o nome de uma cidade.',
    };
  }

  const local = JSON.parse(salvo) as { lat: number; lon: number };
  return { nome: 'sua localização atual', latitude: local.lat, longitude: local.lon };
}

export const climaSkill = tool(
  'clima',
  'Consulta a previsão do tempo atual (temperatura, umidade, condição) para uma cidade. ' +
    'Se José não informar a cidade (ex: "que tempo faz aqui"), deixe o parâmetro de fora - ' +
    'a skill usa a última localização que ele compartilhou no Telegram.',
  { cidade: z.string().optional().describe('Nome da cidade. Deixe de fora para usar a localização atual de José.') },
  async ({ cidade }) => {
    const local = await resolverLocal(cidade);
    if ('erro' in local) {
      return { content: [{ type: 'text', text: local.erro }] };
    }

    const forecastResp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${local.latitude}&longitude=${local.longitude}` +
        '&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto',
    );
    const forecast = (await forecastResp.json()) as ForecastResponse;
    const descricao = DESCRICAO_POR_CODIGO[forecast.current.weather_code] ?? 'condição não mapeada';

    const texto =
      `${local.nome}: ${forecast.current.temperature_2m}°C, ${descricao}, ` +
      `umidade ${forecast.current.relative_humidity_2m}%.`;

    return { content: [{ type: 'text', text: texto }] };
  },
);

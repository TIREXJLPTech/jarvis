import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

let client: ElevenLabsClient | null = null;

export function getElevenLabsClient(): ElevenLabsClient {
  if (client) return client;

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('ElevenLabs não configurado - falta ELEVENLABS_API_KEY no .env.');
  }

  client = new ElevenLabsClient({ apiKey });
  return client;
}

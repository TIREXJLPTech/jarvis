import { google, calendar_v3 } from 'googleapis';

let cachedClient: calendar_v3.Calendar | null = null;

/**
 * Cliente autenticado do Google Calendar (Fase 2). Usa refresh token de
 * longa duração gerado uma vez via `npm run google:auth` - não expira
 * sozinho, então não há fluxo interativo em produção.
 */
export function getCalendarClient(): calendar_v3.Calendar {
  if (cachedClient) return cachedClient;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Calendar não configurado - faltam GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REFRESH_TOKEN no .env.',
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });

  cachedClient = google.calendar({ version: 'v3', auth });
  return cachedClient;
}

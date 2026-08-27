import { PublicClientApplication, Configuration } from '@azure/msal-node';
import { getState, setState } from './memory';

const CACHE_STATE_KEY = 'microsoftTokenCache';

// Mail.Read (ler e-mails) + offline_access (refresh token) + User.Read (perfil básico).
export const MICROSOFT_SCOPES = ['Mail.Read', 'offline_access', 'User.Read'];

let app: PublicClientApplication | null = null;

/**
 * App MSAL (Fase 2, Outlook pessoal). O cache de tokens é persistido no
 * Postgres via `AppState` (não em disco/env) - assim funciona igual local
 * e em produção (Railway), sem precisar copiar nada manualmente depois da
 * autorização inicial (`npm run microsoft:auth`).
 */
export function getMsalApp(): PublicClientApplication {
  if (app) return app;

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    throw new Error('Microsoft/Outlook não configurado - falta MICROSOFT_CLIENT_ID no .env.');
  }

  const config: Configuration = {
    auth: { clientId, authority: 'https://login.microsoftonline.com/consumers' },
    cache: {
      cachePlugin: {
        beforeCacheAccess: async (ctx) => {
          const cached = await getState(CACHE_STATE_KEY);
          if (cached) ctx.tokenCache.deserialize(cached);
        },
        afterCacheAccess: async (ctx) => {
          if (ctx.cacheHasChanged) {
            await setState(CACHE_STATE_KEY, ctx.tokenCache.serialize());
          }
        },
      },
    },
  };

  app = new PublicClientApplication(config);
  return app;
}

export async function getMicrosoftAccessToken(): Promise<string> {
  const msalApp = getMsalApp();
  const accounts = await msalApp.getTokenCache().getAllAccounts();

  if (accounts.length === 0) {
    throw new Error('Outlook ainda não foi autorizado - rode "npm run microsoft:auth" uma vez.');
  }

  const result = await msalApp.acquireTokenSilent({ account: accounts[0], scopes: MICROSOFT_SCOPES });
  return result.accessToken;
}

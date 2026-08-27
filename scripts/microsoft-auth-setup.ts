import 'dotenv/config';
import http from 'node:http';
import { getMsalApp, MICROSOFT_SCOPES } from '../src/core/microsoft';

/**
 * Script de uso único (Fase 2): autoriza o Outlook pessoal do José via
 * OAuth (fluxo PKCE, sem client secret). Diferente do Google, o cache de
 * token já fica salvo direto no Postgres (AppState) - nada pra copiar
 * manualmente pro .env depois.
 */

const PORT = 53683;
const redirectUri = `http://localhost:${PORT}`;

async function main() {
  const app = getMsalApp();
  const authUrl = await app.getAuthCodeUrl({ scopes: MICROSOFT_SCOPES, redirectUri });

  console.log('Abra esta URL no navegador e autorize com sua conta Microsoft pessoal:\n');
  console.log(authUrl);
  console.log(`\nAguardando autorização em ${redirectUri} ...`);

  const server = http.createServer((req, res) => {
    if (!req.url) return;
    const url = new URL(req.url, redirectUri);
    const code = url.searchParams.get('code');

    if (!code) {
      res.end('Nenhum código recebido. Feche esta aba e tente de novo.');
      return;
    }

    res.end('Autorizado! Pode fechar esta aba e voltar ao terminal.');
    server.close();

    app
      .acquireTokenByCode({ code, scopes: MICROSOFT_SCOPES, redirectUri })
      .then(() => {
        console.log('\n✅ Autorização concluída e salva no banco. Nada a copiar pro .env.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Erro ao trocar o código pelo token:', err);
        process.exit(1);
      });
  });

  server.listen(PORT);
}

main();

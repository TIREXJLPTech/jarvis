import 'dotenv/config';
import http from 'node:http';
import { google } from 'googleapis';

/**
 * Script de uso único (Fase 2): faz a autorização OAuth do Google Calendar
 * uma vez, localmente, e imprime o refresh token pra colar em
 * GOOGLE_REFRESH_TOKEN no .env / Railway. Depois disso, o JLP nunca mais
 * precisa desse fluxo interativo - o refresh token não expira sozinho.
 */

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('❌ GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET não encontrados no .env.');
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://localhost:${PORT}`;
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar'],
});

console.log('Abra esta URL no navegador e autorize com sua conta Google:\n');
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

  oauth2Client.getToken(code).then(({ tokens }) => {
    console.log('\n✅ Refresh token gerado. Cole isto em GOOGLE_REFRESH_TOKEN no .env (e no Railway):\n');
    console.log(tokens.refresh_token);
    process.exit(0);
  });
});

server.listen(PORT);

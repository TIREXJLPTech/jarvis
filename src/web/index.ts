import 'dotenv/config';
import { createJlpWebApp } from './server';

const uiToken = process.env.WEB_UI_TOKEN;
const port = Number(process.env.PORT ?? 3000);

if (!uiToken) {
  console.error('❌ WEB_UI_TOKEN não encontrado no .env.');
  console.error('Defina um valor qualquer (ex: uma senha longa) em WEB_UI_TOKEN para proteger o chat web.');
  process.exit(1);
}

const app = createJlpWebApp(uiToken);

app.listen(port, () => {
  console.log(`✅ JLP no ar na web: http://localhost:${port}`);
});

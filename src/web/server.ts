import path from 'node:path';
import express, { Express, NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { askJLP } from '../core/conversation';
import { getOrCreateConversation, logMessage, updateSessionId } from '../core/memory';
import { getElevenLabsClient } from '../core/elevenlabs';

/**
 * Canal web do JLP (Fase 1) - mesma lógica de conversa/memória do Telegram,
 * só que identificando a conversa por um `clientId` gerado no navegador
 * (guardado em localStorage) em vez de um chat id.
 *
 * Protegido por um token simples (`WEB_UI_TOKEN`), já que esse servidor pode
 * um dia rodar em algo além de localhost.
 */
export function createJlpWebApp(uiToken: string): Express {
  const app = express();
  // Necessário no Railway (atrás de proxy) pra express-rate-limit ler o IP
  // real do cliente via X-Forwarded-For, em vez do IP do proxy pra todo mundo.
  app.set('trust proxy', 1);
  app.use(express.json());

  // Rate limiting (Fase 8): protege contra força bruta no token e abuso do
  // endpoint de chat, que custa dinheiro real (chamada ao Claude).
  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false }),
  );
  const chatLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
  // Caminho a partir do cwd (raiz do projeto), não de __dirname: em produção
  // rodamos via ts-node direto (sem passo de build), então __dirname não
  // reflete a estrutura de pastas de forma confiável.
  app.use(express.static(path.join(process.cwd(), 'src', 'web', 'public')));

  const requireToken = (req: Request, res: Response, next: NextFunction) => {
    if (req.header('x-jlp-token') !== uiToken) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }
    next();
  };

  app.post('/api/chat', chatLimiter, requireToken, async (req: Request, res: Response) => {
    const { message, clientId } = req.body as { message?: string; clientId?: string };
    if (!message || !clientId) {
      res.status(400).json({ error: 'Campos "message" e "clientId" são obrigatórios.' });
      return;
    }

    try {
      const conversation = await getOrCreateConversation('web', clientId);
      const reply = await askJLP(message, conversation.sessionId ?? undefined);

      await updateSessionId(conversation.id, reply.sessionId);
      await logMessage(conversation.id, 'user', message);
      await logMessage(conversation.id, 'assistant', reply.text, reply.costUsd);

      res.json({ text: reply.text });
    } catch (err) {
      console.error('Erro ao processar mensagem do canal web:', err);
      res.status(500).json({ error: 'Tive um problema para responder agora. Tente de novo em instantes.' });
    }
  });

  app.post('/api/speak', chatLimiter, requireToken, async (req: Request, res: Response) => {
    const { text } = req.body as { text?: string };
    if (!text) {
      res.status(400).json({ error: 'Campo "text" é obrigatório.' });
      return;
    }

    try {
      const client = getElevenLabsClient();
      const voiceId = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
      const stream = await client.textToSpeech.convert(voiceId, {
        text,
        modelId: 'eleven_multilingual_v2',
        outputFormat: 'mp3_44100_128',
      });

      res.setHeader('Content-Type', 'audio/mpeg');
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (err) {
      console.error('Erro ao gerar fala (ElevenLabs):', err);
      res.status(500).json({ error: 'Não consegui gerar áudio agora.' });
    }
  });

  app.post(
    '/api/transcribe',
    chatLimiter,
    requireToken,
    express.raw({ type: '*/*', limit: '15mb' }),
    async (req: Request, res: Response) => {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        res.status(400).json({ error: 'Áudio vazio.' });
        return;
      }

      try {
        const client = getElevenLabsClient();
        const response = await client.speechToText.convert({
          modelId: 'scribe_v2',
          languageCode: 'por',
          file: { data: req.body, filename: 'gravacao.webm', contentType: req.header('content-type') ?? 'audio/webm' },
        });

        res.json({ text: 'text' in response ? response.text : '' });
      } catch (err) {
        console.error('Erro ao transcrever áudio do canal web:', err);
        res.status(500).json({ error: 'Não consegui transcrever o áudio agora.' });
      }
    },
  );

  app.post('/api/reset', requireToken, async (req: Request, res: Response) => {
    const { clientId } = req.body as { clientId?: string };
    if (!clientId) {
      res.status(400).json({ error: 'Campo "clientId" é obrigatório.' });
      return;
    }

    const conversation = await getOrCreateConversation('web', clientId);
    await updateSessionId(conversation.id, null);
    res.json({ ok: true });
  });

  return app;
}

import path from 'node:path';
import express, { Express, NextFunction, Request, Response } from 'express';
import { askJLP } from '../core/conversation';
import { getOrCreateConversation, logMessage, updateSessionId } from '../core/memory';

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
  app.use(express.json());
  app.use(express.static(path.join(__dirname, 'public')));

  const requireToken = (req: Request, res: Response, next: NextFunction) => {
    if (req.header('x-jlp-token') !== uiToken) {
      res.status(401).json({ error: 'Token inválido.' });
      return;
    }
    next();
  };

  app.post('/api/chat', requireToken, async (req: Request, res: Response) => {
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

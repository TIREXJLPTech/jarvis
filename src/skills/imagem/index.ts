import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { buscarFotoWikipedia } from '../../core/wikipedia';

export const buscarFotoSkill = tool(
  'buscar_foto',
  'Busca a foto principal de uma pessoa pública, lugar, animal ou coisa conhecida, via Wikipedia (gratuito, sem necessidade de API key). Retorna a URL direta da imagem - inclua essa URL completa na sua resposta pra o canal poder exibir a foto de verdade. Só funciona pra assuntos com página própria na Wikipedia; não serve pra achar fotos de pessoas privadas ou perfis específicos de rede social.',
  { assunto: z.string().describe('O que buscar uma foto, ex: "Ayrton Senna"') },
  async ({ assunto }) => {
    try {
      const resultado = await buscarFotoWikipedia(assunto);
      if (!resultado) {
        return { content: [{ type: 'text', text: `Não encontrei uma foto pra "${assunto}" na Wikipedia.` }] };
      }
      const texto = `${resultado.title}: ${resultado.imageUrl}\n\n${resultado.extract}\n\nFonte: ${resultado.pageUrl}`;
      return { content: [{ type: 'text', text: texto }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui buscar a foto agora: ${(err as Error).message}` }] };
    }
  },
);

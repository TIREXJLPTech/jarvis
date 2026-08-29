// Reconhece uma URL de imagem direta dentro de um texto de resposta - usado
// pelos canais (Telegram, web) pra decidir se mandam a imagem de verdade em
// vez de só o texto com o link. Convenção simples: a persona instrui o JLP a
// sempre incluir a URL completa quando mencionar uma imagem/foto.
const IMAGE_URL_REGEX = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp)(?:\?\S*)?/i;

export function extractImageUrl(text: string): string | null {
  const match = text.match(IMAGE_URL_REGEX);
  return match ? match[0] : null;
}

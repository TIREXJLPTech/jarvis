import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { prisma } from '../../core/memory';

function formatarData(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(d);
}

function formatarReal(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Início/fim (exclusivo) do mês informado ("YYYY-MM") ou do mês atual. */
function inicioFimMes(mes?: string): { inicio: Date; fim: Date } {
  const agora = new Date();
  let ano = agora.getFullYear();
  let mesIndex = agora.getMonth();

  if (mes) {
    const [y, m] = mes.split('-').map(Number);
    if (y && m) {
      ano = y;
      mesIndex = m - 1;
    }
  }

  return { inicio: new Date(ano, mesIndex, 1), fim: new Date(ano, mesIndex + 1, 1) };
}

export const registrarGastoSkill = tool(
  'registrar_gasto',
  'Registra um gasto/compra de José: valor, o que foi, categoria e forma de pagamento. ' +
    'É um registro manual (José informa cada gasto por texto) - não é importado automaticamente de banco.',
  {
    descricao: z.string().describe('O que foi comprado/pago'),
    valor: z.number().describe('Valor em reais'),
    categoria: z.string().optional().describe('Categoria, ex: "mercado", "transporte", "lazer", "contas"'),
    formaPagamento: z.string().optional().describe('Ex: "Cartão Nubank", "Pix", "Dinheiro", "Cartão Itaú"'),
    data: z.string().optional().describe('Data da compra em ISO 8601. Padrão: agora.'),
  },
  async ({ descricao, valor, categoria, formaPagamento, data }) => {
    await prisma.expense.create({
      data: {
        description: descricao,
        amount: valor,
        category: categoria,
        paymentMethod: formaPagamento,
        purchasedAt: data ? new Date(data) : new Date(),
      },
    });
    return { content: [{ type: 'text', text: `Gasto registrado: ${descricao} - ${formatarReal(valor)}` }] };
  },
);

export const listarGastosSkill = tool(
  'listar_gastos',
  'Lista os gastos registrados de José, com total. Filtra por mês (padrão: mês atual) e opcionalmente por categoria.',
  {
    mes: z.string().optional().describe('Mês no formato "YYYY-MM". Padrão: mês atual.'),
    categoria: z.string().optional().describe('Filtra por categoria'),
  },
  async ({ mes, categoria }) => {
    const { inicio, fim } = inicioFimMes(mes);
    const gastos = await prisma.expense.findMany({
      where: {
        purchasedAt: { gte: inicio, lt: fim },
        ...(categoria ? { category: { contains: categoria, mode: 'insensitive' } } : {}),
      },
      orderBy: { purchasedAt: 'desc' },
    });

    if (gastos.length === 0) {
      return { content: [{ type: 'text', text: 'Nenhum gasto registrado nesse período.' }] };
    }

    const total = gastos.reduce((soma, g) => soma + g.amount, 0);
    const linhas = gastos.map((g) => {
      const extras = [g.category, g.paymentMethod].filter(Boolean).join(', ');
      return `- ${formatarData(g.purchasedAt)}: ${g.description} - ${formatarReal(g.amount)}${extras ? ` (${extras})` : ''}`;
    });

    return { content: [{ type: 'text', text: `${linhas.join('\n')}\n\nTotal: ${formatarReal(total)}` }] };
  },
);

export const resumoGastosSkill = tool(
  'resumo_gastos',
  'Resume os gastos de José por categoria num período (padrão: mês atual), com total geral.',
  { mes: z.string().optional().describe('Mês no formato "YYYY-MM". Padrão: mês atual.') },
  async ({ mes }) => {
    const { inicio, fim } = inicioFimMes(mes);
    const gastos = await prisma.expense.findMany({ where: { purchasedAt: { gte: inicio, lt: fim } } });

    if (gastos.length === 0) {
      return { content: [{ type: 'text', text: 'Nenhum gasto registrado nesse período.' }] };
    }

    const porCategoria = new Map<string, number>();
    let total = 0;
    for (const g of gastos) {
      const categoria = g.category ?? 'sem categoria';
      porCategoria.set(categoria, (porCategoria.get(categoria) ?? 0) + g.amount);
      total += g.amount;
    }

    const linhas = [...porCategoria.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([categoria, valor]) => `- ${categoria}: ${formatarReal(valor)}`);

    return { content: [{ type: 'text', text: `${linhas.join('\n')}\n\nTotal: ${formatarReal(total)}` }] };
  },
);

export const definirLimiteCartaoSkill = tool(
  'definir_limite_cartao',
  'Define ou atualiza o limite total de um cartão de crédito de José.',
  {
    cartao: z.string().describe('Nome do cartão, ex: "Nubank"'),
    limite: z.number().describe('Limite total em reais'),
  },
  async ({ cartao, limite }) => {
    await prisma.creditCard.upsert({
      where: { name: cartao },
      update: { limit: limite },
      create: { name: cartao, limit: limite },
    });
    return { content: [{ type: 'text', text: `Limite do cartão ${cartao} definido em ${formatarReal(limite)}.` }] };
  },
);

export const limiteDisponivelSkill = tool(
  'limite_disponivel',
  'Estima quanto ainda resta do limite de um cartão, com base nos gastos registrados no mês atual pra ' +
    'esse cartão. É uma aproximação - não considera data de fechamento de fatura.',
  { cartao: z.string().describe('Nome do cartão, ex: "Nubank"') },
  async ({ cartao }) => {
    const card = await prisma.creditCard.findFirst({ where: { name: { contains: cartao, mode: 'insensitive' } } });
    if (!card) {
      return {
        content: [{ type: 'text', text: `Não tenho limite cadastrado pro cartão "${cartao}". Use "definir_limite_cartao" primeiro.` }],
      };
    }

    const { inicio, fim } = inicioFimMes();
    const gastos = await prisma.expense.findMany({
      where: { purchasedAt: { gte: inicio, lt: fim }, paymentMethod: { contains: card.name, mode: 'insensitive' } },
    });
    const gasto = gastos.reduce((soma, g) => soma + g.amount, 0);
    const disponivel = card.limit - gasto;

    return {
      content: [
        {
          type: 'text',
          text:
            `Cartão ${card.name}: limite ${formatarReal(card.limit)}, gasto esse mês ${formatarReal(gasto)}, ` +
            `disponível ~${formatarReal(disponivel)} (estimativa, sem considerar fechamento de fatura).`,
        },
      ],
    };
  },
);

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { listStates, findEntity, callService, type HaState } from '../../core/homeAssistant';

function formatarDispositivo(s: HaState): string {
  const nome = s.attributes.friendly_name ?? s.entity_id;
  return `- ${nome} (${s.entity_id}): ${s.state}`;
}

export const listarDispositivosSkill = tool(
  'listar_dispositivos',
  'Lista os dispositivos da casa conectados ao Home Assistant e seu estado atual ' +
    '(ligado/desligado, temperatura, etc). Pode filtrar por tipo: "light" (luzes), ' +
    '"switch" (tomadas), "sensor" (sensores), "binary_sensor" (portas/presença). ' +
    'Sem filtro, lista tudo.',
  { tipo: z.string().optional().describe('Domínio do Home Assistant pra filtrar, ex: "light", "switch", "sensor"') },
  async ({ tipo }) => {
    try {
      const states = await listStates(tipo);
      if (states.length === 0) {
        return { content: [{ type: 'text', text: 'Nenhum dispositivo encontrado.' }] };
      }
      return { content: [{ type: 'text', text: states.map(formatarDispositivo).join('\n') }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui falar com a casa: ${(err as Error).message}` }] };
    }
  },
);

export const controlarDispositivoSkill = tool(
  'controlar_dispositivo',
  'Liga, desliga ou alterna um dispositivo da casa (luz, tomada, etc) pelo nome.',
  {
    dispositivo: z.string().describe('Nome ou parte do nome do dispositivo, ex: "luz da sala"'),
    acao: z.enum(['ligar', 'desligar', 'alternar']),
  },
  async ({ dispositivo, acao }) => {
    try {
      const entidade = await findEntity(dispositivo);
      if (!entidade) {
        return { content: [{ type: 'text', text: `Não encontrei nenhum dispositivo com "${dispositivo}".` }] };
      }

      const dominio = entidade.entity_id.split('.')[0];
      const servico = acao === 'ligar' ? 'turn_on' : acao === 'desligar' ? 'turn_off' : 'toggle';

      await callService(dominio, servico, entidade.entity_id);

      const nome = entidade.attributes.friendly_name ?? entidade.entity_id;
      return { content: [{ type: 'text', text: `Feito: ${nome} - ${acao}.` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Não consegui controlar o dispositivo: ${(err as Error).message}` }] };
    }
  },
);

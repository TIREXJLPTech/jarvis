import { createSdkMcpServer, type SdkMcpToolDefinition } from '@anthropic-ai/claude-agent-sdk';
import { logAudit } from '../core/audit';
import { horaSkill } from './hora';
import { climaSkill } from './clima';
import { criarLembreteSkill, listarLembretesSkill, concluirLembreteSkill } from './lembretes';
import { criarNotaSkill, listarNotasSkill } from './notas';
import { criarEventoSkill, listarEventosSkill } from './calendario';
import { listarEmailsSkill } from './email';
import { listarDispositivosSkill, controlarDispositivoSkill } from './casa';
import { listarRepositoriosSkill, listarPrsSkill, listarIssuesSkill, listarCommitsSkill, listarDeploysSkill } from './dev';
import { rodarScriptSkill } from './dev/scripts';
import { buscarFotoSkill } from './imagem';
import { lembrarSkill, buscarMemoriasSkill } from './memoria';
import { resumoCustosSkill } from './custos';
import { registrarGastoSkill, listarGastosSkill, resumoGastosSkill, definirLimiteCartaoSkill, limiteDisponivelSkill } from './financas';
import {
  criarProjetoSkill,
  listarProjetosSkill,
  adicionarTarefaProjetoSkill,
  listarTarefasProjetoSkill,
  atualizarStatusTarefaSkill,
  resumoProjetoSkill,
} from './projetos';

const SERVER_NAME = 'jlp-skills';

const skills = [
  horaSkill,
  climaSkill,
  criarLembreteSkill,
  listarLembretesSkill,
  concluirLembreteSkill,
  criarNotaSkill,
  listarNotasSkill,
  criarEventoSkill,
  listarEventosSkill,
  listarEmailsSkill,
  listarDispositivosSkill,
  controlarDispositivoSkill,
  listarRepositoriosSkill,
  listarPrsSkill,
  listarIssuesSkill,
  listarCommitsSkill,
  listarDeploysSkill,
  rodarScriptSkill,
  buscarFotoSkill,
  lembrarSkill,
  buscarMemoriasSkill,
  resumoCustosSkill,
  registrarGastoSkill,
  listarGastosSkill,
  resumoGastosSkill,
  definirLimiteCartaoSkill,
  limiteDisponivelSkill,
  criarProjetoSkill,
  listarProjetosSkill,
  adicionarTarefaProjetoSkill,
  listarTarefasProjetoSkill,
  atualizarStatusTarefaSkill,
  resumoProjetoSkill,
];

function textoDoResultado(result: { content: Array<{ type: string; text?: string }> }): string {
  const bloco = result.content[0];
  return bloco && bloco.type === 'text' && bloco.text ? bloco.text : '';
}

/**
 * Envolve o handler de cada skill com um log de auditoria formal (Fase 8):
 * uma linha em `AuditLog` por chamada, com o input recebido e um resumo do
 * resultado. Nunca deve mudar o comportamento da skill em si - se o log
 * falhar, isso é engolido dentro de `logAudit` e não afeta a resposta.
 */
function comAuditoria(skill: SdkMcpToolDefinition<any>): SdkMcpToolDefinition<any> {
  return {
    ...skill,
    handler: async (args, extra) => {
      try {
        const result = await skill.handler(args, extra);
        await logAudit(skill.name, args, 'ok', textoDoResultado(result));
        return result;
      } catch (err) {
        await logAudit(skill.name, args, 'erro', (err as Error).message);
        throw err;
      }
    },
  };
}

const skillsComAuditoria = skills.map(comAuditoria);

/**
 * Registra todas as skills como um único MCP server em processo, exposto ao
 * Claude Agent SDK via `mcpServers` nas opções da conversa.
 */
export const skillsMcpServers = {
  [SERVER_NAME]: createSdkMcpServer({
    name: SERVER_NAME,
    tools: skillsComAuditoria,
  }),
};

// Nomes de tool no formato que o Agent SDK espera (`mcp__<server>__<tool>`),
// usados para liberar as skills em `options.tools` junto dos built-ins.
export const skillsToolNames = skills.map((skill) => `mcp__${SERVER_NAME}__${skill.name}`);

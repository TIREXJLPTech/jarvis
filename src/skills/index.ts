import { createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { horaSkill } from './hora';
import { climaSkill } from './clima';
import { criarLembreteSkill, listarLembretesSkill, concluirLembreteSkill } from './lembretes';
import { criarNotaSkill, listarNotasSkill } from './notas';

const SERVER_NAME = 'jlp-skills';

const skills = [
  horaSkill,
  climaSkill,
  criarLembreteSkill,
  listarLembretesSkill,
  concluirLembreteSkill,
  criarNotaSkill,
  listarNotasSkill,
];

/**
 * Registra todas as skills como um único MCP server em processo, exposto ao
 * Claude Agent SDK via `mcpServers` nas opções da conversa.
 */
export const skillsMcpServers = {
  [SERVER_NAME]: createSdkMcpServer({
    name: SERVER_NAME,
    tools: skills,
  }),
};

// Nomes de tool no formato que o Agent SDK espera (`mcp__<server>__<tool>`),
// usados para liberar as skills em `options.tools` junto dos built-ins.
export const skillsToolNames = skills.map((skill) => `mcp__${SERVER_NAME}__${skill.name}`);

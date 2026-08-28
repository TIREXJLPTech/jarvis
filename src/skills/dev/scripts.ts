import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const OUTPUT_MAX_LENGTH = 3000;
const TIMEOUT_MS = 60_000;

/**
 * Lista fixa de scripts que o JLP pode rodar - nunca comando arbitrário.
 * Cada entrada é um comando + argumentos literais, sem interpolação de
 * texto vindo do modelo ou do José: a "permissão explícita" pedida no
 * blueprint (Fase 5) já foi dada aqui no código, na hora de decidir o que
 * entra nessa lista - o JLP só escolhe QUAL script pré-aprovado rodar,
 * nunca o quê rodar. Mantém a regra "JLP é gerente, não executor" intacta
 * pra tudo que não estiver nesta lista (ver persona.ts).
 */
const ALLOWED_SCRIPTS: Record<string, { command: string; args: string[]; description: string }> = {
  typecheck: { command: 'npm', args: ['run', 'typecheck'], description: 'Verifica erros de tipo TypeScript no projeto' },
  build: { command: 'npm', args: ['run', 'build'], description: 'Compila o projeto TypeScript pra dist/' },
  git_status: { command: 'git', args: ['status', '--short'], description: 'Mostra arquivos alterados/não commitados no repositório' },
};

const scriptNames = Object.keys(ALLOWED_SCRIPTS) as [string, ...string[]];

export const rodarScriptSkill = tool(
  'rodar_script',
  `Roda um script local pré-aprovado pra checar o estado do projeto. Só aceita os nomes desta lista fixa (nunca comando arbitrário): ${Object.entries(
    ALLOWED_SCRIPTS,
  )
    .map(([nome, s]) => `"${nome}" (${s.description})`)
    .join(', ')}.`,
  { script: z.enum(scriptNames).describe('Nome do script pré-aprovado a rodar') },
  async ({ script }) => {
    const config = ALLOWED_SCRIPTS[script];
    try {
      const { stdout, stderr } = await execFileAsync(config.command, config.args, {
        cwd: process.cwd(),
        timeout: TIMEOUT_MS,
        shell: true,
      });
      const saida = (stdout + (stderr ? `\n${stderr}` : '')).trim() || '(sem saída)';
      return { content: [{ type: 'text', text: `"${script}" rodou com sucesso:\n${saida.slice(0, OUTPUT_MAX_LENGTH)}` }] };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message: string };
      const saida = ((e.stdout ?? '') + (e.stderr ? `\n${e.stderr}` : '')).trim() || e.message;
      return { content: [{ type: 'text', text: `"${script}" falhou:\n${saida.slice(0, OUTPUT_MAX_LENGTH)}` }] };
    }
  },
);

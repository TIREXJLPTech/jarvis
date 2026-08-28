import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync, spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Writable, Readable } from 'node:stream';
import { Porcupine, BuiltinKeyword } from '@picovoice/porcupine-node';
import { PvRecorder } from '@picovoice/pvrecorder-node';
import { getElevenLabsClient } from '../core/elevenlabs';
import { askJLP } from '../core/conversation';
import { getOrCreateConversation, logMessage, updateSessionId } from '../core/memory';
import { pcmToWav, int16FramesToBuffer } from './wav';

/**
 * Camada de voz local (Fase 3). Três formas de acionar a gravação:
 *
 * - Wake word "Jarvis" via Picovoice Porcupine, se PICOVOICE_ACCESS_KEY
 *   estiver configurado - só ficou de exemplo/legado: a Picovoice negou de
 *   vez o trial gratuito (2026-08-27), então esse caminho não funciona na
 *   prática a menos que pague o Picovoice.
 * - Wake word "hey jarvis" via openWakeWord (WAKE_WORD_ENGINE=openwakeword)
 *   - alternativa gratuita: um processo Python (scripts/wake_word/detect.py)
 *   roda o modelo pré-treinado "hey_jarvis" e avisa este processo via
 *   stdout quando detecta. Ver OpenWakeWordBridge abaixo.
 * - Push-to-talk (aperta Enter), se nenhum dos dois acima estiver
 *   configurado - fallback original. Só muda o "gatilho"; STT, núcleo
 *   conversacional e TTS são os mesmos nos três modos.
 *
 * Depois disso: transcreve (ElevenLabs Scribe), manda pro mesmo núcleo
 * conversacional das outras interfaces (askJLP), e fala a resposta
 * (ElevenLabs TTS). Roda só localmente (precisa de microfone/alto-falante) -
 * não faz parte do deploy no Railway.
 */

const ACCESS_KEY = process.env.PICOVOICE_ACCESS_KEY;
const WAKE_WORD_ENGINE = process.env.WAKE_WORD_ENGINE; // 'openwakeword' | undefined
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel (padrão ElevenLabs)
const TTS_SAMPLE_RATE = 16000;
const DEFAULT_FRAME_LENGTH = 512;

const CHANNEL = 'voice';
const LOCAL_EXTERNAL_ID = 'local';

const SILENCE_RMS_THRESHOLD = 400;
const SILENCE_FRAMES_TO_STOP = 45; // ~1.4s de silêncio depois de ouvir fala
const MAX_RECORD_FRAMES = 300; // ~9.6s de gravação máxima

function frameRms(frame: Int16Array): number {
  let sum = 0;
  for (const sample of frame) sum += sample * sample;
  return Math.sqrt(sum / frame.length);
}

async function transcrever(wavBuffer: Buffer): Promise<string> {
  const client = getElevenLabsClient();
  const response = await client.speechToText.convert({
    modelId: 'scribe_v2',
    languageCode: 'por',
    file: { data: wavBuffer, filename: 'audio.wav', contentType: 'audio/wav' },
  });

  return 'text' in response ? response.text : '';
}

async function falar(texto: string): Promise<void> {
  const client = getElevenLabsClient();
  const stream = await client.textToSpeech.convert(VOICE_ID, {
    text: texto,
    modelId: 'eleven_multilingual_v2',
    outputFormat: `pcm_${TTS_SAMPLE_RATE}` as const,
  });

  const chunks: Buffer[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(Buffer.from(value));
  }

  const wav = pcmToWav(Buffer.concat(chunks), TTS_SAMPLE_RATE);
  const tempFile = path.join(os.tmpdir(), `jlp-voice-${Date.now()}.wav`);
  fs.writeFileSync(tempFile, wav);

  try {
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `(New-Object Media.SoundPlayer '${tempFile}').PlaySync()`,
    ]);
  } finally {
    fs.unlinkSync(tempFile);
  }
}

/**
 * Ponte com o processo Python que roda o openWakeWord (scripts/wake_word/detect.py).
 * Este processo não tem microfone próprio - o Node grava (via PvRecorder,
 * já usado pros outros dois modos) e alimenta cada quadro pro stdin do
 * Python; quando o Python detecta "hey jarvis", ele imprime "WAKE" em
 * stdout, e essa classe só guarda essa flag pra o loop de escuta consumir.
 */
class OpenWakeWordBridge {
  private readonly proc: ChildProcessByStdio<Writable, Readable, null>;
  private woken = false;

  constructor(pythonPath: string, scriptPath: string) {
    this.proc = spawn(pythonPath, [scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] });
    this.proc.on('error', (err) => {
      console.error('❌ Não consegui iniciar o processo Python do openWakeWord:', err.message);
      console.error('   Confira se o Python está instalado e as dependências de scripts/wake_word/requirements.txt.');
    });

    const rl = readline.createInterface({ input: this.proc.stdout });
    rl.on('line', (line) => {
      if (line.trim() === 'WAKE') this.woken = true;
    });
  }

  feed(frame: Int16Array): void {
    this.proc.stdin.write(Buffer.from(frame.buffer, frame.byteOffset, frame.byteLength));
  }

  /** Consome o estado de "acordado" - true só na primeira checagem depois da detecção. */
  consumeWake(): boolean {
    if (!this.woken) return false;
    this.woken = false;
    return true;
  }

  dispose(): void {
    this.proc.kill();
  }
}

async function main() {
  const usandoPorcupine = Boolean(ACCESS_KEY);
  const usandoOpenWakeWord = !usandoPorcupine && WAKE_WORD_ENGINE === 'openwakeword';
  const usandoWakeWord = usandoPorcupine || usandoOpenWakeWord;

  const porcupine = usandoPorcupine ? new Porcupine(ACCESS_KEY!, [BuiltinKeyword.JARVIS], [0.6]) : null;
  const wakeBridge = usandoOpenWakeWord
    ? new OpenWakeWordBridge(PYTHON_PATH, path.join(process.cwd(), 'scripts', 'wake_word', 'detect.py'))
    : null;
  const frameLength = porcupine?.frameLength ?? DEFAULT_FRAME_LENGTH;

  const recorder = new PvRecorder(frameLength);
  recorder.start();

  const rl = usandoWakeWord ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

  if (usandoPorcupine) {
    console.log('✅ JLP ouvindo. Diga "Jarvis" pra começar. Ctrl+C pra encerrar.');
  } else if (usandoOpenWakeWord) {
    console.log('✅ JLP ouvindo (openWakeWord). Diga "Hey Jarvis" pra começar. Ctrl+C pra encerrar.');
  } else {
    console.log('✅ JLP em modo push-to-talk (nenhum wake word configurado).');
    console.log('   Aperte Enter, fale, e espere o silêncio. Ctrl+C pra encerrar.');
  }

  process.once('SIGINT', () => {
    wakeBridge?.dispose();
    process.exit(0);
  });

  const conversation = await getOrCreateConversation(CHANNEL, LOCAL_EXTERNAL_ID);
  let sessionId = conversation.sessionId ?? undefined;

  async function aguardarGatilho(): Promise<void> {
    if (porcupine) {
      for (;;) {
        const frame = await recorder.read();
        if (porcupine.process(frame) !== -1) return;
      }
    }
    if (wakeBridge) {
      for (;;) {
        const frame = await recorder.read();
        wakeBridge.feed(frame);
        if (wakeBridge.consumeWake()) return;
      }
    }
    await new Promise<void>((resolve) => rl!.question('\n(Enter pra falar) ', () => resolve()));
  }

  for (;;) {
    await aguardarGatilho();
    console.log('🎤 Pode falar.');

    const recordedFrames: Int16Array[] = [];
    let silentFrames = 0;
    let heardSpeech = false;

    for (let i = 0; i < MAX_RECORD_FRAMES; i++) {
      const f = await recorder.read();
      recordedFrames.push(f);

      if (frameRms(f) > SILENCE_RMS_THRESHOLD) {
        heardSpeech = true;
        silentFrames = 0;
      } else if (heardSpeech) {
        silentFrames++;
        if (silentFrames > SILENCE_FRAMES_TO_STOP) break;
      }
    }

    if (!heardSpeech) {
      console.log('Não ouvi nada, voltando a escutar.');
      continue;
    }

    try {
      const wavBuffer = pcmToWav(int16FramesToBuffer(recordedFrames), recorder.sampleRate);
      const texto = await transcrever(wavBuffer);

      if (!texto.trim()) {
        console.log('Transcrição vazia, ignorando.');
        continue;
      }

      console.log(`Você: ${texto}`);

      const reply = await askJLP(texto, sessionId);
      sessionId = reply.sessionId;

      await updateSessionId(conversation.id, reply.sessionId);
      await logMessage(conversation.id, 'user', texto);
      await logMessage(conversation.id, 'assistant', reply.text, reply.costUsd);

      console.log(`JLP: ${reply.text}`);
      await falar(reply.text);
    } catch (err) {
      console.error('Erro no ciclo de voz:', err);
    }
  }
}

main();

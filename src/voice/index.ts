import 'dotenv/config';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { Porcupine, BuiltinKeyword } from '@picovoice/porcupine-node';
import { PvRecorder } from '@picovoice/pvrecorder-node';
import { getElevenLabsClient } from '../core/elevenlabs';
import { askJLP } from '../core/conversation';
import { getOrCreateConversation, logMessage, updateSessionId } from '../core/memory';
import { pcmToWav, int16FramesToBuffer } from './wav';

/**
 * Camada de voz local (Fase 3). Duas formas de acionar a gravação:
 *
 * - Wake word "Jarvis" (Picovoice Porcupine), se PICOVOICE_ACCESS_KEY estiver
 *   configurado - modo final, sem teclado.
 * - Push-to-talk (aperta Enter), se não estiver - fallback pra não travar o
 *   desenvolvimento enquanto uma conta do Picovoice aguarda aprovação. Só
 *   muda o "gatilho"; STT, núcleo conversacional e TTS são os mesmos.
 *
 * Depois disso: transcreve (ElevenLabs Scribe), manda pro mesmo núcleo
 * conversacional das outras interfaces (askJLP), e fala a resposta
 * (ElevenLabs TTS). Roda só localmente (precisa de microfone/alto-falante) -
 * não faz parte do deploy no Railway.
 */

const ACCESS_KEY = process.env.PICOVOICE_ACCESS_KEY;
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

async function main() {
  const usandoWakeWord = Boolean(ACCESS_KEY);
  const porcupine = usandoWakeWord ? new Porcupine(ACCESS_KEY!, [BuiltinKeyword.JARVIS], [0.6]) : null;
  const frameLength = porcupine?.frameLength ?? DEFAULT_FRAME_LENGTH;

  const recorder = new PvRecorder(frameLength);
  recorder.start();

  const rl = usandoWakeWord ? null : readline.createInterface({ input: process.stdin, output: process.stdout });

  if (usandoWakeWord) {
    console.log('✅ JLP ouvindo. Diga "Jarvis" pra começar. Ctrl+C pra encerrar.');
  } else {
    console.log('✅ JLP em modo push-to-talk (sem PICOVOICE_ACCESS_KEY configurado).');
    console.log('   Aperte Enter, fale, e espere o silêncio. Ctrl+C pra encerrar.');
  }

  const conversation = await getOrCreateConversation(CHANNEL, LOCAL_EXTERNAL_ID);
  let sessionId = conversation.sessionId ?? undefined;

  async function aguardarGatilho(): Promise<void> {
    if (porcupine) {
      for (;;) {
        const frame = await recorder.read();
        if (porcupine.process(frame) !== -1) return;
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

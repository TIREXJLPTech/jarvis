/**
 * Empacota PCM cru (16-bit signed, little-endian) num arquivo WAV -
 * usado tanto pro áudio gravado do microfone (STT) quanto pro áudio
 * recebido da ElevenLabs em formato `pcm_*` (TTS).
 */
export function pcmToWav(pcm: Buffer, sampleRate: number, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}

export function int16FramesToBuffer(frames: Int16Array[]): Buffer {
  const total = frames.reduce((acc, f) => acc + f.length, 0);
  const merged = new Int16Array(total);
  let offset = 0;
  for (const f of frames) {
    merged.set(f, offset);
    offset += f.length;
  }
  return Buffer.from(merged.buffer, merged.byteOffset, merged.byteLength);
}

/* Run hand-recorded WAVs through the same post-processing the generated speech
 * gets: trim leading/trailing silence, peak-normalize to the common level,
 * fade the edges. Without this a recorded clip sits at a different volume than
 * every TTS line and starts with dead air, which in game reads as lag.
 *
 * Rewrites each file in place (16-bit PCM mono).
 * Run: node scripts/polish-wav.mjs public/audio/local-win-1.wav [...] */
import fs from 'node:fs';
import { polish, writeWav16 } from './audio-util.mjs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('usage: node scripts/polish-wav.mjs <file.wav> [...]');
  process.exit(1);
}

/* Minimal RIFF reader: walks the chunk list rather than assuming data starts at
 * byte 44 - a recorder that writes a LIST/INFO chunk breaks that assumption and
 * the clip decodes as noise. */
function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('not a RIFF/WAVE file');
  }
  let pos = 12;
  let rate = null, channels = 1, bits = 16, data = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === 'fmt ') {
      channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      bits = buf.readUInt16LE(body + 14);
    } else if (id === 'data') {
      data = buf.subarray(body, Math.min(body + size, buf.length));
    }
    pos = body + size + (size % 2);   // chunks are word-aligned
  }
  if (!rate || !data) throw new Error('missing fmt or data chunk');
  if (bits !== 16) throw new Error(`only 16-bit PCM supported, got ${bits}`);

  /* Mixed down to mono: the game plays every phrase through one gain node and a
   * stereo clip would only differ in width, never usefully. */
  const frames = Math.floor(data.length / 2 / channels);
  const out = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += data.readInt16LE((i * channels + c) * 2) / 32768;
    out[i] = sum / channels;
  }
  return { samples: out, rate };
}

for (const file of files) {
  const { samples, rate } = readWav(fs.readFileSync(file));
  const done = polish(samples, rate);
  writeWav16(file, done, rate);
  console.log(`${file}  ${(samples.length / rate).toFixed(2)}s -> ${(done.length / rate).toFixed(2)}s`);
}

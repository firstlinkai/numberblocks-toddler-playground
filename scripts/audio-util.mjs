/* Shared post-processing for generated speech.
 *
 * Raw Kokoro output wraps ~0.4s of lead silence and ~0.6s of trail silence
 * around the actual words, and its peak level drifts ~2:1 between phrases.
 * In game that reads as lag and flatness: a tap produces nothing for 400ms,
 * and counting lands behind the animation it is supposed to sync with.
 *
 * trimSilence + normalize fix both. writeWav16 then stores plain 16-bit PCM
 * (half the size of float32, and decodable everywhere). */

import fs from 'node:fs';

/* Drop leading/trailing near-silence, keeping a short pad so the word does
 * not start abruptly. Threshold is relative to the clip's own peak so a quiet
 * phrase is not trimmed into its own consonants. */
export function trimSilence(samples, rate, { thresholdRatio = 0.02, padMs = 25 } = {}) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  if (peak === 0) return samples;

  const thr = peak * thresholdRatio;
  let s = 0;
  while (s < samples.length && Math.abs(samples[s]) < thr) s++;
  let e = samples.length - 1;
  while (e > s && Math.abs(samples[e]) < thr) e--;

  const pad = Math.round((padMs / 1000) * rate);
  s = Math.max(0, s - pad);
  e = Math.min(samples.length - 1, e + pad);
  return samples.slice(s, e + 1);
}

/* Peak-normalize to a fixed target so every phrase lands at the same loudness.
 * 0.89 leaves headroom: samples are mixed with synthesized SFX at playback. */
export function normalize(samples, target = 0.89) {
  let peak = 0;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.abs(samples[i]);
    if (v > peak) peak = v;
  }
  if (peak === 0) return samples;
  const g = target / peak;
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i] * g;
  return out;
}

/* Short linear fades kill the click that a hard cut at a non-zero sample
 * makes - audible as a tick on every spoken number. */
export function fadeEdges(samples, rate, ms = 8) {
  const n = Math.min(Math.round((ms / 1000) * rate), Math.floor(samples.length / 2));
  if (n <= 0) return samples;
  const out = Float32Array.from(samples);
  for (let i = 0; i < n; i++) {
    const g = i / n;
    out[i] *= g;
    out[out.length - 1 - i] *= g;
  }
  return out;
}

/* Minimal 16-bit mono PCM WAV writer (no dependencies) */
export function writeWav16(file, samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);   // PCM
  buf.writeUInt16LE(1, 22);   // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  fs.writeFileSync(file, buf);
}

/* Resample by `factor` using linear interpolation: the clip gets `factor` times
 * shorter and `factor` times higher in pitch. Kokoro has no emotion control, so
 * this is how a line is made to sound excited - genuinely excited speech sits
 * higher and moves faster, and the generator compensates the duration through
 * the model's own speed setting so only the pitch actually shifts.
 *
 * Linear interpolation aliases a little when pitching up, but speech energy at
 * 24kHz sits well below Nyquist and the factors used here are small (<1.2), so
 * it stays inaudible. Anything more aggressive would want a windowed resampler. */
export function resample(samples, factor) {
  if (!factor || Math.abs(factor - 1) < 1e-6) return samples;
  const outLen = Math.max(1, Math.round(samples.length / factor));
  const out = new Float32Array(outLen);
  const last = samples.length - 1;
  for (let i = 0; i < outLen; i++) {
    const src = i * factor;
    const i0 = Math.min(last, Math.floor(src));
    const i1 = Math.min(last, i0 + 1);
    const t = src - i0;
    out[i] = samples[i0] * (1 - t) + samples[i1] * t;
  }
  return out;
}

/* trim -> pitch -> normalize -> fade, the order the game wants.
 * Pitch before normalize so the shift cannot push the clip over full scale. */
export function polish(samples, rate, { pitch = 1 } = {}) {
  return fadeEdges(normalize(resample(trimSilence(samples, rate), pitch)), rate);
}

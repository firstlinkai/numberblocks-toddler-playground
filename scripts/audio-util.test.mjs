/* Self-check for the speech post-processing.
 * Run: node scripts/audio-util.test.mjs */
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { trimSilence, normalize, fadeEdges, writeWav16, polish, resample } from './audio-util.mjs';

const RATE = 24000;

/* A clip shaped like real Kokoro output: 0.4s silence, 0.5s tone, 0.6s silence */
function fakeClip(peak = 0.35) {
  const lead = Math.round(0.4 * RATE);
  const body = Math.round(0.5 * RATE);
  const trail = Math.round(0.6 * RATE);
  const a = new Float32Array(lead + body + trail);
  for (let i = 0; i < body; i++) a[lead + i] = Math.sin((i / RATE) * 2 * Math.PI * 220) * peak;
  return a;
}

/* trimSilence removes the dead air but keeps the words */
{
  const clip = fakeClip();
  const out = trimSilence(clip, RATE);
  const sec = out.length / RATE;
  assert.ok(sec > 0.5 && sec < 0.62, `expected ~0.55s after trim, got ${sec.toFixed(2)}s`);
  assert.ok(out.length < clip.length, 'trim must shorten the clip');
}

/* A fully silent clip must survive untouched rather than collapse to nothing */
{
  const silent = new Float32Array(1000);
  assert.strictEqual(trimSilence(silent, RATE).length, 1000);
  assert.strictEqual(normalize(silent).length, 1000);
}

/* normalize brings quiet and loud clips to the same peak */
{
  const quiet = normalize(fakeClip(0.12));
  const loud = normalize(fakeClip(0.85));
  const peak = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(Math.abs(peak(quiet) - peak(loud)) < 1e-6, 'peaks must match after normalize');
  assert.ok(Math.abs(peak(quiet) - 0.89) < 1e-6, `expected peak 0.89, got ${peak(quiet)}`);
}

/* fadeEdges silences the very first and last sample (no click) */
{
  const faded = fadeEdges(normalize(trimSilence(fakeClip(), RATE)), RATE);
  assert.strictEqual(faded[0], 0, 'first sample must be zero');
  assert.strictEqual(faded[faded.length - 1], 0, 'last sample must be zero');
}

/* polish never exceeds full scale (would clip on playback) */
{
  const out = polish(fakeClip(0.99), RATE);
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak <= 1, `peak ${peak} exceeds full scale`);
}

/* writeWav16 emits a header a decoder can actually read back */
{
  const file = path.join(os.tmpdir(), `nbp-wav-test-${process.pid}.wav`);
  const samples = polish(fakeClip(), RATE);
  writeWav16(file, samples, RATE);
  const b = fs.readFileSync(file);
  assert.strictEqual(b.toString('ascii', 0, 4), 'RIFF');
  assert.strictEqual(b.toString('ascii', 8, 12), 'WAVE');
  assert.strictEqual(b.readUInt16LE(20), 1, 'format must be PCM');
  assert.strictEqual(b.readUInt16LE(22), 1, 'must be mono');
  assert.strictEqual(b.readUInt32LE(24), RATE);
  assert.strictEqual(b.readUInt16LE(34), 16, 'must be 16-bit');
  assert.strictEqual(b.readUInt32LE(4), b.length - 8, 'RIFF size must match file');
  assert.strictEqual(b.readUInt32LE(40), samples.length * 2, 'data size must match');
  fs.unlinkSync(file);
}

/* resample raises pitch and shortens by the same factor */
{
  const clip = trimSilence(fakeClip(), RATE);
  const up = resample(clip, 1.1);
  assert.ok(Math.abs(up.length - clip.length / 1.1) <= 1,
    `expected length/1.1, got ${up.length} vs ${clip.length}`);
  assert.strictEqual(resample(clip, 1), clip, 'factor 1 must be a no-op');

  /* the tone really did move up: count zero crossings per second */
  const rateOf = (a) => {
    let z = 0;
    for (let i = 1; i < a.length; i++) if ((a[i - 1] < 0) !== (a[i] < 0)) z++;
    return z / (a.length / RATE);
  };
  const ratio = rateOf(up) / rateOf(clip);
  assert.ok(Math.abs(ratio - 1.1) < 0.05, `pitch ratio ${ratio.toFixed(3)} != ~1.1`);
}

/* polish with a pitch shift still never clips */
{
  const out = polish(fakeClip(0.99), RATE, { pitch: 1.15 });
  const peak = out.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  assert.ok(peak <= 1, `peak ${peak} exceeds full scale`);
  assert.ok(peak > 0.8, 'pitched clip must still be normalized up');
}

console.log('audio-util: all checks passed');

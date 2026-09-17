/* Verifies every spoken phrase id the game can request has a matching WAV in
 * public/audio. This is the check that would have caught the missing
 * letter-*.wav files (they fell back to the robot voice, silently).
 * Run: node scripts/check-audio.mjs        (exits non-zero on a gap) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_NUMBER } from '../src/utils/storage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUDIO_DIR = path.join(__dirname, '..', 'public', 'audio');

/* Every id reachable from the scenes: sound.number(n) for 1..MAX_NUMBER,
 * letters from Trace & Pop, plus the fixed phrases. */
const expected = [
  ...Array.from({ length: MAX_NUMBER }, (_, i) => `number-${i + 1}`),
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch) => `letter-${ch}`),
  ...Array.from({ length: 5 }, (_, i) => `feed-${i + 1}`),
  ...['eyes', 'nose', 'mouth', 'ear', 'hat', 'wheel', 'window', 'door', 'roof',
      'apple', 'banana', 'pear', 'arm'].map((p) => `part-${p}`),
  'yummy', 'hooray', 'hello',
  'made-ten', 'made-20', 'made-30', 'made-40', 'made-fifty'
];

const missing = expected.filter((id) => !fs.existsSync(path.join(AUDIO_DIR, `${id}.wav`)));
const onDisk = fs.readdirSync(AUDIO_DIR).filter((f) => f.endsWith('.wav')).map((f) => f.slice(0, -4));
const orphans = onDisk.filter((id) => !expected.includes(id));

if (missing.length) {
  console.error(`MISSING ${missing.length} phrase file(s): ${missing.join(', ')}`);
  console.error('Run: node scripts/generate-voice.mjs');
}
if (orphans.length) console.warn(`unused (harmless): ${orphans.join(', ')}`);

console.log(`${expected.length - missing.length}/${expected.length} phrase files present`);
process.exit(missing.length ? 1 : 0);

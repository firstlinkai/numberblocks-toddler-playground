/* Generates natural-sounding phrase audio with Kokoro TTS (runs 100% locally,
 * no API keys). Output: public/audio/<id>.wav
 * First run downloads the ~86MB Kokoro model from HuggingFace.
 *
 * Every clip is post-processed by `polish` (trim silence, peak-normalize,
 * fade edges) before it is written - raw Kokoro output carries ~0.4s of lead
 * and ~0.6s of trail silence, which in game reads as lag and flatness.
 *
 * Celebration lines are pitched and paced up (see PROFILES) because Kokoro
 * itself has no emotion control - excited speech is higher and faster, so the
 * profile asks for both and the model's speed setting keeps the duration sane.
 *
 * Run:   node scripts/generate-voice.mjs            (skips existing files)
 *        node scripts/generate-voice.mjs --force    (rewrite everything)
 *        VOICE=af_heart node scripts/generate-voice.mjs --force
 *        EMOTION=1.4 ONLY=made- node scripts/generate-voice.mjs --force
 * Setup: cd scripts && npm install */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { numberWord } from '../src/utils/blocks.js';
import { polish, writeWav16 } from './audio-util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'audio');

/* Kokoro's grapheme-to-phoneme reads spellings literally, so an unusual word
 * (a name especially) often has to be respelled here to come out the way it is
 * really said. Respell the TTS text only - never what is shown on screen. */
const PHRASES = {
  'number-1': 'One!',
  'number-2': 'Two!',
  'number-3': 'Three!',
  'number-4': 'Four!',
  'number-5': 'Five!',
  'number-6': 'Six!',
  'number-7': 'Seven!',
  'number-8': 'Eight!',
  'number-9': 'Nine!',
  'number-10': 'Ten!',
  'feed-1': 'Feed me one!',
  'feed-2': 'Feed me two!',
  'feed-3': 'Feed me three!',
  'feed-4': 'Feed me four!',
  'feed-5': 'Feed me five!',
  'yummy': 'Yummy! Great job!',
  'hooray': 'Hooray! You did it!',
  'made-ten': 'Wow! You made ten!',
  'hello': "Hello! Let's play!",
  /* Puzzle piece names ("Where does it go?") */
  'part-eyes': 'Eyes!',
  'part-nose': 'Nose!',
  'part-mouth': 'Mouth!',
  'part-ear': 'Ear!',
  'part-hat': 'Hat!',
  'part-wheel': 'Wheel!',
  'part-window': 'Window!',
  'part-door': 'Door!',
  'part-roof': 'Roof!',
  'part-apple': 'Apple!',
  'part-banana': 'Banana!',
  'part-pear': 'Pear!',
  'part-arm': 'Arm!'
};

/* Voice + pace. Override from the shell to re-cut the whole set in one go;
 * audition candidates first with: node scripts/compare-voices.mjs */
const VOICE = process.env.VOICE || 'af_heart';
const SPEED = Number(process.env.SPEED || 1.0);
const FORCE = process.argv.includes('--force');

/* ---- Emotion ----------------------------------------------------------
 * Kokoro has no emotion control: it renders text one way and that way is
 * level. Excited speech in real people is higher in pitch AND faster, so
 * each profile asks for both. `rate` goes to the model's own speed setting
 * and `pitch` is applied afterwards by resampling; the generator divides
 * rate by pitch so the resample does not double-count the speed-up.
 *
 * Tune with EMOTION=<0..1.5> to scale every profile at once - 0 is flat. */
const INTENSITY = Number(process.env.EMOTION ?? 1);

const PROFILES = {
  /* counting: steady, must stay clear at a 650ms cadence */
  neutral: { pitch: 1.00, rate: 1.00 },
  /* the numbers a child is chasing - a little lift, still countable */
  bright:  { pitch: 1.03, rate: 1.04 },
  /* "Hooray! You did it!" - the payoff lines */
  excited: { pitch: 1.10, rate: 1.15 },
  /* reaching fifty, the biggest moment in the game */
  party:   { pitch: 1.14, rate: 1.20 }
};

/* Scale a profile toward neutral by INTENSITY */
function profileFor(id) {
  const name = PROFILE_BY_ID[id] || 'neutral';
  const p = PROFILES[name];
  return {
    name,
    pitch: 1 + (p.pitch - 1) * INTENSITY,
    rate: 1 + (p.rate - 1) * INTENSITY
  };
}

/* Numbers 11-50 + milestone lines */
for (let n = 11; n <= 50; n++) {
  PHRASES['number-' + n] = numberWord(n) + '!';
}
PHRASES['made-20'] = 'Wow! You made twenty!';
PHRASES['made-30'] = 'Wow! You made thirty!';
PHRASES['made-40'] = 'Wow! You made forty!';
PHRASES['made-fifty'] = 'Fifty! You did it!';

/* Which phrases are celebrations. Everything unlisted stays neutral. */
const PROFILE_BY_ID = {
  yummy: 'excited',
  hooray: 'excited',
  'hello': 'bright',
  'made-ten': 'excited',
  'made-20': 'excited',
  'made-30': 'excited',
  'made-40': 'excited',
  'made-fifty': 'party'
};
for (let n = 1; n <= 5; n++) PROFILE_BY_ID['feed-' + n] = 'bright';

/* Letter names for the trace & pop game */
[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].forEach((ch) => {
  PHRASES['letter-' + ch] = ch + '!';
});

const { KokoroTTS } = await import('kokoro-js');
console.log('Loading Kokoro model (first run downloads ~86MB)...');
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
fs.mkdirSync(OUT_DIR, { recursive: true });

const speak = typeof tts.generate === 'function' ? tts.generate.bind(tts) : tts.create.bind(tts);
console.log(`voice=${VOICE} speed=${SPEED} emotion=${INTENSITY}${FORCE ? ' (force)' : ''}`);

/* ONLY=<substring> re-cuts just the matching ids (e.g. ONLY=made- ) */
const ONLY = process.env.ONLY || '';

for (const [id, text] of Object.entries(PHRASES)) {
  if (ONLY && !id.includes(ONLY)) continue;
  const file = path.join(OUT_DIR, id + '.wav');
  if (!FORCE && fs.existsSync(file)) { console.log('skip', id); continue; }

  const p = profileFor(id);
  /* the resample shortens by `pitch`, so ask the model for a proportionally
   * slower read - the two cancel and only the pitch actually moves */
  const audio = await speak(text, { voice: VOICE, speed: SPEED * (p.rate / p.pitch) });
  const rate = audio.sampling_rate || audio.sampleRate || 24000;
  const raw = audio.audio || audio.data;
  /* never audio.save() here - it would bypass polish and ship the dead air */
  const samples = polish(raw, rate, { pitch: p.pitch });
  writeWav16(file, samples, rate);
  console.log('wrote', id + '.wav', `[${p.name}]`,
    (raw.length / rate).toFixed(2) + 's -> ' + (samples.length / rate).toFixed(2) + 's');
}
console.log('ALL_AUDIO_DONE');

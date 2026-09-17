/* Generates the same handful of phrases in several Kokoro voices so a human
 * can pick one by ear, plus an audition page at /_voicetest/.
 *
 * All clips get the same post-processing the real game audio gets, so what
 * you hear is what shipping would sound like.
 *
 * Run:  node scripts/compare-voices.mjs
 * Then: npm run dev  ->  http://localhost:5173/_voicetest/
 * Clean up when done: rm -rf public/_voicetest */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { polish, writeWav16 } from './audio-util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', '_voicetest');

/* Numberblocks is a British show, so the bf_* voices are worth hearing
 * alongside the American ones even though af_heart grades highest overall. */
const VOICES = [
  { id: 'af_bella',  note: 'current voice (American, warm)' },
  { id: 'af_heart',  note: 'American, highest-graded Kokoro voice' },
  { id: 'af_sky',    note: 'American, bright and young' },
  { id: 'af_nicole', note: 'American, soft and breathy' },
  { id: 'bf_emma',   note: 'British, warm — matches the show' },
  { id: 'bf_lily',   note: 'British, younger and lighter' }
];

/* Short and long lines: the short ones are where flatness shows most */
const PHRASES = [
  ['one',    'One!'],
  ['three',  'Three!'],
  ['seven',  'Seven!'],
  ['hooray', 'Hooray! You did it!'],
  ['yummy',  'Yummy! Great job!'],
  ['feed',   'Feed me three!']
];

/* Slightly faster than the old 0.92: the drag was reading as flatness */
const SPEED = 1.0;

const { KokoroTTS } = await import('kokoro-js');
console.log('Loading Kokoro model...');
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
fs.mkdirSync(OUT, { recursive: true });

const speak = typeof tts.generate === 'function' ? tts.generate.bind(tts) : tts.create.bind(tts);

for (const v of VOICES) {
  for (const [key, text] of PHRASES) {
    const file = path.join(OUT, `${v.id}__${key}.wav`);
    if (fs.existsSync(file)) { console.log('skip', path.basename(file)); continue; }
    const audio = await speak(text, { voice: v.id, speed: SPEED });
    const rate = audio.sampling_rate || audio.sampleRate || 24000;
    const samples = polish(audio.audio || audio.data, rate);
    writeWav16(file, samples, rate);
    console.log('wrote', path.basename(file), (samples.length / rate).toFixed(2) + 's');
  }
}

/* Audition page: one row per voice, one button per phrase, plus a
 * "play all" that fires the counting sequence at the game's real cadence. */
const rows = VOICES.map((v) => `
    <tr>
      <th><span class="vid">${v.id}</span><span class="note">${v.note}</span></th>
      ${PHRASES.map(([k, t]) => `<td><button data-src="${v.id}__${k}.wav" title="${t}">${k}</button></td>`).join('')}
      <td><button class="seq" data-voice="${v.id}">▶ count 1·3·7</button></td>
    </tr>`).join('');

fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Voice audition</title>
<style>
  body { font: 16px system-ui, sans-serif; margin: 32px; background: #fffded; color: #1e293b; }
  h1 { font-size: 20px; }
  p { color: #475569; max-width: 60ch; }
  table { border-collapse: collapse; margin-top: 20px; }
  th, td { padding: 8px 6px; text-align: left; vertical-align: middle; }
  tr + tr th, tr + tr td { border-top: 1px solid #e2e8f0; }
  th { padding-right: 20px; }
  .vid { display: block; font-family: ui-monospace, monospace; font-weight: 700; }
  .note { display: block; font-weight: 400; font-size: 13px; color: #64748b; }
  button { font: inherit; padding: 7px 14px; border: 1px solid #c7d2fe; border-radius: 9px;
           background: #eef2ff; color: #3730a3; cursor: pointer; }
  button:hover { background: #e0e7ff; }
  button.playing { background: #4f46e5; color: #fff; }
  .seq { background: #fef9c3; border-color: #fde047; color: #854d0e; }
</style></head><body>
<h1>Kokoro voice audition</h1>
<p>Every clip below is post-processed exactly like the shipping audio: silence
trimmed, peak-normalized, edges faded. <strong>“count 1·3·7”</strong> plays three
numbers at the game’s real 650&nbsp;ms counting cadence — that is the one that
tells you whether a voice feels alive in play.</p>
<table>${rows}</table>
<script>
  let cur = null;
  function play(src, btn) {
    if (cur) { cur.pause(); cur = null; }
    document.querySelectorAll('button.playing').forEach(b => b.classList.remove('playing'));
    const a = new Audio(src);
    cur = a;
    if (btn) { btn.classList.add('playing'); a.onended = () => btn.classList.remove('playing'); }
    return a.play().then(() => a);
  }
  document.querySelectorAll('button[data-src]').forEach(b =>
    b.addEventListener('click', () => play(b.dataset.src, b)));
  document.querySelectorAll('button.seq').forEach(b =>
    b.addEventListener('click', async () => {
      const v = b.dataset.voice;
      b.classList.add('playing');
      for (const k of ['one', 'three', 'seven']) {
        new Audio(v + '__' + k + '.wav').play();
        await new Promise(r => setTimeout(r, 650));
      }
      setTimeout(() => b.classList.remove('playing'), 400);
    }));
</script>
</body></html>
`);

console.log('\nAudition page: http://localhost:5173/_voicetest/index.html  (run: npm run dev)');

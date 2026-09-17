/* Auditions the celebration lines at several excitement levels so a human can
 * pick one by ear. Kokoro has no emotion control, so "excitement" here is
 * pitch + pace, applied exactly the way generate-voice.mjs applies it.
 *
 * Also tries reworded variants: a longer, more exclamatory line gives the
 * model more prosodic room than three clipped words, which is often a bigger
 * win than any amount of pitch shifting.
 *
 * Run:  node scripts/compare-emotion.mjs
 * Then: npm run dev -> http://localhost:5173/_emotiontest/index.html
 * Clean up: rm -rf public/_emotiontest */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { polish, writeWav16 } from './audio-util.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', '_emotiontest');
const VOICE = process.env.VOICE || 'af_heart';

/* Same maths as the generator: rate goes to the model, pitch to the resampler */
const LEVELS = [
  { key: 'flat',   pitch: 1.00, rate: 1.00, note: 'no change — today’s sound' },
  { key: 'lift',   pitch: 1.05, rate: 1.07, note: 'gentle lift' },
  { key: 'excited',pitch: 1.10, rate: 1.15, note: 'excited (proposed default)' },
  { key: 'party',  pitch: 1.14, rate: 1.20, note: 'party' },
  { key: 'max',    pitch: 1.20, rate: 1.26, note: 'as far as it goes before it squeaks' }
];

/* Wording matters as much as pitch: more words = more room to modulate */
const LINES = [
  ['hooray',     'Hooray! You did it!'],
  ['hooray-alt', 'Hooray! Hooray! You did it!'],
  ['yummy',      'Yummy! Great job!'],
  ['yummy-alt',  'Mmm, yummy! Well done!'],
  ['madeten',    'Wow! You made ten!'],
  ['madeten-alt','Wow, wow, wow! You made ten!'],
  ['fifty',      'Fifty! You did it!'],
  ['fifty-alt',  'Fifty! Amazing! You did it!'],
  ['yay',        'Yaaay!'],
  ['woohoo',     'Woo hoo! Brilliant!']
];

const { KokoroTTS } = await import('kokoro-js');
console.log(`Loading Kokoro model... (voice ${VOICE})`);
const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8' });
const speak = typeof tts.generate === 'function' ? tts.generate.bind(tts) : tts.create.bind(tts);
fs.mkdirSync(OUT, { recursive: true });

for (const lv of LEVELS) {
  for (const [key, text] of LINES) {
    const file = path.join(OUT, `${key}__${lv.key}.wav`);
    if (fs.existsSync(file)) { console.log('skip', path.basename(file)); continue; }
    const audio = await speak(text, { voice: VOICE, speed: lv.rate / lv.pitch });
    const rate = audio.sampling_rate || audio.sampleRate || 24000;
    const samples = polish(audio.audio || audio.data, rate, { pitch: lv.pitch });
    writeWav16(file, samples, rate);
    console.log('wrote', path.basename(file), (samples.length / rate).toFixed(2) + 's');
  }
}

const rows = LINES.map(([key, text]) => `
    <tr>
      <th><span class="line">${text.replace(/</g, '&lt;')}</span><span class="key">${key}</span></th>
      ${LEVELS.map((lv) => `<td><button data-src="${key}__${lv.key}.wav">${lv.key}</button></td>`).join('')}
    </tr>`).join('');

fs.writeFileSync(path.join(OUT, 'index.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Emotion audition</title>
<style>
  body { font: 16px system-ui, sans-serif; margin: 32px; background: #fffded; color: #1e293b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  p { color: #475569; max-width: 68ch; }
  table { border-collapse: collapse; margin-top: 22px; }
  th, td { padding: 9px 6px; text-align: left; vertical-align: middle; }
  tr + tr th, tr + tr td { border-top: 1px solid #e2e8f0; }
  th { padding-right: 24px; max-width: 34ch; }
  .line { display: block; font-weight: 600; }
  .key { display: block; font: 12px ui-monospace, monospace; color: #94a3b8; }
  thead th { font: 13px ui-monospace, monospace; color: #64748b; font-weight: 600; }
  thead .note { display: block; font-family: system-ui; font-weight: 400; font-size: 12px; color: #94a3b8; max-width: 14ch; }
  button { font: inherit; padding: 7px 14px; border: 1px solid #c7d2fe; border-radius: 9px;
           background: #eef2ff; color: #3730a3; cursor: pointer; min-width: 84px; }
  button:hover { background: #e0e7ff; }
  button.playing { background: #4f46e5; color: #fff; }
</style></head><body>
<h1>Celebration line audition — voice ${VOICE}</h1>
<p>Kokoro has no emotion setting, so “excited” here means <strong>higher pitch and
faster pace</strong>, which is what excited speech actually is. Columns go from no
change to as far as it goes before the voice starts to squeak.</p>
<p>The <code>-alt</code> rows are <strong>reworded</strong> versions of the same line.
Giving the model more words to work with often does more for liveliness than any
amount of pitch shifting — compare <code>hooray</code> against <code>hooray-alt</code>
at the same level before deciding.</p>
<table>
  <thead><tr><th></th>${LEVELS.map((l) => `<th>${l.key}<span class="note">${l.note}</span></th>`).join('')}</tr></thead>
  <tbody>${rows}</tbody>
</table>
<script>
  let cur = null;
  document.querySelectorAll('button[data-src]').forEach(b =>
    b.addEventListener('click', () => {
      if (cur) cur.pause();
      document.querySelectorAll('button.playing').forEach(x => x.classList.remove('playing'));
      const a = new Audio(b.dataset.src);
      cur = a;
      b.classList.add('playing');
      a.onended = () => b.classList.remove('playing');
      a.play();
    }));
</script>
</body></html>
`);

console.log('\nAudition page: http://localhost:5173/_emotiontest/index.html');

/* Who the greeting row on the Hub shows.
 *
 * Deliberately generic in the repository: the app is built for particular
 * children and their names do not belong in a public git history. Put your own
 * here to personalise it - `label` is what appears on the button (leave it
 * empty for an icon-only button) and `greet` is what is spoken.
 *
 * `id` names the pre-generated WAV in public/audio. If you change `greet`, add
 * the new id to scripts/generate-voice.mjs, scripts/check-audio.mjs and the
 * PHRASES list in public/sw.js, then run `npm run voice`. Until that file
 * exists the line still plays, just in the browser's robot voice.
 *
 * Kokoro's grapheme-to-phoneme is worth a thought when you add a name: it reads
 * spellings literally, so an unusual name often needs respelling in the TTS
 * text (and only there) to come out the way it is actually said.
 */
export const PLAYERS = [
  { icon: '👦', label: '', greet: "Hello! Let's play!", id: 'hello' },
  { icon: '👧', label: '', greet: "Hello! Let's play!", id: 'hello' }
];

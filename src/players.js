/* Who the Hub greeting row shows, and the praise line Feed the Cat uses.
 *
 * The repository ships GENERIC values. Personal ones belong in
 * `src/players.local.js`, which is gitignored and overrides whatever it
 * exports - a child's name has no business in a public git history, and the
 * spoken WAV of that name even less.
 *
 * To personalise a checkout, create src/players.local.js:
 *
 *   export const PLAYERS = [
 *     { icon: '👦', label: 'Sam', greet: 'Hi Sam!', id: 'local-greet-1' }
 *   ];
 *   export const PRAISE = { id: 'local-yummy', text: 'Yummy! Great job, Sam!' };
 *
 * `label` is what appears on the button (leave it empty for an icon-only
 * button), `greet` is what is spoken, and `id` names the WAV in public/audio.
 * Declare the same ids in `scripts/phrases.local.mjs` (also gitignored) and run
 * `npm run voice`; everything under the `local-` prefix stays out of git. Until
 * a WAV exists the line still plays, just in the browser's robot voice.
 */

const DEFAULTS = {
  PLAYERS: [
    { icon: '👦', label: '', greet: "Hello! Let's play!", id: 'hello' },
    { icon: '👧', label: '', greet: "Hello! Let's play!", id: 'hello' }
  ],
  PRAISE: { id: 'yummy', text: 'Yummy! Great job!' }
};

/* import.meta.glob rather than a plain import: it resolves to an empty object
 * when the file is absent, so a fresh clone builds with no local override and
 * without a missing-module error. */
const overrides = import.meta.glob('./players.local.js', { eager: true });
const local = Object.values(overrides)[0] || {};

export const PLAYERS = local.PLAYERS || DEFAULTS.PLAYERS;
export const PRAISE = local.PRAISE || DEFAULTS.PRAISE;

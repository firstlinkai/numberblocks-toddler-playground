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
 *   export const WIN_LINES = [{ id: 'local-win-1', text: 'Hooray! You did it!' }];
 *   export const REST = { id: 'local-rest', text: 'Time to take a rest.' };
 *
 * `label` is what appears on the button (leave it empty for an icon-only
 * button), `greet` is what is spoken, and `id` names the WAV in public/audio.
 * Declare the same ids in `scripts/phrases.local.mjs` (also gitignored) and run
 * `npm run voice`; everything under the `local-` prefix stays out of git. Until
 * a WAV exists the line still plays, just in the browser's robot voice.
 */

const DEFAULTS = {
  PLAYERS: [
    { icon: '👋', label: '', greet: "Hello! Let's play!", id: 'hello' }
  ],
  PRAISE: { id: 'yummy', text: 'Yummy! Great job!' },

  /* Finishing a round picks one of these at random. Several real recordings in
   * different wordings beat one line repeated: the praise is the payoff, and a
   * payoff a child can predict word for word stops registering as one. */
  WIN_LINES: [{ id: 'hooray', text: 'Hooray! You did it!' }],

  /* Played over whatever is on screen after every REST_EVERY_MIN minutes of
   * actual play (see main.js). Not a fail state and not a lock-out - it just
   * says the words out loud so the grown-up in the room hears them too. */
  REST: { id: 'rest', text: 'Time to take a little rest!' }
};

/* import.meta.glob rather than a plain import: it resolves to an empty object
 * when the file is absent, so a fresh clone builds with no local override and
 * without a missing-module error. */
const overrides = import.meta.glob('./players.local.js', { eager: true });
const local = Object.values(overrides)[0] || {};

export const PLAYERS = local.PLAYERS || DEFAULTS.PLAYERS;
export const PRAISE = local.PRAISE || DEFAULTS.PRAISE;
export const WIN_LINES = local.WIN_LINES || DEFAULTS.WIN_LINES;
export const REST = local.REST || DEFAULTS.REST;

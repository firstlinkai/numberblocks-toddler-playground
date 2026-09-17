# Numberblocks Toddler Playground 🧱⭐

An offline-capable, ad-free counting playground for a three-year-old. Ten mini-games,
no text to read, no accounts, no ads, no backend. 100% client-side, installable as a
PWA and fully playable with the network off.

Built for an iPad in landscape, mouse-friendly on desktop.

---

## Table of contents

- [The games](#the-games)
- [Design rules](#design-rules)
- [Running it](#running-it)
- [Project layout](#project-layout)
- [How a scene works](#how-a-scene-works)
- [Building a new picture or round](#building-a-new-picture-or-round)
- [Audio](#audio)
- [Personalising it](#personalising-it)
- [Verification scripts](#verification-scripts)
- [Offline / PWA](#offline--pwa)
- [Deploying](#deploying)

---

## The games

Ten launchers on the hub, in a 5x2 grid. Every one ends in a ⭐ and rolls straight
into the next round — there is no menu to come back to and nothing to dismiss.

| | Game | What it teaches | Win condition |
|---|---|---|---|
| 🧱 | **Block Snap & Builder** | Composition / addition | Drag blocks together to merge them. Every completed ten celebrates and awards ⭐; the round ends at fifty |
| 🍎 | **Feed the Cat** | One-to-one correspondence, 1–5 | The cat asks for a number; drag it that many pieces of fruit, each chomp counting up → ⭐ |
| 🪜 | **Tower Jump** | Number sequence | A staircase of five consecutive numbers has one gap. Fill it and the hero hops up counting → ⭐ |
| 🎈 | **Trace & Pop** | Numeral **and letter** recognition, fine motor | A glyph hides under a field of bubbles. Trace to pop every bubble and the glyph is revealed → ⭐ |
| 🎹 | **Instruments** | Cause and effect, listening | Free play: tap instruments, each with its own synthesized voice |
| 🔗 | **Match** | Numeral ↔ number word | Two columns, shuffled. Drag a line between a pair, or tap one then the other. Three pairs per round → ⭐ |
| 🧩 | **Where does it go?** | Part-to-whole, numeral recognition, vocabulary | A picture is missing pieces and the pieces sit in a tray. Drag each one into its dashed hole → ⭐ |
| ✏️ | **Connect the Dots** | Counting order, 1→10 | Tap the numbered dots in order. The outline draws itself, then fills in and grows a face → ⭐ |
| 🧺 | **Sort It!** | Classifying | Two bins, a row of toys. Four rules cycle: by colour, by size, by kind, by count → ⭐ |
| 🃏 | **Peek & Match** | Working memory | Six cards, three pairs, a 3D flip. Find every pair → ⭐ |

Stars and unlocked Numberblocks persist in `localStorage`. The hub shows the star
counter, a mute toggle and a shelf of Numberblocks 0–10; tap any block to hear its
number.

Finishing a round calls `sound.praise()`, which picks a line at random from
`WIN_LINES` and never plays the same one twice in a row. With one line configured
that is just that line; with several — real recordings in different wordings work
best — the payoff stops being a jingle the child can recite along with.

A **rest reminder** speaks after every 20 minutes of actual play
(`REST_EVERY_MIN` in `src/main.js`). Time accrues on a one-minute ticker and only
while the tab is visible, so a tablet left face-down is not "playing" and a tab
hidden for hours does not return to a burst of backlogged reminders. Nothing is
blocked and nothing is taken away — the line is simply spoken out loud, where the
grown-up in the room hears it too.

### Where does it go? — the two families of picture

The pieces are weighted **60/40 toward numbers** (`NUMBER_SHARE` in
`src/scenes/puzzles.js`).

**Number pictures**

- *Count and place* — three Numberblocks stand on a shelf with their numerals
  missing underneath. Count the cubes, drag the numeral in. Three sets: 1-2-3,
  4-5-6, 7-8-9, in the show's own colours.
- *Build the Numberblock* — Three, Four and Five, each short of a cube, its face
  and both arms. Placing a cube speaks the character's number, so the block is
  counted out loud as it is built.

**Object pictures** — a face (eyes, nose, mouth), a cat (ears, eyes, nose), a car
(two wheels, window), a house (roof, door, window), a snowman (hat, eyes, carrot
nose) and a fruit basket (apple, banana, pear).

A piece and its hole are rendered from the **same SVG markup**: the hole is just
that markup with the fill stripped and the stroke dashed. A piece can therefore
never fail to fit, because it *is* its hole — there is no second set of
coordinates to drift out of sync.

---

## Design rules

These are constraints, not preferences. Each one exists because the alternative
was tried and lost a three-year-old's attention.

- **No fail state, no timer, no score, no countdown.** Anywhere. A wrong answer
  costs nothing: the piece floats home, the right target pulses and its name is
  spoken again.
- **The correct target lights up the moment a piece is picked up.** A
  three-year-old should not have to hunt; the reward is the fitting, not the
  searching.
- **A 7-second idle nudge in every game.** One target pulses and speaks. A silent
  screen is what loses a toddler, and this is the whole concentration mechanism.
- **Every round rolls into the next automatically** after the celebration. There is
  nothing to tap to continue.
- **No text a child has to read.** Bins are labelled with icons, colours and dot
  counts. Numerals and letters appear only where recognising them *is* the game.
- **Touch targets are huge** and forgiving: drops are matched on what a piece *is*,
  never on which hole it came from, so the two car wheels are interchangeable.
- **Touch scrolling is disabled app-wide**, along with gesture zoom, double-tap
  zoom and the context menu. Nothing may ever need scrolling.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173, LAN-exposed for tablet testing
npm run build      # static output in /dist
npm run preview    # serve the built output on :4173
```

No runtime dependencies. Vite is the only devDependency.

---

## Project layout

```
index.html                   shell: #topbar, #stage, #fx-layer, portrait rotate overlay
src/main.js                  scene router, top bar, global toddler-proofing
src/players.js               who the hub greeting row shows (generic by default)
src/style.css                shared styling, sectioned by game
src/<game>.css               per-game styling, imported by that game's scene
src/audio/SoundManager.js    SFX synthesis + the speech queue
src/scenes/*.js              one file per mini-game
src/scenes/puzzles.js        artwork for Where does it go?
src/scenes/dots-shapes.js    artwork for Connect the Dots
src/scenes/sort-sets.js      item sets for Sort It!
src/scenes/memoryThemes.js   card themes for Peek & Match
src/utils/blocks.js          Numberblock rendering, number words, the show's colours
src/utils/drag.js            pointer-based drag/drop + hit testing
src/utils/fx.js              confetti and particle bursts (Web Animations API)
src/utils/storage.js         localStorage (stars, unlocked numbers, mute) + pub-sub
public/audio/*.wav           pre-generated speech
public/sw.js                 service worker (pre-cache shell + all audio)
scripts/*.mjs                build-time tooling: audio generation, WAV polishing, checks
scripts/*.py                 Playwright verification scripts
```

---

## How a scene works

A scene is a plain object with two methods. No framework, no router library.

```js
export default {
  mount(root, ctx) { /* build the DOM under `root` */ },
  unmount() { /* clear every timer you started */ }
};
```

`ctx` is `{ sound, storage, stage, go }`. `main.js` cross-dissolves between scenes:
it calls `unmount()` on the outgoing scene, fades its root out on its own timer and
mounts the new one, so a fast double-tap can never strand two live scenes.

**Every scene keeps its own `timers` array and clears it in `unmount()`.** Callbacks
firing into a dead DOM is the classic bug in this codebase.

Useful APIs:

| Module | What you get |
|---|---|
| `audio/SoundManager.js` | `say`, `number`, `countUp`, `speakSequence`, `celebrate`, and the SFX: `snap`, `pop`, `wobble`, `chime`, `hop`, `munch`, `star`, `fanfare`, `bubble`, `pick` |
| `utils/fx.js` | `confetti({count})`, `burst(x, y, opts)`, `floatUp(x, y, text)` |
| `utils/blocks.js` | `makeBlock`, `renderStack`, `shapeFor`, `blockColor`, `numberWord`, `BLOCK_COLORS` |
| `utils/drag.js` | `makeDraggable(el, opts)`, `hitTest(x, y, selector, exclude)`, `returnHome` |
| `utils/storage.js` | `getStars`, `addStar`, `unlockNumber`, `isMuted`, `setMuted`, `onChange` |

---

## Building a new picture or round

Most content lives in data files, so adding to a game rarely means touching its
logic.

**Where does it go?** — add an entry to `NUMBER_PUZZLES` or `OBJECT_PUZZLES` in
`src/scenes/puzzles.js`:

```js
{
  id: 'boat',
  base: `<path .../>`,                       // always drawn
  slots: [
    {
      key: 'sail',                           // what a drop is matched on
      label: 'Sail', audio: 'part-sail',     // spoken when it lands
      sc: '#0369a1',                         // colour of the dashed hole
      svg: `<path ... data-detail="1" .../>` // drawn twice: solid and hollow
    }
  ]
}
```

Two slots may share a `key` when they are interchangeable (the two car wheels).
`data-detail` marks decoration that is hidden in the hollow outline — dashed pupils
inside a dashed eye read as noise at this age. **Slots must not overlap each other**:
two dashed outlines crossing read as one tangled shape.

**Connect the Dots** — add a closed polygon to `src/scenes/dots-shapes.js`: the dot
coordinates in tap order, a fill, a stroke and a `{cx, cy, r}` anchor for the face.
No two dots may sit closer than 26 units; `npm run check:dots` enforces it.

---

## Audio

Spoken lines are **pre-generated WAV files** in `public/audio/`, produced locally by
[Kokoro TTS](https://github.com/hexgrad/kokoro) (voice `af_heart`, no API keys, no
network at runtime). `SoundManager` fetches each phrase lazily by id the first time
it is needed and caches it, so dropping a new `<id>.wav` into `public/audio/` needs
no code change. A missing file falls back to `speechSynthesis` — the robot voice.

**Speech is queued, never interrupted.** Every line plays to completion, then a
260 ms gap, then the next one. This is not cosmetic. Playback used to stop whatever
was already speaking, and both the counting sequence and the tower hops ran on fixed
~640 ms timers, so any longer line was guillotined mid-word: "Thirty-seven!" runs
~0.8 s and lost a fifth of its name. Sequences now advance on audio completion via
`sound.speakSequence()`, so **visuals follow the voice** rather than a guessed
interval. Direct feedback (tapping a block) passes `{ interrupt: true }` so a tap
answers immediately instead of queueing behind earlier taps.

Sound effects — pops, chews, hops, chimes, fanfares — are synthesized at runtime with
the Web Audio API. Mute is global and persisted, and silences samples, speech and
effects alike.

Raw TTS output is **post-processed** before it is written
(`scripts/audio-util.mjs`): silence trimmed, peak-normalized to a common level, edges
faded. This matters more than it sounds — unprocessed Kokoro wraps ~0.4 s of lead and
~0.6 s of trail silence around each phrase, so a tap produced nothing for 400 ms and
counting landed behind the animation it was meant to sync with. That delay reads as
"flat" and "robotic" even when the voice itself is fine.

```bash
npm run voice                                      # generate missing phrases only
npm run voice -- --force                           # re-cut everything
VOICE=bf_emma SPEED=1.0 npm run voice -- --force   # ...in a different voice
npm run voice:compare                              # audition candidate voices
npm run check:audio                                # every id the game can request has a WAV
```

`check:audio` guards the failure mode where a phrase silently degrades to the robot
voice mid-game. Run it after adding any spoken line.

Regenerating voices needs the one-off TTS toolchain:

```bash
cd scripts && npm install    # pulls kokoro-js (~86MB model on first run)
```

---

## Personalising it

The hub's greeting row and Feed the Cat's praise line are generic in this
repository on purpose: a child's name has no business in a public git history,
and a WAV of that name spoken aloud even less.

Personal values live in two **gitignored** files that override the defaults, so a
checkout can be fully personalised without any of it ever reaching git.

**`src/players.local.js`** — who the hub shows:

```js
export const PLAYERS = [
  { icon: '👦', label: 'Sam', greet: 'Hi Sam!', id: 'local-greet-1' },
  { icon: '👧', label: 'Ada', greet: 'Hi Ada!', id: 'local-greet-2' }
];

export const PRAISE = { id: 'local-yummy', text: 'Yummy! Great job, Sam!' };

export const WIN_LINES = [
  { id: 'local-win-1', text: 'Hooray! You did it!' },
  { id: 'local-win-2', text: 'Good job! You won!' }
];

export const REST = { id: 'local-rest', text: 'Time to take a rest.' };
```

`label` is what appears on the button (leave it empty for an icon-only button),
`greet` is what is spoken, and `id` names the WAV in `public/audio`.
`src/players.js` picks the file up through `import.meta.glob`, which resolves to
an empty object when it is absent — so a fresh clone builds and runs with the
generic defaults and no missing-module error.

**`scripts/phrases.local.mjs`** — the TTS text for those ids:

```js
export const PHRASES = {
  'local-greet-1': "Hi Sam! Let's play!",
  'local-greet-2': "Hi Ada! Let's play!",
  'local-yummy': 'Yummy! Great job, Sam!'
};

export const PROFILES = {          // optional: neutral if unlisted
  'local-greet-1': 'bright',
  'local-yummy': 'excited'
};
```

Then run `npm run voice`. `generate-voice.mjs` merges this file when it exists,
`check-audio.mjs` folds the same ids into what it verifies, and everything lands
under the `local-` prefix — which is what makes one `.gitignore` rule
(`public/audio/local-*.wav`) enough to keep the personal audio out of the repo.

### Using real recordings instead of TTS

A line in a familiar voice beats any synthesised one. Drop a 16-bit PCM WAV at
`public/audio/<id>.wav`, list its id in `RECORDED` rather than `PHRASES`, and run
it through the same post-processing the generated clips get:

```bash
node scripts/polish-wav.mjs public/audio/local-win-1.wav
```

```js
export const RECORDED = ['local-win-1', 'local-win-2', 'local-rest'];
```

`RECORDED` is the opposite of `PHRASES`: `check-audio.mjs` still verifies those
ids, but the generator never sees them, so a `npm run voice -- --force` re-cut
cannot silently replace a family recording with a TTS voice.

`polish-wav.mjs` trims the silence, peak-normalizes to the level every other clip
uses and fades the edges. Skip it and the recording sits at a different volume
from every synthesised line and opens with dead air, which in game reads as lag.

Three rules ignore all of it:

```
src/players.local.js
scripts/phrases.local.mjs
public/audio/local-*.wav
```

One catch worth knowing: Kokoro's grapheme-to-phoneme reads spellings literally,
so an unusual name often needs respelling in the TTS text to come out the way it
is actually said. Respell it in `phrases.local.mjs` only — `label` in
`players.local.js` is what appears on screen and should stay spelled properly.

Note that a **build** inlines whatever the local override says, so `dist/` and
anything you deploy from it will contain those names. That is the point — the app
is for those children — but it is worth knowing before you publish a build to a
public URL.

---

## Verification scripts

Node checks, run against the source:

```bash
npm test              # self-check the audio post-processing
npm run check:audio   # every phrase id the game can request has a WAV
npm run check:glyphs  # Trace & Pop: bubbles fully hide every glyph, stroke edges included
npm run check:dots    # Connect the Dots: no two dots overlap
```

`check:glyphs` and `check:dots` both guard bugs that are invisible in code review and
obvious on screen: a glyph bleeding through its bubbles, and two dots rendering as one
unreadable lump.

Browser checks use Python Playwright and need the preview server on `:4173`:

```bash
npm run build && npm run preview     # in one terminal
python scripts/test-all.py           # every game: enter, screenshot, collect console errors
python scripts/test-parts.py         # Where does it go?: every picture, drag a piece into place
python scripts/test-dots.py          # Connect the Dots: tap every dot, assert the picture completes
python scripts/test-sort.py          # Sort It!: drive all four rules to completion
python scripts/test-memory.py        # Peek & Match: complete a round, assert a star is awarded
python scripts/test-rest.py          # rest reminder: quiet before 20 min, fires at 20 and again at 40
```

Screenshots land in `.shots/` (gitignored). Look at them — most of the layout bugs in
this project's history were invisible in the DOM and obvious in a screenshot.

---

## Offline / PWA

- `manifest.json`: standalone, landscape, theme `#4F46E5`, background `#FFFDED`
- `sw.js`: pre-caches the shell **and every phrase WAV**, runtime cache-first for
  everything else, so the app is fully playable offline after the first load. Use
  *Add to Home Screen* on an iPad.
- **Bump `CACHE_NAME` in `public/sw.js` whenever audio or shell assets change**, or
  installed devices keep serving the old cache.

---

## Deploying

```bash
npm run build      # static output in /dist
```

Any static host works — 124 files, ~5 MB, no backend and no Node at runtime.
Vercel auto-detects Vite; push and import the repo.

**To a VPS behind Traefik**, `deploy/` has an nginx container, the Traefik labels
and a one-command deploy script:

```bash
VPS=user@your-vps ./deploy/deploy.sh
```

See [deploy/README.md](deploy/README.md). The build runs locally on purpose: the
local overrides are gitignored, so a server-side `git pull && npm run build` would
quietly produce the generic version.

The link preview card is generated, not hand-made:

```bash
python scripts/generate-og.py   # writes public/og-image.png (1200x630)
```

It draws a standalone card rather than screenshotting the hub, because the running
app shows the player's name and the OG image is the one asset every chat app fetches
and caches. If you change the domain, update the `og:` and `twitter:` URLs in
`index.html` to match — the tags without a reachable image still fail to produce a
card.

---

## Tech

Vite + vanilla JS + CSS. No framework, no runtime dependencies. Scenes are plain
objects routed by `src/main.js`. iPad landscape recommended — portrait shows a rotate
prompt.

See `HANDOVER.md` for the architecture in depth, the audio pipeline and the
invariants that will silently break things.

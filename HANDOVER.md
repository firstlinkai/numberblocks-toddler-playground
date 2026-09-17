# Handover — Numberblocks Toddler Playground

Written for whoever (human or AI agent) picks this up next. It assumes no prior
context on the project. Read `README.md` for the user-facing description; this
document covers the parts that are *not* obvious from the code, the reasoning
behind decisions already made, and the traps that will silently break things.

---

## 1. What this is

An offline, ad-free counting game built for a three-year-old. Ten mini-games, no
text anywhere in the UI that a child has to read, no accounts, no backend, no
network at runtime. It is installed to an iPad home screen as a PWA
and played in landscape.

Stack: **Vite + vanilla JS + CSS. Zero runtime dependencies. No framework.**
That is deliberate — do not introduce React/Tailwind/state libraries. The whole
app is ~3,000 lines including CSS.

**There is no git repository here.** Nothing is version controlled. Before any
large refactor, copy the folder or run `git init` first, because there is no
undo.

---

## 2. Running it

```bash
npm install
npm run dev        # http://localhost:5173  (--host, so an iPad on the LAN can reach it)
npm run build      # static output in dist/
```

Regenerating speech audio needs a separate one-off toolchain:

```bash
cd scripts && npm install    # installs kokoro-js; downloads an ~86MB model on first run
```

That model is already downloaded and cached under
`scripts/node_modules/@huggingface/transformers/.cache/`. It runs fully offline.

### Verification commands

Run these after touching audio, the Trace & Pop glyphs, or the sound manager:

```bash
npm test             # self-check for the audio post-processing maths
npm run check:audio  # every phrase id the game can request has a matching WAV
npm run check:glyphs # Trace & Pop bubbles fully hide every glyph, stroke edges included
```

All three currently pass. They exist because each one caught a real bug that was
invisible by inspection — treat a failure as a genuine defect, not a flaky test.

---

## 3. Architecture

```
index.html          shell: #topbar, #stage, #fx-layer, portrait rotate overlay
src/main.js         scene router + global toddler-proofing
src/style.css       all styling (~1,100 lines, sectioned by game)
src/audio/SoundManager.js   SFX synthesis + speech queue        <- most subtle file
src/scenes/*.js     one file per mini-game
src/utils/blocks.js Numberblock rendering, number words, colours
src/utils/drag.js   pointer-based drag/drop + hit testing
src/utils/fx.js     confetti / particle bursts (Web Animations API)
src/utils/storage.js localStorage (stars, unlocked numbers, mute) + pub-sub
scripts/*.mjs       build-time tooling: audio generation, checks
```

**Scene contract.** A scene is a plain object with `mount(root, ctx)` and
`unmount()`. `ctx` is `{ sound, storage, stage, go }`. The router in `main.js`
wipes `#stage`, calls `unmount()` on the outgoing scene, then `mount()` on the
new one. Every scene keeps its own `timers` array and clears it in `unmount()` —
**follow this pattern or you will get callbacks firing into a dead DOM.**

**The games**

| Scene | Mechanic | Skill |
|---|---|---|
| `SnapBuilderScene` | Drag block onto block to merge; tap to count cube-by-cube. Celebrates every full ten, round ends at 50 | composition / addition |
| `FeedMonsterScene` | Cat asks for N (shuffled bag of 1–5); drag fruit to its mouth, each chomp counts up | one-to-one correspondence |
| `TowerJumpScene` | Staircase of 5 consecutive numbers with one gap; fill it, then the hero hops up counting | number sequence |
| `TracePopScene` | Hand-authored polyline glyphs (0–9, A–Z) hidden under bubbles; trace to pop, glyph is revealed | numeral/letter recognition |
| `MatchScene` | Digit tiles and number-word tiles in two columns; drag a line between a pair, or tap both | numeral ↔ word |
| `InstrumentsScene` | Tap instruments, each with its own synthesized voice | cause and effect / listening |
| `PuzzlePartsScene` | Pieces in a tray on the left, a picture with dashed holes on the right; drag each piece into its hole. `src/scenes/puzzles.js` holds the artwork: Numberblocks pictures and object pictures, weighted by `NUMBER_SHARE` | part-to-whole, numeral recognition, vocabulary |
| `ConnectDotsScene` | Numbered dots ring a picture; tap 1, 2, 3… and the outline draws itself, then fills and grows a face (`src/scenes/dots-shapes.js`) | counting order |
| `SortItScene` | Two bins, a row of toys; drag each toy to its bin. Four rules cycle: colour, size, kind, count | classification |
| `MemoryPairsScene` | 3x2 grid of flip cards, three pairs, themes cycle (Numberblocks 1-5, shapes, animals) | working memory |

---

## 4. The audio pipeline — read this before touching sound

This is where almost all the recent work went, and where the non-obvious
constraints live.

### Generation (build time)

`scripts/generate-voice.mjs` renders every spoken phrase to
`public/audio/<id>.wav` using Kokoro TTS locally. **102 files**: `number-1`..
`number-50`, `letter-A`..`letter-Z`, `feed-1`..`feed-5`, `part-*` (the puzzle
piece names), plus `yummy`, `hooray`, `hello`, `made-ten`, `made-20/30/40`,
`made-fifty`.

```bash
npm run voice                                      # only missing files
npm run voice -- --force                           # re-cut everything
VOICE=bf_emma npm run voice -- --force             # different voice
EMOTION=1.4 ONLY=made- npm run voice -- --force    # subset, stronger emotion
```

Current settings: **voice `af_heart`, speed 1.0, EMOTION 1.0.** The voice was
chosen by the project owner from a side-by-side audition of six candidates.

Every clip passes through `polish()` in `scripts/audio-util.mjs`:
**trim silence → pitch shift → peak-normalize to 0.89 → fade edges → write 16-bit PCM.**

> **Why this matters:** raw Kokoro output wraps ~0.4s of lead and ~0.6s of trail
> silence around each phrase. `number-1.wav` was 1.40s long containing 0.42s of
> speech. That produced a 400ms dead pause after every tap and threw counting out
> of sync with the animation. It read to the owner as "robotic" even though the
> voice itself was fine. **Never write a generated clip without `polish()`.** The
> generator previously called `audio.save()` when available, which bypassed it —
> that path was removed deliberately. Do not reintroduce it.

### Emotion

**Kokoro has no emotion control.** It cannot be told to sound excited. The
`PROFILES` table in `generate-voice.mjs` fakes it by raising pitch *and* pace,
which is what excited speech physically is. `rate` goes to the model's own speed
setting and `pitch` is applied afterwards by resampling; the generator divides
rate by pitch so the two do not double-count.

Profiles: `neutral` (counting — must stay clear), `bright` (prompts), `excited`
(praise/milestones), `party` (reaching fifty).

The owner has accepted this as good enough. They wanted genuinely cheerful
delivery and were told plainly that Kokoro at 82M parameters cannot do it. **If
this is revisited, the real answer is a more expressive engine (e.g. ElevenLabs
v3, which takes direction like `[excited]`).** It would need an API key and
network *at generation time only* — the game bakes to WAV and stays fully
offline. Wire it as an alternate generator behind the same `polish()` pipeline
so nothing else changes.

### Names and respelling

The repository ships **no personal names**. The hub's greeting row is built from
`src/players.js`, which defaults to two icon-only buttons and one shared
"Hello! Let's play!" line. Names belong in that file on a local checkout, never
in the git history and never hardcoded in a scene.

If you do add one, know that Kokoro's grapheme-to-phoneme reads spellings
literally, so an unusual name usually has to be respelled to come out the way it
is really said. **The respelling belongs in spoken text only** — the TTS source
in `scripts/generate-voice.mjs` and the fallback string passed to
`sound.say()` — never in what is rendered on screen.

### Playback (runtime) — the speech queue

`SoundManager` lazily fetches each phrase by id on first use and caches it, so
**dropping a new `<id>.wav` into `public/audio/` requires no code change.** A
missing file falls back to `speechSynthesis` (the robot voice).

**All speech is queued.** Each line plays to completion, then a 260ms gap
(`sound.gapMs`), then the next.

> **Why:** playback used to stop whatever was already speaking, and both the
> counting sequence and the tower hops ran on fixed ~640ms timers. Numbers in the
> thirties run ~0.80s, so they were guillotined mid-word, and round resets clipped
> the trailing name off the praise line. This was a reported bug.

Consequences you must preserve:

- `sound.speakSequence(items, { onStep, onDone })` drives sequences. `onStep`
  fires as each line **starts**, so **visuals follow the audio**, never a guessed
  interval. `TowerJumpScene`'s hop sequence and `SoundManager.countUp()` both use
  it. Measured hop intervals now vary per number (1019–1231ms) — that variation
  *is* the correctness signal.
- `sound.say(text, { interrupt: true })` is for **direct tap feedback** only
  (tapping a gallery block, a choice cube, a big merged block). It cancels the
  queue so a tap answers immediately instead of stacking behind earlier taps.
  Do not use it for sequences or praise.
- `sound.celebrate(text, { id })` fires the fanfare, then brings the voice in
  420ms later. **Do not call `fanfare()` and `say()` on the same tick** — the
  fanfare is six overlapping tones plus a noise sweep lasting ~1.1s and it buries
  the voice exactly when it should be the reward. All four scenes were fixed to
  use `celebrate()`.
- `MAX_QUEUE` is **12**, sized so `countUp(10)` never drops a number. If you add
  a longer sequence, raise it.
- `cancelSpeech()` clears the queue, bumps `_sayToken` (invalidating in-flight
  lazy loads), and clears all pending timers. The router calls it on every scene
  change.

---

## 5. Invariants that will silently break things

These are the traps. Each one has already caused a real bug.

1. **Never hardcode a list of phrase ids.** A hardcoded `PHRASE_IDS` array once
   drifted from what was on disk, so numbers 11–50 silently fell back to the
   robot voice while the correct WAVs sat unused. Loading is lazy by id now.
   `npm run check:audio` guards this.

2. **In Trace & Pop, bubble size and glyph stroke weight are independent.**
   `GLYPH_STROKE = 9` (in the 100×140 glyph box) is the *text* weight; bubble
   radius is separate and much larger (~12 units, so bubbles are ~2.7× the
   stroke). Tying them together made every glyph look like fat paint. Tying them
   the other way lets the glyph show through. `npm run check:glyphs` verifies the
   bubbles cover the stroke **including its edges** — an earlier version of that
   check only tested the path centreline and was effectively vacuous, passing
   while the glyph visibly bled through.

3. **Bubble spacing is constrained by stroke width.** The narrow "waist" between
   two neighbouring bubbles must be wider than half the stroke. If you change
   `GLYPH_STROKE` or the spacing factor (currently `rBubble * 1.15`), re-run
   `npm run check:glyphs` — it will fail loudly if coverage breaks.

4. **`scripts/package.json` must stay `"type": "module"`.** Installing kokoro
   into `scripts/` created that file with `"type": "commonjs"`, which shadowed the
   root setting and silently broke `npm run icons`.

5. **Touch scrolling is disabled app-wide** (`touchmove` is preventDefault'd in
   `main.js`, along with gesture zoom, context menu and double-tap). Never design
   a UI element that needs scrolling — e.g. the hub gallery caps its tiles rather
   than scrolling.

6. **Anything placed in `public/` ships to `dist/`.** The voice audition folders
   were 5MB and would have shipped. They are gitignored and have been deleted.

7. **Bump `CACHE_NAME` in `public/sw.js` whenever audio or shell assets change**,
   or installed iPads keep serving the old cache. Currently `nbp-v10`.

8. **`storage.unlockNumber()` accepts 1–50** (`MAX_NUMBER`). It used to silently
   filter to 1–10, so unlocking anything above ten did nothing.

9. **In the puzzle game a piece and its hole are the same markup.** One `svg`
   string per slot in `src/scenes/puzzles.js` is rendered twice: solid in the
   tray, and hollow/dashed in the picture by `.pp-slot:not(.filled)`. Never
   author a separate outline — a second copy of the geometry is a piece that
   stops fitting its hole the first time a shape is nudged.

10. **Hide puzzle decoration with `visibility`, never `display: none`.** Tray
    thumbnails crop to the slot group's `getBBox()`, and a `display: none` child
    is not in that box — the apple's stem and leaf then drew outside the crop
    and spilled over the edge of its tray card.

11. **The puzzle picture is `position: absolute; inset: 0` inside `.pp-board`.**
    As a normal flow child the SVG took its height from its own intrinsic ratio
    (the board's height is not a definite percentage base), so the picture was
    as tall as the board was wide and hung off the bottom of the stage.

12. **An absolutely positioned `<svg>` needs an explicit percentage width AND
    height — `inset` alone is not enough.** An SVG is a *replaced* element, so
    with `width/height: auto` it keeps its intrinsic size and ignores the
    opposite offsets. Tray pieces rendered at card width, square, anchored
    top-left, and hung out of their cards. This bit twice, in two different
    scenes; if artwork is clipped or off-centre, check this first.

13. **Tray thumbnails crop to a SQUARE whose fill fraction tracks the piece's
    real size** (`cropBox` in `PuzzlePartsScene`). Cropping tight blew every
    piece up to fill its card, so a nose came out the size of a roof.

14. **No two dots in a Connect the Dots picture may sit closer than 26 units.**
    Dots render ~20 units across, so anything tighter overlaps into one blob.
    `npm run check:dots` guards this — the boat's mast was authored 16 units
    wide and its base dots rendered as a single unreadable lump.

15. **Slots in one puzzle picture must not overlap each other.** Two dashed
    outlines crossing read as one tangled shape, and the drop test then has to
    choose between two holes under the same finger. This is why a Numberblock's
    face and arms are anchored on the bottom row and its missing cubes are
    always taken from the top row.

---

## 6. Recent work (most recent session)

All of the following is done, verified headless in Chromium (every game driven
to a win, zero console errors) and building clean.

**Four new games** — the hub went from 6 launchers to 10 (`.hub-grid` is now
5x2, which holds all ten with no odd cell out).

- `PuzzlePartsScene` + `src/scenes/puzzles.js` — "Where does it go?". A tray of
  pieces on the left, a picture with dashed holes on the right. A piece and its
  hole are rendered from the *same* SVG markup, so a piece can never fail to
  fit. Twelve pictures: six Numberblocks ones (three blocks on a shelf with
  their numerals missing underneath; one big Numberblock short of a cube, its
  face and its arms) and six object ones (face, cat, car, house, snowman, fruit
  basket), weighted 60/40 toward numbers by `NUMBER_SHARE`.
- `ConnectDotsScene` + `src/scenes/dots-shapes.js` — tap 1..N in order, the
  outline draws itself, then fills and grows a face. Six pictures. A faint
  dashed ghost of the finished outline sits under the dots: without it the dots
  read as scattered confetti and there is no promise of a payoff.
- `SortItScene` + `src/scenes/sort-sets.js` — two bins, a row of toys, four
  rules cycling (colour, size, kind, count; the count rule uses Numberblock
  colours). The held item's correct bin glows.
- `MemoryPairsScene` + `src/scenes/memoryThemes.js` — 3x2 flip cards, three
  pairs, real 3D `rotateY` flip, opening 1.5s face-up peek. Themes cycle:
  Numberblocks 1-5, shapes, animals.

Every one of them follows the same toddler contract as the older games: no fail
state, no timer, no score, a wrong answer costs nothing, the correct target
lights up while a piece is held, and a 7s idle nudge speaks and pulses. The
idle nudge is the concentration mechanism — a silent screen is what loses a
three-year-old.

**Layout bugs that bit twice** (now invariants 11-13)

- An absolutely positioned `<svg>` is a *replaced* element: with `width/height:
  auto` it keeps its intrinsic size and ignores the opposite offsets, so
  `inset: 0` alone does not stretch it. This clipped the puzzle picture off the
  bottom of the stage AND rendered every tray piece at card width, square,
  anchored top-left, hanging out of its card.
- Tray thumbnails cropped tight to each piece, so every piece scaled up to fill
  its card and a nose came out the size of a roof. They now crop to a square
  whose fill fraction tracks the piece's real size in the picture.

**New guard** — `npm run check:dots` asserts no two dots in a Connect the Dots
picture sit within 26 units. It caught the boat, whose mast was authored 16
units wide and whose two base dots rendered as one unreadable lump.

**Audio** — twelve `part-*.wav` piece names plus `part-arm` generated in
`af_heart`; `check:audio` is at 102/102 and `CACHE_NAME` is `nbp-v10`.

**Test scripts** (Python Playwright, all need the preview server on :4173):
`scripts/test-all.py` (every game, screenshots + console errors),
`test-parts.py`, `test-dots.py`, `test-sort.py`, `test-memory.py`.

---

### Earlier session

All of the following is done, verified in a real browser, and building clean.

**Audio**
- Replaced the drifting hardcoded phrase list with lazy per-id loading.
- Generated the 26 missing `letter-*.wav` files (letters had always used the
  robot voice).
- Added `scripts/audio-util.mjs`: trim / normalize / pitch / fade / 16-bit WAV,
  with a self-check in `npm test`.
- Re-cut all 89 files in `af_heart` with post-processing and emotion profiles.
- Moved the greeting row into `src/players.js` so no personal name is hardcoded.
- Replaced fire-and-forget speech with a completion-driven queue; sequences now
  advance on audio completion.
- Added `sound.celebrate()` so the fanfare no longer masks the praise line.

**Trace & Pop**
- Stroke ends were left uncovered (the sampler dropped each stroke's remainder),
  so the answer showed through and the bare tips had no bubble to pop. Affected
  9 of 36 glyphs.
- Decoupled glyph stroke weight from bubble size so the revealed glyph reads as
  normal text.

**Other**
- Hub gallery blocks were 13–21px slivers; they are now sized from their measured
  tile and re-size on rotate. Numbers above ten appear as bonus tiles.
- Tower Jump offered a distractor that was already visible on the staircase
  (distractors only excluded ±1/±2, but the visible window spans five numbers).
  Fixed and simulated over 200k rounds.
- Fixed `npm run icons`, removed dead code, rewrote `README.md`.

---

## 7. Open items

**Decided by the owner, do not re-litigate:** voice is `af_heart`; the emotion
ceiling is accepted; the game is single-child and single-language.

**Still open:**

1. **Tower Jump difficulty — needs an owner decision.** The staircase picks a
   random window anywhere in **1–50**, so a round can ask a 3-year-old to fill
   `46, ?, 48, 49, 50`. `README` originally described this game as 1–5; the code
   drifted upward deliberately (there is a comment saying so). This was raised
   with the owner and has **not been answered**. Options: weight toward low
   numbers, cap at ~20, or leave it. Do not change it unilaterally — it is a
   product decision.

2. **Celebration line wording.** An audition included reworded variants
   ("Hooray! Hooray! You did it!", "Woo hoo! Brilliant!") which give the TTS
   more room to modulate than three clipped words. The owner did not pick any, so
   the original wording is still shipping. Regenerate with
   `npm run voice:emotion` to audition again.

3. **A separate cheer/reaction sound** layered under the confetti (distinct from
   the spoken praise) was suggested but never built. `yay` / `woohoo` clips were
   auditioned.

4. **More expressive TTS engine** — see the Emotion section above.

---

## 8. Notes for an AI agent working on this

- The end user is a 3-year-old. "Correct" means *usable by a toddler*: big touch
  targets, no reading required, immediate feedback, nothing that punishes a wrong
  tap. Prefer this over technical elegance when they conflict.
- The owner tests on a real iPad and notices timing and audio problems that look
  fine in code review. When you change anything about sound or animation timing,
  **measure it in a browser** rather than reasoning about it.
- Prefer the smallest change that fixes the root cause. This codebase has no
  abstractions layered on speculation and should stay that way.
- Several bugs here were invisible to inspection and only showed up when actually
  measured (silence padding, sample truncation, glyph bleed). When something
  "looks fine but feels wrong", instrument it and get numbers.

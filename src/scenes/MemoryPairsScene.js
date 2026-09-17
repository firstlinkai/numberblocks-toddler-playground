import '../memory.css';
import { THEMES } from './memoryThemes.js';
import { sound } from '../audio/SoundManager.js';
import { confetti, burst } from '../utils/fx.js';

/* Game 11: Peek & Match
 * 3x2 grid, 3 pairs. Tap a card to flip it, tap another - a match locks in
 * and glows, a miss flips both back down. Themes (Numberblocks 1-5, shapes,
 * animals) cycle round to round; see memoryThemes.js for how each one draws
 * and announces its own items.
 *
 * Every round opens with all six cards shown face-up for a beat before
 * flipping down together: a 3-year-old needs that head start to have any
 * chance at the game, and the flip itself is the toy that pulls them in.
 */

const PREVIEW_MS = 1500;
const FLIP_MS = 560;       // matches the CSS transition on .mem-card-inner
const MISS_MS = 1100;
const IDLE_MS = 7000;
const TAP_SLOP = 24;       // finger wander tolerated before a tap is dropped

let timers = [];
let idleTimer = null;
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Same anti-repeat trick as MatchScene.pickRound, kept per-theme so cycling
 * through themes doesn't make the check compare unrelated pools. */
function pickItems(pool, prev) {
  let picked;
  do {
    picked = shuffle(pool).slice(0, 3);
  } while (prev && picked.every((v) => prev.includes(v)));
  return picked;
}

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('memory');

    const grid = document.createElement('div');
    grid.className = 'mem-grid';
    root.appendChild(grid);

    const state = {
      gen: 0,
      themeIdx: -1,
      theme: null,
      cards: [],
      flipped: [],
      busy: false,
      ready: false,
      matched: 0,
      press: null,
      lastItemsByTheme: {}
    };

    /* ---------- idle nudge: a silent grid is what loses a toddler ---------- */
    function clearIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    }

    function scheduleIdle() {
      clearIdle();
      idleTimer = setTimeout(() => { nudgeOnce(); scheduleIdle(); }, IDLE_MS);
      timers.push(idleTimer);
    }

    function nudgeOnce() {
      const candidates = state.cards.filter((c) =>
        !c.el.classList.contains('is-up') && !c.el.classList.contains('matched'));
      if (!candidates.length) return;
      const c = candidates[(Math.random() * candidates.length) | 0];
      c.el.classList.remove('nudge');
      void c.el.offsetWidth; // restart the keyframe
      c.el.classList.add('nudge');
      wait(700, () => c.el.classList.remove('nudge'));
    }

    /* ---------- round ---------- */
    function buildCard(item, i, theme) {
      const el = document.createElement('div');
      el.className = 'mem-card is-up';
      el.style.setProperty('--i', i);
      el.dataset.item = String(item);
      el.dataset.theme = theme.id;

      const inner = document.createElement('div');
      inner.className = 'mem-card-inner';

      const back = document.createElement('div');
      back.className = 'mem-face mem-back';

      const front = document.createElement('div');
      front.className = 'mem-face mem-front';
      front.appendChild(theme.makeFace(item));

      inner.append(back, front);
      el.appendChild(inner);
      return { el, item, matched: false };
    }

    function buildRound() {
      state.gen += 1;
      const gen = state.gen;
      clearIdle();
      state.flipped = [];
      state.busy = false;
      state.ready = false;
      state.matched = 0;
      state.press = null;

      state.themeIdx = (state.themeIdx + 1) % THEMES.length;
      const theme = THEMES[state.themeIdx];
      state.theme = theme;
      const items = pickItems(theme.pool, state.lastItemsByTheme[theme.id]);
      state.lastItemsByTheme[theme.id] = items;

      grid.innerHTML = '';
      grid.dataset.theme = theme.id;
      const pairs = shuffle([...items, ...items]);
      state.cards = pairs.map((item, i) => buildCard(item, i, theme));
      state.cards.forEach((c) => grid.appendChild(c.el));

      /* Show every face, then flip the whole grid down together - the flip
       * itself is what makes a fresh round worth looking at. */
      wait(PREVIEW_MS, () => {
        if (gen !== state.gen) return;
        state.cards.forEach((c) => c.el.classList.remove('is-up'));
        wait(FLIP_MS, () => {
          if (gen !== state.gen) return;
          state.ready = true;
          scheduleIdle();
        });
      });
    }

    /* ---------- matching ---------- */
    function cardCenter(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function resolveMatch(a, b) {
      sound.snap();
      a.matched = b.matched = true;
      a.el.classList.add('matched');
      b.el.classList.add('matched');
      const ca = cardCenter(a.el);
      const cb = cardCenter(b.el);
      burst((ca.x + cb.x) / 2, (ca.y + cb.y) / 2, { count: 16, size: [7, 14], dist: 90 });
      state.flipped = [];
      state.busy = false;
      state.matched += 1;
      if (state.matched === 3) onRoundComplete(); else scheduleIdle();
    }

    function resolveMiss(a, b) {
      sound.wobble();
      const gen = state.gen;
      wait(MISS_MS, () => {
        if (gen !== state.gen) return;
        a.el.classList.remove('is-up');
        b.el.classList.remove('is-up');
        state.flipped = [];
        state.busy = false;
        scheduleIdle();
      });
    }

    function onRoundComplete() {
      clearIdle();
      const gen = state.gen;
      wait(500, () => {
        if (gen !== state.gen) return;
        confetti({ count: 80 });
        sound.celebrate('Hooray! You did it!', { id: 'hooray' });
        ctx.storage.addStar(1);
        wait(2400, () => { if (gen === state.gen) buildRound(); });
      });
    }

    function handleTap(card) {
      if (!state.ready || state.busy) return;
      if (card.matched || card.el.classList.contains('is-up')) return; // toddler mash guard
      clearIdle();

      card.el.classList.add('is-up');
      const idx = state.theme.pool.indexOf(card.item);
      state.theme.speak(card.item, idx, sound);
      state.flipped.push(card);

      if (state.flipped.length < 2) { scheduleIdle(); return; }

      state.busy = true;
      const [a, b] = state.flipped;
      if (a.item === b.item) resolveMatch(a, b); else resolveMiss(a, b);
    }

    /* ---------- pointer: tap resolves on release, like MatchScene's tap
     * path, so a finger that slides off mid-press cancels instead of flipping
     * whatever it happened to land on. */
    function onPointerDown(e) {
      const el = e.target.closest('.mem-card');
      if (!el || state.press) return;
      e.preventDefault();
      sound.ensure();
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      state.press = { pointerId: e.pointerId, el, startX: e.clientX, startY: e.clientY, moved: false };
    }

    function onPointerMove(e) {
      const p = state.press;
      if (!p || e.pointerId !== p.pointerId) return;
      if (!p.moved && Math.hypot(e.clientX - p.startX, e.clientY - p.startY) > TAP_SLOP) p.moved = true;
    }

    function onPointerEnd(e) {
      const p = state.press;
      if (!p || e.pointerId !== p.pointerId) return;
      state.press = null;
      try { p.el.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (e.type === 'pointercancel' || p.moved) return;
      const card = state.cards.find((c) => c.el === p.el);
      if (card) handleTap(card);
    }

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerEnd);
    root.addEventListener('pointercancel', onPointerEnd);

    buildRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    sound.cancelSpeech();
  }
};

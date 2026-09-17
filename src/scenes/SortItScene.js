import '../sort.css';
import { FRUITS, ANIMALS, BALL_COLORS } from './sort-sets.js';
import { blockColor, makeBlock } from '../utils/blocks.js';
import { makeDraggable, returnHome, hitTest } from '../utils/drag.js';
import { sound } from '../audio/SoundManager.js';
import { confetti, burst } from '../utils/fx.js';

/* Game: Sort It!
 * Two open bins at the bottom, a handful of items floating above them - drag
 * each item to the bin it belongs in. Four rules cycle in a shuffled order:
 * colour, size, kind (fruit vs animal) and count (Numberblock One vs Two).
 *
 * Toddler rules, same spirit as PuzzlePartsScene:
 *  - Bins are never labelled with text, only an icon / colour swatch / dot
 *    count - a three-year-old cannot read.
 *  - The moment an item is picked up, its own correct bin glows: the reward
 *    here is the sorting itself, not making a toddler hunt for the answer.
 *  - A wrong drop costs nothing - the item floats back to where it was
 *    picked up from, the bin it landed in wobbles, and the right bin pulses.
 *  - After 7s of no touching, one unsorted item and its bin nudge each
 *    other - the idle nudge is the whole concentration mechanism here.
 *  - No score, no timer, no fail state: every round ends with every item
 *    sorted, always.
 */

const RULES = ['color', 'size', 'kind', 'count'];
const IDLE_NUDGE_MS = 7000;

/* Item footprints (all comfortably over the 90px toddler-target floor). */
/* Item sizes in px. Sized up from a first pass that left a dead band of empty
 * screen between the toys and the bins and made the toys look like crumbs next
 * to them - six items still fit the row (slot width is ~169px at 1180). */
const BIG = 172, SMALL = 110, MED = 150, CARD = 140, COLOR_ITEM = 144;

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

function ball(size, color) {
  const b = document.createElement('div');
  b.className = 'sort-toy';
  b.style.width = size + 'px';
  b.style.height = size + 'px';
  b.style.setProperty('--c', color);
  return b;
}

/* Every rule hands back { a, b } - which physical side gets which meaning is
 * decided by the caller (`flipped`) so a child can't just learn "left wins". */
function pair(flipped, meta0, meta1) {
  return flipped ? { a: meta1, b: meta0 } : { a: meta0, b: meta1 };
}

function colorContent(flipped) {
  const shapes = ['sort-shape-circle', 'sort-shape-square'];
  const pickShape = () => shapes[(Math.random() * shapes.length) | 0];
  const meta0 = {
    tint: 'tint-red', renderLabel: null, itemSize: COLOR_ITEM,
    renderItem: (el) => el.classList.add('tint-red', pickShape())
  };
  const meta1 = {
    tint: 'tint-blue', renderLabel: null, itemSize: COLOR_ITEM,
    renderItem: (el) => el.classList.add('tint-blue', pickShape())
  };
  return pair(flipped, meta0, meta1);
}

function sizeContent(flipped) {
  const ICON_COLOR = '#94a3b8';
  const randColor = () => BALL_COLORS[(Math.random() * BALL_COLORS.length) | 0];
  const meta0 = {
    tint: null, itemSize: BIG,
    renderLabel: (chip) => chip.appendChild(ball(46, ICON_COLOR)),
    renderItem: (el) => { el.classList.add('sort-toy'); el.style.setProperty('--c', randColor()); }
  };
  const meta1 = {
    tint: null, itemSize: SMALL,
    renderLabel: (chip) => chip.appendChild(ball(26, ICON_COLOR)),
    renderItem: (el) => { el.classList.add('sort-toy'); el.style.setProperty('--c', randColor()); }
  };
  return pair(flipped, meta0, meta1);
}

function kindContent(flipped) {
  const meta0 = {
    tint: 'tint-fruit', itemSize: MED,
    renderLabel: (chip) => { chip.textContent = '🍎'; chip.classList.add('sort-label-emoji'); },
    renderItem: (el) => {
      el.classList.add('sort-emoji-item');
      const span = document.createElement('span');
      span.className = 'sort-emoji';
      span.style.fontSize = Math.round(MED * 0.56) + 'px';
      span.textContent = FRUITS[(Math.random() * FRUITS.length) | 0];
      el.appendChild(span);
    }
  };
  const meta1 = {
    tint: 'tint-animal', itemSize: MED,
    renderLabel: (chip) => { chip.textContent = '🐶'; chip.classList.add('sort-label-emoji'); },
    renderItem: (el) => {
      el.classList.add('sort-emoji-item');
      const span = document.createElement('span');
      span.className = 'sort-emoji';
      span.style.fontSize = Math.round(MED * 0.56) + 'px';
      span.textContent = ANIMALS[(Math.random() * ANIMALS.length) | 0];
      el.appendChild(span);
    }
  };
  return pair(flipped, meta0, meta1);
}

/* Numberblock One and Two double as the bin labels AND set the colour of
 * each item's dots - the show always pairs a value with the same colour, so
 * leaning on that (rather than fighting it with neutral dots) is the more
 * Numberblocks-authentic version of this round. */
function countContent(flipped) {
  const meta0 = {
    tint: null, itemSize: CARD,
    renderLabel: (chip) => chip.appendChild(makeBlock(1, { unit: 50 })),
    renderItem: (el) => {
      el.classList.add('sort-count-item');
      const dot = document.createElement('span');
      dot.className = 'sort-dot';
      dot.style.setProperty('--c', blockColor(1));
      el.appendChild(dot);
    }
  };
  const meta1 = {
    tint: null, itemSize: CARD,
    renderLabel: (chip) => chip.appendChild(makeBlock(2, { unit: 50 })),
    renderItem: (el) => {
      el.classList.add('sort-count-item');
      for (let i = 0; i < 2; i++) {
        const dot = document.createElement('span');
        dot.className = 'sort-dot';
        dot.style.setProperty('--c', blockColor(2));
        el.appendChild(dot);
      }
    }
  };
  return pair(flipped, meta0, meta1);
}

function buildContent(rule, flipped) {
  if (rule === 'color') return colorContent(flipped);
  if (rule === 'size') return sizeContent(flipped);
  if (rule === 'kind') return kindContent(flipped);
  return countContent(flipped);
}

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('sort');

    const state = { rule: null, queueRules: [], items: [], binEls: { a: null, b: null }, gen: 0 };

    function clearIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    }

    function nudgeOnce() {
      const open = state.items.filter((it) => !it.sorted);
      if (!open.length) return;
      const it = open[(Math.random() * open.length) | 0];
      const binEl = state.binEls[it.bin];
      it.el.classList.remove('nudge'); void it.el.offsetWidth; it.el.classList.add('nudge');
      binEl.classList.remove('nudge'); void binEl.offsetWidth; binEl.classList.add('nudge');
      wait(1300, () => { it.el.classList.remove('nudge'); binEl.classList.remove('nudge'); });
    }

    function scheduleIdle() {
      clearIdle();
      idleTimer = setTimeout(() => { nudgeOnce(); scheduleIdle(); }, IDLE_NUDGE_MS);
      timers.push(idleTimer);
    }

    /* Nothing is ever lost: a correct drop settles the item into a spot
     * inside its bin (pre-computed per round so several items never stack
     * on top of each other) and checks whether the round is done. */
    function land(it, binEl) {
      const gen = state.gen;
      it.sorted = true;
      sound.snap();
      returnHome(it.el, it.nestX, it.nestY, () => {
        if (gen !== state.gen) return;
        it.el.style.transform = `scale(${it.nestScale})`;
        it.el.classList.add('sorted', 'locked', 'pop');
        wait(450, () => it.el.classList.remove('pop'));
      });
      const rr = root.getBoundingClientRect();
      const cx = rr.left + it.nestX + (it.size * it.nestScale) / 2;
      const cy = rr.top + it.nestY + (it.size * it.nestScale) / 2;
      wait(280, () => { if (gen === state.gen) burst(cx, cy, { count: 10, size: [6, 12], dist: 55 }); });

      if (state.items.every((x) => x.sorted)) {
        clearIdle();
        wait(650, () => {
          if (gen !== state.gen) return;
          confetti({ count: 80 });
          sound.celebrate('Hooray! You did it!', { id: 'hooray' });
          ctx.storage.addStar(1);
          wait(2400, () => { if (gen === state.gen) buildRound(); });
        });
      } else {
        scheduleIdle();
      }
    }

    /* A wrong drop costs nothing: the item floats back to where it was
     * picked up, the bin it landed in wobbles, and the right one pulses. */
    function wrongDrop(it, wrongBinEl, correctEl, origX, origY) {
      sound.wobble();
      wrongBinEl.classList.remove('shake'); void wrongBinEl.offsetWidth; wrongBinEl.classList.add('shake');
      wait(450, () => wrongBinEl.classList.remove('shake'));
      correctEl.classList.remove('pop'); void correctEl.offsetWidth; correctEl.classList.add('pop');
      wait(500, () => correctEl.classList.remove('pop'));
      returnHome(it.el, origX, origY);
      scheduleIdle();
    }

    function buildRound() {
      state.gen += 1;
      clearIdle();
      root.querySelectorAll('.sort-item, .sort-bin').forEach((el) => el.remove());

      if (!state.queueRules.length) {
        const q = shuffle(RULES);
        if (state.rule && q[0] === state.rule) [q[0], q[1]] = [q[1], q[0]];
        state.queueRules = q;
      }
      state.rule = state.queueRules.shift();
      root.dataset.rule = state.rule;   // read by scripts/test-sort.py

      const binA = document.createElement('div');
      binA.className = 'sort-bin sort-bin-a';
      const binB = document.createElement('div');
      binB.className = 'sort-bin sort-bin-b';
      root.append(binA, binB);
      state.binEls = { a: binA, b: binB };

      const flipped = Math.random() < 0.5;
      const content = buildContent(state.rule, flipped);

      ['a', 'b'].forEach((side) => {
        const el = state.binEls[side];
        const meta = content[side];
        if (meta.tint) el.classList.add(meta.tint);
        if (meta.renderLabel) {
          const chip = document.createElement('div');
          chip.className = 'sort-bin-label';
          meta.renderLabel(chip);
          el.appendChild(chip);
        }
      });

      /* Big balls crowd a bin fast, so the size round asks for one fewer. */
      const n = state.rule === 'size'
        ? 4 + Math.floor(Math.random() * 2)
        : 4 + Math.floor(Math.random() * 3);
      const half = Math.floor(n / 2);
      const sidesPool = shuffle([...Array(half).fill('a'), ...Array(n - half).fill('b')]);

      const rr = root.getBoundingClientRect();
      const items = sidesPool.map((side) => {
        const meta = content[side];
        const el = document.createElement('div');
        el.className = 'sort-item';
        el.dataset.bin = side;            // read by scripts/test-sort.py
        el.style.width = meta.itemSize + 'px';
        el.style.height = meta.itemSize + 'px';
        meta.renderItem(el);
        root.appendChild(el);
        return { el, bin: side, size: meta.itemSize, sorted: false };
      });
      state.items = items;

      /* Scattered in a single row above the bins - evenly spaced with a
       * gentle up/down stagger so it reads as toys laid out, not a grid. */
      const marginX = rr.width * 0.07;
      const rowW = rr.width - marginX * 2;
      const rowY = rr.height * 0.34;
      items.forEach((it, i) => {
        const slotW = rowW / items.length;
        const cx = marginX + slotW * (i + 0.5);
        const cy = rowY + (i % 2 === 0 ? -12 : 12);
        it.el.style.left = (cx - it.size / 2) + 'px';
        it.el.style.top = (cy - it.size / 2) + 'px';
      });

      /* One resting spot per item, inside its OWN correct bin, computed now
       * (not on drop) so several correct drops never land on top of each
       * other. Items shrink a touch if a bin has to hold several. */
      ['a', 'b'].forEach((side) => {
        const binEl = state.binEls[side];
        const br = binEl.getBoundingClientRect();
        const list = items.filter((it) => it.bin === side);
        if (!list.length) return;
        const itemSize = list[0].size;
        const scale = Math.max(0.55, Math.min(1, (br.width * 0.78) / (list.length * itemSize * 1.15)));
        list.forEach((it, i) => {
          const cx = br.left + br.width * 0.11 + br.width * 0.78 * ((i + 0.5) / list.length);
          const cy = br.top + br.height * 0.64;
          it.nestX = cx - rr.left - (itemSize * scale) / 2;
          it.nestY = cy - rr.top - (itemSize * scale) / 2;
          it.nestScale = scale;
        });
      });

      items.forEach((it) => {
        makeDraggable(it.el, {
          bounds: root,
          getOrigin: () => ({ x: parseFloat(it.el.style.left) || 0, y: parseFloat(it.el.style.top) || 0 }),
          onStart: () => {
            sound.ensure();
            clearIdle();
            state.binEls[it.bin].classList.add('glow');
          },
          onEnd: (e, { tap, origX, origY }) => {
            state.binEls[it.bin].classList.remove('glow');
            if (tap) { scheduleIdle(); return; }
            const r = it.el.getBoundingClientRect();
            const hit = hitTest(r.left + r.width / 2, r.top + r.height / 2, '.sort-bin', it.el);
            const correctEl = state.binEls[it.bin];
            if (hit === correctEl) land(it, correctEl);
            else if (hit) wrongDrop(it, hit, correctEl, origX, origY);
            else { returnHome(it.el, origX, origY); scheduleIdle(); }
          }
        });
      });

      scheduleIdle();
    }

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

import { inkColor } from '../utils/blocks.js';
import { burst, confetti, rewardAt } from '../utils/fx.js';
import { sound } from '../audio/SoundManager.js';

/* Game 4: Trace & Pop
 * A big numeral is filled with glossy bubbles. Tracing a finger over the
 * bubbles pops them; when the numeral is fully popped, the Numberblock
 * character reveals itself with a cheer. */

let timers = [];
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

/* Stroke weight of the revealed glyph, in the 100x140 glyph box - i.e. the
 * thickness of ordinary text, NOT tied to how big the bubbles are. The glyph
 * is ~100 units tall once scaled, so this reads as a normal pen weight. The
 * bubbles covering it are far wider (radius ~12 units), which is what lets
 * them hide a thin glyph completely. */
const GLYPH_STROKE = 9;

/* Digit skeletons in a normalized 100x140 box (strokes = point polylines) */
function ellipsePts(cx, cy, rx, ry, steps = 30) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

const STROKES = {
  1: [{ pts: [[54, 22], [46, 120]] }],
  2: [{ pts: [[26, 50], [34, 26], [58, 20], [74, 38], [68, 62], [30, 118], [76, 118]] }],
  3: [{ pts: [[30, 32], [50, 20], [72, 36], [60, 64], [46, 70], [68, 82], [72, 104], [50, 122], [28, 110]] }],
  4: [{ pts: [[58, 22], [22, 80], [80, 80]] }, { pts: [[58, 22], [54, 120]] }],
  5: [{ pts: [[72, 24], [36, 24], [33, 64], [54, 58], [72, 74], [68, 102], [44, 120], [26, 106]] }],
  6: [{ pts: [[70, 28], [52, 20], [34, 44], [28, 84], [36, 112], [56, 120], [72, 104], [68, 82], [50, 74], [34, 84]] }],
  7: [{ pts: [[28, 24], [76, 24], [50, 120]] }],
  8: [{ pts: ellipsePts(50, 46, 18, 23) }, { pts: ellipsePts(50, 99, 22, 25) }],
  9: [{ pts: ellipsePts(50, 50, 19, 24) }, { pts: [[66, 64], [56, 118]] }],
  0: [{ pts: ellipsePts(50, 70, 24, 48) }]
};

const LETTER_STROKES = {
  A: [{ pts: [[20, 120], [50, 20], [80, 120]] }, { pts: [[33, 84], [67, 84]] }],
  B: [{ pts: [[25, 20], [70, 22], [80, 42], [68, 60], [25, 62]] }, { pts: [[25, 62], [72, 66], [82, 88], [68, 112], [25, 120]] }, { pts: [[25, 20], [25, 120]] }],
  C: [{ pts: [[75, 32], [55, 20], [32, 26], [20, 55], [20, 85], [32, 114], [55, 120], [75, 108]] }],
  D: [{ pts: [[25, 20], [25, 120]] }, { pts: [[25, 20], [58, 24], [78, 50], [78, 90], [58, 116], [25, 120]] }],
  E: [{ pts: [[75, 20], [25, 20], [25, 120], [75, 120]] }, { pts: [[25, 68], [62, 68]] }],
  F: [{ pts: [[75, 20], [25, 20], [25, 120]] }, { pts: [[25, 68], [60, 68]] }],
  G: [{ pts: [[75, 32], [55, 20], [32, 26], [20, 55], [20, 85], [32, 114], [55, 120], [74, 108], [76, 88], [56, 86]] }],
  H: [{ pts: [[25, 20], [25, 120]] }, { pts: [[75, 20], [75, 120]] }, { pts: [[25, 70], [75, 70]] }],
  I: [{ pts: [[50, 20], [50, 120]] }, { pts: [[32, 20], [68, 20]] }, { pts: [[32, 120], [68, 120]] }],
  J: [{ pts: [[68, 20], [68, 98], [54, 118], [34, 112], [27, 94]] }],
  K: [{ pts: [[25, 20], [25, 120]] }, { pts: [[72, 20], [30, 68], [74, 120]] }],
  L: [{ pts: [[25, 20], [25, 120], [74, 120]] }],
  M: [{ pts: [[20, 120], [20, 20], [50, 76], [80, 20], [80, 120]] }],
  N: [{ pts: [[25, 120], [25, 20], [75, 120], [75, 20]] }],
  O: [{ pts: ellipsePts(50, 70, 26, 50) }],
  P: [{ pts: [[25, 120], [25, 20], [70, 22], [80, 42], [68, 62], [25, 64]] }],
  Q: [{ pts: ellipsePts(50, 70, 26, 50) }, { pts: [[58, 96], [80, 122]] }],
  R: [{ pts: [[25, 120], [25, 20], [70, 22], [80, 42], [68, 62], [25, 64]] }, { pts: [[38, 64], [75, 120]] }],
  S: [{ pts: [[74, 32], [56, 20], [34, 26], [26, 44], [34, 62], [52, 70], [66, 78], [74, 96], [66, 114], [44, 120], [26, 108]] }],
  T: [{ pts: [[50, 20], [50, 120]] }, { pts: [[24, 20], [76, 20]] }],
  U: [{ pts: [[25, 20], [25, 92], [36, 114], [50, 120], [64, 114], [75, 92], [75, 20]] }],
  V: [{ pts: [[25, 20], [50, 120], [75, 20]] }],
  W: [{ pts: [[18, 20], [32, 120], [50, 62], [68, 120], [82, 20]] }],
  X: [{ pts: [[25, 20], [75, 120]] }, { pts: [[75, 20], [25, 120]] }],
  Y: [{ pts: [[25, 20], [50, 66], [75, 20]] }, { pts: [[50, 66], [50, 120]] }],
  Z: [{ pts: [[25, 20], [75, 20], [25, 120], [75, 120]] }]
};

/* A round symbol = a number (1-20) or a letter (A-Z), always random */
function randomSymbol(exclude) {
  let s;
  do {
    if (Math.random() < 0.45) {
      s = { kind: 'number', value: 1 + Math.floor(Math.random() * 20) };
    } else {
      s = { kind: 'letter', ch: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)] };
    }
  } while (exclude && s.kind === exclude.kind &&
           (s.kind === 'letter' ? s.ch === exclude.ch : s.value === exclude.value));
  return s;
}

function symbolKey(sym) {
  return sym.kind === 'letter' ? sym.ch : String(sym.value);
}

function strokesFor(sym) {
  if (sym.kind === 'letter') return LETTER_STROKES[sym.ch];
  const str = String(sym.value);
  if (str.length === 1) return STROKES[str];
  /* multi-digit: glyphs side by side */
  const out = [];
  [...str].forEach((d, i) => {
    const off = (i - (str.length - 1) / 2) * 62;
    STROKES[d].forEach((s) => {
      out.push({ pts: s.pts.map(([x, y]) => [x + off, y]) });
    });
  });
  return out;
}

function boxWidthUnits(sym) {
  if (sym.kind === 'letter') return 100;
  return 100 + 62 * (String(sym.value).length - 1);
}

/* Evenly sample bubble centers along every stroke (normalized coords).
 * The final point of each stroke is always emitted: walking by a fixed
 * spacing leaves a remainder shorter than `spacing`, and without this the
 * stroke tip stayed uncovered - the glyph showed through before tracing and
 * the exposed tip had no bubble to pop. */
function bubblePositions(strokes, spacing = 15) {
  const out = [];
  strokes.forEach((s) => {
    let last = s.pts[0];
    const first = out.length;
    out.push([last[0], last[1]]);
    let carry = 0;
    for (let i = 1; i < s.pts.length; i++) {
      let cur = s.pts[i];
      let seg = Math.hypot(cur[0] - last[0], cur[1] - last[1]);
      while (carry + seg >= spacing) {
        const t = (spacing - carry) / seg;
        const p = [last[0] + (cur[0] - last[0]) * t, last[1] + (cur[1] - last[1]) * t];
        out.push(p);
        last = p;
        seg = Math.hypot(cur[0] - last[0], cur[1] - last[1]);
        carry = 0;
      }
      carry += seg;
      last = cur;
    }
    /* cap the stroke end, unless a sample already sits practically on it */
    const end = s.pts[s.pts.length - 1];
    const prev = out[out.length - 1];
    if (out.length === first || Math.hypot(end[0] - prev[0], end[1] - prev[1]) > spacing * 0.25) {
      out.push([end[0], end[1]]);
    }
  });
  return out;
}

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('trace');

    const state = { symbol: null, popped: 0, total: 0, busy: false, gen: 0, block: null };
    let bubbles = [];
    let box = null;
    let tracing = false;

    /* ---------- build / layout the numeral ---------- */
    function buildNumeral(sym) {
      state.symbol = sym || randomSymbol(state.symbol);
      state.popped = 0;
      state.busy = false;
      state.block = null;
      state.gen += 1;
      layoutNumeral();
    }

    function saySymbol() {
      if (state.symbol.kind === 'number') sound.number(state.symbol.value);
      else sound.say(state.symbol.ch + '!', { id: 'letter-' + state.symbol.ch });
    }

    function layoutNumeral() {
      if (box) box.remove();
      box = document.createElement('div');
      box.className = 'trace-box';
      box.dataset.symbol = symbolKey(state.symbol);

      const rh = root.clientHeight;
      const rw = root.clientWidth;
      const bw = boxWidthUnits(state.symbol);
      const h = Math.max(220, Math.min(rh * 0.8, rw * 0.5 * (140 / bw)));
      const w = h * (bw / 140);
      const scale = h / 140;
      box.style.width = w + 'px';
      box.style.height = h + 'px';
      root.appendChild(box);

      /* Big bubbles over a NORMAL-WEIGHT glyph. The two sizes are deliberately
       * independent: the bubbles stay chunky and easy for a small finger to
       * hit, while the letter or numeral underneath keeps the stroke weight of
       * ordinary text. Tying the stroke to the bubble size made every glyph
       * look like fat paint. */
      const rBubble = Math.max(22, Math.min(58, scale * 12));
      /* Spacing keeps the narrow "waist" between two neighbouring bubbles
       * wider than the stroke behind them, so the glyph cannot show through
       * the gaps and give the answer away before it is traced. */
      const spacing = Math.max(9, (rBubble * 1.15) / scale);

      /* the chunky glyph stroke waits BEHIND the bubbles - it follows the
       * exact same path, so bubbles cover it completely until they pop.
       * scaled to 0.7 so the glyph keeps the classic text size */
      const S = 0.7;
      const cx = bw / 2;
      const scaled = strokesFor(state.symbol).map((s) => ({
        pts: s.pts.map(([x, y]) => [cx + (x - 50) * S, 70 + (y - 70) * S])
      }));

      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('class', 'trace-digit');
      svg.setAttribute('viewBox', `0 0 ${bw} 140`);
      const color = state.symbol.kind === 'number'
        ? inkColor(state.symbol.value)
        : inkColor(state.symbol.ch.charCodeAt(0));
      scaled.forEach((s) => {
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', 'M ' + s.pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L '));
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', color);
        path.setAttribute('stroke-width', String(GLYPH_STROKE));
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);
      });
      state.block = svg;
      box.appendChild(svg);

      const positions = bubblePositions(scaled, spacing);

      bubbles = positions.map((p, i) => {
        const b = document.createElement('div');
        b.className = 'pop-bubble';
        const d = rBubble * 2;
        b.style.width = d + 'px';
        b.style.height = d + 'px';
        b.style.left = (p[0] * scale - rBubble) + 'px';
        b.style.top = (p[1] * scale - rBubble) + 'px';
        b.style.setProperty('--d', (i * 35) + 'ms');
        box.appendChild(b);
        return { el: b, bx: p[0] * scale, by: p[1] * scale, r: rBubble * 1.2, popped: false };
      });
      state.total = bubbles.length;
      saySymbol();
    }

    /* ---------- tracing ---------- */
    function popAt(e) {
      if (!box || state.busy) return;
      const rect = box.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      for (const b of bubbles) {
        if (b.popped) continue;
        if (Math.hypot(x - b.bx, y - b.by) <= b.r) {
          b.popped = true;
          b.el.classList.add('popped');
          sound.bubble(state.popped);
          state.popped += 1;
          burst(rect.left + b.bx, rect.top + b.by, { count: 5, size: [5, 10], dist: 45 });
          if (state.popped >= state.total) reveal();
          break;
        }
      }
    }

    function onPointerDown(e) {
      if (e.target.closest('.nav-btn')) return;
      tracing = true;
      sound.ensure();
      try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      popAt(e);
    }
    function onPointerMove(e) { if (tracing) popAt(e); }
    function onPointerUp() { tracing = false; }

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);

    /* ---------- reveal celebration ---------- */
    function reveal() {
      state.busy = true;
      box.classList.add('done');
      const gen = state.gen;
      wait(350, () => {
        if (gen !== state.gen) return;
        if (state.block) state.block.classList.add('pop');
        confetti({ count: 85 });
        sound.fanfare();
        wait(420, () => { if (gen === state.gen) saySymbol(); });
        wait(1100, () => {
          if (gen !== state.gen) return;
          sound.say('Hooray!', { id: 'hooray' });
        });
        if (state.block) rewardAt(state.block);
        ctx.storage.addStar(1);
        if (state.symbol.kind === 'number') ctx.storage.unlockNumber(state.symbol.value);
        wait(2700, () => {
          if (gen !== state.gen) return;
          buildNumeral(randomSymbol(state.symbol));
        });
      });
    }

    /* ---------- prev / next numeral controls ---------- */
    const prevBtn = document.createElement('button');
    prevBtn.className = 'nav-btn nav-prev';
    prevBtn.innerHTML = '◀';
    prevBtn.setAttribute('aria-label', 'Previous number');
    prevBtn.addEventListener('click', () => {
      if (state.busy) return;
      sound.pick();
      buildNumeral(randomSymbol(state.symbol));
    });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'nav-btn nav-next';
    nextBtn.innerHTML = '▶';
    nextBtn.setAttribute('aria-label', 'Next number');
    nextBtn.addEventListener('click', () => {
      if (state.busy) return;
      sound.pick();
      buildNumeral(randomSymbol(state.symbol));
    });

    root.append(prevBtn, nextBtn);
    buildNumeral();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    sound.cancelSpeech();
  }
};

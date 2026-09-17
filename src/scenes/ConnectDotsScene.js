import '../dots.css';
import { DOT_SHAPES } from './dots-shapes.js';
import { sound } from '../audio/SoundManager.js';
import { confetti, burst } from '../utils/fx.js';

/* Game 9: Connect the Dots
 * Numbered dots ring the outline of a picture. Tapping them 1, 2, 3... draws
 * the line from the dot before it, speaks the number and pops the dot; the
 * last dot closes the outline, fills it with colour and gives it a face.
 *
 * Coordinates for every line come straight from dots-shapes.js: both ends of
 * a segment are authored in the same 0-200 box the dots are placed in, so a
 * segment never needs measuring live DOM positions the way a drag-and-drop
 * game does - it is just two numbers out of the same array.
 *
 * Toddler rules, all deliberate:
 *  - The next dot always pulses (a CSS animation on `.next`, not a timer) so
 *    the child is never scanning for where to go.
 *  - A wrong dot costs nothing: a wobble, and the right dot bounces harder.
 *  - After 7s of no touching, the next dot bounces again and its number is
 *    spoken - the idle nudge, not a fail state, is what keeps this game
 *    holding a three-year-old's attention.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const IDLE_NUDGE_MS = 7000;

let timers = [];
let idleTimer = null;
let onResize = null;
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

/* One face generator for every picture: two eyes and a smile anchored on the
 * {cx, cy, r} each shape supplies, styled like the rest of the app's faces
 * (white eye, dark pupil, a soft pink mouth) rather than one-off art. */
function faceMarkup({ cx, cy, r }) {
  const dx = r * 0.55, dy = -r * 0.08;
  const rx = r * 0.24, ry = r * 0.28, pr = r * 0.12;
  const my = cy + r * 0.42;
  return `
    <ellipse cx="${cx - dx}" cy="${cy + dy}" rx="${rx}" ry="${ry}" fill="#ffffff" stroke="#3b3355" stroke-width="3"/>
    <ellipse cx="${cx + dx}" cy="${cy + dy}" rx="${rx}" ry="${ry}" fill="#ffffff" stroke="#3b3355" stroke-width="3"/>
    <circle cx="${cx - dx}" cy="${cy + dy + pr * 0.4}" r="${pr}" fill="#3b3355"/>
    <circle cx="${cx + dx}" cy="${cy + dy + pr * 0.4}" r="${pr}" fill="#3b3355"/>
    <path d="M ${cx - r * 0.5} ${my} Q ${cx} ${my + r * 0.55} ${cx + r * 0.5} ${my}"
          fill="none" stroke="#a83a4c" stroke-width="${Math.max(3, r * 0.14)}" stroke-linecap="round"/>
  `;
}

function pickShape(prev) {
  const pool = DOT_SHAPES.filter((s) => !prev || s.id !== prev.id);
  return pool[(Math.random() * pool.length) | 0];
}

export default {
  mount(root, ctx) {
    timers = [];
    idleTimer = null;
    root.classList.add('dots-scene');

    const wrap = document.createElement('div');
    wrap.className = 'dots-wrap';
    const board = document.createElement('div');
    board.className = 'dots-board';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'dots-svg');
    svg.setAttribute('viewBox', '0 0 200 200');
    const dotsLayer = document.createElement('div');
    dotsLayer.className = 'dots-layer';
    board.append(svg, dotsLayer);
    wrap.appendChild(board);
    root.appendChild(wrap);

    const state = { shape: null, next: 0, busy: false, gen: 0 };
    let dotEls = [];
    let fillEl = null;
    let linesEl = null;
    let faceEl = null;

    /* The board is kept a true square in real pixels (not CSS aspect-ratio)
     * so the dots, placed by plain percentages, land exactly on the SVG's
     * own 0-200 coordinates with no letterboxing math to keep in sync. */
    function layout() {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      const size = Math.max(260, Math.min(w, h));
      board.style.width = size + 'px';
      board.style.height = size + 'px';
    }
    onResize = layout;
    window.addEventListener('resize', onResize);

    function toClient(x, y) {
      const r = board.getBoundingClientRect();
      return { x: r.left + (x / 200) * r.width, y: r.top + (y / 200) * r.height };
    }

    function dotCenter(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    /* ---------- idle nudge ---------- */
    function clearIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    }

    function bounceNext() {
      const dot = dotEls[state.next];
      if (!dot) return;
      dot.classList.remove('boost');
      void dot.offsetWidth;
      dot.classList.add('boost');
      wait(560, () => dot.classList.remove('boost'));
    }

    function nudgeOnce() {
      if (!dotEls[state.next]) return;
      bounceNext();
      sound.number(state.next + 1, { interrupt: true });
    }

    function scheduleIdle() {
      clearIdle();
      idleTimer = setTimeout(() => { nudgeOnce(); scheduleIdle(); }, IDLE_NUDGE_MS);
      timers.push(idleTimer);
    }

    function setNext(i) {
      state.next = i;
      dotEls.forEach((d, idx) => d.classList.toggle('next', idx === i));
    }

    /* ---------- drawing ---------- */
    function drawSegment(a, b) {
      const [x1, y1] = state.shape.dots[a];
      const [x2, y2] = state.shape.dots[b];
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', state.shape.stroke);
      line.setAttribute('stroke-width', '6');
      line.setAttribute('stroke-linecap', 'round');
      /* .match-line (style.css) is the app's existing "draw itself on" line -
       * same dasharray/--len trick, reused rather than reinvented here. */
      line.setAttribute('class', 'match-line dot-line');
      const len = Math.hypot(x2 - x1, y2 - y1);
      line.style.strokeDasharray = String(len);
      line.style.setProperty('--len', String(len));
      linesEl.appendChild(line);
    }

    /* ---------- round ---------- */
    function renderShape() {
      const s = state.shape;
      const pts = s.dots.map(([x, y]) => `${x},${y}`).join(' ');
      /* A faint dashed ghost of the finished outline sits under everything.
       * Without it the dots read as scattered confetti and a three-year-old
       * has no idea a picture is coming - the ghost is the promise that makes
       * him want to join the next one. */
      svg.innerHTML =
        `<polygon class="dot-ghost" points="${pts}" fill="none" stroke="${s.stroke}" stroke-width="5"/>` +
        `<polygon class="dot-fill" points="${pts}" fill="${s.fill}" stroke="${s.stroke}" stroke-width="6"/>` +
        `<g class="dot-lines"></g>` +
        `<g class="dot-face">${faceMarkup(s.face)}</g>`;
      linesEl = svg.querySelector('.dot-lines');
      fillEl = svg.querySelector('.dot-fill');
      faceEl = svg.querySelector('.dot-face');
    }

    function renderDots() {
      dotsLayer.innerHTML = '';
      dotEls = state.shape.dots.map(([x, y], i) => {
        const btn = document.createElement('button');
        btn.className = 'dot';
        btn.dataset.i = i;
        btn.style.left = (x / 200 * 100) + '%';
        btn.style.top = (y / 200 * 100) + '%';
        btn.style.setProperty('--i', i);
        btn.innerHTML = `<span class="dot-num">${i + 1}</span>`;
        dotsLayer.appendChild(btn);
        return btn;
      });
    }

    function buildRound() {
      state.gen += 1;
      const gen = state.gen;
      state.busy = false;
      state.shape = pickShape(state.shape);
      root.dataset.shape = state.shape.id;   // read by scripts/test-dots.py
      renderShape();
      renderDots();
      layout();
      setNext(0);
      clearIdle();
      /* Opens the picture with its own cue rather than waiting out the full
       * idle timer - a brand-new picture that says nothing is one a
       * three-year-old looks away from. */
      wait(700, () => { if (gen === state.gen) nudgeOnce(); });
      scheduleIdle();
    }

    /* ---------- taps ---------- */
    function correctTap(i, dot) {
      const gen = state.gen;
      sound.number(i + 1, { interrupt: true });
      if (i > 0) drawSegment(i - 1, i);
      dot.classList.add('popped', 'done');
      dot.classList.remove('next');
      const c = dotCenter(dot);
      burst(c.x, c.y, { count: 9, size: [5, 11], dist: 46 });

      const nextIndex = i + 1;
      if (nextIndex >= state.shape.dots.length) {
        state.busy = true;
        clearIdle();
        wait(320, () => { if (gen === state.gen) finishShape(); });
      } else {
        setNext(nextIndex);
        scheduleIdle();
      }
    }

    function wrongTap(dot) {
      sound.wobble();
      dot.classList.remove('shake');
      void dot.offsetWidth;
      dot.classList.add('shake');
      wait(420, () => dot.classList.remove('shake'));
      bounceNext();
      scheduleIdle();
    }

    function finishShape() {
      const gen = state.gen;
      const total = state.shape.dots.length;
      drawSegment(total - 1, 0); // close the outline

      wait(480, () => {
        if (gen !== state.gen) return;
        fillEl.classList.add('shown');
        faceEl.classList.add('shown');
        sound.pop();
        const c = toClient(state.shape.face.cx, state.shape.face.cy);
        burst(c.x, c.y, { count: 16, size: [6, 14], dist: 70 });
      });

      wait(900, () => {
        if (gen !== state.gen) return;
        confetti({ count: 80 });
        sound.celebrate('Hooray! You did it!', { id: 'hooray' });
        ctx.storage.addStar(1);
      });

      wait(900 + 2400, () => { if (gen === state.gen) buildRound(); });
    }

    function onPointerDown(e) {
      sound.ensure();
      if (state.busy) return;
      const dot = e.target.closest('.dot');
      clearIdle();
      if (!dot || dot.classList.contains('done')) { scheduleIdle(); return; }
      e.preventDefault();
      try { dot.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      const i = Number(dot.dataset.i);
      if (i === state.next) correctTap(i, dot); else wrongTap(dot);
    }

    root.addEventListener('pointerdown', onPointerDown);

    buildRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    /* root's own pointerdown listener dies with the detached scene-root; the
     * window resize listener would not, so it is the one thing to remove. */
    if (onResize) window.removeEventListener('resize', onResize);
    onResize = null;
    sound.cancelSpeech();
  }
};

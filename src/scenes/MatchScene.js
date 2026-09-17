import '../match.css';
import { numberWord, inkColor } from '../utils/blocks.js';
import { hitTest } from '../utils/drag.js';
import { sound } from '../audio/SoundManager.js';
import { confetti, burst } from '../utils/fx.js';

/* Game 6: Match
 * Two columns: digits on the left, number-words on the right, both shuffled.
 * Connect a pair either by dragging a finger from one tile to its match (a
 * rubber-band line follows the touch and snaps into place on release), or by
 * tapping one tile then the other - both paths run through the same pointer
 * state machine below. Three pairs per round; finishing all three loads a
 * fresh set of three. */

const POOL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ROUND_SIZE = 3;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRound(prev) {
  let picked;
  do {
    picked = shuffle(POOL).slice(0, ROUND_SIZE);
  } while (prev && picked.every((n) => prev.includes(n)));
  return picked;
}

let timers = [];
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('match');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'match-lines');
    root.appendChild(svg);

    const left = document.createElement('div');
    left.className = 'match-col match-left';
    const right = document.createElement('div');
    right.className = 'match-col match-right';
    root.append(left, right);

    const state = { round: null, matched: new Set(), selection: null, drag: null, gen: 0 };

    function localPoint(x, y) {
      const rr = root.getBoundingClientRect();
      return { x: x - rr.left, y: y - rr.top };
    }

    function tileCenter(el) {
      const r = el.getBoundingClientRect();
      return localPoint(r.left + r.width / 2, r.top + r.height / 2);
    }

    function drawLine(n) {
      const a = tileCenter(left.querySelector(`[data-n="${n}"]`));
      const b = tileCenter(right.querySelector(`[data-n="${n}"]`));
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
      line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
      line.setAttribute('stroke', inkColor(n));
      line.setAttribute('stroke-width', 9);
      line.setAttribute('stroke-linecap', 'round');
      line.setAttribute('class', 'match-line');
      /* dash the stroke by its own length so the CSS keyframe draws it on */
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      line.style.strokeDasharray = len;
      line.style.setProperty('--len', len);
      svg.appendChild(line);
    }

    function clearSelection() {
      root.querySelectorAll('.match-tile.selected').forEach((t) => t.classList.remove('selected'));
      state.selection = null;
    }

    function makeTile(n, kind) {
      const btn = document.createElement('button');
      btn.className = 'match-tile match-' + kind;
      btn.dataset.n = n;
      if (kind === 'num') {
        btn.textContent = String(n);
        btn.style.setProperty('--c', inkColor(n));
      } else {
        btn.textContent = numberWord(n);
      }
      return btn;
    }

    function checkRoundComplete() {
      if (state.matched.size < ROUND_SIZE) return;
      const gen = state.gen;
      wait(500, () => {
        if (gen !== state.gen) return;
        confetti({ count: 70 });
        sound.praise();
        ctx.storage.addStar(1);
        state.round.forEach((num) => ctx.storage.unlockNumber(num));
        wait(1800, () => { if (gen === state.gen) buildRound(); });
      });
    }

    /* Shared by the tap-tap flow and a drag release: tileB is whichever tile
     * completes the pair (the second tap, or the drop target) and anchors
     * the success burst / failure shake. */
    function completeAttempt(tileA, nA, tileB, nB) {
      if (nA === nB) {
        sound.snap();
        sound.number(nA, { interrupt: true });
        state.matched.add(nA);
        left.querySelector(`[data-n="${nA}"]`).classList.add('matched');
        right.querySelector(`[data-n="${nA}"]`).classList.add('matched');
        drawLine(nA);
        const c = tileCenter(tileB);
        const rr = root.getBoundingClientRect();
        burst(rr.left + c.x, rr.top + c.y, { count: 10, size: [6, 12], dist: 55 });
        clearSelection();
        checkRoundComplete();
      } else {
        sound.wobble();
        [tileA, tileB].forEach((el) => {
          el.classList.add('shake');
          wait(420, () => el.classList.remove('shake'));
        });
        clearSelection();
      }
    }

    /* A press-and-release with no drag in between: the original tap-then-tap
     * flow, unchanged - a three-year-old will often just tap. */
    function handleTap(n, kind, btn) {
      if (state.matched.has(n)) return;

      if (!state.selection || state.selection.kind === kind) {
        clearSelection();
        btn.classList.add('selected');
        state.selection = { n, kind };
        return;
      }

      const otherBtn = state.selection.kind === 'num'
        ? left.querySelector(`[data-n="${state.selection.n}"]`)
        : right.querySelector(`[data-n="${state.selection.n}"]`);
      completeAttempt(otherBtn, state.selection.n, btn, n);
    }

    function onPointerDown(e) {
      const tile = e.target.closest('.match-tile');
      if (!tile || state.drag || tile.classList.contains('matched')) return;
      e.preventDefault();
      sound.ensure();
      try { tile.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      state.drag = {
        pointerId: e.pointerId,
        tile,
        n: Number(tile.dataset.n),
        kind: tile.classList.contains('match-num') ? 'num' : 'word',
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        line: null,
        overTile: null
      };
    }

    function onPointerMove(e) {
      const d = state.drag;
      if (!d || e.pointerId !== d.pointerId) return;

      if (!d.moved) {
        // small jitter tolerance so a slightly shaky tap doesn't start a drag
        if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 8) return;
        d.moved = true;
        const a = tileCenter(d.tile);
        d.line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        d.line.setAttribute('x1', a.x);
        d.line.setAttribute('y1', a.y);
        d.line.setAttribute('stroke', inkColor(d.n));
        d.line.setAttribute('stroke-width', 9);
        d.line.setAttribute('stroke-linecap', 'round');
        d.line.setAttribute('stroke-dasharray', '16 12');
        d.line.setAttribute('opacity', '0.55');
        d.line.setAttribute('class', 'match-line-ghost');
        svg.appendChild(d.line);
      }

      const p = localPoint(e.clientX, e.clientY);
      d.line.setAttribute('x2', p.x);
      d.line.setAttribute('y2', p.y);

      const hovered = hitTest(e.clientX, e.clientY, '.match-tile', d.tile);
      const over = hovered && !hovered.classList.contains('matched') ? hovered : null;
      if (over !== d.overTile) {
        if (d.overTile) d.overTile.classList.remove('drag-over');
        if (over) over.classList.add('drag-over');
        d.overTile = over;
      }
    }

    function onPointerEnd(e) {
      const d = state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      state.drag = null;
      try { d.tile.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      if (d.overTile) d.overTile.classList.remove('drag-over');
      if (d.line) d.line.remove();

      if (e.type === 'pointercancel') return;
      if (!d.moved) { handleTap(d.n, d.kind, d.tile); return; }

      // pointer capture means e.target is always the source tile - find
      // what's really under the finger now that it has been lifted
      const target = hitTest(e.clientX, e.clientY, '.match-tile', d.tile);
      if (!target || target.classList.contains('matched')) return;
      const targetKind = target.classList.contains('match-num') ? 'num' : 'word';
      if (targetKind === d.kind) return; // dropped on its own column - ignore
      completeAttempt(d.tile, d.n, target, Number(target.dataset.n));
    }

    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerEnd);
    root.addEventListener('pointercancel', onPointerEnd);

    function buildRound() {
      state.gen += 1;
      state.round = pickRound(state.round);
      state.matched = new Set();
      state.selection = null;
      state.drag = null;
      left.innerHTML = '';
      right.innerHTML = '';
      svg.innerHTML = '';
      shuffle(state.round).forEach((n, i) => {
        const t = makeTile(n, 'num');
        t.style.setProperty('--i', i);
        left.appendChild(t);
      });
      shuffle(state.round).forEach((n, i) => {
        const t = makeTile(n, 'word');
        t.style.setProperty('--i', i + 0.5);
        right.appendChild(t);
      });
    }

    buildRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    sound.cancelSpeech();
  }
};

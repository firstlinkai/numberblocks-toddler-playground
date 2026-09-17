import '../puzzle.css';
import { NUMBER_PUZZLES, OBJECT_PUZZLES, NUMBER_SHARE } from './puzzles.js';
import { sound } from '../audio/SoundManager.js';
import { confetti, burst } from '../utils/fx.js';

/* Game 7: Where does it go?
 * A picture on the right is missing pieces; the pieces sit in a tray on the
 * left. Drag a piece onto its dashed hole and it snaps in.
 *
 * Piece and hole are rendered from the SAME markup (see puzzles.js), so a
 * piece always fits its hole exactly - there is no second set of coordinates
 * to drift out of sync.
 *
 * Toddler rules, all deliberate:
 *  - Holes for the piece being dragged light up the moment it is picked up.
 *    A three-year-old should not have to hunt; the reward is the fitting, not
 *    the searching.
 *  - A drop is matched on the piece's `key`, never its slot index, so the two
 *    car wheels are interchangeable.
 *  - A wrong drop costs nothing: the piece floats home, the right hole
 *    pulses, and the name is spoken again. There is no fail state and no
 *    timer anywhere in this scene.
 *  - After 7s of no touching, the game nudges: one hole pulses and its name
 *    is spoken. That idle nudge is the whole concentration mechanism - a
 *    silent screen is what loses a toddler.
 */

/* How far off a drop may land, on top of the hole's own size. Roughly a
 * toddler thumb's worth of slack; a wrong-key piece is refused at any
 * distance, so this can be forgiving without making the game solve itself. */
const DROP_SLACK = 60;
const IDLE_NUDGE_MS = 7000;

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

const SVG_NS = 'http://www.w3.org/2000/svg';

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('puzzle');

    const tray = document.createElement('div');
    tray.className = 'pp-tray';

    const board = document.createElement('div');
    board.className = 'pp-board';
    const pic = document.createElementNS(SVG_NS, 'svg');
    pic.setAttribute('class', 'pp-pic');
    /* Art is authored in a 0..200 box and several pictures use all of it, so
     * the viewBox is padded out - without the margin the snowman's base and
     * the car's wheels sat flush against the edge of the stage. */
    pic.setAttribute('viewBox', '-10 -10 220 220');
    board.appendChild(pic);

    root.append(tray, board);

    const state = { puzzle: null, filled: 0, drag: null, gen: 0 };

    /* ---------- idle nudge ---------- */
    function clearIdle() {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    }

    function pulseSlot(slot, speak) {
      slot.classList.remove('nudge');
      void slot.getBoundingClientRect();   // restart the keyframe
      slot.classList.add('nudge');
      const item = tray.querySelector(`.pp-item[data-i="${slot.dataset.i}"]:not(.done)`);
      if (item) {
        item.classList.remove('nudge');
        void item.offsetWidth;
        item.classList.add('nudge');
      }
      wait(1600, () => {
        slot.classList.remove('nudge');
        if (item) item.classList.remove('nudge');
      });
      if (speak) sound.say(speak.label + '!', { id: speak.audio, interrupt: true });
    }

    /* Point at one hole that is still empty and name it. */
    function nudgeOnce() {
      const open = [...pic.querySelectorAll('.pp-slot:not(.filled)')];
      if (!open.length) return;
      const slot = open[(Math.random() * open.length) | 0];
      pulseSlot(slot, state.puzzle.slots[Number(slot.dataset.i)]);
    }

    function scheduleIdle() {
      clearIdle();
      idleTimer = setTimeout(() => { nudgeOnce(); scheduleIdle(); }, IDLE_NUDGE_MS);
      timers.push(idleTimer);
    }

    /* ---------- round ---------- */
    function buildRound() {
      state.gen += 1;
      const group = Math.random() < NUMBER_SHARE ? NUMBER_PUZZLES : OBJECT_PUZZLES;
      const pool = group.filter((p) => !state.puzzle || p.id !== state.puzzle.id);
      state.puzzle = pool[(Math.random() * pool.length) | 0];
      state.filled = 0;
      state.drag = null;
      pic.dataset.puzzle = state.puzzle.id;   // read by scripts/test-parts.py

      pic.innerHTML = `<g class="pp-base">${state.puzzle.base}</g>` +
        state.puzzle.slots.map((s, i) =>
          `<g class="pp-slot" data-i="${i}" data-key="${s.key}" style="--sc:${s.sc}">${s.svg}</g>`
        ).join('');

      tray.innerHTML = '';
      shuffle(state.puzzle.slots.map((s, i) => i)).forEach((i, order) => {
        const s = state.puzzle.slots[i];
        const item = document.createElement('div');
        item.className = 'pp-item';
        item.dataset.i = i;
        item.dataset.key = s.key;
        item.style.setProperty('--i', order);
        item.innerHTML = `<svg class="pp-piece" viewBox="${cropBox(i)}">${s.svg}</svg>`;
        tray.appendChild(item);
      });

      /* Open the round by naming one piece instead of waiting out the idle
       * timer: a new picture that says nothing is a picture a toddler looks
       * away from. */
      const gen = state.gen;
      wait(900, () => { if (gen === state.gen) nudgeOnce(); });
      scheduleIdle();
    }

    /* Tray thumbnails are the picture's own artwork, read back from the live
     * SVG with getBBox rather than a hand-written box per piece - a
     * hand-written one is a second copy of the geometry and drifts the first
     * time a shape is nudged.
     *
     * The crop is a SQUARE centred on the piece, and how much of it the piece
     * fills tracks how big the piece is in the picture. Cropping tight instead
     * blew every piece up to fill its card, so a nose came out the size of a
     * roof and the tray read as a jumble. The 0.5 floor keeps a single cube
     * big enough for a toddler to grab; the 0.9 ceiling keeps the largest
     * piece off the card's edge. */
    function cropBox(i) {
      const g = pic.querySelector(`.pp-slot[data-i="${i}"]`);
      let b = null;
      try { b = g.getBBox(); } catch (e) { b = null; }
      if (!b || !b.width || !b.height) return '0 0 200 200';
      const span = Math.max(b.width, b.height);
      const fill = Math.min(0.9, Math.max(0.5, (span / 200) * 1.5));
      const side = span / fill;
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;
      return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`;
    }

    /* ---------- drag ---------- */
    function openSlots(key) {
      return [...pic.querySelectorAll('.pp-slot:not(.filled)')]
        .filter((s) => !key || s.dataset.key === key);
    }

    function onDown(e) {
      const item = e.target.closest('.pp-item');
      if (!item || state.drag || item.classList.contains('done')) return;
      e.preventDefault();
      sound.ensure();
      clearIdle();
      try { item.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }

      const targets = openSlots(item.dataset.key);
      const size = targets.length ? centerOf(targets[0]) : centerOf(item);

      const ghost = document.createElement('div');
      ghost.className = 'pp-ghost';
      ghost.style.width = size.w + 'px';
      ghost.style.height = size.h + 'px';
      ghost.innerHTML = item.querySelector('.pp-piece').outerHTML;
      document.body.appendChild(ghost);

      state.drag = { pointerId: e.pointerId, item, ghost, moved: false, startX: e.clientX, startY: e.clientY };
      moveGhost(e.clientX, e.clientY);
      item.classList.add('held');
      targets.forEach((s) => s.classList.add('hint'));
    }

    function moveGhost(x, y) {
      const g = state.drag.ghost;
      g.style.transform = `translate(${x - g.offsetWidth / 2}px, ${y - g.offsetHeight / 2}px)`;
    }

    function onMove(e) {
      const d = state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 8) d.moved = true;
      moveGhost(e.clientX, e.clientY);
    }

    function clearHints() {
      pic.querySelectorAll('.pp-slot.hint').forEach((s) => s.classList.remove('hint'));
    }

    function onUp(e) {
      const d = state.drag;
      if (!d || e.pointerId !== d.pointerId) return;
      try { d.item.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      state.drag = null;
      clearHints();

      if (e.type === 'pointercancel') {
        d.ghost.remove();
        d.item.classList.remove('held');
        scheduleIdle();
        return;
      }

      const part = state.puzzle.slots[Number(d.item.dataset.i)];

      /* A press with no travel is a question, not an attempt: name the piece
       * and show where it lives, rather than treating it as a failed drop. */
      if (!d.moved) {
        d.ghost.remove();
        d.item.classList.remove('held');
        sound.say(part.label + '!', { id: part.audio, interrupt: true });
        openSlots(part.key).forEach((s) => pulseSlot(s, null));
        scheduleIdle();
        return;
      }

      let best = null;
      for (const s of openSlots(part.key)) {
        const c = centerOf(s);
        const dist = Math.hypot(e.clientX - c.x, e.clientY - c.y);
        const reach = Math.max(c.w, c.h) * 0.75 + DROP_SLACK;
        if (dist <= reach && (!best || dist < best.dist)) best = { slot: s, dist, c };
      }

      if (best) land(d, best, part); else missed(d, part);
    }

    /* Nothing is lost on a miss: the piece floats back to the tray, the hole
     * it belongs in pulses, and its name is spoken again. */
    function missed(d, part) {
      const home = centerOf(d.item);
      const { ghost, item } = d;
      ghost.classList.add('flying');
      ghost.style.transform =
        `translate(${home.x - ghost.offsetWidth / 2}px, ${home.y - ghost.offsetHeight / 2}px) scale(0.55)`;
      ghost.style.opacity = '0';
      sound.wobble();
      wait(300, () => { ghost.remove(); item.classList.remove('held'); });
      openSlots(part.key).forEach((s) => pulseSlot(s, null));
      sound.say(part.label + '!', { id: part.audio, interrupt: true });
      scheduleIdle();
    }

    function land(d, best, part) {
      const { ghost, item } = d;
      const slot = best.slot;

      /* The ghost finishes the trip on its own so the piece visibly seats
       * itself, then hands over to the real artwork underneath it. */
      ghost.classList.add('flying');
      ghost.style.transform =
        `translate(${best.c.x - ghost.offsetWidth / 2}px, ${best.c.y - ghost.offsetHeight / 2}px)`;

      slot.classList.add('filled');
      item.classList.add('done');
      state.filled += 1;

      sound.snap();
      sound.say(part.label + '!', { id: part.audio, interrupt: true });

      const gen = state.gen;
      wait(200, () => {
        ghost.remove();
        if (gen !== state.gen) return;
        slot.classList.add('pop');
        burst(best.c.x, best.c.y, { count: 12, size: [6, 13], dist: 62 });
      });

      if (state.filled === state.puzzle.slots.length) {
        clearIdle();
        wait(640, () => {
          if (gen !== state.gen) return;
          confetti({ count: 80 });
          sound.praise();
          ctx.storage.addStar(1);
          wait(2400, () => { if (gen === state.gen) buildRound(); });
        });
      } else {
        scheduleIdle();
      }
    }

    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('pointercancel', onUp);

    buildRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
    document.querySelectorAll('.pp-ghost').forEach((g) => g.remove());
    sound.cancelSpeech();
  }
};

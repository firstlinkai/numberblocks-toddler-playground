import { makeBlock, renderStack, numberWord } from '../utils/blocks.js';
import { makeDraggable, returnHome, hitTest } from '../utils/drag.js';
import { burst, confetti, rewardAt } from '../utils/fx.js';
import { sound } from '../audio/SoundManager.js';

/* Game 1: Block Snap & Builder
 * Drag a block on top of another to snap them together (1+1=2 ... up to 10).
 * Tap a block to hear it counted cube-by-cube. Making 10 wins a star. */

let timers = [];
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('snap');

    const ground = document.createElement('div');
    ground.className = 'snap-ground';
    root.appendChild(ground);

    const spawnControls = document.createElement('div');
    spawnControls.className = 'spawn-controls';
    const spawnBtn = document.createElement('button');
    spawnBtn.className = 'spawn-btn';
    spawnBtn.innerHTML = '+1';
    const spawn10Btn = document.createElement('button');
    spawn10Btn.className = 'spawn-btn spawn-btn-10';
    spawn10Btn.innerHTML = '+10';
    spawnControls.appendChild(spawnBtn);
    spawnControls.appendChild(spawn10Btn);
    root.appendChild(spawnControls);

    const MAX_BLOCKS = 20;
    const blocks = [];
    let won = false;

    function spawnOne(fx = null, fy = null, quiet = false) {
      if (blocks.length >= MAX_BLOCKS) {
        sound.wobble();
        spawnControls.classList.add('shake');
        wait(450, () => spawnControls.classList.remove('shake'));
        return null;
      }
      const el = makeBlock(1);
      const w = el.offsetWidth || 102;
      const h = el.offsetHeight || 86;
      const rw = root.clientWidth;
      const rh = root.clientHeight;
      const availW = Math.max(8, rw - w - 24);
      /* new blocks always appear in the upper play area, clearly visible */
      const availH = Math.max(8, rh * 0.58 - h);
      let x = 12 + (fx == null ? Math.random() : fx) * availW;
      let y = 12 + (fy == null ? Math.random() : fy) * availH;
      /* keep clear of the spawn button in the top-right corner */
      if (x > rw - w - 140 && y < 140) {
        x = 12 + Math.random() * Math.max(8, rw - w - 320);
      }
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      attachDrag(el);
      root.appendChild(el);
      blocks.push(el);
      el.classList.add('pop-in');
      wait(420, () => el.classList.remove('pop-in'));
      if (!quiet) sound.pop();
      return el;
    }

    function attachDrag(el) {
      makeDraggable(el, {
        bounds: root,
        getOrigin: () => ({ x: parseFloat(el.style.left) || 0, y: parseFloat(el.style.top) || 0 }),
        onStart: () => sound.ensure(),
        onEnd: (e, { tap, origX, origY }) => {
          if (tap) { tapCount(el); return; }
          if (won) { returnHome(el, origX, origY); return; }
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const target = hitTest(cx, cy, '.nb-block', el);
          if (target && target.dataset.value) tryMerge(el, target, origX, origY);
          /* free placement: keep the block right where it was dropped */
        }
      });
    }

    function tryMerge(src, dst, origX, origY) {
      if (dst.dataset.merging) { returnHome(src, origX, origY); return; }
      const sum = Number(src.dataset.value) + Number(dst.dataset.value);
      if (sum > 50) {
        dst.classList.add('shake');
        sound.wobble();
        wait(450, () => dst.classList.remove('shake'));
        returnHome(src, origX, origY);
        return;
      }
      dst.dataset.merging = '1';
      const rr = root.getBoundingClientRect();
      const dr = dst.getBoundingClientRect();
      src.classList.add('merging');
      src.style.left = (dr.left - rr.left) + 'px';
      src.style.top = (dr.top - rr.top) + 'px';
      wait(250, () => {
        src.remove();
        const i = blocks.indexOf(src);
        if (i >= 0) blocks.splice(i, 1);
        renderStack(dst, sum);
        /* keep the growing block fully inside the stage */
        const maxTop = root.clientHeight - dst.offsetHeight;
        if (parseFloat(dst.style.top) > maxTop) {
          dst.style.top = Math.max(0, maxTop) + 'px';
        }
        const maxLeft = root.clientWidth - dst.offsetWidth;
        if (parseFloat(dst.style.left) > maxLeft) {
          dst.style.left = Math.max(0, maxLeft) + 'px';
        }
        dst.classList.add('pop');
        wait(460, () => dst.classList.remove('pop'));
        burst(dr.left + dr.width / 2, dr.top + dr.height / 2, { count: 16 });
        sound.snap();
        sound.number(sum);
        ctx.storage.unlockNumber(sum);
        delete dst.dataset.merging;
        if (sum % 10 === 0) milestone(dst, sum);
      });
    }

    function tapCount(el) {
      if (el.dataset.counting || won) return;
      const v = Number(el.dataset.value);
      if (v > 10) {
        /* big numbers say their name (cube-by-cube would take forever) */
        sound.number(v, { interrupt: true });
        el.classList.add('pop');
        wait(460, () => el.classList.remove('pop'));
        return;
      }
      el.dataset.counting = '1';
      const segs = el.querySelectorAll('.nb-seg');
      sound.countUp(v, {
        onStep: (i) => {
          const s = segs[i - 1];
          if (s) {
            s.classList.add('lit');
            wait(430, () => s.classList.remove('lit'));
          }
        },
        onDone: () => { delete el.dataset.counting; }
      });
    }

    const MILESTONE_PHRASES = {
      10: ['Wow! You made ten!', 'made-ten'],
      20: ['Wow! You made twenty!', 'made-20'],
      30: ['Wow! You made thirty!', 'made-30'],
      40: ['Wow! You made forty!', 'made-40'],
      50: ['Fifty! You did it!', 'made-fifty']
    };

    function milestone(block, sum) {
      /* every full ten is celebrated; the round only ends at 50 */
      won = sum === 50;
      blocks.forEach((b) => b.classList.add('locked'));
      spawnControls.classList.add('locked');
      block.classList.add('happy');
      confetti({ count: sum === 50 ? 160 : 80 });
      const phrase = MILESTONE_PHRASES[sum] || ['Wow!', null];
      sound.celebrate(phrase[0], { id: phrase[1] });
      rewardAt(block);
      ctx.storage.addStar(1);
      if (won) {
        wait(3800, resetRound);
      } else {
        wait(1900, () => {
          block.classList.remove('happy');
          blocks.forEach((b) => b.classList.remove('locked'));
          spawnControls.classList.remove('locked');
        });
      }
    }

    function resetRound() {
      won = false;
      blocks.forEach((b) => b.remove());
      blocks.length = 0;
      spawnControls.classList.remove('locked');
      seed();
    }

    function seed() {
      const spots = [[0.04, 0.1], [0.4, 0.28], [0.72, 0.06]];
      spots.forEach(([fx, fy], i) => {
        wait(200 + i * 220, () => spawnOne(fx, fy, i > 0));
      });
    }

    spawnBtn.addEventListener('click', () => {
      if (!won) spawnOne();
    });

    spawn10Btn.addEventListener('click', () => {
      if (won) return;
      for (let i = 0; i < 10; i++) {
        wait(i * 90, () => spawnOne(null, null, i > 0));
      }
    });

    seed();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    sound.cancelSpeech();
  }
};

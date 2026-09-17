import { makeCube, numberWord } from '../utils/blocks.js';
import { makeDraggable, returnHome, hitTest } from '../utils/drag.js';
import { burst, confetti, rewardAt } from '../utils/fx.js';
import { sound } from '../audio/SoundManager.js';

/* Game 3: Tower Jump
 * A staircase of numbered cubes 1-5 with one missing. Drag the correct
 * cube into the gap, then the hero hops up counting aloud. */

let timers = [];
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
const N = 5;

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('tower');

    const stairs = document.createElement('div');
    stairs.className = 'stairs';
    root.appendChild(stairs);

    const tray = document.createElement('div');
    tray.className = 'choice-tray';
    root.appendChild(tray);

    let choices = [];
    let charEl = null;
    let gapEl = null;
    let locked = false;

    function buildRound() {
      stairs.innerHTML = '';
      tray.innerHTML = '';
      choices = [];
      charEl = null;
      locked = false;

      const rw = root.clientWidth;
      const rh = root.clientHeight;
      const trayH = Math.round(rh * 0.24);
      const padX = Math.round(rw * 0.05);
      const baseY = rh - trayH - 30;
      const topY = 90;
      const stepW = (rw - padX * 2) / N;
      const size = Math.max(58, Math.min(112, Math.min(stepW - 14, (baseY - topY - 112) / (N - 1) + 22)));
      const rise = (baseY - size - topY) / (N - 1);

      /* random consecutive window anywhere from 1 to 50 (e.g. 15,16,?,18,19) */
      const start = 1 + Math.floor(Math.random() * (50 - N + 1)); // 1..46
      const gapIndex = 1 + Math.floor(Math.random() * (N - 2)); // never first/last

      /* ground strip under the staircase */
      const ground = document.createElement('div');
      ground.className = 'tower-ground';
      ground.style.top = baseY + 'px';
      stairs.appendChild(ground);

      for (let i = 0; i < N; i++) {
        const x = padX + i * stepW + (stepW - size) / 2;
        const y = baseY - i * rise - size;

        /* solid riser from every step down to the ground (real stairs) */
        const riser = document.createElement('div');
        riser.className = i === gapIndex ? 'riser ghost' : 'riser';
        riser.style.left = x + 'px';
        riser.style.width = size + 'px';
        riser.style.top = (y + size) + 'px';
        riser.style.height = Math.max(0, baseY - (y + size)) + 'px';
        stairs.appendChild(riser);

        let cube;
        if (i === gapIndex) {
          cube = document.createElement('div');
          cube.className = 'gap-hole';
          cube.style.width = size + 'px';
          cube.style.height = size + 'px';
          cube.innerHTML = '<span>?</span>';
          gapEl = cube;
        } else {
          cube = makeCube(start + i, size, { face: false });
        }
        cube.classList.add('step-cube');
        cube.style.left = x + 'px';
        cube.style.top = y + 'px';
        stairs.appendChild(cube);
      }

      /* 3 answer choices: the correct number plus 2 distractors, shuffled.
       * A distractor must not be a number already standing on the staircase -
       * offering "30" in the tray while 30 is visible as a step is baffling
       * for a toddler, and `correct + 3` lands on the top step whenever the
       * gap sits second from the left. */
      const correct = start + gapIndex;
      const onStairs = (v) => v >= start && v < start + N;
      const candidates = [3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8, -8].map((d) => correct + d);
      const pool = candidates.filter((v) => v >= 1 && v <= 50 && !onStairs(v));
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      const picks = [correct, pool[0], pool[1]];
      for (let i = picks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [picks[i], picks[j]] = [picks[j], picks[i]];
      }

      const trr = tray.getBoundingClientRect();
      const rrr = root.getBoundingClientRect();
      const cSize = Math.max(72, Math.min(96, size));
      const slot = trr.width / 3;
      picks.forEach((v, i) => {
        const c = makeCube(v, cSize, { face: true });
        c.style.left = (trr.left - rrr.left + slot * i + (slot - cSize) / 2) + 'px';
        c.style.top = (trr.top - rrr.top + (trr.height - cSize) / 2) + 'px';
        attachChoice(c, v, correct);
        root.appendChild(c); // root-local coords (tray is just a visual backdrop)
        c.classList.add('choice-cube');
        choices.push(c);
        c.classList.add('pop-in');
        wait(420, () => c.classList.remove('pop-in'));
      });
    }

    function attachChoice(c, value, correct) {
      makeDraggable(c, {
        bounds: root,
        getOrigin: () => ({ x: parseFloat(c.style.left) || 0, y: parseFloat(c.style.top) || 0 }),
        onStart: () => sound.ensure(),
        onEnd: (e, { tap, origX, origY }) => {
          if (tap) { sound.number(value, { interrupt: true }); return; }
          if (locked) { returnHome(c, origX, origY); return; }
          const r = c.getBoundingClientRect();
          const over = hitTest(r.left + r.width / 2, r.top + r.height / 2, '.gap-hole', c);
          if (!over) { returnHome(c, origX, origY); return; }
          if (value === correct) placeCorrect(c);
          else {
            gapEl.classList.add('shake');
            sound.wobble();
            wait(450, () => gapEl.classList.remove('shake'));
            returnHome(c, origX, origY);
          }
        }
      });
    }

    function placeCorrect(c) {
      locked = true;
      choices.forEach((o) => { if (o !== c) o.classList.add('locked'); });
      const rr = root.getBoundingClientRect();
      const gr = gapEl.getBoundingClientRect();
      c.classList.add('merging');
      c.style.left = (gr.left - rr.left) + 'px';
      c.style.top = (gr.top - rr.top) + 'px';
      wait(260, () => {
        const value = Number(c.dataset.value);
        c.remove();
        gapEl.remove();
        gapEl = null;
        const filled = makeCube(value, gr.width, { face: false });
        filled.classList.add('step-cube', 'pop');
        filled.style.left = (gr.left - rr.left) + 'px';
        filled.style.top = (gr.top - rr.top) + 'px';
        stairs.appendChild(filled);
        sound.snap();
        sound.number(value);
        burst(gr.left + gr.width / 2, gr.top + gr.height / 2, { count: 14 });
        wait(550, winSequence);
      });
    }

    function winSequence() {
      /* hop in number order - the filled gap cube is appended last in the DOM,
       * so sorting by value prevents skipping it and coming back */
      const cubes = [...stairs.querySelectorAll('.step-cube')]
        .sort((a, b) => Number(a.dataset.value) - Number(b.dataset.value));
      if (!cubes.length) return;
      charEl = makeCube(1, Math.round(cubes[0].offsetHeight * 0.85), { face: true });
      charEl.classList.add('hero');
      const start = cubes[0];
      charEl.style.left = (start.offsetLeft - charEl.offsetWidth * 0.5) + 'px';
      charEl.style.top = start.offsetTop + 'px';
      stairs.appendChild(charEl);

      const toClient = (x, y) => {
        const r = root.getBoundingClientRect();
        return [r.left + x, r.top + y];
      };

      /* The hero hops when each number STARTS being spoken, and the next hop
       * waits for that number to finish. A fixed interval used to cut names
       * like "Thirty-seven!" in half, because they run longer than the timer. */
      wait(750, () => {
        if (!charEl || !charEl.isConnected) return;
        sound.speakSequence(
          cubes.map((cube) => ({
            text: numberWord(Number(cube.dataset.value)),
            id: 'number-' + cube.dataset.value,
            cube
          })),
          {
            onStep: ({ cube }, i) => {
              if (!charEl || !charEl.isConnected) return;
              charEl.style.left = (cube.offsetLeft + (cube.offsetWidth - charEl.offsetWidth) / 2) + 'px';
              charEl.style.top = (cube.offsetTop - charEl.offsetHeight + 6) + 'px';
              charEl.classList.remove('hop');
              void charEl.offsetWidth;
              charEl.classList.add('hop');
              sound.hop(i);
              const [cx, cy] = toClient(cube.offsetLeft + cube.offsetWidth / 2, cube.offsetTop);
              burst(cx, cy, { count: 6, size: [6, 10], dist: 55 });
            },
            onDone: () => wait(400, victory)
          }
        );
      });
    }

    function victory() {
      if (!charEl || !charEl.isConnected) return;
      charEl.classList.add('victory');
      confetti({ count: 100 });
      sound.celebrate('Hooray! You did it!', { id: 'hooray' });
      rewardAt(charEl);
      ctx.storage.addStar(1);
      wait(2700, buildRound);
    }

    buildRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    sound.cancelSpeech();
  }
};

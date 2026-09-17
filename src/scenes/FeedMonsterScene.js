import { makeFruit, numberWord } from '../utils/blocks.js';
import { makeDraggable, returnHome, hitTest } from '../utils/drag.js';
import { burst, confetti, rewardAt } from '../utils/fx.js';
import { sound } from '../audio/SoundManager.js';
import { PRAISE } from '../players.js';

/* Game 2: Feed the Cat
 * The cat shows a visual order (N fruits on a sign) and asks aloud.
 * Drag fruits to its mouth - each chomp counts up. Match N -> star!
 * Targets come from a shuffled bag of 1-5, so they never repeat
 * back-to-back, and each round uses a random fruit. */

let timers = [];
const wait = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

const FRUITS = ['🍎', '🍌', '🍊', '🫐', '🍇', '🍓'];

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('feed');

    const sign = document.createElement('div');
    sign.className = 'order-sign';
    root.appendChild(sign);

    const pet = document.createElement('div');
    pet.className = 'pet';
    pet.innerHTML =
      '<div class="pet-body">' +
        '<div class="pet-ear left"><span></span></div>' +
        '<div class="pet-ear right"><span></span></div>' +
        '<div class="pet-eyes">' +
          '<span class="p-eye"><i></i></span>' +
          '<span class="p-eye"><i></i></span>' +
        '</div>' +
        '<div class="pet-nose"></div>' +
        '<div class="pet-mouth"><span class="tongue"></span></div>' +
        '<div class="whiskers wl"><i></i><i></i><i></i></div>' +
        '<div class="whiskers wr"><i></i><i></i><i></i></div>' +
      '</div>';
    root.appendChild(pet);

    const tray = document.createElement('div');
    tray.className = 'food-tray';
    root.appendChild(tray);

    const state = { target: 3, fed: 0, busy: false, fruit: '🍎' };
    let bag = [];
    let fruits = [];

    /* Shuffled bag of 1-5: every number appears once before any repeats */
    function nextTarget() {
      if (!bag.length) {
        bag = [1, 2, 3, 4, 5];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop();
    }

    function layoutTray() {
      const tr = tray.getBoundingClientRect();
      const rr = root.getBoundingClientRect();
      const n = Math.max(1, fruits.length);
      const slot = tr.width / n;
      fruits.forEach((f, i) => {
        if (f.classList.contains('dragging')) return;
        f.style.left = (tr.left - rr.left + slot * i + (slot - f.offsetWidth) / 2) + 'px';
        f.style.top = (tr.top - rr.top + (tr.height - f.offsetHeight) / 2) + 'px';
      });
    }

    function renderSign() {
      sign.innerHTML = '';
      for (let i = 0; i < state.target; i++) {
        const s = document.createElement('span');
        s.className = 'order-fruit' + (i < state.fed ? ' eaten' : '');
        s.textContent = state.fruit;
        sign.appendChild(s);
      }
    }

    function refillTray() {
      fruits.forEach((f) => f.remove());
      fruits = [];
      const count = state.target + 3;
      for (let i = 0; i < count; i++) {
        const f = makeFruit(state.fruit, 84);
        attachFruit(f);
        root.appendChild(f);
        fruits.push(f);
        f.classList.add('pop-in');
        wait(420, () => f.classList.remove('pop-in'));
      }
      layoutTray();
    }

    function attachFruit(f) {
      makeDraggable(f, {
        bounds: root,
        getOrigin: () => ({ x: parseFloat(f.style.left) || 0, y: parseFloat(f.style.top) || 0 }),
        onStart: () => sound.ensure(),
        onMove: (e) => {
          const over = hitTest(e.clientX, e.clientY, '.pet', f);
          pet.classList.toggle('mouth-open', !!over && state.fed < state.target && !state.busy);
        },
        onEnd: (e, { tap, origX, origY }) => {
          pet.classList.remove('mouth-open');
          if (tap) { sound.pop(); return; }
          if (state.busy || state.fed >= state.target) { returnHome(f, origX, origY); return; }
          const r = f.getBoundingClientRect();
          const over = hitTest(r.left + r.width / 2, r.top + r.height / 2, '.pet', f);
          if (over) feed(f);
          else returnHome(f, origX, origY);
        }
      });
    }

    function feed(fruit) {
      state.fed += 1;
      const idx = state.fed;
      const rr = root.getBoundingClientRect();
      const mouth = pet.querySelector('.pet-mouth');
      const mr = mouth.getBoundingClientRect();
      fruit.classList.add('devour');
      fruit.style.left = (mr.left - rr.left + mr.width / 2 - fruit.offsetWidth / 2) + 'px';
      fruit.style.top = (mr.top - rr.top + mr.height / 2 - fruit.offsetHeight / 2) + 'px';
      sound.munch();
      wait(260, () => {
        fruit.remove();
        fruits = fruits.filter((x) => x !== fruit);
      });
      pet.classList.add('chewing');
      wait(540, () => pet.classList.remove('chewing'));
      sound.number(idx);
      renderSign();
      burst(mr.left + mr.width / 2, mr.top + mr.height / 2, { count: 8, size: [6, 12], dist: 60 });
      if (state.fed >= state.target) {
        state.busy = true;
        wait(700, celebrate);
      }
    }

    function celebrate() {
      pet.classList.add('happy');
      confetti({ count: 70 });
      sound.celebrate(PRAISE.text, { id: PRAISE.id });
      rewardAt(pet);
      ctx.storage.addStar(1);
      wait(2800, () => {
        pet.classList.remove('happy');
        state.busy = false;
        newRound();
      });
    }

    function newRound() {
      state.fed = 0;
      state.busy = false;
      state.target = nextTarget();
      state.fruit = FRUITS[(Math.random() * FRUITS.length) | 0];
      renderSign();
      refillTray();
      sound.say('Feed me ' + numberWord(state.target) + '!', { id: 'feed-' + state.target });
    }

    newRound();
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    sound.cancelSpeech();
  }
};

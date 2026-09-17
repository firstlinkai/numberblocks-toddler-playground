import { sound } from '../audio/SoundManager.js';
import { burst } from '../utils/fx.js';

/* Game 5: Instruments
 * A grid of instruments. Tap one and it plays that instrument's own sound
 * - no scoring, no name, just cause-and-effect for a toddler. */

const INSTRUMENTS = [
  { id: 'piano', icon: '🎹', cls: 'inst-piano', play: () => sound.piano() },
  { id: 'drum', icon: '🥁', cls: 'inst-drum', play: () => sound.drum() },
  { id: 'guitar', icon: '🎸', cls: 'inst-guitar', play: () => sound.guitarPluck() },
  { id: 'trumpet', icon: '🎺', cls: 'inst-trumpet', play: () => sound.trumpetBlast() },
  { id: 'xylophone', icon: '🎶', cls: 'inst-xylophone', play: () => sound.xylophoneHit() },
  { id: 'maracas', icon: '🪇', cls: 'inst-maracas', play: () => sound.maracaShake() }
];

let timers = [];

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('instruments');

    const grid = document.createElement('div');
    grid.className = 'inst-grid';

    INSTRUMENTS.forEach((inst, i) => {
      const card = document.createElement('button');
      card.className = 'inst-card ' + inst.cls;
      card.style.setProperty('--i', i);
      const ic = document.createElement('span');
      ic.className = 'inst-icon';
      ic.textContent = inst.icon;
      card.appendChild(ic);
      card.addEventListener('click', () => {
        sound.ensure();
        inst.play();
        card.classList.remove('boing');
        void card.offsetWidth;
        card.classList.add('boing');
        const r = card.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height / 2, { count: 8, size: [6, 12], dist: 60 });
      });
      grid.appendChild(card);
    });

    root.appendChild(grid);
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    sound.cancelSpeech();
  }
};

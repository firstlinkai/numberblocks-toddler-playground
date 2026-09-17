import { makeBlock, renderStack, shapeFor, CUBE_PITCH } from '../utils/blocks.js';
import { sound } from '../audio/SoundManager.js';
import { floatUp } from '../utils/fx.js';
import { PLAYERS } from '../players.js';

const GAMES = [
  { id: 'snap', icon: '🧱', cls: 'card-snap' },
  { id: 'feed', icon: '🍎', cls: 'card-feed' },
  { id: 'tower', icon: '🪜', cls: 'card-tower' },
  { id: 'trace', icon: '🎈', cls: 'card-trace' },
  { id: 'instruments', icon: '🎹', cls: 'card-instruments' },
  { id: 'match', icon: '🔗', cls: 'card-match' },
  { id: 'parts', icon: '🧩', cls: 'card-parts' },
  { id: 'dots', icon: '✏️', cls: 'card-dots' },
  { id: 'sort', icon: '🧺', cls: 'card-sort' },
  { id: 'memory', icon: '🃏', cls: 'card-memory' }
];

const MIN_UNIT = 8;

let timers = [];
let observer = null;

export default {
  mount(root, ctx) {
    timers = [];
    root.classList.add('hub');

    /* Decorative sky (sun + drifting clouds) */
    const sky = document.createElement('div');
    sky.className = 'hub-sky';
    sky.appendChild(Object.assign(document.createElement('div'), { className: 'sun' }));
    for (let i = 0; i < 3; i++) {
      sky.appendChild(Object.assign(document.createElement('div'), { className: 'cloud cloud-' + i }));
    }
    root.appendChild(sky);

    /* Players - tap either to hear a greeting. Who they are lives in
     * src/players.js, never here: the repository ships generic buttons. */
    const names = document.createElement('div');
    names.className = 'hub-title-row';
    PLAYERS.forEach((p) => {
      const title = document.createElement('button');
      title.className = 'hub-title';
      title.textContent = p.label ? `${p.icon} ${p.label}` : p.icon;
      title.addEventListener('click', () => {
        sound.ensure();
        /* interrupt: a tap on a name is direct feedback, and the greeting
         * recordings run over two seconds - queued, mashing both buttons
         * builds a backlog that answers the wrong tap. */
        sound.say(p.greet, { id: p.id, interrupt: true });
      });
      names.appendChild(title);
    });
    root.appendChild(names);

    /* Four oversized game launchers */
    const grid = document.createElement('div');
    grid.className = 'hub-grid';
    GAMES.forEach((g, i) => {
      const card = document.createElement('button');
      card.className = 'game-card ' + g.cls;
      card.style.setProperty('--i', i);
      const ic = document.createElement('span');
      ic.className = 'game-icon';
      ic.textContent = g.icon;
      card.appendChild(ic);
      card.addEventListener('click', () => {
        sound.ensure();
        sound.chime();
        const r = card.getBoundingClientRect();
        floatUp(r.left + r.width / 2, r.top + r.height / 2, g.icon);
        timers.push(setTimeout(() => ctx.go(g.id), 280));
      });
      grid.appendChild(card);
    });
    root.appendChild(grid);

    /* Numberblocks shelf: 0-10, always all of them, tap one to hear its number.
     * Deliberately not gated on what has been earned - a padlock where a block
     * should be reads as a broken block to a three-year-old, and the shelf is
     * a reference chart here, not a reward. Progress still accrues in storage
     * for the games that use it. The row must never need scrolling, since
     * touch scroll is disabled app-wide. */
    const strip = document.createElement('div');
    strip.className = 'gallery';

    const addTile = (n) => {
      const item = document.createElement('button');
      item.className = 'gallery-item';
      item.appendChild(makeBlock(n, { unit: 12, compact: true }));
      item.addEventListener('click', () => {
        sound.ensure();
        sound.number(n, { interrupt: true });
        item.classList.remove('boing');
        void item.offsetWidth;
        item.classList.add('boing');
      });
      strip.appendChild(item);
      return item;
    };

    for (let n = 0; n <= 10; n++) addTile(n);

    root.appendChild(strip);

    /* One shared cube size for the whole row, picked as the tightest fit
     * across every visible block, so a "One" cube is the same size as a
     * "Nine" cube - not stretched to fill its own tile.
     * Re-runs on resize because the iPad can be rotated mid-play. */
    function sizeGallery() {
      const blocks = [...strip.querySelectorAll('.gallery-item .nb-block')];
      if (!blocks.length) return;

      /* Read the shelf's own padding and gap rather than keeping a copy of
       * them here. Hardcoded copies are what broke this twice: they were 6px
       * on both axes in JS while the CSS said `padding: 6px 10px`. */
      const cs = getComputedStyle(strip);
      const gap = parseFloat(cs.gap) || 0;
      const stripH = strip.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const avail = strip.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      if (stripH <= 0 || avail <= 0) return;

      const shapes = blocks.map((b) => shapeFor(Number(b.dataset.value), { compact: true }));
      const maxRows = Math.max(...shapes.map((s) => s.rows));
      const totalCols = shapes.reduce((sum, s) => sum + s.cols, 0);

      /* Everything in the row that does NOT scale with the cube size: the fixed
       * width padlock tiles for numbers not yet earned, each tile's own
       * horizontal padding, and the gaps between tiles. The previous version
       * predicted the whole row arithmetically instead, forgot the padlocks
       * existed (they hold no cube, so a blocks-only loop never saw them) and
       * kept a private copy of the cube pitch that had drifted from the real
       * one. On the iPad that overshot the shelf by ~280px and the last four
       * tiles rendered off-screen.
       *
       * Deliberately not measured after rendering: this runs inside a
       * ResizeObserver callback, where Chrome serves the layout from before the
       * callback, so offsetWidth reads back the previous cube size. Only
       * unit-independent numbers are safe to read here. */
      const tilePad = Math.max(0, blocks[0].parentElement.offsetWidth - blocks[0].offsetWidth);
      const fixed = [...strip.children]
        .filter((c) => !c.querySelector('.nb-block'))
        .reduce((w, c) => w + c.offsetWidth, 0)
        + tilePad * blocks.length
        + Math.max(0, strip.children.length - 1) * gap;

      const unit = Math.max(MIN_UNIT, Math.floor(Math.min(
        stripH / maxRows,
        (avail - fixed) / (CUBE_PITCH * totalCols)
      )));
      blocks.forEach((b) => renderStack(b, Number(b.dataset.value), { unit, compact: true }));
    }

    /* Measure off the strip itself rather than a window resize: on a cold load
     * the strip still has no height when mount runs (the stylesheet lands a
     * tick later), which left every block stuck at its placeholder unit. The
     * observer catches that first real layout as well as rotation later. */
    sizeGallery();
    observer = new ResizeObserver(sizeGallery);
    observer.observe(strip);
  },

  unmount() {
    timers.forEach(clearTimeout);
    timers = [];
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  }
};

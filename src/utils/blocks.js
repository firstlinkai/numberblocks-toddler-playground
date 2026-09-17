/* Numberblock component factory (shared across scenes).
 *  - makeBlock(value): vertical stack of `value` unit cubes w/ face + numeral
 *  - makeCube(value, size): single numbered cube (stairs / choices / food)
 *  - renderStack(el, value): rebuild an existing block at a new value */

/* Matches the show's ROYGBIV scheme: 6 is indigo (not blue), 7 is rainbow
 * (see RAINBOW below - it is painted per cube, not a flat fill),
 * 9 is gray, 10 is white. */
export const BLOCK_COLORS = {
  0: 'transparent', 1: '#ef4444', 2: '#f97316', 3: '#facc15', 4: '#22c55e',
  5: '#38bdf8', 6: '#4f46e5', 7: '#8b5cf6', 8: '#ec4899', 9: '#94a3b8', 10: '#f8fafc'
};

/* Seven wears one color per cube rather than a single fill */
const RAINBOW = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#4f46e5', '#8b5cf6'];

/* Which of the first ten Numberblocks a bigger number takes its colors from:
 * its largest factor of ten or less. Fourteen and Twenty-one come out rainbow
 * like Seven, Fifteen comes out blue like Five, and every whole ten stays
 * white like the Ten rod. Numbers above ten with no factor at all (11, 13,
 * 17, 19) fall back to One's red. */
export function themeValue(value) {
  if (value <= 10) return value;
  for (let f = 10; f > 1; f--) {
    if (value % f === 0) return f;
  }
  return 1;
}

/* Horizontal pitch of one cube in --unit multiples. A cube is drawn slightly
 * wider than tall so a stack reads as a tower rather than a strip. Exported
 * because the Hub gallery has to predict a row's width before it renders it -
 * it used to hard-code its own copy of this number, and drifted. */
export const CUBE_PITCH = 1.18;

const WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const TEENS = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['Twenty', 'Thirty', 'Forty', 'Fifty'];

/* Number words up to 50 ("Twenty-three") */
export function numberWord(n) {
  n = Math.round(n);
  if (n < 10) return WORDS[n] || String(n);
  if (n < 20) return TEENS[n - 10] || String(n);
  if (n <= 50) {
    const tens = TENS[Math.floor(n / 10) - 2] || String(n);
    const ones = n % 10;
    return ones ? `${tens}-${WORDS[ones]}` : tens;
  }
  return String(n);
}

/* Unit segment size shrinks as the stack grows so a 10-block fits on screen */
export function unitFor(value) {
  return Math.max(34, Math.min(86, Math.floor(400 / value)));
}

export function blockColor(value) {
  if (BLOCK_COLORS[value]) return BLOCK_COLORS[value];
  /* deterministic, well-spread hue for 11-50 */
  const hue = Math.round((value * 137.508) % 360);
  return `hsl(${hue}, 72%, 55%)`;
}

/* Block colors are tuned for big filled shapes on the play area. Used as text
 * or a thin stroke on a light background, the pale ones disappear - Zero is
 * literally transparent and Ten is near-white. This keeps the hue but forces
 * enough contrast to read. */
export function inkColor(value) {
  const c = blockColor(value);
  if (!c.startsWith('#')) return c === 'transparent' ? '#64748b' : c;
  const n = parseInt(c.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  if (lum <= 0.62) return c;
  const dark = (ch) => Math.round(ch * (0.55 / Math.max(lum, 0.01)));
  return `rgb(${dark(r)}, ${dark(g)}, ${dark(b)})`;
}

/* The show always makes a Numberblock as square as possible: 4=2x2, 6=2x3,
 * 8=2x4, 9=3x3. Numbers with no factor pair (primes, and 1) stay a 1-wide
 * column. Ten is deliberately kept a column too (see forceColumn below) -
 * it's the "ten rod" used as a building block for the teens and twenties. */
function squareFactor(n) {
  if (n <= 1) return [1, Math.max(n, 1)];
  let best = [1, n];
  for (let w = 2; w * w <= n; w++) {
    if (n % w === 0) best = [w, n / w];
  }
  return best;
}

/* Gallery packing: the squarest grid that holds `n`, allowing a ragged last
 * row. squareFactor can only use exact factor pairs, so a prime like Seven
 * becomes a 1-wide, 7-tall column - and one such column forces every tile in
 * a shared-size row down to its own thin scale. This caps the height instead. */
function compactShape(n) {
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  return { cols, rows: Math.ceil(n / cols) };
}

/* Grid shape a given value renders at - lets callers (the Hub gallery) size
 * tiles correctly without duplicating renderStack's own branching. */
export function shapeFor(value, { compact = false } = {}) {
  if (value === 0) return { cols: 1, rows: 1.1 };
  if (compact && value >= 1 && value <= 50) return compactShape(value);
  if (value === 10) return { cols: 1, rows: 10 };
  if (value > 10) {
    const full = Math.floor(value / 10);
    const ones = value % 10;
    return { cols: full + (ones ? 1 : 0), rows: 10 };
  }
  const [cols, rows] = squareFactor(value);
  return { cols, rows };
}

const FACE_HTML =
  '<div class="nb-face"><span class="nb-eye"></span><span class="nb-eye"></span><span class="nb-mouth"></span></div>';

/* `offset` keeps the rainbow running unbroken across a multi-column block, so
 * Twenty-one reads as three Sevens end to end rather than three restarts. */
function addSegs(container, count, rainbow = false, offset = 0) {
  for (let i = 0; i < count; i++) {
    const seg = document.createElement('div');
    seg.className = 'nb-seg';
    if (rainbow) seg.style.background = RAINBOW[(offset + i) % RAINBOW.length];
    container.appendChild(seg);
  }
}

/* Every block bigger than ten is drawn in its theme's colors (see themeValue).
 * A white theme needs the contrast border or the cubes vanish on the play area. */
function applyTheme(el, value) {
  const theme = themeValue(value);
  el.classList.toggle('nb-pale', theme === 10);
  return { rainbow: theme === 7, color: blockColor(theme) };
}

function addBadge(el, value) {
  const badge = document.createElement('div');
  badge.className = 'nb-num';
  badge.textContent = String(value);
  el.appendChild(badge);
}

/* 1-9, and any solid multiple of ten (10, 20, 30...): a single square-ish
 * grid in one flat color. forceColumn keeps it a 1-wide tower (used for
 * Ten and its multiples, which are always drawn as a rod, never a square). */
function renderGrid(el, value, unit, face, forceColumn, shape) {
  const [cols, rows] = shape
    ? [shape.cols, shape.rows]
    : (forceColumn ? [1, value] : squareFactor(value));
  const u = unit || unitFor(Math.max(cols, rows));
  const { rainbow, color } = applyTheme(el, value);
  el.style.setProperty('--unit', u + 'px');
  el.style.setProperty('--c', color);
  el.classList.add('nb-grid');

  const wrap = document.createElement('div');
  wrap.className = 'nb-grid-wrap';
  wrap.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  wrap.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  addSegs(wrap, value, rainbow);
  if (face) wrap.insertAdjacentHTML('beforeend', FACE_HTML);
  el.appendChild(wrap);

  addBadge(el, value);
  el.style.width = `calc(var(--unit) * ${CUBE_PITCH} * ${cols})`;
  el.style.height = `calc(var(--unit) * ${rows})`;
}

/* Everything above ten: full columns of ten with the remainder as a short
 * column beside them, every column standing on the same floor. A block never
 * grows past ten cubes tall - the eleventh cube starts a new column at the
 * bottom, the way the show builds them. (It used to stack the ones on TOP of
 * a white ten rod, so Fourteen was a 14-cube tower.) */
function renderPlaceValue(el, value, unit, face) {
  const full = Math.floor(value / 10);
  const ones = value % 10;
  const cols = full + (ones ? 1 : 0);
  const u = unit || unitFor(10);
  const { rainbow, color } = applyTheme(el, value);
  el.style.setProperty('--unit', u + 'px');
  el.style.setProperty('--c', color);
  el.classList.add('nb-multi');

  const wrap = document.createElement('div');
  wrap.className = 'nb-columns';
  for (let c = 0; c < cols; c++) {
    const col = document.createElement('div');
    col.className = 'nb-col';
    addSegs(col, c < full ? 10 : ones, rainbow, c * 10);
    /* Face goes on the top cube, not on the column: a column is a fixed ten
     * units tall while its cubes carry margins, so a column-anchored face
     * floated in the gap above the stack. */
    if (c === 0 && face) {
      const top = col.firstElementChild;
      top.classList.add('nb-seg-face');
      top.insertAdjacentHTML('beforeend', FACE_HTML);
    }
    wrap.appendChild(col);
  }
  el.appendChild(wrap);
  addBadge(el, value);
  el.style.width = `calc(var(--unit) * ${CUBE_PITCH} * ${cols} + ${(cols - 1) * 4}px)`;
  el.style.height = 'calc(var(--unit) * 10)';
}

export function makeBlock(value, { unit = null, face = true, compact = false } = {}) {
  const el = document.createElement('div');
  el.className = 'nb-block';
  renderStack(el, value, { unit, face, compact });
  return el;
}

export function renderStack(el, value, { unit = null, face = true, compact = false } = {}) {
  el.dataset.value = value;
  el.innerHTML = '';
  el.classList.remove('nb-zero', 'nb-grid', 'nb-multi', 'nb-pale');

  /* Gallery thumbnails: pack every number into its squarest grid so one tall
   * prime cannot shrink the whole shared-size row. Play scenes leave this off
   * and keep the show-accurate shapes. */
  if (compact && value >= 1 && value <= 50) {
    renderGrid(el, value, unit, face, false, compactShape(value));
    return;
  }

  if (value === 0) {
    /* Zero has no blocks - just her numeral and a mouth (no eyes, no body) */
    const u = unit || unitFor(1);
    el.style.setProperty('--unit', u + 'px');
    el.classList.add('nb-zero');
    addBadge(el, 0);
    if (face) {
      const mouth = document.createElement('div');
      mouth.className = 'nb-zero-mouth';
      el.appendChild(mouth);
    }
    el.style.width = `calc(var(--unit) * ${CUBE_PITCH})`;
    el.style.height = 'calc(var(--unit) * 1.1)';
    return;
  }

  /* Ten is the rod: a 1-wide, 10-tall column, never a square */
  if (value === 10) {
    renderGrid(el, value, unit, face, true);
    return;
  }

  if (value > 10) {
    renderPlaceValue(el, value, unit, face);
    return;
  }

  /* 1-9 */
  renderGrid(el, value, unit, face, false);
}

/* Single square cube with a numeral (and optionally a face) */
export function makeCube(value, size = 90, { face = true } = {}) {
  const el = document.createElement('div');
  el.className = 'nb-cube';
  el.dataset.value = value;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.fontSize = Math.round(size * 0.42) + 'px';
  el.style.setProperty('--c', blockColor(value));
  el.style.setProperty('--unit', size + 'px'); // face scales with the cube
  if (face) el.innerHTML = FACE_HTML;
  const num = document.createElement('div');
  num.className = 'nb-num';
  num.textContent = String(value);
  el.appendChild(num);
  return el;
}

/* Build a food element for the feeding tray (emoji fruit) */
export function makeFruit(emoji, size = 84) {
  const el = document.createElement('div');
  el.className = 'food-item';
  el.textContent = emoji;
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.fontSize = Math.round(size * 0.68) + 'px';
  return el;
}

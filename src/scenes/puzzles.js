/* Picture data for the "Where does it go?" drag-and-drop puzzles.
 *
 * Each picture is one SVG authored in a 0..200 box. `base` is the part that is
 * always drawn; every entry in `slots` is drawn TWICE from the same markup -
 * once in the picture as a dashed empty outline, once in the tray as the solid
 * piece the child drags. Authoring it once is the whole point: a piece can
 * never fail to fit its hole, because it IS its hole.
 *
 * `key` is what a drop is matched on, so two wheels (same key, different
 * position) are interchangeable - a toddler must not lose because they put the
 * left wheel on the right.
 * `sc` tints the dashed outline with the piece's own colour, which is the only
 * way two same-sized holes stay tellable apart.
 * `data-detail` marks decoration (pupils, a door knob) that is hidden in the
 * outline. It is hidden with `visibility`, never `display` - the tray
 * thumbnail crops to the slot's getBBox and a display:none child leaves that
 * box, which used to spill an apple's stem outside its tray card.
 *
 * Slots must not overlap each other. Two dashed outlines crossing read as one
 * tangled shape, and the drop test then has to pick between two holes under
 * the same finger.
 */

import { BLOCK_COLORS, numberWord } from '../utils/blocks.js';

/* ---------- small drawing helpers ---------- */

/* Darken a hex colour for the outline / edge of a shape. Numberblock colours
 * come straight from the show's palette and none of them ship a matching
 * shadow tone. */
function shade(hex, f) {
  const v = hex.replace('#', '');
  const full = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  const n = parseInt(full, 16);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    .map((c) => Math.round(c * f).toString(16).padStart(2, '0')).join('');
}

/* Numerals are drawn as <text>, not hand-traced paths. The hole and the piece
 * are the same element, so whatever font the device actually resolves, the
 * two still match exactly - which is the one property that matters here. */
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";

function numeral(n, cx, baseline, size, color) {
  return `<text x="${cx}" y="${baseline}" text-anchor="middle" font-family="${FONT}"
            font-size="${size}" font-weight="900" fill="${color}" stroke="${shade(color, 0.55)}"
            stroke-width="5" paint-order="stroke" stroke-linejoin="round">${n}</text>`;
}

function cube(x, y, s, color) {
  const edge = shade(color, 0.62);
  return `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.14}"
            fill="${color}" stroke="${edge}" stroke-width="3.5"/>`;
}

/* One to Three stand as towers the way they do in the show; above that the
 * cubes pack into the squarest grid that holds them, so Four reads as a 2x2
 * and Nine as a 3x3. */
function grid(n) {
  const cols = n <= 3 ? 1 : Math.ceil(Math.sqrt(n));
  return { cols, rows: Math.ceil(n / cols) };
}

/* Cubes filled from the bottom row up, so a partly built block never floats. */
function blockStack(n, cx, bottomY, s, color) {
  const { cols, rows } = grid(n);
  const left = cx - (cols * s) / 2;
  const top = bottomY - rows * s;
  let out = '';
  for (let i = 0; i < n; i++) {
    const r = rows - 1 - Math.floor(i / cols);
    const c = i % cols;
    out += cube(left + c * s, top + r * s, s, color);
  }
  return out;
}

/* The face every Numberblock wears. Pupils are decoration so the hole stays a
 * clean pair of eyes plus a smile. */
function nbFace(cx, cy, k = 1) {
  const r = 9 * k;
  return `
    <ellipse cx="${cx - 15 * k}" cy="${cy}" rx="${r}" ry="${r * 1.15}" fill="#ffffff" stroke="#1e293b" stroke-width="${3 * k}"/>
    <ellipse cx="${cx + 15 * k}" cy="${cy}" rx="${r}" ry="${r * 1.15}" fill="#ffffff" stroke="#1e293b" stroke-width="${3 * k}"/>
    <circle cx="${cx - 14 * k}" cy="${cy + 1.5 * k}" r="${4.5 * k}" fill="#1e293b" data-detail="1"/>
    <circle cx="${cx + 16 * k}" cy="${cy + 1.5 * k}" r="${4.5 * k}" fill="#1e293b" data-detail="1"/>
    <path d="M${cx - 11 * k} ${cy + 20 * k} Q${cx} ${cy + 33 * k} ${cx + 11 * k} ${cy + 20 * k}"
          fill="none" stroke="#1e293b" stroke-width="${4 * k}" stroke-linecap="round"/>`;
}

function arm(x1, y1, x2, y2, color) {
  return `
    <path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${shade(color, 0.62)}"
          stroke-width="7" stroke-linecap="round"/>
    <circle cx="${x2}" cy="${y2}" r="9" fill="${color}" stroke="${shade(color, 0.62)}" stroke-width="3.5"/>`;
}

const GROUND = `<rect x="6" y="180" width="188" height="13" rx="6.5"
                      fill="#cfe6f8" stroke="#8fb4d4" stroke-width="3"/>`;

/* ---------- number pictures ----------
 * Three Numberblocks stand on a shelf with their numerals missing underneath.
 * The cubes are always drawn, so the child counts the blocks and drops the
 * matching numeral below them - quantity and symbol in one gesture. */
function digitsPicture(nums) {
  /* Wide spacing and a modest size on purpose: at 96 units the dashed outlines
   * of 4, 5 and 6 ran into each other and read as one tangle. */
  const xs = [40, 100, 160];
  return {
    id: 'digits-' + nums.join(''),
    base: GROUND + nums.map((n, i) =>
      blockStack(n, xs[i], 92, n <= 4 ? 17 : 15, BLOCK_COLORS[n])
    ).join(''),
    slots: nums.map((n, i) => ({
      key: 'd' + n,
      label: numberWord(n),
      audio: 'number-' + n,
      sc: shade(BLOCK_COLORS[n], 0.55),
      svg: numeral(n, xs[i], 176, 80, BLOCK_COLORS[n])
    }))
  };
}

/* One big Numberblock to finish: the cubes it is short of, its face and its
 * arms. Placing a cube speaks the character's own number, so the block is
 * counted out loud as it is built. */
function numberblockPicture(n, missing) {
  const color = BLOCK_COLORS[n];
  const { cols, rows } = grid(n);
  /* A tall tower has to lose cube size or it walks off the top of the box. */
  const s = Math.min(44, 132 / rows);
  const cx = 100;
  const bottom = 178;
  const left = cx - (cols * s) / 2;
  const top = bottom - rows * s;
  const at = (i) => ({
    x: left + (i % cols) * s,
    y: top + (rows - 1 - Math.floor(i / cols)) * s
  });

  let base = GROUND;
  for (let i = 0; i < n; i++) {
    if (missing.includes(i)) continue;
    const p = at(i);
    base += cube(p.x, p.y, s, color);
  }

  /* Face and arms sit on the BOTTOM row, and the cubes a picture is missing are
   * always from the top row. Anything else puts a dashed face inside a dashed
   * cube, and two outlines on top of each other read as one tangled shape. */
  const faceY = top + rows * s - s / 2;
  const k = s / 62;
  const slots = missing.map((i) => {
    const p = at(i);
    return {
      key: 'cube' + n, label: numberWord(n), audio: 'number-' + n,
      sc: shade(color, 0.62), svg: cube(p.x, p.y, s, color)
    };
  });

  slots.push({
    key: 'face', label: 'Eyes', audio: 'part-eyes', sc: '#1e293b',
    svg: nbFace(cx, faceY - 4, k)
  });
  slots.push({
    key: 'arm', label: 'Arm', audio: 'part-arm', sc: shade(color, 0.62),
    svg: arm(left - 2, faceY, left - 30, faceY - 24, color)
  });
  slots.push({
    key: 'arm', label: 'Arm', audio: 'part-arm', sc: shade(color, 0.62),
    svg: arm(left + cols * s + 2, faceY, left + cols * s + 30, faceY - 24, color)
  });

  return { id: 'nb-' + n, base, slots };
}

export const NUMBER_PUZZLES = [
  digitsPicture([1, 2, 3]),
  digitsPicture([4, 5, 6]),
  digitsPicture([7, 8, 9]),
  numberblockPicture(3, [2]),
  numberblockPicture(4, [3]),
  numberblockPicture(5, [4])
];

/* ---------- object pictures ---------- */
export const OBJECT_PUZZLES = [
  {
    id: 'face',
    base: `
      <circle cx="36" cy="124" r="13" fill="#ffd9b8" stroke="#d99b6c" stroke-width="4"/>
      <circle cx="164" cy="124" r="13" fill="#ffd9b8" stroke="#d99b6c" stroke-width="4"/>
      <ellipse cx="100" cy="120" rx="62" ry="68" fill="#ffd9b8" stroke="#d99b6c" stroke-width="4"/>
      <path d="M40 98 Q46 38 100 38 Q154 38 160 98 Q146 68 100 68 Q54 68 40 98 Z"
            fill="#7b4f2c" stroke="#5c3a1f" stroke-width="4" stroke-linejoin="round"/>
    `,
    slots: [
      {
        key: 'eyes', label: 'Eyes', audio: 'part-eyes', sc: '#3b3355',
        svg: `
          <ellipse cx="78" cy="102" rx="13" ry="15" fill="#ffffff" stroke="#3b3355" stroke-width="3.5"/>
          <ellipse cx="122" cy="102" rx="13" ry="15" fill="#ffffff" stroke="#3b3355" stroke-width="3.5"/>
          <circle cx="80" cy="104" r="6.5" fill="#3b3355" data-detail="1"/>
          <circle cx="124" cy="104" r="6.5" fill="#3b3355" data-detail="1"/>
        `
      },
      {
        key: 'nose', label: 'Nose', audio: 'part-nose', sc: '#c9735a',
        svg: `<path d="M100 120 L113 144 Q100 153 87 144 Z"
                    fill="#f0a184" stroke="#c9735a" stroke-width="3.5" stroke-linejoin="round"/>`
      },
      {
        key: 'mouth', label: 'Mouth', audio: 'part-mouth', sc: '#a83a4c',
        svg: `<path d="M72 163 Q100 191 128 163 Q100 175 72 163 Z"
                    fill="#e2586b" stroke="#a83a4c" stroke-width="3.5" stroke-linejoin="round"/>`
      }
    ]
  },

  {
    id: 'cat',
    base: `
      <circle cx="100" cy="116" r="62" fill="#fbbf24" stroke="#c98a12" stroke-width="4"/>
      <path d="M100 146 Q100 160 86 160 M100 146 Q100 160 114 160"
            fill="none" stroke="#8a5f08" stroke-width="4" stroke-linecap="round"/>
      <path d="M40 116 H8 M42 130 H12 M160 116 H192 M158 130 H188"
            fill="none" stroke="#8a5f08" stroke-width="4" stroke-linecap="round"/>
    `,
    slots: [
      {
        key: 'ear', label: 'Ear', audio: 'part-ear', sc: '#c98a12',
        svg: `<path d="M50 74 L38 22 L88 48 Z"
                    fill="#fbbf24" stroke="#c98a12" stroke-width="4" stroke-linejoin="round"/>`
      },
      {
        key: 'ear', label: 'Ear', audio: 'part-ear', sc: '#c98a12',
        svg: `<path d="M150 74 L162 22 L112 48 Z"
                    fill="#fbbf24" stroke="#c98a12" stroke-width="4" stroke-linejoin="round"/>`
      },
      {
        key: 'eyes', label: 'Eyes', audio: 'part-eyes', sc: '#2f7a4f',
        svg: `
          <ellipse cx="76" cy="102" rx="14" ry="16" fill="#eafff3" stroke="#2f7a4f" stroke-width="3.5"/>
          <ellipse cx="124" cy="102" rx="14" ry="16" fill="#eafff3" stroke="#2f7a4f" stroke-width="3.5"/>
          <ellipse cx="76" cy="102" rx="4" ry="12" fill="#1e293b" data-detail="1"/>
          <ellipse cx="124" cy="102" rx="4" ry="12" fill="#1e293b" data-detail="1"/>
        `
      },
      {
        key: 'nose', label: 'Nose', audio: 'part-nose', sc: '#c2506f',
        svg: `<path d="M86 120 H114 L100 134 Z"
                    fill="#f9a8c8" stroke="#c2506f" stroke-width="3.5" stroke-linejoin="round"/>`
      }
    ]
  },

  {
    id: 'car',
    base: `
      <path d="M20 152 L20 116 Q20 106 30 104 L62 98 L84 70 Q88 63 96 63 L142 63
               Q152 63 156 71 L172 102 Q182 106 182 118 L182 152 Q182 160 174 160
               L28 160 Q20 160 20 152 Z"
            fill="#ef4444" stroke="#9f1d1d" stroke-width="4" stroke-linejoin="round"/>
      <rect x="40" y="120" width="26" height="12" rx="6" fill="#fde68a" stroke="#9f1d1d" stroke-width="3"/>
      <rect x="6" y="180" width="188" height="13" rx="6.5" fill="#cfe6f8" stroke="#8fb4d4" stroke-width="3"/>
    `,
    slots: [
      {
        key: 'wheel', label: 'Wheel', audio: 'part-wheel', sc: '#334155',
        svg: `
          <circle cx="62" cy="160" r="22" fill="#334155" stroke="#1e293b" stroke-width="4"/>
          <circle cx="62" cy="160" r="8" fill="#cbd5e1" data-detail="1"/>
        `
      },
      {
        key: 'wheel', label: 'Wheel', audio: 'part-wheel', sc: '#334155',
        svg: `
          <circle cx="142" cy="160" r="22" fill="#334155" stroke="#1e293b" stroke-width="4"/>
          <circle cx="142" cy="160" r="8" fill="#cbd5e1" data-detail="1"/>
        `
      },
      {
        key: 'window', label: 'Window', audio: 'part-window', sc: '#0369a1',
        svg: `<path d="M98 72 L140 72 Q148 72 151 79 L162 99 L98 99 Z"
                    fill="#bae6fd" stroke="#0369a1" stroke-width="3.5" stroke-linejoin="round"/>`
      }
    ]
  },

  {
    id: 'house',
    base: `
      <rect x="36" y="96" width="128" height="82" rx="6" fill="#fde68a" stroke="#c58f16" stroke-width="4"/>
      <rect x="10" y="176" width="180" height="14" rx="7" fill="#86c66b" stroke="#4c8a37" stroke-width="3"/>
    `,
    slots: [
      {
        key: 'roof', label: 'Roof', audio: 'part-roof', sc: '#8f1616',
        svg: `<path d="M22 92 L100 30 L178 92 Z"
                    fill="#dc2626" stroke="#8f1616" stroke-width="4" stroke-linejoin="round"/>`
      },
      {
        key: 'door', label: 'Door', audio: 'part-door', sc: '#5a2708',
        svg: `
          <rect x="88" y="122" width="36" height="56" rx="5" fill="#a9601f" stroke="#5a2708" stroke-width="3.5"/>
          <circle cx="116" cy="152" r="4" fill="#fde68a" data-detail="1"/>
        `
      },
      {
        key: 'window', label: 'Window', audio: 'part-window', sc: '#0369a1',
        svg: `
          <rect x="46" y="112" width="32" height="32" rx="4" fill="#bae6fd" stroke="#0369a1" stroke-width="3.5"/>
          <path d="M62 112 V144 M46 128 H78" stroke="#0369a1" stroke-width="3" data-detail="1"/>
        `
      }
    ]
  },

  {
    id: 'snowman',
    base: `
      <circle cx="100" cy="156" r="40" fill="#ffffff" stroke="#93b9d4" stroke-width="4"/>
      <circle cx="100" cy="108" r="29" fill="#ffffff" stroke="#93b9d4" stroke-width="4"/>
      <circle cx="100" cy="70" r="23" fill="#ffffff" stroke="#93b9d4" stroke-width="4"/>
      <path d="M72 104 L36 88 M128 104 L164 88"
            fill="none" stroke="#8a5f2c" stroke-width="5" stroke-linecap="round"/>
      <circle cx="100" cy="100" r="5" fill="#334155"/>
      <circle cx="100" cy="118" r="5" fill="#334155"/>
    `,
    slots: [
      {
        key: 'hat', label: 'Hat', audio: 'part-hat', sc: '#1e293b',
        svg: `
          <rect x="80" y="14" width="40" height="28" rx="3" fill="#334155" stroke="#1e293b" stroke-width="3.5"/>
          <rect x="62" y="40" width="76" height="10" rx="5" fill="#334155" stroke="#1e293b" stroke-width="3.5"/>
        `
      },
      {
        key: 'eyes', label: 'Eyes', audio: 'part-eyes', sc: '#1e293b',
        svg: `
          <circle cx="90" cy="64" r="6" fill="#1e293b"/>
          <circle cx="110" cy="64" r="6" fill="#1e293b"/>
        `
      },
      {
        key: 'nose', label: 'Nose', audio: 'part-nose', sc: '#c2600f',
        svg: `<path d="M100 74 L132 80 L100 86 Z"
                    fill="#fb923c" stroke="#c2600f" stroke-width="3.5" stroke-linejoin="round"/>`
      }
    ]
  },

  {
    id: 'basket',
    base: `
      <path d="M34 112 L48 176 Q50 186 60 186 L140 186 Q150 186 152 176 L166 112 Z"
            fill="#d9a066" stroke="#8f5a20" stroke-width="4" stroke-linejoin="round"/>
      <path d="M52 136 H148 M56 158 H144" fill="none" stroke="#8f5a20" stroke-width="3" opacity="0.6"/>
      <rect x="28" y="102" width="144" height="14" rx="7" fill="#c98a4b" stroke="#8f5a20" stroke-width="4"/>
    `,
    slots: [
      {
        key: 'apple', label: 'Apple', audio: 'part-apple', sc: '#991b1b',
        svg: `
          <path d="M52 48 Q30 48 30 69 Q30 92 52 100 Q74 92 74 69 Q74 48 52 48 Z"
                fill="#ef4444" stroke="#991b1b" stroke-width="3.5" stroke-linejoin="round"/>
          <path d="M52 50 V36" stroke="#5a3a1a" stroke-width="4" data-detail="1"/>
          <ellipse cx="63" cy="36" rx="9" ry="5" fill="#34a853" data-detail="1"/>
        `
      },
      {
        key: 'banana', label: 'Banana', audio: 'part-banana', sc: '#a16207',
        svg: `<path d="M92 46 Q96 86 126 92 Q116 102 102 98 Q84 90 82 52 Z"
                    fill="#facc15" stroke="#a16207" stroke-width="3.5" stroke-linejoin="round"/>`
      },
      {
        key: 'pear', label: 'Pear', audio: 'part-pear', sc: '#4d7c0f',
        svg: `
          <path d="M144 100 Q130 100 130 87 Q130 78 137 72 Q142 68 142 58 Q142 47 152 47
                   Q162 47 162 58 Q162 68 167 72 Q174 78 174 87 Q174 100 160 100 Z"
                fill="#a3d13a" stroke="#4d7c0f" stroke-width="3.5" stroke-linejoin="round"/>
          <path d="M152 47 V35" stroke="#5a3a1a" stroke-width="4" data-detail="1"/>
        `
      }
    ]
  }
];

/* Numbers come up more often than objects: the child is a Numberblocks fan and
 * this is the game where a numeral gets handled rather than just watched. */
export const NUMBER_SHARE = 0.6;

/* Card-face themes for Peek & Match (scene id `memory`).
 *
 * A theme only knows how to draw and announce ONE of its own items - the
 * scene owns round-building, flipping and matching. `pool` is bigger than
 * the 3 pairs a round needs so successive rounds of the same theme don't
 * always show the same three faces (mirrors MatchScene's pickRound).
 */

import { makeBlock } from '../utils/blocks.js';

function svgFace(markup, cls) {
  const wrap = document.createElement('div');
  wrap.className = 'mem-face-art';
  wrap.innerHTML = `<svg viewBox="0 0 100 100" class="${cls}">${markup}</svg>`;
  return wrap;
}

/* ---------- (b) simple shapes/colours ---------- */
const SHAPES = [
  { id: 'circle', color: '#ef4444', d: '<circle cx="50" cy="50" r="40"/>' },
  { id: 'square', color: '#38bdf8', d: '<rect x="12" y="12" width="76" height="76" rx="16"/>' },
  { id: 'triangle', color: '#facc15', d: '<path d="M50 8 L92 88 L8 88 Z" stroke-linejoin="round"/>' },
  { id: 'star', color: '#22c55e', d: '<path d="M50 6 L61 38 L96 38 L67 59 L78 92 L50 71 L22 92 L33 59 L4 38 L39 38 Z" stroke-linejoin="round"/>' },
  { id: 'heart', color: '#ec4899', d: '<path d="M50 90 C10 62 8 30 32 20 C44 15 50 26 50 32 C50 26 56 15 68 20 C92 30 90 62 50 90 Z" stroke-linejoin="round"/>' },
  { id: 'diamond', color: '#8b5cf6', d: '<path d="M50 8 L92 50 L50 92 L8 50 Z" stroke-linejoin="round"/>' }
];

/* ---------- (c) animals, drawn flat and chunky like the puzzle pieces ---------- */
const ANIMALS = [
  {
    id: 'cat',
    d: `<path d="M20 30 L30 8 L38 32 Z" fill="#fb923c" stroke="#c2570b" stroke-width="4" stroke-linejoin="round"/>
        <path d="M80 30 L70 8 L62 32 Z" fill="#fb923c" stroke="#c2570b" stroke-width="4" stroke-linejoin="round"/>
        <circle cx="50" cy="55" r="38" fill="#fdba74" stroke="#c2570b" stroke-width="4"/>
        <circle cx="38" cy="50" r="5" fill="#3b3355"/><circle cx="62" cy="50" r="5" fill="#3b3355"/>
        <path d="M50 60 L45 66 L55 66 Z" fill="#3b3355"/>
        <path d="M50 66 Q50 72 44 74 M50 66 Q50 72 56 74" stroke="#3b3355" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M14 58 H2 M14 65 H4 M86 58 H98 M86 65 H96" stroke="#3b3355" stroke-width="3" fill="none" stroke-linecap="round"/>`
  },
  {
    id: 'dog',
    d: `<ellipse cx="18" cy="50" rx="14" ry="20" fill="#b97a3f" stroke="#8a5a2c" stroke-width="4" transform="rotate(-16 18 50)"/>
        <ellipse cx="82" cy="50" rx="14" ry="20" fill="#b97a3f" stroke="#8a5a2c" stroke-width="4" transform="rotate(16 82 50)"/>
        <circle cx="50" cy="56" r="36" fill="#d9a066" stroke="#8a5a2c" stroke-width="4"/>
        <circle cx="40" cy="52" r="5" fill="#3b3355"/><circle cx="60" cy="52" r="5" fill="#3b3355"/>
        <ellipse cx="50" cy="66" rx="9" ry="6" fill="#5c3a1f"/>
        <path d="M50 70 Q50 78 40 80 M50 70 Q50 78 60 80" stroke="#5c3a1f" stroke-width="3" fill="none" stroke-linecap="round"/>`
  },
  {
    id: 'bunny',
    d: `<ellipse cx="36" cy="20" rx="9" ry="26" fill="#f3d9c4" stroke="#caa27e" stroke-width="4"/>
        <ellipse cx="64" cy="20" rx="9" ry="26" fill="#f3d9c4" stroke="#caa27e" stroke-width="4"/>
        <circle cx="50" cy="60" r="34" fill="#fbe8d8" stroke="#caa27e" stroke-width="4"/>
        <circle cx="40" cy="56" r="5" fill="#3b3355"/><circle cx="60" cy="56" r="5" fill="#3b3355"/>
        <path d="M50 64 L45 70 L55 70 Z" fill="#e8879f"/>
        <path d="M50 70 Q50 76 42 78 M50 70 Q50 76 58 78" stroke="#3b3355" stroke-width="3" fill="none" stroke-linecap="round"/>`
  },
  {
    id: 'duck',
    d: `<ellipse cx="50" cy="64" rx="34" ry="26" fill="#fde047" stroke="#ca9a0b" stroke-width="4"/>
        <circle cx="50" cy="32" r="20" fill="#fde047" stroke="#ca9a0b" stroke-width="4"/>
        <path d="M50 36 Q68 36 68 45 Q68 52 50 49 Z" fill="#f97316" stroke="#c2570b" stroke-width="3" stroke-linejoin="round"/>
        <circle cx="44" cy="28" r="4" fill="#3b3355"/>`
  },
  {
    id: 'fish',
    d: `<path d="M78 50 L98 32 L98 68 Z" fill="#38bdf8" stroke="#0a7fb0" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="44" cy="50" rx="34" ry="24" fill="#38bdf8" stroke="#0a7fb0" stroke-width="4"/>
        <circle cx="26" cy="46" r="5" fill="#17223a"/>
        <path d="M44 50 Q58 42 70 50 Q58 58 44 50 Z" fill="#0ea5e9" opacity="0.6"/>`
  },
  {
    id: 'bee',
    d: `<ellipse cx="30" cy="30" rx="15" ry="10" fill="#e0f2fe" opacity="0.85" transform="rotate(-20 30 30)"/>
        <ellipse cx="70" cy="30" rx="15" ry="10" fill="#e0f2fe" opacity="0.85" transform="rotate(20 70 30)"/>
        <ellipse cx="50" cy="56" rx="30" ry="24" fill="#fde047" stroke="#8a6d0a" stroke-width="4"/>
        <path d="M26 46 H74 M22 56 H78 M26 66 H74" stroke="#17223a" stroke-width="7" stroke-linecap="round"/>
        <circle cx="50" cy="30" r="4" fill="#3b3355"/>`
  }
];

export const THEMES = [
  {
    id: 'numberblocks',
    pool: [1, 2, 3, 4, 5],
    makeFace(n) { return makeBlock(n, { compact: true }); },
    speak(n, index, sound) { sound.number(n, { interrupt: true }); }
  },
  {
    id: 'shapes',
    pool: SHAPES.map((s) => s.id),
    makeFace(id) {
      const s = SHAPES.find((x) => x.id === id);
      return svgFace(`<g fill="${s.color}" stroke="rgba(23,34,58,0.35)" stroke-width="4">${s.d}</g>`, 'mem-shape');
    },
    speak(id, index, sound) { sound.bubble(index); }
  },
  {
    id: 'animals',
    pool: ANIMALS.map((a) => a.id),
    makeFace(id) {
      const a = ANIMALS.find((x) => x.id === id);
      return svgFace(a.d, 'mem-shape');
    },
    speak(id, index, sound) { sound.bubble(index); }
  }
];

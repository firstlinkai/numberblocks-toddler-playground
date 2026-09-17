/* Verifies that for every glyph in Trace & Pop the bubbles fully cover the
 * stroke underneath. If a stretch of stroke is left bare the toddler sees the
 * answer before tracing, and that bare stretch has no bubble to pop.
 * Run: node scripts/check-glyph-coverage.mjs   (exits non-zero on a gap) */
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'src', 'scenes', 'TracePopScene.js');

/* The scene imports browser-only modules, so pull the three pure helpers out
 * of the source text and evaluate just those. */
const src = fs.readFileSync(SRC, 'utf8');
const grab = (name) => {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} not found in TracePopScene.js`);
  let depth = 0, i = src.indexOf('{', start);
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
};
const constBlock = (name) => {
  const start = src.indexOf(`const ${name} = {`);
  assert.ok(start >= 0, `${name} not found`);
  let depth = 0;
  for (let j = src.indexOf('{', start); j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error(`unbalanced braces in ${name}`);
};

const { STROKES, LETTER_STROKES, bubblePositions } = new Function(
  `${grab('ellipsePts')}\n${constBlock('STROKES')}\n${constBlock('LETTER_STROKES')}\n${grab('bubblePositions')}\n` +
  'return { STROKES, LETTER_STROKES, bubblePositions };'
)();

const GLYPH_STROKE = Number(/const GLYPH_STROKE = (\d+(?:\.\d+)?)/.exec(src)?.[1]);
assert.ok(Number.isFinite(GLYPH_STROKE), 'GLYPH_STROKE not found in TracePopScene.js');

/* Same numbers the scene uses at a typical iPad size (h≈590 => scale≈4.2) */
const scale = 4.2;
const rBubble = Math.max(22, Math.min(58, scale * 12));
const spacing = Math.max(9, (rBubble * 1.15) / scale);
const rNorm = rBubble / scale;          // bubble radius in glyph units
const S = 0.7;                          // scene shrinks the glyph by 0.7

const scaleStrokes = (strokes) =>
  strokes.map((s) => ({ pts: s.pts.map(([x, y]) => [50 + (x - 50) * S, 70 + (y - 70) * S]) }));

/* Walk each stroke densely; every sampled point must sit inside some bubble */
function worstGap(strokes) {
  const scaled = scaleStrokes(strokes);
  const bubbles = bubblePositions(scaled, spacing);
  let worst = 0;
  for (const s of scaled) {
    for (let i = 1; i < s.pts.length; i++) {
      const [ax, ay] = s.pts[i - 1];
      const [bx, by] = s.pts[i];
      const steps = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) * 4));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const px = ax + (bx - ax) * t;
        const py = ay + (by - ay) * t;
        let best = Infinity;
        for (const [qx, qy] of bubbles) best = Math.min(best, Math.hypot(px - qx, py - qy));
        worst = Math.max(worst, best);
      }
    }
  }
  return worst;
}

const glyphs = [
  ...Object.entries(STROKES).map(([k, v]) => [`digit ${k}`, v]),
  ...Object.entries(LETTER_STROKES).map(([k, v]) => [`letter ${k}`, v])
];

/* The glyph is a stroke, not a hairline: its EDGE sits half a stroke width
 * away from the path the bubbles follow, so that half-width has to fit inside
 * the bubble too or the outline shows through. */
const STROKE_HALF = GLYPH_STROKE / 2;

const bad = [];
for (const [name, strokes] of glyphs) {
  const reach = worstGap(strokes) + STROKE_HALF;
  if (reach > rNorm) bad.push(`${name}: bare by ${(reach - rNorm).toFixed(1)}u`);
}

if (bad.length) {
  console.error(`UNCOVERED STROKE on ${bad.length} glyph(s):\n  ${bad.join('\n  ')}`);
  process.exit(1);
}
console.log(`all ${glyphs.length} glyphs fully covered `
  + `(bubble radius ${rNorm.toFixed(1)}u vs stroke half-width ${STROKE_HALF}u)`);

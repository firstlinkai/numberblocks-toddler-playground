/* Connect the Dots: assert no two dots in a picture overlap on screen.
 * A dot renders ~20 units across in the 0-200 box, so two dots closer than
 * MIN_GAP sit on top of each other and a toddler cannot tell which is which.
 * Run: node scripts/check-dots.mjs        (exits non-zero on an overlap) */
import { DOT_SHAPES } from '../src/scenes/dots-shapes.js';

const MIN_GAP = 26;
let bad = 0;

for (const s of DOT_SHAPES) {
  for (let i = 0; i < s.dots.length; i++) {
    for (let j = i + 1; j < s.dots.length; j++) {
      const d = Math.hypot(s.dots[i][0] - s.dots[j][0], s.dots[i][1] - s.dots[j][1]);
      if (d < MIN_GAP) {
        console.error(`${s.id}: dots ${i + 1} and ${j + 1} are ${d.toFixed(1)}u apart (min ${MIN_GAP})`);
        bad++;
      }
    }
  }
}

console.log(`${DOT_SHAPES.length} pictures checked, ${bad} overlapping pair(s)`);
process.exit(bad ? 1 : 0);

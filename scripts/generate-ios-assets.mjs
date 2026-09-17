/* iOS home-screen + link-preview assets. Uses sharp (already in scripts/node_modules).
 *   public/icons/apple-touch-icon-180.png  - 180x180, downscaled from icon-512
 *   public/icons/splash-<W>x<H>.png        - iPad landscape launch screens (no white flash)
 *   public/og-image.png                    - 1200x630 social preview card
 * Run: node scripts/generate-ios-assets.mjs                                        */
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ICONS = path.join(ROOT, 'public', 'icons');
const SRC_ICON = path.join(ICONS, 'icon-512.png');
const CREAM = '#FFFDED';

/* BLOCK_COLORS 1-5, copied from src/utils/blocks.js (that file is not importable
 * from here without a bundler, and these five never change). */
const COLORS = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#38bdf8'];

/* iPad landscape launch screens. dw/dh are the device's PORTRAIT CSS size -
 * `orientation: landscape` is what picks the landscape asset. */
const SPLASH = [
  { w: 2048, h: 1536, dw: 768, dh: 1024, note: 'iPad 9.7", iPad mini' },
  { w: 2224, h: 1668, dw: 834, dh: 1112, note: 'iPad Pro 10.5"' },
  { w: 2388, h: 1668, dw: 834, dh: 1194, note: 'iPad Pro 11"' },
  { w: 2360, h: 1640, dw: 820, dh: 1180, note: 'iPad Air 10.9", iPad 10th gen' },
  { w: 2732, h: 2048, dw: 1024, dh: 1366, note: 'iPad Pro 12.9"' }
];

/* ---------- og:image ---------- */
/* One Numberblocks cube: flat fill + top highlight + bottom shade, same
 * top-lit treatment as .nb-seg in style.css. */
function cube(x, y, s, fill, face) {
  const p = s * 0.055;
  const [cx, cy] = [x + s / 2, y + s / 2];
  const eye = s * 0.1, pup = s * 0.045, ox = s * 0.17;
  return `
    <rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * 0.14}" fill="${fill}"/>
    <rect x="${x + p}" y="${y + p}" width="${s - 2 * p}" height="${s * 0.13}" rx="${s * 0.06}" fill="#fff" opacity="0.42"/>
    <rect x="${x + p}" y="${y + s - p - s * 0.12}" width="${s - 2 * p}" height="${s * 0.12}" rx="${s * 0.06}" fill="#000" opacity="0.18"/>
    ${face ? `
    <circle cx="${cx - ox}" cy="${cy - s * 0.05}" r="${eye}" fill="#fff"/>
    <circle cx="${cx + ox}" cy="${cy - s * 0.05}" r="${eye}" fill="#fff"/>
    <circle cx="${cx - ox + s * 0.01}" cy="${cy - s * 0.03}" r="${pup}" fill="#1f2937"/>
    <circle cx="${cx + ox + s * 0.01}" cy="${cy - s * 0.03}" r="${pup}" fill="#1f2937"/>
    <path d="M ${cx - s * 0.14} ${cy + s * 0.15} q ${s * 0.14} ${s * 0.13} ${s * 0.28} 0"
          stroke="#1f2937" stroke-width="${s * 0.045}" stroke-linecap="round" fill="none"/>` : ''}`;
}

function ogSvg() {
  const [W, H] = [1200, 630];
  const U = 74, PITCH = 124, BASE = 574;
  const x0 = (W - (4 * PITCH + U)) / 2;
  let stacks = '';
  COLORS.forEach((c, i) => {
    const n = i + 1, x = x0 + i * PITCH;
    stacks += `<ellipse cx="${x + U / 2}" cy="${BASE + 12}" rx="${U * 0.58}" ry="${U * 0.12}" fill="#1f2937" opacity="0.13"/>`;
    for (let k = 0; k < n; k++) {
      stacks += cube(x + 3, BASE - (k + 1) * U + 3, U - 6, c, k === n - 1);
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#7ec3f5"/><stop offset="0.32" stop-color="#a8ddf9"/>
    <stop offset="0.62" stop-color="#d7f1fd"/><stop offset="1" stop-color="${CREAM}"/>
  </linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="158" cy="352" r="80" fill="#ffe873"/>
  <text x="${W / 2}" y="152" text-anchor="middle" fill="#1f2937"
        font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="86" font-weight="800">Number Playground</text>
  <text x="${W / 2}" y="206" text-anchor="middle" fill="#1f2937" opacity="0.72"
        font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="34" font-weight="600">Counting games for toddlers</text>
  ${stacks}
</svg>`;
}

/* ---------- build ---------- */
const out = [];
const write = async (file, img) => {
  await img.png({ compressionLevel: 9 }).toFile(file);
  out.push(file);
};

await write(path.join(ICONS, 'apple-touch-icon-180.png'), sharp(SRC_ICON).resize(180, 180, { fit: 'cover' }));

for (const s of SPLASH) {
  const icon = await sharp(SRC_ICON)
    .resize(Math.round(Math.min(s.w, s.h) * 0.22))
    .toBuffer();
  await write(
    path.join(ICONS, `splash-${s.w}x${s.h}.png`),
    sharp({ create: { width: s.w, height: s.h, channels: 3, background: CREAM } })
      .composite([{ input: icon, gravity: 'centre' }])
  );
}

await write(path.join(ROOT, 'public', 'og-image.png'), sharp(Buffer.from(ogSvg())));

/* ---------- verify ---------- */
for (const f of out) {
  const { width, height } = await sharp(f).metadata();
  const bytes = fs.statSync(f).size;
  const claimed = path.basename(f).match(/(\d+)x(\d+)/);
  if (claimed) assert.deepEqual([width, height], [+claimed[1], +claimed[2]], `${f} size mismatch`);
  assert.ok(bytes > 0, `${f} is empty`);
  console.log(`${path.relative(ROOT, f)}  ${width}x${height}  ${bytes} bytes`);
}

/* Fonts can fail silently in librsvg and leave the title invisible - assert the
 * title band actually contains near-black glyph pixels (sky there is #7ec3f5). */
const band = await sharp(path.join(ROOT, 'public', 'og-image.png'))
  .extract({ left: 260, top: 80, width: 680, height: 100 })
  .stats();
assert.ok(band.channels[0].min < 80, 'og-image title did not render (missing font?)');

console.log('\nLink tags for index.html:');
for (const s of SPLASH) {
  console.log(`<link rel="apple-touch-startup-image" media="(device-width: ${s.dw}px) and (device-height: ${s.dh}px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)" href="/icons/splash-${s.w}x${s.h}.png" />`);
}

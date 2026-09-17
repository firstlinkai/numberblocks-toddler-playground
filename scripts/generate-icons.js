/* Generates public/icons/icon-192.png and icon-512.png with ZERO dependencies.
 * Pure Node PNG encoder (zlib) + programmatic pixel art:
 * indigo rounded square, green 2-block Numberblock with eyes, smile & cheeks.
 * Rendered 2x supersampled for smooth edges. Run: npm run icons */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

/* ---------------- minimal PNG encoder ---------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function pngFromRGBA(size, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw[o++] = rgba[i];
      raw[o++] = rgba[i + 1];
      raw[o++] = rgba[i + 2];
      raw[o++] = rgba[i + 3];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

/* ---------------- pixel drawing helpers ---------------- */
function inRoundRect(x, y, rx, ry, w, h, r) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.max(rx + r, Math.min(x, rx + w - r));
  const cy = Math.max(ry + r, Math.min(y, ry + h - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function inCircle(x, y, cx, cy, r) {
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/* Design space is 100x100; returns [r,g,b] or null (transparent) */
function shade(x, y) {
  if (!inRoundRect(x, y, 2, 2, 96, 96, 24)) return null;
  let c = [79, 70, 229]; // indigo background

  const seg = (bx, by) => {
    if (!inRoundRect(x, y, bx, by, 40, 25, 4)) return null;
    if (inRoundRect(x, y, bx + 2.5, by + 2.5, 35, 20, 3)) return [34, 197, 94];
    return [21, 128, 61];
  };
  const s = seg(30, 25) || seg(30, 50);
  if (s) c = s;

  if (inCircle(x, y, 40.5, 37.5, 5.4)) c = [255, 255, 255];
  if (inCircle(x, y, 59.5, 37.5, 5.4)) c = [255, 255, 255];
  if (inCircle(x, y, 41, 38.4, 2.5)) c = [31, 41, 55];
  if (inCircle(x, y, 60, 38.4, 2.5)) c = [31, 41, 55];

  const dSmile = Math.hypot(x - 50, y - 55);
  if (y > 55 && dSmile > 7.2 && dSmile < 9.6) c = [31, 41, 55];

  if (inCircle(x, y, 33, 46, 2.6)) c = [253, 164, 175];
  if (inCircle(x, y, 67, 46, 2.6)) c = [253, 164, 175];

  return c;
}

function renderIcon(L) {
  const S = 2;            // supersampling factor
  const W = L * S;
  const k = L / 100;      // design units -> pixels
  const pm = new Float64Array(W * W * 4); // premultiplied accumulation
  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const dx = (x + 0.5) / S / k;
      const dy = (y + 0.5) / S / k;
      const c = shade(dx, dy);
      const i = (y * W + x) * 4;
      if (c) {
        pm[i] = c[0]; pm[i + 1] = c[1]; pm[i + 2] = c[2]; pm[i + 3] = 1;
      }
    }
  }
  const out = Buffer.alloc(L * L * 4);
  for (let y = 0; y < L; y++) {
    for (let x = 0; x < L; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const i = ((y * S + sy) * W + (x * S + sx)) * 4;
          r += pm[i] * pm[i + 3];
          g += pm[i + 1] * pm[i + 3];
          b += pm[i + 2] * pm[i + 3];
          a += pm[i + 3];
        }
      }
      const o = (y * L + x) * 4;
      if (a > 0) {
        /* coverage is stored as 0/1 per sample (see pm[i + 3] above), so r/a is
         * already a 0-255 channel average - scaling it again overflowed the
         * byte and Buffer truncation turned every channel into 256 - v, which
         * is why the shipped icons came out olive and magenta */
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / (S * S)) * 255);
    }
  }
  return out;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512]) {
  const png = pngFromRGBA(size, renderIcon(size));
  const file = path.join(OUT_DIR, `icon-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`Wrote ${file} (${png.length} bytes)`);
}

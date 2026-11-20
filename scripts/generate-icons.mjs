// Generates the PWA icons: a 3x3 grid of squares brightening from gray to white,
// echoing the app's progress grid. Pure Node, no dependencies.
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
const BG = [0x16, 0x16, 0x1c];
const FG = [0xec, 0xeb, 0xf2];
const SHADES = [0.16, 0.38, 0.62, 0.38, 0.62, 0.8, 0.62, 0.8, 1];
const SS = 3; // supersampling

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(size, px) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) px.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** Opacity of the square covering (x, y) in unit coordinates, or 0. */
function shadeAt(x, y, inset) {
  const span = 1 - 2 * inset;
  const cell = span / 3;
  const gap = cell * 0.16;
  const gx = (x - inset) / cell;
  const gy = (y - inset) / cell;
  if (gx < 0 || gy < 0 || gx >= 3 || gy >= 3) return 0;
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  const lx = (gx - cx) * cell;
  const ly = (gy - cy) * cell;
  const r = cell * 0.18;
  const lo = gap / 2;
  const hi = cell - gap / 2;
  if (lx < lo || lx > hi || ly < lo || ly > hi) return 0;
  const dx = Math.max(lo + r - lx, 0, lx - (hi - r));
  const dy = Math.max(lo + r - ly, 0, ly - (hi - r));
  if (dx * dx + dy * dy > r * r) return 0;
  return SHADES[cy * 3 + cx];
}

function render(size, inset, roundCorners) {
  const px = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const cr = 0.22;
          const ddx = Math.max(cr - u, 0, u - (1 - cr));
          const ddy = Math.max(cr - v, 0, v - (1 - cr));
          if (roundCorners && ddx * ddx + ddy * ddy > cr * cr) continue;
          const s = shadeAt(u, v, inset);
          r += BG[0] + (FG[0] - BG[0]) * s;
          g += BG[1] + (FG[1] - BG[1]) * s;
          b += BG[2] + (FG[2] - BG[2]) * s;
          a += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      px[i] = r / n;
      px[i + 1] = g / n;
      px[i + 2] = b / n;
      px[i + 3] = a / n;
    }
  }
  return encodePng(size, px);
}

mkdirSync(OUT_DIR, { recursive: true });
const icons = [
  ['icon-192.png', 192, 0.18, false],
  ['icon-512.png', 512, 0.18, false],
  ['maskable-512.png', 512, 0.26, false],
  ['apple-touch-icon.png', 180, 0.18, false],
  ['favicon.png', 64, 0.1, true]
];
for (const [name, size, inset, round] of icons) {
  writeFileSync(join(OUT_DIR, name), render(size, inset, round));
  console.log(`wrote public/icons/${name}`);
}

// Genera los iconos PNG de la PWA (ruleta de 6 colores) sin dependencias.
// Uso: npm run icons
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const BG = [0x24, 0x16, 0x38], INK = [0x1b, 0x12, 0x30], GOLD = [0xff, 0xd2, 0x3f];
const COLORS = ["#5BA4FF", "#FFD23F", "#FF7AB6", "#FF9F43", "#4ADE80", "#B79CFF"].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) for (let c = 0; c < 3; c++) raw[y * (size * 3 + 1) + 1 + x * 3 + c] = px[(y * size + x) * 3 + c];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
function colorAt(x, y, R) {
  const dx = x, dy = y, d = Math.hypot(dx, dy);
  if (d > R) return BG;
  if (d > R * 0.94) return INK;
  if (d < R * 0.22) return d > R * 0.17 ? GOLD : INK;
  let a = Math.atan2(dx, -dy); if (a < 0) a += 2 * Math.PI;
  const seg = Math.floor(a / (Math.PI / 3)) % 6;
  // líneas separadoras
  const off = a - seg * (Math.PI / 3);
  if (Math.min(off, Math.PI / 3 - off) * d < R * 0.025) return INK;
  return COLORS[seg];
}
function icon(size, scale) {
  const px = Buffer.alloc(size * size * 3), R = size * scale, S = 4;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const acc = [0, 0, 0];
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const c = colorAt(x + (sx + 0.5) / S - size / 2, y + (sy + 0.5) / S - size / 2, R);
      acc[0] += c[0]; acc[1] += c[1]; acc[2] += c[2];
    }
    for (let c = 0; c < 3; c++) px[(y * size + x) * 3 + c] = Math.round(acc[c] / (S * S));
  }
  return png(size, px);
}
mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", icon(192, 0.44));
writeFileSync("public/icons/icon-512.png", icon(512, 0.44));
writeFileSync("public/icons/icon-maskable-512.png", icon(512, 0.34));
writeFileSync("public/icons/apple-touch-icon.png", icon(180, 0.40));
console.log("Iconos generados en public/icons");

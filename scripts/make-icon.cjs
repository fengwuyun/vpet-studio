// 生成 build/icon.png —— 圆角渐变底 + 白色爪印(512×512, 3x 超采样抗锯齿)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const S = 512, SS = 3, N = S * SS;
const R = 110 * SS; // 圆角半径

function inRoundedRect(x, y, w, h, r) {
  if (x >= r && x <= w - r) return true;
  if (y >= r && y <= h - r) return true;
  const cx = x < r ? r : w - r, cy = y < r ? r : h - r;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}
function inEllipse(x, y, cx, cy, rx, ry, rot) {
  const c = Math.cos(-rot), s = Math.sin(-rot);
  const dx = x - cx, dy = y - cy;
  const u = (dx * c - dy * s) / rx, v = (dx * s + dy * c) / ry;
  return u * u + v * v <= 1;
}
const lerp = (a, b, t) => a + (b - a) * t;

// 爪印元素(SS 坐标)
const C = N / 2;
const pad = { cx: C, cy: C + 62 * SS, rx: 88 * SS, ry: 74 * SS, rot: 0 };
const toes = [
  { a: -0.95, d: 118, rx: 30, ry: 38 }, { a: -0.32, d: 132, rx: 31, ry: 40 },
  { a: 0.32, d: 132, rx: 31, ry: 40 }, { a: 0.95, d: 118, rx: 30, ry: 38 },
].map((t) => ({
  cx: C + Math.sin(t.a) * t.d * SS, cy: C + 26 * SS - Math.cos(t.a) * t.d * SS * 0.92,
  rx: t.rx * SS, ry: t.ry * SS, rot: t.a * 0.55,
}));

const raw = Buffer.alloc((S * SS) ** 2 * 4);
for (let y = 0; y < N; y++) {
  for (let x = 0; x < N; x++) {
    const i = (y * N + x) * 4;
    // 对角渐变 #ff8fb8 -> #a78bfa
    const t = (x / N + y / N) / 2;
    let r = lerp(255, 167, t), g = lerp(143, 139, t), b = lerp(184, 250, t), a = 0;
    if (inRoundedRect(x, y, N, N, R)) a = 255;
    const paw = inEllipse(x, y, pad.cx, pad.cy, pad.rx, pad.ry, pad.rot) || toes.some((e) => inEllipse(x, y, e.cx, e.cy, e.rx, e.ry, e.rot));
    if (paw) { r = 255; g = 255; b = 255; }
    raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
  }
}

// SS 倍超采样降采样到 512
const out = Buffer.alloc(S * S * 4);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const i = ((y * SS + dy) * N + (x * SS + dx)) * 4;
      const al = raw[i + 3] / 255;
      r += raw[i] * al; g += raw[i + 1] * al; b += raw[i + 2] * al; a += al;
    }
    const n = SS * SS, i = (y * S + x) * 4;
    const al = a / n;
    if (al > 0) { out[i] = r / a; out[i + 1] = g / a; out[i + 2] = b / a; }
    out[i + 3] = Math.round(al * 255);
  }
}

// PNG 编码(RGBA, 无滤波)
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  c = -1;
  for (const b of buf) c = table[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
const rows = Buffer.alloc(S * (S * 4 + 1));
for (let y = 0; y < S; y++) {
  out.copy(rows, y * (S * 4 + 1) + 1, y * S * 4, (y + 1) * S * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
fs.mkdirSync(path.join(__dirname, '..', 'build'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'build', 'icon.png'), png);
console.log('build/icon.png', png.length, 'bytes');

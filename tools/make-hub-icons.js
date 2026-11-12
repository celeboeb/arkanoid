import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const name = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([len, name, data, crc]);
}

function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function blend(img, i, r, g, b, a) {
  const aa = a / 255;
  img[i] = img[i] * (1 - aa) + r * aa;
  img[i + 1] = img[i + 1] * (1 - aa) + g * aa;
  img[i + 2] = img[i + 2] * (1 - aa) + b * aa;
  img[i + 3] = 255;
}

function drawIcon(size) {
  const img = Buffer.alloc(size * size * 4, 0);
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = Math.min(x, size - 1 - x, radius);
      const dy = Math.min(y, size - 1 - y, radius);
      const outside = x < radius && y < radius
        ? Math.hypot(radius - x, radius - y) > radius
        : x > size - 1 - radius && y < radius
          ? Math.hypot(x - (size - 1 - radius), radius - y) > radius
          : x < radius && y > size - 1 - radius
            ? Math.hypot(radius - x, y - (size - 1 - radius)) > radius
            : x > size - 1 - radius && y > size - 1 - radius
              ? Math.hypot(x - (size - 1 - radius), y - (size - 1 - radius)) > radius
              : false;
      if (outside || dx < 0 || dy < 0) {
        img[i + 3] = 0;
        continue;
      }
      const t = y / size;
      img[i] = 232 - t * 28;
      img[i + 1] = 236 - t * 18;
      img[i + 2] = 230 - t * 16;
      img[i + 3] = 255;
    }
  }
  const dots = [
    [0.34, 0.4, 0.11, 110, 168, 160],
    [0.58, 0.36, 0.08, 196, 160, 150],
    [0.48, 0.58, 0.13, 143, 176, 196],
    [0.66, 0.6, 0.07, 210, 186, 150],
  ];
  for (const [cx, cy, rad, r, g, b] of dots) {
    const x0 = cx * size;
    const y0 = cy * size;
    const radiusPx = rad * size;
    for (let y = Math.floor(y0 - radiusPx); y <= y0 + radiusPx; y++) {
      for (let x = Math.floor(x0 - radiusPx); x <= x0 + radiusPx; x++) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.hypot(x - x0, y - y0);
        if (d <= radiusPx) blend(img, (y * size + x) * 4, r, g, b, 235);
      }
    }
  }
  return png(size, size, img);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), drawIcon(512));
console.log('hub icons written');

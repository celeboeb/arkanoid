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
  const img = Buffer.alloc(size * size * 4);
  const margin = size * 0.08;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const t = y / size;
      img[i] = 12 + t * 30;
      img[i + 1] = 8 + t * 10;
      img[i + 2] = 28 + t * 20;
      img[i + 3] = 255;
    }
  }
  const colors = [
    [255, 45, 45],
    [255, 140, 26],
    [255, 225, 74],
    [61, 255, 106],
    [61, 200, 255],
  ];
  const brickW = size * 0.72;
  const brickH = size * 0.055;
  const left = (size - brickW) / 2;
  const top = size * 0.22;
  for (let row = 0; row < 5; row++) {
    const [r, g, b] = colors[row];
    const y0 = Math.round(top + row * (brickH + size * 0.018));
    for (let y = y0; y < y0 + brickH; y++) {
      for (let x = Math.round(left); x < left + brickW; x++) {
        blend(img, (y * size + x) * 4, r, g, b, 255);
      }
    }
  }
  const paddleW = size * 0.38;
  const paddleH = size * 0.045;
  const py = Math.round(size * 0.72);
  const px = Math.round((size - paddleW) / 2);
  for (let y = py; y < py + paddleH; y++) {
    for (let x = px; x < px + paddleW; x++) {
      const u = (x - px) / paddleW;
      blend(img, (y * size + x) * 4, 46 + u * 200, 233 - u * 180, 255 - u * 40, 255);
    }
  }
  const cx = size * 0.62;
  const cy = size * 0.62;
  const rad = size * 0.045;
  for (let y = Math.floor(cy - rad * 2); y <= cy + rad * 2; y++) {
    for (let x = Math.floor(cx - rad * 2); x <= cx + rad * 2; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= rad) blend(img, (y * size + x) * 4, 255, 255, 255, 255);
      else if (d <= rad * 2) blend(img, (y * size + x) * 4, 46, 233, 255, (1 - (d - rad) / rad) * 180);
    }
  }
  return png(size, size, img);
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'icon-192.png'), drawIcon(192));
fs.writeFileSync(path.join(dir, 'icon-512.png'), drawIcon(512));
console.log('icons written');

export const BLOCKS_COUNT = 36;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const NEI = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function rotateCells(cells, turns) {
  let cur = cells.map(([x, y]) => [x, y]);
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    const maxX = Math.max(...cur.map((cell) => cell[0]));
    cur = cur.map(([x, y]) => [y, maxX - x]);
    const minX = Math.min(...cur.map((cell) => cell[0]));
    const minY = Math.min(...cur.map((cell) => cell[1]));
    cur = cur.map(([x, y]) => [x - minX, y - minY]);
  }
  cur.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  return cur;
}

function connected(mask) {
  let start = null;
  let need = 0;
  for (let y = 0; y < mask.length; y++) {
    for (let x = 0; x < mask[0].length; x++) {
      if (!mask[y][x]) continue;
      need += 1;
      if (!start) start = [x, y];
    }
  }
  if (!start) return false;
  const seen = new Set([`${start[0]},${start[1]}`]);
  const queue = [start];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of NEI) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || nx < 0 || ny >= mask.length || nx >= mask[0].length || !mask[ny][nx]) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen.size === need;
}

function boardSize(level) {
  if (level < 4) return [4, 4];
  if (level < 10) return [5, 4];
  if (level < 18) return [5, 5];
  if (level < 26) return [6, 5];
  return [6, 6];
}

export function generateBlocks(level, seed = level + 11) {
  const rng = mulberry32((seed * 131 + 7) >>> 0);
  const [w, h] = boardSize(level);
  const mask = Array.from({ length: h }, () => Array(w).fill(true));
  const holes = level < 8 ? 0 : level < 18 ? 1 + (level % 2) : 2 + (level % 3);
  let removed = 0;
  let guard = 0;
  while (removed < holes && guard < 100) {
    guard += 1;
    const x = 1 + Math.floor(rng() * Math.max(1, w - 2));
    const y = 1 + Math.floor(rng() * Math.max(1, h - 2));
    if (!mask[y][x]) continue;
    mask[y][x] = false;
    if (!connected(mask)) {
      mask[y][x] = true;
      continue;
    }
    removed += 1;
  }

  const remaining = new Set();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (mask[y][x]) remaining.add(`${x},${y}`);
  }
  const maxSize = level < 5 ? 3 : level < 16 ? 4 : 5;
  const minSize = level < 8 ? 1 : 2;
  const pieces = [];
  while (remaining.size) {
    const keys = [...remaining];
    const start = keys[Math.floor(rng() * keys.length)];
    remaining.delete(start);
    const piece = [start];
    const want = Math.min(remaining.size + piece.length, minSize + Math.floor(rng() * (maxSize - minSize + 1)));
    while (piece.length < want) {
      const options = [];
      for (const key of piece) {
        const [x, y] = key.split(',').map(Number);
        for (const [dx, dy] of NEI) {
          const next = `${x + dx},${y + dy}`;
          if (remaining.has(next)) options.push(next);
        }
      }
      if (!options.length) break;
      const pick = options[Math.floor(rng() * options.length)];
      remaining.delete(pick);
      piece.push(pick);
    }
    const coords = piece.map((key) => key.split(',').map(Number));
    const minX = Math.min(...coords.map((cell) => cell[0]));
    const minY = Math.min(...coords.map((cell) => cell[1]));
    const cells = coords
      .map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    pieces.push({
      id: pieces.length,
      cells,
      homeX: minX,
      homeY: minY,
      rot: Math.floor(rng() * 4),
      placed: false,
      x: 0,
      y: 0,
    });
  }

  const absolute = (piece) => piece.cells.map(([x, y]) => [x + piece.homeX, y + piece.homeY]);
  let merges = 0;
  while (merges < pieces.length) {
    merges += 1;
    const small = pieces.find((piece) => piece.cells.length === 1);
    if (!small) break;
    const [sx, sy] = absolute(small)[0];
    const host = pieces.find((piece) => piece !== small && absolute(piece).some(([x, y]) => Math.abs(x - sx) + Math.abs(y - sy) === 1));
    if (!host) break;
    const cells = absolute(host).concat([[sx, sy]]);
    const minX = Math.min(...cells.map((cell) => cell[0]));
    const minY = Math.min(...cells.map((cell) => cell[1]));
    host.homeX = minX;
    host.homeY = minY;
    host.cells = cells
      .map(([x, y]) => [x - minX, y - minY])
      .sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    pieces.splice(pieces.indexOf(small), 1);
  }
  pieces.forEach((piece, index) => {
    piece.id = index;
  });

  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }
  return { w, h, mask, pieces };
}

export function pieceCells(piece) {
  return rotateCells(piece.cells, piece.rot).map(([x, y]) => [piece.x + x, piece.y + y]);
}

export function canPlace(level, pieces, piece, x, y, rot) {
  const cells = rotateCells(piece.cells, rot);
  const occupied = new Set();
  for (const other of pieces) {
    if (!other.placed || other.id === piece.id) continue;
    for (const [cx, cy] of pieceCells(other)) occupied.add(`${cx},${cy}`);
  }
  for (const [dx, dy] of cells) {
    const X = x + dx;
    const Y = y + dy;
    if (Y < 0 || X < 0 || Y >= level.h || X >= level.w || !level.mask[Y][X]) return false;
    if (occupied.has(`${X},${Y}`)) return false;
  }
  return true;
}

export function isFilled(level, pieces) {
  const seen = new Set();
  for (const piece of pieces) {
    if (!piece.placed) return false;
    for (const [x, y] of pieceCells(piece)) {
      const key = `${x},${y}`;
      if (seen.has(key)) return false;
      if (y < 0 || x < 0 || y >= level.h || x >= level.w || !level.mask[y][x]) return false;
      seen.add(key);
    }
  }
  let need = 0;
  for (const row of level.mask) for (const cell of row) if (cell) need += 1;
  return seen.size === need;
}

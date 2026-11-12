export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
export const PIPES_COUNT = 36;

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

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

const OPP = { [N]: S, [E]: W, [S]: N, [W]: E };
const STEP = { [N]: [0, -1], [E]: [1, 0], [S]: [0, 1], [W]: [-1, 0] };
const BITS = [N, E, S, W];

export function rotateMask(mask, turns) {
  let m = mask & 15;
  const t = ((turns % 4) + 4) % 4;
  for (let i = 0; i < t; i++) {
    let next = 0;
    if (m & N) next |= E;
    if (m & E) next |= S;
    if (m & S) next |= W;
    if (m & W) next |= N;
    m = next;
  }
  return m;
}

export function maskOf(cell) {
  return rotateMask(cell.base, cell.rot);
}

function sizeFor(level) {
  if (level < 2) return 3;
  if (level < 6) return 4;
  if (level < 12) return 5;
  if (level < 20) return 6;
  if (level < 28) return 7;
  return 8;
}

function openings(mask) {
  return BITS.filter((bit) => mask & bit);
}

export function generatePipes(level, seed = level + 1) {
  const rng = mulberry32((seed * 97 + 13) >>> 0);
  const n = sizeFor(level);
  const seen = new Set();
  const edges = [];
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  function dfs(x, y) {
    seen.add(y * n + x);
    const order = dirs.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (const [dx, dy] of order) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n || seen.has(ny * n + nx)) continue;
      edges.push([y * n + x, ny * n + nx]);
      dfs(nx, ny);
    }
  }

  dfs(Math.floor(rng() * n), Math.floor(rng() * n));
  const base = new Array(n * n).fill(0);
  for (const [a, b] of edges) {
    const ax = a % n;
    const ay = (a / n) | 0;
    const bx = b % n;
    const by = (b / n) | 0;
    if (by === ay - 1) {
      base[a] |= N;
      base[b] |= S;
    } else if (bx === ax + 1) {
      base[a] |= E;
      base[b] |= W;
    } else if (by === ay + 1) {
      base[a] |= S;
      base[b] |= N;
    } else {
      base[a] |= W;
      base[b] |= E;
    }
  }

  const leaves = [];
  base.forEach((mask, i) => {
    if (openings(mask).length === 1) leaves.push(i);
  });
  const source = pick(rng, leaves);
  const sinkCount = Math.min(leaves.length - 1, 1 + Math.floor(level / 8));
  const pool = leaves.filter((i) => i !== source);
  const sinks = new Set();
  while (sinks.size < sinkCount && pool.length) {
    const i = Math.floor(rng() * pool.length);
    sinks.add(pool.splice(i, 1)[0]);
  }

  const cells = base.map((mask, i) => ({
    base: mask,
    rot: 0,
    role: i === source ? 'source' : sinks.has(i) ? 'sink' : 'pipe',
  }));

  for (const cell of cells) {
    if (cell.role === 'source') continue;
    const options = [1, 2, 3].filter((rot) => rotateMask(cell.base, rot) !== cell.base);
    if (options.length) cell.rot = pick(rng, options);
  }

  let puzzle = { n, cells };
  if (isSolved(puzzle)) {
    const cell = cells.find((item) => item.role !== 'source' && openings(item.base).length === 1);
    if (cell) cell.rot = (cell.rot + 1) % 4;
    puzzle = { n, cells };
  }
  return puzzle;
}

export function flow(level) {
  const { n, cells } = level;
  const wet = new Set();
  const dist = new Array(cells.length).fill(-1);
  const source = cells.findIndex((cell) => cell.role === 'source');
  if (source < 0) return { wet, dist };
  const queue = [source];
  wet.add(source);
  dist[source] = 0;
  while (queue.length) {
    const i = queue.shift();
    const mask = maskOf(cells[i]);
    const x = i % n;
    const y = (i / n) | 0;
    for (const bit of BITS) {
      if (!(mask & bit)) continue;
      const [dx, dy] = STEP[bit];
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const j = ny * n + nx;
      if (!(maskOf(cells[j]) & OPP[bit]) || wet.has(j)) continue;
      wet.add(j);
      dist[j] = dist[i] + 1;
      queue.push(j);
    }
  }
  return { wet, dist };
}

export function isSolved(level) {
  const sinks = [];
  level.cells.forEach((cell, i) => {
    if (cell.role === 'sink') sinks.push(i);
  });
  if (!sinks.length) return false;
  const { wet } = flow(level);
  return sinks.every((i) => wet.has(i));
}

export function solvedCopy(level) {
  return {
    n: level.n,
    cells: level.cells.map((cell) => ({ ...cell, rot: 0 })),
  };
}

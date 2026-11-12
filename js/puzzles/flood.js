export const FLOOD_COUNT = 36;

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

function sizeFor(level) {
  if (level < 3) return 5;
  if (level < 8) return 6;
  if (level < 14) return 8;
  if (level < 22) return 10;
  if (level < 30) return 12;
  return 14;
}

export function cloneBoard(board) {
  return board.map((row) => row.slice());
}

export function flood(board, color) {
  const h = board.length;
  const w = board[0].length;
  const from = board[0][0];
  const next = cloneBoard(board);
  if (from === color) return next;
  const queue = [[0, 0]];
  next[0][0] = color;
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of NEI) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || next[ny][nx] !== from) continue;
      next[ny][nx] = color;
      queue.push([nx, ny]);
    }
  }
  return next;
}

export function isUniform(board) {
  const color = board[0][0];
  return board.every((row) => row.every((cell) => cell === color));
}

function regionSize(board) {
  const color = board[0][0];
  const h = board.length;
  const w = board[0].length;
  const seen = new Set(['0,0']);
  const queue = [[0, 0]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of NEI) {
      const nx = x + dx;
      const ny = y + dy;
      const id = `${nx},${ny}`;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(id) || board[ny][nx] !== color) continue;
      seen.add(id);
      queue.push([nx, ny]);
    }
  }
  return seen.size;
}

export function greedySolve(board) {
  let current = cloneBoard(board);
  const colors = Math.max(...current.flat()) + 1;
  const moves = [];
  const cap = current.length * current[0].length;
  while (!isUniform(current) && moves.length < cap) {
    const before = regionSize(current);
    let best = -1;
    let bestGain = 0;
    for (let color = 0; color < colors; color++) {
      if (color === current[0][0]) continue;
      const gain = regionSize(flood(current, color)) - before;
      if (gain > bestGain) {
        bestGain = gain;
        best = color;
      }
    }
    if (best < 0) break;
    moves.push(best);
    current = flood(current, best);
  }
  return moves;
}

export function generateFlood(level, seed = level + 99) {
  const rng = mulberry32((seed * 89 + 5) >>> 0);
  const size = sizeFor(level);
  const colors = level < 5 ? 3 : level < 14 ? 4 : level < 24 ? 5 : 6;
  const board = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => Math.floor(rng() * colors)),
  );
  if (isUniform(board)) board[size - 1][size - 1] = (board[0][0] + 1) % colors;
  const solution = greedySolve(board);
  const slack = level < 6 ? 4 : level < 16 ? 2 : level < 26 ? 1 : 0;
  return { size, colors, board, limit: solution.length + slack, solution };
}

export function applyMoves(board, moves) {
  return moves.reduce((current, color) => flood(current, color), board);
}

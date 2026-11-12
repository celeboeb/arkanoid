export const WATER_COUNT = 36;

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
export const WATER_CAP = 4;

export function isSolved(tubes, cap = WATER_CAP) {
  const seen = new Set();
  for (const tube of tubes) {
    if (!tube.length) continue;
    if (tube.length !== cap) return false;
    const color = tube[0];
    if (tube.some((item) => item !== color) || seen.has(color)) return false;
    seen.add(color);
  }
  return seen.size > 0;
}

export function pourAmount(tubes, from, to, cap = WATER_CAP) {
  if (from === to || from < 0 || to < 0 || from >= tubes.length || to >= tubes.length) return 0;
  const source = tubes[from];
  const dest = tubes[to];
  if (!source.length || dest.length >= cap) return 0;
  const color = source[source.length - 1];
  if (dest.length && dest[dest.length - 1] !== color) return 0;
  let run = 0;
  for (let i = source.length - 1; i >= 0 && source[i] === color; i--) run += 1;
  return Math.min(run, cap - dest.length);
}

export function pour(tubes, from, to, cap = WATER_CAP) {
  const amount = pourAmount(tubes, from, to, cap);
  if (!amount) return null;
  const next = tubes.map((tube) => tube.slice());
  const color = next[from][next[from].length - 1];
  for (let i = 0; i < amount; i++) {
    next[from].pop();
    next[to].push(color);
  }
  return next;
}

function topRun(tube) {
  if (!tube.length) return 0;
  const color = tube[tube.length - 1];
  let run = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) run += 1;
  return run;
}

function uniform(tube) {
  return tube.every((color) => color === tube[0]);
}

function scrambleOnce(tubes, rng, cap) {
  const order = tubes.map((_, index) => index).sort(() => rng() - 0.5);
  for (const from of order) {
    const run = topRun(tubes[from]);
    if (!run) continue;
    const color = tubes[from][tubes[from].length - 1];
    const maxK = uniform(tubes[from]) ? run : run - 1;
    if (maxK < 1) continue;
    const dests = tubes.map((_, index) => index).sort(() => rng() - 0.5);
    for (const to of dests) {
      if (to === from) continue;
      const space = cap - tubes[to].length;
      if (space < 1) continue;
      const top = tubes[to].length ? tubes[to][tubes[to].length - 1] : null;
      if (top === color) continue;
      let k = 1 + Math.floor(rng() * Math.min(maxK, space));
      if (uniform(tubes[from]) && tubes[from].length === cap && !tubes[to].length && k === cap) k = cap - 1;
      if (k < 1 || k > maxK) continue;
      for (let i = 0; i < k; i++) tubes[to].push(tubes[from].pop());
      return [to, from];
    }
  }
  return null;
}

export function generateWater(level, seed = level + 41) {
  const rng = mulberry32((seed * 53 + 9) >>> 0);
  const colors = level < 4 ? 3 : level < 10 ? 4 : level < 18 ? 5 : level < 26 ? 6 : 7;
  const empty = level < 14 ? 2 : 1;
  const cap = WATER_CAP;
  const tubes = [];
  for (let color = 0; color < colors; color++) tubes.push(Array.from({ length: cap }, () => color));
  for (let i = 0; i < empty; i++) tubes.push([]);
  const backward = [];
  const steps = 8 + level * 2;
  let guard = 0;
  while (backward.length < steps && guard < steps * 40) {
    guard += 1;
    const move = scrambleOnce(tubes, rng, cap);
    if (!move) break;
    backward.push(move);
  }
  let extra = 0;
  while (isSolved(tubes, cap) && extra < 12) {
    extra += 1;
    const move = scrambleOnce(tubes, rng, cap);
    if (!move) break;
    backward.push(move);
  }
  return {
    cap,
    tubes: tubes.map((tube) => tube.slice()),
    solution: backward.reverse(),
  };
}

export function replay(tubes, solution, cap = WATER_CAP) {
  let state = tubes.map((tube) => tube.slice());
  for (const [from, to] of solution) {
    const next = pour(state, from, to, cap);
    if (!next) return null;
    state = next;
  }
  return state;
}

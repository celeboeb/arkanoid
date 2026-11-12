const DIRS = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

export const DIR_NAMES = ['left', 'right', 'up', 'down'];

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

function key(x, y) {
  return `${x},${y}`;
}

export function parseLevel(rows, name = '') {
  const h = rows.length;
  const w = Math.max(...rows.map((row) => row.length));
  const walls = new Set();
  const goals = new Set();
  const boxes = [];
  let px = 1;
  let py = 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cell = rows[y][x] || '#';
      if (cell === '#') walls.add(key(x, y));
      if (cell === '.' || cell === '*' || cell === '+') goals.add(key(x, y));
      if (cell === '$' || cell === '*') boxes.push({ x, y });
      if (cell === '@' || cell === '+') {
        px = x;
        py = y;
      }
    }
  }
  return { name, w, h, walls, goals, boxes, px, py };
}

export function cloneLevel(level) {
  return {
    ...level,
    boxes: level.boxes.map((box) => ({ x: box.x, y: box.y })),
  };
}

function blocked(level, x, y) {
  return level.walls.has(key(x, y)) || level.boxes.some((box) => box.x === x && box.y === y);
}

export function tryMove(level, dir) {
  const step = DIRS[dir];
  if (!step) return null;
  const [dx, dy] = step;
  const nx = level.px + dx;
  const ny = level.py + dy;
  if (level.walls.has(key(nx, ny))) return null;
  const index = level.boxes.findIndex((box) => box.x === nx && box.y === ny);
  if (index >= 0) {
    const bx = nx + dx;
    const by = ny + dy;
    if (level.walls.has(key(bx, by)) || level.boxes.some((box) => box.x === bx && box.y === by)) return null;
    const boxes = level.boxes.map((box, i) => (i === index ? { x: bx, y: by } : box));
    return { ...level, px: nx, py: ny, boxes };
  }
  return { ...level, px: nx, py: ny };
}

export function isSolved(level) {
  return level.boxes.length > 0 && level.boxes.every((box) => level.goals.has(key(box.x, box.y)));
}

export function toRows(level) {
  const rows = [];
  for (let y = 0; y < level.h; y++) {
    let line = '';
    for (let x = 0; x < level.w; x++) {
      const here = key(x, y);
      const box = level.boxes.some((item) => item.x === x && item.y === y);
      const goal = level.goals.has(here);
      const player = level.px === x && level.py === y;
      if (level.walls.has(here)) line += '#';
      else if (player && goal) line += '+';
      else if (player) line += '@';
      else if (box && goal) line += '*';
      else if (box) line += '$';
      else if (goal) line += '.';
      else line += ' ';
    }
    rows.push(line);
  }
  return rows;
}

function pull(level, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = level.px + dx;
  const ny = level.py + dy;
  if (blocked(level, nx, ny)) return null;
  const ox = level.px - dx;
  const oy = level.py - dy;
  const index = level.boxes.findIndex((box) => box.x === ox && box.y === oy);
  if (index < 0) return null;
  const boxes = level.boxes.map((box, i) => (i === index ? { x: level.px, y: level.py } : box));
  return { ...level, px: nx, py: ny, boxes };
}

function walk(level, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = level.px + dx;
  const ny = level.py + dy;
  if (blocked(level, nx, ny)) return null;
  return { ...level, px: nx, py: ny };
}

function scramble(solved, pulls, seed) {
  const rng = mulberry32(seed);
  let state = cloneLevel(solved);
  let made = 0;
  let guard = 0;
  while (made < pulls && guard < pulls * 50) {
    guard += 1;
    const order = DIR_NAMES.slice().sort(() => rng() - 0.5);
    let next = null;
    if (rng() < 0.72) {
      for (const dir of order) {
        next = pull(state, dir);
        if (next) {
          made += 1;
          break;
        }
      }
    }
    if (!next) {
      for (const dir of order) {
        next = walk(state, dir);
        if (next) break;
      }
    }
    if (next) state = next;
  }
  return state;
}

const TEMPLATES = [
  { name: 'Первый шаг', pulls: 0, rows: ['#####', '#@$.#', '#####'] },
  { name: 'Налево', pulls: 0, rows: ['#####', '#.$@#', '#####'] },
  { name: 'Вниз', pulls: 0, rows: ['####', '#@ #', '#$ #', '#. #', '####'] },
  { name: 'Вверх', pulls: 0, rows: ['####', '#. #', '#$ #', '#@ #', '####'] },
  { name: 'Угол', pulls: 0, rows: ['#####', '#@  #', '# $ #', '#  .#', '#####'] },
  { name: 'Коридор', pulls: 0, rows: ['#######', '#@ $ .#', '#######'] },
  { name: 'Два ящика', pulls: 0, rows: ['######', '#@   #', '# $$ #', '# .. #', '######'] },
  { name: 'Обход', pulls: 0, rows: ['######', '#  . #', '# $  #', '#  @ #', '######'] },
  { name: 'Комната', pulls: 5, rows: ['#######', '#     #', '# * * #', '#  @  #', '#     #', '#######'] },
  { name: 'Полка', pulls: 6, rows: ['########', '#      #', '# *  * #', '#  @   #', '#      #', '########'] },
  { name: 'Ниша', pulls: 7, rows: ['#######', '#     #', '# *#  #', '#  #* #', '#  @  #', '#######'] },
  { name: 'Колонна', pulls: 8, rows: ['#######', '#     #', '# *   #', '#  #  #', '#   * #', '#  @  #', '#######'] },
  { name: 'Двор', pulls: 8, rows: ['########', '#      #', '# *    #', '#   @  #', '#    * #', '#      #', '########'] },
  { name: 'Карман', pulls: 9, rows: ['######', '#    #', '# *  #', '# #  #', '# *@ #', '#    #', '######'] },
  { name: 'Лестница', pulls: 9, rows: ['########', '#      #', '# *    #', '#  #   #', '#   *  #', '#     @#', '########'] },
  { name: 'Два шага', pulls: 6, rows: ['######', '#    #', '# ** #', '# @  #', '#    #', '######'] },
  { name: 'Шире', pulls: 10, rows: ['#########', '#       #', '# *   * #', '#   @   #', '#       #', '#########'] },
  { name: 'Уступ', pulls: 10, rows: ['########', '#      #', '##*    #', '#   *  #', '#  @   #', '#      #', '########'] },
  { name: 'Три метки', pulls: 12, rows: ['#########', '#       #', '# * * * #', '#   @   #', '#       #', '#########'] },
  { name: 'Коридорчик', pulls: 8, rows: ['##########', '#        #', '# *  @ * #', '#        #', '##########'] },
  { name: 'Узкий двор', pulls: 11, rows: ['#######', '#     #', '# *   #', '# # # #', '#  *  #', '#  @  #', '#######'] },
  { name: 'Поворот', pulls: 11, rows: ['########', '#      #', '# **   #', '#   #  #', '#    @ #', '########'] },
  { name: 'Кладовая', pulls: 12, rows: ['#########', '#       #', '# * # * #', '#   @   #', '#   *   #', '#       #', '#########'] },
  { name: 'Балкон', pulls: 9, rows: ['########', '#      #', '# *@*  #', '#      #', '#      #', '########'] },
  { name: 'Рамка', pulls: 13, rows: ['#########', '#       #', '# *   * #', '#   #   #', '#   @   #', '#       #', '#########'] },
  { name: 'Длинный', pulls: 10, rows: ['############', '#          #', '# * @    * #', '#          #', '############'] },
  { name: 'Две полки', pulls: 14, rows: ['##########', '#        #', '# *    * #', '#   ##   #', '# * @    #', '#        #', '##########'] },
  { name: 'Тихий угол', pulls: 12, rows: ['########', '#      #', '# *    #', '#  ##  #', '#   *@ #', '#      #', '########'] },
  { name: 'Зал', pulls: 15, rows: ['##########', '#        #', '# *    * #', '#    @   #', '#   *    #', '#        #', '##########'] },
  { name: 'Лабиринт', pulls: 14, rows: ['#########', '#       #', '# * #   #', '#   # * #', '# @     #', '#   *   #', '#########'] },
  { name: 'Склад', pulls: 16, rows: ['##########', '#        #', '# *  *   #', '#   ##   #', '# @   *  #', '#        #', '##########'] },
  { name: 'Финал', pulls: 18, rows: ['###########', '#         #', '# *  *  * #', '#    #    #', '#    @    #', '#         #', '###########'] },
];

function build(template, index) {
  if (!template.pulls) return { name: template.name, rows: template.rows.map((row) => row.padEnd(template.rows[0].length, '#')) };
  const solved = parseLevel(template.rows, template.name);
  let state = scramble(solved, template.pulls, 9000 + index * 97);
  let extra = 0;
  let seed = 12000 + index * 19;
  while (isSolved(state) && extra < 8) {
    extra += 1;
    state = scramble(solved, template.pulls + extra * 3, seed);
    seed += 29;
  }
  return { name: template.name, rows: toRows(state) };
}

export const LEVELS = TEMPLATES.map((template, index) => build(template, index));

export function loadLevel(index) {
  const level = LEVELS[index];
  const parsed = parseLevel(level.rows, level.name);
  return parsed;
}

export function stateKey(level) {
  const boxes = level.boxes
    .map((box) => key(box.x, box.y))
    .sort()
    .join(';');
  return `${level.px},${level.py}|${boxes}`;
}

function cornerDeadlock(level) {
  for (const box of level.boxes) {
    if (level.goals.has(key(box.x, box.y))) continue;
    const left = level.walls.has(key(box.x - 1, box.y));
    const right = level.walls.has(key(box.x + 1, box.y));
    const up = level.walls.has(key(box.x, box.y - 1));
    const down = level.walls.has(key(box.x, box.y + 1));
    if ((left || right) && (up || down)) return true;
  }
  return false;
}

export function solve(level, limit = 250000) {
  const start = cloneLevel(level);
  if (isSolved(start)) return [];
  const queue = [start];
  const prev = new Map([[stateKey(start), null]]);
  let nodes = 0;
  while (queue.length) {
    const state = queue.shift();
    nodes += 1;
    if (nodes > limit) return null;
    const from = stateKey(state);
    for (const dir of DIR_NAMES) {
      const next = tryMove(state, dir);
      if (!next || cornerDeadlock(next)) continue;
      const id = stateKey(next);
      if (prev.has(id)) continue;
      prev.set(id, { from, dir });
      if (isSolved(next)) {
        const path = [dir];
        let cursor = from;
        while (prev.get(cursor)) {
          path.push(prev.get(cursor).dir);
          cursor = prev.get(cursor).from;
        }
        path.reverse();
        return path;
      }
      queue.push(next);
    }
  }
  return null;
}

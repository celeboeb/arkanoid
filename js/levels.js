export const COLS = 11;

const SPEC = {
  1: { kind: 'normal', hp: 1, color: 0, points: 70 },
  2: { kind: 'normal', hp: 1, color: 1, points: 80 },
  3: { kind: 'normal', hp: 1, color: 2, points: 90 },
  4: { kind: 'normal', hp: 1, color: 3, points: 100 },
  5: { kind: 'normal', hp: 1, color: 4, points: 110 },
  6: { kind: 'normal', hp: 1, color: 5, points: 120 },
  7: { kind: 'normal', hp: 1, color: 6, points: 130 },
  a: { kind: 'multi', hp: 2, color: 7, points: 100 },
  b: { kind: 'multi', hp: 3, color: 8, points: 140 },
  '#': { kind: 'metal', hp: Infinity, color: 9, points: 0 },
  '*': { kind: 'explosive', hp: 1, color: 10, points: 180 },
};

function rows(name, hint, grid) {
  return { name, hint, rows: grid };
}

export const LEVELS = [
  rows('Рассвет', 'Ровные полосы — разомнитесь', [
    '11111111111',
    '22222222222',
    '33333333333',
    '44444444444',
    '55555555555',
    '66666666666',
  ]),
  rows('Пирамида', 'Соберите основание и вершину', [
    '.....7.....',
    '....666....',
    '...55555...',
    '..4444444..',
    '.333333333.',
    '22222222222',
    '11111111111',
    '..aaa.aaa..',
  ]),
  rows('Шахматы', 'Клетки можно проскочить', [
    '1.1.1.1.1.1',
    '.2.2.2.2.2.',
    '3.3.3.3.3.3',
    '.4.4.4.4.4.',
    '5.5.5.5.5.5',
    '.6.6.6.6.6.',
    '7.7.7.7.7.7',
    '.a.a.a.a.a.',
  ]),
  rows('Крепость', 'Металл не берётся — ищите вход', [
    '###########',
    '#111111111#',
    '#1.......1#',
    '#1.a*a*a.1#',
    '#1.......1#',
    '#111111111#',
    '##.......##',
  ]),
  rows('Колонны', 'Металлические стойки держат ряды', [
    '1#2#3#4#5#6',
    '1#2#3#4#5#6',
    '1#2#3#4#5#6',
    '1#2#3#4#5#6',
    '7.7.7.7.7.7',
    'aaaaaaaaaaa',
  ]),
  rows('Лестница', 'Ступени уводят мяч в сторону', [
    '11111......',
    '.22222.....',
    '..33333....',
    '...44444...',
    '....55555..',
    '.....66666.',
    '......77777',
    'aa.......aa',
  ]),
  rows('Кольцо', 'Пробейте брешь и зачистите центр', [
    '.111111111.',
    '11.......11',
    '1.3333333.1',
    '1.3.....3.1',
    '1.3.a*a.3.1',
    '1.3.....3.1',
    '1.333.333.1',
    '11.......11',
    '.11.....11.',
  ]),
  rows('Ромб', 'Симметрия. Берегите угол', [
    '.....7.....',
    '....666....',
    '...55.55...',
    '..44...44..',
    '.33.....33.',
    '..44...44..',
    '...55*55...',
    '....666....',
    '.....1.....',
  ]),
  rows('Улыбка', 'Сначала глаза, потом улыбка', [
    '.7.......7.',
    '..6.....6..',
    '...5...5...',
    '...........',
    '..1.....1..',
    '.2222.2222.',
    '..3333333..',
    '...aaaaa...',
  ]),
  rows('Туннели', 'Три коридора между плитами', [
    '111#111#111',
    '...........',
    '222#222#222',
    '...........',
    '333#333#333',
    '...........',
    '44*44*44*44',
  ]),
  rows('Мины', 'Взрыв задевает соседей', [
    '1*1.1*1.1*1',
    '.2.2.2.2.2.',
    '3.3*3.3*3.3',
    '.4.4.4.4.4.',
    '5*5.5*5.5*5',
    '.a.a.a.a.a.',
    'b.b.b.b.b.b',
  ]),
  rows('Сердце', 'Не разбейте его слишком быстро', [
    '.11.....11.',
    '1222...2221',
    '12333333321',
    '.1233*33321',
    '..1233321..',
    '...12a21...',
    '....121....',
    '.....1.....',
  ]),
  rows('Зигзаг', 'Мяч гуляет по диагонали', [
    '11111......',
    '....22222..',
    '..33333....',
    '......44444',
    '55555......',
    '....aaaaa..',
    '..b*b.b*b..',
    '66.......77',
  ]),
  rows('Финал', 'Камера с минами за металлическим козырьком', [
    '#1#2#3#4#5#',
    '16666666661',
    '16a6a6a6a61',
    '12#######21',
    '12#b*b*b#21',
    '12#.....#21',
    '12.......21',
    '1111...1111',
    '..a.a.a.a..',
  ]),
];

export function validateLevelDefs() {
  const errors = [];
  if (LEVELS.length < 12) errors.push('need at least 12 levels');
  const names = new Set();
  for (const level of LEVELS) {
    if (names.has(level.name)) errors.push(`duplicate ${level.name}`);
    names.add(level.name);
    if (!level.rows.length) errors.push(`${level.name} empty`);
    level.rows.forEach((row, i) => {
      if (row.length !== COLS) errors.push(`${level.name} row ${i} length ${row.length}`);
      for (const ch of row) {
        if (ch !== '.' && !SPEC[ch]) errors.push(`${level.name} bad "${ch}"`);
      }
    });
    const chars = level.rows.join('');
    if (![...chars].some((ch) => ch !== '.' && ch !== '#')) {
      errors.push(`${level.name} has no destructible bricks`);
    }
  }
  return errors;
}

export function createBricks(level, fieldW = 360) {
  const gap = 3;
  const margin = 10;
  const bw = (fieldW - margin * 2 - gap * (COLS - 1)) / COLS;
  const bh = 16;
  const vgap = 3;
  const top = 56;
  const bricks = [];
  let id = 0;
  level.rows.forEach((row, r) => {
    for (let c = 0; c < COLS; c++) {
      const ch = row[c];
      if (ch === '.' || ch === ' ') continue;
      const spec = SPEC[ch];
      bricks.push({
        x: margin + c * (bw + gap),
        y: top + r * (bh + vgap),
        w: bw,
        h: bh,
        alive: true,
        kind: spec.kind,
        hp: spec.hp,
        maxHp: spec.hp,
        color: spec.color,
        points: spec.points,
        row: r,
        col: c,
        id: id++,
        flash: 0,
      });
    }
  });
  return bricks;
}

export const BRICK_SPEC = SPEC;

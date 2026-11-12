import { createHistory } from '../puzzles/history.js?v=2.1.0';
import { LEVELS, cloneLevel, isSolved, loadLevel, tryMove } from '../puzzles/sokoban.js?v=2.1.0';

const DIRS = [
  ['left', -1, 0],
  ['right', 1, 0],
  ['up', 0, -1],
  ['down', 0, 1],
];

function capture(level) {
  return {
    px: level.px,
    py: level.py,
    boxes: level.boxes.map((box) => ({ x: box.x, y: box.y })),
  };
}

function restore(level, data) {
  level.px = data.px;
  level.py = data.py;
  level.boxes = data.boxes.map((box) => ({ x: box.x, y: box.y }));
}

export const sokobanGame = {
  id: 'sokoban',
  title: 'Сокобан',
  blurb: 'Свайп или нажатие в сторону. Кнопки и стрелки тоже подходят.',
  count: LEVELS.length,
  win: 'Все ящики на местах',
  mount(stage, ctx) {
    const level = cloneLevel(loadLevel(ctx.level));
    const initial = capture(level);
    const history = createHistory();
    let pushes = 0;
    if (ctx.snapshot && ctx.snapshot.boxes && ctx.snapshot.boxes.length === level.boxes.length) {
      restore(level, ctx.snapshot);
      history.load(ctx.snapshot.history);
      pushes = ctx.snapshot.pushes | 0;
    }

    const board = document.createElement('div');
    board.className = 'soko-board';
    board.style.setProperty('--w', String(level.w));
    board.style.setProperty('--h', String(level.h));
    for (let y = 0; y < level.h; y++) {
      for (let x = 0; x < level.w; x++) {
        const cell = document.createElement('i');
        const id = `${x},${y}`;
        cell.className = level.walls.has(id) ? 'wall' : 'floor';
        if (level.goals.has(id)) cell.classList.add('goal');
        board.append(cell);
      }
    }
    const player = document.createElement('i');
    player.className = 'actor player';
    player.innerHTML = '<span></span>';
    const boxes = level.boxes.map(() => {
      const box = document.createElement('i');
      box.className = 'actor box';
      box.innerHTML = '<span></span>';
      return box;
    });
    board.append(player, ...boxes);

    let origin = null;
    board.addEventListener('pointerdown', (event) => {
      if (event.button != null && event.button !== 0) return;
      origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    board.addEventListener('pointerup', (event) => {
      if (!origin || origin.id !== event.pointerId) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      origin = null;
      if (Math.hypot(dx, dy) >= 22) {
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        return;
      }
      const rect = board.getBoundingClientRect();
      const fromX = rect.left + ((level.px + 0.5) * rect.width) / level.w;
      const fromY = rect.top + ((level.py + 0.5) * rect.height) / level.h;
      const tx = event.clientX - fromX;
      const ty = event.clientY - fromY;
      if (Math.hypot(tx, ty) < 10) return;
      move(Math.abs(tx) > Math.abs(ty) ? (tx > 0 ? 'right' : 'left') : (ty > 0 ? 'down' : 'up'));
    });

    const pad = document.createElement('div');
    pad.className = 'pad';
    for (const [dir, label, name] of [
      ['up', '↑', 'Вверх'],
      ['left', '←', 'Влево'],
      ['down', '↓', 'Вниз'],
      ['right', '→', 'Вправо'],
    ]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.setAttribute('aria-label', name);
      button.addEventListener('click', () => move(dir));
      pad.append(button);
    }
    const wrap = document.createElement('div');
    wrap.className = 'soko-layout';
    wrap.append(board, pad);
    stage.replaceChildren(wrap);

    function place(el, x, y) {
      const gap = 8;
      const width = board.clientWidth || board.getBoundingClientRect().width;
      const height = board.clientHeight || board.getBoundingClientRect().height;
      const cellW = (width - (level.w - 1) * gap) / level.w;
      const cellH = (height - (level.h - 1) * gap) / level.h;
      el.style.left = `${x * (cellW + gap)}px`;
      el.style.top = `${y * (cellH + gap)}px`;
      el.style.width = `${cellW}px`;
      el.style.height = `${cellH}px`;
    }

    function persist() {
      ctx.save({ ...capture(level), pushes, history: history.dump() });
    }

    function move(dir) {
      const before = capture(level);
      const step = DIRS.find((item) => item[0] === dir);
      const pushed = level.boxes.some((box) => box.x === level.px + step[1] && box.y === level.py + step[2]);
      const next = tryMove(level, dir);
      if (!next) return;
      history.checkpoint({ ...before, pushes });
      restore(level, next);
      if (pushed) pushes += 1;
      ctx.sound(pushed ? 'push' : 'tap');
      if (pushed) ctx.buzz(8);
      persist();
      paint();
    }

    function paint() {
      place(player, level.px, level.py);
      level.boxes.forEach((box, index) => {
        place(boxes[index], box.x, box.y);
        boxes[index].classList.toggle('on', level.goals.has(`${box.x},${box.y}`));
      });
      const solved = isSolved(level);
      ctx.status(solved ? 'Склад собран' : `Толчки: ${pushes}`);
      ctx.changed();
      ctx.solved(solved);
    }

    function onKey(event) {
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      const dir = map[event.code];
      if (!dir) return;
      event.preventDefault();
      move(dir);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', paint);
    paint();
    requestAnimationFrame(() => {
      paint();
      requestAnimationFrame(() => board.classList.add('ready'));
    });

    return {
      canUndo: () => history.canUndo,
      undo() {
        const prev = history.undo();
        if (!prev) return;
        restore(level, prev);
        pushes = prev.pushes | 0;
        ctx.sound('undo');
        persist();
        paint();
      },
      restart() {
        history.clear();
        restore(level, initial);
        pushes = 0;
        ctx.sound('undo');
        persist();
        paint();
      },
      destroy() {
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', paint);
        stage.replaceChildren();
      },
    };
  },
};

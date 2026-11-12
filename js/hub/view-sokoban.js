import { createHistory } from '../puzzles/history.js?v=2.0.0';
import { LEVELS, cloneLevel, isSolved, loadLevel, tryMove } from '../puzzles/sokoban.js?v=2.0.0';

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
  blurb: 'Толкайте ящики на отметки. Свайп, стрелки или кнопки.',
  count: LEVELS.length,
  win: 'Все ящики на местах',
  mount(stage, ctx) {
    const level = cloneLevel(loadLevel(ctx.level));
    const initial = capture(level);
    const history = createHistory();
    let pushes = 0;
    if (
      ctx.snapshot &&
      ctx.snapshot.boxes &&
      ctx.snapshot.boxes.length === level.boxes.length
    ) {
      restore(level, ctx.snapshot);
      history.load(ctx.snapshot.history);
      pushes = ctx.snapshot.pushes | 0;
    }

    function persist() {
      ctx.save({ ...capture(level), pushes, history: history.dump() });
    }

    function move(dir) {
      const before = capture(level);
      const pushed = level.boxes.some((box) => {
        const step = DIRS.find((item) => item[0] === dir);
        return box.x === level.px + step[1] && box.y === level.py + step[2];
      });
      const next = tryMove(level, dir);
      if (!next) return;
      history.checkpoint({ ...before, pushes });
      restore(level, next);
      if (pushed) pushes += 1;
      ctx.sound(pushed ? 'push' : 'tap');
      if (pushed) ctx.buzz(8);
      persist();
      draw();
    }

    function draw() {
      stage.replaceChildren();
      const board = document.createElement('div');
      board.className = 'soko-board';
      board.style.setProperty('--w', String(level.w));
      board.style.setProperty('--h', String(level.h));
      const boxes = new Set(level.boxes.map((box) => `${box.x},${box.y}`));
      for (let y = 0; y < level.h; y++) {
        for (let x = 0; x < level.w; x++) {
          const cell = document.createElement('i');
          const id = `${x},${y}`;
          const goal = level.goals.has(id);
          const box = boxes.has(id);
          const player = level.px === x && level.py === y;
          if (level.walls.has(id)) cell.className = 'wall';
          else cell.className = 'floor';
          if (goal) cell.classList.add('goal');
          if (box) cell.classList.add('box');
          if (player) cell.classList.add('player');
          board.append(cell);
        }
      }
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
        if (Math.hypot(dx, dy) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
        else move(dy > 0 ? 'down' : 'up');
      });
      const pad = document.createElement('div');
      pad.className = 'pad';
      for (const [dir, label] of [
        ['up', '↑'],
        ['left', '←'],
        ['down', '↓'],
        ['right', '→'],
      ]) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-label', dir === 'up' ? 'Вверх' : dir === 'down' ? 'Вниз' : dir === 'left' ? 'Влево' : 'Вправо');
        button.addEventListener('click', () => move(dir));
        pad.append(button);
      }
      const wrap = document.createElement('div');
      wrap.className = 'soko-layout';
      wrap.append(board, pad);
      stage.append(wrap);
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

    draw();
    return {
      canUndo: () => history.canUndo,
      undo() {
        const prev = history.undo();
        if (!prev) return;
        restore(level, prev);
        pushes = prev.pushes | 0;
        ctx.sound('undo');
        persist();
        draw();
      },
      restart() {
        history.clear();
        restore(level, initial);
        pushes = 0;
        ctx.sound('undo');
        persist();
        draw();
      },
      destroy() {
        window.removeEventListener('keydown', onKey);
        stage.replaceChildren();
      },
    };
  },
};

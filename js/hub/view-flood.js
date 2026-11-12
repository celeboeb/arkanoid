import { createHistory } from '../puzzles/history.js?v=2.0.0';
import { FLOOD_COUNT, cloneBoard, flood, generateFlood, isUniform } from '../puzzles/flood.js?v=2.0.0';

const PAINT = ['#e07a7a', '#e0b15c', '#7fbf8a', '#6eb0d4', '#8d87d1', '#d58ab4'];

function copy(board) {
  return cloneBoard(board);
}

export const floodGame = {
  id: 'flood',
  title: 'Перекрась',
  blurb: 'Закрасьте поле одним цветом из левого верхнего угла. Ходы ограничены, времени нет.',
  count: FLOOD_COUNT,
  win: 'Поле одного цвета',
  mount(stage, ctx) {
    const puzzle = generateFlood(ctx.level);
    let board = copy(puzzle.board);
    let used = 0;
    const history = createHistory();
    if (ctx.snapshot && Array.isArray(ctx.snapshot.board) && ctx.snapshot.board.length === puzzle.size) {
      board = copy(ctx.snapshot.board);
      used = ctx.snapshot.used | 0;
      history.load(ctx.snapshot.history);
    }

    function persist() {
      ctx.save({ board: copy(board), used, history: history.dump() });
    }

    function draw() {
      stage.replaceChildren();
      const wrap = document.createElement('div');
      wrap.className = 'flood-layout';
      const grid = document.createElement('div');
      grid.className = 'flood-board';
      grid.style.setProperty('--n', String(puzzle.size));
      for (let y = 0; y < puzzle.size; y++) {
        for (let x = 0; x < puzzle.size; x++) {
          const cell = document.createElement('i');
          cell.style.background = PAINT[board[y][x] % PAINT.length];
          if (x === 0 && y === 0) cell.className = 'origin';
          grid.append(cell);
        }
      }
      const palette = document.createElement('div');
      palette.className = 'palette';
      for (let color = 0; color < puzzle.colors; color++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.style.background = PAINT[color];
        button.setAttribute('aria-label', `Цвет ${color + 1}`);
        button.disabled = color === board[0][0];
        button.addEventListener('click', () => paint(color));
        palette.append(button);
      }
      wrap.append(grid, palette);
      stage.append(wrap);
      const solved = isUniform(board);
      const left = Math.max(0, puzzle.limit - used);
      if (solved) ctx.status('Поле закрашено');
      else if (left === 0) ctx.status('Ходы кончились. Отмените ход или начните заново');
      else ctx.status(`Осталось ходов: ${left}`);
      ctx.changed();
      ctx.solved(solved);
    }

    function paint(color) {
      if (isUniform(board) || color === board[0][0] || used >= puzzle.limit) {
        if (used >= puzzle.limit && !isUniform(board)) ctx.sound('soft');
        return;
      }
      history.checkpoint({ board: copy(board), used });
      board = flood(board, color);
      used += 1;
      ctx.sound('tap');
      ctx.buzz(8);
      persist();
      draw();
      if (!isUniform(board) && used >= puzzle.limit) ctx.sound('soft');
    }

    draw();
    return {
      canUndo: () => history.canUndo,
      undo() {
        const prev = history.undo();
        if (!prev) return;
        board = copy(prev.board);
        used = prev.used | 0;
        ctx.sound('undo');
        persist();
        draw();
      },
      restart() {
        history.clear();
        board = copy(puzzle.board);
        used = 0;
        ctx.sound('undo');
        persist();
        draw();
      },
      destroy() {
        stage.replaceChildren();
      },
    };
  },
};

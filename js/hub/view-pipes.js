import { createHistory } from '../puzzles/history.js?v=2.1.0';
import { PIPES_COUNT, flow, generatePipes, isSolved, maskOf } from '../puzzles/pipes.js?v=2.1.0';

const ARMS = [
  [1, 'M32 32 V6'],
  [2, 'M32 32 H58'],
  [4, 'M32 32 V58'],
  [8, 'M32 32 H6'],
];

function bodySvg(base, role) {
  const arms = ARMS.filter(([bit]) => base & bit)
    .map(([, d]) => `<path d="${d}" />`)
    .join('');
  const mark =
    role === 'source'
      ? '<circle class="mark" cx="32" cy="32" r="7" />'
      : role === 'sink'
        ? '<circle class="mark ring" cx="32" cy="32" r="8" />'
        : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${arms}${mark}</svg>`;
}

function waterSvg(mask) {
  const arms = ARMS.filter(([bit]) => mask & bit)
    .map(([, d]) => `<path d="${d}" />`)
    .join('');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${arms}<circle cx="32" cy="32" r="4" /></svg>`;
}

export const pipesGame = {
  id: 'pipes',
  title: 'Трубы',
  blurb: 'Нажмите плитку — она повернётся. Вода дойдёт до стоков сама.',
  count: PIPES_COUNT,
  win: 'Вода дошла',
  mount(stage, ctx) {
    const level = generatePipes(ctx.level);
    const initial = level.cells.map((cell) => cell.rot);
    let rots = initial.slice();
    const history = createHistory();
    if (ctx.snapshot && Array.isArray(ctx.snapshot.rots) && ctx.snapshot.rots.length === initial.length) {
      rots = ctx.snapshot.rots.slice();
      history.load(ctx.snapshot.history);
    }

    const board = document.createElement('div');
    board.className = 'pipe-board';
    board.style.setProperty('--n', String(level.n));
    const buttons = level.cells.map((cell, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `pipe-tile${cell.role === 'source' ? ' is-source' : ''}${cell.role === 'sink' ? ' is-sink' : ''}`;
      const body = document.createElement('span');
      body.className = 'pipe-body';
      body.innerHTML = bodySvg(cell.base, cell.role);
      button.append(body);
      button.disabled = cell.role === 'source';
      button.setAttribute('aria-label', cell.role === 'source' ? 'Источник' : cell.role === 'sink' ? 'Сток' : 'Труба');
      button.addEventListener('click', () => {
        if (cell.role === 'source') return;
        history.checkpoint(rots.slice());
        rots[index] = (rots[index] + 1) % 4;
        ctx.sound('rotate');
        ctx.buzz(8);
        persist();
        paint();
      });
      return button;
    });
    board.append(...buttons);
    const table = document.createElement('div');
    table.className = 'table';
    table.append(board);
    stage.replaceChildren(table);

    function model() {
      return { n: level.n, cells: level.cells.map((cell, i) => ({ ...cell, rot: rots[i] })) };
    }

    function persist() {
      ctx.save({ rots: rots.slice(), history: history.dump() });
    }

    function paint() {
      const current = model();
      const solved = isSolved(current);
      const { dist } = flow(current);
      current.cells.forEach((cell, index) => {
        const button = buttons[index];
        button.querySelector('.pipe-body').style.transform = `rotate(${cell.rot * 90}deg)`;
        button.classList.toggle('wet', solved && dist[index] >= 0);
        if (solved && dist[index] >= 0) button.style.setProperty('--d', String(dist[index]));
        let water = button.querySelector('.pipe-water');
        if (solved && dist[index] >= 0) {
          if (!water) {
            water = document.createElement('span');
            water.className = 'pipe-water';
            button.append(water);
          }
          water.innerHTML = waterSvg(maskOf(cell));
        } else if (water) water.remove();
      });
      ctx.status(solved ? 'Все стоки соединены' : 'Поворачивайте плитки');
      ctx.changed();
      ctx.solved(solved);
    }

    paint();
    return {
      canUndo: () => history.canUndo,
      undo() {
        const prev = history.undo();
        if (!prev) return;
        rots = prev;
        ctx.sound('undo');
        persist();
        paint();
      },
      restart() {
        history.clear();
        rots = initial.slice();
        ctx.sound('undo');
        persist();
        paint();
      },
      destroy() {
        stage.replaceChildren();
      },
    };
  },
};

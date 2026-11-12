import { canPlace, generateBlocks, isFilled, pieceCells, rotateCells, BLOCKS_COUNT } from '../puzzles/blocks.js?v=2.1.0';
import { createHistory } from '../puzzles/history.js?v=2.1.0';

const COLORS = ['#e3a3a0', '#e3c48a', '#b7d3a8', '#93c9c6', '#a9c0e4', '#c6b4e2', '#e3b4cc', '#d2c2a4'];

function dump(pieces) {
  return pieces.map((piece) => ({
    id: piece.id,
    rot: piece.rot,
    placed: piece.placed,
    x: piece.x,
    y: piece.y,
  }));
}

function cellsHtml(cells, color) {
  const maxX = Math.max(...cells.map((cell) => cell[0]));
  const maxY = Math.max(...cells.map((cell) => cell[1]));
  const on = new Set(cells.map(([x, y]) => `${x},${y}`));
  let html = '';
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      html += `<i${on.has(`${x},${y}`) ? ` style="background:${color}"` : ''}></i>`;
    }
  }
  return { html, cols: maxX + 1 };
}

export const blocksGame = {
  id: 'blocks',
  title: 'Блоки',
  blurb: 'Перетащите фигуры. Короткое нажатие поворачивает.',
  count: BLOCKS_COUNT,
  win: 'Поле собрано',
  mount(stage, ctx) {
    const level = generateBlocks(ctx.level);
    const pieces = level.pieces.map((piece) => ({ ...piece, cells: piece.cells.map((cell) => cell.slice()) }));
    const fresh = dump(pieces);
    const history = createHistory();
    if (ctx.snapshot && Array.isArray(ctx.snapshot.pieces) && ctx.snapshot.pieces.length === pieces.length) {
      for (const item of ctx.snapshot.pieces) {
        const piece = pieces.find((entry) => entry.id === item.id);
        if (!piece) continue;
        piece.rot = item.rot % 4;
        piece.placed = Boolean(item.placed);
        piece.x = item.x | 0;
        piece.y = item.y | 0;
      }
      history.load(ctx.snapshot.history);
    }

    function persist() {
      ctx.save({ pieces: dump(pieces), history: history.dump() });
    }

    function apply(data) {
      for (const item of data) {
        const piece = pieces.find((entry) => entry.id === item.id);
        if (!piece) continue;
        piece.rot = item.rot;
        piece.placed = item.placed;
        piece.x = item.x;
        piece.y = item.y;
      }
    }

    let boardEl = null;
    let snap = false;

    function draw() {
      stage.replaceChildren();
      const wrap = document.createElement('div');
      wrap.className = 'block-layout';
      const board = document.createElement('div');
      board.className = snap ? 'block-board pop' : 'block-board';
      board.style.setProperty('--w', String(level.w));
      board.style.setProperty('--h', String(level.h));
      const paint = new Map();
      for (const piece of pieces) {
        if (!piece.placed) continue;
        const color = COLORS[piece.id % COLORS.length];
        for (const [x, y] of pieceCells(piece)) paint.set(`${x},${y}`, color);
      }
      for (let y = 0; y < level.h; y++) {
        for (let x = 0; x < level.w; x++) {
          const cell = document.createElement('i');
          cell.className = level.mask[y][x] ? 'on' : 'hole';
          const color = paint.get(`${x},${y}`);
          if (color) cell.style.background = color;
          board.append(cell);
        }
      }
      const tray = document.createElement('div');
      tray.className = 'tray';
      for (const piece of pieces) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `piece${piece.placed ? ' placed' : ''}`;
        const shape = rotateCells(piece.cells, piece.rot);
        const drawn = cellsHtml(shape, COLORS[piece.id % COLORS.length]);
        button.style.setProperty('--c', String(drawn.cols));
        button.innerHTML = drawn.html;
        button.setAttribute('aria-label', piece.placed ? 'Фигура на поле' : 'Фигура');
        bindPiece(button, piece);
        tray.append(button);
      }
      wrap.append(board, tray);
      stage.append(wrap);
      boardEl = board;
      const filled = isFilled(level, pieces);
      ctx.status(filled ? 'Фигуры легли без пробелов' : 'Заполните силуэт целиком');
      ctx.changed();
      ctx.solved(filled);
      snap = false;
    }

    function bindPiece(button, piece) {
      button.addEventListener('pointerdown', (event) => {
        if (event.button != null && event.button !== 0) return;
        event.preventDefault();
        const pointer = event.pointerId;
        const startX = event.clientX;
        const startY = event.clientY;
        const origin = { placed: piece.placed, x: piece.x, y: piece.y, rot: piece.rot };
        let dragging = false;
        let ghost = null;
        try {
          button.setPointerCapture(pointer);
        } catch {
          /* pointer already gone */
        }

        function anchorOf() {
          const cells = rotateCells(piece.cells, piece.rot);
          return {
            x: Math.round(Math.max(...cells.map((cell) => cell[0])) / 2),
            y: Math.round(Math.max(...cells.map((cell) => cell[1])) / 2),
          };
        }

        function move(ev) {
          if (ev.pointerId !== pointer) return;
          if (!dragging && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) {
            dragging = true;
            button.classList.add('lifting');
            ghost = document.createElement('div');
            ghost.className = 'piece-ghost';
            const shape = rotateCells(piece.cells, piece.rot);
            const drawn = cellsHtml(shape, COLORS[piece.id % COLORS.length]);
            ghost.style.setProperty('--c', String(drawn.cols));
            ghost.innerHTML = drawn.html;
            document.body.append(ghost);
          }
          if (ghost) {
            ghost.style.left = `${ev.clientX}px`;
            ghost.style.top = `${ev.clientY}px`;
          }
        }

        function finish(ev) {
          if (ev.pointerId !== pointer) return;
          button.removeEventListener('pointermove', move);
          button.removeEventListener('pointerup', finish);
          button.removeEventListener('pointercancel', finish);
          if (ghost) ghost.remove();
          if (!dragging) {
            const next = (piece.rot + 1) % 4;
            history.checkpoint(dump(pieces));
            if (origin.placed && canPlace(level, pieces, piece, origin.x, origin.y, next)) {
              piece.rot = next;
              piece.placed = true;
              piece.x = origin.x;
              piece.y = origin.y;
            } else {
              piece.rot = next;
              piece.placed = false;
            }
            ctx.sound('rotate');
            ctx.buzz(8);
            persist();
            draw();
            return;
          }
          const rect = boardEl.getBoundingClientRect();
          const over =
            ev.clientX >= rect.left && ev.clientX <= rect.right && ev.clientY >= rect.top && ev.clientY <= rect.bottom;
          const anchor = anchorOf();
          if (over && rect.width > 0) {
            const col = Math.floor(((ev.clientX - rect.left) / rect.width) * level.w) - anchor.x;
            const row = Math.floor(((ev.clientY - rect.top) / rect.height) * level.h) - anchor.y;
            if (canPlace(level, pieces, piece, col, row, piece.rot)) {
              history.checkpoint(dump(pieces));
              piece.placed = true;
              piece.x = col;
              piece.y = row;
              snap = true;
              ctx.sound('place');
              ctx.buzz(10);
              persist();
              draw();
              return;
            }
          } else if (origin.placed) {
            history.checkpoint(dump(pieces));
            piece.placed = false;
            ctx.sound('undo');
            persist();
            draw();
            return;
          }
          piece.placed = origin.placed;
          piece.x = origin.x;
          piece.y = origin.y;
          draw();
        }

        button.addEventListener('pointermove', move);
        button.addEventListener('pointerup', finish);
        button.addEventListener('pointercancel', finish);
      });
    }

    draw();
    return {
      canUndo: () => history.canUndo,
      undo() {
        const prev = history.undo();
        if (!prev) return;
        apply(prev);
        ctx.sound('undo');
        persist();
        draw();
      },
      restart() {
        history.clear();
        apply(fresh);
        ctx.sound('undo');
        persist();
        draw();
      },
      destroy() {
        stage.querySelectorAll('.piece-ghost').forEach((node) => node.remove());
        document.querySelectorAll('.piece-ghost').forEach((node) => node.remove());
        stage.replaceChildren();
      },
    };
  },
};

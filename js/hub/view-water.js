import { createHistory } from '../puzzles/history.js?v=2.1.0';
import { WATER_COUNT, generateWater, isSolved, pour } from '../puzzles/water.js?v=2.1.0';

const LIQUIDS = ['#e07a7a', '#e0b15c', '#7fbf8a', '#6eb0d4', '#8d87d1', '#d58ab4', '#8fd0c6'];

function copy(tubes) {
  return tubes.map((tube) => tube.slice());
}

export const waterGame = {
  id: 'water',
  title: 'Water Sort',
  blurb: 'Нажмите колбу, затем другую — жидкость перельётся.',
  count: WATER_COUNT,
  win: 'Цвета разошлись по колбам',
  mount(stage, ctx) {
    const puzzle = generateWater(ctx.level);
    let tubes = copy(puzzle.tubes);
    const cap = puzzle.cap;
    const history = createHistory();
    let selected = -1;
    let pours = 0;
    if (ctx.snapshot && Array.isArray(ctx.snapshot.tubes) && ctx.snapshot.tubes.length === tubes.length) {
      tubes = copy(ctx.snapshot.tubes);
      history.load(ctx.snapshot.history);
      pours = ctx.snapshot.pours | 0;
    }

    function persist() {
      ctx.save({ tubes: copy(tubes), pours, history: history.dump() });
    }

    function draw(fresh) {
      stage.replaceChildren();
      const row = document.createElement('div');
      row.className = 'tube-row';
      tubes.forEach((tube, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `tube${selected === index ? ' selected' : ''}`;
        button.setAttribute('aria-label', `Колба ${index + 1}`);
        const glass = document.createElement('span');
        glass.className = 'glass';
        for (let unit = 0; unit < cap; unit++) {
          const layer = document.createElement('i');
          const color = tube[unit];
          if (color == null) layer.className = 'empty';
          else {
            const hue = LIQUIDS[color % LIQUIDS.length];
            layer.style.background = hue;
            layer.style.boxShadow = 'inset 0 7px 8px rgba(255,255,255,0.35)';
            if (unit === tube.length - 1) layer.classList.add('top');
            if (fresh && fresh.index === index && unit >= tube.length - fresh.count) layer.classList.add('fresh');
          }
          glass.append(layer);
        }
        button.append(glass);
        button.addEventListener('click', () => choose(index));
        row.append(button);
      });
      const layout = document.createElement('div');
      layout.className = 'water-layout';
      layout.append(row);
      stage.append(layout);
      const solved = isSolved(tubes, cap);
      ctx.status(solved ? 'Каждая колба одного цвета' : `Переливы: ${pours}`);
      ctx.changed();
      ctx.solved(solved);
    }

    function choose(index) {
      if (isSolved(tubes, cap) && selected < 0) return;
      if (selected < 0) {
        if (!tubes[index].length) return;
        selected = index;
        ctx.sound('tap');
        draw();
        return;
      }
      if (selected === index) {
        selected = -1;
        draw();
        return;
      }
      const next = pour(tubes, selected, index, cap);
      if (!next) {
        selected = tubes[index].length ? index : -1;
        ctx.sound('soft');
        draw();
        return;
      }
      const added = next[index].length - tubes[index].length;
      history.checkpoint({ tubes: copy(tubes), pours });
      tubes = next;
      pours += 1;
      const landed = index;
      selected = -1;
      ctx.sound('pour');
      ctx.buzz(12);
      persist();
      draw({ index: landed, count: added });
    }

    draw();
    return {
      canUndo: () => history.canUndo,
      undo() {
        const prev = history.undo();
        if (!prev) return;
        tubes = copy(prev.tubes);
        pours = prev.pours | 0;
        selected = -1;
        ctx.sound('undo');
        persist();
        draw();
      },
      restart() {
        history.clear();
        tubes = copy(puzzle.tubes);
        pours = 0;
        selected = -1;
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

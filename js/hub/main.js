import { VERSION } from '../version.js?v=2.0.0';
import { mountArkanoid, unmountArkanoid } from '../arkanoid/main.js?v=2.0.0';
import { createHubAudio, haptic } from './audio.js?v=2.0.0';
import { loadStore, saveStore } from './store.js?v=2.0.0';
import { pipesGame } from './view-pipes.js?v=2.0.0';
import { blocksGame } from './view-blocks.js?v=2.0.0';
import { sokobanGame } from './view-sokoban.js?v=2.0.0';
import { waterGame } from './view-water.js?v=2.0.0';
import { floodGame } from './view-flood.js?v=2.0.0';

const GAMES = [pipesGame, blocksGame, sokobanGame, waterGame, floodGame];
const BY_ID = Object.fromEntries(GAMES.map((game) => [game.id, game]));

const store = loadStore();
const audio = createHubAudio();
audio.setEnabled(store.settings.sound);

const shell = document.getElementById('shell');
const hub = document.getElementById('hub');
const menu = document.getElementById('menu');
const settings = document.getElementById('settings');
const play = document.getElementById('play');
const stage = document.getElementById('play-stage');
const titleEl = document.getElementById('play-title');
const levelEl = document.getElementById('play-level');
const helpEl = document.getElementById('play-help');
const statusEl = document.getElementById('play-status');
const solvedEl = document.getElementById('solved');
const solvedText = document.getElementById('solved-text');
const levelSheet = document.getElementById('level-sheet');
const levelGrid = document.getElementById('level-grid-hub');
const undoBtn = document.getElementById('act-undo');
const soundBtn = document.getElementById('act-sound');
const menuSound = document.getElementById('menu-sound');
const themeMeta = document.querySelector('meta[name="theme-color"]');

let view = null;
let current = null;
let levelIndex = 0;

function themeChoice() {
  if (store.settings.theme === 'light' || store.settings.theme === 'dark') return store.settings.theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyHubChrome() {
  const theme = themeChoice();
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.app = 'hub';
  document.body.dataset.theme = theme;
  document.body.dataset.app = 'hub';
  if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#151a19' : '#f3efe8');
  const on = store.settings.sound;
  for (const button of [soundBtn, menuSound]) {
    if (!button) continue;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.textContent = on ? 'Звук' : 'Тихо';
  }
  audio.setEnabled(on);
}

function persist() {
  saveStore(store);
}

function arkanoidCardMeta() {
  try {
    const saved = JSON.parse(localStorage.getItem('arkanoid-v1') || '{}');
    const score = Math.max(0, Number(saved.highScore) || 0);
    const unlocked = Math.max(1, Math.round(Number(saved.unlocked) || 1));
    return `Рекорд ${score.toLocaleString('ru-RU')} · открыто ${unlocked}`;
  } catch {
    return '14 уровней, четыре темы';
  }
}

function renderMenu() {
  menu.replaceChildren();
  const arcade = document.createElement('button');
  arcade.type = 'button';
  arcade.className = 'game-card arcade';
  arcade.innerHTML = `<span class="card-kicker">аркада</span><span class="card-title">Арканоид</span><span class="card-meta">${arkanoidCardMeta()}</span>`;
  arcade.addEventListener('click', () => {
    location.hash = '#/arkanoid';
  });
  menu.append(arcade);
  for (const game of GAMES) {
    const progress = store.games[game.id];
    const open = Math.min(game.count, progress.unlocked);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `game-card ${game.id}`;
    button.innerHTML = `<span class="card-kicker">головоломка</span><span class="card-title">${game.title}</span><span class="card-meta">Уровень ${Math.min(game.count, progress.level + 1)} из ${game.count} · открыто ${open}</span>`;
    button.addEventListener('click', () => {
      location.hash = `#/${game.id}`;
    });
    menu.append(button);
  }
}

function closeSheets() {
  settings.hidden = true;
  menu.hidden = false;
  levelSheet.hidden = true;
}

function showMenu() {
  if (view) {
    view.destroy();
    view = null;
  }
  current = null;
  unmountArkanoid();
  shell.hidden = false;
  hub.hidden = false;
  play.hidden = true;
  closeSheets();
  applyHubChrome();
  renderMenu();
}

function syncControls() {
  document.getElementById('set-sound').checked = store.settings.sound;
  document.getElementById('set-vibrate').checked = store.settings.vibrate;
  document.querySelectorAll('[data-theme-choice]').forEach((button) => {
    const on = button.dataset.themeChoice === store.settings.theme;
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function showSettings() {
  showMenu();
  menu.hidden = true;
  settings.hidden = false;
  syncControls();
}

function renderLevelSheet() {
  const game = BY_ID[current];
  if (!game) return;
  const progress = store.games[current];
  levelGrid.replaceChildren();
  for (let i = 0; i < game.count; i++) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = String(i + 1);
    button.disabled = i >= progress.unlocked;
    if (progress.cleared.includes(i)) button.classList.add('done');
    if (i === levelIndex) button.classList.add('current');
    button.addEventListener('click', () => {
      levelSheet.hidden = true;
      openPuzzle(current, i, true);
    });
    levelGrid.append(button);
  }
}

function openPuzzle(id, index, resetSnapshot) {
  const game = BY_ID[id];
  if (!game) {
    showMenu();
    return;
  }
  unmountArkanoid();
  shell.hidden = false;
  hub.hidden = true;
  play.hidden = false;
  settings.hidden = true;
  levelSheet.hidden = true;
  applyHubChrome();
  if (view) view.destroy();
  const progress = store.games[id];
  levelIndex = Math.max(0, Math.min(game.count - 1, index));
  if (levelIndex >= progress.unlocked) levelIndex = Math.max(0, progress.unlocked - 1);
  progress.level = levelIndex;
  if (resetSnapshot) progress.snapshot = null;
  const snapshot = progress.snapshot && progress.snapshot.level === levelIndex ? progress.snapshot.data : null;
  current = id;
  titleEl.textContent = game.title;
  levelEl.textContent = `Уровень ${levelIndex + 1} из ${game.count}`;
  helpEl.textContent = game.blurb;
  stage.replaceChildren();
  const ctx = {
    level: levelIndex,
    snapshot,
    save(data) {
      progress.snapshot = { level: levelIndex, data };
      progress.level = levelIndex;
      persist();
    },
    sound(name) {
      audio.play(name);
    },
    buzz(pattern) {
      haptic(pattern, store.settings.vibrate);
    },
    status(text) {
      statusEl.textContent = text;
    },
    changed() {
      undoBtn.disabled = !(view && view.canUndo());
    },
    solved(on) {
      solvedEl.hidden = !on;
      if (on) {
        if (!progress.cleared.includes(levelIndex)) progress.cleared.push(levelIndex);
        progress.unlocked = Math.max(progress.unlocked, Math.min(game.count, levelIndex + 2));
        persist();
        const last = levelIndex >= game.count - 1;
        solvedText.textContent = last ? `${game.win}. Это последний уровень.` : game.win;
        document.getElementById('act-next').textContent = last ? 'В меню' : 'Дальше';
        if (live && !wasSolved) {
          audio.play('win');
          haptic([10, 40, 14], store.settings.vibrate);
        }
      }
      wasSolved = on;
    },
  };
  let live = false;
  let wasSolved = false;
  view = game.mount(stage, ctx);
  live = true;
  undoBtn.disabled = !view.canUndo();
  persist();
}

function showArkanoid() {
  if (view) {
    view.destroy();
    view = null;
  }
  current = 'arkanoid';
  shell.hidden = true;
  play.hidden = true;
  hub.hidden = true;
  mountArkanoid();
}

function route() {
  const name = (location.hash || '').replace(/^#\/?/, '').split('/')[0];
  if (name === 'arkanoid') {
    showArkanoid();
    return;
  }
  if (BY_ID[name]) {
    const progress = store.games[name];
    openPuzzle(name, progress.level, false);
    return;
  }
  if (name === 'settings') {
    showSettings();
    return;
  }
  showMenu();
}

document.getElementById('menu-settings').addEventListener('click', () => {
  location.hash = '#/settings';
});
document.getElementById('settings-back').addEventListener('click', () => {
  location.hash = '#/';
});
menuSound.addEventListener('click', () => {
  store.settings.sound = !store.settings.sound;
  persist();
  applyHubChrome();
  if (store.settings.sound) audio.play('tap');
});
soundBtn.addEventListener('click', () => {
  store.settings.sound = !store.settings.sound;
  persist();
  applyHubChrome();
  if (store.settings.sound) audio.play('tap');
});
document.getElementById('set-sound').addEventListener('change', (event) => {
  store.settings.sound = event.target.checked;
  persist();
  applyHubChrome();
});
document.getElementById('set-vibrate').addEventListener('change', (event) => {
  store.settings.vibrate = event.target.checked;
  persist();
  if (store.settings.vibrate) haptic(10, store.settings.sound);
});
document.querySelectorAll('[data-theme-choice]').forEach((button) => {
  button.addEventListener('click', () => {
    store.settings.theme = button.dataset.themeChoice;
    persist();
    applyHubChrome();
    syncControls();
  });
});
document.getElementById('act-back').addEventListener('click', () => {
  location.hash = '#/';
});
document.getElementById('act-undo').addEventListener('click', () => {
  if (view) view.undo();
});
document.getElementById('act-restart').addEventListener('click', () => {
  if (view) view.restart();
});
document.getElementById('act-levels').addEventListener('click', () => {
  levelSheet.hidden = !levelSheet.hidden;
  if (!levelSheet.hidden) renderLevelSheet();
});
document.getElementById('level-sheet-close').addEventListener('click', () => {
  levelSheet.hidden = true;
});
document.getElementById('act-next').addEventListener('click', () => {
  const game = BY_ID[current];
  if (!game) return;
  if (levelIndex >= game.count - 1) {
    location.hash = '#/';
    return;
  }
  openPuzzle(current, levelIndex + 1, true);
});
document.getElementById('btn-to-hub').addEventListener('click', () => {
  location.hash = '#/';
});

document.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
document.addEventListener(
  'touchmove',
  (event) => {
    if (event.target.closest('#play-stage, #game-arkanoid')) event.preventDefault();
  },
  { passive: false },
);
document.addEventListener('gesturestart', (event) => event.preventDefault());

window.addEventListener('hashchange', route);
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (store.settings.theme === 'auto' && document.body.dataset.app === 'hub') applyHubChrome();
});

const legacy = new URLSearchParams(location.search).get('game');
if (legacy && !location.hash) {
  const url = new URL(location.href);
  url.searchParams.delete('game');
  url.hash = `/${legacy}`;
  location.replace(url.href);
} else {
  document.getElementById('ver-hub').textContent = `v${VERSION}`;
  route();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {});
}

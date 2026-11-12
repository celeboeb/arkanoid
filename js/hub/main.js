import { VERSION } from '../version.js?v=2.1.0';
import { mountArkanoid, unmountArkanoid } from '../arkanoid/main.js?v=2.1.0';
import { createHubAudio, haptic } from './audio.js?v=2.1.0';
import { loadStore, saveStore } from './store.js?v=2.1.0';
import { pipesGame } from './view-pipes.js?v=2.1.0';
import { blocksGame } from './view-blocks.js?v=2.1.0';
import { sokobanGame } from './view-sokoban.js?v=2.1.0';
import { waterGame } from './view-water.js?v=2.1.0';
import { floodGame } from './view-flood.js?v=2.1.0';

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
  if (themeMeta) themeMeta.setAttribute('content', theme === 'dark' ? '#1c1a22' : '#f7f1ea');
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

const PREVIEWS = {
  arcade:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="8" y="14" width="48" height="8" rx="4" fill="#f0b7a4"/><rect x="8" y="26" width="48" height="8" rx="4" fill="#f3d6a1"/><rect x="8" y="38" width="48" height="8" rx="4" fill="#a9c8e4"/><rect x="18" y="50" width="28" height="6" rx="3" fill="#6f9a86"/></svg>',
  pipes:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M18 14v16h12v20" fill="none" stroke="#3f6d62" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="44" cy="46" r="6" fill="#7eb6c8"/></svg>',
  blocks:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="10" y="14" width="16" height="16" rx="5" fill="#f0b7a4"/><rect x="28" y="14" width="16" height="16" rx="5" fill="#f3d6a1"/><rect x="28" y="32" width="16" height="16" rx="5" fill="#c9b6e4"/><rect x="46" y="32" width="10" height="16" rx="5" fill="#a9c8e4"/></svg>',
  sokoban:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="16" width="40" height="32" rx="10" fill="#f6e7c8"/><circle cx="24" cy="32" r="7" fill="#6f9a86"/><rect x="36" y="25" width="14" height="14" rx="4" fill="#e2b97a"/></svg>',
  water:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="12" width="14" height="40" rx="7" fill="#d5e6f4"/><rect x="16" y="30" width="10" height="20" rx="5" fill="#f0b7a4"/><rect x="36" y="12" width="14" height="40" rx="7" fill="#d5e6f4"/><rect x="38" y="22" width="10" height="28" rx="5" fill="#a9c8e4"/></svg>',
  flood:
    '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="12" y="12" width="12" height="12" rx="4" fill="#f0b7a4"/><rect x="26" y="12" width="12" height="12" rx="4" fill="#f0b7a4"/><rect x="40" y="12" width="12" height="12" rx="4" fill="#f3d6a1"/><rect x="12" y="26" width="12" height="12" rx="4" fill="#f0b7a4"/><rect x="26" y="26" width="12" height="12" rx="4" fill="#b7d3c4"/><rect x="40" y="26" width="12" height="12" rx="4" fill="#b7d3c4"/><rect x="12" y="40" width="12" height="12" rx="4" fill="#a9c8e4"/><rect x="26" y="40" width="12" height="12" rx="4" fill="#b7d3c4"/><rect x="40" y="40" width="12" height="12" rx="4" fill="#c9b6e4"/></svg>',
};

function card(className, preview, kicker, title, meta, hash) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `game-card ${className}`;
  button.innerHTML = `<span class="preview">${preview}</span><span><span class="card-kicker">${kicker}</span><span class="card-title">${title}</span><span class="card-meta">${meta}</span></span>`;
  button.addEventListener('click', () => {
    location.hash = hash;
  });
  return button;
}

function renderMenu() {
  menu.replaceChildren();
  menu.append(card('arcade', PREVIEWS.arcade, 'аркада', 'Арканоид', arkanoidCardMeta(), '#/arkanoid'));
  for (const game of GAMES) {
    const progress = store.games[game.id];
    const open = Math.min(game.count, progress.unlocked);
    menu.append(
      card(
        game.id,
        PREVIEWS[game.id],
        'головоломка',
        game.title,
        `Уровень ${Math.min(game.count, progress.level + 1)} из ${game.count} · открыто ${open}`,
        `#/${game.id}`,
      ),
    );
  }
}

function celebrate() {
  const layer = document.createElement('div');
  layer.className = 'confetti';
  const colors = ['#f0b7a4', '#f3d6a1', '#b7d3c4', '#a9c8e4', '#c9b6e4', '#e7b4c4'];
  for (let i = 0; i < 16; i++) {
    const dot = document.createElement('i');
    dot.style.left = `${12 + Math.random() * 76}%`;
    dot.style.background = colors[i % colors.length];
    dot.style.animationDelay = `${Math.random() * 0.18}s`;
    layer.append(dot);
  }
  stage.append(layer);
  setTimeout(() => layer.remove(), 1100);
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
          haptic([8, 36, 10], store.settings.vibrate);
          celebrate();
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

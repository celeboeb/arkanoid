import { VERSION } from './version.js?v=1.0.0';
import { SIM_DT } from './physics.js?v=1.0.0';
import { THEME_COLOR } from './themes.js?v=1.0.0';
import { createGame } from './game.js?v=1.0.0';
import { createRenderer } from './render.js?v=1.0.0';
import { createAudio } from './audio.js?v=1.0.0';
import { loadState, saveState } from './storage.js?v=1.0.0';

const saved = loadState();
const settings = saved.settings;
const audio = createAudio();

function persistProgress(progress) {
  saveState({ ...progress, settings });
}

const game = createGame(settings, audio, saved, persistProgress);
const canvas = document.getElementById('view');
const renderer = createRenderer(canvas);
const hud = document.getElementById('hud');
const app = document.getElementById('app');

const els = {
  score: document.getElementById('score-num'),
  combo: document.getElementById('combo'),
  level: document.getElementById('level-num'),
  lives: document.getElementById('lives-num'),
  fx: document.getElementById('fx'),
  banner: document.getElementById('banner'),
  bannerTitle: document.getElementById('banner-title'),
  bannerHint: document.getElementById('banner-hint'),
  toast: document.getElementById('toast'),
  menuRecord: document.getElementById('menu-record'),
  overScore: document.getElementById('over-score'),
  overRecord: document.getElementById('over-record'),
  winScore: document.getElementById('win-score'),
  winRecord: document.getElementById('win-record'),
  pauseLevel: document.getElementById('pause-level'),
  levelGrid: document.getElementById('level-grid'),
  sound: document.getElementById('opt-sound'),
  volume: document.getElementById('opt-volume'),
  sens: document.getElementById('opt-sens'),
  vib: document.getElementById('opt-vib'),
  themeColor: document.querySelector('meta[name="theme-color"]'),
};

const screens = {
  menu: document.getElementById('screen-menu'),
  levels: document.getElementById('screen-levels'),
  settings: document.getElementById('screen-settings'),
  paused: document.getElementById('screen-pause'),
  gameover: document.getElementById('screen-over'),
  win: document.getElementById('screen-win'),
  levelclear: document.getElementById('screen-clear'),
};

document.getElementById('ver').textContent = `v${VERSION}`;
applyAudio();

let geom = { scale: 1 };
let levelSig = '';
let focusedPlay = false;

function applyAudio() {
  audio.setTheme(settings.theme);
  audio.setEnabled(settings.sound);
  audio.setVolume(Number(settings.volume));
}

function saveSettings() {
  const snap = game.snapshot();
  saveState({
    highScore: snap.highScore,
    unlocked: snap.unlocked,
    completed: snap.levels.map((level) => level.done),
    settings,
  });
  applyAudio();
}

function renderLevels(snap) {
  const sig = snap.levels.map((level) => `${level.unlocked ? 1 : 0}${level.done ? 'd' : ''}${level.name}`).join('|');
  if (sig === levelSig) return;
  levelSig = sig;
  els.levelGrid.replaceChildren();
  snap.levels.forEach((level, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = !level.unlocked;
    button.textContent = level.unlocked ? `${index + 1}. ${level.name}` : `${index + 1}. Закрыто`;
    if (level.done) button.classList.add('done');
    button.addEventListener('click', () => {
      audio.unlock();
      game.startAt(index);
      syncDom();
    });
    els.levelGrid.appendChild(button);
  });
}

function syncControls() {
  if (document.activeElement !== els.volume) els.volume.value = String(settings.volume);
  if (document.activeElement !== els.sens) els.sens.value = String(settings.sensitivity);
  els.sound.checked = Boolean(settings.sound);
  els.vib.checked = Boolean(settings.vibrate);
  document.querySelectorAll('[data-theme-pick]').forEach((button) => {
    const on = button.dataset.themePick === settings.theme;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('[data-speed]').forEach((button) => {
    const on = button.dataset.speed === settings.speed;
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function syncDom() {
  const snap = game.snapshot();
  document.body.dataset.theme = settings.theme;
  document.body.dataset.mode = snap.mode;
  document.documentElement.dataset.theme = settings.theme;
  if (els.themeColor) els.themeColor.setAttribute('content', THEME_COLOR[settings.theme] || '#07060f');

  for (const [name, el] of Object.entries(screens)) {
    if (el) el.hidden = snap.mode !== name;
  }
  const hudOn = Boolean(snap.run) && !['menu', 'levels', 'gameover', 'win'].includes(snap.mode);
  hud.hidden = !hudOn;

  const score = snap.score.toLocaleString('ru-RU');
  if (els.score.textContent !== score) els.score.textContent = score;
  const levelText = String(snap.level + 1);
  if (els.level.textContent !== levelText) els.level.textContent = levelText;
  const lives = '●'.repeat(Math.max(0, snap.lives));
  if (els.lives.textContent !== lives) els.lives.textContent = lives;
  if (snap.combo) {
    els.combo.hidden = false;
    els.combo.textContent = `×${snap.combo}`;
  } else els.combo.hidden = true;
  const fx = snap.fx.map((item) => item.label).join(' · ');
  if (els.fx.textContent !== fx) els.fx.textContent = fx;

  els.banner.hidden = !snap.banner;
  els.bannerTitle.textContent = snap.banner || '';
  els.bannerHint.textContent = snap.hint || '';
  els.toast.hidden = !snap.toast;
  els.toast.textContent = snap.toast || '';

  const record = snap.highScore.toLocaleString('ru-RU');
  if (els.menuRecord.textContent !== record) els.menuRecord.textContent = record;
  if (snap.mode === 'gameover') {
    els.overScore.textContent = score;
    els.overRecord.textContent = snap.newRecord ? `Новый рекорд: ${record}` : `Рекорд: ${record}`;
  }
  if (snap.mode === 'win') {
    els.winScore.textContent = score;
    els.winRecord.textContent = `Рекорд: ${record}`;
  }
  if (snap.mode === 'paused') {
    els.pauseLevel.textContent = `Уровень ${snap.level + 1} · ${snap.levelName}`;
  }
  if (snap.mode === 'levels') renderLevels(snap);
  if (snap.mode === 'settings') syncControls();

  if (snap.mode === 'playing' && !focusedPlay) {
    focusedPlay = true;
    canvas.focus({ preventScroll: true });
  }
  if (snap.mode !== 'playing') focusedPlay = false;
}

document.getElementById('btn-play').addEventListener('click', () => {
  audio.unlock();
  game.startNewGame();
  syncDom();
});
document.getElementById('btn-levels').addEventListener('click', () => {
  game.mode = 'levels';
  syncDom();
});
document.getElementById('btn-settings').addEventListener('click', () => {
  game.openSettings();
  syncDom();
});
document.getElementById('btn-levels-back').addEventListener('click', () => {
  game.mode = 'menu';
  syncDom();
});
document.getElementById('btn-settings-back').addEventListener('click', () => {
  game.closeSettings();
  syncDom();
});
document.getElementById('btn-hud-settings').addEventListener('click', () => {
  audio.unlock();
  game.openSettings();
  syncDom();
});
document.getElementById('btn-pause').addEventListener('click', () => {
  game.togglePause();
  syncDom();
});
document.getElementById('btn-resume').addEventListener('click', () => {
  game.togglePause();
  syncDom();
});
document.getElementById('btn-pause-settings').addEventListener('click', () => {
  game.openSettings();
  syncDom();
});
document.getElementById('btn-quit').addEventListener('click', () => {
  game.toMenu();
  syncDom();
});
document.getElementById('btn-retry').addEventListener('click', () => {
  audio.unlock();
  game.startNewGame();
  syncDom();
});
document.getElementById('btn-over-menu').addEventListener('click', () => {
  game.toMenu();
  syncDom();
});
document.getElementById('btn-win-menu').addEventListener('click', () => {
  game.toMenu();
  syncDom();
});
document.getElementById('btn-win-again').addEventListener('click', () => {
  audio.unlock();
  game.startNewGame();
  syncDom();
});

document.querySelectorAll('[data-theme-pick]').forEach((button) => {
  button.addEventListener('click', () => {
    settings.theme = button.dataset.themePick;
    saveSettings();
    syncDom();
  });
});
document.querySelectorAll('[data-speed]').forEach((button) => {
  button.addEventListener('click', () => {
    settings.speed = button.dataset.speed;
    saveSettings();
    syncDom();
  });
});
els.sound.addEventListener('change', () => {
  settings.sound = els.sound.checked;
  saveSettings();
});
els.volume.addEventListener('input', () => {
  settings.volume = Number(els.volume.value);
  saveSettings();
});
els.sens.addEventListener('input', () => {
  settings.sensitivity = Number(els.sens.value);
  saveSettings();
});
els.vib.addEventListener('change', () => {
  settings.vibrate = els.vib.checked;
  saveSettings();
});

let touchId = null;
let lastTouchX = 0;
let originX = 0;
let originY = 0;
let dragged = false;
let mouseDown = false;

app.addEventListener('pointerdown', (event) => {
  audio.unlock();
  if (event.target.closest('button, input, label, a')) return;
  if (game.mode !== 'playing') return;
  if (event.pointerType === 'touch') {
    touchId = event.pointerId;
    lastTouchX = event.clientX;
    originX = event.clientX;
    originY = event.clientY;
    dragged = false;
    game.input.mouseActive = false;
    if (canvas.setPointerCapture) {
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        /* already gone */
      }
    }
  } else {
    mouseDown = true;
    originX = event.clientX;
    originY = event.clientY;
    dragged = false;
    const point = renderer.toField(event.clientX, event.clientY);
    game.input.mouseX = point.x;
    game.input.mouseActive = true;
  }
});

app.addEventListener('pointermove', (event) => {
  if (game.mode !== 'playing') return;
  if (event.pointerType === 'touch') {
    if (event.pointerId !== touchId) return;
    if (Math.hypot(event.clientX - originX, event.clientY - originY) > 8) dragged = true;
    const dx = event.clientX - lastTouchX;
    lastTouchX = event.clientX;
    game.input.touchDx += dx / (geom.scale || 1);
    game.input.mouseActive = false;
    return;
  }
  const point = renderer.toField(event.clientX, event.clientY);
  game.input.mouseX = point.x;
  game.input.mouseActive = true;
  if (mouseDown && Math.hypot(event.clientX - originX, event.clientY - originY) > 8) dragged = true;
});

app.addEventListener('pointerup', (event) => {
  if (event.pointerType === 'touch') {
    if (event.pointerId !== touchId) return;
    if (!dragged && game.mode === 'playing') game.launch();
    touchId = null;
    return;
  }
  if (mouseDown && !dragged && game.mode === 'playing') game.launch();
  mouseDown = false;
});

app.addEventListener('pointercancel', () => {
  touchId = null;
  mouseDown = false;
});

canvas.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.code === 'Escape' && !event.repeat) {
    event.preventDefault();
    if (game.mode === 'settings') game.closeSettings();
    else if (game.mode === 'levels') game.mode = 'menu';
    else if (game.mode === 'playing' || game.mode === 'levelclear' || game.mode === 'paused') game.togglePause();
    syncDom();
    return;
  }
  const fieldMode = game.mode === 'playing' || game.mode === 'paused' || game.mode === 'levelclear';
  if (!fieldMode) return;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD'].includes(event.code)) {
    event.preventDefault();
  }
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') game.input.left = true;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') game.input.right = true;
  if (!event.repeat && game.mode === 'playing' && (event.code === 'Space' || event.code === 'ArrowUp')) game.launch();
  if (!event.repeat && event.code === 'KeyP') {
    game.togglePause();
    syncDom();
  }
}, true);

window.addEventListener('keyup', (event) => {
  if (event.code === 'ArrowLeft' || event.code === 'KeyA') game.input.left = false;
  if (event.code === 'ArrowRight' || event.code === 'KeyD') game.input.right = false;
});

window.addEventListener('blur', () => {
  game.input.left = false;
  game.input.right = false;
});

document.addEventListener('visibilitychange', () => {
  last = performance.now();
  acc = 0;
  if (document.hidden) {
    game.hide();
    syncDom();
  }
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).catch(() => {});
}

if (new URLSearchParams(location.search).has('e2e')) {
  window.__ARKANOID__ = {
    completeLevel() {
      game.completeLevel();
      syncDom();
    },
    snapshot: () => game.snapshot(),
    settings,
  };
}

let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!document.hidden) {
    acc += dt;
    if (acc > SIM_DT * 8) acc = SIM_DT * 8;
    let steps = 0;
    while (acc >= SIM_DT && steps < 8) {
      game.step(SIM_DT);
      acc -= SIM_DT;
      steps += 1;
    }
  }
  syncDom();
  geom = renderer.resize(hud);
  renderer.draw(game);
  requestAnimationFrame(frame);
}

syncDom();
requestAnimationFrame(frame);

export const SAVE_KEY = 'arkanoid-v1';

export const DEFAULT_SETTINGS = {
  theme: 'neon',
  sound: true,
  volume: 0.7,
  speed: 'normal',
  sensitivity: 1,
  vibrate: true,
};

const THEMES = ['neon', 'classic', 'space', 'minimal'];
const SPEEDS = ['calm', 'normal', 'fast'];

export function loadState() {
  const empty = {
    highScore: 0,
    unlocked: 1,
    completed: [],
    settings: { ...DEFAULT_SETTINGS },
  };
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return empty;
    const data = JSON.parse(raw);
    const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
    if (!THEMES.includes(settings.theme)) settings.theme = 'neon';
    if (!SPEEDS.includes(settings.speed)) settings.speed = 'normal';
    settings.volume = clamp01(settings.volume, 0.7);
    settings.sensitivity = clampNum(settings.sensitivity, 0.6, 1.6, 1);
    settings.sound = Boolean(settings.sound);
    settings.vibrate = settings.vibrate !== false;
    return {
      highScore: Math.max(0, Number(data.highScore) || 0),
      unlocked: Math.max(1, Math.round(Number(data.unlocked) || 1)),
      completed: Array.isArray(data.completed) ? data.completed.map(Boolean) : [],
      settings,
    };
  } catch {
    return empty;
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        highScore: state.highScore,
        unlocked: state.unlocked,
        completed: state.completed,
        settings: state.settings,
      }),
    );
  } catch {
    /* private mode */
  }
}

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(1, Math.max(0, n));
}

function clampNum(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

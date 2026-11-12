const KEY = 'antistress-v1';
const IDS = ['pipes', 'blocks', 'sokoban', 'water', 'flood'];

function fresh() {
  return {
    settings: { sound: true, vibrate: true, theme: 'auto' },
    games: Object.fromEntries(
      IDS.map((id) => [id, { unlocked: 1, level: 0, cleared: [], snapshot: null }]),
    ),
  };
}

export function loadStore() {
  const store = fresh();
  try {
    const data = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!data || typeof data !== 'object') return store;
    const settings = data.settings || {};
    if (settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'auto') {
      store.settings.theme = settings.theme;
    }
    store.settings.sound = settings.sound !== false;
    store.settings.vibrate = settings.vibrate !== false;
    for (const id of IDS) {
      const game = data.games && data.games[id];
      if (!game) continue;
      store.games[id].unlocked = Math.max(1, Math.round(Number(game.unlocked) || 1));
      store.games[id].level = Math.max(0, Math.round(Number(game.level) || 0));
      store.games[id].cleared = Array.isArray(game.cleared)
        ? game.cleared.map((n) => Math.round(Number(n))).filter((n) => n >= 0)
        : [];
      store.games[id].snapshot = game.snapshot && typeof game.snapshot === 'object' ? game.snapshot : null;
    }
  } catch {
    return fresh();
  }
  return store;
}

export function saveStore(store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* private mode */
  }
}

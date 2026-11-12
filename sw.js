const VERSION = '2.1.0';
const CACHE = `antistress-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './arkanoid.html',
  './manifest.json',
  './css/hub.css?v=2.1.0',
  './css/style.css?v=2.1.0',
  './js/version.js?v=2.1.0',
  './js/hub/main.js?v=2.1.0',
  './js/hub/audio.js?v=2.1.0',
  './js/hub/store.js?v=2.1.0',
  './js/hub/view-pipes.js?v=2.1.0',
  './js/hub/view-blocks.js?v=2.1.0',
  './js/hub/view-sokoban.js?v=2.1.0',
  './js/hub/view-water.js?v=2.1.0',
  './js/hub/view-flood.js?v=2.1.0',
  './js/puzzles/history.js?v=2.1.0',
  './js/puzzles/pipes.js?v=2.1.0',
  './js/puzzles/blocks.js?v=2.1.0',
  './js/puzzles/sokoban.js?v=2.1.0',
  './js/puzzles/water.js?v=2.1.0',
  './js/puzzles/flood.js?v=2.1.0',
  './js/arkanoid/main.js?v=2.1.0',
  './js/arkanoid/audio.js?v=2.1.0',
  './js/arkanoid/game.js?v=2.1.0',
  './js/arkanoid/levels.js?v=2.1.0',
  './js/arkanoid/physics.js?v=2.1.0',
  './js/arkanoid/render.js?v=2.1.0',
  './js/arkanoid/storage.js?v=2.1.0',
  './js/arkanoid/themes.js?v=2.1.0',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE && (key.startsWith('antistress-') || key.startsWith('arkanoid-')))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch (error) {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const fallback = (await cache.match('./index.html')) || (await cache.match('./'));
          if (fallback) return fallback;
        }
        throw error;
      }
    })(),
  );
});

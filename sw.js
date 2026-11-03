const VERSION = '1.0.1';
const CACHE = `arkanoid-${VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css?v=1.0.1',
  './js/version.js?v=1.0.1',
  './js/main.js?v=1.0.1',
  './js/game.js?v=1.0.1',
  './js/physics.js?v=1.0.1',
  './js/levels.js?v=1.0.1',
  './js/render.js?v=1.0.1',
  './js/audio.js?v=1.0.1',
  './js/storage.js?v=1.0.1',
  './js/themes.js?v=1.0.1',
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
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
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

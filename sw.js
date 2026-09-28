// The service worker. It keeps a copy of the game files, so that the
// game starts without a network connection after the first visit.
//
// Each request gets the copy from the cache first. At the same time, the
// service worker gets a new copy from the network for the next visit.

const CACHE = 'smashterpiece-v2';
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';

// All files that the game needs. The test "the service worker keeps all
// game files" makes sure that this list is complete.
const FILES = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './src/core/carve.js',
  './src/core/codec.js',
  './src/core/connect.js',
  './src/core/grid.js',
  './src/core/history.js',
  './src/core/holes.js',
  './src/core/mesher.js',
  './src/core/random.js',
  './src/core/raycast.js',
  './src/core/sand.js',
  './src/core/save.js',
  './src/core/score.js',
  './src/core/shapes.js',
  './src/core/stones.js',
  './src/core/treasures.js',
  './src/game/audio.js',
  './src/game/confetti.js',
  './src/game/icons.js',
  './src/game/main.js',
  './src/game/museum-view.js',
  './src/game/palette.js',
  './src/game/particles.js',
  './src/game/pieces.js',
  './src/game/scene.js',
  './src/game/stone-view.js',
  './src/game/textures.js',
  './src/game/tools-view.js',
  './src/game/treasures-view.js',
  `${THREE_URL}build/three.module.js`,
  `${THREE_URL}examples/jsm/controls/OrbitControls.js`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Add the files one at a time. A missing file does not stop the others.
      await Promise.all(FILES.map((url) => cache.add(url).catch(() => undefined)));
    }).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === self.location.origin;
  if (!local && !request.url.startsWith(THREE_URL)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: local });
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => undefined);
      if (cached) {
        event.waitUntil(fresh);
        return cached;
      }
      const response = await fresh;
      return response ?? (request.mode === 'navigate' ? cache.match('./index.html') : Response.error());
    }),
  );
});

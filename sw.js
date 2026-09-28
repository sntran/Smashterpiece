// The service worker. It keeps a copy of the game files, so that the
// game starts without a network connection after the first visit.
//
// Each deploy has its own version. The deploy workflow writes the version
// (the commit) into VERSION below. A new version is a new sw.js file, so
// the browser installs the new service worker. The new service worker
// gets all the files of its version from the network, into a new cache.
// Thus one device never mixes files of two versions. The game then
// reloads at a safe moment (see src/game/update.js).
//
// The version 'dev' is for a local server: each request goes to the
// network first, so that a change shows at once.

const VERSION = 'dev';
const CACHE = `smashterpiece-${VERSION}`;
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
  './src/core/badges.js',
  './src/core/carve.js',
  './src/core/codec.js',
  './src/core/connect.js',
  './src/core/decorate.js',
  './src/core/grid.js',
  './src/core/history.js',
  './src/core/holes.js',
  './src/core/i18n.js',
  './src/core/mesher.js',
  './src/core/qr.js',
  './src/core/random.js',
  './src/core/raycast.js',
  './src/core/replay.js',
  './src/core/sand.js',
  './src/core/save.js',
  './src/core/score.js',
  './src/core/settings.js',
  './src/core/shapes.js',
  './src/core/share.js',
  './src/core/stl.js',
  './src/core/stones.js',
  './src/core/treasures.js',
  './src/game/access-ui.js',
  './src/game/audio.js',
  './src/game/collection-ui.js',
  './src/game/confetti.js',
  './src/game/decorate-ui.js',
  './src/game/dom.js',
  './src/game/hints-ui.js',
  './src/game/icons.js',
  './src/game/lang-ui.js',
  './src/game/main.js',
  './src/game/museum-ui.js',
  './src/game/museum-view.js',
  './src/game/music.js',
  './src/game/palette.js',
  './src/game/particles.js',
  './src/game/pieces.js',
  './src/game/replay-ui.js',
  './src/game/save-ui.js',
  './src/game/scene.js',
  './src/game/share-ui.js',
  './src/game/stickers-view.js',
  './src/game/stone-view.js',
  './src/game/textures.js',
  './src/game/tools-view.js',
  './src/game/treasures-view.js',
  './src/game/update.js',
  `${THREE_URL}build/three.module.js`,
  `${THREE_URL}examples/jsm/controls/OrbitControls.js`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // 'reload' does not use the HTTP cache of the browser, so that each
      // file is the file of this version. A missing file does not stop
      // the others.
      await Promise.all(FILES.map((url) =>
        fetch(new Request(url, { cache: 'reload' }))
          .then((response) => (response.ok ? cache.put(url, response) : undefined))
          .catch(() => undefined)));
    }),
  );
});

// The page asks the new service worker to start at once.
self.addEventListener('message', (event) => {
  if (event.data === 'activate') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('smashterpiece-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const local = url.origin === self.location.origin;
  if (!local && !request.url.startsWith(THREE_URL)) return;
  event.respondWith(VERSION === 'dev' ? networkFirst(request) : cacheFirst(request, local));
});

// A released version: use the files of this version. Get a missing file
// from the network one time.
async function cacheFirst(request, local) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, { ignoreSearch: local });
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (request.mode === 'navigate' && (await cache.match('./index.html'))) || Response.error();
  }
}

// A local server: get the newest file, and use the cache only offline.
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true }))
      || (request.mode === 'navigate' && (await cache.match('./index.html')))
      || Response.error();
  }
}

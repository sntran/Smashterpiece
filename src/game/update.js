// New versions of the game. The service worker (sw.js) keeps the files
// for offline play. After a deploy, this module makes sure that the
// player gets the new version:
//   - It asks for a new version at the start, and each time the app
//     comes back to the front (an installed app can stay open for days).
//   - When the new version is ready, it reloads the page at a safe
//     moment: at once on the start screen, or else when the player goes
//     back to the start screen. The automatic save keeps the block.

let waiting = null;
let reloading = false;

export function setupUpdates(isSafeMoment) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return null;
  const sw = navigator.serviceWorker;
  const hadController = !!sw.controller;

  // The new service worker took control: load the new files.
  sw.addEventListener('controllerchange', () => {
    // The first install on this device is not an update.
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  const offer = (worker) => {
    waiting = worker;
    if (isSafeMoment()) activate();
  };

  const watch = (registration) => {
    if (registration.waiting && sw.controller) offer(registration.waiting);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && sw.controller) offer(worker);
      });
    });
  };

  const ready = sw.register('./sw.js').then((registration) => {
    watch(registration);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration.update().catch(() => undefined);
    });
    return registration;
  }).catch(() => null);
  return ready;
}

// Call this at a safe moment, for example on the start screen.
export function applyUpdateIfReady() {
  if (waiting) activate();
}

function activate() {
  const worker = waiting;
  waiting = null;
  worker.postMessage('activate');
}

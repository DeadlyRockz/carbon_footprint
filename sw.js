/**
 * Service worker — makes EcoTrack installable and fully usable offline.
 *
 * Strategy: cache the app shell on install (cache-first for those assets) and
 * fall back to the network for anything else. The app has no backend, so once
 * the shell is cached the whole experience works with no connection.
 *
 * Bump CACHE_VERSION whenever shell assets change to retire the old cache.
 */

const CACHE_VERSION = 'ecotrack-v2';

const APP_SHELL = [
  './',
  './index.html',
  './app.bundle.js',
  './manifest.webmanifest',
  './icon.svg',
  './src/styles.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return; // let the browser handle non-GET / cross-origin requests
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Cache successful same-origin responses for next time.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});

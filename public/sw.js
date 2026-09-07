/*
 * Minimal service worker.
 *
 * Its only real job is to exist and control the page — that's what
 * makes Chrome/Edge/Android consider this site "installable" and
 * show the native "Install app" prompt. It intentionally does NOT
 * cache API responses (chat, auth, etc.) or attempt an offline-first
 * strategy, since serving stale data for a live chat app would cause
 * more confusion than it's worth. Static assets get a light
 * cache-then-network pass for a small speed boost only.
 */

const CACHE_NAME = 'meridian-static-v1';

const STATIC_ASSET_PATTERN =
  /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // Never intercept API calls, auth flows, or cross-origin requests —
  // those must always go straight to the network.
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  if (!STATIC_ASSET_PATTERN.test(url.pathname)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

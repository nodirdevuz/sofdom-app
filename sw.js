/**
 * SofDom Elite PWA Service Worker (v2)
 * High-performance Stale-While-Revalidate for app shell and CacheFirst for apartment photos.
 */

const CACHE_NAME = 'sofdom-cache-v2';
const IMAGE_CACHE = 'sofdom-images-v2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './sofdom-icon.svg',
  './sofdom-logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME && key !== IMAGE_CACHE) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1. External Apartment Photos (Avito, Cian, BezPosrednikov, or any image) -> CacheFirst
  const isApartmentImage =
    url.hostname.includes('avito.st') ||
    url.hostname.includes('cdn-cian.ru') ||
    url.hostname.includes('bsps.ru') ||
    req.destination === 'image';

  if (isApartmentImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) {
          return cached;
        }
        try {
          const networkRes = await fetch(req);
          if (networkRes && (networkRes.status === 200 || networkRes.type === 'opaque')) {
            cache.put(req, networkRes.clone());
          }
          return networkRes;
        } catch {
          return cached || new Response('', { status: 404 });
        }
      })
    );
    return;
  }

  // 2. App Shell & Assets -> Stale-While-Revalidate
  // Instant load from cache in 0ms, silent background check for new versions
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

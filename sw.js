/* ============================================================
   Planner Pro — Service Worker  (v1.0.0)
   Precache + runtime caching + update flow
   ============================================================ */

const APP_VERSION = '1.0.0';
const BASE = '/PlannerPro/';

const STATIC_CACHE = `planner-static-v${APP_VERSION}`;
const ASSETS_CACHE = `planner-assets-v${APP_VERSION}`;
const IMAGES_CACHE = 'planner-images-v1';

// Files precached on install
const PRECACHE_URLS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `BASEstyles.css?v={BASE}styles.css?v=BASEstyles.css?v={APP_VERSION}`,
  `BASEdb.js?v={BASE}db.js?v=BASEdb.js?v={APP_VERSION}`,
  `BASEstore.js?v={BASE}store.js?v=BASEstore.js?v={APP_VERSION}`,
  `BASEutils.js?v={BASE}utils.js?v=BASEutils.js?v={APP_VERSION}`,
  `BASEicons.js?v={BASE}icons.js?v=BASEicons.js?v={APP_VERSION}`,
  `BASEcomponents.js?v={BASE}components.js?v=BASEcomponents.js?v={APP_VERSION}`,
  `BASEservices.js?v={BASE}services.js?v=BASEservices.js?v={APP_VERSION}`,
  `BASEviews.js?v={BASE}views.js?v=BASEviews.js?v={APP_VERSION}`,
  `BASErouter.js?v={BASE}router.js?v=BASErouter.js?v={APP_VERSION}`,
  `BASEapp.js?v={BASE}app.js?v=BASEapp.js?v={APP_VERSION}`,
  `BASEicons/icon−72.png‘,‘{BASE}icons/icon-72.png`, `BASEicons/icon−72.png‘,‘{BASE}icons/icon-96.png`,
  `BASEicons/icon−128.png‘,‘{BASE}icons/icon-128.png`, `BASEicons/icon−128.png‘,‘{BASE}icons/icon-144.png`,
  `BASEicons/icon−152.png‘,‘{BASE}icons/icon-152.png`, `BASEicons/icon−152.png‘,‘{BASE}icons/icon-192.png`,
  `BASEicons/icon−384.png‘,‘{BASE}icons/icon-384.png`, `BASEicons/icon−384.png‘,‘{BASE}icons/icon-512.png`,
  `BASEicons/maskable−icon.png‘,‘{BASE}icons/maskable-icon.png`, `BASEicons/maskable−icon.png‘,‘{BASE}icons/apple-touch-icon.png`
];

// ---------- Install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[SW] Precache partial failure:', err))
  );
});

// ---------- Activate ----------
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, ASSETS_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.map((key) =>
          !validCaches.includes(key) ? caches.delete(key) : Promise.resolve()
        ))
      )
      .then(() => self.clients.claim())
  );
});

// ---------- Fetch strategies ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // skip cross-origin

  // Navigation requests → network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(`${BASE}index.html`, copy));
          return response;
        })
        .catch(() =>
          caches.match(`${BASE}index.html`).then((r) => r || caches.match(BASE))
        )
    );
    return;
  }

  // Images → CacheFirst with expiration
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) cache.put(request, response.clone());
          return response;
        } catch {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // JS/CSS/fonts/manifest → StaleWhileRevalidate
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font' ||
    url.pathname.endsWith('.json')
  ) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Everything else → try cache, then network
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok && url.origin === self.location.origin) {
            const copy = response.clone();
            caches.open(ASSETS_CACHE).then((c) => c.put(request, copy));
          }
          return response;
        })
    )
  );
});

// ---------- Update flow: message from page ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
  }
});

// ---------- Background sync (reserved for future API) ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'planner-sync') {
    event.waitUntil(Promise.resolve()); // no API yet — data is local-only
  }
});

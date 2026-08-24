/* ============================================================
   Planner Pro — Service Worker  (v1.0.1)
   Precache + runtime caching + update flow
   ------------------------------------------------------------
   Стратегии:
   • Navigation → Network-first, fallback на кэшированный index.html
   • Images → Cache-first с лимитом записей (LRU-style)
   • JS/CSS/JSON → Stale-While-Revalidate
============================================================ */

const APP_VERSION = '1.0.1';
const BASE = '/PlannerPro/';

const STATIC_CACHE = `planner-static-v${APP_VERSION}`;
const ASSETS_CACHE = `planner-assets-v${APP_VERSION}`;
const IMAGES_CACHE = 'planner-images-v1';

const MAX_IMAGE_ENTRIES = 60; // лимит кэша картинок

// ---------- Файлы для precache при установке ----------
const PRECACHE_URLS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  `${BASE}styles.css?v=${APP_VERSION}`,
  `${BASE}db.js?v=${APP_VERSION}`,
  `${BASE}store.js?v=${APP_VERSION}`,
  `${BASE}utils.js?v=${APP_VERSION}`,
  `${BASE}icons.js?v=${APP_VERSION}`,
  `${BASE}components.js?v=${APP_VERSION}`,
  `${BASE}services.js?v=${APP_VERSION}`,
  `${BASE}views.js?v=${APP_VERSION}`,
  `${BASE}router.js?v=${APP_VERSION}`,
  `${BASE}app.js?v=${APP_VERSION}`,
  // Иконки (в корне, без подпапок)
  `${BASE}icon-72.png`,
  `${BASE}icon-96.png`,
  `${BASE}icon-128.png`,
  `${BASE}icon-144.png`,
  `${BASE}icon-152.png`,
  `${BASE}icon-192.png`,
  `${BASE}icon-384.png`,
  `${BASE}icon-512.png`,
  `${BASE}maskable-icon.png`,
  `${BASE}apple-touch-icon.png`
];

// ---------- Install ----------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch((err) => console.warn('[SW] Precache partial failure:', err))
  );
});

// ---------- Activate: удаляем старые кэши, захватываем клиентов ----------
self.addEventListener('activate', (event) => {
  const validCaches = [STATIC_CACHE, ASSETS_CACHE, IMAGES_CACHE];
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) =>
            !validCaches.includes(key) ? caches.delete(key) : Promise.resolve()
          )
        )
      )
      .then(() => self.clients.claim())
  );
});

// ---------- Fetch strategies ----------
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // пропускаем внешние запросы

  // --- Navigation: network-first, fallback на кэш ---
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

  // --- Images: cache-first с экспирацией ---
  if (request.destination === 'image') {
    event.respondWith(
      caches.open(IMAGES_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.ok) {
            await cache.put(request, response.clone());
            await trimCache(cache, MAX_IMAGE_ENTRIES);
          }
          return response;
        } catch {
          return new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // --- JS / CSS / fonts / manifest: stale-while-revalidate ---
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

  // --- Всё остальное: кэш → сеть ---
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

// ---------- Утилиты ----------

/**
 * Обрезает кэш до лимита записей (удаляет самые старые).
 */
async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  const toDelete = keys.length - maxEntries;
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(keys[i]);
  }
}

// ---------- Update flow: сообщение со страницы ----------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.source.postMessage({ type: 'SW_VERSION', version: APP_VERSION });
  }
});

// ---------- Background sync (зарезервировано для будущего API) ----------
self.addEventListener('sync', (event) => {
  if (event.tag === 'planner-sync') {
    event.waitUntil(Promise.resolve()); // API нет — данные локальные
  }
});
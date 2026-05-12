// Planner Pro - Service Worker
// Version 1.1

const CACHE_VERSION = 'planner-v1.1';
const BASE_PATH = '/PlannerPro/';

const CACHE_FILES = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'app.js',
  BASE_PATH + 'styles.css',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icon-72.png',
  BASE_PATH + 'icon-96.png',
  BASE_PATH + 'icon-128.png',
  BASE_PATH + 'icon-144.png',
  BASE_PATH + 'icon-152.png',
  BASE_PATH + 'icon-192.png',
  BASE_PATH + 'icon-384.png',
  BASE_PATH + 'icon-512.png',
  BASE_PATH + 'maskable-icon.png',
  BASE_PATH + 'apple-touch-icon.png'
];

// Install - кэшируем файлы
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(CACHE_FILES).catch(err => {
        console.warn('Не удалось кэшировать некоторые файлы:', err);
        // Продолжаем установку даже если не все файлы закэшировались
        return Promise.resolve();
      });
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate - удаляем старые кэши
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_VERSION) {
            console.log('Удаляем старый кэш:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch - cache-first стратегия
self.addEventListener('fetch', event => {
  // Пропускаем запросы не из нашего scope
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        // Возвращаем из кэша
        return cachedResponse;
      }

      // Если нет в кэше - запрашиваем из сети
      return fetch(event.request).then(response => {
        // Не кэшируем ошибки и не-GET запросы
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }

        // Клонируем ответ для кэша
        const responseToCache = response.clone();

        caches.open(CACHE_VERSION).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Офлайн - возвращаем index.html для SPA навигации
        if (event.request.mode === 'navigate') {
          return caches.match(BASE_PATH + 'index.html');
        }
      });
    })
  );
});

// Сообщение для обновления приложения
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

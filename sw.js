// Planner Pro — Service Worker
// Версия кэша обновляется при каждом изменении структуры/кода
const CACHE_NAME = 'planner-pro-v2.1';

const ASSETS = [
  './',
  './index.html',
  './404.html',
  './app.js',
  './styles.css',
  './manifest.json',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png',
  './maskable-icon.png',
  './apple-touch-icon.png'
];

// Установка: кэшируем все необходимые файлы
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).catch((err) => {
      console.error('SW Install Error:', err);
    })
  );
  // ВАЖНО: Не вызываем skipWaiting() здесь, чтобы дать пользователю шанс обновиться по кнопке
});

// Активация: удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith('planner-pro-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Обработка сообщений от клиента (для обновления)
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Стратегия получения: Cache First, Network Fallback
self.addEventListener('fetch', (event) => {
  // Игнорируем не-GET запросы и внешние ресурсы
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Если есть в кэше — отдаем
      if (cachedResponse) return cachedResponse;

      // Если нет — идем в сеть
      return fetch(event.request).then((response) => {
        // Если ответ валидный — кэшируем его
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Если сети нет и нет в кэше
        // Для навигации отдаем index.html (SPA fallback)
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
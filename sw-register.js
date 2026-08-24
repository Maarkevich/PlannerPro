/* ============================================================
   Planner Pro — SW registration & update flow  (v1.0.1)
   Регистрация, периодическая проверка обновлений,
   тост «Доступно обновление» с анти-наггингом (24 ч)
============================================================ */
(function () {
  'use strict';

  const BASE = window.APP_BASE || '/PlannerPro/';
  const UPDATE_TOAST_KEY = 'planner_update_dismissed_v';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${BASE}sw.js?v=${window.APP_VERSION}`)
      .then((registration) => {
        console.log('[SW] Registered, scope:', registration.scope);

        // Проверяем обновления при каждой загрузке страницы
        registration.update().catch(() => {});

        // Периодическая проверка обновлений (каждые 30 минут)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // Новый SW уже ждёт активации → показываем тост обновления
        // ВАЖНО: проверяем наличие активного контроллера,
        // чтобы не показать тост при самой первой загрузке
        // (когда SW только устанавливается впервые)
        if (registration.waiting && navigator.serviceWorker.controller) {
          notifyUpdate(registration.waiting);
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              notifyUpdate(newWorker);
            }
          });
        });
      })
      .catch((err) =>
        console.warn('[SW] Registration failed:', err)
      );
  });

  function notifyUpdate(worker) {
    // Не напоминаем повторно, если пользователь уже закрыл тост
    // для этой версии в течение последних 24 часов
    try {
      const dismissed = JSON.parse(
        localStorage.getItem(UPDATE_TOAST_KEY) || '{"v":"","t":0}'
      );
      if (
        dismissed.v === window.APP_VERSION &&
        Date.now() - dismissed.t < 24 * 60 * 60 * 1000
      ) {
        return;
      }
    } catch (_) { /* ignore */ }

    // Небольшая задержка, чтобы UI был готов
    setTimeout(() => {
      if (window.PlannerToast && typeof window.PlannerToast.update === 'function') {
        window.PlannerToast.update({
          message: 'Доступно обновление приложения',
          actionLabel: 'Обновить',
          onAction: () => applyUpdate(worker)
        });
      } else {
        fallbackToast(worker);
      }
    }, 1500);
  }

  function applyUpdate(worker) {
    // Запоминаем, что пользователь отклонил обновление этой версии
    try {
      localStorage.setItem(UPDATE_TOAST_KEY, JSON.stringify({
        v: window.APP_VERSION,
        t: Date.now()
      }));
    } catch (_) { /* ignore */ }

    worker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  /**
   * Фолбэк-тост, если приложение ещё не загрузило свой Toast-модуль.
   * Создаётся простым DOM-элементом со стилями из styles.css.
   */
  function fallbackToast(worker) {
    let root = document.getElementById('toast-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'toast-root';
      document.body.appendChild(root);
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-info';
    toast.setAttribute('role', 'alert');
    toast.innerHTML = '<span>Доступно обновление</span>';

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Обновить';
    btn.addEventListener('click', () => {
      applyUpdate(worker);
      toast.remove();
    });

    toast.appendChild(btn);
    root.appendChild(toast);
  }
})();
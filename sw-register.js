/* ============================================================
   Planner Pro — SW registration & update flow  (v1.0.0)
   ============================================================ */

(function () {
  'use strict';

  const BASE = window.APP_BASE || '/PlannerPro/';
  const UPDATE_TOAST_KEY = 'planner_update_dismissed_v';

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`BASEsw.js?v={BASE}sw.js?v=BASEsw.js?v={window.APP_VERSION}`)
      .then((registration) => {
        console.log('[SW] Registered, scope:', registration.scope);

        // Check for updates on every page load
        registration.update().catch(() => {});

        // Periodic update check (every 30 min)
        setInterval(() => {
          registration.update().catch(() => {});
        }, 30 * 60 * 1000);

        // New SW waiting → show update toast
        if (registration.waiting) {
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
    // Don't nag if user dismissed this version recently (24h)
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

    // Wait a moment so UI is ready, then toast via app API if available,
    // otherwise fallback to simple DOM toast.
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
    worker.postMessage({ type: 'SKIP_WAITING' });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

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
    toast.innerHTML =
      '<span>Доступно обновление</span>';
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

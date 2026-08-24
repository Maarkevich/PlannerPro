/* ============================================================
   Planner Pro — Hash-роутер  (v1.0.0)
   #/dashboard, #/tasks, #/calendar, #/notes, #/projects,
   #/stats, #/settings, #/trash
   ============================================================ */

(function () {
  'use strict';

  const Store = window.PlannerStore;
  const Views = window.PlannerViews.Views;

  const ROUTES = {
    dashboard: { view: Views.dashboard, title: 'Planner Pro' },
    tasks:     { view: Views.tasks,     title: 'Задачи' },
    calendar:  { view: Views.calendar,  title: 'Календарь' },
    notes:     { view: Views.notes,     title: 'Заметки' },
    projects:  { view: Views.projects,  title: 'Проекты' },
    stats:     { view: Views.stats,     title: 'Статистика' },
    settings:  { view: Views.settings,  title: 'Настройки' },
    trash:     { view: Views.trash,     title: 'Корзина' }
  };

  let currentCleanup = null;

  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, '');
    if (!raw) return { view: 'dashboard', params: {} };
    const [pathPart, queryPart] = raw.split('?');
    const params = {};
    if (queryPart) {
      new URLSearchParams(queryPart).forEach((v, k) => { params[k] = v; });
    }
    return { view: pathPart || 'dashboard', params };
  }

  function render() {
    const { view, params } = parseHash();
    const route = ROUTES[view] || ROUTES.dashboard;

    // Cleanup предыдущего экрана
    if (typeof currentCleanup === 'function') currentCleanup();
    currentCleanup = null;

    // Обновляем store
    Store.state.route = { view: route === ROUTES.dashboard && view !== 'dashboard' ? 'dashboard' : view, params };

    // Рендер
    const container = document.getElementById('view-container');
    container.innerHTML = '';
    container.dataset.view = view;

    try {
      route.view(container, params);
    } catch (err) {
      console.error('[router]', err);
      container.innerHTML = `
        <div class="empty-state">
          <p>Что-то пошло не так 😔</p>
          <button class="btn btn-primary" onclick="location.hash='#/dashboard'">На главную</button>
        </div>`;
    }

    document.title = `${route.title} · Planner Pro`;

    // Подсветка активного пункта навигации
    document.querySelectorAll('.nav-item').forEach((item) => {
      item.classList.toggle('active', item.dataset.route === view);
      item.setAttribute('aria-current', item.dataset.route === view ? 'page' : 'false');
    });

    // Скролл вверх при смене экрана
    window.scrollTo({ top: 0 });
  }

  window.addEventListener('hashchange', render);

  function start() {
    if (!location.hash) location.replace('#/dashboard');
    render();
  }

  window.PlannerRouter = { start, render, ROUTES };
})();

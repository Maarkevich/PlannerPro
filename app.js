/* ============================================================
   Planner Pro — Точка входа приложения  (v1.0.1)
   Инициализация, layout, навигация, FAB, PWA, keyboard shortcuts
   ------------------------------------------------------------
   ВАЖНО: не перезаписываем document.body.innerHTML, а наполняем
   существующие контейнеры из index.html (#side-nav, #main-content,
   #bottom-nav). Это устраняет конфликт между двумя архитектурами.
============================================================ */
(function () {
  'use strict';

  const U = window.PlannerUtils;
  const I = window.PlannerIcons;
  const C = window.PlannerComponents;
  const S = window.PlannerServices;
  const Store = window.PlannerStore;
  const Toast = window.PlannerToast;

  const APP_VERSION = '1.0.1';
  window.APP_VERSION = APP_VERSION;
  window.APP_BASE = '/PlannerPro/';

  /* ==================== Layout ==================== */

  /**
   * Наполняет существующие контейнеры из index.html.
   * НЕ перезаписывает body.innerHTML — сплэш и все элементы сохраняются.
   */
  function buildLayout() {
    const sideNav = document.getElementById('side-nav');
    const mainContent = document.getElementById('main-content');
    const bottomNav = document.getElementById('bottom-nav');
    const fab = document.getElementById('fab');

    // ---------- Side navigation (desktop) ----------
    if (sideNav) {
      sideNav.innerHTML = `
        <div class="side-nav-brand">${I.get('check-square', 24)}<span>Planner Pro</span></div>
        ${navItemsHTML('side-nav-item')}
        <div class="side-nav-section">
          <button class="btn btn-primary btn-block" data-add-task>${I.get('plus', 18)} Новая задача</button>
        </div>`;
    }

    // ---------- Main content ----------
    if (mainContent) {
      mainContent.innerHTML = `
        <header class="topbar">
          <button class="btn btn-icon btn-ghost menu-btn" aria-label="Открыть меню">${I.get('menu', 22)}</button>
          <span class="topbar-title">Planner Pro</span>
          <div class="topbar-actions">
            <button class="btn btn-icon btn-ghost" data-search-btn aria-label="Поиск">${I.get('search', 20)}</button>
            <button class="btn btn-icon btn-ghost" data-theme-toggle aria-label="Переключить тему"></button>
          </div>
        </header>
        <div id="view-container" class="view-container"></div>`;
    }

    // ---------- Bottom navigation (mobile) ----------
    if (bottomNav) {
      bottomNav.innerHTML = bottomNavHTML('bottom-nav-item');
    }

    wireLayout();
  }

  function navItemsHTML(itemClass = 'nav-item') {
    const items = [
      ['dashboard', 'home', 'Главная'],
      ['tasks', 'check-square', 'Задачи'],
      ['calendar', 'calendar', 'Календарь'],
      ['notes', 'note', 'Заметки'],
      ['projects', 'folder', 'Проекты'],
      ['stats', 'chart', 'Статистика'],
      ['settings', 'settings', 'Настройки']
    ];
    return items.map(([route, icon, label]) =>
      `<a class="${itemClass}" href="#/${route}" data-route="${route}">${I.get(icon, 20)}<span>${label}</span></a>`
    ).join('');
  }

  function bottomNavHTML(itemClass = 'nav-item') {
    const items = [
      ['dashboard', 'home', 'Главная'],
      ['tasks', 'check-square', 'Задачи'],
      ['calendar', 'calendar', 'Календарь'],
      ['notes', 'note', 'Заметки']
    ];
    return items.map(([route, icon, label]) =>
      `<a class="${itemClass}" href="#/${route}" data-route="${route}">${I.get(icon, 22)}<span>${label}</span></a>`
    ).join('');
  }

  function wireLayout() {
    // Тема: иконка + переключение
    const themeBtn = document.querySelector('[data-theme-toggle]');
    if (themeBtn) {
      function renderThemeIcon() {
        themeBtn.innerHTML = I.get(Store.state.settings.mode === 'dark' ? 'sun' : 'moon', 20);
      }
      renderThemeIcon();
      themeBtn.addEventListener('click', () => {
        const mode = Store.state.settings.mode === 'dark' ? 'light' : 'dark';
        Store.updateSettings({ mode });
        U.applyTheme(Store.state.settings.theme, mode);
        renderThemeIcon();
        U.haptic(10);
      });
    }

    // Кнопка меню (мобильная) → открывает сайдбар как drawer
    const menuBtn = document.querySelector('.menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('side-nav');
        if (!sidebar) return;
        sidebar.classList.add('open');

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop visible';
        backdrop.style.zIndex = 'calc(var(--z-sidebar) - 1)';
        backdrop.addEventListener('click', () => {
          sidebar.classList.remove('open');
          backdrop.remove();
        });
        document.body.appendChild(backdrop);
      });
    }

    // FAB → быстрое меню
    const fab = document.getElementById('fab');
    if (fab) {
      fab.addEventListener('click', openFabMenu);
    }

    // Sidebar кнопка новой задачи
    const addTaskBtn = document.querySelector('[data-add-task]');
    if (addTaskBtn) {
      addTaskBtn.addEventListener('click', () => {
        window.PlannerViews.openTaskModal();
      });
    }

    // Поиск в топбаре
    const searchBtn = document.querySelector('[data-search-btn]');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        Store.navigate('tasks');
        setTimeout(() => {
          document.querySelector('.search-bar input')?.focus();
        }, 100);
      });
    }
  }

  /* ==================== FAB quick menu ==================== */

  function openFabMenu() {
    U.haptic(10);

    const actions = [
      { icon: 'check-square', label: 'Задача', onClick: () => window.PlannerViews.openTaskModal() },
      { icon: 'note', label: 'Заметка', onClick: () => window.PlannerViews.openNoteEditor() },
      { icon: 'calendar', label: 'На дату', onClick: () => {
        const iso = U.todayISO();
        window.PlannerViews.openTaskModal(null, { dueDate: iso });
      } },
      { icon: 'folder', label: 'Проект', onClick: () => { Store.navigate('projects'); } }
    ];

    const root = document.getElementById('modal-root');
    if (!root) return;

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.background = 'transparent';
    backdrop.style.zIndex = 'calc(var(--z-fab) - 1)';

    const menu = document.createElement('div');
    menu.className = 'fab-menu';

    actions.forEach(({ icon, label, onClick }) => {
      const item = document.createElement('button');
      item.className = 'fab-menu-item';
      item.innerHTML = `${I.get(icon, 20)}<span>${U.escapeHTML(label)}</span>`;
      item.addEventListener('click', () => { close(); onClick(); });
      menu.appendChild(item);
    });

    backdrop.appendChild(menu);
    root.appendChild(backdrop);

    let closed = false;

    function close() {
      if (closed) return;
      closed = true;
      backdrop.classList.remove('visible');
      setTimeout(() => backdrop.remove(), 300);
    }

    backdrop.addEventListener('click', close);
    requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('visible')));
  }

  /* ==================== Splash screen ==================== */

  function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (!splash) return;
    splash.classList.add('hidden');
    // Удаляем из DOM после завершения анимации
    setTimeout(() => splash.remove(), 400);
  }

  function updateSplashStatus(text) {
    const el = document.getElementById('splash-status');
    if (el) el.textContent = text;
  }

  /* ==================== PWA install prompt ==================== */

  function setupPWA() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      Store.state.installPromptEvent = e;
      Toast.info('Приложение можно установить', 4000);
    });

    window.addEventListener('appinstalled', () => {
      Store.state.installPromptEvent = null;
      Toast.success('Planner Pro установлен');
    });
  }

  /* ==================== Keyboard shortcuts ==================== */

  function setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea, [contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'n': window.PlannerViews.openTaskModal(); break;
        case 'j': Store.navigate('tasks'); break;
        case 'c': Store.navigate('calendar'); break;
        case 'k': Store.navigate('notes'); break;
        case '/': {
          e.preventDefault();
          document.querySelector('.search-bar input')?.focus();
          break;
        }
        case '?': showShortcutsHelp(); break;
      }
    });
  }

  function showShortcutsHelp() {
    C.Modal.open({
      title: 'Горячие клавиши',
      content: `
        <div class="legend">
          <div class="legend-item"><kbd>N</kbd> — новая задача</div>
          <div class="legend-item"><kbd>J</kbd> — задачи</div>
          <div class="legend-item"><kbd>C</kbd> — календарь</div>
          <div class="legend-item"><kbd>K</kbd> — заметки</div>
          <div class="legend-item"><kbd>/</kbd> — поиск</div>
          <div class="legend-item"><kbd>?</kbd> — эта справка</div>
        </div>`
    });
  }

  /* ==================== Init ==================== */

  async function init() {
    updateSplashStatus('Загрузка настроек…');

    // Загружаем настройки
    const savedTheme = await window.PlannerDB.getSetting('theme', 'ocean');
    const savedMode = await window.PlannerDB.getSetting('mode',
      matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

    Store.updateSettings({ theme: savedTheme, mode: savedMode });
    U.applyTheme(savedTheme, savedMode);

    // Сохраняем настройки при изменении
    Store.on('settings', (s) => {
      window.PlannerDB.setSetting('theme', s.theme);
      window.PlannerDB.setSetting('mode', s.mode);
    });

    updateSplashStatus('Загрузка данных…');

    // Загружаем данные
    try {
      await Promise.all([
        S.TaskService.loadAll(),
        S.NoteService.loadAll(),
        S.ProjectService.loadAll(),
        S.TagService.loadAll()
      ]);
    } catch (err) {
      console.error('[init] Data load failed:', err);
      Toast.error('Не удалось загрузить данные');
    }

    // Чистим просроченную корзину
    await Promise.all([S.TaskService.purgeExpired(), S.NoteService.purgeExpired()]);

    updateSplashStatus('Запуск…');

    // Строим интерфейс (наполняем существующие контейнеры)
    buildLayout();

    // Показываем приложение, скрываем сплэш
    const app = document.getElementById('app');
    if (app) app.hidden = false;
    hideSplash();

    // Стартуем роутер
    window.PlannerRouter.start();

    // PWA + shortcuts
    setupPWA();
    setupShortcuts();

    // Перерисовка активного экрана при изменении данных
    let rerenderTimer;
    Store.on(['tasks', 'notes', 'projects'], () => {
      clearTimeout(rerenderTimer);
      rerenderTimer = setTimeout(() => window.PlannerRouter.render(), 50);
    });

    Store.state.loading = false;
    console.log(`[Planner Pro] v${APP_VERSION} ready`);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

(function () {
  'use strict';

  const U = window.PlannerUtils;
  const I = window.PlannerIcons;
  const C = window.PlannerComponents;
  const S = window.PlannerServices;
  const Store = window.PlannerStore;
  const Toast = window.PlannerToast;

  /* ==================== Offline indicator ==================== */

  function setupOfflineIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'offline-indicator';
    indicator.innerHTML = `${I.get('alertCircle', 16)} Нет подключения — работаем офлайн`;
    document.body.appendChild(indicator);

    function update(online) {
      indicator.classList.toggle('visible', !online);
    }

    update(navigator.onLine);
    window.addEventListener('online', () => {
      update(true);
      Toast.success('Соединение восстановлено');
    });
    window.addEventListener('offline', () => update(false));
  }

  /* ==================== Bulk selection mode ==================== */

  function setupBulkMode() {
    const viewContainer = document.getElementById('view-container');
    if (!viewContainer) return;

    // Long press на задаче → вход в bulk-режим и выбор элемента
    const observer = new MutationObserver(() => {
      if (!Store.state.bulkMode) {
        document.querySelectorAll('.task-item').forEach((item) => {
          if (item.dataset.bulkBound) return;
          item.dataset.bulkBound = '1';
          U.attachLongPress(item, () => {
            Store.toggleBulkMode(true);
            Store.toggleBulkItem(item.dataset.id);
            renderBulkBar();
          });
        });
      }
    });
    observer.observe(viewContainer, { childList: true, subtree: true });

    Store.on('bulkSelection', renderBulkBar);

    function renderBulkBar() {
      let bar = document.querySelector('.bulk-bar');
      const count = Store.state.bulkSelection.size;

      if (!Store.state.bulkMode || count === 0) {
        bar?.remove();
        return;
      }

      if (!bar) {
        bar = C.bulkBar(count, [
          { icon: 'check', label: 'Выполнить выбранные', onClick: async () => {
            await S.TaskService.bulkAction(Store.selectedIds, 'complete');
            Toast.success('Задачи выполнены');
            exitBulk();
          } },
          { icon: 'archive', label: 'В архив', onClick: async () => {
            await S.TaskService.bulkAction(Store.selectedIds, 'archive');
            Toast.info('Перемещено в архив');
            exitBulk();
          } },
          { icon: 'trash', label: 'Удалить', danger: true, onClick: async () => {
            await S.TaskService.bulkAction(Store.selectedIds, 'delete');
            Toast.info('Перемещено в корзину');
            exitBulk();
          } },
          { icon: 'closeSquare', label: 'Отменить выбор', onClick: exitBulk }
        ]);
        document.body.appendChild(bar);
      } else {
        bar.querySelector('strong').textContent = count;
      }

      function exitBulk() {
        Store.toggleBulkMode(false);
        bar?.remove();
      }
    }
  }

  /* ==================== Drag & drop (desktop reorder) ==================== */

  function setupDragAndDrop() {
    const container = document.getElementById('view-container');
    if (!container) return;

    container.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.task-item');
      if (!item) return;
      e.dataTransfer.setData('text/plain', item.dataset.id);
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    container.addEventListener('dragend', (e) => {
      e.target.closest('.task-item')?.classList.remove('dragging');
      container.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    });

    container.addEventListener('dragover', (e) => {
      const target = e.target.closest('.task-item');
      if (!target || target.classList.contains('dragging')) return;
      e.preventDefault();
      container.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
      target.classList.add('drop-target');
    });

    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      const target = e.target.closest('.task-item');
      if (!draggedId || !target || target.dataset.id === draggedId) return;

      const dragged = Store.state.tasks.find((t) => t.id === draggedId);
      const onto = Store.state.tasks.find((t) => t.id === target.dataset.id);
      if (!dragged || !onto) return;

      await S.TaskService.update(dragged.id, {
        dueDate: onto.dueDate,
        priority: onto.priority
      });
      Toast.info(`«${dragged.title}» перенесено к «${onto.title}»`);
    });
  }

  /* ==================== Auto-backup (раз в день) ==================== */

  async function maybeAutoBackup() {
    try {
      const last = await window.PlannerDB.getMeta('lastAutoBackup');
      const today = U.todayISO();
      if (last !== today) {
        await window.PlannerDB.createBackup();
        await window.PlannerDB.setMeta('lastAutoBackup', today);
        console.log('[backup] Daily auto-backup created');
      }
    } catch (err) {
      console.warn('[backup] Auto-backup failed:', err);
    }
  }

  /* ==================== First-run onboarding ==================== */

  async function maybeOnboarding() {
    const seen = await window.PlannerDB.getSetting('onboardingDone', false);
    if (seen) return;

    C.Modal.open({
      title: 'Добро пожаловать в Planner Pro!',
      content: `
        <div class="legend" style="gap:14px">
          <div class="legend-item">${I.get('check-square', 18)} Задачи с приоритетами, повторами и подзадачами</div>
          <div class="legend-item">${I.get('calendar', 18)} Календарь и таймлайн дня</div>
          <div class="legend-item">${I.get('note', 18)} Быстрые заметки с форматированием</div>
          <div class="legend-item">${I.get('chart', 18)} Статистика продуктивности</div>
          <div class="legend-item">${I.get('smartphone', 18)} Полностью офлайн — данные только на устройстве</div>
        </div>
        <p style="font-size:13px;color:var(--text-tertiary);margin-top:12px">
          Свайпните задачу вправо — выполнить, влево — удалить. Удерживайте для массового выбора.
        </p>`,
      onMount(sheet, close) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-block';
        btn.style.marginTop = '16px';
        btn.textContent = 'Начать';
        btn.addEventListener('click', async () => {
          await window.PlannerDB.setSetting('onboardingDone', true);
          close();
        });
        sheet.querySelector('.modal-body').appendChild(btn);
      }
    });
  }

  /* ==================== Visibility change: refresh data ==================== */

  function setupVisibilityRefresh() {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return;
      // Обновляем данные при возврате на вкладку (если прошло > 5 мин)
      const last = Number(sessionStorage.getItem('lastVisibleRefresh') || 0);
      if (Date.now() - last > 5 * 60 * 1000) {
        sessionStorage.setItem('lastVisibleRefresh', String(Date.now()));
        await Promise.all([
          S.TaskService.loadAll(),
          S.NoteService.loadAll()
        ]);
        window.PlannerRouter.render();
      }
    });
  }

  /* ==================== Error boundary ==================== */

  window.addEventListener('error', (e) => {
    console.error('[global]', e.error || e.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    console.error('[unhandled rejection]', e.reason);
  });

  /* ==================== Расширение init (хук после части 1) ==================== */

  // Часть 1 объявляет init внутри IIFE — здесь добавляем пост-инициализацию
  // через событие готовности роутера.
  window.addEventListener('planner:ready', () => {
    setupOfflineIndicator();
    setupBulkMode();
    setupDragAndDrop();
    setupVisibilityRefresh();
    maybeAutoBackup();
    maybeOnboarding();
  });

  // Диспатчим событие после старта роутера (патчим start)
  const origStart = window.PlannerRouter.start.bind(window.PlannerRouter);
  window.PlannerRouter.start = function (...args) {
    origStart(...args);
    requestAnimationFrame(() =>
      window.dispatchEvent(new CustomEvent('planner:ready'))
    );
  };
})();
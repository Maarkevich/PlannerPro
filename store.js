/* ============================================================
   Planner Pro — Global state management  (v1.0.0)
   Кастомный store на Proxy + подписки (без зависимостей)
   ============================================================ */

(function () {
  'use strict';

  const listeners = new Map(); // key → Set<fn>

  const rawState = {
    // Navigation
    route: { view: 'dashboard', params: {} },

    // Data
    tasks: [],
    notes: [],
    projects: [],
    tags: [],

    // UI
    loading: true,
    selectedDate: null,          // Date (ISO string) for calendar/day views
    taskFilter: {
      tab: 'today',              // inbox | today | upcoming | someday
      projectId: null,
      priority: null,
      tag: null,
      search: ''
    },
    notesView: { search: '', mode: 'grid' },
    statsPeriod: 'week',         // today | week | month | quarter | year | all
    bulkSelection: new Set(),    // ids для массовых операций
    bulkMode: false,

    // Settings
    settings: {
      theme: 'ocean',            // ocean | sunset | forest | neon
      mode: 'light',             // light | dark
      language: 'ru'
    },

    // PWA
    installPromptEvent: null,
    isUpdateAvailable: false,
    online: navigator.onLine
  };

  const state = new Proxy(rawState, {
    set(target, prop, value) {
      const oldValue = target[prop];
      target[prop] = value;
      if (oldValue !== value) {
        emit(prop, value, oldValue);
        // Глобальное событие изменения любых данных
        if (['tasks', 'notes', 'projects', 'tags'].includes(prop)) {
          emit('data', prop);
        }
      }
      return true;
    }
  });

  function on(keyOrKeys, fn) {
    const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
    keys.forEach((k) => {
      if (!listeners.has(k)) listeners.set(k, new Set());
      listeners.get(k).add(fn);
    });
    return () => off(keys, fn); // unsubscribe
  }

  function off(keys, fn) {
    keys.forEach((k) => {
      const set = listeners.get(k);
      if (set) set.delete(fn);
    });
  }

  function emit(key, ...args) {
    const set = listeners.get(key);
    if (set) set.forEach((fn) => {
      try { fn(...args); } catch (err) { console.error('[store]', err); }
    });
  }

  /* ---------- Actions ---------- */

  function navigate(view, params = {}) {
    location.hash = buildHash(view, params);
  }

  function buildHash(view, params = {}) {
    let hash = `#/${view}`;
    const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
    if (entries.length) {
      hash += '?' + entries.map(([k, v]) =>
        `encodeURIComponent(k)={encodeURIComponent(k)}=encodeURIComponent(k)={encodeURIComponent(v)}`).join('&');
    }
    return hash;
  }

  function setState(patch) {
    Object.entries(patch).forEach(([k, v]) => { state[k] = v; });
  }

  function updateSettings(patch) {
    Object.assign(state.settings, patch);
    emit('settings', state.settings);
  }

  function toggleBulkMode(force) {
    state.bulkMode = force !== undefined ? force : !state.bulkMode;
    if (!state.bulkMode) state.bulkSelection.clear();
    emit('bulkMode', state.bulkMode);
  }

  function toggleBulkItem(id) {
    if (state.bulkSelection.has(id)) state.bulkSelection.delete(id);
    else state.bulkSelection.add(id);
    emit('bulkSelection');
  }

  /* ---------- Online/offline ---------- */
  window.addEventListener('online', () => { state.online = true; });
  window.addEventListener('offline', () => { state.online = false; });

  /* ---------- Public API ---------- */

  window.PlannerStore = {
    state,
    on,
    off,
    emit,
    navigate,
    buildHash,
    setState,
    updateSettings,
    toggleBulkMode,
    toggleBulkItem,
    get selectedIds() {
      return [...state.bulkSelection];
    }
  };
})();

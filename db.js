/* ============================================================
   Planner Pro — IndexedDB слой  (v1.0.0)
   Чистый IndexedDB без зависимостей
   БД: planner_db v1 — tasks, notes, projects, tags,
       settings, sync_meta, trash_meta
   ============================================================ */

(function () {
  'use strict';

  const DB_NAME = 'planner_db';
  const DB_VERSION = 1;

  const STORES = {
    TASKS: 'tasks',
    NOTES: 'notes',
    PROJECTS: 'projects',
    TAGS: 'tags',
    SETTINGS: 'settings',
    SYNC_META: 'sync_meta'
  };

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // ---- tasks ----
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const tasks = db.createObjectStore(STORES.TASKS, { keyPath: 'id' });
          tasks.createIndex('by_project', 'projectId');
          tasks.createIndex('by_dueDate', 'dueDate');
          tasks.createIndex('by_status', 'status');
          tasks.createIndex('by_priority', 'priority');
          tasks.createIndex('by_createdAt', 'createdAt');
        }

        // ---- notes ----
        if (!db.objectStoreNames.contains(STORES.NOTES)) {
          const notes = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
          notes.createIndex('by_project', 'projectId');
          notes.createIndex('by_isPinned', 'isPinned');
          notes.createIndex('by_createdAt', 'createdAt');
        }

        // ---- projects ----
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projects = db.createObjectStore(STORES.PROJECTS, { keyPath: 'id' });
          projects.createIndex('by_isArchived', 'isArchived');
        }

        // ---- tags ----
        if (!db.objectStoreNames.contains(STORES.TAGS)) {
          db.createObjectStore(STORES.TAGS, { keyPath: 'id' });
        }

        // ---- settings ----
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }

        // ---- sync_meta ----
        if (!db.objectStoreNames.contains(STORES.SYNC_META)) {
          db.createObjectStore(STORES.SYNC_META, { keyPath: 'key' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDB().then((db) =>
      db.transaction(storeName, mode).objectStore(storeName)
    );
  }

  function promisify(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /* ---------- Generic CRUD ---------- */

  async function put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return promisify(store.put(value));
  }

  async function get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return promisify(store.get(key));
  }

  async function getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return promisify(store.getAll());
  }

  async function remove(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return promisify(store.delete(key));
  }

  async function clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return promisify(store.clear());
  }

  async function bulkPut(storeName, values) {
    const store = await tx(storeName, 'readwrite');
    values.forEach((v) => store.put(v));
    return store.transaction.complete;
  }

  /* ---------- Index queries ---------- */

  async function getByIndex(storeName, indexName, value) {
    const store = await tx(storeName, 'readonly');
    return promisify(store.index(indexName).getAll(value));
  }

  /* ---------- Settings helpers ---------- */

  async function getSetting(key, defaultValue) {
    try {
      const row = await get(STORES.SETTINGS, key);
      return row ? row.value : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  async function setSetting(key, value) {
    return put(STORES.SETTINGS, { key, value });
  }

  /* ---------- Sync meta ---------- */

  async function getMeta(key) {
    const row = await get(STORES.SYNC_META, key);
    return row ? row.value : null;
  }

  async function setMeta(key, value) {
    return put(STORES.SYNC_META, { key, value });
  }

  /* ---------- Export / Import / Wipe ---------- */

  async function exportAll() {
    const [tasks, notes, projects, tags] = await Promise.all([
      getAll(STORES.TASKS),
      getAll(STORES.NOTES),
      getAll(STORES.PROJECTS),
      getAll(STORES.TAGS)
    ]);
    const settingsRows = await getAll(STORES.SETTINGS);
    const settings = {};
    settingsRows.forEach((r) => { settings[r.key] = r.value; });
    return { tasks, notes, projects, tags, settings };
  }

  async function importAll(data) {
    if (Array.isArray(data.tasks)) await bulkPut(STORES.TASKS, data.tasks);
    if (Array.isArray(data.notes)) await bulkPut(STORES.NOTES, data.notes);
    if (Array.isArray(data.projects)) await bulkPut(STORES.PROJECTS, data.projects);
    if (Array.isArray(data.tags)) await bulkPut(STORES.TAGS, data.tags);
    if (data.settings && typeof data.settings === 'object') {
      for (const [k, v] of Object.entries(data.settings)) {
        await setSetting(k, v);
      }
    }
  }

  async function wipeAll() {
    await Promise.all([
      clear(STORES.TASKS),
      clear(STORES.NOTES),
      clear(STORES.PROJECTS),
      clear(STORES.TAGS)
    ]);
  }

  // Auto-backup: keep last 5 exports in sync_meta
  async function createBackup() {
    const snapshot = await exportAll();
    const backups = (await getMeta('backups')) || [];
    backups.unshift({ at: Date.now(), data: snapshot });
    while (backups.length > 5) backups.pop();
    await setMeta('backups', backups);
    return snapshot;
  }

  /* ---------- Public API ---------- */

  window.PlannerDB = {
    STORES,
    ready: openDB,
    put, get, getAll, remove, clear, bulkPut,
    getByIndex,
    getSetting, setSetting,
    getMeta, setMeta,
    exportAll, importAll, wipeAll, createBackup
  };
})();

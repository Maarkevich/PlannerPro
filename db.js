const DB_NAME = 'planner-pro-db';
const DB_VERSION = 1;

const STORES = [
  'tasks',
  'notes',
  'projects',
  'settings'
];

let dbInstance = null;

/* =========================
   OPEN DB
========================= */

export async function openDatabase() {

  if (dbInstance) {
    return dbInstance;
  }

  return new Promise((resolve, reject) => {

    const request = indexedDB.open(
      DB_NAME,
      DB_VERSION
    );

    request.onupgradeneeded = (event) => {

      const db = event.target.result;

      STORES.forEach((storeName) => {

        if (!db.objectStoreNames.contains(storeName)) {

          const store = db.createObjectStore(
            storeName,
            {
              keyPath: 'id'
            }
          );

          store.createIndex(
            'createdAt',
            'createdAt'
          );

          store.createIndex(
            'updatedAt',
            'updatedAt'
          );

        }

      });

    };

    request.onsuccess = () => {

      dbInstance = request.result;

      resolve(dbInstance);

    };

    request.onerror = () => {
      reject(request.error);
    };

  });

}

/* =========================
   GENERIC
========================= */

async function getStore(
  storeName,
  mode = 'readonly'
) {

  const db = await openDatabase();

  return db
    .transaction(storeName, mode)
    .objectStore(storeName);

}

/* =========================
   GET ALL
========================= */

export async function getAll(storeName) {

  const store = await getStore(storeName);

  return new Promise((resolve, reject) => {

    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result || []);
    };

    request.onerror = () => {
      reject(request.error);
    };

  });

}

/* =========================
   GET ONE
========================= */

export async function getOne(
  storeName,
  id
) {

  const store = await getStore(storeName);

  return new Promise((resolve, reject) => {

    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = () => {
      reject(request.error);
    };

  });

}

/* =========================
   SAVE
========================= */

export async function saveItem(
  storeName,
  item
) {

  const store = await getStore(
    storeName,
    'readwrite'
  );

  const now = Date.now();

  const payload = {
    ...item,
    updatedAt: now
  };

  if (!payload.createdAt) {
    payload.createdAt = now;
  }

  return new Promise((resolve, reject) => {

    const request = store.put(payload);

    request.onsuccess = () => {
      resolve(payload);
    };

    request.onerror = () => {
      reject(request.error);
    };

  });

}

/* =========================
   DELETE
========================= */

export async function deleteItem(
  storeName,
  id
) {

  const store = await getStore(
    storeName,
    'readwrite'
  );

  return new Promise((resolve, reject) => {

    const request = store.delete(id);

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(request.error);
    };

  });

}

/* =========================
   CLEAR STORE
========================= */

export async function clearStore(
  storeName
) {

  const store = await getStore(
    storeName,
    'readwrite'
  );

  return new Promise((resolve, reject) => {

    const request = store.clear();

    request.onsuccess = () => {
      resolve(true);
    };

    request.onerror = () => {
      reject(request.error);
    };

  });

}

/* =========================
   SETTINGS
========================= */

export async function getSetting(key) {

  return getOne(
    'settings',
    key
  );

}

export async function setSetting(
  key,
  value
) {

  return saveItem(
    'settings',
    {
      id: key,
      value
    }
  );

}
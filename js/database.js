/* Bicara PECS IndexedDB layer — fase 2 */
(function () {
  'use strict';
  const DB_NAME = 'BicaraPECS_DB';
  const DB_VERSION = 1;
  const STORE = 'appData';
  const IMAGE_KEY = 'pecs_custom_images';
  let dbPromise;

  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('Browser tidak mendukung IndexedDB.'));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE, { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB.'));
      request.onblocked = () => reject(new Error('Database sedang digunakan tab lain. Tutup tab Bicara PECS lain lalu coba lagi.'));
    });
    return dbPromise;
  }

  async function get(key) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(key, value) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ key, value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Gagal menyimpan data.'));
      tx.onabort = () => reject(tx.error || new Error('Penyimpanan dibatalkan.'));
    });
  }

  async function remove(key) {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clear() {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function initialize() {
    const legacy = localStorage.getItem(IMAGE_KEY);
    let stored = await get(IMAGE_KEY);
    if (stored === undefined && legacy !== null) {
      // Salin dahulu, baca kembali untuk verifikasi, baru hapus salinan LocalStorage.
      await put(IMAGE_KEY, JSON.parse(legacy));
      stored = await get(IMAGE_KEY);
      if (JSON.stringify(stored) !== JSON.stringify(JSON.parse(legacy))) {
        throw new Error('Verifikasi migrasi gambar gagal. Data lama tetap dipertahankan.');
      }
      localStorage.removeItem(IMAGE_KEY);
    }
    return stored && typeof stored === 'object' ? stored : {};
  }

  async function saveImages(value) {
    await put(IMAGE_KEY, value || {});
    const verified = await get(IMAGE_KEY);
    if (JSON.stringify(verified) !== JSON.stringify(value || {})) throw new Error('Verifikasi penyimpanan gambar gagal.');
    // Hapus cache LocalStorage hanya setelah data tersimpan dan terverifikasi di IndexedDB.
    localStorage.removeItem(IMAGE_KEY);
    return true;
  }

  window.PecsDB = {
    initialize,
    saveImages,
    get,
    put,
    remove,
    clear,
    exportImages: () => get(IMAGE_KEY),
    importImages: value => put(IMAGE_KEY, value || {})
  };
})();

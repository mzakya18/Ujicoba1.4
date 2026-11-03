const CACHE_NAME = 'bicara-pecs-v23';
const APP_SHELL = ['./', './index.html', './manifest.json', './css/app.css', './js/database.js', './js/app.js', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // gambar ARASAAC tidak di-cache

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const res = await fetch(req);
      if (res.ok) await cache.put(req, res.clone());
      return res;
    } catch (err) {
      const cached = await cache.match(req);
      return cached || cache.match('./index.html');
    }
  })());
});

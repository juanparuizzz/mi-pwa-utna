const CACHE_NAME = 'cafeteria-utna-v1';
const APP_SHELL = [
  './',
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/app.js',
  'js/db.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network First para APIs (Supabase y Open-Meteo)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('open-meteo.com')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache First para App Shell
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
const CACHE = 'recipes-v16';
const FILES = ['./', './index.html', './app.js', './features.js', './character.js', './scenery.js', './boot.js', './data.js', './art.js', './style.css', './ghibli.css', './burton.css', './AmaticSC-Bold.ttf', './Neucha.ttf', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// сначала сеть (чтобы после обновления приложения сразу видеть новую версию), без интернета — из кэша
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});

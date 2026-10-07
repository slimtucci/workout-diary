/* SlimTucci Workout Diary service worker: offline app shell. Bump VERSION on every deploy. */
const VERSION = 'st-diary-v8';
const SHELL = [
  './', './index.html', './styles.css', './app.js', './config.js', './exercises-library.js', './macros-calc.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png', './icons/favicon-32.png'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Network-first for navigations and config.js (so updates and the WHOOP switch land), cache fallback offline. Cache-first for assets.
  if (new URL(req.url).pathname.endsWith('/config.js')) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./config.js', copy)); } return res; })
        .catch(() => caches.match('./config.js'))
    );
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }))
  );
});

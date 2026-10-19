/* IBRAZ service worker: instant app shell, offline fallback, last-known market data */
const VERSION = 'ibraz-v1';
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-192.png', '/icon-512.png', '/og-image.png'];
const DATA_HOSTS = ['data-api.binance.vision', 'open.er-api.com', 'api.alternative.me', 'mempool.space'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'ibraz-data' && k !== 'ibraz-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function networkFirst(req, cacheName){
  return fetch(req).then(res => {
    if(res && res.ok){ const copy = res.clone(); caches.open(cacheName).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, {ignoreSearch: false}).then(hit => hit || Promise.reject('offline')));
}

self.addEventListener('fetch', e => {
  const req = e.request; if(req.method !== 'GET') return;
  const url = new URL(req.url);
  // pages: always try the network for the newest version, fall back to the cached shell
  if(req.mode === 'navigate'){
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/index.html', copy)); return res; })
      .catch(() => caches.match('/index.html')));
    return;
  }
  // fonts: cache first
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(caches.open('ibraz-fonts').then(c => c.match(req).then(hit => hit || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  // market data: network first, last known copy when offline
  if(DATA_HOSTS.includes(url.hostname)){ e.respondWith(networkFirst(req, 'ibraz-data')); return; }
  // own static files: cache first
  if(url.origin === self.location.origin){
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
  }
});

// Service Worker: App funktioniert auch ohne Empfang am Bienenstand.
const CACHE = 'imkerei-v1';
const DATEIEN = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const eigen = url.origin === location.origin, leaflet = url.hostname === 'unpkg.com';
  if (e.request.method !== 'GET' || (!eigen && !leaflet)) return; // Wetter- und Kartendaten immer live
  // Netz zuerst (damit Updates ankommen), ohne Empfang aus dem Cache
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const kopie = r.clone(); caches.open(CACHE).then(c => c.put(e.request, kopie)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

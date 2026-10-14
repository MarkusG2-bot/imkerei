// Service Worker: App funktioniert auch ohne Empfang am Bienenstand und meldet fällige Arbeiten.
importScripts('fachlogik.js');
const CACHE = 'imkerei-v6';
const DATEIEN = ['./', 'index.html', 'style.css', 'fachlogik.js', 'zusatz.js', 'rechnung.js', 'verkauf.js', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'imkerei-status').map(k => caches.delete(k)))).then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Bibliotheken (Karte, PDF-Leser, Texterkennung samt Sprachdaten) nach dem ersten Laden auch offline
  const eigen = url.origin === location.origin, bibliothek = ['unpkg.com', 'cdn.jsdelivr.net', 'tessdata.projectnaptha.com'].includes(url.hostname);
  if (e.request.method !== 'GET' || (!eigen && !bibliothek)) return; // Wetter- und Kartendaten immer live
  // Netz zuerst (damit Updates ankommen), ohne Empfang aus dem Cache
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok) { const kopie = r.clone(); caches.open(CACHE).then(c => c.put(e.request, kopie)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// Hintergrundprüfung (nur installierte App unter Android/Chrome, Abstand bestimmt der Browser)
self.addEventListener('periodicsync', e => {
  if (e.tag === 'imkerei-check') e.waitUntil(benachrichtige(h => self.registration.showNotification(h.titel, meldungOptionen(h))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'link' && e.notification.data?.url) return e.waitUntil(self.clients.openWindow(e.notification.data.url));
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(cs => cs[0] ? cs[0].focus() : self.clients.openWindow('./')));
});

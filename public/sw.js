// Brackenwyrm als App: startet auch ohne Netz. Code, Bilder und Klänge mit Prüfwert im Namen werden
// beim ersten Laden gemerkt (sie ändern sich nie), die Startseite kommt immer zuerst frisch vom Netz.
// Der Server für Spielerkonten (anderer Ursprung) wird nicht angefasst.
const CACHE = 'brackenwyrm-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html', './manifest.webmanifest'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Startseite: Netz zuerst, sonst die gemerkte Fassung
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put('./index.html', copy));
      return res;
    }).catch(() => caches.match('./index.html').then((r) => r || caches.match('./'))));
    return;
  }
  // Alles andere: gemerkte Fassung zuerst, sonst laden und merken
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && (url.pathname.includes('/assets/') || url.pathname.includes('/audio/') || url.pathname.includes('/icons/'))) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  })));
});

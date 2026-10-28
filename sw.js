// Last Shift – Service Worker: Spiel offline startbar machen.
// pwa/bauen.py ersetzt 200 durch die Build-Nummer. Jeder neue Build ändert damit sw.js, der Browser
// installiert den neuen Worker, legt einen frischen Cache an und löscht den alten.
const BUILD = '200';
const CACHE = 'last-shift-' + BUILD;
const DESIGN = 'pixel-design.js?b=' + BUILD;   // genau die Adresse, die das Spiel nachlädt (43-pixel-design-start.js)
const FILES = ['./', DESIGN, 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.png'];

self.addEventListener('install', e => {
  // cache: 'reload' umgeht den HTTP-Cache (GitHub Pages: max-age 10 min), damit kein alter Stand im neuen Cache landet.
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('last-shift-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Nur eigene Dateien. Fremde Adressen (Supabase: Bestenliste, Konten, Koop; Schriften usw.) gehen ungefiltert
// übers Netz und landen nie im Cache.
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Versionsdatei (Spiel prüft damit auf Updates, 44-app-update.js): immer direkt übers Netz, nie aus dem Cache
  if (url.pathname.endsWith('/version.json')) return;

  // Pixel-Grafik (8,8 MB): Adresse enthält die Build-Nummer, also Cache zuerst.
  if (url.pathname.endsWith('/pixel-design.js')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok && url.search === '?b=' + BUILD) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }

  // Spiel-Seite und Rest: erst Netz (neue Builds kommen sofort an), offline aus dem Cache.
  const page = req.mode === 'navigate';
  e.respondWith(fetch(req, { cache: 'no-cache' }).then(res => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(page ? './' : req, copy)); }
    return res;
  }).catch(() => caches.match(page ? './' : req, { ignoreSearch: page }).then(hit => hit || Response.error())));
});

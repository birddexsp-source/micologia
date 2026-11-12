/* Service worker: la app funciona sin red. Sube V en cada publicación (si no, el móvil no recarga). */
const V = 'micologia-v9';
const SHELL = ['./', 'index.html', 'css/app.css', 'js/app.js', 'js/db.js', 'js/sync.js', 'js/geo.js', 'js/map.js', 'js/catalog.js', 'js/util.js', 'js/guia.js', 'js/ficha.js', 'js/temporada.js', 'js/track.js', 'js/libro.js', 'js/ia.js', 'js/audio.js', 'js/iconos.js',
  'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'data/especies.json', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png'];
const TILE_HOSTS = /(^|\.)ign\.es$|^tile\.openstreetmap\.org$/;
const TILES = 'tiles-v1', MAX_TILES = 1500;
const FOTO_HOST = /^upload\.wikimedia\.org$/, FOTOS = 'fotos-v1';

/* cache:'reload' salta la caché HTTP de GitHub Pages (10 min): si no, al instalar se podrían guardar archivos viejos mezclados con los nuevos */
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== V && k !== TILES && k.startsWith('micologia-')) await caches.delete(k);
    await self.clients.claim();
  })());
});
async function recortar(c) { const ks = await c.keys(); if (ks.length > MAX_TILES) await Promise.all(ks.slice(0, ks.length - MAX_TILES + 200).map(k => c.delete(k))); }
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'api.github.com') return;
  if (TILE_HOSTS.test(u.hostname)) {
    /* teselas: red primero; solo se guardan respuestas legibles (con CORS). Sin red, las que haya. */
    e.respondWith((async () => {
      const c = await caches.open(TILES);
      try { const res = await fetch(r); if (res && res.ok && res.type !== 'opaque') { c.put(r, res.clone()).then(() => recortar(c)).catch(() => { }); } return res; }
      catch (err) { return (await c.match(r)) || Response.error(); }
    })());
    return;
  }
  if (FOTO_HOST.test(u.hostname)) {
    /* fotos del catálogo (Wikimedia Commons): primero lo guardado; si no, red y se guarda si es legible (CORS) */
    e.respondWith((async () => {
      const c = await caches.open(FOTOS), hit = await c.match(r);
      if (hit) return hit;
      try { const res = await fetch(r); if (res && res.ok && res.type !== 'opaque') c.put(r, res.clone()).catch(() => { }); return res; }
      catch (err) { return Response.error(); }
    })());
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(V), hit = await c.match(r, { ignoreSearch: true });
    const net = fetch(r).then(res => { if (res && res.ok) c.put(r, res.clone()).catch(() => { }); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    const res = await net; if (res) return res;
    if (r.mode === 'navigate') return (await c.match('index.html')) || (await c.match('./')) || Response.error();
    return Response.error();
  })());
});

/* Service worker de Carrera de mentes (generado al compilar). */
const VERSION = "__VERSION__";
const BASE = "__BASE__";
const PRECACHE = __PRECACHE__;
const CACHE = "carrera-" + VERSION;
const FONTS = "carrera-fonts";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Fuentes de Google: de la caché si están, y se actualizan por detrás.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req, { ignoreVary: true });
        const net = fetch(req).then((r) => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
        return hit || net;
      }),
    );
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Páginas: primero red (para recibir actualizaciones), si no hay, la caché.
  // ignoreVary: algunos servidores mandan «Vary: Origin» y los scripts de tipo
  // módulo llevan cabecera Origin; sin esto no se encontrarían en la caché.
  const opts = { ignoreVary: true };
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(BASE, opts).then((r) => r || caches.match(req, opts))));
    return;
  }
  // Resto: caché primero.
  e.respondWith(caches.match(req, opts).then((hit) => hit || fetch(req)));
});

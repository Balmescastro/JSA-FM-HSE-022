/* ────────────────────────────────────────────────────────────────
   Service Worker — FM-HSE-022 · Etapa 2A (Consolidación Offline).
   Capa ADITIVA: provee disponibilidad offline mediante caché de los
   recursos estáticos y de configuración. NO toca lógica HSE, NO gestiona
   localStorage (RT-2A.5), NO intercepta operaciones de archivo de Backup
   (RT-2A.1: solo intercepta GET de mismo origen), NO contacta ningún
   origen remoto (RT-2A.8).

   Estrategia de actualización (corrección de caché obsoleta):
   Para los recursos propios de la app (mismo origen, GET) se usa
   NETWORK-FIRST: si hay red, se obtiene la versión actual y se refresca
   la caché; si no hay red, se sirve la copia cacheada (offline-first
   preservado). Esto garantiza que tras modificar app.js, styles.css o
   los JSON de config, una recarga normal (F5) obtenga los recursos
   nuevos SIN requerir hard-reload, borrar caché ni desinstalar el SW.

   El versionado de caché se conserva como mecanismo de limpieza, y
   skipWaiting + clients.claim aseguran que un SW nuevo tome control de
   inmediato.
   ──────────────────────────────────────────────────────────────── */
const CACHE_VERSION = 'fmhse022-v2';

// Conjunto completo de recursos críticos (RT-2A.2 — inventario exhaustivo).
const PRECACHE_URLS = [
  // Arranque
  './',
  './index.html',
  './app.js',
  './styles.css',
  // Configuración (Config.cargarTodo)
  './config/configuracion.json',
  './config/peligros.json',
  './config/controles.json',
  './config/matriz-peligro-control.json',
  './config/tipos-trabajo.json',
  // PDF (Print)
  './lib/jspdf.umd.min.js',
  './assets/arial-narrow.b64.txt',
  './assets/arial-narrow-bold.b64.txt',
  './assets/logo.b64.txt',
  './assets/logo.png',
  // Instalación
  './manifest.json',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

// Instalación: precaché del conjunto completo + activación inmediata.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activación: eliminar cachés de versiones anteriores + tomar control.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: NETWORK-FIRST para recursos propios (mismo origen, GET).
// - Con red: trae la versión actual y refresca la caché (F5 obtiene lo nuevo).
// - Sin red: sirve la copia cacheada (offline-first preservado).
// Peticiones no-GET o de otro origen pasan sin interceptar
// (RT-2A.1: no interferir con operaciones de archivo/Blob de Backup).
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // no interceptar no-GET
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // solo mismo origen

  event.respondWith(
    fetch(req)
      .then(resp => {
        // Red OK: refrescar la caché con la versión actual y devolverla.
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(req, copia));
        }
        return resp;
      })
      .catch(() =>
        // Sin red: servir desde caché (offline-first).
        caches.match(req).then(cached => cached || Response.error())
      )
  );
});

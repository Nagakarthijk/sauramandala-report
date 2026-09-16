const SHELL_CACHE = 'ws-shell-v3';
const TILE_CACHE = 'ws-tiles-v1';
const SHELL_FILES = ['./', './index.html', './style.css', './app.js', './ws-config.js', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then(c => c.addAll(SHELL_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== SHELL_CACHE && k !== TILE_CACHE).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Map tiles: cache-first so a walker who has panned/zoomed an area
  // before can still see it with no signal on the trail.
  if (url.hostname.endsWith('arcgisonline.com')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        try {
          const resp = await fetch(event.request);
          cache.put(event.request, resp.clone());
          return resp;
        } catch (e) {
          return cached || new Response('', { status: 504 });
        }
      })
    );
    return;
  }

  // App shell: cache-first, falling back to network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
});

// Receives a shared GPX/KML file (via the OS share sheet) and hands it
// to share.html, which loads it straight into the map.
let sharedFileCache = null;
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'POST' && url.pathname.endsWith('/share.html')) {
    event.respondWith((async () => {
      const formData = await event.request.formData();
      const file = formData.get('files');
      sharedFileCache = file || null;
      return Response.redirect('./share.html', 303);
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'get-shared-file' && sharedFileCache) {
    event.source.postMessage({ type: 'shared-file', file: sharedFileCache });
    sharedFileCache = null;
  }
});

// Tapping the "Recording" notification just brings the app to the front —
// it has no other job, the recording itself only runs in the open tab.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window' });
    if (clientsList.length) return clientsList[0].focus();
    return self.clients.openWindow('./index.html');
  })());
});

// OESN Service Worker — offline-first cache
// Cache name: bump version to force refresh on deploy
const CACHE_NAME = 'drive-v5';

// App shell: all pages and the data layer
const APP_SHELL = [
  './agent.html',
  './provider.html',
  './provider-apply.html',
  './programme.html',
  './oesn-data.js',
  './oesn-auth.js',
  './oesn-ai.js',
  './drive-config.js',
  './manifest.json'
];

// CDN resources: cache with stale-while-revalidate
const CDN_ORIGINS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

// ── Install: pre-cache app shell ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing OESN v1');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      // addAll will fail if any resource fails; catch individual failures gracefully
      return Promise.allSettled(
        APP_SHELL.map(url =>
          cache.add(url).catch(err => {
            console.warn('[SW] Failed to cache:', url, err.message);
          })
        )
      );
    }).then(() => {
      console.log('[SW] App shell cached');
      // Skip waiting so new SW activates immediately
      return self.skipWaiting();
    })
  );
});

// ── Activate: clean up old caches ────────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating OESN v1');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// ── Fetch: strategy depends on resource type ──────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip non-http(s) requests (chrome-extension etc.)
  if (!url.protocol.startsWith('http')) return;

  const isCDN = CDN_ORIGINS.some(origin => event.request.url.startsWith(origin));
  const isAppShell = APP_SHELL.some(path => url.pathname.endsWith(path.replace('./', '/')));

  if (isCDN) {
    // Stale-while-revalidate for CDN resources
    event.respondWith(staleWhileRevalidate(event.request));
  } else if (isAppShell || url.origin === self.location.origin) {
    // Cache-first for our own files
    event.respondWith(cacheFirst(event.request));
  }
  // Other origins: let browser handle normally (no interception)
});

// ── Cache strategies ──────────────────────────────────────────────────────────

/**
 * Cache-first: serve from cache, fall back to network and update cache.
 * Best for app shell files that change rarely.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    console.log('[SW] Cache hit:', request.url);
    return cached;
  }
  console.log('[SW] Cache miss, fetching:', request.url);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    console.warn('[SW] Network failed for:', request.url, err.message);
    // Return a minimal offline fallback for HTML pages
    if (request.headers.get('Accept')?.includes('text/html')) {
      return offlineFallback();
    }
    throw err;
  }
}

/**
 * Stale-while-revalidate: serve cached immediately, then update in background.
 * Best for CDN resources (Tailwind, Google Fonts) that change infrequently.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  // Kick off network fetch in background regardless
  const networkFetch = fetch(request).then(response => {
    if (response && response.ok) {
      console.log('[SW] SWR: updating cache for', request.url);
      cache.put(request, response.clone());
    }
    return response;
  }).catch(err => {
    console.warn('[SW] SWR: network failed for', request.url, err.message);
    return null;
  });

  if (cached) {
    console.log('[SW] SWR: serving stale for', request.url);
    return cached;
  }

  // No cached version — wait for network
  const response = await networkFetch;
  if (response) return response;

  // Network also failed with no cache
  throw new Error('[SW] No cache and network unavailable for: ' + request.url);
}

/**
 * Minimal offline fallback HTML shown when a page is requested offline
 * and not in cache yet.
 */
function offlineFallback() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OESN — Offline</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      background: #fafaf9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px 24px;
      text-align: center;
      max-width: 320px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.08);
    }
    .icon { font-size: 40px; margin-bottom: 12px; }
    h1 { font-size: 18px; font-weight: 600; color: #1c1917; margin: 0 0 8px; }
    p { font-size: 14px; color: #78716c; margin: 0 0 20px; line-height: 1.5; }
    a {
      display: inline-block;
      background: #f59e0b;
      color: #1c1917;
      font-weight: 600;
      font-size: 14px;
      padding: 10px 20px;
      border-radius: 10px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📶</div>
    <h1>You're offline</h1>
    <p>This page hasn't been cached yet. Open the app while online first, then it will work offline.</p>
    <a href="./oesn.html">Go to Home</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// ── Message handling ──────────────────────────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

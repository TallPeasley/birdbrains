/* Quark service worker: makes the site installable and keeps it opening when the
 * connection drops. Only this site's own files are cached. API calls, Firebase sign-in and
 * uploads go to other hosts and are never touched, so grading always hits the live API.
 *
 * - Pages: network first (a new deploy shows at once), cached copy or offline screen when offline.
 * - /_next/static and /icons: cache first (file names change with every build).
 * - Everything else from this site: served from cache, refreshed in the background.
 * Bump VERSION to drop every old cache on the next visit.
 */
const VERSION = 'v2'; // v2: Quark rename (new name and icons)
const PAGES = `bb-pages-${VERSION}`;
const ASSETS = `bb-assets-${VERSION}`;
const OFFLINE = '/offline.html';
const PRECACHE = ['/', OFFLINE, '/manifest.webmanifest', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];
const MAX_ASSETS = 200;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('bb-') && !k.endsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(request);
    if (res.ok && res.type === 'basic') cache.put(request, res.clone());
    return res;
  } catch {
    // A page opened before comes from cache; any other page shows the offline screen
    // (serving the home page's HTML at another address would break the app's routing).
    return (await cache.match(request, { ignoreSearch: true })) || (await cache.match(OFFLINE));
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok && res.type === 'basic') {
    cache.put(request, res.clone());
    trim(ASSETS, MAX_ASSETS);
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res.ok && res.type === 'basic') cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API, Firebase, Stripe: straight to the network
  if (url.pathname === '/sw.js') return;

  // Next.js page data (RSC payloads) must match the current build, so treat it like a page.
  if (request.mode === 'navigate' || url.searchParams.has('_rsc') || request.headers.get('RSC') === '1') {
    event.respondWith(networkFirstPage(request));
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

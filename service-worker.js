/* LMS Service Worker - PWA offline cache */
const CACHE_NAME = 'lms-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/store.js',
  '/js/i18n.js',
  '/js/components.js',
  '/js/ai-engine.js',
  '/js/firebase-backend.js',
  '/js/affiliate.js',
  '/js/calendar.js',
  '/js/integrations.js',
  '/js/sns-integrations.js',
  '/js/time-marketplace.js',
  '/js/assets-features.js',
  '/js/work-features.js',
  '/js/relationship-features.js',
  '/js/pages.js',
  '/js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for API calls, cache-first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') ||
      url.hostname.includes('workers.dev') || url.hostname.includes('anthropic') ||
      url.hostname.includes('openai')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || network;
    })
  );
});

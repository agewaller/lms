/* LMS Service Worker - Offline support & caching */
const CACHE = 'lms-v1';
const STATIC = [
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

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Pass through Firebase, AI API, and external CDN requests
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('openai') ||
    url.hostname.includes('workers.dev') ||
    url.hostname.includes('jsdelivr') ||
    url.hostname.includes('fonts.g')
  ) {
    return;
  }

  // Cache-first for same-origin static assets
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        }).catch(() => caches.match('/dashboard.html'));
      })
    );
  }
});

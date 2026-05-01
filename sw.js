/* LMS Service Worker - オフライン対応 */
const CACHE = 'lms-v2';
const PRECACHE = [
  '/dashboard.html',
  '/index.html',
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
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
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
  // Firebase / AI APIはキャッシュしない
  const url = e.request.url;
  if (url.includes('firestore') || url.includes('googleapis') ||
      url.includes('anthropic') || url.includes('openai') || url.includes('gstatic')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

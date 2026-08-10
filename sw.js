/* LMS Service Worker - offline shell cache */
const CACHE = 'lms-v3';
const SHELL = [
  './',
  './dashboard.html',
  './css/styles.css?v=13',
  './js/config.js?v=4',
  './js/store.js?v=2',
  './js/i18n.js?v=2',
  './js/components.js?v=6',
  './js/ai-engine.js?v=4',
  './js/firebase-backend.js?v=1',
  './js/affiliate.js?v=1',
  './js/calendar.js?v=1',
  './js/integrations.js?v=1',
  './js/sns-integrations.js?v=1',
  './js/time-marketplace.js?v=4',
  './js/assets-features.js?v=3',
  './js/work-features.js?v=4',
  './js/relationship-features.js?v=3',
  './js/pages.js?v=15',
  './js/app.js?v=13',
  './images/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for Firebase/API calls; cache-first for static assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isStatic = url.origin === location.origin &&
    (url.pathname.startsWith('/lms/css/') ||
     url.pathname.startsWith('/lms/js/') ||
     url.pathname.startsWith('/lms/images/'));

  if (isStatic) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
  // Let everything else (Firebase, AI APIs) fall through to network
});

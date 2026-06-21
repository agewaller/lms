/* LMS Service Worker — cache-first for static assets, network-first for API */
const CACHE = 'lms-v7';
const STATIC = [
  '/lms/',
  '/lms/dashboard.html',
  '/lms/css/styles.css',
  '/lms/js/config.js',
  '/lms/js/store.js',
  '/lms/js/i18n.js',
  '/lms/js/components.js',
  '/lms/js/ai-engine.js',
  '/lms/js/firebase-backend.js',
  '/lms/js/affiliate.js',
  '/lms/js/calendar.js',
  '/lms/js/integrations.js',
  '/lms/js/sns-integrations.js',
  '/lms/js/time-marketplace.js',
  '/lms/js/assets-features.js',
  '/lms/js/work-features.js',
  '/lms/js/relationship-features.js',
  '/lms/js/pages.js',
  '/lms/js/app.js',
  '/lms/icon.svg'
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

// Open the dashboard when user taps a notification
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const lmsWin = wins.find(w => w.url.includes('dashboard.html'));
      if (lmsWin) return lmsWin.focus();
      return clients.openWindow('/lms/dashboard.html');
    })
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always use network for Firebase, AI APIs, and external CDNs
  if (url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('anthropic') ||
      url.hostname.includes('openai') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('jsdelivr') ||
      url.hostname.includes('paypal') ||
      url.hostname.includes('workers.dev')) {
    return;
  }

  // Cache-first for local static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok && e.request.method === 'GET') {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return resp;
      });
    })
  );
});

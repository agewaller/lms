/* LMS Service Worker - PWA + Offline + Notifications */
const CACHE_NAME = 'lms-v1';
const STATIC_ASSETS = [
  '/',
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
  '/js/app.js',
  '/manifest.json'
];

// ─── Install: cache app shell ───
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// ─── Activate: clean old caches ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first for API, cache-first for assets ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET, cross-origin API calls (Firebase, CDN)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('anthropic') ||
      url.hostname.includes('workers.dev')) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});

// ─── Push Notifications ───
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'LMS からのお知らせ';
  const options = {
    body: data.body || '今日の記録を入力しましょう',
    icon: '/manifest.json',
    badge: '/manifest.json',
    tag: data.tag || 'lms-reminder',
    data: { url: data.url || '/dashboard.html' },
    actions: [
      { action: 'open', title: '記録する' },
      { action: 'dismiss', title: 'あとで' }
    ]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/dashboard.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find(c => c.url.includes('dashboard.html'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});

// ─── Background sync: retry failed saves ───
self.addEventListener('sync', (event) => {
  if (event.tag === 'lms-sync') {
    // Handled by app.js when back online
  }
});

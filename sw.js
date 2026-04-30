/* ============================================================
   LMS - Service Worker (PWA)
   キャッシュ戦略: Network First（データは常に最新を取得）
   静的アセットはキャッシュ優先で高速表示
   ============================================================ */

const CACHE_NAME = 'lms-v1';

// キャッシュするアセット（静的ファイルのみ）
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

// インストール時: 静的アセットをプリキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 一部でも失敗しても続行（addAll は全か無かなので個別に）
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// フェッチ: Network First (Firebase/AI呼び出しは常にネットワーク経由)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 外部リクエスト（Firebase, API等）はキャッシュしない
  if (url.origin !== location.origin) return;

  // HTMLはNetwork First（最新を取得、失敗時はキャッシュ）
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // JS/CSS: Cache First（高速表示）
  if (url.pathname.match(/\.(js|css|png|jpg|svg|ico|woff2?)(\?.*)?$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        });
      })
    );
  }
});

// プッシュ通知（オプション）
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'LMS', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard.html';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      const existing = list.find(c => c.url.includes('dashboard.html'));
      if (existing) { existing.focus(); return; }
      clients.openWindow(url);
    })
  );
});

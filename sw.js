/* LMS Service Worker - オフラインキャッシュ + 高速化 */
const CACHE_NAME = 'lms-v1';

// キャッシュするアセット（静的リソース）
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
  '/js/app.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Inter:wght@300;400;500;700&display=swap'
];

// インストール時にキャッシュを設定
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // 一部のファイルが失敗してもインストールは続行
      });
    })
  );
  self.skipWaiting();
});

// 古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// リクエスト処理: Network first, Cache fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Firebase / AI API は常にネットワーク
  if (
    url.hostname.includes('firebase') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('anthropic') ||
    url.hostname.includes('openai') ||
    url.hostname.includes('workers.dev')
  ) {
    return;
  }

  // GETリクエストのみキャッシュ
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 成功したらキャッシュを更新
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // ネットワーク失敗時はキャッシュから返す
        return caches.match(event.request);
      })
  );
});

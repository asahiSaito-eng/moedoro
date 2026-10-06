const CACHE_NAME = 'moedoro-pwa-v4';

// 事前キャッシュするローカルおよび外部主要アセット
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './style.css',
  './main.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './images/backgroud.jpeg',
  './images/1.png',
  './images/2.png',
  './images/4.png',
  './images/5.png',
  './images/6.png',
  './images/7.png',
  './images/8.png',
  './images/9.png',
  './images/10.png',
  './images/11.png',
  './images/12.png',
  './images/13.png',
  './images/14.png',
  './images/15.png',
  './images/16.png',
  './images/17.png',
  './images/18.png',
  './images/19.png',
  './images/20.png',
  './images/21.png',
  './images/22.png',
  './images/23.png',
  'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js'
];

// インストール時: アセットを事前キャッシュ
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[Service Worker] Failed to precache: ${url}`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log(`[Service Worker] Deleting old cache: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// フェッチ時: キャッシュ優先 (Cache-First) + ネットワーク取得 & 動的キャッシュ
self.addEventListener('fetch', (event) => {
  // GETリクエストのみ対象
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Chrome拡張機能などの特殊スキームを除外
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // バックグラウンドで更新チェック
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
          })
          .catch(() => {
            // オフライン時は何もしない
          });
        return cachedResponse;
      }

      // キャッシュにない場合はネットワークから取得し保存
      return fetch(event.request)
        .then((networkResponse) => {
          if (!networkResponse) return networkResponse;

          // 正常レスポンスまたは外部CDNのopaqueレスポンスをキャッシュ
          if (networkResponse.status === 200 || networkResponse.type === 'opaque') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }

          return networkResponse;
        })
        .catch(() => {
          // ナビゲーション（HTMLリクエスト）のフォールバック
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

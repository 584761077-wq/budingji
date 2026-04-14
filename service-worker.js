const CACHE_NAME = 'budingji-v24';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './chat_styles.css',
    './worldbook_styles.css',
    './script.js',
    './love_journal.js',
    './love_journal.css',
    './manifest.json',
    'https://unpkg.com/mammoth/mammoth.browser.min.js',
    'https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap'
];

// 安装 Service Worker 并缓存资源
self.addEventListener('install', (event) => {
    // 强制立即激活，跳过等待
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// 激活 Service Worker 并清理旧缓存
self.addEventListener('activate', (event) => {
    // 立即接管所有页面
    event.waitUntil(self.clients.claim());
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// 拦截网络请求
self.addEventListener('fetch', (event) => {
    // 对于 API 请求，直接走网络，不缓存
    if (event.request.url.includes('/chat/completions') || 
        event.request.url.includes('/v1/')) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 如果网络请求成功，克隆响应并更新缓存
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return response;
            })
            .catch(() => {
                // 如果网络失败（离线），则尝试从缓存读取
                return caches.match(event.request);
            })
    );
});

self.addEventListener('message', (event) => {
    const type = event?.data?.type || '';
    if (type === 'CHECK_CACHE') {
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const results = [];
            for (const url of ASSETS_TO_CACHE) {
                const match = await cache.match(new Request(url, { cache: 'reload' }));
                results.push({ url, cached: !!match });
            }
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ cacheName: CACHE_NAME, results });
            }
        })();
    } else if (type === 'FILL_MISSING') {
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            const missing = [];
            for (const url of ASSETS_TO_CACHE) {
                const match = await cache.match(new Request(url, { cache: 'reload' }));
                if (!match) missing.push(url);
            }
            if (missing.length > 0) {
                try {
                    await cache.addAll(missing);
                } catch (e) {}
            }
            if (event.ports && event.ports[0]) {
                event.ports[0].postMessage({ filled: missing.length });
            }
        })();
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = new URL(event.notification?.data?.url || './index.html', self.location.origin).href;
    event.waitUntil((async () => {
        const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of windowClients) {
            if ('focus' in client) {
                try {
                    if ('navigate' in client && client.url !== targetUrl) {
                        await client.navigate(targetUrl);
                    }
                } catch (error) {
                }
                await client.focus();
                return;
            }
        }
        if (clients.openWindow) {
            await clients.openWindow(targetUrl);
        }
    })());
});

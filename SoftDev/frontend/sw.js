const CACHE_NAME = 'kode-iot-v3';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/map.html',
    '/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(STATIC_ASSETS);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    // Claim any clients immediately, so they don't need a reload to be controlled by the new SW
    event.waitUntil(self.clients.claim());
    
    const cacheAllowlist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheAllowlist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// Fetch event - network-first for API, cache-first for static
self.addEventListener('fetch', event => {
    const isApiCall = event.request.url.includes('testing-production-3853.up.railway.app');

    if (isApiCall) {
        // Network-first for API calls
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Don't cache API responses here to keep data real-time,
                    // just return the fresh data.
                    return response;
                })
                .catch(() => {
                    // Optional: return cached API data if offline
                    return caches.match(event.request);
                })
        );
    } else {
        // Cache-first for static assets
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request);
                })
        );
    }
});
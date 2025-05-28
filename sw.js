// Memory Master Game - Service Worker
// Version 1.0.0

const CACHE_NAME = 'memory-master-v1.0.0';
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`;
const DYNAMIC_CACHE_NAME = `${CACHE_NAME}-dynamic`;

// Files to cache for offline functionality
const STATIC_FILES = [
    './',
    './index.html',
    './manifest.json',
    './assets/icons/icon-192x192.png',
    './assets/icons/icon-512x512.png',
    'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600;700&display=swap'
];

// Maximum number of items in dynamic cache
const DYNAMIC_CACHE_LIMIT = 15;

// Utility function to limit cache size
const limitCacheSize = (cacheName, size) => {
    caches.open(cacheName).then(cache => {
        cache.keys().then(keys => {
            if (keys.length > size) {
                cache.delete(keys[0]).then(() => limitCacheSize(cacheName, size));
            }
        });
    });
};

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[SW] Installing Service Worker...', event);
    
    event.waitUntil(
        caches.open(STATIC_CACHE_NAME)
            .then(cache => {
                console.log('[SW] Precaching static assets');
                return cache.addAll(STATIC_FILES);
            })
            .then(() => {
                console.log('[SW] Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[SW] Failed to cache static assets:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[SW] Activating Service Worker...', event);
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(cacheName => cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME)
                    .map(cacheName => {
                        console.log('[SW] Removing old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
            );
        }).then(() => {
            console.log('[SW] Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    // Skip chrome-extension and other non-http requests
    if (!event.request.url.startsWith('http')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cacheResponse => {
            if (cacheResponse) {
                console.log('[SW] Serving from cache:', event.request.url);
                return cacheResponse;
            }

            // Not in cache, fetch from network
            console.log('[SW] Fetching from network:', event.request.url);
            return fetch(event.request).then(networkResponse => {
                // Check if valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // Clone response for caching
                const responseToCache = networkResponse.clone();

                // Add to dynamic cache
                caches.open(DYNAMIC_CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                    limitCacheSize(DYNAMIC_CACHE_NAME, DYNAMIC_CACHE_LIMIT);
                });

                return networkResponse;
            }).catch(error => {
                console.error('[SW] Network fetch failed:', error);
                
                // Return offline page or default response
                if (event.request.destination === 'document') {
                    return caches.match('./index.html');
                }
                
                // For other resources, return a basic offline response
                return new Response('Offline - Content not available', {
                    status: 503,
                    statusText: 'Service Unavailable',
                    headers: new Headers({
                        'Content-Type': 'text/plain'
                    })
                });
            });
        })
    );
});

// Background sync for future features
self.addEventListener('sync', event => {
    console.log('[SW] Background sync:', event.tag);
    
    if (event.tag === 'background-sync') {
        event.waitUntil(
            // Add background sync logic here
            Promise.resolve()
        );
    }
});

// Push notification handler (for future features)
self.addEventListener('push', event => {
    console.log('[SW] Push message received:', event);
    
    const options = {
        body: event.data ? event.data.text() : 'New challenge available!',
        icon: './assets/icons/icon-192x192.png',
        badge: './assets/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: '1'
        },
        actions: [
            {
                action: 'play',
                title: 'Play Now',
                icon: './assets/icons/play-icon.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: './assets/icons/close-icon.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('Memory Master', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('[SW] Notification click received:', event);
    
    event.notification.close();

    if (event.action === 'play') {
        event.waitUntil(
            clients.openWindow('./')
        );
    }
});

// Message handler for communication with main thread
self.addEventListener('message', event => {
    console.log('[SW] Message received:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Error handler
self.addEventListener('error', event => {
    console.error('[SW] Service Worker error:', event.error);
});

// Unhandled rejection handler
self.addEventListener('unhandledrejection', event => {
    console.error('[SW] Unhandled promise rejection:', event.reason);
    event.preventDefault();
});

console.log('[SW] Service Worker script loaded successfully');
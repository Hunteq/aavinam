/**
 * ============================================================
 * Aavinam Service Worker — v2
 * ============================================================
 * Strategy: Cache-First for static assets, Network-First for
 * navigation/API. Offline fallback → /offline.html
 * Update flow: controlled — waits for user to click "Update Now"
 * before applying new SW (no forced reloads).
 * ============================================================
 */

const CACHE_VERSION = 'aavinam-v2';
const OFFLINE_URL = '/offline.html';

/**
 * Static shell assets to precache during SW install.
 * These are the minimal set needed for offline operation.
 * Vite-hashed JS/CSS files are cached at runtime on first visit.
 */
const PRECACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/offline.html',
    '/MilkLogo.png',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// ─── INSTALL ─────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    console.log('[SW] Installing — version:', CACHE_VERSION);

    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => {
            // Individually add each file so one failure doesn't block all
            const cachePromises = PRECACHE_ASSETS.map((url) =>
                cache.add(url).catch(() => {
                    console.warn('[SW] Failed to precache:', url, '(skipping)');
                })
            );
            return Promise.all(cachePromises);
        })
    );

    // Do NOT call skipWaiting() here — we wait for user action.
    // This prevents forced reloads during active sessions.
});

// ─── ACTIVATE ────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating — version:', CACHE_VERSION);

    event.waitUntil(
        // 1. Remove old caches from previous versions
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_VERSION) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            )
        ).then(() => {
            // 2. Take control of all open clients immediately
            return self.clients.claim();
        }).then(() => {
            // 3. Notify all clients that an update was applied
            //    (triggers UpdatePrompt component to show refresh banner)
            return self.clients.matchAll({ type: 'window' }).then((clients) => {
                clients.forEach((client) => {
                    client.postMessage({ type: 'SW_ACTIVATED' });
                });
            });
        })
    );
});

// ─── MESSAGE HANDLER ─────────────────────────────────────────
/**
 * Listen for SKIP_WAITING message from the app UI.
 * The UpdatePrompt component sends this when user clicks "Update Now".
 */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Received SKIP_WAITING — activating new SW');
        self.skipWaiting();
    }
});

// ─── FETCH ───────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET and browser-extension requests
    if (request.method !== 'GET') return;
    if (!request.url.startsWith('http')) return;

    // Skip Neon DB / API requests (always network-only)
    const url = new URL(request.url);
    if (
        url.hostname.endsWith('neon.tech') ||
        url.hostname.endsWith('neondb.net') ||
        url.pathname.startsWith('/api/')
    ) {
        return; // Let it fall through to network normally
    }

    event.respondWith(handleFetch(request));
});

async function handleFetch(request) {
    const url = new URL(request.url);

    // ── Strategy A: Navigation requests (HTML pages)
    // Network-First → fallback to cache → fallback to offline.html
    if (request.mode === 'navigate') {
        try {
            const networkResponse = await fetch(request);
            // Cache successful navigation responses
            if (networkResponse.ok) {
                const cache = await caches.open(CACHE_VERSION);
                cache.put(request, networkResponse.clone());
            }
            return networkResponse;
        } catch {
            // Network failed — try cache first
            const cachedResponse = await caches.match(request);
            if (cachedResponse) return cachedResponse;
            // Last resort: offline page
            return caches.match(OFFLINE_URL);
        }
    }

    // ── Strategy B: Static assets (JS, CSS, images, fonts)
    // Cache-First → fallback to network → cache the result
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_VERSION);
            // Cache JS, CSS, images, fonts — skip analytics/tracking
            const contentType = networkResponse.headers.get('content-type') || '';
            if (
                contentType.includes('javascript') ||
                contentType.includes('css') ||
                contentType.includes('image') ||
                contentType.includes('font') ||
                url.pathname.endsWith('.js') ||
                url.pathname.endsWith('.css') ||
                url.pathname.endsWith('.png') ||
                url.pathname.endsWith('.jpg') ||
                url.pathname.endsWith('.svg') ||
                url.pathname.endsWith('.woff') ||
                url.pathname.endsWith('.woff2')
            ) {
                cache.put(request, networkResponse.clone());
            }
        }
        return networkResponse;
    } catch {
        // Return null/undefined for non-critical failed assets
        return new Response('', { status: 408, statusText: 'Offline' });
    }
}

// ─── BACKGROUND SYNC ─────────────────────────────────────────
/**
 * Background Sync: retry pending milk entries when connectivity returns.
 * The sync tag 'sync-entries' is registered by the app when offline writes occur.
 */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-entries') {
        console.log('[SW] Background sync triggered: sync-entries');
        event.waitUntil(syncPendingEntries());
    }
});

async function syncPendingEntries() {
    // Stub: In production, read pending entries from IndexedDB (Dexie)
    // and POST them to the server. Dexie is already available in the app.
    console.log('[SW] sync-entries: stub — implement server sync here when needed');
}

// ─── PUSH NOTIFICATIONS ──────────────────────────────────────
self.addEventListener('push', (event) => {
    if (!event.data) return;

    const data = event.data.json();
    const options = {
        body: data.body || 'You have a new notification from Aavinam',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        vibrate: [200, 100, 200],
        data: { url: data.url || '/' },
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Aavinam', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/')
    );
});

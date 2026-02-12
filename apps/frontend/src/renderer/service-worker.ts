/**
 * Service Worker for Asset Caching
 *
 * This implements OPD-PERF-001: Service Worker for Caching
 * Provides offline capabilities and improved performance through asset caching.
 */

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = 'auto-claude-marketing-v1';
const RUNTIME_CACHE = 'runtime-cache';
const STATIC_CACHE = 'static-cache';

/**
 * Assets to cache on service worker install
 */
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/assets/',
  '/favicon.ico',
];

/**
 * Cache-first strategy for static assets
 */
async function cacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);

  if (cached) {
    return cached;
  }

  try {
    const network = await fetch(request);
    const response = network.clone();

    // Update cache with fresh response
    cache.put(request, response.clone());

    return network;
  } catch {
    // Network failed, try to return cached version
    return cached || new Response('Network error', { status: 503 });
  }
}

/**
 * Network-first strategy for API requests
 *
 * Tries network first, falls back to cache if offline.
 */
async function networkFirst(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  try {
    const network = await fetch(request);

    // Update cache if network succeeds
    cache.put(request, network.clone());

    return network;
  } catch {
    // Network failed, return cached version
    if (cached) {
      return cached;
    }

    throw new Error('Network unavailable and no cached version');
  }
}

/**
 * Stale-while-revalidate strategy for dynamic content
 *
 * Serves from cache immediately, then updates cache in background.
 */
async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  // Cache hit - return immediately
  if (cached) {
    // Fetch in background to update cache
    fetch(request).then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
    });

    return cached;
  }

  // Cache miss - fetch from network
  try {
    const network = await fetch(request);

    if (network && network.ok) {
      cache.put(request, network.clone());
    }

    return network;
  } catch {
    throw new Error('Network request failed');
  }
}

/**
 * Determine caching strategy based on request
 */
function getStrategy(request: Request): 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate' {
  const url = new URL(request.url);

  // Static assets - cache first
  if (url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/fonts/') ||
      url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/)) {
    return 'cacheFirst';
  }

  // API requests - network first
  if (url.pathname.startsWith('/api/')) {
    return 'networkFirst';
  }

  // HTML documents - stale while revalidate
  if (url.pathname.endsWith('.html')) {
    return 'staleWhileRevalidate';
  }

  // Default - network first
  return 'networkFirst';
}

/**
 * Fetch and apply caching strategy
 */
async function handleRequest(request: Request): Promise<Response> {
  const strategy = getStrategy(request);

  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request);
    case 'networkFirst':
      return networkFirst(request);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request);
    default:
      return fetch(request);
  }
}

/**
 * Delete old caches
 */
async function deleteOldCaches(): Promise<void> {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== STATIC_CACHE)
      .map((name) => caches.delete(name))
  );
}

/**
 * Activate service worker and clean up old caches
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await deleteOldCaches();

      // Claim clients to ensure new service worker is active immediately
      await self.clients.claim();
    })()
  );
});

/**
 * Install service worker and cache static assets
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);

      // Pre-cache critical assets
      const cacheRequests = PRECACHE_URLS.map((url) => new Request(url, { cache: 'reload-only' }));

      await Promise.all(
        cacheRequests.map((request) => cache.add(request))
      );

      console.log(`[ServiceWorker] Cached ${cacheRequests.length} assets`);
    })()
  );
});

/**
 * Handle fetch requests with caching strategies
 */
self.addEventListener('fetch', (event) => {
  event.respondWith(
    handleRequest(event.request).catch((error) => {
      console.error('[ServiceWorker] Fetch error:', error);
      return new Response('Service worker error', { status: 500 });
    })
  );
});

/**
 * Handle service worker messages
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  const { type, payload } = data;

  switch (type) {
    case 'SKIP_WAITING':
      // Force waiting service worker to become active
      self.skipWaiting();
      break;

    case 'CLEAR_CACHE':
      // Clear all caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      }).then(() => {
        // Notify sender that cache is cleared
        event.ports[0].postMessage({ type: 'CACHE_CLEARED' });
      });
      break;

    case 'GET_CACHE_SIZE':
      // Get cache size information
      caches.keys().then(async (cacheNames) => {
        let totalSize = 0;

        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();

          for (const key of keys) {
            const response = await cache.match(key);
            if (response) {
              const blob = await response.blob();
              totalSize += blob.size;
            }
          }
        }

        event.ports[0].postMessage({
          type: 'CACHE_SIZE',
          payload: {
            totalSize,
            formattedSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
          },
        });
      });
      break;

    default:
      console.warn('[ServiceWorker] Unknown message type:', type);
  }
});

/**
 * Background sync for offline support
 */
self.addEventListener('sync', (event) => {
  const { tag } = event;

  if (tag === 'sync-outbox') {
    event.waitUntil(
      // Sync offline operations
      (async () => {
        try {
          const response = await fetch('/api/sync-outbox');
          const data = await response.json();

          // Process offline changes
          console.log('[ServiceWorker] Syncing offline changes:', data);

          // Notify clients of sync completion
          const clients = await self.clients.matchAll();
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_COMPLETE',
              payload: data,
            });
          });
        } catch (error) {
          console.error('[ServiceWorker] Sync failed:', error);
        }
      })()
    );
  }
});

/**
 * Push notification handler
 */
self.addEventListener('push', (event) => {
  const options = event.data?.options || {};

  event.waitUntil(
    self.registration.showNotification(event.data?.title || 'Notification', {
      body: event.data?.body,
      icon: event.data?.icon,
      badge: event.data?.badge,
      tag: event.data?.tag,
      data: event.data?.data,
      ...options,
    })
  );
});

/**
 * Periodic cache cleanup (every 30 minutes)
 */
setInterval(() => {
  caches.open(STATIC_CACHE).then((cache) => {
    cache.keys().then((keys) => {
      if (keys.length > 100) {
        // Remove oldest 20 entries to keep cache size manageable
        keys.slice(0, 20).forEach((key) => cache.delete(key));
        console.log('[ServiceWorker] Cleaned up old cache entries');
      }
    });
  });
}, 30 * 60 * 1000); // 30 minutes

export {};

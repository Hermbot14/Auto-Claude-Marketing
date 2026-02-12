/**
 * Service Worker Registration
 *
 * This implements OPD-PERF-001: Service Worker for Caching
 * Registers the service worker and provides caching utilities.
 */

const SW_VERSION = '1.0.0';
const SW_URL = `/service-worker.js?v=${SW_VERSION}`;

let registration: ServiceWorkerRegistration | null = null;
let isOnline = navigator.onLine;

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.warn('[ServiceWorker] Service workers not supported');
    return;
  }

  try {
    registration = await navigator.serviceWorker.register(SW_URL, {
      scope: '/',
      updateViaCache: 'all',
    });

    console.log('[ServiceWorker] Registered successfully:', registration);

    // Listen for service worker updates
    registration.addEventListener('updatefound', (event) => {
      const newWorker = event.registration.installing;

      if (newWorker) {
        console.log('[ServiceWorker] New service worker found');

        newWorker.addEventListener('statechange', (stateEvent) => {
          if (stateEvent.target.state === 'installed' && navigator.serviceWorker) {
            // New worker is installed, reload to get latest version
            window.location.reload();
          }
        });
      }
    });

    // Listen for service worker activation
    registration.addEventListener('controllerchange', () => {
      console.log('[ServiceWorker] Service worker controller changed');
    });

    // Listen for online/offline status
    window.addEventListener('online', () => {
      if (!isOnline) {
        isOnline = true;
        console.log('[ServiceWorker] Connection restored');
        // Sync any pending changes
        navigator.serviceWorker.controller?.postMessage({
          type: 'SYNC_PENDING',
        });
      }
    });

    window.addEventListener('offline', () => {
      if (isOnline) {
        isOnline = false;
        console.log('[ServiceWorker] Connection lost');
      }
    });

  } catch (error) {
    console.error('[ServiceWorker] Registration failed:', error);
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (registration) {
    await registration.unregister();
    registration = null;
    console.log('[ServiceWorker] Unregistered');
  }

  /**
 * Get active service worker registration
   */
export function getServiceWorkerRegistration(): ServiceWorkerRegistration | null {
  return registration;
}

/**
 * Check if service worker is active
 */
export function isServiceWorkerActive(): boolean {
  return navigator.serviceWorker?.controller !== null;
}

/**
 * Send message to service worker
 */
export function sendMessageToSW(
  type: string,
  payload?: unknown
): void {
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type, payload });
  }
}

/**
 * Clear all caches
 */
export async function clearCaches(): Promise<void> {
  sendMessageToSW('CLEAR_CACHE');
}

/**
 * Get cache size information
 */
export function getCacheSize(): Promise<{ totalSize: number; formattedSize: string } | null> {
  return new Promise((resolve) => {
    const messageChannel = new MessageChannel();

    messageChannel.port1.onmessage = (event) => {
      resolve(event.data.payload);
    };

    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'GET_CACHE_SIZE',
      port: messageChannel.port2,
      }, [messageChannel.port2]);
    }

    // Timeout after 5 seconds
    setTimeout(() => resolve(null), 5000);
  });
}

/**
 * Skip waiting service worker and activate new one immediately
 */
export function skipWaiting(): void {
  sendMessageToSW('SKIP_WAITING');
}

/**
 * Request notifications permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show a local notification
 */
export function showNotification(
  title: string,
  options?: {
    body?: string;
    icon?: string;
    badge?: string;
    tag?: string;
    data?: unknown;
  }
): void {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/icon.png',
      badge: '1',
      ...options,
    });
  }
}

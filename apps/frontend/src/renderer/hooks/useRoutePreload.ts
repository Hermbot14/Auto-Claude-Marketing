/**
 * Route preloading hook for intelligent prefetch.
 *
 * This implements OPD-PERF-001 P1-1: Route preloading strategy.
 * Prefetches likely-next routes during idle time to improve navigation speed.
 */

import { useEffect, useRef } from 'react';
import type { LazyViewName, ROUTE_PRIORITIES, NEXT_ROUTE_SUGGESTIONS } from '../routes';

interface PreloadConfig {
  /** Current active route */
  currentRoute: LazyViewName | null;
  /** Whether preloading is enabled (respect user's data saver mode) */
  enabled?: boolean;
  /** Delay before first preload (ms) */
  initialDelay?: number;
  /** Delay between subsequent preloads (ms) */
  preloadDelay?: number;
  /** Maximum number of routes to preload */
  maxPreloads?: number;
}

/**
 * Load a lazy component's chunk
 */
function preloadView(component: () => Promise<unknown>): void {
  // Trigger the dynamic import to start chunk loading
  void component();
}

/**
 * Hook for intelligent route preloading
 *
 * Prefetches route chunks based on:
 * 1. Current route (using NEXT_ROUTE_SUGGESTIONS)
 * 2. Route priority (using ROUTE_PRIORITIES)
 * 3. User idle time (using requestIdleCallback)
 *
 * @example
 * ```tsx
 * useRoutePreload({
 *   currentRoute: activeView,
 *   enabled: !settings.dataSaverMode,
 * });
 * ```
 */
export function useRoutePreload({
  currentRoute,
  enabled = true,
  initialDelay = 2000,
  preloadDelay = 1000,
  maxPreloads = 3,
}: PreloadConfig): void {
  const preloadedRefs = useRef<Set<LazyViewName>>(new Set());
  const preloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || !currentRoute) {
      return;
    }

    // Clear any pending preload on route change
    if (preloadTimerRef.current) {
      clearTimeout(preloadTimerRef.current);
    }

    // Schedule preload after initial delay
    preloadTimerRef.current = setTimeout(() => {
      const suggestions = NEXT_ROUTE_SUGGESTIONS[currentRoute] || [];

      // Filter routes that haven't been preloaded yet
      const routesToPreload = suggestions
        .filter((route) => !preloadedRefs.current.has(route))
        .slice(0, maxPreloads);

      if (routesToPreload.length === 0) {
        return;
      }

      // Use requestIdleCallback for non-blocking preloading
      const preloadBatch = (deadline: IdleDeadline): void => {
        let index = 0;

        while (
          index < routesToPreload.length &&
          (deadline.timeRemaining() > 20 || deadline.didTimeout)
        ) {
          const route = routesToPreload[index];
          if (!preloadedRefs.current.has(route)) {
            // Import the component to trigger chunk loading
            import(`../routes/index.ts`).then(() => {
              preloadedRefs.current.add(route);
              console.debug(`[RoutePreload] Preloaded: ${route}`);
            });
          }
          index++;
        }

        // Schedule remaining routes if time ran out
        if (index < routesToPreload.length) {
          requestIdleCallback(() => preloadBatch, { timeout: 2000 });
        }
      };

      requestIdleCallback(() => preloadBatch, { timeout: 3000 });
    }, initialDelay);

    return () => {
      if (preloadTimerRef.current) {
        clearTimeout(preloadTimerRef.current);
      }
    };
  }, [currentRoute, enabled, initialDelay, maxPreloads]);
}

/**
 * Hook for priority-based route preloading
 *
 * Preloads routes based on their priority score, regardless of current route.
 * Useful for preloading critical routes on app initialization.
 *
 * @example
 * ```tsx
 * usePriorityPreload({
 *   minPriority: 80, // Preload high-priority routes only
 *   maxPreloads: 2,
 * });
 * ```
 */
export function usePriorityPreload({
  enabled = true,
  minPriority = 50,
  maxPreloads = 2,
}: {
  enabled?: boolean;
  minPriority?: number;
  maxPreloads?: number;
} = {}): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timeoutId = setTimeout(() => {
      requestIdleCallback((deadline) => {
        // Dynamically import the routes module to get LazyViews
        import('../routes/index.ts').then(({ LazyViews, ROUTE_PRIORITIES }) => {
          const routesToPreload = (Object.keys(ROUTES_PRIORITIES) as LazyViewName[])
            .filter((route) => ROUTE_PRIORITIES[route] >= minPriority)
            .sort((a, b) => ROUTE_PRIORITIES[b] - ROUTE_PRIORITIES[a])
            .slice(0, maxPreloads);

          routesToPreload.forEach((route, index) => {
            if (deadline.timeRemaining() > 20 || !deadline.didTimeout) {
              const component = LazyViews[route];
              preloadView(component as () => Promise<unknown>);
              console.debug(`[PriorityPreload] Preloaded: ${route} (${index + 1}/${routesToPreload.length})`);
            } else {
              // Schedule remaining routes for next idle period
              requestIdleCallback(() => {
                preloadView(component as () => Promise<unknown>);
                console.debug(`[PriorityPreload] Deferred: ${route}`);
              }, { timeout: 2000 });
            }
          });
        });
      }, { timeout: 3000 });
    }, 2000); // Start after 2 seconds

    return () => clearTimeout(timeoutId);
  }, [enabled, minPriority, maxPreloads]);
}

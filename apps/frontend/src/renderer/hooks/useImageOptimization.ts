/**
 * Image Optimization Hook
 *
 * This implements OPD-PERF-001 P1-2: Image Optimization Pipeline
 * Provides blur placeholder generation and image optimization utilities.
 */

import { useState, useCallback } from 'react';
import { OptimizedImage, ResponsiveImage, InlineImage } from '../components/images/OptimizedImage';

export interface UseBlurPlaceholderResult {
  blurDataUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Generate blur placeholder for an image
 *
 * Creates a low-quality base64 data URL for use as a loading placeholder.
 *
 * @param src - Image source URL
 * @param size - Size of the blur placeholder (default: 64px)
 * @param blur - Blur radius (default: 10)
 *
 * @example
 * ```tsx
 * const { blurDataUrl } = useBlurPlaceholder('/path/to/image.jpg');
 * return <img src={blurDataUrl} alt="" className="blur-placeholder" />;
 * ```
 */
export function useBlurPlaceholder(
  src?: string,
  size: number = 64,
  blur: number = 10
): UseBlurPlaceholderResult {
  const [result, setResult] = useState<UseBlurPlaceholderResult>({
    blurDataUrl: null,
    isLoading: !!src,
    error: null,
  });

  const generatePlaceholder = useCallback(async () => {
    if (!src) {
      setResult({ blurDataUrl: null, isLoading: false, error: null });
      return;
    }

    setResult({ blurDataUrl: null, isLoading: true, error: null });

    try {
      // Use canvas to generate blur placeholder
      const response = await fetch(src);
      const blob = await response.blob();

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          setResult({
            blurDataUrl: null,
            isLoading: false,
            error: new Error('Could not get canvas context'),
          });
          return;
        }

        // Calculate dimensions maintaining aspect ratio
        const scale = size / Math.max(img.width, img.height);
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);

        canvas.width = size;
        canvas.height = Math.round(size / (img.width / img.height));

        // Draw scaled image
        ctx.drawImage(img, 0, 0, width, height);

        // Apply blur
        ctx.filter = `blur(${blur}px)`;
        ctx.drawImage(canvas, 0, 0);

        // Export as low-quality data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);

        setResult({ blurDataUrl: dataUrl, isLoading: false, error: null });
      };

      img.onerror = () => {
        setResult({
          blurDataUrl: null,
          isLoading: false,
          error: new Error('Failed to load image'),
        });
      };

      img.src = URL.createObjectURL(blob);
    } catch (error) {
      setResult({
        blurDataUrl: null,
        isLoading: false,
        error: error instanceof Error ? error : new Error('Unknown error'),
      });
    }
  }, [src, size, blur]);

  // Auto-generate on mount and src change
  // In production, you'd want to pre-generate these at build time
  // This is mainly for development/dynamic images
  return result;
}

/**
 * Hook for managing critical images that should be inlined
 *
 * Critical images (above the fold) should be inlined as base64 to eliminate render-blocking requests.
 *
 * @param imageUrls - List of image URLs to inline
 */
export function useInlineImages(imageUrls: string[]) {
  const [inlinedImages, setInlinedImages] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const inlineImages = useCallback(async () => {
    setIsLoading(true);

    try {
      const results = await Promise.all(
        imageUrls.map(async (url) => {
          try {
            const response = await fetch(url);
            const blob = await response.blob();

            return new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
          } catch {
            return '';
          }
        })
      );

      const imageMap: Record<string, string> = {};
      imageUrls.forEach((url, index) => {
        imageMap[url] = results[index];
      });

      setInlinedImages(imageMap);
    } catch (error) {
      console.error('Failed to inline images:', error);
    } finally {
      setIsLoading(false);
    }
  }, [imageUrls]);

  return { inlinedImages, isLoading, inlineImages };
}

/**
 * Hook for progressive image loading
 *
 * Loads images in priority order: low-res first, then high-res.
 */
export function useProgressiveImage(src: string, widths: number[] = [320, 640, 1024, 1920]) {
  const [currentSrc, setCurrentSrc] = useState<string>(() => widths[0] ? src.replace(/\.\w+$/, `-${widths[0]}w`) : src);
  const [loadedWidths, setLoadedWidths] = useState<Set<number>>(new Set());

  const handleLoad = useCallback((width: number) => {
    setLoadedWidths((prev) => new Set([...prev, width]));

    // Load next highest resolution
    const nextWidth = widths.find((w) => !loadedWidths.has(w) && w > width);
    if (nextWidth) {
      setCurrentSrc(src.replace(/\.\w+$/, `-${nextWidth}w`));
    }
  }, [src, widths]);

  return {
    currentSrc,
    loadedWidths,
    handleLoad,
    isFullyLoaded: loadedWidths.size === widths.length,
  };
}

/**
 * Get the best image source for the current viewport
 *
 * Uses srcset to select the optimal image based on device pixel ratio and width.
 */
export function useBestSource(srcSet: string, sizes?: string): string {
  const [bestSource, setBestSource] = useState<string>('');

  const updateBestSource = useCallback(() => {
    if (!srcSet) {
      return;
    }

    // Parse srcset
    const sources = srcSet.split(', ').map((src) => {
      const [url, descriptor] = src.trim().split(' ');
      const width = parseInt(descriptor || '', 10);
      return { url, width };
    }).filter((s) => !isNaN(s.width));

    if (sources.length === 0) {
      return;
    }

    // Get container width (or viewport width as fallback)
    const containerWidth = window.innerWidth || 1920;

    // Calculate the optimal source
    const dpr = window.devicePixelRatio || 1;
    const optimalWidth = Math.ceil(containerWidth * dpr);

    // Find the smallest source that's >= optimalWidth
    const best = sources
      .filter((s) => s.width >= optimalWidth)
      .sort((a, b) => a.width - b.width)[0];

    // Fallback to largest source
    setBestSource(best?.url || sources[sources.length - 1].url);
  }, [srcSet, sizes]);

  useEffect(() => {
    updateBestSource();
  }, [updateBestSource]);

  // Recalculate on resize
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateBestSource, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateBestSource]);

  return bestSource;
}

/**
 * Hook for image preloading
 *
 * Preloads images during idle time for smoother navigation.
 */
export function useImagePreload(imageUrls: string[], priority: 'high' | 'low' = 'low') {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof requestIdleCallback === 'undefined') {
      return;
    }

    const timeoutId = setTimeout(() => {
      requestIdleCallback(
        (deadline) => {
          let index = 0;

          while (index < imageUrls.length && (deadline.timeRemaining() > 20 || deadline.didTimeout)) {
            const url = imageUrls[index];

            if (priority === 'high') {
              // Preload immediately in parallel
              const link = document.createElement('link');
              link.rel = 'preload';
              link.as = 'image';
              link.href = url;
              document.head.appendChild(link);
            } else {
              // Low priority: use Image object to prefetch
              const img = new Image();
              img.src = url;
            }

            index++;
          }

          console.debug(`[ImagePreload] Preloaded ${index}/${imageUrls.length} images`);
        },
        { timeout: 3000 }
      );
    }, priority === 'low' ? 2000 : 500);

    return () => clearTimeout(timeoutId);
  }, [imageUrls, priority]);
}

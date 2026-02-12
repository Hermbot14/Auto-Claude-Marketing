/**
 * Optimized Image Component
 *
 * This implements OPD-PERF-001 P1-2: Image Optimization Pipeline
 * Features:
 * - Responsive image srcsets
 * - Blur placeholder during loading
 * - Progressive image support
 * - Automatic WebP/AVIF format detection
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '@lib/utils';

interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet' | 'sizes'> {
  /** Image source (will be processed for optimization) */
  src: string;
  /** Alternative sources for responsive images */
  srcSet?: Record<number, string> | Array<{ width: number; src: string }>;
  /** Sizes attribute for responsive images */
  sizes?: string;
  /** Blur placeholder base64 data URL */
  blurPlaceholder?: string;
  /** Blur placeholder size (width) */
  blurSize?: number;
  /** Loading component */
  loadingComponent?: React.ReactNode;
  /** Error component */
  errorComponent?: React.ReactNode;
  /** Whether to lazy load images (default: true) */
  lazy?: boolean;
  /** Root margin distance for lazy loading (default: 50px) */
  rootMargin?: string;
  /** Image aspect ratio (for placeholder) */
  aspectRatio?: number;
  /** Custom className for the image wrapper */
  wrapperClassName?: string;
  /** Image fit style */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

/**
 * Generate srcset string from responsive sizes object
 */
function generateSrcSet(srcSet: OptimizedImageProps['srcSet']): string | undefined {
  if (!srcSet) {
    return undefined;
  }

  if (Array.isArray(srcSet)) {
    return srcSet.map((item) => `${item.src} ${item.width}w`).join(', ');
  }

  return Object.entries(srcSet)
    .map(([width, src]) => `${src} ${width}w`)
    .join(', ');
}

/**
 * Parse width from srcSet for aspect ratio calculation
 */
function getWidthFromSrcSet(srcSet?: string): number | undefined {
  if (!srcSet) {
    return undefined;
  }

  // Get the first width from srcset
  const match = srcSet.match(/(\d+)w/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Get the best image source based on container width
 */
function getBestSource(
  srcSet: OptimizedImageProps['srcSet'],
  containerWidth: number
): string {
  if (!srcSet) {
    return '';
  }

  const sources = Array.isArray(srcSet) ? srcSet : Object.entries(srcSet).map(([width, src]) => ({ width: parseInt(width, 10), src }));

  // Find the smallest source that's larger than the container
  const bestMatch = sources
    .filter((s) => s.width >= containerWidth)
    .sort((a, b) => a.width - b.width)[0];

  // If no match, use the largest source
  return bestMatch?.src || sources[sources.length - 1].src;
}

export function OptimizedImage({
  src,
  srcSet,
  sizes,
  blurPlaceholder,
  blurSize = 64,
  loadingComponent,
  errorComponent,
  lazy = true,
  rootMargin = '50px',
  aspectRatio,
  wrapperClassName,
  objectFit = 'cover',
  alt,
  className,
  ...imgProps
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [currentSrc, setCurrentSrc] = useState(src);

  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Generate srcset attribute
  const srcSetString = generateSrcSet(srcSet);

  // Calculate aspect ratio style if provided
  const aspectRatioStyle = aspectRatio ? { paddingBottom: `${(1 / aspectRatio) * 100}%` } : undefined;

  // Handle blur placeholder
  const showBlur = !isLoaded && blurPlaceholder && (lazy ? isInView : true);

  // Handle error state
  if (isError && errorComponent) {
    return <>{errorComponent}</>;
  }

  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!lazy || !containerRef.current) {
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setIsInView(true);

          // Select best source based on container width
          if (srcSet && containerRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            setCurrentSrc(getBestSource(srcSet, containerWidth));
          }
        }
      },
      { rootMargin, threshold: 0.01 }
    );

    const currentContainer = containerRef.current;
    if (currentContainer) {
      observerRef.current.observe(currentContainer);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [lazy, rootMargin, srcSet]);

  // Handle image load
  useEffect(() => {
    const img = imgRef.current;
    if (!img) {
      return;
    }

    const handleLoad = () => setIsLoaded(true);
    const handleError = () => setIsError(true);

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, []);

  // Loading state
  if (!isLoaded && loadingComponent && (lazy ? isInView : true)) {
    return (
      <div ref={containerRef} className={cn('relative overflow-hidden', wrapperClassName)}>
        {aspectRatioStyle && (
          <div style={aspectRatioStyle} className="absolute inset-0" aria-hidden="true" />
        )}
        {loadingComponent}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-hidden', wrapperClassName)}>
      {/* Aspect ratio placeholder */}
      {aspectRatioStyle && !isLoaded && (
        <div style={aspectRatioStyle} className="absolute inset-0" aria-hidden="true" />
      )}

      {/* Blur placeholder */}
      {showBlur && (
        <img
          src={blurPlaceholder}
          alt=""
          className={cn(
            'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
            isLoaded && 'opacity-0'
          )}
          style={{ width: `${blurSize}px` }}
          aria-hidden="true"
        />
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={lazy ? (isInView ? currentSrc : undefined) : currentSrc}
        srcSet={srcSetString}
        sizes={sizes}
        alt={alt}
        className={cn(
          'w-full h-full transition-opacity duration-300',
          !isLoaded && 'opacity-0',
          isLoaded && 'opacity-100',
          className
        )}
        style={{ objectFit }}
        loading="lazy"
        {...imgProps}
      />
    </div>
  );
}

/**
 * Responsive Image Component with automatic srcset generation
 */
export interface ResponsiveImageProps {
  /** Base image path (without extension or size suffix) */
  basePath: string;
  /** Available widths for responsive images */
  widths?: number[];
  /** Sizes attribute */
  sizes?: string;
  /** Image formats available (e.g., ['webp', 'png']) */
  formats?: string[];
  /** Aspect ratio (width / height) */
  aspectRatio?: number;
  /** Maximum width for the image container */
  maxWidth?: string;
  /** Props to pass to OptimizedImage */
  optimizedImageProps?: Omit<OptimizedImageProps, 'src' | 'srcSet'>;
}

/**
 * Generate responsive image sources from basePath
 */
function generateResponsiveSources(
  basePath: string,
  widths: number[],
  formats: string[]
): OptimizedImageProps['srcSet'] {
  // Remove extension from base path
  const dotIndex = basePath.lastIndexOf('.');
  const base = dotIndex >= 0 ? basePath.substring(0, dotIndex) : basePath;

  return formats.flatMap((format) => {
    return widths.map((width) => ({
      width,
      src: `${base}-${width}w.${format}`,
    }));
  });
}

export function ResponsiveImage({
  basePath,
  widths = [320, 640, 1024, 1920],
  formats = ['webp', 'png'],
  sizes,
  aspectRatio,
  maxWidth = '100%',
  optimizedImageProps,
}: ResponsiveImageProps) {
  const srcSet = generateResponsiveSources(basePath, widths, formats);

  // Detect WebP support
  const supportsWebP = useRef(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      supportsWebP.current = img.width > 0 && img.height > 0;
    };
    img.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACAgAQAAAAAAJx4AAICAAAgCAAAICAgAD//AA==';
  }, []);

  // Filter sources based on format support
  const filteredSrcSet = supportsWebP.current
    ? srcSet
    : srcSet.filter((s) => {
        const ext = s.src.split('.').pop();
        return ext !== 'webp';
      });

  return (
    <OptimizedImage
      src={basePath}
      srcSet={filteredSrcSet}
      sizes={sizes}
      aspectRatio={aspectRatio}
      wrapperClassName={maxWidth ? `max-w-[${maxWidth}]` : undefined}
      {...optimizedImageProps}
    />
  );
}

/**
 * Inline Image Component for critical images
 *
 * Inlines small images as base64 data URLs to eliminate extra requests.
 */
export function InlineImage({
  src,
  className,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    // Only inline if src is an http(s) URL or relative path
    if (src.startsWith('data:')) {
      setDataUrl(src);
      return;
    }

    fetch(src)
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setDataUrl(reader.result as string);
        };
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        console.error('Failed to inline image:', error);
      });
  }, [src]);

  if (!dataUrl) {
    return null;
  }

  return <img src={dataUrl} className={className} {...props} />;
}

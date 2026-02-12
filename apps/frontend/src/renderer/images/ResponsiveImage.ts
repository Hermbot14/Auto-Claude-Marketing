/**
 * Responsive Image Component
 *
 * This implements OPD-PERF-001 P1-2: Image Optimization Pipeline
 * Provides automatic srcset generation and format fallbacks.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as LucideImage } from 'lucide-react';
import { cn } from '@lib/utils';

interface ResponsiveImageProps {
  /** Image path without extension */
  src: string;
  /** Widths for responsive versions */
  widths?: number[];
  /** Sizes attribute */
  sizes?: string;
  /** Alt text */
  alt?: string;
  /** Aspect ratio (width / height) */
  aspectRatio?: number;
  /** Image fit */
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  /** Maximum width */
  maxWidth?: string;
  /** Container className */
  className?: string;
  /** Image className */
  imgClassName?: string;
  /** Lazy load */
  lazy?: boolean;
}

/**
 * Check browser support for WebP format
 */
function supportsWebP(): Promise<boolean> {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.decode ? () => resolve(true) : () => resolve(false);
    webP.onerror = () => resolve(false);
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACAgAQAAAAAAJx4AAIC4AABCAgICAAAAD//AA==';
  });
}

/**
 * Generate srcset from base path and widths
 */
function generateSrcSet(basePath: string, widths: number[], format: string): string {
  return widths
    .map((width) => `${basePath}-${width}w.${format} ${width}w`)
    .join(', ');
}

/**
 * Parse available formats from src
 */
function getImageFormats(src: string): { base: string; ext: string } {
  const match = src.match(/^(.+)(\.([^.]+))$/);
  if (!match) {
    return { base: src, ext: 'png' };
  }
  return { base: match[1], ext: match[2].toLowerCase() };
}

export function ResponsiveImage({
  src,
  widths = [320, 640, 1024, 1920],
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  alt = '',
  aspectRatio,
  objectFit = 'cover',
  maxWidth,
  className,
  imgClassName,
  lazy = true,
}: ResponsiveImageProps) {
  const { t } = useTranslation('common');
  const [supportsWebPFormat, setSupportsWebP] = useState<boolean | null>(null);
  const [imageError, setImageError] = useState(false);

  const { base, ext } = getImageFormats(src);

  useEffect(() => {
    supportsWebP().then(setSupportsWebP);
  }, []);

  // Determine which format to use
  const useFormat = supportsWebPFormat === null
    ? ext // Default format while checking
    : supportsWebPFormat
    ? 'webp'
    : ext;

  const srcSet = generateSrcSet(base, widths, useFormat);
  const fallbackSrc = `${base}.${ext}`; // Always have original as fallback

  return (
    <div className={cn('relative overflow-hidden', className)} style={{ maxWidth }}>
      {/* Placeholder while loading */}
      {lazy && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-muted',
            imageError && 'bg-destructive/10'
          )}
          style={{ paddingBottom: aspectRatio ? `${(1 / aspectRatio) * 100}%` : undefined }}
        >
          {imageError ? (
            <LucideImage className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          ) : (
            <div className="h-4 w-4 animate-pulse rounded-full bg-muted-foreground/20" />
          )}
        </div>
      )}

      {/* Main image */}
      <img
        srcSet={srcSet}
        sizes={sizes}
        src={fallbackSrc}
        alt={alt}
        className={cn(
          'w-full h-full transition-opacity duration-300',
          lazy && !supportsWebPFormat && 'opacity-0',
          lazy && supportsWebPFormat && 'opacity-100',
          imgClassName
        )}
        style={{
          objectFit,
          paddingBottom: aspectRatio && lazy ? `${(1 / aspectRatio) * 100}%` : undefined,
        }}
        loading={lazy ? 'lazy' : 'eager'}
        onError={() => setImageError(true)}
        onLoad={() => setImageError(false)}
      />

      {/* Format indicator for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-0 right-0 bg-black/70 text-white text-[10px] px-1 rounded-br">
          {useFormat === 'webp' ? 'WebP' : ext}
        </div>
      )}
    </div>
  );
}

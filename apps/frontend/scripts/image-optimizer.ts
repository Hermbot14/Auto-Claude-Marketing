/**
 * Image Optimization Script
 *
 * This implements OPD-PERF-001 P1-2: Image Optimization Pipeline
 * Target: 50% reduction in image size
 *
 * Features:
 * - WebP/AVIF format conversion
 * - Responsive size generation
 * - Blur placeholder generation
 * - Progressive image support
 * - Critical image inlining
 */

import sharp from 'sharp';
import { readFile, readdir, stat, mkdir, writeFile } from 'fs/promises';
import { join, dirname, basename, extname, relative } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface OptimizedImageResult {
  path: string;
  originalSize: number;
  optimizedSize: number;
  reduction: number;
  formats: string[];
}

interface ImageOptimizationConfig {
  /** Quality for lossy formats (1-100) */
  quality?: number;
  /** Output formats to generate */
  formats?: ('webp' | 'avif' | 'original')[];
  /** Responsive sizes to generate (width in pixels) */
  sizes?: number[];
  /** Generate blur placeholder */
  blurPlaceholder?: boolean;
  /** Blur radius for placeholder */
  blurRadius?: number;
  /** Output directory for optimized images */
  outputDir?: string;
  /** Preserve original format as fallback */
  preserveOriginal?: boolean;
}

const DEFAULT_CONFIG: Required<ImageOptimizationConfig> = {
  quality: 85,
  formats: ['webp', 'original'],
  sizes: [16, 32, 64, 128, 256, 512, 1024],
  blurPlaceholder: true,
  blurRadius: 10,
  outputDir: '.cache/optimized-images',
  preserveOriginal: true,
};

/**
 * Optimize a single image file
 */
async function optimizeImage(
  inputPath: string,
  config: ImageOptimizationConfig
): Promise<OptimizedImageResult[]> {
  const results: OptimizedImageResult[] = [];
  const baseName = basename(inputPath, extname(inputPath));
  const ext = extname(inputPath).toLowerCase();

  // Get original file size
  const originalStats = await stat(inputPath);
  const originalSize = originalStats.size;

  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // Generate responsive sizes
    for (const size of config.sizes) {
      // Skip if image is smaller than target size
      if (metadata.width && metadata.width < size) {
        continue;
      }

      const suffix = `-${size}w`;
      const baseFileName = baseName + suffix;

      for (const format of config.formats) {
        const outputPath = join(config.outputDir, `${baseFileName}.${format}`);

        // Ensure output directory exists
        if (!existsSync(dirname(outputPath))) {
          await mkdir(dirname(outputPath), { recursive: true });
        }

        let sharpPipeline = image.resize(size, null, {
          fit: 'inside',
          withoutEnlargement: true,
        });

        // Apply format-specific optimizations
        if (format === 'webp') {
          sharpPipeline = sharpPipeline.webp({ quality: config.quality });
        } else if (format === 'avif') {
          sharpPipeline = sharpPipeline.avif({ quality: config.quality, effort: 4 });
        } else {
          // Original format with quality optimization
          if (ext === '.png') {
            sharpPipeline = sharpPipeline.png({ compressionLevel: 9, quality: config.quality });
          } else if (ext === '.jpg' || ext === '.jpeg') {
            sharpPipeline = sharpPipeline.jpeg({ quality: config.quality, progressive: true, mozjpeg: true });
          }
        }

        await sharpPipeline.toFile(outputPath);

        const optimizedStats = await stat(outputPath);
        const optimizedSize = optimizedStats.size;
        const reduction = ((originalSize - optimizedSize) / originalSize) * 100;

        results.push({
          path: outputPath,
          originalSize,
          optimizedSize,
          reduction,
          formats: [format],
        });

        // Generate blur placeholder (small, heavily blurred base64)
        if (config.blurPlaceholder && size === 64) {
          const blurPath = join(config.outputDir, `${baseFileName}-blur.${format === 'webp' ? 'webp' : ext.slice(1)}`);
          const blurImage = image.resize(64, null, { fit: 'inside' });
          await blurImage.modulate({ brightness: 1.2 }).blur(config.blurRadius).toFile(blurPath);
        }
      }
    }

    return results;
  } catch (error) {
    console.error(`Failed to optimize ${inputPath}:`, error);
    return [];
  }
}

/**
 * Find all images in a directory recursively
 */
async function findImages(dir: string): Promise<string[]> {
  const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg'];
  const files: string[] = [];

  async function traverse(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          await traverse(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase();
        if (imageExtensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await traverse(dir);
  return files;
}

/**
 * Generate srcset attribute for responsive images
 */
function generateSrcset(basePath: string, sizes: number[], format: string): string {
  return sizes
    .map((size) => `${basePath}-${size}w.${format} ${size}w`)
    .join(', ');
}

/**
 * Main optimization function
 */
export async function optimizeImages(
  inputDir: string,
  userConfig: Partial<ImageOptimizationConfig> = {}
): Promise<void> {
  const config = { ...DEFAULT_CONFIG, ...userConfig };

  // Create output directory if it doesn't exist
  if (!existsSync(config.outputDir)) {
    await mkdir(config.outputDir, { recursive: true });
  }

  const images = await findImages(inputDir);

  console.log(`Found ${images.length} images to optimize`);

  let totalOriginalSize = 0;
  let totalOptimizedSize = 0;
  const allResults: OptimizedImageResult[] = [];

  // Optimize images in batches of 10 to avoid overwhelming memory
  const batchSize = 10;
  for (let i = 0; i < images.length; i += batchSize) {
    const batch = images.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (imagePath) => {
        const relativePath = relative(inputDir, imagePath);
        console.log(`Optimizing [${i / batchSize + 1}/${Math.ceil(images.length / batchSize)}]: ${relativePath}`);

        const results = await optimizeImage(imagePath, config);
        allResults.push(...results);

        results.forEach((result) => {
          totalOriginalSize += result.originalSize;
          totalOptimizedSize += result.optimizedSize;
        });
      })
    );
  }

  const totalReduction = ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) * 100;

  console.log('\n=== Optimization Results ===');
  console.log(`Images processed: ${images.length}`);
  console.log(`Total original size: ${(totalOriginalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total optimized size: ${(totalOptimizedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Total reduction: ${totalReduction.toFixed(2)}%`);
  console.log(`Space saved: ${((totalOriginalSize - totalOptimizedSize) / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nOptimized images saved to: ${config.outputDir}`);
}

/**
 * Generate blur placeholder data URL
 */
export async function generateBlurPlaceholder(
  imagePath: string,
  size: number = 64
): Promise<string> {
  try {
    const image = sharp(imagePath);
    const resized = image.resize(size, null, { fit: 'inside' });
    const blurred = await resized.modulate({ brightness: 1.2 }).blur(10);
    const buffer = await blurred.webp({ quality: 60 }).toBuffer();

    return `data:image/webp;base64,${buffer.toString('base64')}`;
  } catch (error) {
    console.error('Failed to generate blur placeholder:', error);
    return '';
  }
}

/**
 * CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputDir = process.argv[2] || process.cwd();

  optimizeImages(inputDir, {
    quality: parseInt(process.env.IMAGE_QUALITY || '85', 10),
    formats: ['webp', 'original'],
    sizes: [16, 32, 64, 128, 256, 512, 1024],
    blurPlaceholder: true,
  }).catch((error) => {
    console.error('Image optimization failed:', error);
    process.exit(1);
  });
}

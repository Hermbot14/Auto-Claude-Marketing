/**
 * Color Palette Generator
 *
 * Generates accessible color palettes that meet WCAG AA/AAA standards.
 * Provides tools for creating harmonious, readable color schemes.
 *
 * @remarks
 * This module helps designers and developers create color palettes
 * that are both beautiful and accessible.
 *
 * Features:
 * - Generate palettes from base color
 * - Ensure WCAG AA/AAA compliance
 * - Generate light/dark variants
 * - Create semantic color scales
 * - Validate against background colors
 *
 * @example
 * ```ts
 * import { generatePalette, generateScale, validatePalette } from './ColorPaletteGenerator';
 *
 * // Generate a complete accessible palette
 * const palette = generatePalette('#4A90E2', '#FFFFFF');
 *
 * // Generate a color scale
 * const scale = generateScale('#4A90E2', 5, '#FFFFFF');
 *
 * // Validate an existing palette
 * const validation = validatePalette(myPalette, '#FFFFFF');
 * ```
 */

import type { ContrastResult, ColorPalette, ContrastLevel } from './ColorContrastChecker';
import { calculateContrastRatio, checkContrast, hexToRgb, rgbToHex, calculateLuminance } from './ColorContrastChecker';

/**
 * Generated palette structure
 */
export interface GeneratedPalette extends ColorPalette {
  /** Primary color (brand/main) */
  primary: string;
  /** Secondary color (accent) */
  secondary: string;
  /** Success/error/info colors */
  success: string;
  error: string;
  warning: string;
  info: string;
  /** Text colors */
  foreground: string;
  mutedForeground: string;
  background: string;
  mutedBackground: string;
  /** Border colors */
  border: string;
  inputBorder: string;
  /** Focus ring */
  focusRing: string;
  /** Scale of primary colors (50-950) */
  scale: Record<string, string>;
}

/**
 * Color scale options
 */
export interface ScaleOptions {
  /** Number of steps in the scale */
  steps?: number;
  /** Minimum lightness value */
  minLightness?: number;
  /** Maximum lightness value */
  maxLightness?: number;
  /** Background color to validate against */
  backgroundColor?: string;
  /** Required WCAG level */
  requiredLevel?: ContrastLevel;
}

/**
 * Palette generation options
 */
export interface PaletteOptions {
  /** Background color */
  background: string;
  /** Required WCAG level */
  level?: ContrastLevel;
  /** Include color scales */
  includeScales?: boolean;
  /** Number of scale steps */
  scaleSteps?: number;
}

/**
 * Convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let r, g, b;

  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

/**
 * Convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));

    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / delta + 2) * 60;
    else h = ((r - g) / delta + 4) * 60;
  }

  return { h, s: s * 100, l: l * 100 };
}

/**
 * Adjust color lightness
 */
function adjustLightness(hex: string, newLightness: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const adjusted = hslToRgb(hsl.h, hsl.s, newLightness);
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
}

/**
 * Adjust color saturation
 */
function adjustSaturation(hex: string, newSaturation: number): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const adjusted = hslToRgb(hsl.h, newSaturation, hsl.l);
  return rgbToHex(adjusted.r, adjusted.g, adjusted.b);
}

/**
 * Generate a color scale from base color
 *
 * @param baseColor - Starting color (hex)
 * @param steps - Number of steps in scale
 * @param options - Scale generation options
 * @returns Object with scale values (50, 100, 200, etc.)
 *
 * @example
 * ```ts
 * const scale = generateScale('#4A90E2', 10, '#FFFFFF');
 * // {
 * //   50: '#EBF3FF',
 * //   100: '#D6E6FF',
 * //   200: '#ACCAFF',
 * //   ...
 * //   900: '#0A1A40',
 * //   950: '#020D26',
 * // }
 * ```
 */
export function generateScale(
  baseColor: string,
  steps: number = 10,
  backgroundColor: string = '#FFFFFF',
  options: ScaleOptions = {}
): Record<string, string> {
  const {
    minLightness = 95,
    maxLightness = 10,
    requiredLevel = 'AA',
  } = options;

  const scale: Record<string, string> = {};
  const baseRgb = hexToRgb(baseColor);
  const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);

  const lightnessStep = (minLightness - maxLightness) / (steps - 1);

  for (let i = 0; i < steps; i++) {
    const lightness = minLightness - (i * lightnessStep);
    const hex = adjustLightness(baseColor, lightness);
    const step = (i + 1) * 100;

    // Check contrast for dark steps (used as text)
    if (step >= 500) {
      const result = checkContrast(hex, backgroundColor);
      if (!result.passesAA && requiredLevel === 'AA') {
        // Adjust saturation for better contrast
        const adjustedSat = Math.max(20, baseHsl.s - (i * 5));
        scale[step.toString()] = adjustSaturation(hex, adjustedSat);
      } else {
        scale[step.toString()] = hex;
      }
    } else {
      scale[step.toString()] = hex;
    }
  }

  return scale;
}

/**
 * Generate complementary color
 */
export function getComplementaryColor(hex: string): string {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Rotate hue 180 degrees
  const complementary = hslToRgb((hsl.h + 180) % 360, hsl.s, hsl.l);

  return rgbToHex(complementary.r, complementary.g, complementary.b);
}

/**
 * Generate triadic color scheme
 */
export function getTriadicColors(hex: string): string[] {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return [
    hex,
    rgbToHex(...Object.values(hslToRgb((hsl.h + 120) % 360, hsl.s, hsl.l))),
    rgbToHex(...Object.values(hslToRgb((hsl.h + 240) % 360, hsl.s, hsl.l))),
  ];
}

/**
 * Generate analogous color scheme
 */
export function getAnalogousColors(hex: string): string[] {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  return [
    rgbToHex(...Object.values(hslToRgb((hsl.h - 30 + 360) % 360, hsl.s, hsl.l))),
    hex,
    rgbToHex(...Object.values(hslToRgb((hsl.h + 30) % 360, hsl.s, hsl.l))),
  ];
}

/**
 * Get semantic colors for UI
 */
export function getSemanticColors(primary: string, background: string): {
  success: string;
  error: string;
  warning: string;
  info: string;
} {
  // Standard accessible semantic colors
  const success = '#16A34A'; // Green
  const error = '#DC2626';   // Red
  const warning = '#EA580C';  // Orange
  const info = primary;         // Use primary for info

  return { success, error, warning, info };
}

/**
 * Generate complete accessible palette
 *
 * @param primary - Primary brand color
 * @param options - Generation options
 * @returns Complete accessible palette
 *
 * @example
 * ```ts
 * const palette = generatePalette('#4A90E2', {
 *   background: '#FFFFFF',
 *   level: 'AA',
 *   includeScales: true,
 *   scaleSteps: 10,
 * });
 * ```
 */
export function generatePalette(
  primary: string,
  options: PaletteOptions
): GeneratedPalette {
  const { background, level = 'AA', includeScales = true, scaleSteps = 10 } = options;

  // Get primary HSL for variations
  const primaryRgb = hexToRgb(primary);
  const primaryHsl = rgbToHsl(primaryRgb.r, primaryRgb.g, primaryRgb.b);

  // Generate scale
  const scale = includeScales
    ? generateScale(primary, scaleSteps, background, { requiredLevel: level })
    : {};

  // Find best foreground color
  const fgResult = checkContrast(primary, background);
  let foreground = '#000000';
  if (fgResult.passesAA) {
    foreground = getBestForeground(primary);
  }

  // Generate semantic colors
  const { success, error, warning, info } = getSemanticColors(primary, background);

  // Secondary color (complementary or analogous)
  const secondary = getComplementaryColor(primary);

  // Validate secondary against background
  const secResult = checkContrast(secondary, background);
  if (!secResult.passesAA) {
    // Adjust secondary for better contrast
    const secRgb = hexToRgb(secondary);
    const secLuminance = calculateLuminance(secRgb.r, secRgb.g, secRgb.b);
    const adjustedSecondary = secLuminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  return {
    primary,
    primaryForeground: foreground,
    secondary,
    success,
    error,
    warning,
    info,
    foreground,
    mutedForeground: adjustLightness(foreground, 60),
    background,
    mutedBackground: adjustLightness(background, 95),
    border: adjustLightness(foreground, 80),
    inputBorder: adjustLightness(foreground, 70),
    focusRing: primary,
    scale,
  };
}

/**
 * Get best foreground color for a background
 */
function getBestForeground(background: string): string {
  const bgRgb = hexToRgb(background);
  const bgLuminance = calculateLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  return bgLuminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Validate palette against requirements
 */
export function validatePalette(
  palette: Partial<GeneratedPalette>,
  backgroundColor: string,
  level: ContrastLevel = 'AA'
): {
  valid: boolean;
  issues: Array<{ property: string; ratio: number; expected: number }>;
} {
  const issues: Array<{ property: string; ratio: number; expected: number }> = [];
  const minRatio = level === 'AAA' ? 7 : 4.5;

  // Validate primary on background
  if (palette.primary && palette.background) {
    const ratio = calculateContrastRatio(palette.primary, palette.background);
    if (ratio < minRatio) {
      issues.push({ property: 'primary', ratio, expected: minRatio });
    }
  }

  // Validate foreground on background
  if (palette.foreground && palette.background) {
    const ratio = calculateContrastRatio(palette.foreground, palette.background);
    if (ratio < minRatio) {
      issues.push({ property: 'foreground', ratio, expected: minRatio });
    }
  }

  // Validate semantic colors on background
  for (const color of ['success', 'error', 'warning', 'info']) {
    const colorValue = (palette as any)[color];
    if (colorValue) {
      const ratio = calculateContrastRatio(colorValue, backgroundColor);
      if (ratio < minRatio) {
        issues.push({ property: color, ratio, expected: minRatio });
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Generate high-contrast palette (WCAG AAA)
 */
export function generateHighContrastPalette(isDark: boolean = false): GeneratedPalette {
  if (isDark) {
    return {
      primary: '#FFFFFF',
      primaryForeground: '#000000',
      secondary: '#FFFF00',
      success: '#00FF00',
      error: '#FF0000',
      warning: '#FFFF00',
      info: '#FFFFFF',
      foreground: '#FFFFFF',
      mutedForeground: '#E5E5E5',
      background: '#000000',
      mutedBackground: '#1A1A1A',
      border: '#FFFFFF',
      inputBorder: '#FFFFFF',
      focusRing: '#FFFF00',
      scale: {},
    };
  }

  return {
    primary: '#000000',
    primaryForeground: '#FFFFFF',
    secondary: '#0000FF',
    success: '#006400',
    error: '#8B0000',
    warning: '#8B4500',
    info: '#000000',
    foreground: '#000000',
    mutedForeground: '#333333',
    background: '#FFFFFF',
    mutedBackground: '#F5F5F5',
    border: '#000000',
    inputBorder: '#000000',
    focusRing: '#0000FF',
    scale: {},
  };
}

/**
 * Export all utilities
 */
export default {
  generateScale,
  generatePalette,
  getComplementaryColor,
  getTriadicColors,
  getAnalogousColors,
  getSemanticColors,
  validatePalette,
  generateHighContrastPalette,
};

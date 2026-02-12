/**
 * Color Contrast Checker
 *
 * Calculates luminance and contrast ratios according to WCAG 2.1.
 * Provides utilities to validate text colors against backgrounds.
 *
 * @remarks
 * WCAG 2.1 Level AA requires:
 * - 4.5:1 contrast for normal text (< 18pt or < 14pt bold)
 * - 3:1 contrast for large text (>= 18pt or >= 14pt bold)
 *
 * WCAG 2.1 Level AAA requires:
 * - 7:1 contrast for normal text
 * - 4.5:1 contrast for large text
 *
 * @see {@link https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html}
 * @see {@link https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html}
 *
 * @example
 * ```ts
 * import { checkContrast, hexToRgb } from './ColorContrastChecker';
 *
 * const result = checkContrast('#E6E7A3', '#F2F2ED');
 * console.log(result.ratio); // 1.47
 * console.log(result.level); // 'FAIL'
 * console.log(result.passesAA); // false
 * ```
 */

/**
 * WCAG contrast levels
 */
export type ContrastLevel = 'FAIL' | 'AA' | 'AAA';

/**
 * Text size classification for contrast requirements
 */
export type TextSize = 'normal' | 'large';

/**
 * RGB color representation
 */
export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

/**
 * Color information including computed luminance
 */
export interface ColorInfo {
  hex: string;
  rgb: RgbColor;
  luminance: number;
}

/**
 * Contrast validation result
 */
export interface ContrastResult {
  /** Calculated contrast ratio */
  ratio: number;
  /** WCAG level for normal text */
  level: ContrastLevel;
  /** WCAG level for large text */
  levelLarge: ContrastLevel;
  /** Passes WCAG AA for normal text */
  passesAA: boolean;
  /** Passes WCAG AAA for normal text */
  passesAAA: boolean;
}

/**
 * Contrast issue for validation reporting
 */
export interface ContrastIssue {
  /** CSS property or semantic name */
  property: string;
  /** Foreground color (hex) */
  foreground: string;
  /** Background color (hex) */
  background: string;
  /** Calculated contrast ratio */
  ratio: number;
  /** Expected minimum ratio */
  expected: number;
  /** WCAG level achieved */
  level: ContrastLevel;
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  /** Theme identifier */
  theme: string;
  /** Whether all checks passed */
  valid: boolean;
  /** List of contrast issues */
  issues: ContrastIssue[];
  /** Validated color values */
  colors: Record<string, string>;
}

/**
 * Color palette for validation
 */
export interface ColorPalette {
  [key: string]: string;
}

/**
 * Color pair definition for validation
 */
export interface ColorPair {
  /** Semantic name for this pair */
  key: string;
  /** Foreground color (hex) */
  fg: string;
  /** Background color (hex) */
  bg: string;
  /** Required contrast ratio */
  minRatio: number;
  /** Text size category */
  textSize?: TextSize;
}

// ============================================
// COLOR CONVERSION UTILITIES
// ============================================

/**
 * Convert hex color to RGB object
 *
 * @param hex - Hex color string (with or without #)
 * @returns RGB color object
 * @throws {Error} If hex format is invalid
 *
 * @example
 * ```ts
 * hexToRgb('#E6E7A3'); // { r: 230, g: 231, b: 163 }
 * hexToRgb('E6E7A3');  // { r: 230, g: 231, b: 163 }
 * ```
 */
export function hexToRgb(hex: string): RgbColor {
  const cleaned = hex.replace('#', '');

  // Handle 3-character hex shorthand
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    return { r, g, b };
  }

  // Handle 6-character hex
  if (cleaned.length === 6) {
    const r = parseInt(cleaned.substring(0, 2), 16);
    const g = parseInt(cleaned.substring(2, 4), 16);
    const b = parseInt(cleaned.substring(4, 6), 16);
    return { r, g, b };
  }

  throw new Error(`Invalid hex color format: ${hex}`);
}

/**
 * Convert RGB to hex color string
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Hex color string with #
 *
 * @example
 * ```ts
 * rgbToHex(230, 231, 163); // '#E6E7A3'
 * ```
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (c: number) => {
    const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * Parse CSS color value to hex
 *
 * @param color - CSS color value (hex, rgb, rgba, or color name)
 * @returns Hex color string
 *
 * @example
 * ```ts
 * parseColorToHex('#E6E7A3');        // '#E6E7A3'
 * parseColorToHex('rgb(230, 231, 163)'); // '#E6E7A3'
 * parseColorToHex('white');           // '#FFFFFF'
 * ```
 */
export function parseColorToHex(color: string): string {
  // Hex color
  if (color.startsWith('#')) {
    return color;
  }

  // RGB color
  const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (rgbMatch) {
    return rgbToHex(
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3])
    );
  }

  // RGBA color
  const rgbaMatch = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*[\d.]+\)/);
  if (rgbaMatch) {
    return rgbToHex(
      parseInt(rgbaMatch[1]),
      parseInt(rgbaMatch[2]),
      parseInt(rgbaMatch[3])
    );
  }

  // Named colors (basic set)
  const namedColors: Record<string, string> = {
    'white': '#FFFFFF',
    'black': '#000000',
    'red': '#FF0000',
    'green': '#00FF00',
    'blue': '#0000FF',
    'yellow': '#FFFF00',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF',
    'gray': '#808080',
    'grey': '#808080',
    'transparent': '#FFFFFF',
  };

  const lower = color.toLowerCase();
  if (namedColors[lower]) {
    return namedColors[lower];
  }

  throw new Error(`Cannot parse color: ${color}`);
}

// ============================================
// LUMINANCE CALCULATION
// ============================================

/**
 * Calculate relative luminance according to WCAG 2.1
 *
 * @param r - Red component (0-255)
 * @param g - Green component (0-255)
 * @param b - Blue component (0-255)
 * @returns Relative luminance (0-1)
 *
 * @remarks
 * Luminance is the "brightness" of a color.
 * Formula from WCAG 2.1 specification.
 *
 * @see {@link https://www.w3.org/WAI/WCAG21/dfn#relative-luminance}
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  // Convert to sRGB values
  const [sr, sg, sb] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  // Calculate luminance
  return 0.2126 * sr + 0.7152 * sg + 0.0722 * sb;
}

/**
 * Get color info with computed luminance
 *
 * @param hex - Hex color string
 * @returns Color info including luminance
 */
export function getColorInfo(hex: string): ColorInfo {
  const rgb = hexToRgb(hex);
  const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);
  return { hex, rgb, luminance };
}

// ============================================
// CONTRAST CALCULATION
// ============================================

/**
 * Calculate contrast ratio between two colors
 *
 * @param fg - Foreground color (hex)
 * @param bg - Background color (hex)
 * @returns Contrast ratio (1-21)
 *
 * @remarks
 * Contrast ratio formula from WCAG 2.1:
 * (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter luminance and L2 is the darker.
 *
 * @see {@link https://www.w3.org/WAI/WCAG21/dfn#contrast-ratio}
 */
export function calculateContrastRatio(fg: string, bg: string): number {
  const fgRgb = hexToRgb(fg);
  const bgRgb = hexToRgb(bg);

  const fgLuminance = calculateLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLuminance = calculateLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(fgLuminance, bgLuminance);
  const darker = Math.min(fgLuminance, bgLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================
// CONTRAST VALIDATION
// ============================================

/**
 * Check if contrast meets WCAG standards
 *
 * @param fg - Foreground color (hex)
 * @param bg - Background color (hex)
 * @param size - Text size category
 * @returns Contrast validation result
 *
 * @example
 * ```ts
 * const result = checkContrast('#000000', '#FFFFFF');
 * // { ratio: 21, level: 'AAA', levelLarge: 'AAA', passesAA: true, passesAAA: true }
 * ```
 */
export function checkContrast(
  fg: string,
  bg: string,
  size: TextSize = 'normal'
): ContrastResult {
  const ratio = calculateContrastRatio(fg, bg);

  // WCAG AA: 4.5:1 for normal, 3:1 for large
  // WCAG AAA: 7:1 for normal, 4.5:1 for large
  const aaThreshold = size === 'large' ? 3 : 4.5;
  const aaaThreshold = size === 'large' ? 4.5 : 7;

  let level: ContrastLevel;
  if (ratio >= aaaThreshold) {
    level = 'AAA';
  } else if (ratio >= aaThreshold) {
    level = 'AA';
  } else {
    level = 'FAIL';
  }

  const levelLarge: ContrastLevel = ratio >= 4.5 ? 'AAA' : ratio >= 3 ? 'AA' : 'FAIL';

  return {
    ratio: Math.round(ratio * 100) / 100,
    level,
    levelLarge,
    passesAA: ratio >= aaThreshold,
    passesAAA: ratio >= aaaThreshold,
  };
}

// ============================================
// ENHANCED CONTRAST MODE
// ============================================

/**
 * Get high-contrast version of a color
 *
 * @param original - Original color (hex)
 * @param darkMode - Whether to use dark mode (defaults to black on white)
 * @returns High-contrast color (pure black or white)
 *
 * @remarks
 * For WCAG AAA compliance, returns pure black (#000000) or white (#FFFFFF)
 * based on which provides better contrast against the background.
 */
export function getHighContrastColor(original: string, darkMode = false): string {
  const rgb = hexToRgb(original);
  const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);

  if (darkMode) {
    // Dark mode: return white for dark colors, black for light
    return luminance < 0.5 ? '#FFFFFF' : '#000000';
  }

  // Light mode: return black for light colors, white for dark
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Get contrasting foreground color for a background
 *
 * @param bg - Background color (hex)
 * @returns Foreground color (black or white) with best contrast
 *
 * @example
 * ```ts
 * getContrastingColor('#FFFFFF'); // '#000000'
 * getContrastingColor('#000000'); // '#FFFFFF'
 * ```
 */
export function getContrastingColor(bg: string): string {
  const rgb = hexToRgb(bg);
  const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// ============================================
// THEME VALIDATION
// ============================================

/**
 * Validate an entire theme's color palette
 *
 * @param themeName - Theme identifier
 * @param colors - Color palette object
 * @param customPairs - Optional custom color pairs to validate
 * @returns Theme validation result
 *
 * @example
 * ```ts
 * const result = validateThemeColors('default', {
 *   background: '#F2F2ED',
 *   foreground: '#0B0B0F',
 *   primary: '#E6E7A3',
 * });
 * ```
 */
export function validateThemeColors(
  themeName: string,
  colors: ColorPalette,
  customPairs?: ColorPair[]
): ThemeValidationResult {
  const issues: ContrastIssue[] = [];

  // Default color pairs to validate for all themes
  const defaultPairs: ColorPair[] = [
    { key: 'primary-text', fg: colors.foreground || '#000000', bg: colors.background || '#FFFFFF', minRatio: 4.5 },
    { key: 'secondary-text', fg: colors.mutedForeground || colors.foreground || '#666666', bg: colors.background || '#FFFFFF', minRatio: 4.5 },
    { key: 'accent-on-bg', fg: colors.primary || '#0000FF', bg: colors.background || '#FFFFFF', minRatio: 4.5 },
    { key: 'accent-on-primary', fg: colors.primaryForeground || '#FFFFFF', bg: colors.primary || '#0000FF', minRatio: 4.5 },
    { key: 'border-on-bg', fg: colors.border || colors.foreground || '#000000', bg: colors.background || '#FFFFFF', minRatio: 3 },
    { key: 'input-border', fg: colors.input || colors.border || '#000000', bg: colors.background || '#FFFFFF', minRatio: 3 },
  ];

  const pairsToValidate = customPairs || defaultPairs;

  for (const pair of pairsToValidate) {
    const ratio = calculateContrastRatio(pair.fg, pair.bg);
    const result = checkContrast(pair.fg, pair.bg, pair.textSize);

    if (ratio < pair.minRatio) {
      issues.push({
        property: pair.key,
        foreground: pair.fg,
        background: pair.bg,
        ratio: Math.round(ratio * 100) / 100,
        expected: pair.minRatio,
        level: result.level,
      });
    }
  }

  return {
    theme: themeName,
    valid: issues.length === 0,
    issues,
    colors,
  };
}

/**
 * Validate multiple themes
 *
 * @param themes - Array of theme definitions
 * @returns Array of validation results
 */
export function validateMultipleThemes(
  themes: Array<{ name: string; colors: ColorPalette }>
): ThemeValidationResult[] {
  return themes.map(theme =>
    validateThemeColors(theme.name, theme.colors)
  );
}

// ============================================
// REPORTING UTILITIES
// ============================================

/**
 * Format contrast ratio as string
 *
 * @param ratio - Contrast ratio number
 * @returns Formatted ratio string (e.g., "4.5:1")
 */
export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 100) / 100}:1`;
}

/**
 * Generate a text report for theme validation
 *
 * @param result - Theme validation result
 * @returns Human-readable report
 */
export function generateReport(result: ThemeValidationResult): string {
  const lines: string[] = [];
  lines.push(`Theme: ${result.theme}`);
  lines.push(`Status: ${result.valid ? '✅ PASS' : '❌ FAIL'}`);
  lines.push('');

  if (result.issues.length > 0) {
    lines.push('Issues:');
    for (const issue of result.issues) {
      lines.push(`  - ${issue.property}:`);
      lines.push(`    Ratio: ${formatRatio(issue.ratio)} (expected ${formatRatio(issue.expected)})`);
      lines.push(`    Level: ${issue.level}`);
      lines.push(`    FG: ${issue.foreground} on BG: ${issue.background}`);
    }
  } else {
    lines.push('All color pairs meet WCAG AA standards.');
  }

  return lines.join('\n');
}

/**
 * Generate HTML report for theme validation
 *
 * @param results - Array of validation results
 * @returns HTML report string
 */
export function generateHtmlReport(results: ThemeValidationResult[]): string {
  const rows: string[] = [];

  for (const result of results) {
    const statusClass = result.valid ? 'pass' : 'fail';
    const status = result.valid ? '✅ PASS' : '❌ FAIL';

    rows.push(`
      <tr class="${statusClass}">
        <td>${result.theme}</td>
        <td>${status}</td>
        <td>${result.issues.length}</td>
        <td>${result.issues.map(i => `<details><summary>${i.property}</summary>${formatRatio(i.ratio)}</details>`).join('') || 'None'}</td>
      </tr>
    `);
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Color Contrast Report</title>
      <style>
        body { font-family: system-ui; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background: #f5f5f5; }
        .pass { background: #d4edda; }
        .fail { background: #f8d7da; }
        details { cursor: pointer; }
      </style>
    </head>
    <body>
      <h1>Color Contrast Report</h1>
      <p>Generated: ${new Date().toISOString()}</p>
      <table>
        <thead>
          <tr>
            <th>Theme</th>
            <th>Status</th>
            <th>Issues</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${rows.join('')}
        </tbody>
      </table>
    </body>
    </html>
  `;
}

// Export all functions as default
export default {
  hexToRgb,
  rgbToHex,
  parseColorToHex,
  calculateLuminance,
  getColorInfo,
  calculateContrastRatio,
  checkContrast,
  getHighContrastColor,
  getContrastingColor,
  validateThemeColors,
  validateMultipleThemes,
  formatRatio,
  generateReport,
  generateHtmlReport,
};

/**
 * useContrastValidator Hook
 *
 * Provides runtime color contrast validation for components.
 * Checks if foreground/background combinations meet WCAG AA/AAA standards.
 *
 * @remarks
 * This hook enables real-time contrast validation during development,
 * helping catch accessibility issues before they reach production.
 *
 * Features:
 * - Real-time contrast ratio calculation
 * - WCAG AA/AAA validation
 * - Component-level validation
 * - Theme validation
 * - Suggests alternative colors
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { validate, isValid, contrastRatio, getSuggestion } = useContrastValidator();
 *
 *   const result = validate('#E6E7A3', '#F2F2ED');
 *   console.log(result.ratio); // 1.47
 *   console.log(result.passesAA); // false
 *
 *   if (!result.passesAA) {
 *     const suggestion = getSuggestion('#F2F2ED', 'foreground');
 *     console.log(suggestion); // '#000000' (better contrast)
 *   }
 *
 *   return <div style={{ color: '#E6E7A3', background: '#F2F2ED' }}>Text</div>;
 * }
 * ```
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type {
  ContrastResult,
  ContrastLevel,
  TextSize,
  ThemeValidationResult,
  ColorPalette,
} from './ColorContrastChecker';

// Import ColorContrastChecker functions
import {
  calculateContrastRatio,
  checkContrast,
  getContrastingColor,
  validateThemeColors,
  hexToRgb,
  rgbToHex,
  calculateLuminance,
} from './ColorContrastChecker';

/**
 * Validation options
 */
export interface ValidationOptions {
  /** Minimum contrast level required */
  level?: ContrastLevel;
  /** Text size category */
  size?: TextSize;
  /** Whether to enable enhanced contrast mode */
  enhancedContrast?: boolean;
  /** Whether to log validation results */
  verbose?: boolean;
}

/**
 * Validation result with suggestions
 */
export interface ValidationResult extends ContrastResult {
  /** Foreground color */
  foreground: string;
  /** Background color */
  background: string;
  /** Whether validation passed */
  valid: boolean;
  /** Suggested foreground color if invalid */
  suggestedForeground?: string;
  /** Suggested background color if invalid */
  suggestedBackground?: string;
}

/**
 * Theme validation hook result
 */
export interface ThemeValidationState {
  /** Validation results by theme name */
  results: Record<string, ThemeValidationResult>;
  /** Number of themes with violations */
  violationCount: number;
  /** Whether all themes are valid */
  allValid: boolean;
  /** Timestamp of last validation */
  lastValidated: number;
}

/**
 * Contrast validator hook return value
 */
export interface UseContrastValidatorReturn {
  /** Validate a single color pair */
  validate: (fg: string, bg: string, options?: ValidationOptions) => ValidationResult;
  /** Validate multiple color pairs */
  validateAll: (pairs: Array<{ fg: string; bg: string }>, options?: ValidationOptions) => ValidationResult[];
  /** Get a better contrasting color */
  getContrastingColor: (bg: string) => string;
  /** Get color suggestion for better contrast */
  getSuggestion: (baseColor: string, target: 'foreground' | 'background', desiredRatio?: number) => string;
  /** Validate a complete theme */
  validateTheme: (name: string, colors: ColorPalette) => ThemeValidationResult;
  /** Clear cached results */
  clearCache: () => void;
}

/**
 * Default validation options
 */
const DEFAULT_OPTIONS: ValidationOptions = {
  level: 'AA',
  size: 'normal',
  enhancedContrast: false,
  verbose: false,
};

/**
 * React hook for color contrast validation
 *
 * @param defaultOptions - Default options for all validations
 * @returns Contrast validation utilities
 *
 * @example
 * ```tsx
 * function ColorPicker() {
 *   const { validate, getSuggestion } = useContrastValidator({ level: 'AA' });
 *
 *   const [fgColor, setFgColor] = useState('#E6E7A3');
 *   const [bgColor, setBgColor] = useState('#F2F2ED');
 *
 *   const result = useMemo(() => validate(fgColor, bgColor), [fgColor, bgColor]);
 *
 *   return (
 *     <div>
 *       <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
 *       <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
 *       <p>Contrast: {result.ratio}:1 ({result.level})</p>
 *       {!result.passesAA && <p className="error">Does not meet WCAG AA</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useContrastValidator(defaultOptions: ValidationOptions = {}): UseContrastValidatorReturn {
  const options = { ...DEFAULT_OPTIONS, ...defaultOptions };
  const [cache, setCache] = useState<Map<string, ValidationResult>>(new Map());

  /**
   * Create cache key for validation result
   */
  const getCacheKey = (fg: string, bg: string, size: TextSize): string => {
    return `${fg}-${bg}-${size}`;
  };

  /**
   * Validate a single color pair
   */
  const validate = useCallback((
    fg: string,
    bg: string,
    localOptions: ValidationOptions = {}
  ): ValidationResult => {
    const mergedOptions = { ...options, ...localOptions };
    const cacheKey = getCacheKey(fg, bg, mergedOptions.size || 'normal');

    // Check cache
    const cached = cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Calculate contrast
    const contrast = checkContrast(fg, bg, mergedOptions.size);

    // Check if passes required level
    const passesRequiredLevel =
      (mergedOptions.level === 'AAA' && contrast.passesAAA) ||
      (mergedOptions.level === 'AA' && contrast.passesAA) ||
      (mergedOptions.level === 'FAIL' && true);

    // Generate suggestions if invalid
    let suggestedForeground: string | undefined;
    let suggestedBackground: string | undefined;

    if (!passesRequiredLevel) {
      // Get contrasting color for better readability
      if (mergedOptions.enhancedContrast) {
        suggestedForeground = getContrastingColor(bg);
        suggestedBackground = getContrastingColor(fg);
      } else {
        // Suggest adjusted foreground color
        suggestedForeground = adjustColorForContrast(fg, bg, mergedOptions.level);
        suggestedBackground = adjustColorForContrast(bg, fg, mergedOptions.level);
      }
    }

    const result: ValidationResult = {
      ...contrast,
      foreground: fg,
      background: bg,
      valid: passesRequiredLevel,
      suggestedForeground,
      suggestedBackground,
    };

    // Cache result
    setCache(prev => new Map(prev).set(cacheKey, result));

    // Log if verbose
    if (mergedOptions.verbose) {
      console.log(
        `[ContrastValidator] ${fg} on ${bg}: ${contrast.ratio}:1 (${contrast.level}) - ` +
        `${passesRequiredLevel ? 'PASS' : 'FAIL'}`
      );
    }

    return result;
  }, [options, cache]);

  /**
   * Validate multiple color pairs
   */
  const validateAll = useCallback((
    pairs: Array<{ fg: string; bg: string }>,
    localOptions: ValidationOptions = {}
  ): ValidationResult[] => {
    return pairs.map(pair => validate(pair.fg, pair.bg, localOptions));
  }, [validate]);

  /**
   * Get a contrasting color for a background
   */
  const getContrastingColorCallback = useCallback((bg: string): string => {
    return getContrastingColor(bg);
  }, []);

  /**
   * Get color suggestion for better contrast
   */
  const getSuggestion = useCallback((
    baseColor: string,
    target: 'foreground' | 'background',
    desiredRatio: number = 4.5
  ): string => {
    // Binary search for best color
    let bestColor = baseColor;
    let bestRatio = 0;

    // Try darker variations
    const darker = adjustBrightness(baseColor, -0.1);
    const darkerResult = target === 'foreground'
      ? checkContrast(darker, bestColor)
      : checkContrast(bestColor, darker);
    if (darkerResult.ratio > bestRatio) {
      bestColor = darker;
      bestRatio = darkerResult.ratio;
    }

    // Try lighter variations
    const lighter = adjustBrightness(baseColor, 0.1);
    const lighterResult = target === 'foreground'
      ? checkContrast(lighter, bestColor)
      : checkContrast(bestColor, lighter);
    if (lighterResult.ratio > bestRatio) {
      bestColor = lighter;
      bestRatio = lighterResult.ratio;
    }

    // If still not enough contrast, go to black/white
    if (bestRatio < desiredRatio) {
      const rgb = hexToRgb(baseColor);
      const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);
      return luminance > 0.5 ? '#000000' : '#FFFFFF';
    }

    return bestColor;
  }, []);

  /**
   * Validate a complete theme
   */
  const validateTheme = useCallback((
    name: string,
    colors: ColorPalette
  ): ThemeValidationResult => {
    return validateThemeColors(name, colors);
  }, []);

  /**
   * Clear the validation cache
   */
  const clearCache = useCallback((): void => {
    setCache(new Map());
  }, []);

  return {
    validate,
    validateAll,
    getContrastingColor: getContrastingColorCallback,
    getSuggestion,
    validateTheme,
    clearCache,
  };
}

/**
 * Adjust color brightness for better contrast
 *
 * @param color - Hex color to adjust
 * @param target - Background color
 * @param level - Required WCAG level
 * @returns Adjusted hex color
 */
function adjustColorForContrast(
  color: string,
  target: string,
  level: ContrastLevel
): string {
  const requiredRatio = level === 'AAA' ? 7 : 4.5;
  const currentRatio = calculateContrastRatio(color, target);

  if (currentRatio >= requiredRatio) {
    return color; // Already meets requirements
  }

  // Adjust brightness iteratively until we meet requirement
  let adjusted = color;
  let adjustment = 0.1;

  for (let i = 0; i < 20; i++) {
    adjusted = adjustBrightness(adjusted, adjustment);
    const newRatio = calculateContrastRatio(adjusted, target);

    if (newRatio >= requiredRatio) {
      return adjusted;
    }

    // If going lighter doesn't work, try darker
    if (adjustment > 0 && i === 9) {
      adjustment = -0.1;
      adjusted = color; // Reset
    }
  }

  // Fall back to pure contrast
  const targetRgb = hexToRgb(target);
  const targetLuminance = calculateLuminance(targetRgb.r, targetRgb.g, targetRgb.b);
  return targetLuminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Adjust color brightness
 *
 * @param color - Hex color to adjust
 * @param amount - Amount to adjust (-1 to 1, negative = darker, positive = lighter)
 * @returns Adjusted hex color
 */
function adjustBrightness(color: string, amount: number): string {
  const rgb = hexToRgb(color);

  const r = Math.min(255, Math.max(0, rgb.r + amount * 255));
  const g = Math.min(255, Math.max(0, rgb.g + amount * 255));
  const b = Math.min(255, Math.max(0, rgb.b + amount * 255));

  return rgbToHex(r, g, b);
}

/**
 * Hook for theme validation across multiple themes
 *
 * @example
 * ```tsx
 * function ThemeValidator() {
 *   const { results, violationCount, allValid, validateAll } = useThemeValidator();
 *
 *   useEffect(() => {
 *     const themes = [
 *       { name: 'light', colors: lightColors },
 *       { name: 'dark', colors: darkColors },
 *     ];
 *     validateAll(themes);
 *   }, []);
 *
 *   return (
 *     <div>
 *       <p>Themes with violations: {violationCount}</p>
 *       <p>All valid: {allValid ? 'Yes' : 'No'}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useThemeValidator(): {
  results: Record<string, ThemeValidationResult>;
  violationCount: number;
  allValid: boolean;
  validateAll: (themes: Array<{ name: string; colors: ColorPalette }>) => void;
  clear: () => void;
} {
  const [state, setState] = useState<ThemeValidationState>({
    results: {},
    violationCount: 0,
    allValid: true,
    lastValidated: 0,
  });

  const validateAll = useCallback((
    themes: Array<{ name: string; colors: ColorPalette }>
  ): void => {
    const results: Record<string, ThemeValidationResult> = {};
    let violationCount = 0;

    for (const theme of themes) {
      const result = validateThemeColors(theme.name, theme.colors);
      results[theme.name] = result;

      if (!result.valid) {
        violationCount += result.issues.length;
      }
    }

    setState({
      results,
      violationCount,
      allValid: violationCount === 0,
      lastValidated: Date.now(),
    });
  }, []);

  const clear = useCallback((): void => {
    setState({
      results: {},
      violationCount: 0,
      allValid: true,
      lastValidated: 0,
    });
  }, []);

  return {
    results: state.results,
    violationCount: state.violationCount,
    allValid: state.allValid,
    validateAll,
    clear,
  };
}

/**
 * Check if OS high contrast mode is enabled
 *
 * @returns True if high contrast mode is enabled
 */
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent): void => {
      setIsHighContrast(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isHighContrast;
}

/**
 * Hook for real-time contrast checking on styled elements
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const ref = useRef<HTMLDivElement>(null);
 *   const { contrastRatio, passesAA } = useElementContrast(ref);
 *
 *   return (
 *     <div ref={ref} style={{ color: '#E6E7A3', background: '#F2F2ED' }}>
 *       Text
 *       {passesAA === false && <span className="warning">Low contrast!</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useElementContrast(
  elementRef: React.RefObject<HTMLElement | null>,
  refreshInterval: number = 500
): {
  contrastRatio: number;
  passesAA: boolean;
  passesAAA: boolean;
  foreground: string | null;
  background: string | null;
  recheck: () => void;
} {
  const [state, setState] = useState({
    contrastRatio: 0,
    passesAA: true,
    passesAAA: true,
    foreground: null as string | null,
    background: null as string | null,
  });

  const recheck = useCallback((): void => {
    if (!elementRef.current) return;

    const computed = window.getComputedStyle(elementRef.current);
    const fg = computed.color;
    const bg = computed.backgroundColor;

    if (fg && bg && bg !== 'rgba(0, 0, 0, 0)') {
      // Parse RGB to hex
      const fgMatch = fg.match(/\d+/g);
      const bgMatch = bg.match(/\d+/g);

      if (fgMatch && bgMatch) {
        const fgHex = rgbToHex(
          parseInt(fgMatch[0]),
          parseInt(fgMatch[1]),
          parseInt(fgMatch[2])
        );
        const bgHex = rgbToHex(
          parseInt(bgMatch[0]),
          parseInt(bgMatch[1]),
          parseInt(bgMatch[2])
        );

        const result = checkContrast(fgHex, bgHex);

        setState({
          contrastRatio: result.ratio,
          passesAA: result.passesAA,
          passesAAA: result.passesAAA,
          foreground: fgHex,
          background: bgHex,
        });
      }
    }
  }, [elementRef]);

  useEffect(() => {
    recheck();

    if (refreshInterval > 0) {
      const interval = setInterval(recheck, refreshInterval);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [recheck, refreshInterval]);

  return { ...state, recheck };
}

export default useContrastValidator;

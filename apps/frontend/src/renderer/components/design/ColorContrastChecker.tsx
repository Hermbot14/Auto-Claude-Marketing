/**
 * Color Contrast Checker Component
 *
 * A visual tool for checking and validating color contrast ratios.
 * Shows WCAG AA/AAA compliance for foreground/background combinations.
 *
 * @remarks
 * This component is designed for:
 * - Designers - to validate color choices
 * - Developers - to debug contrast issues
 * - QA teams - to verify accessibility compliance
 *
 * Features:
 * - Real-time contrast ratio calculation
 * - WCAG AA/AAA pass/fail indicators
 * - Visual preview of color combinations
 * - Large text vs normal text validation
 * - Suggested color adjustments
 *
 * @example
 * ```tsx
 * import { ColorContrastChecker } from './components/design/ColorContrastChecker';
 *
 * function DesignPage() {
 *   return (
 *     <ColorContrastChecker
 *       foreground="#E6E7A3"
 *       background="#F2F2ED"
 *       onChange={(result) => console.log(result)}
 *     />
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  checkContrast,
  type ContrastResult,
  type ContrastLevel,
  getContrastingColor,
  hexToRgb,
  rgbToHex,
} from '../../lib/accessibility/ColorContrastChecker';

/**
 * Props for ColorContrastChecker component
 */
export interface ColorContrastCheckerProps {
  /** Initial foreground color (hex) */
  foreground?: string;
  /** Initial background color (hex) */
  background?: string;
  /** Callback when colors change */
  onChange?: (result: ContrastResult & { foreground: string; background: string }) => void;
  /** Whether to show large text preview */
  showLargeText?: boolean;
  /** Whether to show suggestions for failing colors */
  showSuggestions?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Whether to enable editing */
  editable?: boolean;
}

/**
 * WCAG level badge component
 */
function WcagBadge({
  level,
  size,
}: {
  level: ContrastLevel;
  size: 'normal' | 'large';
}) {
  const colors = {
    FAIL: 'bg-red-100 text-red-700 border-red-300',
    AA: 'bg-green-100 text-green-700 border-green-300',
    AAA: 'bg-blue-100 text-blue-700 border-blue-300',
  };

  return (
    <span
      className={`wcag-badge ${colors[level]}`}
      role="status"
      aria-label={`WCAG ${level} for ${size} text`}
    >
      {level}
    </span>
  );
}

/**
 * Color input component
 */
function ColorInput({
  label,
  value,
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="color-input">
      <label htmlFor={`color-${label}`} className="color-input__label">
        {label}
      </label>
      <div className="color-input__wrapper">
        <input
          id={`color-${label}`}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={readOnly}
          className="color-input__picker"
          aria-label={`Select ${label} color`}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            const hex = e.target.value;
            if (/^#?[0-9A-Fa-f]{6}$/.test(hex)) {
              onChange(hex.startsWith('#') ? hex : `#${hex}`);
            }
          }}
          disabled={readOnly}
          className="color-input__text"
          placeholder="#FFFFFF"
          aria-label={`${label} color hex value`}
        />
      </div>
    </div>
  );
}

/**
 * ColorContrastChecker Component
 */
export function ColorContrastChecker({
  foreground = '#0B0B0F',
  background = '#F2F2ED',
  onChange,
  showLargeText = true,
  showSuggestions = true,
  className = '',
  editable = true,
}: ColorContrastCheckerProps) {
  const { t } = useTranslation(['accessibility', 'common']);
  const [fgColor, setFgColor] = useState(foreground);
  const [bgColor, setBgColor] = useState(background);
  const [result, setResult] = useState<ContrastResult>(() =>
    checkContrast(foreground, background)
  );

  // Update result when colors change
  useEffect(() => {
    const newResult = checkContrast(fgColor, bgColor);
    setResult(newResult);

    if (onChange) {
      onChange({
        ...newResult,
        foreground: fgColor,
        background: bgColor,
      });
    }
  }, [fgColor, bgColor, onChange]);

  // Get suggested colors
  const suggestedForeground = useCallback(() => {
    if (result.passesAA) return null;
    return getContrastingColor(bgColor);
  }, [bgColor, result.passesAA]);

  const suggestedBackground = useCallback(() => {
    if (result.passesAA) return null;
    return getContrastingColor(fgColor);
  }, [fgColor, result.passesAA]);

  // Apply suggested colors
  const applySuggestions = useCallback(() => {
    const newFg = suggestedForeground() || fgColor;
    const newBg = suggestedBackground() || bgColor;
    setFgColor(newFg);
    setBgColor(newBg);
  }, [fgColor, bgColor, suggestedForeground, suggestedBackground]);

  // Swap colors
  const swapColors = useCallback(() => {
    setFgColor(bgColor);
    setBgColor(fgColor);
  }, [fgColor, bgColor]);

  return (
    <div className={`color-contrast-checker ${className}`.trim()}>
      {/* Header */}
      <div className="color-contrast-checker__header">
        <h2 className="color-contrast-checker__title">
          {t('accessibility:contrast.checkerTitle', 'Color Contrast Checker')}
        </h2>
        <p className="color-contrast-checker__description">
          {t('accessibility:contrast.checkerDescription', 'Check if your colors meet WCAG accessibility standards')}
        </p>
      </div>

      {/* Color inputs */}
      <div className="color-contrast-checker__inputs">
        <ColorInput
          label={t('accessibility:contrast.foreground', 'Foreground')}
          value={fgColor}
          onChange={setFgColor}
          readOnly={!editable}
        />
        <button
          type="button"
          className="color-contrast-checker__swap"
          onClick={swapColors}
          disabled={!editable}
          aria-label={t('accessibility:contrast.swapColors', 'Swap colors')}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
        <ColorInput
          label={t('accessibility:contrast.background', 'Background')}
          value={bgColor}
          onChange={setBgColor}
          readOnly={!editable}
        />
      </div>

      {/* Results */}
      <div className="color-contrast-checker__results">
        <div className="color-contrast-checker__ratio">
          <span className="color-contrast-checker__ratio-value">
            {result.ratio.toFixed(2)}:1
          </span>
          <span className="color-contrast-checker__ratio-label">
            {t('accessibility:contrast.contrastRatio', 'Contrast Ratio')}
          </span>
        </div>

        <div className="color-contrast-checker__badges">
          <div className="color-contrast-checker__badge-group">
            <span className="color-contrast-checker__badge-label">
              {t('accessibility:contrast.normalText', 'Normal Text')}
            </span>
            <WcagBadge level={result.level} size="normal" />
          </div>

          {showLargeText && (
            <div className="color-contrast-checker__badge-group">
              <span className="color-contrast-checker__badge-label">
                {t('accessibility:contrast.largeText', 'Large Text')}
              </span>
              <WcagBadge level={result.levelLarge} size="large" />
            </div>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="color-contrast-checker__preview">
        <div
          className="color-contrast-checker__preview-box"
          style={{
            color: fgColor,
            backgroundColor: bgColor,
          }}
        >
          <p className="color-contrast-checker__preview-text">
            {t('accessibility:contrast.previewText', 'This is how your text will look.')}
          </p>
          {showLargeText && (
            <p className="color-contrast-checker__preview-text color-contrast-checker__preview-text--large">
              {t('accessibility:contrast.largePreviewText', 'Large text is easier to read.')}
            </p>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {showSuggestions && !result.passesAA && (
        <div className="color-contrast-checker__suggestions">
          <h3 className="color-contrast-checker__suggestions-title">
            {t('accessibility:contrast.suggestionsTitle', 'Suggestions')}
          </h3>
          <p className="color-contrast-checker__suggestions-text">
            {t('accessibility:contrast.suggestionsText',
              'This color combination does not meet WCAG AA standards. Consider these alternatives:'
            )}
          </p>

          <div className="color-contrast-checker__suggestion-buttons">
            {suggestedForeground() && (
              <button
                type="button"
                className="color-contrast-checker__suggestion-btn"
                onClick={() => setFgColor(suggestedForeground()!)}
                style={{ backgroundColor: suggestedForeground() }}
              >
                {t('accessibility:contrast.useForeground', 'Use suggested foreground')}
              </button>
            )}
            {suggestedBackground() && (
              <button
                type="button"
                className="color-contrast-checker__suggestion-btn"
                onClick={() => setBgColor(suggestedBackground()!)}
                style={{ backgroundColor: suggestedBackground() }}
              >
                {t('accessibility:contrast.useBackground', 'Use suggested background')}
              </button>
            )}
            <button
              type="button"
              className="color-contrast-checker__suggestion-btn color-contrast-checker__suggestion-btn--primary"
              onClick={applySuggestions}
            >
              {t('accessibility:contrast.applyAll', 'Apply all suggestions')}
            </button>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="color-contrast-checker__info">
        <h3 className="color-contrast-checker__info-title">
          {t('accessibility:contrast.standardsTitle', 'WCAG 2.1 Standards')}
        </h3>
        <ul className="color-contrast-checker__info-list">
          <li>
            <strong>{t('accessibility:contrast.aa', 'AA (Minimum):')}</strong> {t('accessibility:contrast.aaDesc', '4.5:1 for normal text, 3:1 for large text')}
          </li>
          <li>
            <strong>{t('accessibility:contrast.aaa', 'AAA (Enhanced):')}</strong> {t('accessibility:contrast.aaaDesc', '7:1 for normal text, 4.5:1 for large text')}
          </li>
        </ul>
      </div>
    </div>
  );
}

/**
 * Quick contrast checker for inline use
 */
export function QuickContrastBadge({
  foreground,
  background,
  showRatio = true,
}: {
  foreground: string;
  background: string;
  showRatio?: boolean;
}) {
  const result = checkContrast(foreground, background);

  return (
    <div
      className="quick-contrast-badge"
      style={{
        backgroundColor: background,
        color: foreground,
      }}
      title={`Contrast ratio: ${result.ratio.toFixed(2)}:1 (${result.level})`}
    >
      {showRatio && (
        <span className="quick-contrast-badge__ratio">
          {result.ratio.toFixed(1)}
        </span>
      )}
      <span
        className={`quick-contrast-badge__indicator quick-contrast-badge__indicator--${result.level.toLowerCase()}`}
        aria-label={`WCAG ${result.level}`}
      >
        {result.level === 'FAIL' ? '✗' : result.level === 'AA' ? '✓✓' : '✓✓✓'}
      </span>
    </div>
  );
}

export default ColorContrastChecker;

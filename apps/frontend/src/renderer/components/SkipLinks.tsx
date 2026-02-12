import { useTranslation } from 'react-i18next';

interface SkipLinksProps {
  /**
   * ID of the main content area to skip to
   */
  mainContentId?: string;
  /**
   * ID of the sidebar to skip to
   */
  sidebarId?: string;
  /**
   * Additional skip links to include
   */
  additionalLinks?: Array<{
    href: string;
    label: string;
    ariaLabel: string;
  }>;
}

/**
 * SkipLinks Component
 *
 * Provides "Skip to Content" links for keyboard users.
 * These links are invisible until focused, then appear at the top of the page.
 * Allows keyboard users to bypass repetitive navigation and jump directly to content.
 *
 * WCAG 2.1.1: "A mechanism for bypassing blocks of content is available"
 *
 * @example
 * ```tsx
 * <SkipLinks
 *   mainContentId="main-content"
 *   sidebarId="sidebar"
 *   additionalLinks={[
 *     { href: "#settings", label: "Skip to Settings", ariaLabel: "Skip to settings section" }
 *   ]}
 * />
 * ```
 */
export function SkipLinks({
  mainContentId = 'main-content',
  sidebarId = 'sidebar',
  additionalLinks = []
}: SkipLinksProps) {
  const { t } = useTranslation(['accessibility', 'common']);

  return (
    <div className="skip-links-wrapper">
      {/* Skip to main content */}
      <a
        href={`#${mainContentId}`}
        className="skip-link skip-to-main"
        aria-label={t('accessibility:skipLinks.skipToMain')}
      >
        {t('accessibility:skipLinks.skipToMain')}
      </a>

      {/* Skip to sidebar */}
      <a
        href={`#${sidebarId}`}
        className="skip-link skip-to-sidebar"
        aria-label={t('accessibility:skipLinks.skipToSidebar')}
      >
        {t('accessibility:skipLinks.skipToSidebar')}
      </a>

      {/* Additional skip links */}
      {additionalLinks.map((link, index) => (
        <a
          key={index}
          href={link.href}
          className="skip-link"
          style={{
            left: `${180 + index * 180}px`
          }}
          aria-label={link.ariaLabel}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

/**
 * LiveRegion Component
 *
 * Creates a region for screen reader announcements.
 * Use this for dynamic content changes that need to be announced.
 *
 * @example
 * ```tsx
 * <LiveRegion politeness="polite" aria-live="polite">
 *   Content changes will be announced to screen readers
 * </LiveRegion>
 * ```
 */
export interface LiveRegionProps {
  children: React.ReactNode;
  /**
   * 'polite' - announced when user is idle
   * 'assertive' - announced immediately
   * 'off' - not announced
   */
  politeness?: 'polite' | 'assertive' | 'off';
  /**
   * Unique identifier for the region (for debugging)
   */
  id?: string;
  /**
   * Current message to announce (hidden visually)
   */
  message?: string;
}

export function LiveRegion({
  children,
  politeness = 'polite',
  id,
  message
}: LiveRegionProps) {
  return (
    <div
      id={id}
      aria-live={politeness}
      aria-atomic="true"
      role="status"
      className="sr-only"
    >
      {message && <span>{message}</span>}
      {children}
    </div>
  );
}

/**
 * VisuallyHidden Component
 *
 * Hides content visually but keeps it accessible to screen readers.
 * Use for additional context or labels that shouldn't be visible.
 *
 * @example
 * ```tsx
 * <VisuallyHidden>
 *   This text will be read by screen readers but not visible
 * </VisuallyHidden>
 * ```
 */
export interface VisuallyHiddenProps {
  children: React.ReactNode;
  /**
   * Make focusable (for skip links)
   */
  focusable?: boolean;
  /**
   * Additional class names
   */
  className?: string;
}

export function VisuallyHidden({
  children,
  focusable = false,
  className = ''
}: VisuallyHiddenProps) {
  return (
    <span
      className={focusable ? 'sr-only-focusable' : 'sr-only'}
      className={className}
    >
      {children}
    </span>
  );
}

/**
 * FocusTrap Component Props
 *
 * Wraps children with a focus trap for modals and dialogs
 */
export interface FocusTrapProps {
  children: React.ReactNode;
  /**
   * Whether the trap is active
   */
  enabled?: boolean;
  /**
   * Callback when focus escapes (Escape pressed)
   */
  onEscape?: () => void;
}

/**
 * FocusTrap Component
 *
 * Traps keyboard focus within a container (for modals).
 * Tab cycles through focusable elements, Escape calls onEscape.
 *
 * @example
 * ```tsx
 * <FocusTrap enabled={isOpen} onEscape={onClose}>
 *   <ModalContent>
 *     Focus will be trapped here
 *   </ModalContent>
 * </FocusTrap>
 * ```
 */
export function FocusTrap({ children, enabled = true, onEscape }: FocusTrapProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!enabled) return;

    if (e.key === 'Escape') {
      onEscape?.();
      return;
    }

    if (e.key !== 'Tab') return;

    const container = e.currentTarget as HTMLElement;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey) {
      // Shift+Tab: moving backward
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: moving forward
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal={enabled ? 'true' : undefined}
    >
      {children}
    </div>
  );
}

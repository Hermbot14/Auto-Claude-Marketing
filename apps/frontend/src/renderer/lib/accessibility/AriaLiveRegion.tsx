/**
 * AriaLiveRegion Component
 *
 * Provides ARIA live regions for screen reader announcements.
 * This component should be mounted once at the app root level.
 *
 * @remarks
 * Live regions are special DOM elements that screen readers monitor
 * for changes. When content changes, the screen reader announces it to the user.
 *
 * This component provides two live regions:
 * 1. "polite" region - For non-urgent announcements (waits for user to be idle)
 * 2. "assertive" region - For urgent announcements (immediately interrupts)
 *
 * @example
 * ```tsx
 * import { AriaLiveRegion } from './lib/accessibility/AriaLiveRegion';
 *
 * function App() {
 *   return (
 *     <AriaLiveRegion>
 *       <SkipLinks />
 *       <MainContent />
 *     </AriaLiveRegion>
 *   );
 * }
 * ```
 *
 * @see {@link https://www.w3.org/WAI/ARIA/apg/patterns/live-region/}
 * @see {@link https://www.w3.org/TR/wai-aria-1.2/#aria-live}
 */

import { ReactNode } from 'react';

/**
 * Props for the AriaLiveRegion component
 */
export interface AriaLiveRegionProps {
  children: ReactNode;
  /**
   * Maximum number of messages to keep in queue
   * @default 5
   */
  queueSize?: number;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * AriaLiveRegion Component
 *
 * Renders ARIA live regions for screen reader announcements.
 * Should be placed at the app root level, wrapping all content.
 *
 * @param props - Component props
 * @returns Fragment with live regions and children
 */
export function AriaLiveRegion({
  children,
  queueSize = 5,
  className = '',
}: AriaLiveRegionProps) {
  return (
    <>
      {/* Polite region - announces when user is idle */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className={`sr-only ${className}`.trim()}
        data-aria-live-region="polite"
        data-max-queue={queueSize}
        aria-label="Screen reader announcements for non-urgent updates"
      />

      {/* Assertive region - announces immediately */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className={`sr-only ${className}`.trim()}
        data-aria-live-region="assertive"
        data-max-queue={queueSize}
        aria-label="Screen reader announcements for urgent updates"
      />

      {/* Main app content */}
      {children}
    </>
  );
}

/**
 * LiveRegionType enum for announcement priorities
 */
export enum LiveRegionType {
  /** Non-urgent, announced when user is idle */
  Polite = 'polite',
  /** Urgent, announced immediately */
  Assertive = 'assertive',
  /** Disabled, not announced */
  Off = 'off',
}

/**
 * Props for individual live region elements
 */
export interface LiveRegionElementProps {
  children?: ReactNode;
  /**
   * Type of live region (priority)
   */
  type?: LiveRegionType;
  /**
   * Unique identifier for the region
   */
  id?: string;
  /**
   * Additional CSS class names
   */
  className?: string;
  /**
   * Current message to announce (hidden visually)
   */
  message?: string;
}

/**
 * LiveRegionElement Component
 *
 * A single live region element for custom use cases.
 * Most apps should use AriaLiveRegion instead.
 *
 * @example
 * ```tsx
 * <LiveRegionElement type="assertive" message="Error occurred" />
 * ```
 */
export function LiveRegionElement({
  children,
  type = LiveRegionType.Polite,
  id,
  className = '',
  message,
}: LiveRegionElementProps) {
  const role = type === LiveRegionType.Assertive ? 'alert' : 'status';
  const live = type === LiveRegionType.Off ? 'off' : type;

  return (
    <div
      id={id}
      role={role}
      aria-live={live}
      aria-atomic="true"
      className={`sr-only ${className}`.trim()}
      aria-label={`Live region for ${type} announcements`}
    >
      {message && <span>{message}</span>}
      {children}
    </div>
  );
}

/**
 * Hook to get live region references for direct manipulation
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const politeRegion = useLiveRegionRef('polite');
 *
 *   const announce = (message: string) => {
 *     if (politeRegion.current) {
 *       politeRegion.current.textContent = message;
 *     }
 *   };
 *
 *   return <button onClick={() => announce('Clicked')}>Click me</button>;
 * }
 * ```
 */
export function useLiveRegionRef(type: LiveRegionType.Polite | LiveRegionType.Assertive) {
  const selector = `[data-aria-live-region="${type}"]`;
  const getRegion = () => document.querySelector(selector) as HTMLDivElement | null;
  return { current: getRegion() };
}

export default AriaLiveRegion;

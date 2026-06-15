/** App-owned telemetry interface. Components depend only on this — never on the SDK directly. */
export interface ITelemetry {
  /** Track a page navigation. */
  trackPageView(name: string, url?: string): void;

  /** Track an unhandled or caught error. */
  trackException(error: Error, properties?: Record<string, string>): void;

  /** Track a named custom event with optional metadata. */
  trackEvent(name: string, properties?: Record<string, string>): void;
}

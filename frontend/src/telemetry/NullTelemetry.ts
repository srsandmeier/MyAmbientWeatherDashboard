import type { ITelemetry } from './ITelemetry';

/** No-op telemetry used when no connection string is configured. */
export class NullTelemetry implements ITelemetry {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  trackPageView(_name: string, _url?: string): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  trackException(_error: Error, _properties?: Record<string, string>): void {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  trackEvent(_name: string, _properties?: Record<string, string>): void {}
}

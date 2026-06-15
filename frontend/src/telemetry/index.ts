import type { ITelemetry } from './ITelemetry';
import { NullTelemetry } from './NullTelemetry';

export type { ITelemetry };

// Mutable impl swapped in after the async import resolves.
let _impl: ITelemetry = new NullTelemetry();

/**
 * App-wide telemetry singleton. Starts as NullTelemetry; once the App Insights
 * SDK dynamic-import resolves, all calls are forwarded to the real SDK.
 *
 * Using a proxy + dynamic import keeps the 778 KB SDK out of the initial bundle
 * in environments where the connection string is absent (all local dev).
 */
export const telemetry: ITelemetry = {
  trackPageView: (name, url) => { _impl.trackPageView(name, url); },
  trackException: (error, properties) => { _impl.trackException(error, properties); },
  trackEvent: (name, properties) => { _impl.trackEvent(name, properties); },
};

const cs = import.meta.env.VITE_APPLICATIONINSIGHTS_CONNECTION_STRING;
if (typeof cs === 'string' && cs.trim().length > 0) {
  void import('./AppInsightsTelemetry').then(({ AppInsightsTelemetry }) => {
    _impl = new AppInsightsTelemetry(cs.trim());
  }).catch((err: unknown) => {
    // Cannot report this through the telemetry proxy (it's the thing that failed to load),
    // so fall back to the console — the only available channel.
    // eslint-disable-next-line no-console
    console.error('[telemetry] Failed to load Application Insights:', err);
  });
}

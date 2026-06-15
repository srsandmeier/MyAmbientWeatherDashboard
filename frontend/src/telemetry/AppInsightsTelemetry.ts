import { ApplicationInsights } from '@microsoft/applicationinsights-web';
import type { ITelemetry } from './ITelemetry';

/** Application Insights-backed telemetry implementation. Instantiated only when a connection string is present. */
export class AppInsightsTelemetry implements ITelemetry {
  private readonly _client: ApplicationInsights;

  constructor(connectionString: string) {
    this._client = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: false, // page views tracked manually via useLocation
        disableTelemetry: false,
      },
    });
    this._client.loadAppInsights();
  }

  trackPageView(name: string, url?: string): void {
    this._client.trackPageView({ name, uri: url });
  }

  trackException(error: Error, properties?: Record<string, string>): void {
    this._client.trackException({ exception: error, properties });
  }

  trackEvent(name: string, properties?: Record<string, string>): void {
    this._client.trackEvent({ name }, properties);
  }
}

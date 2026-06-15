import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NullTelemetry } from './NullTelemetry';
import type { ITelemetry } from './ITelemetry';
import { AppInsightsTelemetry } from './AppInsightsTelemetry';

interface MockSdkInstance {
  loadAppInsights: ReturnType<typeof vi.fn>;
  trackPageView: ReturnType<typeof vi.fn>;
  trackException: ReturnType<typeof vi.fn>;
  trackEvent: ReturnType<typeof vi.fn>;
}

const mockSdkInstance: MockSdkInstance = {
  loadAppInsights: vi.fn(),
  trackPageView: vi.fn(),
  trackException: vi.fn(),
  trackEvent: vi.fn(),
};

// Mock the App Insights SDK so tests never make network calls.
vi.mock('@microsoft/applicationinsights-web', () => ({
  ApplicationInsights: vi.fn().mockImplementation(function ApplicationInsights() {
    return mockSdkInstance;
  }),
}));

describe('NullTelemetry', () => {
  let t: ITelemetry;

  beforeEach(() => {
    t = new NullTelemetry();
  });

  it('trackPageView does not throw', () => {
    expect(() => { t.trackPageView('Home', '/'); }).not.toThrow();
  });

  it('trackException does not throw', () => {
    expect(() => { t.trackException(new Error('boom')); }).not.toThrow();
  });

  it('trackEvent does not throw', () => {
    expect(() => { t.trackEvent('test-event', { key: 'value' }); }).not.toThrow();
  });
});

describe('AppInsightsTelemetry', () => {
  let instance: AppInsightsTelemetry;

  beforeEach(() => {
    vi.clearAllMocks();
    instance = new AppInsightsTelemetry('InstrumentationKey=fake-key');
  });

  it('calls loadAppInsights on construction', () => {
    expect(mockSdkInstance.loadAppInsights).toHaveBeenCalledOnce();
  });

  it('forwards trackPageView to the SDK', () => {
    instance.trackPageView('Dashboard', '/');
    expect(mockSdkInstance.trackPageView).toHaveBeenCalledWith({ name: 'Dashboard', uri: '/' });
  });

  it('forwards trackException to the SDK', () => {
    const error = new Error('test error');
    instance.trackException(error);
    expect(mockSdkInstance.trackException).toHaveBeenCalledWith({
      exception: error,
      properties: undefined,
    });
  });

  it('forwards trackEvent to the SDK', () => {
    instance.trackEvent('button-click', { label: 'save' });
    expect(mockSdkInstance.trackEvent).toHaveBeenCalledWith(
      { name: 'button-click' },
      { label: 'save' },
    );
  });
});

describe('telemetry factory', () => {
  it('NullTelemetry is a safe no-op when env is absent', () => {
    const t = new NullTelemetry();
    expect(() => {
      t.trackPageView('test');
      t.trackException(new Error());
      t.trackEvent('evt');
    }).not.toThrow();
  });
});

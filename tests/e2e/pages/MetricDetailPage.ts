import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** Page object for the metric detail page (`/metrics/:metricKey`). */
export class MetricDetailPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  get root(): Locator {
    return this.byTestId('metric-detail-page');
  }

  get title(): Locator {
    return this.byTestId('metric-detail-title');
  }

  get rangeSelect(): Locator {
    return this.byTestId('metric-detail-range');
  }

  get daySelect(): Locator {
    return this.byTestId('metric-detail-day');
  }

  get dateInput(): Locator {
    return this.byTestId('metric-detail-date');
  }

  get granularitySelect(): Locator {
    return this.byTestId('metric-detail-granularity');
  }

  get comparisonSelect(): Locator {
    return this.byTestId('metric-detail-comparison-device');
  }

  get overlayState(): Locator {
    return this.byTestId('metric-detail-overlay-state');
  }

  get chart(): Locator {
    return this.byTestId('metric-detail-chart');
  }

  get historyContext(): Locator {
    return this.byTestId('metric-detail-history-context');
  }

  get historyTable(): Locator {
    return this.byTestId('metric-detail-history-table');
  }

  get historyTableToggle(): Locator {
    return this.byTestId('metric-detail-history-table-toggle');
  }

  get historyTableContent(): Locator {
    return this.byTestId('metric-detail-history-table-content');
  }

  get historyValues(): Locator {
    return this.byTestId('metric-detail-history-value');
  }

  get emptyState(): Locator {
    return this.byTestId('metric-detail-empty');
  }

  get emptyTitle(): Locator {
    return this.byTestId('metric-detail-empty-title');
  }

  get emptyDescription(): Locator {
    return this.byTestId('metric-detail-empty-description');
  }

  get unsupportedState(): Locator {
    return this.byTestId('metric-detail-unsupported');
  }

  get errorState(): Locator {
    return this.byTestId('metric-detail-error');
  }

  get retryButton(): Locator {
    return this.byTestId('metric-detail-retry');
  }

  async gotoMetric(metricKey: string): Promise<void> {
    await this.goto(`/metrics/${metricKey}`);
  }
}

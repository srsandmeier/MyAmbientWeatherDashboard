import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { WeatherAlertDto } from '../../types/alerts';

function severityClass(severity: string | null): string {
  switch ((severity ?? '').toLowerCase()) {
    case 'extreme':
      return 'border-destructive bg-destructive/10 text-destructive';
    case 'severe':
      return 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    default:
      return 'border-border bg-card text-card-foreground';
  }
}

export function AlertsBanner({ alerts }: { readonly alerts: readonly WeatherAlertDto[] }) {
  const [isOpen, setIsOpen] = useState(false);
  if (alerts.length === 0) return null;

  const primary = alerts[0];
  const role = ['extreme', 'severe'].includes((primary.severity ?? '').toLowerCase()) ? 'alert' : 'status';

  return (
    <section
      className={`rounded-md border p-3 ${severityClass(primary.severity)}`}
      role={role}
      aria-labelledby="dashboard-alerts-heading"
      data-test-id="dashboard-alerts-banner"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-current px-2 py-0.5 text-xs font-semibold" data-test-id="dashboard-alerts-severity">
              {primary.severity ?? 'Alert'}
            </span>
            <h2 id="dashboard-alerts-heading" className="text-sm font-semibold" data-test-id="dashboard-alerts-event">
              {primary.event ?? 'Weather alert'}
            </h2>
            <span className="text-xs font-medium opacity-90" data-test-id="dashboard-alerts-count">
              {alerts.length.toString()} warning{alerts.length === 1 ? '' : 's'}
            </span>
          </div>
          <p className="mt-1 text-sm" data-test-id="dashboard-alerts-headline">
            {primary.headline ?? primary.description ?? 'Active weather alert'}
          </p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={isOpen ? 'Collapse weather alerts' : 'Expand weather alerts'}
          aria-expanded={isOpen}
          onClick={() => { setIsOpen((value) => !value); }}
          data-test-id="dashboard-alerts-toggle"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} aria-hidden="true" />
        </button>
      </div>

      {isOpen && (
        <ul className="mt-3 space-y-2" data-test-id="dashboard-alerts-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="rounded-sm border border-current/20 bg-background/40 p-2">
              <p className="text-sm font-medium">{alert.event ?? 'Weather alert'}</p>
              <p className="text-sm">{alert.headline ?? alert.description ?? 'Active weather alert'}</p>
              {alert.areaDesc && <p className="mt-1 text-xs opacity-80">{alert.areaDesc}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

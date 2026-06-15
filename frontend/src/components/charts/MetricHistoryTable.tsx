import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { MetricHistoryPoint } from '../../types/metrics';

const TABLE_ROW_PREVIEW_LIMIT = 500;

interface MetricHistoryTableProps {
  readonly metricLabel: string;
  readonly unit: string;
  readonly points: readonly MetricHistoryPoint[];
  readonly defaultExpanded?: boolean;
  readonly timezone?: 'utc' | 'local';
}

/** Collapsible data table alternative to the history chart for non-graphical access. */
export function MetricHistoryTable({ metricLabel, unit, points, defaultExpanded = false, timezone = 'local' }: MetricHistoryTableProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [showAll, setShowAll] = useState(false);
  const contentId = useId();
  const captionText = unit.length > 0 ? `${metricLabel} history (${unit})` : `${metricLabel} history`;

  return (
    <div data-test-id="metric-detail-history-table">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => { setIsExpanded((prev) => !prev); }}
        data-test-id="metric-detail-history-table-toggle"
      >
        <span>Data table ({points.length.toString()} row{points.length === 1 ? '' : 's'})</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isExpanded && (
        <div id={contentId} className="mt-2 overflow-x-auto rounded-md border border-border" data-test-id="metric-detail-history-table-content">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">{captionText}</caption>
            <thead className="bg-muted text-foreground">
              <tr>
                <th className="px-3 py-2 font-medium" scope="col">Timestamp ({timezone === 'utc' ? 'UTC' : 'Local'})</th>
                <th className="px-3 py-2 font-medium" scope="col">
                  {unit.length > 0 ? `${metricLabel} (${unit})` : metricLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {(showAll ? points : points.slice(0, TABLE_ROW_PREVIEW_LIMIT)).map((point) => (
                <tr key={point.timestampUtc} className="border-t border-border">
                  <td className="px-3 py-2">{timezone === 'utc' ? formatTimestamp(point.timestampUtc) : formatTimestampLocal(point.timestampUtc)}</td>
                  <td className="px-3 py-2" data-test-id="metric-detail-history-value">
                    {point.value == null ? '—' : `${point.value.toString()} ${unit}`.trim()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!showAll && points.length > TABLE_ROW_PREVIEW_LIMIT && (
            <button
              type="button"
              className="w-full border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50"
              onClick={() => { setShowAll(true); }}
              data-test-id="metric-detail-history-table-show-all"
            >
              Show all {points.length.toString()} rows
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const yyyy = date.getUTCFullYear().toString();
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = date.getUTCDate().toString().padStart(2, '0');
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const min = date.getUTCMinutes().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

function formatTimestampLocal(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

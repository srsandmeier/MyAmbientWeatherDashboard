export interface RecentDayOption {
  readonly value: string;
  readonly label: string;
}

export function buildRecentDayOptions(): readonly RecentDayOption[] {
  return Array.from({ length: 14 }, (_, offset) => {
    const date = new Date();
    date.setDate(date.getDate() - offset);

    return {
      value: formatDateInputValue(date),
      label: formatRecentDayLabel(date, offset),
    };
  });
}

export function formatDateInputValue(date: Date): string {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatRecentDayLabel(date: Date, offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

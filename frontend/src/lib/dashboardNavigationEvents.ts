const SHOW_DASHBOARD_VIEW_EVENT = 'ambient-weather:show-dashboard-view';

/** Notify dashboard-local panels to close and reveal the normal dashboard view. */
export function dispatchShowDashboardView(): void {
  window.dispatchEvent(new Event(SHOW_DASHBOARD_VIEW_EVENT));
}

/** Subscribe to requests to reveal the normal dashboard view. */
export function addShowDashboardViewListener(listener: () => void): () => void {
  window.addEventListener(SHOW_DASHBOARD_VIEW_EVENT, listener);
  return () => {
    window.removeEventListener(SHOW_DASHBOARD_VIEW_EVENT, listener);
  };
}

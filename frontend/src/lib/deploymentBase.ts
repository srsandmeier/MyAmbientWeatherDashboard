function getBasePath(): string {
  const baseUrl = import.meta.env.BASE_URL;
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized === '' ? '' : normalized;
}

/** Builds an absolute URL inside the deployed SPA, including any Vite base path. */
export function getAppUrl(path: string): string {
  const baseUrl = import.meta.env.BASE_URL;
  return new URL(path.replace(/^\/+/, ''), `${window.location.origin}${baseUrl}`).toString();
}

/** Converts a browser URL path into a React Router path relative to the configured basename. */
export function normalizeRouterPath(path: string): string {
  const basePath = getBasePath();
  if (basePath.length === 0 || basePath === '/') {
    return path.startsWith('/') ? path : `/${path}`;
  }

  if (path === basePath) {
    return '/';
  }

  if (path.startsWith(basePath)) {
    const routePath = path.slice(basePath.length);
    if (routePath.length === 0) {
      return '/';
    }

    if (routePath.startsWith('/')) {
      return routePath;
    }

    if (routePath.startsWith('?') || routePath.startsWith('#')) {
      return `/${routePath}`;
    }
  }

  return path.startsWith('/') ? path : `/${path}`;
}

/** Returns the current browser path in React Router coordinates. */
export function getCurrentRouterPath(): string {
  return normalizeRouterPath(`${window.location.pathname}${window.location.search}${window.location.hash}`);
}

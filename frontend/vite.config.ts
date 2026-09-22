import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Subpath required when deployed to GitHub Pages at /<repo-name>/.
  // Opt-in flag (set only by the Pages build step) — GITHUB_ACTIONS itself is set for
  // every Actions job (including the E2E job's `npm run dev`) so it can't be used here.
  base: process.env.VITE_GH_PAGES_BUILD === 'true' ? '/MyAmbientWeatherDashboard/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      // Relaxed CSP for Vite HMR — eval and inline scripts are needed in dev only.
      'Content-Security-Policy': [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "connect-src 'self' ws://localhost:* http://localhost:* https://*.auth0.com https://example.auth0.test",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        'frame-src https://*.auth0.com https://example.auth0.test',
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        "object-src 'none'",
      ].join('; '),
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://localhost:5080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    // ECharts is intentionally isolated into a lazy metric-detail vendor chunk.
    // Keep the warning threshold above that known chart-library payload while
    // preserving warnings for unexpectedly huge app chunks.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      onwarn(warning, defaultHandler) {
        const warningId = warning.id ?? '';
        const isMicrosoftPackageAnnotationWarning =
          (
            warning.code === 'INVALID_ANNOTATION' ||
            warning.message.includes('contains an annotation that Rollup cannot interpret') ||
            warning.message.includes('contains an annotation that Rolldown cannot interpret')
          ) &&
          (
            warningId.includes('node_modules/@microsoft/applicationinsights') ||
            warningId.includes('node_modules/@microsoft/signalr')
          );

        if (isMicrosoftPackageAnnotationWarning) {
          return;
        }

        defaultHandler(warning);
      },
      output: {
        manualChunks(id) {
          // Group node_modules into stable vendor chunks so browsers can cache
          // library code independently of app code changes.
          if (!id.includes('node_modules')) return;

          // React core — largest and most stable; benefits most from long-term caching.
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) {
            return 'vendor-react';
          }
          // Auth0 SDK — versioned independently; kept separate for targeted cache busting.
          if (id.includes('@auth0/')) return 'vendor-auth';
          // React Router — app-shaped routing, changes with app updates.
          if (id.includes('react-router')) return 'vendor-router';
          // TanStack Query — server-state layer.
          if (id.includes('@tanstack/')) return 'vendor-query';
          // ECharts is large and only used on metric detail pages.
          if (id.includes('/echarts/') || id.includes('/zrender/') || id.includes('echarts-for-react')) {
            return 'vendor-charts';
          }
          // Radix UI primitives, Lucide icons, CVA utilities — UI building blocks.
          if (
            id.includes('@radix-ui/') ||
            id.includes('lucide-react') ||
            id.includes('class-variance-authority') ||
            id.includes('clsx') ||
            id.includes('tailwind-merge') ||
            id.includes('react-grid-layout') ||
            id.includes('react-resizable')
          ) {
            return 'vendor-ui';
          }
          // Unrecognised deps: let Rollup decide (typically merged into index chunk).
          return undefined;
        },
      },
    },
  },
});
// Test config lives in vitest.config.ts — Vitest uses that file when both exist.

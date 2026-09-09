import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// On GitHub Actions, GITHUB_REPOSITORY is "owner/repo" — use the repo name
// as the base path so assets resolve correctly on a project Pages site
// (https://<owner>.github.io/<repo>/). Locally (and for a custom domain or
// a user/org Pages site named <owner>.github.io), base stays '/'.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repoName && !repoName.endsWith('.github.io') ? `/${repoName}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // Offline support, step 1: precache the app shell so the app *loads*
    // with no connectivity. Content still needs the network at this stage
    // — caching plan data / weather comes in later steps of the offline
    // spec. See crew-plan-centerpiece-spec.md.
    VitePWA({
      // 'prompt', not 'autoUpdate': a crew member re-opening the app
      // mid-race must never be silently swapped onto a fresh bundle. The
      // UpdatePrompt component shows a dismissible "Refresh" toast instead.
      registerType: 'prompt',
      // We register manually from src/components/UpdatePrompt.tsx so we can
      // drive that toast, rather than letting the plugin inject a script.
      injectRegister: null,
      manifest: {
        name: 'The Runners Guru',
        short_name: 'Runners Guru',
        description:
          'Ultra-running crew planning — aid stations, cutoffs, crew logistics, and weather in one shared plan.',
        theme_color: '#345a2f',
        background_color: '#f7f7f1',
        display: 'standalone',
        // Relative so they inherit the deploy base ('/TheRunnersGuru/' on
        // GitHub Pages, '/' locally) — an absolute '/' would break the
        // project-subpath install.
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2}'],
        // Any unmatched navigation (e.g. a hard refresh on /crew-plan/<id>)
        // is served the cached shell so React Router can take over offline —
        // the same idea as the deploy workflow's `cp index.html 404.html`.
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        // Let the first-ever service worker take control of the page as
        // soon as it activates (no extra reload), so the Google-Fonts
        // requests fired by CSS @import on that first visit route through
        // the runtime cache below. Updates still wait for the user's
        // "Refresh" — skipWaiting stays off (registerType: 'prompt').
        clientsClaim: true,
        // Barlow / Barlow Condensed load from the Google Fonts CDN (see
        // styles.css). Cache the stylesheet + font files on first online
        // visit so the app doesn't fall back to system fonts offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Keep the service worker out of `npm run dev` — it only muddies the
      // local edit/reload loop. Test it against `npm run build && npm run
      // preview`.
      devOptions: { enabled: false },
    }),
  ],
});

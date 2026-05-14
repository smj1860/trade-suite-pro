import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// =============================================================================
// VITE CONFIG — TradeSuite PWA
//
// Key decisions:
//   - PWA service worker via vite-plugin-pwa (Workbox under the hood)
//   - COOP/COEP headers required for SQLite WASM + SharedArrayBuffer (OPFS)
//   - Assets cached aggressively; API calls network-first with cache fallback
// =============================================================================

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      // Generate SW at build time (not runtime) for predictable caching
      injectRegister: 'auto',

      manifest: {
        name:             'TradeSuite',
        short_name:       'TradeSuite',
        description:      'OmniBid · LeadLock · RepuGuard',
        theme_color:      '#093b31',
        background_color: '#f8f7f4',
        display:          'standalone',
        orientation:      'portrait',
        start_url:        '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'New Job',      url: '/jobs/new',       icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
          { name: 'New Estimate', url: '/estimates/new',  icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
        ],
      },

      workbox: {
        // App shell — cache first (works offline immediately)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],

        runtimeCaching: [
          {
            // Supabase API — network first, cache fallback for 5min
            urlPattern: /^https:\/\/.*\.supabase\.co\//,
            handler:    'NetworkFirst',
            options: {
              cacheName:          'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
          {
            // Google Fonts — cache first (static, never changes)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler:    'CacheFirst',
            options: {
              cacheName: 'google-fonts-styles',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler:    'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Anthropic API — network only (never cache AI responses)
            urlPattern: /^https:\/\/api\.anthropic\.com\//,
            handler:    'NetworkOnly',
          },
        ],
      },
    }),
  ],

  // COOP + COEP headers — required for SQLite WASM SharedArrayBuffer
  // Must be present in dev server AND production (set in deployment config too)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  preview: {
    headers: {
      'Cross-Origin-Opener-Policy':   'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },

  build: {
    target:   'es2020',
    rollupOptions: {
      output: {
        // Split vendor chunks for better caching
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'supabase':      ['@supabase/supabase-js'],
          'powersync':     ['@powersync/web'],
          'anthropic':     ['@anthropic-ai/sdk'],
        },
      },
    },
  },

  optimizeDeps: {
    // Exclude WASM modules from pre-bundling
    exclude: ['@powersync/web', '@journeyapps/wa-sqlite'],
  },
});

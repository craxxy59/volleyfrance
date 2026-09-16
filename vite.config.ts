import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'push-handler.js'],
      manifest: {
        name: 'VolleyFrance',
        short_name: 'VolleyFR',
        description: 'Clubs, scores, poules et notifs des équipes de volley en France',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'fr',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['/push-handler.js'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/ffvb-api/') ||
              url.pathname.startsWith('/ffvolley-api/') ||
              url.pathname.startsWith('/.netlify/functions/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vf-api',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 15 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/ffvb-api': {
        target: 'https://volley-ball.vercel.app',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ffvb-api/, '/api'),
      },
      '/ffvolley-api': {
        target: 'https://api.my.ffvolley.org',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/ffvolley-api/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})

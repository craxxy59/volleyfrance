import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'VolleyFrance',
        short_name: 'VolleyFR',
        description: 'Clubs, compétitions, scores et poules du volley français',
        theme_color: '#0a0e17',
        background_color: '#0a0e17',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'fr',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/volley-ball\.vercel\.app\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ffvb-results',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 30 },
            },
          },
          {
            urlPattern: /^https:\/\/api\.my\.ffvolley\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'ffvolley-api',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 },
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
        rewrite: (path) => path.replace(/^\/ffvb-api/, '/api'),
      },
      '/ffvolley-api': {
        target: 'https://api.my.ffvolley.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ffvolley-api/, ''),
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
  },
})

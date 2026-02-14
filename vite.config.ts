import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/chaos-core/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Chaos Core',
        short_name: 'Chaos Core',
        description: 'Chaos Core - a focused daily growth loop.',
        theme_color: '#090b10',
        background_color: '#090b10',
        display: 'standalone',
        start_url: '/chaos-core/',
        scope: '/chaos-core/',
        icons: [
          {
            src: '/chaos-core/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/chaos-core/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
});

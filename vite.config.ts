import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'chaos-core';
const repoBasePath = `/${repositoryName}/`;

export default defineConfig({
  base: repoBasePath,
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
        start_url: repoBasePath,
        scope: repoBasePath,
        icons: [
          {
            src: `${repoBasePath}pwa-192.svg`,
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: `${repoBasePath}pwa-512.svg`,
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ]
});

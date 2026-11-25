import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ command, isPreview }) => {
  return {
    define: { __APP_VERSION__: JSON.stringify(pkg.version) },
    base: command === 'build' || isPreview ? '/depri/' : '/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Depri – mein Tagebuch',
          short_name: 'Depri',
          description: 'Bewegung, Essen, Trinken, Stimmung, Schlaf und Medikamente festhalten.',
          lang: 'de',
          start_url: './#/heute',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f5f1ea',
          theme_color: '#f5f1ea',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        },
      }),
    ],
  }
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // Les images d'aperçu et les fonctions Vercel ne passent pas par l'app hors ligne
      workbox: { navigateFallbackDenylist: [/^\/api\//, /^\/og\//] },
      manifest: {
        name: 'tfek',
        short_name: 'tfek',
        description: 'Organise tes événements et sache qui vient.',
        lang: 'fr',
        theme_color: '#1b1e21',
        background_color: '#1b1e21',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173 },
})

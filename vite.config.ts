import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// versão do app = data/hora do build (aparece em Conta e é comparada com o servidor)
const VERSION = new Date().toISOString().slice(0, 19).replace('T', ' ')

export default defineConfig({
  root: 'web',
  define: { __APP_VERSION__: JSON.stringify(VERSION) },
  build: { outDir: '../dist', emptyOutDir: true },
  server: { host: true, proxy: { '/api': 'http://localhost:8787' } },
  plugins: [
    react(),
    { name: 'app-version', transformIndexHtml: (html: string) => html.replace('%APP_VERSION%', VERSION) },
    VitePWA({
      registerType: 'autoUpdate',
      // o registro é feito em web/src/pwa.ts (checa versão nova e recarrega)
      injectRegister: false,
      manifest: {
        name: 'Genshin Builder',
        short_name: 'Builder',
        lang: 'pt-BR',
        description: 'Equipes, armas e artefatos recomendados para a sua conta',
        theme_color: '#1b1d2a',
        background_color: '#1b1d2a',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/],
        // versão nova assume na hora, sem esperar fechar todas as abas
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})

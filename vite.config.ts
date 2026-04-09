import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'MGR Conect 2',
        short_name: 'MGR-Conect',
        description: 'Sistema de Gestão MGR - Inteligência Noturna e Offline',
        theme_color: '#059669', // Emerald 600
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        // Força o novo SW a assumir controle imediatamente
        skipWaiting: true,
        clientsClaim: true,
        // Limpa caches antigos automaticamente a cada deploy
        cleanupOutdatedCaches: true,
        // Apenas cache de assets estáticos — NÃO cachear HTML ou API
        runtimeCaching: [
          {
            // Imagens e fontes: cache longo com revalidação
            urlPattern: ({ request }) =>
              request.destination === 'image' || request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 dias
              },
            },
          },
          {
            // Scripts e styles: sempre buscar novo, servir cache se offline
            urlPattern: ({ request }) =>
              request.destination === 'script' || request.destination === 'style',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'code-cache',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24, // 1 dia
              },
            },
          },
        ],
      },
    }),
  ],
  base: './',
  server: {
    host: '0.0.0.0',
    port: 8080
  },
  preview: {
    host: true,
    port: 8080,
    allowedHosts: ['all']
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
          'ui-libs': ['lucide-react', 'clsx', 'tailwind-merge']
        }
      }
    }
  }
});

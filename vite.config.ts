import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Define base path para assets relativos
  server: {
    host: '0.0.0.0', // Escuta em todos os endereços
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
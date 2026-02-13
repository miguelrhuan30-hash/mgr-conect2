import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Define base path para assets relativos
  server: {
    host: true, // Escuta em todos os endereços (0.0.0.0)
    port: 8080
  },
  preview: {
    host: true, // Escuta em todos os endereços (0.0.0.0)
    port: 8080,
    allowedHosts: ['all'] 
  }
});
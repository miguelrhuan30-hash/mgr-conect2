import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// ═══════════════════════════════════════════════════════
// PWA: Força atualização automática quando novo deploy é detectado
// ═══════════════════════════════════════════════════════
const updateSW = registerSW({
  // Checa a cada 60 segundos se há nova versão
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 1000); // Verifica a cada 1 minuto
    }
  },
  // Quando nova versão é encontrada: atualiza imediatamente
  onNeedRefresh() {
    // Auto-reload: sem perguntar ao usuário
    updateSW(true);
  },
  // Se o SW ficou offline, simplesmente registra
  onOfflineReady() {
    console.log('[MGR] App pronta para uso offline.');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// ═══════════════════════════════════════════════════════
// PWA: Atualiza automaticamente, mas NUNCA no meio do uso.
// Recarregar a qualquer momento (como era antes) derrubava o
// colaborador no meio de um formulário (ex: entrada de veículo),
// perdendo fotos e dados já preenchidos. Agora o reload só acontece
// quando o app vai para 2º plano (troca de app, tela bloqueada etc.)
// — nesse momento não há formulário visível para perder.
// ═══════════════════════════════════════════════════════
let updatePendente = false;

const updateSW = registerSW({
  // Checa a cada 60 segundos se há nova versão
  onRegisteredSW(swUrl, registration) {
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 1000); // Verifica a cada 1 minuto
    }
  },
  // Quando nova versão é encontrada: só marca como pendente
  onNeedRefresh() {
    updatePendente = true;
    // Se o app já está em 2º plano agora, pode atualizar na hora
    if (document.visibilityState === 'hidden') {
      updateSW(true);
    }
  },
  // Se o SW ficou offline, simplesmente registra
  onOfflineReady() {
    console.log('[MGR] App pronta para uso offline.');
  },
});

// Aplica a atualização pendente assim que o app for para 2º plano —
// nunca enquanto o colaborador está com a tela aberta preenchendo algo.
document.addEventListener('visibilitychange', () => {
  if (updatePendente && document.visibilityState === 'hidden') {
    updateSW(true);
  }
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
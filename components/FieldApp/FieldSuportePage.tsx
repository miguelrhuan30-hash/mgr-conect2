/**
 * FieldSuportePage — destino do ícone "Suporte" no rodapé do FieldApp
 * (gestor). Página full-screen, wrapper fino sobre o SuporteInbox
 * compartilhado com a web.
 */
import React from 'react';
import SuporteInbox from '../SuporteInbox';

export default function FieldSuportePage() {
  return (
    <div className="h-full overflow-y-auto">
      <SuporteInbox variant="dark" />
    </div>
  );
}

/**
 * components/Portal/PortalFrotaPrestadores.tsx
 * "Prestadores" do módulo Frota no Portal do Cliente — wrapper fino sobre
 * components/Fleet/FleetProviders.tsx (modoPortal).
 */
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FleetProviders from '../Fleet/FleetProviders';

export default function PortalFrotaPrestadores() {
  const { userProfile } = useAuth();
  const clientId = (userProfile as any)?.clientId;

  if (!clientId) return <p className="text-sm text-gray-400">Nenhum cliente vinculado a este acesso.</p>;
  return <FleetProviders clientId={clientId} clientName={userProfile?.clientName} modoPortal />;
}

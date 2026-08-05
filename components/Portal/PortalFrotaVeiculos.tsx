/**
 * components/Portal/PortalFrotaVeiculos.tsx
 * "Veículos" do módulo Frota no Portal do Cliente — wrapper fino sobre
 * components/Fleet/FleetVehicles.tsx (modoPortal), mesmo padrão de
 * PortalAtivos.tsx sobre ClientAssets.tsx.
 */
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import FleetVehicles from '../Fleet/FleetVehicles';

export default function PortalFrotaVeiculos() {
  const { userProfile } = useAuth();
  const clientId = (userProfile as any)?.clientId;

  if (!clientId) return <p className="text-sm text-gray-400">Nenhum cliente vinculado a este acesso.</p>;
  return <FleetVehicles clientId={clientId} clientName={userProfile?.clientName} modoPortal />;
}

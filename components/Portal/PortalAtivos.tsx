/**
 * components/Portal/PortalAtivos.tsx
 * "Meus Ativos" — visão somente-leitura dos equipamentos do próprio cliente,
 * reaproveitando o mesmo componente usado pela equipe interna em
 * ClientAssets.tsx (modo readOnly, sem cadastro nem histórico de O.S.).
 */
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ClientAssets from '../ClientAssets';

export default function PortalAtivos() {
  const { userProfile } = useAuth();
  const clientId = (userProfile as any)?.clientId;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold text-gray-900">Meus Ativos</h1>
      {clientId
        ? <ClientAssets clientId={clientId} clientName={userProfile?.clientName} readOnly />
        : <p className="text-sm text-gray-400">Nenhum cliente vinculado a este acesso.</p>}
    </div>
  );
}

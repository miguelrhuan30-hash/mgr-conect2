/**
 * components/Portal/PortalContratoSLA.tsx
 * "Meu Contrato SLA" — visão somente-leitura do contrato do próprio cliente,
 * reaproveitando o mesmo componente usado pela equipe interna em
 * ClientContratoSLA.tsx (modo readOnly, sem botão de editar/criar).
 */
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import ClientContratoSLA from '../ClientContratoSLA';

export default function PortalContratoSLA() {
  const { userProfile } = useAuth();
  const clientId = (userProfile as any)?.clientId;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-extrabold text-gray-900">Meu Contrato SLA</h1>
      {clientId
        ? <ClientContratoSLA clientId={clientId} clientName={userProfile?.clientName} readOnly />
        : <p className="text-sm text-gray-400">Nenhum cliente vinculado a este acesso.</p>}
    </div>
  );
}

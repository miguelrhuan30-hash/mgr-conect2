/**
 * components/ClientAssets.tsx
 * "Ativos" de um cliente, embutido no card do cliente (Clients.tsx) ou no
 * Portal do Cliente (Portal/PortalAtivos.tsx, readOnly). Wrapper fino sobre
 * o componente único de Ativos/Maquinários (Assets.tsx) — antes disso existiam
 * duas implementações separadas mostrando a mesma coisa de jeitos diferentes.
 */
import React from 'react';
import Assets from './Assets';

interface ClientAssetsProps {
    clientId: string;
    clientName?: string;
    readOnly?: boolean;
}

const ClientAssets: React.FC<ClientAssetsProps> = ({ clientId, clientName, readOnly }) => (
    <Assets clientId={clientId} clientName={clientName} readOnly={readOnly} />
);

export default ClientAssets;

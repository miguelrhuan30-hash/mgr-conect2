/**
 * components/ProjectFaturamento.tsx
 *
 * Wrapper fino: mantém a mesma prop API usada por ProjectDetail.tsx, mas a UI
 * de verdade agora é genérica — ver components/FaturamentoPanel.tsx.
 */
import React from 'react';
import FaturamentoPanel from './FaturamentoPanel';

interface Props {
  projectId: string;
  projectNome: string;
  clientId: string;
  clientName: string;
  valorSugerido?: number;
}

const ProjectFaturamento: React.FC<Props> = ({ projectId, projectNome, clientId, clientName, valorSugerido }) => (
  <FaturamentoPanel
    referencia={{ tipo: 'projeto', projectId, projectNome }}
    clientId={clientId}
    clientName={clientName}
    valorSugerido={valorSugerido}
  />
);

export default ProjectFaturamento;

/**
 * components/IntelWorkspace.tsx — Intel Workspace v2 (Sprint IW-01)
 * Componente raiz do Hub de Inteligência Estratégica.
 * Substitui IntelModule.tsx na rota /inteligencia.
 * Sem dependência de API Gemini — 100% autônomo.
 */
import React, { lazy, Suspense, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { IntelToolId, IntelSlotKey } from '../types';
import { useIntelWorkspace } from '../hooks/useIntelWorkspace';
import WorkspaceLayout from './intel/WorkspaceLayout';

const EisenhowerTool = lazy(() => import('./intel/EisenhowerTool'));
const IshikawaTool   = lazy(() => import('./intel/IshikawaTool'));
const CanvasTool     = lazy(() => import('./intel/CanvasTool'));
const BpmnLiteTool   = lazy(() => import('./intel/BpmnLiteTool'));
const RoadmapTool    = lazy(() => import('./intel/RoadmapTool'));

const ToolLoader = () => (
  <div className="flex flex-col items-center justify-center py-24 gap-3">
    <Loader2 className="animate-spin text-brand-600 w-10 h-10" />
    <p className="text-sm text-gray-500">Carregando ferramenta...</p>
  </div>
);

const IntelWorkspace: React.FC = () => {
  const [activeTool, setActiveTool] = useState<IntelToolId>('eisenhower');

  const {
    toolState,
    loadingTool,
    allItems,
    saveSlot,
  } = useIntelWorkspace(activeTool);

  // Props compartilhadas entre todas as ferramentas
  const sharedProps = {
    toolState,
    loading: loadingTool,
    allItems,
    onSaveSlot: (slotKey: IntelSlotKey, text: string) => saveSlot(slotKey, text),
    onNavigate: setActiveTool,
  };

  return (
    <WorkspaceLayout activeTool={activeTool} onToolChange={setActiveTool}>
      <Suspense fallback={<ToolLoader />}>
        {activeTool === 'eisenhower' && <EisenhowerTool {...sharedProps} />}
        {activeTool === 'ishikawa'   && <IshikawaTool   {...sharedProps} />}
        {activeTool === 'canvas'     && <CanvasTool      {...sharedProps} />}
        {activeTool === 'bpmn'       && <BpmnLiteTool   {...sharedProps} />}
        {activeTool === 'roadmap'    && <RoadmapTool     {...sharedProps} />}
      </Suspense>
    </WorkspaceLayout>
  );
};

export default IntelWorkspace;

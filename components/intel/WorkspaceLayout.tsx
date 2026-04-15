/**
 * components/intel/WorkspaceLayout.tsx — Intel Workspace v2 (Sprint IW-01)
 * Layout principal com navegação entre as 5 ferramentas estratégicas.
 */
import React from 'react';
import { Brain, Sparkles } from 'lucide-react';
import { IntelToolId } from '../../types';

interface ToolMeta {
  label: string;
  icon: string;
  description: string;
  activeClass: string;
  dotColor: string;
}

export const TOOL_CONFIG: Record<IntelToolId, ToolMeta> = {
  eisenhower: {
    label: 'Eisenhower',
    icon: '📋',
    description: 'Urgência × Impacto',
    activeClass: 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 border-blue-600',
    dotColor: 'bg-blue-500',
  },
  ishikawa: {
    label: 'Ishikawa',
    icon: '🐟',
    description: 'Causa Raiz (6M)',
    activeClass: 'bg-red-600 text-white shadow-lg shadow-red-600/25 border-red-600',
    dotColor: 'bg-red-500',
  },
  canvas: {
    label: 'Canvas',
    icon: '▦',
    description: 'Business Model',
    activeClass: 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 border-indigo-600',
    dotColor: 'bg-indigo-500',
  },
  bpmn: {
    label: 'BPMN',
    icon: '⬡',
    description: 'Fluxo de Processo',
    activeClass: 'bg-purple-600 text-white shadow-lg shadow-purple-600/25 border-purple-600',
    dotColor: 'bg-purple-500',
  },
  roadmap: {
    label: 'Roadmap',
    icon: '→',
    description: 'Timeline Q1–Q4',
    activeClass: 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 border-amber-500',
    dotColor: 'bg-amber-500',
  },
};

interface WorkspaceLayoutProps {
  activeTool: IntelToolId;
  onToolChange: (tool: IntelToolId) => void;
  children: React.ReactNode;
}

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({ activeTool, onToolChange, children }) => {
  const tools = Object.entries(TOOL_CONFIG) as [IntelToolId, ToolMeta][];
  const activeMeta = TOOL_CONFIG[activeTool];

  return (
    <div className="max-w-7xl mx-auto pb-12">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
            <Brain size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inteligência Estratégica</h1>
            <p className="text-sm text-gray-500">
              Workspace multi-ferramenta com linking bidirecional
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-brand-50 text-brand-700 px-3 py-2 rounded-lg border border-brand-200 text-xs font-bold">
          <Sparkles size={14} className="animate-pulse" />
          <span className="uppercase tracking-wide">Linking ativo</span>
          <span className="bg-brand-600 text-white px-1.5 py-0.5 rounded text-[9px] font-extrabold">[[...]]</span>
        </div>
      </div>

      {/* ── Toolbar de ferramentas ──────────────────────────────── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        {tools.map(([toolId, meta]) => {
          const isActive = activeTool === toolId;
          return (
            <button
              key={toolId}
              id={`intel-tool-${toolId}`}
              onClick={() => onToolChange(toolId)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-bold whitespace-nowrap transition-all flex-shrink-0
                ${isActive
                  ? meta.activeClass
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
                }`}
            >
              <span className="text-base">{meta.icon}</span>
              <span>{meta.label}</span>
              {isActive && (
                <span className="text-[10px] opacity-80 hidden md:block ml-1">
                  — {meta.description}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Dica de linking ─────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-500">
        <span className="font-mono bg-white border border-gray-200 px-1.5 py-0.5 rounded text-[11px] text-brand-700 font-bold">[[nome do item]]</span>
        <span>para criar links entre ferramentas —</span>
        <span className="font-semibold text-gray-700">ferramenta ativa: {activeMeta.icon} {activeMeta.label}</span>
      </div>

      {/* ── Conteúdo da ferramenta ativa ────────────────────────── */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {children}
      </div>
    </div>
  );
};

export default WorkspaceLayout;

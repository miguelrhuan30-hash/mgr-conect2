/**
 * components/intel/BpmnLiteTool.tsx — Intel Workspace v2 (Sprint IW-01)
 * BPMN simplificado: 4 lanes (swimlanes) editáveis com [[linking]].
 */
import React, { useState } from 'react';
import { Loader2, Edit3, Check } from 'lucide-react';
import { IntelToolState, IntelItem, IntelToolId, BpmnSlot, IntelSlotKey } from '../../types';
import LinkRenderer from './LinkRenderer';

interface LaneConfig {
  key: BpmnSlot;
  label: string;
  emoji: string;
  color: string;
  border: string;
  header: string;
  placeholder: string;
}

const LANES: LaneConfig[] = [
  {
    key: 'lane_comercial',
    label: 'Lane Comercial',
    emoji: '💼',
    color: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-600 text-white',
    placeholder: 'Etapas do processo comercial:\n• Prospectar cliente\n• Enviar proposta\n• Negociar contrato\n\nUse [[item]] para linkar com Canvas ou Eisenhower.',
  },
  {
    key: 'lane_tecnico',
    label: 'Lane Técnico',
    emoji: '🔧',
    color: 'bg-slate-50',
    border: 'border-slate-200',
    header: 'bg-slate-600 text-white',
    placeholder: 'Etapas do processo técnico:\n• Vistoria técnica\n• Execução do serviço\n• Relatório final\n\nUse [[item]] para linkar.',
  },
  {
    key: 'lane_admin',
    label: 'Lane Administrativo',
    emoji: '📋',
    color: 'bg-violet-50',
    border: 'border-violet-200',
    header: 'bg-violet-600 text-white',
    placeholder: 'Etapas administrativas:\n• Emitir O.S.\n• Registrar ponto\n• Arquivar documentos\n\nUse [[item]] para linkar.',
  },
  {
    key: 'lane_financeiro',
    label: 'Lane Financeiro',
    emoji: '💰',
    color: 'bg-emerald-50',
    border: 'border-emerald-200',
    header: 'bg-emerald-600 text-white',
    placeholder: 'Etapas financeiras:\n• Emitir fatura\n• Registrar recebimento\n• Conciliar bancário\n\nUse [[item]] para linkar.',
  },
];

interface BpmnLiteToolProps {
  toolState: IntelToolState | null;
  loading: boolean;
  allItems: IntelItem[];
  onSaveSlot: (slotKey: IntelSlotKey, text: string) => void;
  onNavigate: (toolId: IntelToolId) => void;
}

const BpmnLiteTool: React.FC<BpmnLiteToolProps> = ({
  toolState, loading, allItems, onSaveSlot, onNavigate,
}) => {
  const [drafts, setDrafts] = useState<Partial<Record<BpmnSlot, string>>>({});
  const [editingSlot, setEditingSlot] = useState<BpmnSlot | null>(null);

  const getValue = (key: BpmnSlot): string =>
    drafts[key] ?? toolState?.slots[key] ?? '';

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-purple-600 w-10 h-10" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header descritivo */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">⬡</span>
        <div>
          <p className="text-sm font-bold text-purple-800">BPMN Lite — Mapeamento de Processos por Lane</p>
          <p className="text-xs text-purple-600">Descreva as etapas de cada setor no fluxo de atendimento. Use [[links]] para conectar com outras ferramentas.</p>
        </div>
      </div>

      {/* Swimlanes */}
      <div className="space-y-3">
        {LANES.map(lane => {
          const isEditing = editingSlot === lane.key;
          const value = getValue(lane.key);

          return (
            <div key={lane.key} className={`rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${lane.border}`}>
              <div className={`px-4 py-3 flex items-center justify-between ${lane.header}`}>
                <div className="flex items-center gap-2">
                  <span>{lane.emoji}</span>
                  <p className="font-extrabold text-sm">{lane.label}</p>
                </div>
                <button
                  onClick={() => setEditingSlot(isEditing ? null : lane.key)}
                  className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
                >
                  {isEditing ? <Check size={10} /> : <Edit3 size={10} />}
                  {isEditing ? 'Fechar' : 'Editar'}
                </button>
              </div>

              <div className={`p-4 min-h-32 ${lane.color}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={value}
                      onChange={e => {
                        const v = e.target.value;
                        setDrafts(d => ({ ...d, [lane.key]: v }));
                        onSaveSlot(lane.key, v);
                      }}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingSlot(null); }}
                      placeholder={lane.placeholder}
                      rows={6}
                      className="w-full text-sm p-3 bg-white rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-purple-300 font-mono leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-400 text-right">ESC para fechar • salvo automaticamente</p>
                  </div>
                ) : (
                  <div
                    className="text-sm text-gray-700 cursor-pointer min-h-24 leading-relaxed"
                    onClick={() => setEditingSlot(lane.key)}
                  >
                    {value ? (
                      <LinkRenderer raw={value} items={allItems} onNavigate={onNavigate} />
                    ) : (
                      <p className="text-gray-400 italic text-xs flex items-center gap-1.5 mt-1">
                        <Edit3 size={10} /> Clique para mapear as etapas desta lane...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        ⬡ BPMN Lite — Use <code className="bg-gray-100 px-1 rounded font-mono">[[etapa]]</code> para linkar processos com o Roadmap ou causas com o Ishikawa
      </p>
    </div>
  );
};

export default BpmnLiteTool;

/**
 * components/intel/EisenhowerTool.tsx — Intel Workspace v2 (Sprint IW-01)
 * Matriz de Eisenhower: 4 quadrantes editáveis com [[linking]].
 */
import React, { useState } from 'react';
import { Loader2, Edit3, Check } from 'lucide-react';
import { IntelToolState, IntelItem, IntelToolId, EisenhowerSlot, IntelSlotKey } from '../../types';
import LinkRenderer from './LinkRenderer';

interface SlotConfig {
  key: EisenhowerSlot;
  label: string;
  sub: string;
  headerClass: string;
  borderClass: string;
  bgClass: string;
  placeholder: string;
}

const SLOTS: SlotConfig[] = [
  {
    key: 'do',
    label: 'FAZER',
    sub: 'Urgente + Importante',
    headerClass: 'bg-red-500 text-white',
    borderClass: 'border-red-300',
    bgClass: 'bg-red-50',
    placeholder: 'Tarefas que exigem ação IMEDIATA\nEx: Cliente aguardando resposta urgente',
  },
  {
    key: 'plan',
    label: 'PLANEJAR',
    sub: 'Não-Urgente + Importante',
    headerClass: 'bg-blue-500 text-white',
    borderClass: 'border-blue-300',
    bgClass: 'bg-blue-50',
    placeholder: 'Iniciativas importantes mas que podem ser agendadas\nEx: Treinamento da equipe',
  },
  {
    key: 'dele',
    label: 'DELEGAR',
    sub: 'Urgente + Não-Importante',
    headerClass: 'bg-amber-500 text-white',
    borderClass: 'border-amber-300',
    bgClass: 'bg-amber-50',
    placeholder: 'Tarefas urgentes que outra pessoa pode resolver\nEx: Responder e-mails rotineiros',
  },
  {
    key: 'elim',
    label: 'ELIMINAR',
    sub: 'Não-Urgente + Não-Importante',
    headerClass: 'bg-gray-500 text-white',
    borderClass: 'border-gray-300',
    bgClass: 'bg-gray-50',
    placeholder: 'Atividades que consomem tempo sem gerar valor\nEx: Reuniões sem pauta definida',
  },
];

interface EisenhowerToolProps {
  toolState: IntelToolState | null;
  loading: boolean;
  allItems: IntelItem[];
  onSaveSlot: (slotKey: IntelSlotKey, text: string) => void;
  onNavigate: (toolId: IntelToolId) => void;
}

const EisenhowerTool: React.FC<EisenhowerToolProps> = ({
  toolState, loading, allItems, onSaveSlot, onNavigate,
}) => {
  const [drafts, setDrafts] = useState<Partial<Record<EisenhowerSlot, string>>>({});
  const [editingSlot, setEditingSlot] = useState<EisenhowerSlot | null>(null);

  const getValue = (key: EisenhowerSlot): string =>
    drafts[key] ?? toolState?.slots[key] ?? '';

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-blue-600 w-10 h-10" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Legenda de eixos */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-semibold">
            <div className="h-px w-16 bg-gray-300" />
            <span>NÃO URGENTE</span>
            <div className="h-px flex-1 bg-gray-300" />
            <span>URGENTE</span>
            <div className="h-px w-4 bg-gray-300" />
          </div>
        </div>
        <div />
      </div>

      {/* Grid 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SLOTS.map(slot => {
          const isEditing = editingSlot === slot.key;
          const value = getValue(slot.key);

          return (
            <div key={slot.key} className={`rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${slot.borderClass}`}>
              {/* Header */}
              <div className={`px-4 py-3 flex items-center justify-between ${slot.headerClass}`}>
                <div>
                  <p className="font-extrabold text-sm tracking-wider">{slot.label}</p>
                  <p className="text-[10px] opacity-80 font-medium">{slot.sub}</p>
                </div>
                <button
                  onClick={() => setEditingSlot(isEditing ? null : slot.key)}
                  className="flex items-center gap-1.5 text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition-all"
                >
                  {isEditing ? <Check size={11} /> : <Edit3 size={11} />}
                  {isEditing ? 'Fechar' : 'Editar'}
                </button>
              </div>

              {/* Conteúdo */}
              <div className={`p-4 min-h-48 ${slot.bgClass}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={value}
                      onChange={e => {
                        const v = e.target.value;
                        setDrafts(d => ({ ...d, [slot.key]: v }));
                        onSaveSlot(slot.key, v);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Escape') setEditingSlot(null);
                      }}
                      placeholder={`${slot.placeholder}\n\nUse [[nome do item]] para criar links entre ferramentas.`}
                      rows={8}
                      className="w-full text-sm p-3 bg-white rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono leading-relaxed"
                    />
                    <p className="text-[10px] text-gray-400 text-right">
                      ESC para fechar • salvo automaticamente
                    </p>
                  </div>
                ) : (
                  <div
                    className="text-sm text-gray-700 cursor-pointer min-h-40 leading-relaxed"
                    onClick={() => setEditingSlot(slot.key)}
                  >
                    {value ? (
                      <LinkRenderer raw={value} items={allItems} onNavigate={onNavigate} />
                    ) : (
                      <p className="text-gray-400 italic text-xs flex items-center gap-1.5 mt-2">
                        <Edit3 size={11} />
                        Clique para adicionar itens...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dica de uso */}
      <p className="text-[10px] text-gray-400 text-center mt-2">
        💡 Use <code className="bg-gray-100 px-1 rounded font-mono">[[nome do item]]</code> para criar links entre ferramentas — o item aparece no backlink da ferramenta de origem
      </p>
    </div>
  );
};

export default EisenhowerTool;

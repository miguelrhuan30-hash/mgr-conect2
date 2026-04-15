/**
 * components/intel/RoadmapTool.tsx — Intel Workspace v2 (Sprint IW-01)
 * Timeline de iniciativas: Q1, Q2, Q3, Q4 e Backlog — com [[linking]].
 */
import React, { useState } from 'react';
import { Loader2, Edit3, Check, CalendarDays } from 'lucide-react';
import { IntelToolState, IntelItem, IntelToolId, RoadmapSlot, IntelSlotKey } from '../../types';
import LinkRenderer from './LinkRenderer';

interface QuarterConfig {
  key: RoadmapSlot;
  label: string;
  sub: string;
  color: string;
  border: string;
  header: string;
  placeholder: string;
}

const QUARTERS: QuarterConfig[] = [
  {
    key: 'q1',
    label: 'Q1',
    sub: 'Jan – Mar',
    color: 'bg-blue-50',
    border: 'border-blue-200',
    header: 'bg-blue-600 text-white',
    placeholder: 'Iniciativas e marcos do 1º trimestre...\nEx: Implantar checklist de preventiva\n\nUse [[item]] para linkar.',
  },
  {
    key: 'q2',
    label: 'Q2',
    sub: 'Abr – Jun',
    color: 'bg-indigo-50',
    border: 'border-indigo-200',
    header: 'bg-indigo-600 text-white',
    placeholder: 'Iniciativas e marcos do 2º trimestre...\n\nUse [[item]] para linkar.',
  },
  {
    key: 'q3',
    label: 'Q3',
    sub: 'Jul – Set',
    color: 'bg-violet-50',
    border: 'border-violet-200',
    header: 'bg-violet-600 text-white',
    placeholder: 'Iniciativas e marcos do 3º trimestre...\n\nUse [[item]] para linkar.',
  },
  {
    key: 'q4',
    label: 'Q4',
    sub: 'Out – Dez',
    color: 'bg-purple-50',
    border: 'border-purple-200',
    header: 'bg-purple-600 text-white',
    placeholder: 'Iniciativas e marcos do 4º trimestre...\n\nUse [[item]] para linkar.',
  },
  {
    key: 'backlog',
    label: 'Backlog',
    sub: 'Sem data definida',
    color: 'bg-gray-50',
    border: 'border-gray-200',
    header: 'bg-gray-500 text-white',
    placeholder: 'Iniciativas identificadas mas ainda sem quarter definido...\nEx: Expandir para novo segmento de clientes\n\nUse [[item]] para linkar.',
  },
];

interface RoadmapToolProps {
  toolState: IntelToolState | null;
  loading: boolean;
  allItems: IntelItem[];
  onSaveSlot: (slotKey: IntelSlotKey, text: string) => void;
  onNavigate: (toolId: IntelToolId) => void;
}

const RoadmapTool: React.FC<RoadmapToolProps> = ({
  toolState, loading, allItems, onSaveSlot, onNavigate,
}) => {
  const [drafts, setDrafts] = useState<Partial<Record<RoadmapSlot, string>>>({});
  const [editingSlot, setEditingSlot] = useState<RoadmapSlot | null>(null);

  const getValue = (key: RoadmapSlot): string =>
    drafts[key] ?? toolState?.slots[key] ?? '';

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-amber-600 w-10 h-10" />
    </div>
  );

  const quarters = QUARTERS.slice(0, 4);
  const backlog = QUARTERS[4];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <CalendarDays size={20} className="text-amber-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-bold text-amber-800">Roadmap Estratégico — {new Date().getFullYear()}</p>
          <p className="text-xs text-amber-600">Distribua suas iniciativas por trimestre. Use [[links]] para conectar com Canvas, Eisenhower ou BPMN.</p>
        </div>
      </div>

      {/* Q1–Q4 em grid horizontal */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quarters.map(q => {
          const isEditing = editingSlot === q.key;
          const value = getValue(q.key);

          return (
            <div key={q.key} className={`rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${q.border}`}>
              <div className={`px-4 py-3 flex items-center justify-between ${q.header}`}>
                <div>
                  <p className="font-extrabold text-lg leading-none">{q.label}</p>
                  <p className="text-[10px] opacity-80 font-medium">{q.sub}</p>
                </div>
                <button
                  onClick={() => setEditingSlot(isEditing ? null : q.key)}
                  className="text-[9px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-all flex items-center gap-1"
                >
                  {isEditing ? <Check size={9} /> : <Edit3 size={9} />}
                  {isEditing ? 'OK' : 'Editar'}
                </button>
              </div>

              <div className={`p-4 min-h-56 ${q.color}`}>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      autoFocus
                      value={value}
                      onChange={e => {
                        const v = e.target.value;
                        setDrafts(d => ({ ...d, [q.key]: v }));
                        onSaveSlot(q.key, v);
                      }}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingSlot(null); }}
                      placeholder={q.placeholder}
                      rows={8}
                      className="w-full text-sm p-3 bg-white rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 font-mono leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-400 text-right">ESC para fechar</p>
                  </div>
                ) : (
                  <div
                    className="text-sm text-gray-700 cursor-pointer min-h-44 leading-relaxed"
                    onClick={() => setEditingSlot(q.key)}
                  >
                    {value ? (
                      <LinkRenderer raw={value} items={allItems} onNavigate={onNavigate} />
                    ) : (
                      <p className="text-gray-400 italic text-xs flex items-center gap-1.5 mt-1">
                        <Edit3 size={10} /> Clique para adicionar iniciativas...
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Backlog */}
      <div className={`rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${backlog.border}`}>
        <div className={`px-4 py-3 flex items-center justify-between ${backlog.header}`}>
          <div>
            <p className="font-extrabold text-sm">{backlog.label}</p>
            <p className="text-[10px] opacity-80">{backlog.sub}</p>
          </div>
          <button
            onClick={() => setEditingSlot(editingSlot === backlog.key ? null : backlog.key)}
            className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1"
          >
            {editingSlot === backlog.key ? <Check size={10} /> : <Edit3 size={10} />}
            {editingSlot === backlog.key ? 'Fechar' : 'Editar'}
          </button>
        </div>
        <div className={`p-4 min-h-24 ${backlog.color}`}>
          {editingSlot === backlog.key ? (
            <div className="space-y-2">
              <textarea
                autoFocus
                value={getValue(backlog.key)}
                onChange={e => {
                  const v = e.target.value;
                  setDrafts(d => ({ ...d, [backlog.key]: v }));
                  onSaveSlot(backlog.key, v);
                }}
                onKeyDown={e => { if (e.key === 'Escape') setEditingSlot(null); }}
                placeholder={backlog.placeholder}
                rows={4}
                className="w-full text-sm p-3 bg-white rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono leading-relaxed"
              />
              <p className="text-[9px] text-gray-400 text-right">ESC para fechar</p>
            </div>
          ) : (
            <div
              className="text-sm text-gray-700 cursor-pointer leading-relaxed"
              onClick={() => setEditingSlot(backlog.key)}
            >
              {getValue(backlog.key) ? (
                <LinkRenderer raw={getValue(backlog.key)} items={allItems} onNavigate={onNavigate} />
              ) : (
                <p className="text-gray-400 italic text-xs flex items-center gap-1.5">
                  <Edit3 size={10} /> Clique para preencher o backlog...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        → Roadmap {new Date().getFullYear()} — Use <code className="bg-gray-100 px-1 rounded font-mono">[[iniciativa]]</code> para linkar com o Eisenhower ou Canvas
      </p>
    </div>
  );
};

export default RoadmapTool;

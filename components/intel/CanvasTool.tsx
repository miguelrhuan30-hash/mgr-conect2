/**
 * components/intel/CanvasTool.tsx — Intel Workspace v2 (Sprint IW-01)
 * Business Model Canvas: 9 blocos editáveis com [[linking]].
 */
import React, { useState } from 'react';
import { Loader2, Edit3, Check } from 'lucide-react';
import { IntelToolState, IntelItem, IntelToolId, CanvasSlot, IntelSlotKey } from '../../types';
import LinkRenderer from './LinkRenderer';

interface BlocoConfig {
  key: CanvasSlot;
  label: string;
  emoji: string;
  color: string;
  border: string;
  header: string;
  colSpan: string;
  minH: string;
  placeholder: string;
}

const BLOCOS: BlocoConfig[] = [
  { key: 'parceiros',     label: 'Parceiros-Chave',          emoji: '🤝', color: 'bg-blue-50',   border: 'border-blue-200',   header: 'bg-blue-600 text-white',   colSpan: 'col-span-1', minH: 'min-h-44', placeholder: 'Quem são os seus parceiros e fornecedores estratégicos?' },
  { key: 'atividades',    label: 'Atividades-Chave',         emoji: '⚡', color: 'bg-violet-50', border: 'border-violet-200', header: 'bg-violet-600 text-white', colSpan: 'col-span-1', minH: 'min-h-44', placeholder: 'Quais atividades são essenciais para entregar sua proposta de valor?' },
  { key: 'proposta',      label: 'Proposta de Valor',        emoji: '💎', color: 'bg-amber-50',  border: 'border-amber-300',  header: 'bg-amber-500 text-white',  colSpan: 'col-span-1 row-span-2', minH: 'min-h-96',  placeholder: 'Qual problema você resolve?\nQual valor você entrega ao cliente?' },
  { key: 'relacionamento',label: 'Relacionamento c/ Clientes',emoji: '💬', color: 'bg-pink-50',   border: 'border-pink-200',   header: 'bg-pink-600 text-white',   colSpan: 'col-span-1', minH: 'min-h-44', placeholder: 'Como você interage com seus clientes?' },
  { key: 'clientes',      label: 'Segmento de Clientes',     emoji: '👥', color: 'bg-emerald-50',border: 'border-emerald-200',header: 'bg-emerald-600 text-white', colSpan: 'col-span-1 row-span-2', minH: 'min-h-96',  placeholder: 'Para quem você cria valor?\nQuais segmentos você atende?' },
  { key: 'recursos',      label: 'Recursos-Chave',           emoji: '🏗️', color: 'bg-slate-50',  border: 'border-slate-200',  header: 'bg-slate-600 text-white',  colSpan: 'col-span-1', minH: 'min-h-44', placeholder: 'Quais recursos físicos, humanos ou financeiros são indispensáveis?' },
  { key: 'canais',        label: 'Canais',                   emoji: '📡', color: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-600 text-white', colSpan: 'col-span-1', minH: 'min-h-44', placeholder: 'Como você alcança e entrega valor ao cliente?' },
  { key: 'custos',        label: 'Estrutura de Custos',      emoji: '💸', color: 'bg-red-50',    border: 'border-red-200',    header: 'bg-red-600 text-white',    colSpan: 'col-span-2', minH: 'min-h-32', placeholder: 'Quais são os principais custos do seu modelo de negócio?' },
  { key: 'receitas',      label: 'Fontes de Receita',        emoji: '💰', color: 'bg-green-50',  border: 'border-green-200',  header: 'bg-green-600 text-white',  colSpan: 'col-span-3', minH: 'min-h-32', placeholder: 'Como você gera receita? Quais são os fluxos de caixa?' },
];

interface CanvasToolProps {
  toolState: IntelToolState | null;
  loading: boolean;
  allItems: IntelItem[];
  onSaveSlot: (slotKey: IntelSlotKey, text: string) => void;
  onNavigate: (toolId: IntelToolId) => void;
}

const CanvasTool: React.FC<CanvasToolProps> = ({
  toolState, loading, allItems, onSaveSlot, onNavigate,
}) => {
  const [drafts, setDrafts] = useState<Partial<Record<CanvasSlot, string>>>({});
  const [editingSlot, setEditingSlot] = useState<CanvasSlot | null>(null);

  const getValue = (key: CanvasSlot): string =>
    drafts[key] ?? toolState?.slots[key] ?? '';

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
    </div>
  );

  // BMC Layout: 5 colunas, grid complexo
  const topRow = BLOCOS.slice(0, 5);
  const bottomRow = BLOCOS.slice(5, 7);
  const footer = BLOCOS.slice(7);

  const renderBloco = (bloco: BlocoConfig) => {
    const isEditing = editingSlot === bloco.key;
    const value = getValue(bloco.key);

    return (
      <div key={bloco.key} className={`rounded-xl border-2 overflow-hidden transition-shadow hover:shadow-md flex flex-col ${bloco.border}`}>
        <div className={`px-3 py-2 flex items-center justify-between flex-shrink-0 ${bloco.header}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{bloco.emoji}</span>
            <p className="font-bold text-xs">{bloco.label}</p>
          </div>
          <button
            onClick={() => setEditingSlot(isEditing ? null : bloco.key)}
            className="text-[9px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-all flex items-center gap-1"
          >
            {isEditing ? <Check size={9} /> : <Edit3 size={9} />}
            {isEditing ? 'OK' : 'Editar'}
          </button>
        </div>
        <div className={`flex-1 p-3 ${bloco.color} ${bloco.minH}`}>
          {isEditing ? (
            <div className="space-y-1.5 h-full">
              <textarea
                autoFocus
                value={value}
                onChange={e => {
                  const v = e.target.value;
                  setDrafts(d => ({ ...d, [bloco.key]: v }));
                  onSaveSlot(bloco.key, v);
                }}
                onKeyDown={e => { if (e.key === 'Escape') setEditingSlot(null); }}
                placeholder={`${bloco.placeholder}\n\nUse [[item]] para linkar.`}
                className="w-full h-full min-h-28 text-xs p-2.5 bg-white rounded-lg border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono leading-relaxed"
              />
              <p className="text-[9px] text-gray-400 text-right">ESC para fechar</p>
            </div>
          ) : (
            <div
              className="text-xs text-gray-700 cursor-pointer leading-relaxed h-full"
              onClick={() => setEditingSlot(bloco.key)}
            >
              {value ? (
                <LinkRenderer raw={value} items={allItems} onNavigate={onNavigate} />
              ) : (
                <p className="text-gray-400 italic text-[10px] flex items-center gap-1 mt-1">
                  <Edit3 size={9} /> Clique para editar...
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 font-semibold text-center uppercase tracking-widest">
        ▦ Business Model Canvas
      </div>

      {/* Grid BMC 5 colunas */}
      <div className="grid grid-cols-5 gap-3">
        {/* Linha 1: Parceiros (1col) | Atividades (1col) | Proposta (1col, 2rows) | Relacionamento (1col) | Clientes (1col, 2rows) */}
        <div>{renderBloco(BLOCOS[0])}</div>
        <div>{renderBloco(BLOCOS[1])}</div>
        <div className="row-span-2">{renderBloco(BLOCOS[2])}</div>
        <div>{renderBloco(BLOCOS[3])}</div>
        <div className="row-span-2">{renderBloco(BLOCOS[4])}</div>
        {/* Linha 2: Recursos | Canais */}
        <div>{renderBloco(BLOCOS[5])}</div>
        <div>{renderBloco(BLOCOS[6])}</div>
      </div>

      {/* Linha de custos e receitas */}
      <div className="grid grid-cols-2 gap-3">
        {renderBloco(BLOCOS[7])}
        {renderBloco(BLOCOS[8])}
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        ▦ Business Model Canvas — Use <code className="bg-gray-100 px-1 rounded font-mono">[[item]]</code> para linkar iniciativas do Roadmap ou causas do Ishikawa
      </p>
    </div>
  );
};

export default CanvasTool;

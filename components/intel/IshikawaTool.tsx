/**
 * components/intel/IshikawaTool.tsx — Intel Workspace v2 (Sprint IW-01)
 * Diagrama de Ishikawa (Espinha de Peixe): 6 causas editáveis com [[linking]].
 */
import React, { useState } from 'react';
import { Loader2, Edit3, Check, AlertTriangle } from 'lucide-react';
import { IntelToolState, IntelItem, IntelToolId, IshikawaSlot, IntelSlotKey } from '../../types';
import LinkRenderer from './LinkRenderer';

interface CausaConfig {
  key: IshikawaSlot;
  label: string;
  emoji: string;
  color: string;
  border: string;
  header: string;
  placeholder: string;
}

const CAUSAS: CausaConfig[] = [
  { key: 'metodo',      label: 'Método',       emoji: '📐', color: 'bg-blue-50',   border: 'border-blue-200',   header: 'bg-blue-500 text-white',   placeholder: 'Processos, procedimentos, padrões inadequados...' },
  { key: 'mao_de_obra', label: 'Mão de Obra',  emoji: '👥', color: 'bg-green-50',  border: 'border-green-200',  header: 'bg-green-500 text-white',  placeholder: 'Treinamento, habilidades, motivação da equipe...' },
  { key: 'maquina',     label: 'Máquina',      emoji: '⚙️', color: 'bg-slate-50',  border: 'border-slate-200',  header: 'bg-slate-500 text-white',  placeholder: 'Ferramentas, equipamentos, manutenção...' },
  { key: 'material',    label: 'Material',     emoji: '📦', color: 'bg-orange-50', border: 'border-orange-200', header: 'bg-orange-500 text-white', placeholder: 'Insumos, qualidade de materiais, fornecedores...' },
  { key: 'meio',        label: 'Meio Ambiente', emoji: '🌍', color: 'bg-teal-50',   border: 'border-teal-200',   header: 'bg-teal-500 text-white',   placeholder: 'Condições físicas, temperatura, ambiente de trabalho...' },
  { key: 'medicao',     label: 'Medição',      emoji: '📊', color: 'bg-purple-50', border: 'border-purple-200', header: 'bg-purple-500 text-white', placeholder: 'Indicadores, métricas, métodos de acompanhamento...' },
];

interface IshikawaToolProps {
  toolState: IntelToolState | null;
  loading: boolean;
  allItems: IntelItem[];
  onSaveSlot: (slotKey: IntelSlotKey, text: string) => void;
  onNavigate: (toolId: IntelToolId) => void;
}

const IshikawaTool: React.FC<IshikawaToolProps> = ({
  toolState, loading, allItems, onSaveSlot, onNavigate,
}) => {
  const [drafts, setDrafts] = useState<Partial<Record<IshikawaSlot, string>>>({});
  const [editingSlot, setEditingSlot] = useState<IshikawaSlot | null>(null);
  const [problema, setProblema] = useState(toolState?.slots['metodo' as IshikawaSlot] ?? '');

  const getValue = (key: IshikawaSlot): string =>
    drafts[key] ?? toolState?.slots[key] ?? '';

  if (loading) return (
    <div className="flex justify-center py-24">
      <Loader2 className="animate-spin text-red-600 w-10 h-10" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Cabeça do peixe — Problema/Efeito */}
      <div className="bg-red-600 rounded-2xl p-5 text-white shadow-lg shadow-red-600/20">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <div>
            <p className="font-extrabold text-sm">PROBLEMA / EFEITO</p>
            <p className="text-[10px] opacity-80">Qual é o problema que você quer analisar?</p>
          </div>
        </div>
        <input
          value={toolState?.slots['medicao' as IshikawaSlot] ?? problema}
          onChange={e => {
            setProblema(e.target.value);
            onSaveSlot('medicao', e.target.value);
          }}
          placeholder="Descreva o problema central que está sendo investigado..."
          className="w-full bg-white/20 border border-white/30 rounded-xl px-4 py-2.5 text-sm font-medium placeholder:text-white/50 focus:outline-none focus:bg-white/30 text-white"
        />
      </div>

      {/* 6 Causas em grid 2×3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CAUSAS.map(causa => {
          const isEditing = editingSlot === causa.key;
          const value = getValue(causa.key);

          return (
            <div key={causa.key} className={`rounded-2xl border-2 overflow-hidden transition-shadow hover:shadow-md ${causa.border}`}>
              <div className={`px-4 py-3 flex items-center justify-between ${causa.header}`}>
                <div className="flex items-center gap-2">
                  <span>{causa.emoji}</span>
                  <div>
                    <p className="font-extrabold text-sm">{causa.label}</p>
                    <p className="text-[9px] opacity-75 font-medium">6M — Causa Raiz</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSlot(isEditing ? null : causa.key)}
                  className="text-[10px] font-bold bg-white/20 hover:bg-white/30 px-2 py-1 rounded-lg transition-all flex items-center gap-1"
                >
                  {isEditing ? <Check size={10} /> : <Edit3 size={10} />}
                  {isEditing ? 'OK' : 'Editar'}
                </button>
              </div>

              <div className={`p-4 min-h-40 ${causa.color}`}>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      autoFocus
                      value={value}
                      onChange={e => {
                        const v = e.target.value;
                        setDrafts(d => ({ ...d, [causa.key]: v }));
                        onSaveSlot(causa.key, v);
                      }}
                      onKeyDown={e => { if (e.key === 'Escape') setEditingSlot(null); }}
                      placeholder={`${causa.placeholder}\n\nUse [[item]] para linkar com outra ferramenta.`}
                      rows={6}
                      className="w-full text-sm p-3 bg-white rounded-xl border border-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 font-mono leading-relaxed"
                    />
                    <p className="text-[9px] text-gray-400 text-right">ESC para fechar • auto-salvo</p>
                  </div>
                ) : (
                  <div
                    className="text-sm text-gray-700 cursor-pointer min-h-32 leading-relaxed"
                    onClick={() => setEditingSlot(causa.key)}
                  >
                    {value ? (
                      <LinkRenderer raw={value} items={allItems} onNavigate={onNavigate} />
                    ) : (
                      <p className="text-gray-400 italic text-xs flex items-center gap-1.5 mt-1">
                        <Edit3 size={10} /> Clique para listar causas...
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
        🐟 Diagrama de Ishikawa (6M) — Use <code className="bg-gray-100 px-1 rounded font-mono">[[causa]]</code> para linkar com Eisenhower, Canvas ou Roadmap
      </p>
    </div>
  );
};

export default IshikawaTool;

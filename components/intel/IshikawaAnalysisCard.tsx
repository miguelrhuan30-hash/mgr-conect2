/**
 * components/intel/IshikawaAnalysisCard.tsx — Sprint IW-02
 * Card visual de uma análise Ishikawa: nome, data, progresso dos 6Ms.
 */
import React, { useState } from 'react';
import { Edit3, Trash2, MoreVertical, Fish, Check, X } from 'lucide-react';
import { IshikawaAnalysis, IshikawaSlot } from '../../types';

const ALL_SLOTS: IshikawaSlot[] = [
  'metodo', 'mao_de_obra', 'maquina', 'material', 'meio', 'medicao'
];

function calcProgresso(analysis: IshikawaAnalysis): number {
  const filled = ALL_SLOTS.filter(s => {
    const v = analysis.slots[s];
    return v && v.trim().length > 0;
  }).length;
  return Math.round((filled / ALL_SLOTS.length) * 100);
}

function formatDate(ts: any): string {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Agora mesmo';
  if (diffMin < 60) return `${diffMin}min atrás`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atrás`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d atrás`;
  return date.toLocaleDateString('pt-BR');
}

interface IshikawaAnalysisCardProps {
  analysis: IshikawaAnalysis;
  onOpen: (id: string) => void;
  onRename: (id: string, novoNome: string) => void;
  onDelete: (id: string) => void;
}

const IshikawaAnalysisCard: React.FC<IshikawaAnalysisCardProps> = ({
  analysis, onOpen, onRename, onDelete,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftNome, setDraftNome] = useState(analysis.nome);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const progresso = calcProgresso(analysis);

  const handleRenameSubmit = () => {
    if (draftNome.trim().length >= 3) {
      onRename(analysis.id, draftNome.trim());
    }
    setRenaming(false);
    setMenuOpen(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(analysis.id);
    setConfirmDelete(false);
    setMenuOpen(false);
  };

  // Cor da barra de progresso
  const progressColor =
    progresso === 100 ? 'bg-emerald-500' :
    progresso >= 50   ? 'bg-amber-400' :
    progresso > 0     ? 'bg-red-400' :
                        'bg-gray-200';

  return (
    <div
      className="relative bg-white rounded-2xl border-2 border-gray-100 hover:border-red-200 hover:shadow-lg hover:shadow-red-600/8 transition-all duration-200 cursor-pointer group overflow-hidden"
      onClick={() => !menuOpen && !renaming && !confirmDelete && onOpen(analysis.id)}
    >
      {/* Accent bar esquerda */}
      <div className="absolute inset-y-0 left-0 w-1 bg-red-600 rounded-l-2xl" />

      <div className="p-5 pl-6">
        {/* Header: nome + menu */}
        <div className="flex items-start justify-between gap-2 mb-3">
          {renaming ? (
            <div className="flex-1 flex gap-2" onClick={e => e.stopPropagation()}>
              <input
                autoFocus
                value={draftNome}
                onChange={e => setDraftNome(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') { setRenaming(false); setDraftNome(analysis.nome); }
                }}
                maxLength={120}
                className="flex-1 text-sm font-bold border border-red-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-red-300"
              />
              <button onClick={handleRenameSubmit} className="text-emerald-600 hover:text-emerald-700">
                <Check size={16} />
              </button>
              <button onClick={() => { setRenaming(false); setDraftNome(analysis.nome); }} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <Fish size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
              <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-red-700 transition-colors">
                {analysis.nome}
              </h3>
            </div>
          )}

          {/* Menu contextual */}
          <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all opacity-0 group-hover:opacity-100"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-7 z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 w-40 text-sm">
                  <button
                    onClick={() => { setRenaming(true); setMenuOpen(false); }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit3 size={13} className="text-blue-500" /> Renomear
                  </button>
                  {!confirmDelete ? (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="flex items-center gap-2.5 w-full px-3 py-2 text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={13} /> Excluir
                    </button>
                  ) : (
                    <div className="px-3 py-2">
                      <p className="text-[11px] text-gray-500 mb-2">Confirmar exclusão?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleDeleteConfirm}
                          className="flex-1 text-[11px] bg-red-600 text-white rounded-lg py-1 font-bold hover:bg-red-700"
                        >
                          Sim
                        </button>
                        <button
                          onClick={() => { setConfirmDelete(false); setMenuOpen(false); }}
                          className="flex-1 text-[11px] bg-gray-100 text-gray-700 rounded-lg py-1 font-bold hover:bg-gray-200"
                        >
                          Não
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Problema — preview */}
        {analysis.problema && (
          <p className="text-xs text-gray-500 mb-3 line-clamp-1 italic">
            🎯 {analysis.problema}
          </p>
        )}

        {/* Barra de progresso 6Ms */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">6Ms preenchidos</span>
            <span className={`text-[10px] font-extrabold ${progresso === 100 ? 'text-emerald-600' : 'text-gray-500'}`}>
              {progresso}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        {/* Footer: data + autor */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
          <span className="text-[10px] text-gray-400">
            {formatDate(analysis.updatedAt)}
          </span>
          <span className="text-[10px] text-gray-400 font-medium">
            {analysis.createdByName}
          </span>
        </div>
      </div>
    </div>
  );
};

export default IshikawaAnalysisCard;

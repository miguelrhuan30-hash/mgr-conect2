/**
 * components/OSFaturamentoModal.tsx
 *
 * Módulo de faturamento de O.S. avulsa — uma única O.S. ou um grupo (várias
 * O.S. cobradas juntas num plano só). Corpo reaproveita FaturamentoPanel,
 * o mesmo motor usado pelo faturamento de projeto.
 */
import React from 'react';
import { X, DollarSign, Hash } from 'lucide-react';
import { Task } from '../types';
import FaturamentoPanel from './FaturamentoPanel';

interface Props {
  tasks: Task[]; // uma ou mais O.S. sendo cobradas juntas (mesmo cliente)
  onClose: () => void;
}

const OSFaturamentoModal: React.FC<Props> = ({ tasks, onClose }) => {
  if (tasks.length === 0) return null;
  const primeira = tasks[0];
  const taskIds = tasks.map(t => t.id);
  const resumoOS = tasks.map(t => (t as any).numeroOS || t.id.slice(0, 8)).join(', ');

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '92vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand-600 flex-shrink-0" />
              Faturamento — {tasks.length > 1 ? `${tasks.length} O.S. agrupadas` : 'O.S. avulsa'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{primeira.clientName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 flex-shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <Hash className="w-3 h-3 text-gray-400 flex-shrink-0" />
                <span className="font-bold text-gray-600 flex-shrink-0">{(t as any).numeroOS || t.id.slice(0, 8)}</span>
                <span className="text-gray-700 truncate flex-1">{t.title}</span>
              </div>
            ))}
          </div>

          <FaturamentoPanel
            referencia={{ tipo: 'os', taskIds, resumoOS }}
            clientId={(primeira as any).clientId || ''}
            clientName={primeira.clientName || ''}
          />
        </div>
      </div>
    </div>
  );
};

export default OSFaturamentoModal;

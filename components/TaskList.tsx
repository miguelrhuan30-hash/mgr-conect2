/**
 * components/TaskList.tsx — Sprint 46 (Refactored)
 *
 * Lista profissional de O.S. em formato de tabela responsiva.
 * Cada linha é clicável → abre OSViewModal.
 * Pipeline já exibe kanban, aqui é somente lista.
 */
import React from 'react';
import { Task, PriorityLevel, Timestamp } from '../types';
import {
  Calendar, User, Building, Eye, Clock, CheckCircle2,
  AlertTriangle, Circle, Timer, Wrench,
} from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
  onViewOS: (taskId: string) => void;
}

// ── helpers ──────────────────────────────────────────────────────────────────
const PRIO: Record<PriorityLevel, { label: string; dot: string; row: string }> = {
  critical: { label: 'Crítica',  dot: 'bg-red-500',    row: 'border-l-red-500'    },
  high:     { label: 'Alta',     dot: 'bg-orange-500',  row: 'border-l-orange-500'  },
  medium:   { label: 'Média',    dot: 'bg-amber-400',   row: 'border-l-amber-400'   },
  low:      { label: 'Baixa',    dot: 'bg-blue-400',    row: 'border-l-blue-400'    },
};

const STATUS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  'pending':     { label: 'Pendente',    icon: Circle,       cls: 'text-gray-500 bg-gray-100'    },
  'in-progress': { label: 'Em execução', icon: Timer,        cls: 'text-blue-600 bg-blue-50'     },
  'completed':   { label: 'Concluída',   icon: CheckCircle2, cls: 'text-green-600 bg-green-50'   },
  'blocked':     { label: 'Bloqueada',   icon: AlertTriangle,cls: 'text-red-600 bg-red-50'       },
  'cancelled':   { label: 'Cancelada',   icon: Circle,       cls: 'text-gray-400 bg-gray-50'     },
};

const fmtDate = (ts?: Timestamp | null) => {
  if (!ts) return '—';
  const d = new Date((ts as any).toMillis ? (ts as any).toMillis() : ts);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const progress = (task: Task) => {
  const tarefas: any[] = (task as any).tarefasOS || [];
  if (tarefas.length === 0) {
    // fallback to legacy checklist
    if (!task.checklist || task.checklist.length === 0) return 0;
    return Math.round((task.checklist.filter(i => i.completed).length / task.checklist.length) * 100);
  }
  const done = tarefas.filter((t: any) => t.status === 'concluida').length;
  return Math.round((done / tarefas.length) * 100);
};

// ── component ────────────────────────────────────────────────────────────────
const TaskList: React.FC<TaskListProps> = ({ tasks, onViewOS }) => {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
        <div className="mx-auto h-14 w-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
          <Wrench className="h-7 w-7 text-gray-300" />
        </div>
        <h3 className="text-base font-bold text-gray-900">Nenhuma O.S. encontrada</h3>
        <p className="mt-1 text-sm text-gray-500">Tente alterar os filtros ou crie uma nova O.S.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Desktop header */}
      <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
        <div className="col-span-4">O.S.</div>
        <div className="col-span-2">Cliente</div>
        <div className="col-span-1 text-center">Status</div>
        <div className="col-span-1 text-center">Prioridade</div>
        <div className="col-span-1 text-center">Data</div>
        <div className="col-span-1 text-center">Técnico</div>
        <div className="col-span-1 text-center">Progresso</div>
        <div className="col-span-1 text-center">Ação</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {tasks.map((task) => {
          const prio   = PRIO[task.priority] || PRIO.medium;
          const status = STATUS[task.status] || STATUS['pending'];
          const StatusIcon = status.icon;
          const prog   = progress(task);
          const dataPrevista = (task as any).scheduling?.dataPrevista;

          return (
            <div
              key={task.id}
              onClick={() => onViewOS(task.id)}
              className={`
                cursor-pointer transition-colors hover:bg-brand-50/50
                border-l-4 ${prio.row}
                px-4 py-3
                md:grid md:grid-cols-12 md:gap-2 md:items-center
                flex flex-col gap-2
              `}
            >
              {/* Col 1: Title + code */}
              <div className="col-span-4 min-w-0">
                <p className="text-[10px] font-bold text-gray-400 leading-none mb-0.5">
                  {task.code || task.id.slice(0, 8)}
                </p>
                <p className="text-sm font-bold text-gray-900 leading-snug truncate">
                  {task.title}
                </p>
                {(task as any).tipoServico && (
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{(task as any).tipoServico}</p>
                )}
              </div>

              {/* Col 2: Client */}
              <div className="col-span-2 flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
                <Building size={12} className="text-gray-400 flex-shrink-0" />
                <span className="truncate">{task.clientName || '—'}</span>
              </div>

              {/* Col 3: Status pill */}
              <div className="col-span-1 flex justify-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.cls}`}>
                  <StatusIcon size={10} />
                  <span className="hidden lg:inline">{status.label}</span>
                </span>
              </div>

              {/* Col 4: Priority */}
              <div className="col-span-1 flex justify-center">
                <span className="inline-flex items-center gap-1 text-[10px] text-gray-600">
                  <span className={`w-2.5 h-2.5 rounded-full ${prio.dot}`} />
                  <span className="hidden lg:inline">{prio.label}</span>
                </span>
              </div>

              {/* Col 5: Date */}
              <div className="col-span-1 flex justify-center items-center gap-1 text-[10px] text-gray-500">
                <Calendar size={10} className="text-gray-400" />
                {fmtDate(dataPrevista)}
              </div>

              {/* Col 6: Technician */}
              <div className="col-span-1 flex justify-center">
                {task.assigneeName ? (
                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-600" title={task.assigneeName}>
                    <div className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                      {task.assigneeName.charAt(0).toUpperCase()}
                    </div>
                    <span className="hidden xl:inline truncate max-w-[60px]">{task.assigneeName}</span>
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-300">—</span>
                )}
              </div>

              {/* Col 7: Progress bar */}
              <div className="col-span-1 flex items-center gap-1.5 justify-center">
                <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${prog >= 100 ? 'bg-green-500' : 'bg-brand-500'}`}
                    style={{ width: `${prog}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-gray-500 w-7 text-right">{prog}%</span>
              </div>

              {/* Col 8: View button */}
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); onViewOS(task.id); }}
                  className="p-1.5 rounded-lg text-brand-500 hover:bg-brand-50 hover:text-brand-700 transition-colors"
                  title="Visualizar O.S."
                >
                  <Eye size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TaskList;
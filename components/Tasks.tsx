/**
 * components/Tasks.tsx — Sprint 46 (Refactored)
 *
 * Módulo "Tarefas" de O.S. — agora em formato LISTA (Pipeline já é kanban).
 * Clicar qualquer linha abre o OSViewModal unificado.
 */
import React, { useEffect, useState, lazy, Suspense } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task } from '../types';
import TaskList from './TaskList';
import OSCreationModal from './OSCreationModal';
import { Loader2, Plus, Search, ListFilter } from 'lucide-react';

const OSViewModal = lazy(() => import('./OSViewModal'));

type StatusFilter = 'all' | 'pending' | 'in-progress' | 'completed' | 'cancelled';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',         label: 'Todas'        },
  { value: 'pending',     label: 'Pendentes'    },
  { value: 'in-progress', label: 'Em Andamento' },
  { value: 'completed',   label: 'Concluídas'   },
  { value: 'cancelled',   label: 'Canceladas'   },
];

const Tasks: React.FC = () => {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [loading, setLoading]         = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [searchTerm, setSearchTerm]   = useState('');
  const [viewOSId, setViewOSId]       = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, CollectionName.TASKS),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      setTasks(taskData);
      setLoading(false);
    }, () => {
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.clientName && task.clientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (task.code && task.code.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      filterStatus === 'all' ? true :
      task.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tarefas de O.S.</h1>
          <p className="text-sm text-gray-500">Lista geral de todas as Ordens de Serviço</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors text-sm font-bold shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova O.S.
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        {/* Tabs */}
        <div className="flex p-1 gap-0.5 bg-gray-100/80 rounded-xl overflow-x-auto flex-shrink-0">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value)}
              className={`
                px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap
                ${filterStatus === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-0 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar O.S., cliente ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white text-gray-900"
          />
        </div>

        {/* Count badge */}
        <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
          <ListFilter size={13} />
          <span className="font-bold">{filteredTasks.length}</span>
          <span>O.S.</span>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center p-20 bg-white rounded-2xl border border-gray-200">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <TaskList tasks={filteredTasks} onViewOS={setViewOSId} />
      )}

      {/* OS Creation Modal */}
      <OSCreationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {}}
      />

      {/* OS View Modal (unified) */}
      {viewOSId && (
        <Suspense fallback={null}>
          <OSViewModal taskId={viewOSId} onClose={() => setViewOSId(null)} />
        </Suspense>
      )}
    </div>
  );
};

export default Tasks;
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task } from '../types';
import TaskList from './TaskList';
import OSCreationModal from './OSCreationModal';
import { Loader2, Plus, Search } from 'lucide-react';

const Tasks: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Filtering State
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Real-time listener for tasks
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
    }, (error) => {
      console.error("Error fetching tasks:", error);
      // Gracefully handle permission errors by stopping loading state
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.clientName && task.clientName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = 
      filterStatus === 'all' ? true :
      filterStatus === 'pending' ? (task.status === 'pending') :
      filterStatus === 'in-progress' ? (task.status === 'in-progress') : true;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço (O.S.)</h1>
          <p className="text-gray-500">Gestão técnica, prazos e controle de atividades.</p>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium shadow-sm hover:shadow"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova O.S.
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:justify-between">
        {/* Tabs */}
        <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-lg">
          {(['all', 'pending', 'in-progress'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-md transition-all
                ${filterStatus === status 
                  ? 'bg-white text-gray-900 shadow' 
                  : 'text-gray-500 hover:text-gray-700'}
              `}
            >
              {status === 'all' && 'Todas'}
              {status === 'pending' && 'Pendentes'}
              {status === 'in-progress' && 'Em Andamento'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
           <input 
             type="text" 
             placeholder="Buscar O.S. ou Cliente..." 
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
             className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
           />
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center p-24 bg-white rounded-xl border border-gray-200">
            <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {filteredTasks.length} O.S. encontradas
              </h2>
            </div>
            <TaskList tasks={filteredTasks} />
          </>
        )}
      </div>

      {/* O.S. Modal */}
      <OSCreationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
            // Optional: Show success toast notification here
        }}
      />
    </div>
  );
};

export default Tasks;
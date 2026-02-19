import React from 'react';
import { db } from '../firebase';
import { Task, CollectionName, PriorityLevel } from '../types';
import { Trash2, Calendar, User, Building, ListTodo, Repeat } from 'lucide-react';

interface TaskListProps {
  tasks: Task[];
}

const TaskList: React.FC<TaskListProps> = ({ tasks }) => {
  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
        <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <ListTodo className="h-8 w-8 text-gray-300" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Nenhuma O.S. Encontrada</h3>
        <p className="mt-1 text-sm text-gray-500">Tente alterar os filtros ou crie uma nova tarefa.</p>
      </div>
    );
  }

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta O.S.?')) {
      try {
        await db.collection(CollectionName.TASKS).doc(id).delete();
      } catch (error) {
        console.error("Error removing document: ", error);
      }
    }
  };

  const getPriorityBorderColor = (priority: PriorityLevel) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500';
      case 'high': return 'border-l-orange-500';
      case 'medium': return 'border-l-yellow-500';
      case 'low': return 'border-l-blue-500';
      default: return 'border-l-gray-300';
    }
  };

  const getPriorityLabel = (priority: PriorityLevel) => {
    switch (priority) {
       case 'critical': return { text: 'Crítica', color: 'text-red-700 bg-red-50' };
       case 'high': return { text: 'Alta', color: 'text-orange-700 bg-orange-50' };
       case 'medium': return { text: 'Média', color: 'text-yellow-700 bg-yellow-50' };
       case 'low': return { text: 'Baixa', color: 'text-blue-700 bg-blue-50' };
       default: return { text: 'Normal', color: 'text-gray-700 bg-gray-50' };
    }
  };

  const calculateProgress = (task: Task) => {
     if (!task.checklist || task.checklist.length === 0) return 0;
     const completed = task.checklist.filter(i => i.completed).length;
     return Math.round((completed / task.checklist.length) * 100);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {tasks.map((task) => {
        const priorityStyle = getPriorityLabel(task.priority);
        const progress = calculateProgress(task);
        
        return (
          <div 
            key={task.id} 
            className={`
              relative bg-white rounded-lg p-5 border-t border-r border-b border-gray-200 shadow-sm hover:shadow-md transition-all 
              border-l-4 ${getPriorityBorderColor(task.priority)}
            `}
          >
            {/* Delete Button (Hover only) */}
            <button
              onClick={() => handleDelete(task.id)}
              className="absolute top-3 right-3 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* Header / Meta */}
            <div className="flex items-center gap-2 mb-2">
               <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${priorityStyle.color}`}>
                 {priorityStyle.text}
               </span>
               {task.endDate && (
                 <span className="flex items-center text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    <Calendar className="w-3 h-3 mr-1" />
                    {task.endDate.toDate().toLocaleDateString(undefined, {day: '2-digit', month: '2-digit'})}
                 </span>
               )}
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-gray-900 mb-1 leading-snug line-clamp-2">
              {task.title}
            </h3>

            {/* Client Info */}
            <div className="flex items-center text-xs text-gray-500 mb-4 h-5">
              {task.clientName ? (
                <>
                  <Building className="w-3 h-3 mr-1.5" />
                  <span className="truncate">{task.clientName}</span>
                </>
              ) : (
                <span className="italic text-gray-400">Sem cliente vinculado</span>
              )}
            </div>

            {/* Progress Bar Section */}
            <div className="mt-4">
               <div className="flex justify-between items-end mb-1">
                  <span className="text-xs font-medium text-gray-500">Progresso</span>
                  <span className="text-xs font-bold text-brand-600">{progress}%</span>
               </div>
               <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-brand-500 h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${progress}%` }}
                  ></div>
               </div>
               <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                     <div 
                       className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px] font-bold border border-gray-200"
                       title={task.assigneeName || 'Não atribuído'}
                     >
                        {task.assigneeName ? task.assigneeName.charAt(0).toUpperCase() : <User size={10} />}
                     </div>
                  </div>
                  <div className="text-[10px] text-gray-400 flex items-center gap-1">
                     <ListTodo size={12} />
                     {task.checklist ? task.checklist.filter(i => i.completed).length : 0}/{task.checklist?.length || 0}
                  </div>
               </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TaskList;
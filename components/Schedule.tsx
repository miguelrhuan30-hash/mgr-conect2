import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, addDoc, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task, UserProfile, PriorityLevel } from '../types';
import OSCreationModal from './OSCreationModal';
import { 
  startOfWeek, endOfWeek, addDays, format, isSameDay, 
  differenceInDays, addWeeks, subWeeks, startOfMonth, 
  endOfMonth, isWithinInterval, addMonths, subMonths,
  eachDayOfInterval, isSameMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, ChevronRight, Calendar, User, Search, 
  Plus, Filter, X, Loader2, Save, CalendarDays, AlertCircle,
  BarChartHorizontal, Grid3X3
} from 'lucide-react';

type ViewMode = 'week' | 'month';
type VisualizationType = 'gantt' | 'calendar';

const Schedule: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // View State
  const [visualizationMode, setVisualizationMode] = useState<VisualizationType>('calendar');
  const [viewMode, setViewMode] = useState<ViewMode>('month'); // Gantt specific
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Modals
  const [isOSModalOpen, setIsOSModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  
  // Calendar Day Detail Modal
  const [selectedDayTasks, setSelectedDayTasks] = useState<{date: Date, tasks: Task[]} | null>(null);

  // Edit Form State
  const [editFormStartDate, setEditFormStartDate] = useState('');
  const [editFormEndDate, setEditFormEndDate] = useState('');
  const [editFormProgress, setEditFormProgress] = useState(0);
  const [editFormAssignee, setEditFormAssignee] = useState('');

  useEffect(() => {
    // 1. Fetch Users for assignments
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, CollectionName.USERS));
        setUsers(snap.docs.map(d => ({uid: d.id, ...(d.data() as any)} as UserProfile)));
      } catch (e) {
        console.error("Error fetching users", e);
      }
    };
    fetchUsers();

    // 2. Real-time tasks listener
    const q = query(collection(db, CollectionName.TASKS), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Generate a fake code if missing for display
          code: data.code || `OS-${data.createdAt?.toDate().getFullYear() || '2024'}-${doc.id.substring(0,3).toUpperCase()}`
        };
      }) as Task[];
      setTasks(taskData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- DATE HELPERS ---
  const getViewRange = () => {
    if (viewMode === 'week') {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 1 }), // Monday
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      };
    } else {
      return {
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      };
    }
  };

  const { start: viewStart, end: viewEnd } = getViewRange();
  const daysInView = differenceInDays(viewEnd, viewStart) + 1;

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (visualizationMode === 'calendar') {
        setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
        return;
    }

    if (viewMode === 'week') {
      setCurrentDate(direction === 'prev' ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
    } else {
      setCurrentDate(direction === 'prev' ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
    }
  };

  // --- FILTERING ---
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (task.code && task.code.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesAssignee = filterAssignee === 'all' || task.assignedTo === filterAssignee;
    
    const matchesStatus = filterStatus === 'all' 
      ? true 
      : filterStatus === 'overdue' 
        ? (task.status !== 'completed' && task.endDate && task.endDate.toDate() < new Date())
        : task.status === filterStatus;

    return matchesSearch && matchesAssignee && matchesStatus;
  });

  // --- CALENDAR LOGIC ---
  const getCalendarDays = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const end = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const getOSForDay = (date: Date) => {
    return filteredTasks.filter(os => {
      if (!os.startDate || !os.endDate) return false;
      
      const start = os.startDate.toDate();
      const end = os.endDate.toDate();
      
      // Zerar horas para comparar só datas
      const dayStart = new Date(date);
      dayStart.setHours(0,0,0,0);
      
      const dayEnd = new Date(date);
      dayEnd.setHours(23,59,59,999);
      
      const osStart = new Date(start);
      osStart.setHours(0,0,0,0);
      
      const osEnd = new Date(end);
      osEnd.setHours(23,59,59,999);

      return osStart <= dayEnd && osEnd >= dayStart;
    });
  };

  // --- EDIT MODAL HANDLERS ---
  const openEditModal = (task: Task) => {
    setEditTask(task);
    setEditFormStartDate(task.startDate ? task.startDate.toDate().toISOString().slice(0, 16) : '');
    setEditFormEndDate(task.endDate ? task.endDate.toDate().toISOString().slice(0, 16) : '');
    setEditFormProgress(task.progress || calculateChecklistProgress(task));
    setEditFormAssignee(task.assignedTo || '');
    // Close detail modal if open
    setSelectedDayTasks(null); 
  };

  const saveTaskEdit = async () => {
    if (!editTask) return;
    setIsSavingEdit(true);
    try {
      const updates: any = {
        progress: editFormProgress,
        assignedTo: editFormAssignee
      };

      if (editFormStartDate) updates.startDate = Timestamp.fromDate(new Date(editFormStartDate));
      if (editFormEndDate) updates.endDate = Timestamp.fromDate(new Date(editFormEndDate));
      
      // Update Assignee Name if changed
      if (editFormAssignee !== editTask.assignedTo) {
          const newUser = users.find(u => u.uid === editFormAssignee);
          if (newUser) updates.assigneeName = newUser.displayName;
      }

      await updateDoc(doc(db, CollectionName.TASKS, editTask.id), updates);
      setEditTask(null);
    } catch (error) {
      console.error("Error updating task:", error);
      alert("Erro ao atualizar tarefa.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- GANTT RENDERING HELPERS ---
  const calculateChecklistProgress = (task: Task) => {
    if (!task.checklist || task.checklist.length === 0) return 0;
    const completed = task.checklist.filter(i => i.completed).length;
    return Math.round((completed / task.checklist.length) * 100);
  };

  const getStatusColor = (status: string, endDate?: Timestamp) => {
    if (status !== 'completed' && endDate && endDate.toDate() < new Date()) return 'bg-red-500'; // Overdue
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in-progress': return 'bg-blue-500';
      case 'pending': return 'bg-gray-400';
      case 'blocked': return 'bg-orange-500';
      default: return 'bg-gray-400';
    }
  };

  const getBarStyle = (task: Task) => {
    if (!task.startDate || !task.endDate) return null;
    
    const taskStart = task.startDate.toDate();
    const taskEnd = task.endDate.toDate();

    // Check if task is visible in current view
    if (taskEnd < viewStart || taskStart > viewEnd) return null;

    // Calculate clamped start and end for drawing
    const drawStart = taskStart < viewStart ? viewStart : taskStart;
    const drawEnd = taskEnd > viewEnd ? viewEnd : taskEnd;

    const startOffset = differenceInDays(drawStart, viewStart);
    const duration = differenceInDays(drawEnd, drawStart) + 1; // +1 to include end day
    
    // Ensure duration is at least 1 day for visibility if dates are same
    const effectiveDuration = Math.max(duration, 0.2); 

    const left = (startOffset / daysInView) * 100;
    const width = (effectiveDuration / daysInView) * 100;

    return {
      left: `${left}%`,
      width: `${width}%`
    };
  };

  // Generate Date Headers
  const renderDateHeaders = () => {
    const headers = [];
    for (let i = 0; i < daysInView; i++) {
      const date = addDays(viewStart, i);
      const isToday = isSameDay(date, new Date());
      headers.push(
        <div 
          key={i} 
          className={`
            flex-1 min-w-[40px] border-r border-gray-100 flex flex-col items-center justify-center py-2 text-xs
            ${isToday ? 'bg-blue-50' : ''}
          `}
        >
          <span className="text-gray-400 font-medium">{format(date, 'EEE', { locale: ptBR })}</span>
          <span className={`font-bold ${isToday ? 'text-brand-600' : 'text-gray-700'}`}>{format(date, 'd')}</span>
        </div>
      );
    }
    return headers;
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-white">
      {/* HEADER TOOLBAR */}
      <div className="flex-none p-4 border-b border-gray-200 bg-white flex flex-col md:flex-row gap-4 items-center justify-between z-20 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 hidden lg:flex">
            <CalendarDays className="text-brand-600" />
            Agenda
          </h1>
          
          {/* VISUALIZATION TOGGLE */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setVisualizationMode('calendar')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${visualizationMode === 'calendar' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Grid3X3 size={14} /> Calendário
            </button>
            <button 
              onClick={() => setVisualizationMode('gantt')}
              className={`hidden md:flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-md transition-all ${visualizationMode === 'gantt' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChartHorizontal size={14} /> Gantt
            </button>
          </div>

          {/* GANTT ONLY CONTROLS */}
          {visualizationMode === 'gantt' && (
            <div className="hidden md:flex bg-gray-100 rounded-lg p-1">
                <button 
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                Semana
                </button>
                <button 
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                >
                Mês
                </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-center">
           <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200">
              <button onClick={() => handleNavigate('prev')} className="p-1.5 hover:bg-gray-200 rounded-l-lg"><ChevronLeft size={16}/></button>
              <div className="px-3 py-1.5 text-sm font-medium border-l border-r border-gray-200 min-w-[140px] text-center capitalize">
                 {format(currentDate, visualizationMode === 'calendar' ? "MMMM yyyy" : viewMode === 'week' ? "'Semana' w, MMMM" : 'MMMM yyyy', { locale: ptBR })}
              </div>
              <button onClick={() => handleNavigate('next')} className="p-1.5 hover:bg-gray-200 rounded-r-lg"><ChevronRight size={16}/></button>
           </div>
           <button onClick={() => setCurrentDate(new Date())} className="text-xs font-medium text-brand-600 hover:underline px-2">
             Hoje
           </button>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative hidden lg:block w-48">
               <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
               <input 
                 type="text" 
                 placeholder="Filtrar O.S..." 
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500"
               />
            </div>
            
            <button 
              onClick={() => setIsOSModalOpen(true)}
              className="flex items-center justify-center px-3 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 text-sm font-medium shadow-sm transition-colors whitespace-nowrap flex-1 md:flex-none"
            >
              <Plus className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Nova O.S.</span>
              <span className="md:hidden">Nova</span>
            </button>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
         
         {/* --- CALENDAR VIEW --- */}
         {visualizationMode === 'calendar' && (
            <div className="h-full flex flex-col bg-white overflow-hidden">
                {/* Days Header */}
                <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 flex-none">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-gray-500 uppercase">
                            {day}
                        </div>
                    ))}
                </div>
                
                {/* Calendar Grid */}
                <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto">
                    {getCalendarDays().map((day, idx) => {
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const dayTasks = getOSForDay(day);
                        const displayTasks = dayTasks.slice(0, 3);
                        const hiddenCount = dayTasks.length - 3;

                        return (
                            <div 
                                key={day.toISOString()} 
                                onClick={() => dayTasks.length > 0 && setSelectedDayTasks({date: day, tasks: dayTasks})}
                                className={`
                                    border-b border-r border-gray-100 p-1 flex flex-col gap-1 min-h-[80px] cursor-pointer hover:bg-gray-50 transition-colors
                                    ${!isCurrentMonth ? 'bg-gray-50/50 text-gray-400' : 'bg-white'}
                                    ${isToday ? 'bg-blue-50/30' : ''}
                                `}
                            >
                                <div className="flex justify-center mb-1">
                                    <span className={`
                                        text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium
                                        ${isToday ? 'bg-brand-600 text-white' : 'text-gray-700'}
                                    `}>
                                        {format(day, 'd')}
                                    </span>
                                </div>

                                {/* Task Pills */}
                                <div className="flex flex-col gap-1">
                                    {displayTasks.map(task => {
                                        const isStart = isSameDay(day, task.startDate?.toDate() || new Date());
                                        const isEnd = isSameDay(day, task.endDate?.toDate() || new Date());
                                        const color = getStatusColor(task.status, task.endDate).replace('bg-', 'bg-');
                                        
                                        return (
                                            <div 
                                                key={task.id}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openEditModal(task);
                                                }}
                                                className={`
                                                    text-[10px] text-white px-1.5 py-0.5 truncate cursor-pointer hover:opacity-90 leading-tight
                                                    ${color}
                                                    ${isStart ? 'rounded-l-md ml-0.5' : ''}
                                                    ${isEnd ? 'rounded-r-md mr-0.5' : ''}
                                                    ${!isStart && !isEnd ? 'rounded-none mx-[-1px]' : ''}
                                                    ${isStart && isEnd ? 'rounded-md mx-0.5' : ''}
                                                `}
                                                title={task.title}
                                            >
                                                <span className="font-mono opacity-80 mr-1 hidden md:inline">{task.code}</span>
                                                {task.title}
                                            </div>
                                        );
                                    })}
                                    {hiddenCount > 0 && (
                                        <div className="text-[10px] text-gray-500 font-medium text-center hover:underline">
                                            +{hiddenCount} mais
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
         )}

         {/* --- GANTT VIEW --- */}
         {visualizationMode === 'gantt' && (
            <div className="flex h-full">
                {/* LEFT PANEL: TASK LIST */}
                <div className="w-full md:w-[35%] lg:w-[25%] flex-shrink-0 border-r border-gray-200 bg-white overflow-y-auto flex flex-col">
                    <div className="p-3 border-b border-gray-100 bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider sticky top-0">
                    Lista de Serviços ({filteredTasks.length})
                    </div>
                    {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600"/></div>
                    ) : filteredTasks.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 italic text-sm">Nenhuma OS encontrada.</div>
                    ) : (
                    <div className="divide-y divide-gray-100">
                        {filteredTasks.map(task => {
                            const progress = task.progress !== undefined ? task.progress : calculateChecklistProgress(task);
                            const hasDates = task.startDate && task.endDate;
                            return (
                            <div 
                                key={task.id} 
                                onClick={() => openEditModal(task)}
                                className="p-3 hover:bg-gray-50 cursor-pointer transition-colors group"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 rounded">{task.code}</span>
                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status, task.endDate)}`}></div>
                                </div>
                                <h4 className="text-sm font-bold text-gray-800 leading-tight mb-1 group-hover:text-brand-600">{task.title}</h4>
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                    <span className="truncate max-w-[120px] flex items-center gap-1">
                                    <User size={10} /> {task.assigneeName || 'N/A'}
                                    </span>
                                    {!hasDates && (
                                    <span className="text-orange-500 flex items-center gap-1" title="Sem data definida">
                                        <AlertCircle size={10} /> Sem Data
                                    </span>
                                    )}
                                </div>
                                
                                {/* Progress Bar */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${progress}%` }}></div>
                                    </div>
                                    <span className="text-[10px] font-bold text-gray-600">{progress}%</span>
                                </div>
                            </div>
                            )
                        })}
                    </div>
                    )}
                </div>

                {/* RIGHT PANEL: GANTT CHART */}
                <div className="hidden md:flex flex-1 flex-col overflow-hidden bg-white relative">
                    {/* GANTT HEADER (Dates) */}
                    <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 h-12 overflow-hidden shadow-[0_2px_5px_rgba(0,0,0,0.02)]">
                    {renderDateHeaders()}
                    </div>

                    {/* TODAY LINE */}
                    <div 
                    className="absolute top-12 bottom-0 w-px border-l-2 border-red-400 border-dashed z-0 opacity-50 pointer-events-none"
                    style={{ 
                        left: `${(differenceInDays(new Date(), viewStart) / daysInView) * 100}%`,
                        display: isWithinInterval(new Date(), { start: viewStart, end: viewEnd }) ? 'block' : 'none' 
                    }}
                    >
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
                    </div>

                    {/* GANTT BODY (Bars) */}
                    <div className="flex-1 overflow-y-auto relative p-0 space-y-[1px] bg-gray-50/30">
                    {/* Vertical Grid Lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                        {Array.from({ length: daysInView }).map((_, i) => (
                            <div key={i} className="flex-1 border-r border-gray-100 h-full"></div>
                        ))}
                    </div>

                    {filteredTasks.map(task => {
                        const style = getBarStyle(task);
                        if (!style) return null; // Skip tasks outside view or without dates

                        const progress = task.progress !== undefined ? task.progress : calculateChecklistProgress(task);
                        const colorClass = getStatusColor(task.status, task.endDate);

                        return (
                            <div key={task.id} className="h-[73px] w-full relative group"> 
                                {/* The Bar */}
                                <div 
                                onClick={() => openEditModal(task)}
                                className={`
                                    absolute top-4 h-8 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-95 hover:shadow-md
                                    flex items-center px-2 overflow-hidden
                                    ${colorClass}
                                `}
                                style={style}
                                >
                                {/* Progress Overlay inside bar */}
                                <div 
                                    className="absolute left-0 top-0 bottom-0 bg-white/20" 
                                    style={{ width: `${progress}%` }}
                                ></div>

                                <span className="text-white text-xs font-bold truncate relative z-10 drop-shadow-md">
                                    {task.title}
                                </span>

                                {/* Tooltip on Hover */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity">
                                    <p className="font-bold">{task.title}</p>
                                    <p>Início: {format(task.startDate!.toDate(), 'dd/MM HH:mm')}</p>
                                    <p>Fim: {format(task.endDate!.toDate(), 'dd/MM HH:mm')}</p>
                                    <p>Status: {task.status} ({progress}%)</p>
                                </div>
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            </div>
         )}
      </div>

      {/* EDIT MODAL (Drawer) */}
      {editTask && (
         <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
            <div className="bg-white w-full max-w-md h-full shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
               <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h2 className="text-lg font-bold text-gray-900">Editar Agendamento</h2>
                  <button onClick={() => setEditTask(null)}><X className="text-gray-500 hover:text-gray-700" /></button>
               </div>
               
               <div className="p-6 space-y-6">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                     <p className="text-xs font-bold text-blue-600 uppercase mb-1">{editTask.code}</p>
                     <h3 className="font-bold text-gray-900 text-lg">{editTask.title}</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                        <input 
                           type="datetime-local" 
                           value={editFormStartDate}
                           onChange={e => setEditFormStartDate(e.target.value)}
                           className="w-full rounded-lg border-gray-300 text-sm"
                        />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Fim Previsto</label>
                        <input 
                           type="datetime-local" 
                           value={editFormEndDate}
                           onChange={e => setEditFormEndDate(e.target.value)}
                           className="w-full rounded-lg border-gray-300 text-sm"
                        />
                     </div>
                  </div>

                  <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                     <select 
                        value={editFormAssignee}
                        onChange={e => setEditFormAssignee(e.target.value)}
                        className="w-full rounded-lg border-gray-300 text-sm"
                     >
                        <option value="">Sem Responsável</option>
                        {users.map(u => (
                           <option key={u.uid} value={u.uid}>{u.displayName}</option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label className="flex justify-between text-sm font-medium text-gray-700 mb-1">
                        <span>Progresso Manual</span>
                        <span className="font-bold text-brand-600">{editFormProgress}%</span>
                     </label>
                     <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={editFormProgress}
                        onChange={e => setEditFormProgress(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand-600"
                     />
                     <p className="text-xs text-gray-400 mt-1">
                        Define a porcentagem visual no gráfico, independente do checklist.
                     </p>
                  </div>

                  <div className="pt-6 border-t border-gray-100 flex gap-3">
                     <button 
                        onClick={() => setEditTask(null)}
                        className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                     >
                        Cancelar
                     </button>
                     <button 
                        onClick={saveTaskEdit}
                        disabled={isSavingEdit}
                        className="flex-1 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 flex items-center justify-center gap-2"
                     >
                        {isSavingEdit ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                        Salvar Alterações
                     </button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* DAY DETAILS MODAL (Calendar View) */}
      {selectedDayTasks && (
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
                  <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                      <div>
                          <h3 className="font-bold text-gray-900 text-lg capitalize">{format(selectedDayTasks.date, "EEEE, d 'de' MMMM", {locale: ptBR})}</h3>
                          <p className="text-sm text-gray-500">{selectedDayTasks.tasks.length} serviços agendados</p>
                      </div>
                      <button onClick={() => setSelectedDayTasks(null)} className="p-1 hover:bg-gray-200 rounded-full"><X size={20}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {selectedDayTasks.tasks.map(task => (
                          <div 
                            key={task.id} 
                            onClick={() => openEditModal(task)}
                            className="bg-white border border-gray-200 rounded-xl p-3 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer group"
                          >
                              <div className="flex justify-between items-start mb-1">
                                  <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 rounded">{task.code}</span>
                                  <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status, task.endDate)}`}></div>
                              </div>
                              <h4 className="text-sm font-bold text-gray-800 group-hover:text-brand-600">{task.title}</h4>
                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                  <User size={12}/> {task.assigneeName || 'N/A'}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* NEW OS MODAL */}
      <OSCreationModal 
         isOpen={isOSModalOpen}
         onClose={() => setIsOSModalOpen(false)}
         onSuccess={() => {}}
      />
    </div>
  );
};

export default Schedule;
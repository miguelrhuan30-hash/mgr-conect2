/**
 * components/CalendarioOS.tsx
 * Visão calendário semanal de OS por técnico.
 * Grid: linhas = técnicos, colunas = dias da semana.
 * Drag & drop entre células para reagendar/reatribuir.
 */
import React, { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import {
  collection, query, where, onSnapshot, orderBy, Timestamp,
  doc, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Task, WorkflowStatus, WORKFLOW_LABELS } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  ChevronLeft, ChevronRight, Calendar, Loader2, User, Building2,
} from 'lucide-react';
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OSViewModal = lazy(() => import('./OSViewModal'));

interface UserInfo { id: string; displayName: string; }

const PRIORITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-400',
};

const CalendarioOS: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewOSId, setViewOSId] = useState<string | null>(null);
  const [dragOverCell, setDragOverCell] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, CollectionName.USERS), orderBy('displayName')),
      snap => {
        const all = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as any))
          .filter((u: any) => u.role === 'tecnico' || u.role === 'gestor');
        setUsers(all.map((u: any) => ({ id: u.id, displayName: u.displayName || u.email })));
      },
      () => {},
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const weekEnd = addDays(weekStart, 6);
    const startTs = Timestamp.fromDate(weekStart);
    const endTs = Timestamp.fromDate(addDays(weekEnd, 1));

    const q = query(
      collection(db, CollectionName.TASKS),
      where('endDate', '>=', startTs),
      where('endDate', '<=', endTs),
    );
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      setTasks(all.filter(t => !(t as any).archived && t.workflowStatus !== WorkflowStatus.CONCLUIDO));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [weekStart]);

  const [scheduledTasks, setScheduledTasks] = useState<Task[]>([]);
  useEffect(() => {
    const q2 = query(
      collection(db, CollectionName.TASKS),
      where('workflowStatus', 'in', [
        WorkflowStatus.AGENDADO,
        WorkflowStatus.EM_EXECUCAO,
        WorkflowStatus.REVISAO,
      ]),
    );
    const unsub = onSnapshot(q2, snap => {
      setScheduledTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
    }, () => {});
    return () => unsub();
  }, []);

  const allTasks = useMemo(() => {
    const map = new Map<string, Task>();
    [...tasks, ...scheduledTasks].forEach(t => map.set(t.id, t));
    return Array.from(map.values());
  }, [tasks, scheduledTasks]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const getTaskDate = (task: Task): Date | null => {
    const sched = (task as any).scheduling?.dataPrevista;
    if (sched) {
      try { return sched.toDate ? sched.toDate() : new Date(sched.seconds * 1000); } catch {}
    }
    if (task.endDate) {
      try { return (task.endDate as any).toDate ? (task.endDate as any).toDate() : new Date((task.endDate as any).seconds * 1000); } catch {}
    }
    return null;
  };

  const grid = useMemo(() => {
    const map = new Map<string, Task[]>();
    allTasks.forEach(t => {
      const d = getTaskDate(t);
      if (!d) return;
      const userId = t.assignedTo || '__unassigned';
      const dayIdx = days.findIndex(day => isSameDay(day, d));
      if (dayIdx < 0) return;
      const key = `${userId}-${dayIdx}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return map;
  }, [allTasks, days]);

  const visibleUsers = useMemo(() => {
    const withTasks = new Set<string>();
    allTasks.forEach(t => { if (t.assignedTo) withTasks.add(t.assignedTo); });
    const all = [...users];
    withTasks.forEach(uid => {
      if (!all.find(u => u.id === uid)) {
        all.push({ id: uid, displayName: uid.slice(0, 8) });
      }
    });
    return all;
  }, [users, allTasks]);

  // Drag & drop handler
  const handleDrop = useCallback(async (taskId: string, newUserId: string, newDayIdx: number) => {
    const targetDate = days[newDayIdx];
    if (!targetDate) return;
    const newDateTs = Timestamp.fromDate(targetDate);
    try {
      await updateDoc(doc(db, CollectionName.TASKS, taskId), {
        assignedTo: newUserId,
        endDate: newDateTs,
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('Erro ao reagendar OS:', e);
    }
  }, [days]);

  const today = new Date();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-600" /> Calendário de O.S.
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            Hoje
          </button>
          <button onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <ChevronRight className="w-4 h-4 text-gray-500" />
          </button>
          <span className="text-sm font-bold text-gray-700 ml-2">
            {format(weekStart, "dd MMM", { locale: ptBR })} — {format(addDays(weekStart, 6), "dd MMM yyyy", { locale: ptBR })}
          </span>
        </div>
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Day headers */}
          <div className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-gray-200">
            <div className="p-2 text-xs font-bold text-gray-500 uppercase">Técnico</div>
            {days.map((day, i) => (
              <div key={i} className={`p-2 text-center text-xs font-bold uppercase ${
                isSameDay(day, today) ? 'bg-brand-50 text-brand-700' : 'text-gray-500'
              }`}>
                <div>{format(day, 'EEE', { locale: ptBR })}</div>
                <div className={`text-lg font-extrabold ${isSameDay(day, today) ? 'text-brand-600' : 'text-gray-800'}`}>
                  {format(day, 'dd')}
                </div>
              </div>
            ))}
          </div>

          {/* Rows */}
          {visibleUsers.length === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhum técnico cadastrado</div>
          )}
          {visibleUsers.map(user => (
              <div key={user.id} className="grid grid-cols-[140px_repeat(7,1fr)] border-b border-gray-100 min-h-[60px]">
                <div className="p-2 flex items-start gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-xs font-bold text-gray-700 truncate">{user.displayName}</span>
                </div>
                {days.map((_, di) => {
                  const cellKey = `${user.id}-${di}`;
                  const cellTasks = grid.get(cellKey) || [];
                  const overloaded = cellTasks.length > 3;
                  const isDragOver = dragOverCell === cellKey;
                  return (
                    <div
                      key={di}
                      className={`p-1 border-l border-gray-100 transition-colors min-h-[52px] ${
                        overloaded ? 'bg-orange-50 border-l-orange-300' : ''
                      } ${isSameDay(days[di], today) ? 'bg-brand-50/30' : ''
                      } ${isDragOver ? 'bg-brand-100/60 ring-2 ring-brand-400 ring-inset' : ''}`}
                      onDragOver={e => { e.preventDefault(); setDragOverCell(cellKey); }}
                      onDragLeave={() => { if (dragOverCell === cellKey) setDragOverCell(null); }}
                      onDrop={e => {
                        e.preventDefault();
                        setDragOverCell(null);
                        const taskId = e.dataTransfer.getData('text/plain');
                        if (taskId) handleDrop(taskId, user.id, di);
                      }}
                    >
                      {cellTasks.map(t => (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', t.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={() => setViewOSId(t.id)}
                          className="w-full text-left mb-1 p-1.5 rounded-lg border border-gray-200 hover:border-brand-300 hover:shadow-sm bg-white transition-all text-[10px] cursor-grab active:cursor-grabbing active:opacity-70"
                        >
                          <div className="flex items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[(t as any).priority] || 'bg-gray-400'}`} />
                            <span className="font-bold text-gray-800 truncate">{(t as any).numeroOS || t.title?.slice(0, 12)}</span>
                          </div>
                          {t.clientName && (
                            <div className="flex items-center gap-0.5 text-gray-400 mt-0.5 truncate">
                              <Building2 className="w-2.5 h-2.5 flex-shrink-0" />
                              {t.clientName}
                            </div>
                          )}
                          {t.workflowStatus && (
                            <div className={`mt-0.5 text-[8px] font-bold px-1 py-0.5 rounded-full inline-block ${
                              t.workflowStatus === WorkflowStatus.EM_EXECUCAO ? 'bg-orange-100 text-orange-700'
                              : t.workflowStatus === WorkflowStatus.REVISAO ? 'bg-red-100 text-red-700'
                              : t.workflowStatus === WorkflowStatus.AGENDADO ? 'bg-sky-100 text-sky-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>
                              {WORKFLOW_LABELS[t.workflowStatus] || t.workflowStatus}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
          ))}

          {/* Summary row */}
          <div className="grid grid-cols-[140px_repeat(7,1fr)] bg-gray-50 border-t border-gray-200">
            <div className="p-2 text-[10px] font-bold text-gray-500">Total</div>
            {days.map((_, di) => {
              const dayTotal = visibleUsers.reduce((acc, u) => acc + (grid.get(`${u.id}-${di}`)?.length || 0), 0);
              return (
                <div key={di} className={`p-2 text-center text-xs font-extrabold border-l border-gray-100 ${
                  dayTotal > 0 ? 'text-brand-600' : 'text-gray-300'
                }`}>
                  {dayTotal}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Arraste os cards entre células para reagendar ou reatribuir a outro técnico.
      </p>

      {/* OS View Modal */}
      {viewOSId && (
        <Suspense fallback={null}>
          <OSViewModal taskId={viewOSId} onClose={() => setViewOSId(null)} />
        </Suspense>
      )}
    </div>
  );
};

export default CalendarioOS;

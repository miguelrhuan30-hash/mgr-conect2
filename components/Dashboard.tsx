/**
 * components/Dashboard.tsx — Sprint 47
 * Dashboard Vivo com dados reais do Firestore.
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, Task } from '../types';
import {
  Trophy, Clock, CheckSquare, Briefcase, TrendingUp, Activity,
  AlertTriangle, Zap, Star, Calendar, User, Building2, Flame,
  ClipboardList,
} from 'lucide-react';
import { GanttTaskPrioridade } from '../types';
import CentralPendencias from './CentralPendencias';

// ── Helpers ───────────────────────────────────────────────────────────────────
const XP_PER_LEVEL = 1000;

const fmtDate = (ts?: Timestamp | null) => {
  if (!ts) return '';
  const d = new Date(ts.toMillis());
  const diff = Date.now() - d.getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'Agora';
  if (h < 24) return `${h}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

// ── Component ─────────────────────────────────────────────────────────────────
const Dashboard: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const isGestor = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  // Live stats
  const [statOS, setStatOS] = useState({ abertas: 0, emExecucao: 0, concluidas: 0, atrasadas: 0 });
  const [minhasOS, setMinhasOS] = useState<Task[]>([]);
  const [recentOS, setRecentOS] = useState<Task[]>([]);
  const [pendingTasks, setPendingTasks] = useState<{ id: string; label: string; descricao?: string; prioridade?: GanttTaskPrioridade; projectId: string; projectName?: string }[]>([]);

  // Gamification
  const xp     = (userProfile as any)?.xpTotal ?? (userProfile as any)?.currentPoints ?? 0;
  const level  = Math.floor(xp / XP_PER_LEVEL) + 1;
  const prog   = ((xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100;
  const streak = (userProfile as any)?.streakOS ?? 0;

  // ── Live Firestore listeners ──────────────────────────────────────────────
  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // All OS stats (gestor) or own stats (tech)
    const qAll = query(collection(db, CollectionName.TASKS));
    const unsubAll = onSnapshot(qAll, snap => {
      const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
      const now = Date.now();
      setStatOS({
        abertas:     tasks.filter(t => !['completed', 'cancelled'].includes(t.status)).length,
        emExecucao:  tasks.filter(t => t.status === 'in-progress').length,
        concluidas:  tasks.filter(t => t.status === 'completed').length,
        atrasadas:   tasks.filter(t => {
          if (['completed', 'cancelled'].includes(t.status)) return false;
          const agd = (t as any).scheduling?.dataPrevista;
          return agd && (agd as Timestamp).toMillis() < now;
        }).length,
      });

      // Recent for feed
      const sorted = [...tasks].sort((a, b) => {
        const at = (a as any).updatedAt?.toMillis?.() ?? 0;
        const bt = (b as any).updatedAt?.toMillis?.() ?? 0;
        return bt - at;
      });
      setRecentOS(sorted.slice(0, 6));
    }, () => {});

    // Pending Gantt tasks (no dates) — gestor view
    let unsubPending = () => {};
    if (isGestor) {
      const qPending = query(
        collection(db, CollectionName.GANTT_TASKS),
        where('dataInicioPrevista', '==', null),
      );
      unsubPending = onSnapshot(qPending, async snap => {
        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        const projectIds = [...new Set(raw.map((t: any) => t.projectId).filter(Boolean))];
        const projectNames: Record<string, string> = {};
        if (projectIds.length > 0) {
          const { getDocs, documentId } = await import('firebase/firestore');
          const batches: string[][] = [];
          for (let i = 0; i < projectIds.length; i += 10) batches.push(projectIds.slice(i, i + 10));
          for (const batch of batches) {
            const pSnap = await getDocs(query(collection(db, CollectionName.PROJECTS_V2), where(documentId(), 'in', batch)));
            pSnap.docs.forEach(d => { projectNames[d.id] = (d.data() as any).nome || (d.data() as any).clientName || d.id; });
          }
        }
        const PRIO_ORDER: Record<string, number> = { urgente: 0, alta: 1, media: 2, baixa: 3 };
        const sorted = raw
          .filter((t: any) => t.status !== 'concluido')
          .map((t: any) => ({
            id: t.id,
            label: t.label || '',
            descricao: t.descricao,
            prioridade: t.prioridade as GanttTaskPrioridade | undefined,
            projectId: t.projectId,
            projectName: projectNames[t.projectId] || t.projectId,
          }))
          .sort((a, b) => (PRIO_ORDER[a.prioridade || 'media'] ?? 2) - (PRIO_ORDER[b.prioridade || 'media'] ?? 2));
        setPendingTasks(sorted);
      }, () => {});
    }

    // My OS today (tech view)
    if (currentUser && !isGestor) {
      const qMine = query(
        collection(db, CollectionName.TASKS),
        where('assigneeId', '==', currentUser.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const unsubMine = onSnapshot(qMine, snap => {
        setMinhasOS(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      }, () => {});
      return () => { unsubAll(); unsubMine(); unsubPending(); };
    }
    return () => { unsubAll(); unsubPending(); };
  }, [currentUser, isGestor]);

  // ── Stat cards config ──────────────────────────────────────────────────────
  const statCards = [
    {
      label: 'O.S. Abertas',
      value: statOS.abertas,
      icon: Briefcase,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    {
      label: 'Em Execução',
      value: statOS.emExecucao,
      icon: Zap,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    {
      label: 'Concluídas',
      value: statOS.concluidas,
      icon: CheckSquare,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
    },
    {
      label: 'Atrasadas ⚠️',
      value: statOS.atrasadas,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
    },
  ];

  const STATUS_CLS: Record<string, string> = {
    'pending':     'bg-yellow-100 text-yellow-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    'completed':   'bg-green-100 text-green-700',
    'blocked':     'bg-red-100 text-red-700',
    'cancelled':   'bg-gray-100 text-gray-500',
  };
  const STATUS_LBL: Record<string, string> = {
    'pending': 'Pendente', 'in-progress': 'Em execução',
    'completed': 'Concluída', 'blocked': 'Bloqueada', 'cancelled': 'Cancelada',
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bom dia, {userProfile?.displayName?.split(' ')[0] || 'Colaborador'} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Gamification Banner */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-700 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-sm">
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-extrabold">Nível {level}</h2>
                {streak >= 3 && (
                  <span className="inline-flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    <Flame size={10} /> {streak} streak
                  </span>
                )}
              </div>
              <p className="text-brand-200 text-sm">{xp} XP · próximo nível em {XP_PER_LEVEL - (xp % XP_PER_LEVEL)} XP</p>
            </div>
          </div>
          <div className="w-full md:w-1/3">
            <div className="flex justify-between text-xs mb-1.5 font-medium text-brand-200">
              <span>Progresso Nível {level}</span>
              <span>{Math.round(prog)}%</span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-3 backdrop-blur-sm overflow-hidden">
              <div
                className="bg-gradient-to-r from-yellow-400 to-amber-300 h-3 rounded-full transition-all duration-700 shadow-lg"
                style={{ width: `${prog}%` }}
              />
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      </div>

      {/* Central de Pendências — só para gestores/admin */}
      {isGestor && <CentralPendencias />}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className={`bg-white p-5 rounded-2xl border ${stat.border} shadow-sm hover:shadow-md transition-shadow`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.bg} p-2.5 rounded-xl`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <h3 className="text-3xl font-extrabold text-gray-900 mb-0.5">{stat.value}</h3>
            <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* My OS (tech) or Recent OS (gestor) */}
        {!isGestor && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
              <User size={15} className="text-brand-500" /> Minhas O.S.
            </h3>
            {minhasOS.length === 0 ? (
              <p className="text-xs text-gray-400 italic text-center py-8">Nenhuma O.S. atribuída a você no momento.</p>
            ) : (
              <div className="space-y-2">
                {minhasOS.map(os => (
                  <div key={os.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{os.title}</p>
                      <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Building2 size={9} /> {os.clientName || '—'}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CLS[os.status] || 'bg-gray-100 text-gray-500'}`}>
                      {STATUS_LBL[os.status] || os.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent activity feed */}
        <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${!isGestor ? '' : 'lg:col-span-1'}`}>
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
            <Activity size={15} className="text-brand-500" /> Atividades Recentes
          </h3>
          {recentOS.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-8">Nenhuma O.S. encontrada.</p>
          ) : (
            <div className="space-y-2">
              {recentOS.map(os => (
                <div key={os.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    os.status === 'completed' ? 'bg-green-500' :
                    os.status === 'in-progress' ? 'bg-blue-500' :
                    os.status === 'blocked' ? 'bg-red-500' : 'bg-amber-400'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{os.title}</p>
                    <p className="text-[10px] text-gray-400">{os.clientName || '—'} · {fmtDate((os as any).updatedAt)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${STATUS_CLS[os.status] || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LBL[os.status] || os.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gestor: Tarefas pendentes de agendamento */}
        {isGestor && pendingTasks.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <ClipboardList size={15} className="text-amber-500" /> Tarefas Pendentes de Agendamento
              </h3>
              <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                {pendingTasks.length}
              </span>
            </div>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
              {pendingTasks.map(t => {
                const prioCfg: Record<string, { bg: string; text: string; label: string }> = {
                  urgente: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgente' },
                  alta:    { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Alta' },
                  media:   { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Média' },
                  baixa:   { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Baixa' },
                };
                const p = prioCfg[t.prioridade || 'media'] || prioCfg.media;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${t.prioridade === 'urgente' ? 'bg-red-500' : t.prioridade === 'alta' ? 'bg-orange-500' : t.prioridade === 'baixa' ? 'bg-gray-300' : 'bg-blue-400'}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{t.label}</p>
                      <p className="text-[10px] text-gray-400 truncate">
                        <Building2 size={9} className="inline mr-0.5" />{t.projectName}
                        {t.descricao && <> · {t.descricao}</>}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${p.bg} ${p.text}`}>
                      {p.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Gestor: O.S. atrasadas alert */}
        {isGestor && statOS.atrasadas > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-red-600" />
              <h3 className="text-sm font-bold text-red-700">O.S. Atrasadas ({statOS.atrasadas})</h3>
            </div>
            <p className="text-xs text-red-600">
              Existem {statOS.atrasadas} ordem(s) de serviço com prazo vencido. Acesse o Pipeline ou Tarefas para verificar.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
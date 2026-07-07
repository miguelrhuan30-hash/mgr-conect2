/**
 * FieldOS — Minhas O.S. (visão unificada do técnico)
 * Abas: Hoje | Calendário | Pendências | Concluídas
 */
import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList, Clock, CheckCircle2, AlertCircle, Wrench, User,
  MapPin, Sun, ChevronRight, CalendarDays, Plus, ChevronLeft, Inbox, Shield,
} from 'lucide-react';
import FieldOSPendenciaModal from './FieldOSPendenciaModal';
import FieldOSDetail from './FieldOSDetail';
import FieldGestaoOS from './FieldGestaoOS';
import FieldTarefasAvulsas from './FieldTarefasAvulsas';

export interface OSField {
  id: string;
  title?: string;
  description?: string;
  clientName?: string;
  localizacao?: string;
  status?: string;
  priority?: string;
  startDate?: Timestamp;
  tarefasOS?: any[];
  numeroOS?: string;
  tipoServico?: string;
  assignedTo?: string | null;
  assigneeName?: string | null;
  assignedUsers?: string[];
  assignedUserNames?: string[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'pending':     { label: 'Pendente',   color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',     icon: <AlertCircle size={12} /> },
  'in-progress': { label: 'Em campo',   color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',    icon: <Wrench size={12} /> },
  'completed':   { label: 'Concluída',  color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={12} /> },
  'open':        { label: 'Aberta',     color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',          icon: <Clock size={12} /> },
};

const PRIORIDADE_COLOR: Record<string, string> = {
  alta: 'border-l-red-500', media: 'border-l-yellow-500', baixa: 'border-l-emerald-500', low: 'border-l-gray-600',
};

const PRIORIDADE_DOT: Record<string, string> = {
  alta: 'bg-red-500', media: 'bg-yellow-500', baixa: 'bg-emerald-500', low: 'bg-gray-600',
};

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isSameDay = (a: Date, b: Date) => toKey(a) === toKey(b);

type Tab = 'hoje' | 'calendario' | 'pendencias' | 'avulsas' | 'concluidas' | 'geral';

export default function FieldOS() {
  const { currentUser, userProfile } = useAuth();
  const [allOS, setAllOS]                   = useState<OSField[]>([]);
  const [semResponsavel, setSemResponsavel]  = useState<OSField[]>([]);
  const [concluidas, setConcluidas]         = useState<OSField[]>([]);
  const [selectedOS, setSelectedOS]         = useState<OSField | null>(null);
  const [loading, setLoading]               = useState(true);
  const [showModal, setShowModal]           = useState(false);
  const [tab, setTab]                       = useState<Tab>('hoje');
  const [mesAtual, setMesAtual]             = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [diaSel, setDiaSel]                 = useState<Date | null>(new Date());
  const canCreateOS = !!(userProfile?.permissions?.canCreateTasks);
  const canViewAll  = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '')
                    || !!(userProfile?.permissions?.canManageProjects)
                    || !!(userProfile?.permissions?.canEditTasks && userProfile?.permissions?.canDeleteTasks);

  useEffect(() => {
    if (!currentUser) return;
    const uid    = currentUser.uid;
    const STATUS = ['pending', 'in-progress', 'open'];

    const qPrincipal = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', uid),
      where('status', 'in', STATUS),
    );
    const qColaborador = query(
      collection(db, 'tasks'),
      where('assignedUsers', 'array-contains', uid),
      where('status', 'in', STATUS),
    );
    const qSemResponsavel = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', null),
      where('status', 'in', STATUS),
    );
    const qConcluidaPrincipal = query(
      collection(db, 'tasks'),
      where('assignedTo', '==', uid),
      where('status', '==', 'completed'),
    );
    const qConcluidaColab = query(
      collection(db, 'tasks'),
      where('assignedUsers', 'array-contains', uid),
      where('status', '==', 'completed'),
    );

    const merge = (s1: OSField[], s2: OSField[]) => {
      const seen = new Set<string>();
      const result: OSField[] = [];
      [...s1, ...s2].forEach(os => {
        if (!seen.has(os.id)) { seen.add(os.id); result.push(os); }
      });
      return result;
    };

    let snap1: OSField[] = [], snap2: OSField[] = [], snap3: OSField[] = [];
    let snap4: OSField[] = [], snap5: OSField[] = [];
    let loaded = [false, false, false, false, false];

    const update = () => {
      if (loaded.every(Boolean)) {
        setAllOS(merge(snap1, snap2));
        setSemResponsavel(
          snap3.filter(os => !snap1.some(o => o.id === os.id) && !snap2.some(o => o.id === os.id))
        );
        const conc = merge(snap4, snap5);
        conc.sort((a, b) => {
          const aT = (a as any).relatorioFinal?.finalizadoEm?.toDate?.()?.getTime?.() ?? 0;
          const bT = (b as any).relatorioFinal?.finalizadoEm?.toDate?.()?.getTime?.() ?? 0;
          return bT - aT;
        });
        setConcluidas(conc);
        setLoading(false);
      }
    };

    const toOS        = (d: any): OSField => ({ id: d.id, ...d.data() } as OSField);
    const notArchived = (os: OSField) => !(os as any).archived;

    const unsub1 = onSnapshot(qPrincipal,
      snap => { snap1 = snap.docs.map(toOS).filter(notArchived); loaded[0] = true; update(); },
      err  => { console.error('[FieldOS] qPrincipal:', err.code); loaded[0] = true; update(); },
    );
    const unsub2 = onSnapshot(qColaborador,
      snap => { snap2 = snap.docs.map(toOS).filter(notArchived); loaded[1] = true; update(); },
      err  => { console.error('[FieldOS] qColaborador:', err.code); loaded[1] = true; update(); },
    );
    const unsub3 = onSnapshot(qSemResponsavel,
      snap => { snap3 = snap.docs.map(toOS).filter(notArchived); loaded[2] = true; update(); },
      err  => { console.error('[FieldOS] qSemResponsavel:', err.code); loaded[2] = true; update(); },
    );
    const unsub4 = onSnapshot(qConcluidaPrincipal,
      snap => { snap4 = snap.docs.map(toOS).filter(notArchived); loaded[3] = true; update(); },
      err  => { console.error('[FieldOS] qConcluidaPrincipal:', err.code); loaded[3] = true; update(); },
    );
    const unsub5 = onSnapshot(qConcluidaColab,
      snap => { snap5 = snap.docs.map(toOS).filter(notArchived); loaded[4] = true; update(); },
      err  => { console.error('[FieldOS] qConcluidaColab:', err.code); loaded[4] = true; update(); },
    );

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [currentUser]);

  const hoje   = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const amanha = useMemo(() => new Date(hoje.getTime() + 86400000), [hoje]);

  const { emAndamento, deHoje, proximas, semData, comData } = useMemo(() => {
    const emAndamento: OSField[] = [];
    const deHoje:      OSField[] = [];
    const proximas:    OSField[] = [];
    const semData:     OSField[] = [];
    const comData:     OSField[] = [];

    allOS.forEach(os => {
      if (os.status === 'in-progress') { emAndamento.push(os); return; }
      if (!os.startDate) { semData.push(os); return; }
      const d = os.startDate.toDate();
      comData.push(os);
      if (d >= hoje && d < amanha)  deHoje.push(os);
      else if (d >= amanha)         proximas.push(os);
    });

    const byTime = (a: OSField, b: OSField) =>
      (a.startDate?.toDate().getTime() ?? 0) - (b.startDate?.toDate().getTime() ?? 0);
    deHoje.sort(byTime);
    proximas.sort(byTime);

    return { emAndamento, deHoje, proximas, semData, comData };
  }, [allOS, hoje, amanha]);

  const osPorDia = useMemo(() => {
    const m: Record<string, OSField[]> = {};
    comData.forEach(os => {
      if (!os.startDate) return;
      const k = toKey(os.startDate.toDate());
      if (!m[k]) m[k] = [];
      m[k].push(os);
    });
    return m;
  }, [comData]);

  const diasDoMes = useMemo(() => {
    const days: (Date | null)[] = [];
    const first = new Date(mesAtual);
    const last  = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), d));
    }
    return days;
  }, [mesAtual]);

  const hojeDate        = new Date();
  const osDiaSelecionado = diaSel ? (osPorDia[toKey(diaSel)] ?? []) : [];
  const navMes = (delta: number) => {
    setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setDiaSel(null);
  };

  const totalHoje      = emAndamento.length + deHoje.length;
  const totalPendencias = semData.length + semResponsavel.length;
  const dataHoje       = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

  // ── Sub-components ───────────────────────────────────────────────────────────

  const OSCard = ({ os }: { os: OSField }) => {
    const cfg   = STATUS_CONFIG[os.status ?? ''] ?? STATUS_CONFIG['open'];
    const borda = PRIORIDADE_COLOR[os.priority ?? 'low'] ?? 'border-l-gray-700';
    const hora  = os.startDate
      ? os.startDate.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : null;
    return (
      <div
        onClick={() => setSelectedOS(os)}
        className={`bg-gray-900 border border-gray-800 border-l-4 ${borda} rounded-xl p-4 active:scale-[0.98] transition-transform cursor-pointer`}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold text-white leading-snug flex-1">{os.title ?? 'Sem título'}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {hora && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5">
                {hora}
              </span>
            )}
            <ChevronRight size={15} className="text-gray-600" />
          </div>
        </div>
        <div className="space-y-1">
          {os.clientName && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <User size={11} className="text-gray-600 flex-shrink-0" /> {os.clientName}
            </div>
          )}
          {os.localizacao && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <MapPin size={11} className="text-gray-600 flex-shrink-0" /> {os.localizacao}
            </div>
          )}
        </div>
        <div className="mt-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
        </div>
      </div>
    );
  };

  const OSCardConcluida = ({ os }: { os: OSField }) => {
    const finalizado = (os as any).relatorioFinal?.finalizadoEm?.toDate?.();
    const dataStr = finalizado
      ? finalizado.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
      : os.startDate?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    return (
      <div
        onClick={() => setSelectedOS(os)}
        className="bg-gray-900 border border-gray-800 border-l-4 border-l-emerald-600 rounded-xl p-4 active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-300 leading-snug flex-1">{os.title ?? 'Sem título'}</h3>
          <ChevronRight size={15} className="text-gray-600 flex-shrink-0 mt-0.5" />
        </div>
        <div className="flex items-center gap-3 mt-2">
          {os.clientName && (
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <User size={10} className="text-gray-600" /> {os.clientName}
            </div>
          )}
          {dataStr && (
            <div className="flex items-center gap-1 text-xs ml-auto">
              <CheckCircle2 size={10} className="text-emerald-500" />
              <span className="text-emerald-600 font-semibold">{dataStr}</span>
            </div>
          )}
        </div>
        {(os as any).relatorioFinal?.pendencia && (
          <div className="mt-2 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-lg px-2 py-1">
            Pendência: {(os as any).relatorioFinal.pendencia}
          </div>
        )}
      </div>
    );
  };

  const CalendarioCard = ({ os }: { os: OSField }) => {
    const cfg  = STATUS_CONFIG[os.status ?? ''] ?? STATUS_CONFIG['open'];
    const pDot = PRIORIDADE_DOT[os.priority ?? 'low'] ?? 'bg-gray-600';
    return (
      <div onClick={() => setSelectedOS(os)} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2 cursor-pointer active:bg-gray-800/80">
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${pDot}`} />
          <p className="text-sm font-semibold text-white leading-snug flex-1">{os.title ?? 'Sem título'}</p>
        </div>
        {os.clientName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-4">
            <User size={10} className="text-gray-600" /> {os.clientName}
          </div>
        )}
        <div className="pl-4 flex items-center gap-2">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>
          {os.startDate && (
            <span className="text-[10px] text-gray-500 ml-auto">
              {os.startDate.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    {showModal && <FieldOSPendenciaModal onClose={() => setShowModal(false)} />}
    {selectedOS && <FieldOSDetail os={selectedOS} onClose={() => setSelectedOS(null)} onUpdate={updated => setSelectedOS(updated)} />}
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 bg-gray-900/60 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sun size={16} className="text-yellow-400" />
            <p className="text-xs font-bold text-gray-400 capitalize">{dataHoje}</p>
          </div>
          {canCreateOS && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold active:bg-emerald-600/40"
            >
              <Plus size={12} /> Nova O.S.
            </button>
          )}
        </div>
        <p className="text-lg font-black text-white mt-1">
          {tab === 'geral' ? 'Gestão Geral de O.S.' : 'Minhas O.S.'}
        </p>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-1 px-4 pt-2.5 pb-2 overflow-x-auto scrollbar-none bg-gray-900 border-b border-gray-800 flex-shrink-0">
        {([
          { id: 'hoje',       label: 'Hoje',        badge: totalHoje > 0 ? totalHoje : null,           icon: null,                              adminOnly: false },
          { id: 'calendario', label: 'Calendário',  badge: null,                                       icon: null,                              adminOnly: false },
          { id: 'pendencias', label: 'Pendências',  badge: totalPendencias > 0 ? totalPendencias : null, icon: null,                            adminOnly: false },
          { id: 'avulsas',    label: 'Avulsas',      badge: null,                                       icon: null,                              adminOnly: false },
          { id: 'concluidas', label: 'Concluídas',  badge: concluidas.length > 0 ? concluidas.length : null, icon: null,                       adminOnly: false },
          { id: 'geral',      label: 'Geral',       badge: null,                                       icon: <Shield size={10} />,              adminOnly: true  },
        ] as { id: Tab; label: string; badge: number | null; icon: React.ReactNode; adminOnly: boolean }[])
          .filter(t => !t.adminOnly || canViewAll)
          .map(({ id, label, badge, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === id
                ? id === 'geral' ? 'bg-orange-600 text-white' : 'bg-emerald-600 text-white'
                : 'bg-gray-800 text-gray-400 active:bg-gray-700'
            }`}
          >
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {label}
            {badge !== null && (
              <span className={`text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center ${
                tab === id ? 'bg-white/20 text-white' : 'bg-orange-500 text-white'
              }`}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ ABA: GERAL (admin) ══════════════ */}
      {tab === 'geral' && (
        <div className="flex-1 overflow-hidden">
          <FieldGestaoOS />
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${tab === 'geral' ? 'hidden' : ''}`}>

        {/* ══════════════ ABA: HOJE ══════════════ */}
        {tab === 'hoje' && (
          <div className="px-4 py-4 space-y-5">

            {emAndamento.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Wrench size={13} className="text-yellow-400" />
                  <span className="text-xs font-bold text-yellow-400 uppercase tracking-wide">Em andamento</span>
                </div>
                <div className="space-y-3">
                  {emAndamento.map(os => <OSCard key={os.id} os={os} />)}
                </div>
              </section>
            )}

            {deHoje.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays size={13} className="text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Agendadas para hoje</span>
                </div>
                <div className="space-y-3">
                  {deHoje.map(os => <OSCard key={os.id} os={os} />)}
                </div>
              </section>
            )}

            {totalHoje === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                <ClipboardList size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma O.S. para hoje</p>
                <p className="text-xs mt-1 text-gray-700">
                  Veja o <span className="text-emerald-500 font-semibold">Calendário</span> ou <span className="text-orange-500 font-semibold">Pendências</span>
                </p>
              </div>
            )}

            {proximas.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2 pt-2 border-t border-gray-800/60">
                  <Clock size={13} className="text-gray-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Próximas</span>
                </div>
                <div className="space-y-3">
                  {proximas.slice(0, 3).map(os => {
                    const cfg   = STATUS_CONFIG[os.status ?? ''] ?? STATUS_CONFIG['open'];
                    const borda = PRIORIDADE_COLOR[os.priority ?? 'low'] ?? 'border-l-gray-700';
                    const data  = os.startDate?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
                    return (
                      <div key={os.id} onClick={() => setSelectedOS(os)}
                        className={`bg-gray-900/50 border border-gray-800/60 border-l-4 ${borda} rounded-xl px-4 py-3 flex items-center gap-3 opacity-70 cursor-pointer active:opacity-100`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-300 truncate">{os.title ?? 'Sem título'}</p>
                          {os.clientName && <p className="text-[10px] text-gray-500 truncate">{os.clientName}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold ${cfg.color}`}>
                            {cfg.icon} {cfg.label}
                          </span>
                          {data && <span className="text-[9px] text-gray-600 font-bold">{data}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {proximas.length > 3 && (
                    <p className="text-center text-[11px] text-gray-600">
                      +{proximas.length - 3} mais — veja no Calendário
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {/* ══════════════ ABA: CALENDÁRIO ══════════════ */}
        {tab === 'calendario' && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900/60">
              <button onClick={() => navMes(-1)} className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
                <ChevronLeft size={16} className="text-gray-400" />
              </button>
              <span className="text-sm font-bold text-white capitalize">
                {mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => navMes(1)} className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="grid grid-cols-7 px-2 pb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-gray-600 py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 px-2 gap-y-1">
              {diasDoMes.map((dia, i) => {
                if (!dia) return <div key={`empty-${i}`} />;
                const k      = toKey(dia);
                const osD    = osPorDia[k] ?? [];
                const ehHoje = isSameDay(dia, hojeDate);
                const ehSel  = diaSel ? isSameDay(dia, diaSel) : false;
                const temOS  = osD.length > 0;
                return (
                  <button
                    key={k}
                    onClick={() => setDiaSel(ehSel ? null : dia)}
                    className={`relative flex flex-col items-center py-1.5 rounded-xl transition-colors
                      ${ehSel  ? 'bg-emerald-600'
                      : ehHoje ? 'bg-gray-800 ring-1 ring-emerald-500/50'
                      : temOS  ? 'bg-gray-800/60 active:bg-gray-800'
                      :          'active:bg-gray-800/40'}`}
                  >
                    <span className={`text-xs font-bold ${ehSel ? 'text-white' : ehHoje ? 'text-emerald-400' : 'text-gray-300'}`}>
                      {dia.getDate()}
                    </span>
                    {temOS && (
                      <div className="flex gap-0.5 mt-0.5">
                        {osD.slice(0, 3).map((os, idx) => (
                          <div key={idx} className={`w-1.5 h-1.5 rounded-full ${PRIORIDADE_DOT[os.priority ?? 'low'] ?? 'bg-gray-500'}`} />
                        ))}
                        {osD.length > 3 && <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="px-4 pt-4 pb-4 space-y-3">
              {diaSel && (
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays size={13} className="text-emerald-400" />
                  <span className="text-xs font-bold text-gray-400 capitalize">
                    {diaSel.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                  </span>
                  {osDiaSelecionado.length > 0 && (
                    <span className="ml-auto text-[10px] text-gray-500">{osDiaSelecionado.length} O.S.</span>
                  )}
                </div>
              )}
              {diaSel && osDiaSelecionado.length === 0 && (
                <div className="text-center py-8 text-gray-600">
                  <CalendarDays size={32} className="mx-auto mb-2 opacity-40" />
                  <p className="text-xs">Nenhuma O.S. para este dia</p>
                </div>
              )}
              {osDiaSelecionado.map(os => <CalendarioCard key={os.id} os={os} />)}
              {!diaSel && comData.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhuma O.S. agendada</p>
                  <p className="text-xs mt-1">Suas ordens com datas aparecerão no calendário</p>
                </div>
              )}
              {!diaSel && comData.length > 0 && (
                <p className="text-center text-xs text-gray-600 py-4">Toque em um dia para ver as O.S. agendadas</p>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ABA: PENDÊNCIAS ══════════════ */}
        {tab === 'pendencias' && (
          <div className="px-4 py-4 space-y-3">
            {canCreateOS && (
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 text-emerald-400 text-sm font-semibold active:bg-emerald-500/10"
              >
                <Plus size={15} /> Nova O.S.
              </button>
            )}

            {semData.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-1">
                  <Inbox size={13} className="text-orange-400" />
                  <span className="text-xs font-bold text-orange-400">
                    {semData.length} O.S. atribuídas — aguardando agendamento
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  Criadas e atribuídas a você, aguardando data definida pelo gestor.
                </p>
                {semData.map(os => <CalendarioCard key={os.id} os={os} />)}
              </>
            )}

            {semResponsavel.length > 0 && (
              <>
                <div className={`flex items-center gap-2 ${semData.length > 0 ? 'pt-2 mt-2 border-t border-gray-800' : 'pt-1'}`}>
                  <ClipboardList size={13} className="text-blue-400" />
                  <span className="text-xs font-bold text-blue-400">
                    {semResponsavel.length} O.S. disponíveis para execução
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  Sem responsável — qualquer técnico pode pegar e iniciar.
                </p>
                {semResponsavel.map(os => <CalendarioCard key={os.id} os={os} />)}
              </>
            )}

            {totalPendencias === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                <Inbox size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma O.S. pendente</p>
                <p className="text-xs mt-1 text-gray-700">Todas as ordens têm data definida ou estão em execução</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ ABA: TAREFAS AVULSAS (Hub de Tarefas do Projeto) ══════════════ */}
        {tab === 'avulsas' && <FieldTarefasAvulsas />}

        {/* ══════════════ ABA: CONCLUÍDAS ══════════════ */}
        {tab === 'concluidas' && (
          <div className="px-4 py-4 space-y-3">
            {concluidas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-600">
                <CheckCircle2 size={40} className="mb-3 opacity-20" />
                <p className="text-sm font-medium">Nenhuma O.S. concluída ainda</p>
                <p className="text-xs mt-1 text-gray-700">Suas O.S. finalizadas aparecerão aqui</p>
              </div>
            ) : (
              <>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-emerald-300">
                      {concluidas.length} O.S. {concluidas.length === 1 ? 'concluída' : 'concluídas'}
                    </p>
                    <p className="text-xs text-gray-500">Seu histórico de execuções</p>
                  </div>
                </div>
                {concluidas.map(os => <OSCardConcluida key={os.id} os={os} />)}
              </>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  );
}

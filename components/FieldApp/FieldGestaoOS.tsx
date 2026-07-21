/**
 * FieldGestaoOS — Gestão de O.S. para admin.
 * Mostra TODAS as OS (sem filtro de usuário), com responsável, data, status e dias em aberto.
 * Tabs: Pendentes | Em Andamento | Agendadas | Concluídas
 */
import React, { useEffect, useState, useMemo } from 'react';
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { CollectionName } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import {
  ClipboardList, Clock, CheckCircle2, AlertCircle, Wrench, User,
  CalendarDays, ChevronRight, ChevronLeft, Plus, Shield,
  MapPinned, Navigation, Gauge, Loader2, MessageSquareText,
} from 'lucide-react';
import { OSField } from './FieldOS';
import FieldGestaoOSDetail from './FieldGestaoOSDetail';
import FieldOSPendenciaModal from './FieldOSPendenciaModal';
import LocationTimelineMap from '../LocationTimelineMap';
import ChamadosSLA from '../ChamadosSLA';
import { getSlaBadgeInfo } from '../../services/osService';
import { buscarPingsDoDia, calcularKmPercorrido, LocationPing } from '../../services/trackerService';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'pending':     { label: 'Pendente',     color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',    icon: <AlertCircle size={11} /> },
  'in-progress': { label: 'Em andamento', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   icon: <Wrench size={11} /> },
  'completed':   { label: 'Concluída',    color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={11} /> },
  'open':        { label: 'Aberta',       color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',          icon: <Clock size={11} /> },
};

const PRIORIDADE_BORDA: Record<string, string> = {
  alta: 'border-l-red-500', media: 'border-l-yellow-500', baixa: 'border-l-emerald-500', low: 'border-l-gray-700',
};

const diasEmAberto = (os: OSField): number => {
  const criado = (os as any).criadoEm?.toDate?.() ?? (os as any).createdAt?.toDate?.();
  if (!criado) return 0;
  return Math.floor((Date.now() - criado.getTime()) / 86400000);
};

// Bolinhas do calendário seguem a cor do STATUS (mesma paleta de STATUS_CONFIG),
// não a prioridade — verde concluída, amarelo em andamento, laranja pendente.
const STATUS_DOT: Record<string, string> = {
  pending: 'bg-orange-500', 'in-progress': 'bg-yellow-500', completed: 'bg-emerald-500', open: 'bg-blue-500',
};
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const isSameDay = (a: Date, b: Date) => toKey(a) === toKey(b);

type TabGestao = 'pendentes' | 'andamento' | 'agendadas' | 'concluidas' | 'calendario' | 'rastreio' | 'chamados';

const fmtHoraPing = (p: LocationPing) => {
  const d = p.timestamp?.toDate?.();
  return d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
};

export default function FieldGestaoOS() {
  const { userProfile } = useAuth();
  const isAdmin   = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '')
                  || !!(userProfile?.permissions?.canManageProjects)
                  || !!(userProfile?.permissions?.canEditTasks && userProfile?.permissions?.canDeleteTasks);
  const canCreate = !!(userProfile?.permissions?.canCreateTasks);
  const isChamadoAdmin = ['admin', 'gestor', 'manager', 'developer'].includes(userProfile?.role || '')
                  || !!(userProfile?.permissions?.canManageChamados)
                  || !!(userProfile?.permissions?.canManageProjects);

  const [allOS, setAllOS]           = useState<OSField[]>([]);
  const [chamadosAbertos, setChamadosAbertos] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<TabGestao>('pendentes');
  const [selectedOS, setSelectedOS] = useState<OSField | null>(null);
  const [showModal, setShowModal]   = useState(false);
  const [mesAtual, setMesAtual]     = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [diaSel, setDiaSel]         = useState<Date | null>(new Date());

  // ── Rastreio — linha do tempo de localização (sem vínculo com O.S.) ──
  const [rastreioUsers, setRastreioUsers] = useState<{ id: string; nome: string }[]>([]);
  const [rastreioUserId, setRastreioUserId] = useState('');
  const [rastreioData, setRastreioData] = useState(() => toKey(new Date()));
  const [rastreioPings, setRastreioPings] = useState<LocationPing[] | null>(null);
  const [rastreioLoading, setRastreioLoading] = useState(false);

  useEffect(() => {
    if (!isChamadoAdmin) return;
    const q = query(collection(db, CollectionName.CHAMADOS_SLA), where('status', 'in', ['aberto', 'em_triagem']));
    return onSnapshot(q, snap => setChamadosAbertos(snap.size), () => {});
  }, [isChamadoAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    getDocs(collection(db, CollectionName.USERS)).then(snap => {
      setRastreioUsers(snap.docs.map(d => {
        const u: any = d.data();
        return { id: d.id, nome: u.nomeCompleto || u.displayName || u.email || d.id };
      }).sort((a, b) => a.nome.localeCompare(b.nome)));
    }).catch(() => {});
  }, [isAdmin]);

  const buscarRastreio = async () => {
    if (!rastreioUserId || !rastreioData) return;
    setRastreioLoading(true);
    setRastreioPings(null);
    try {
      const pings = await buscarPingsDoDia(rastreioUserId, rastreioData);
      setRastreioPings(pings);
    } catch {
      setRastreioPings([]);
    } finally {
      setRastreioLoading(false);
    }
  };

  const nomeRastreioSelecionado = rastreioUsers.find(u => u.id === rastreioUserId)?.nome;

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    const unsub = onSnapshot(collection(db, 'tasks'), snap => {
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as OSField))
        .filter(os => !(os as any).archived);
      all.sort((a, b) => {
        const aT = (a as any).criadoEm?.seconds ?? (a as any).createdAt?.seconds ?? 0;
        const bT = (b as any).criadoEm?.seconds ?? (b as any).createdAt?.seconds ?? 0;
        return bT - aT;
      });
      setAllOS(all);
      setLoading(false);
    }, err => {
      console.error('[FieldGestaoOS]', err);
      setLoading(false);
    });
    return unsub;
  }, [isAdmin]);

  const { pendentes, andamento, agendadas, concluidas } = useMemo(() => {
    const hoje   = new Date(); hoje.setHours(0, 0, 0, 0);
    const pendentes:  OSField[] = [];
    const andamento:  OSField[] = [];
    const agendadas:  OSField[] = [];
    const concluidas: OSField[] = [];

    allOS.forEach(os => {
      if (os.status === 'completed')   { concluidas.push(os); return; }
      if (os.status === 'in-progress') { andamento.push(os); return; }
      // Pendentes = status 'pending', sempre — tenha data marcada ou não.
      if (os.status === 'pending')     { pendentes.push(os); return; }
      // Sobra status 'open' (ou sem status): agendada se tiver data futura,
      // senão cai em pendentes como fallback.
      if (os.startDate && os.startDate.toDate() >= hoje) { agendadas.push(os); return; }
      pendentes.push(os);
    });

    agendadas.sort((a, b) =>
      (a.startDate?.toDate().getTime() ?? 0) - (b.startDate?.toDate().getTime() ?? 0)
    );

    return { pendentes, andamento, agendadas, concluidas };
  }, [allOS]);

  const currentList = useMemo(() => {
    if (tab === 'pendentes') return pendentes;
    if (tab === 'andamento') return andamento;
    if (tab === 'agendadas') return agendadas;
    if (tab === 'concluidas') return concluidas;
    return [];
  }, [tab, pendentes, andamento, agendadas, concluidas]);

  // ── Calendário geral — todas as O.S. com data, de todos os técnicos ──────
  const osPorDia = useMemo(() => {
    const m: Record<string, OSField[]> = {};
    allOS.forEach(os => {
      if (!os.startDate) return;
      const k = toKey(os.startDate.toDate());
      if (!m[k]) m[k] = [];
      m[k].push(os);
    });
    return m;
  }, [allOS]);

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

  const hojeDate = new Date();
  const osDiaSelecionado = diaSel ? (osPorDia[toKey(diaSel)] ?? []) : [];
  const navMes = (delta: number) => {
    setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setDiaSel(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center text-gray-600">
        <Shield size={40} className="mb-3 opacity-30" />
        <p className="text-sm font-medium">Acesso restrito</p>
        <p className="text-xs mt-1">Apenas gestores e administradores podem acessar esta área.</p>
      </div>
    );
  }

  const OSGestaoCard = ({ os }: { os: OSField }) => {
    const cfg   = STATUS_CONFIG[os.status ?? ''] ?? STATUS_CONFIG['open'];
    const borda = PRIORIDADE_BORDA[os.priority ?? 'low'] ?? 'border-l-gray-700';
    const dias  = diasEmAberto(os);
    const dataAgendada = os.startDate
      ? os.startDate.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
      : null;
    const responsavel = os.assigneeName
      ?? (os.assignedUserNames && os.assignedUserNames.length > 0 ? os.assignedUserNames[0] : null);
    const slaBadge = getSlaBadgeInfo(os);

    return (
      <div
        onClick={() => setSelectedOS(os)}
        className={`bg-gray-900 border border-gray-800 border-l-4 ${borda} rounded-xl p-4 active:scale-[0.98] transition-transform cursor-pointer`}
      >
        {/* Title */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            {os.numeroOS && (
              <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wide mb-0.5">{os.numeroOS}</p>
            )}
            <h3 className="text-sm font-semibold text-white leading-snug">{os.title ?? 'Sem título'}</h3>
            {os.clientName && (
              <p className="text-xs text-gray-500 mt-0.5">{os.clientName}</p>
            )}
          </div>
          <ChevronRight size={15} className="text-gray-600 flex-shrink-0 mt-1" />
        </div>

        {/* Meta */}
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </span>

          {slaBadge && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${slaBadge.cor} ${slaBadge.vencido ? 'animate-pulse' : ''}`}>
              {slaBadge.label}
            </span>
          )}

          {responsavel ? (
            <span className="flex items-center gap-1 text-[10px] text-gray-400">
              <User size={9} className="text-gray-600" /> {responsavel}
            </span>
          ) : (
            <span className="text-[10px] text-orange-400 font-semibold">Sem responsável</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {dataAgendada && (
              <span className="flex items-center gap-1 text-[10px] text-gray-500">
                <CalendarDays size={9} className="text-gray-600" /> {dataAgendada}
              </span>
            )}
            {dias > 0 && os.status !== 'completed' && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                dias > 14 ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : dias > 7  ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                :              'bg-gray-800 text-gray-500'
              }`}>
                {dias}d
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const TABS: { id: TabGestao; label: string; count: number; icon?: React.ReactNode }[] = [
    { id: 'calendario', label: 'Calendário', count: 0, icon: <CalendarDays size={11} /> },
    { id: 'pendentes',  label: 'Pendentes',  count: pendentes.length  },
    { id: 'andamento',  label: 'Em Campo',   count: andamento.length  },
    { id: 'agendadas',  label: 'Agendadas',  count: agendadas.length  },
    { id: 'concluidas', label: 'Concluídas', count: concluidas.length },
    ...(isChamadoAdmin ? [{ id: 'chamados' as TabGestao, label: 'Chamados', count: chamadosAbertos, icon: <MessageSquareText size={11} /> }] : []),
    { id: 'rastreio',   label: 'Rastreio',   count: 0, icon: <MapPinned size={11} /> },
  ];

  return (
    <>
    {showModal && <FieldOSPendenciaModal onClose={() => setShowModal(false)} />}
    {selectedOS && (
      <FieldGestaoOSDetail
        os={selectedOS}
        onClose={() => setSelectedOS(null)}
        onUpdate={updated => setSelectedOS(updated)}
        onDelete={() => setSelectedOS(null)}
      />
    )}
    <div className="flex flex-col h-full overflow-hidden">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-gray-900/60 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-orange-400" />
            <p className="text-xs font-bold text-orange-400 uppercase tracking-wide">Gestão de O.S.</p>
          </div>
          {canCreate && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-600/20 border border-orange-500/30 text-orange-400 text-[11px] font-bold active:bg-orange-600/40"
            >
              <Plus size={12} /> Nova O.S.
            </button>
          )}
        </div>
        <p className="text-lg font-black text-white mt-1">
          {allOS.length} O.S. {allOS.length === 1 ? 'ativa' : 'ativas'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-2.5 pb-2 overflow-x-auto scrollbar-none bg-gray-900 border-b border-gray-800 flex-shrink-0">
        {TABS.map(({ id, label, count, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors whitespace-nowrap flex-shrink-0 ${
              tab === id ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 active:bg-gray-700'
            }`}
          >
            {icon && icon} {label}
            {count > 0 && (
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                tab === id ? 'bg-white/20 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List / Calendário */}
      {tab === 'calendario' ? (
        <div className="flex-1 overflow-y-auto flex flex-col">
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
                    ${ehSel  ? 'bg-orange-600'
                    : ehHoje ? 'bg-gray-800 ring-1 ring-orange-500/50'
                    : temOS  ? 'bg-gray-800/60 active:bg-gray-800'
                    :          'active:bg-gray-800/40'}`}
                >
                  <span className={`text-xs font-bold ${ehSel ? 'text-white' : ehHoje ? 'text-orange-400' : 'text-gray-300'}`}>
                    {dia.getDate()}
                  </span>
                  {temOS && (
                    <div className="flex gap-0.5 mt-0.5">
                      {osD.slice(0, 3).map((os, idx) => (
                        <div key={idx} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[os.status ?? 'open'] ?? 'bg-gray-500'}`} />
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
                <CalendarDays size={13} className="text-orange-400" />
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
            {osDiaSelecionado.map(os => <OSGestaoCard key={os.id} os={os} />)}
            {!diaSel && (
              <p className="text-center text-xs text-gray-600 py-4">Toque em um dia para ver as O.S. agendadas</p>
            )}
          </div>
        </div>
      ) : tab === 'rastreio' ? (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Colaborador</label>
              <select value={rastreioUserId} onChange={e => setRastreioUserId(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500">
                <option value="">Selecione...</option>
                {rastreioUsers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data</label>
                <input type="date" value={rastreioData} onChange={e => setRastreioData(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500" />
              </div>
              <button onClick={buscarRastreio} disabled={!rastreioUserId || rastreioLoading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0">
                {rastreioLoading ? <Loader2 size={14} className="animate-spin" /> : <MapPinned size={14} />}
                Buscar
              </button>
            </div>
          </div>

          {rastreioPings && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
                  <p className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1"><Navigation size={9} /> Início</p>
                  <p className="text-sm font-black text-emerald-400 mt-0.5">{rastreioPings[0] ? fmtHoraPing(rastreioPings[0]) : '—'}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
                  <p className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1"><MapPinned size={9} /> Fim</p>
                  <p className="text-sm font-black text-red-400 mt-0.5">{rastreioPings.length > 0 ? fmtHoraPing(rastreioPings[rastreioPings.length - 1]) : '—'}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5">
                  <p className="text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1"><Gauge size={9} /> KM</p>
                  <p className="text-sm font-black text-blue-400 mt-0.5">{calcularKmPercorrido(rastreioPings)} km</p>
                </div>
              </div>

              <LocationTimelineMap pings={rastreioPings} height={280} />

              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-gray-800">
                  <p className="text-xs font-bold text-gray-300">
                    Trajeto de {nomeRastreioSelecionado} — {new Date(`${rastreioData}T12:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {rastreioPings.length === 0 ? (
                  <div className="p-6 text-center text-gray-600">
                    <MapPinned size={28} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-medium">Nenhum ping de GPS registrado nesse dia</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-800 max-h-[300px] overflow-y-auto">
                    {rastreioPings.map((p, i) => {
                      const isFirst = i === 0;
                      const isLast = i === rastreioPings.length - 1;
                      return (
                        <div key={i} className="px-3 py-2 flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isFirst ? 'bg-emerald-500' : isLast ? 'bg-red-500' : 'bg-blue-400'}`} />
                          <span className="text-xs font-bold text-gray-200 w-12 flex-shrink-0">{fmtHoraPing(p)}</span>
                          <span className="text-[10px] text-gray-500 font-mono truncate flex-1">{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {!rastreioPings && !rastreioLoading && (
            <p className="text-center text-xs text-gray-600 py-4">Selecione um colaborador e uma data, depois toque em Buscar.</p>
          )}
        </div>
      ) : tab === 'chamados' ? (
        <div className="flex-1 overflow-y-auto">
          <ChamadosSLA variant="dark" embedded />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {currentList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-600">
              <ClipboardList size={40} className="mb-3 opacity-30" />
              <p className="text-sm font-medium">Nenhuma O.S. nesta categoria</p>
            </div>
          ) : (
            currentList.map(os => <OSGestaoCard key={os.id} os={os} />)
          )}
        </div>
      )}
    </div>
    </>
  );
}

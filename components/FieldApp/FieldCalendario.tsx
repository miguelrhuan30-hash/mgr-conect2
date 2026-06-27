import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ChevronLeft, ChevronRight, CalendarDays, Inbox, ClipboardList,
  User, MapPin, Clock, Wrench, CheckCircle2, AlertCircle, Plus,
} from 'lucide-react';
import FieldOSPendenciaModal from './FieldOSPendenciaModal';
import FieldOSDetail from './FieldOSDetail';
import { OSField } from './FieldOS';

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'pending':     { label: 'Pendente',  color: 'bg-orange-500/20 text-orange-400 border-orange-500/30',    icon: <AlertCircle size={11} /> },
  'in-progress': { label: 'Em campo',  color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',   icon: <Wrench size={11} /> },
  'completed':   { label: 'Concluída', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: <CheckCircle2 size={11} /> },
  'open':        { label: 'Aberta',    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',          icon: <Clock size={11} /> },
};

const PRIORIDADE_DOT: Record<string, string> = {
  alta: 'bg-red-500', media: 'bg-yellow-500', baixa: 'bg-emerald-500',
};

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isSameDay = (a: Date, b: Date) => toKey(a) === toKey(b);

// ─── Componente ───────────────────────────────────────────────────────────────
export default function FieldCalendario() {
  const { currentUser, userProfile } = useAuth();
  const [allOS, setAllOS]           = useState<OSField[]>([]);
  const [semResponsavel, setSemResponsavel] = useState<OSField[]>([]);
  const [selectedOS, setSelectedOS] = useState<OSField | null>(null);
  const [loading, setLoading]   = useState(true);
  const [aba, setAba]           = useState<'calendario' | 'sem_data'>('calendario');
  const [showModal, setShowModal] = useState(false);
  const canCreateOS = !!(userProfile?.permissions?.canCreateTasks);
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [diaSel, setDiaSel]     = useState<Date | null>(new Date());

  // ── Busca todas as OS ativas do técnico (responsável principal + colaborador) ─
  useEffect(() => {
    if (!currentUser) return;
    const uid = currentUser.uid;
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

    const merge = (s1: OSField[], s2: OSField[]) => {
      const seen = new Set<string>();
      return [...s1, ...s2].filter(os => seen.has(os.id) ? false : (seen.add(os.id), true));
    };

    let snap1: OSField[] = [], snap2: OSField[] = [], snap3: OSField[] = [];
    let loaded1 = false, loaded2 = false, loaded3 = false;

    const update = () => {
      if (loaded1 && loaded2 && loaded3) {
        const minhas = merge(snap1, snap2);
        setAllOS(minhas);
        setSemResponsavel(snap3.filter(os => !minhas.some(o => o.id === os.id)));
        setLoading(false);
      }
    };

    const unsub1 = onSnapshot(qPrincipal,
      snap => { snap1 = snap.docs.map(d => ({ id: d.id, ...d.data() } as OSField)); loaded1 = true; update(); },
      err  => { console.error('[FieldCalendario] qPrincipal:', err.code, err.message); loaded1 = true; update(); },
    );
    const unsub2 = onSnapshot(qColaborador,
      snap => { snap2 = snap.docs.map(d => ({ id: d.id, ...d.data() } as OSField)); loaded2 = true; update(); },
      err  => { console.error('[FieldCalendario] qColaborador:', err.code, err.message); loaded2 = true; update(); },
    );
    const unsub3 = onSnapshot(qSemResponsavel,
      snap => { snap3 = snap.docs.map(d => ({ id: d.id, ...d.data() } as OSField)); loaded3 = true; update(); },
      err  => { console.error('[FieldCalendario] qSemResponsavel:', err.code, err.message); loaded3 = true; update(); },
    );

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [currentUser]);

  // ── Divisão: com data / sem data ─────────────────────────────────────────────
  const { comData, semData } = useMemo(() => ({
    comData: allOS.filter(os => !!os.startDate),
    semData: allOS.filter(os => !os.startDate),
  }), [allOS]);

  // ── Mapa: chave YYYY-MM-DD → lista de OS daquele dia ────────────────────────
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

  // ── Grid do mês ──────────────────────────────────────────────────────────────
  const diasDoMes = useMemo(() => {
    const days: (Date | null)[] = [];
    const first = new Date(mesAtual);
    const last  = new Date(mesAtual.getFullYear(), mesAtual.getMonth() + 1, 0);
    // Padding inicial (domingo = 0)
    for (let i = 0; i < first.getDay(); i++) days.push(null);
    for (let d = 1; d <= last.getDate(); d++) {
      days.push(new Date(mesAtual.getFullYear(), mesAtual.getMonth(), d));
    }
    return days;
  }, [mesAtual]);

  const osDiaSelecionado = diaSel ? (osPorDia[toKey(diaSel)] ?? []) : [];
  const hoje = new Date();

  const navMes = (delta: number) => {
    setMesAtual(m => new Date(m.getFullYear(), m.getMonth() + delta, 1));
    setDiaSel(null);
  };

  // ── Card de OS reutilizável ───────────────────────────────────────────────────
  const OSCard = ({ os }: { os: OSField }) => {
    const cfg  = STATUS_CONFIG[os.status ?? ''] ?? STATUS_CONFIG['open'];
    const pDot = PRIORIDADE_DOT[os.priority ?? 'low'] ?? 'bg-gray-600';
    return (
      <div onClick={() => setSelectedOS(os)} className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2 cursor-pointer active:bg-gray-800/80">
        <div className="flex items-start gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${pDot}`} />
          <p className="text-sm font-semibold text-white leading-snug flex-1">
            {os.title ?? 'Sem título'}
          </p>
        </div>
        {os.clientName && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-4">
            <User size={10} className="text-gray-600" />
            {os.clientName}
          </div>
        )}
        {os.localizacao && (
          <div className="flex items-center gap-1.5 text-xs text-gray-400 pl-4">
            <MapPin size={10} className="text-gray-600" />
            {os.localizacao}
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

  // ─── Render ─────────────────────────────────────────────────────────────────
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
    <div className="flex flex-col h-full">

      {/* ── Tabs ── */}
      <div className="flex gap-1 px-4 pt-3 pb-2 bg-gray-900 border-b border-gray-800">
        <button
          onClick={() => setAba('calendario')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            aba === 'calendario' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <CalendarDays size={13} /> Calendário
        </button>
        <button
          onClick={() => setAba('sem_data')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            aba === 'sem_data' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400'
          }`}
        >
          <Inbox size={13} /> Pendências
          {(semData.length + semResponsavel.length) > 0 && (
            <span className="ml-0.5 bg-orange-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
              {semData.length + semResponsavel.length}
            </span>
          )}
        </button>
        <span className="ml-auto text-[10px] text-gray-600 flex items-center">
          {allOS.length} O.S.
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* ══════════════ ABA: CALENDÁRIO ══════════════ */}
        {aba === 'calendario' && (
          <div className="flex flex-col">

            {/* Navegação do mês */}
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

            {/* Cabeçalho dias da semana */}
            <div className="grid grid-cols-7 px-2 pb-1">
              {WEEK_DAYS.map(d => (
                <div key={d} className="text-center text-[10px] font-bold text-gray-600 py-1">{d}</div>
              ))}
            </div>

            {/* Grid dos dias */}
            <div className="grid grid-cols-7 px-2 gap-y-1">
              {diasDoMes.map((dia, i) => {
                if (!dia) return <div key={`empty-${i}`} />;
                const k        = toKey(dia);
                const osHoje   = osPorDia[k] ?? [];
                const ehHoje   = isSameDay(dia, hoje);
                const ehSel    = diaSel ? isSameDay(dia, diaSel) : false;
                const temOS    = osHoje.length > 0;

                return (
                  <button
                    key={k}
                    onClick={() => setDiaSel(ehSel ? null : dia)}
                    className={`relative flex flex-col items-center py-1.5 rounded-xl transition-colors
                      ${ehSel    ? 'bg-emerald-600'
                      : ehHoje   ? 'bg-gray-800 ring-1 ring-emerald-500/50'
                      : temOS    ? 'bg-gray-800/60 active:bg-gray-800'
                      :            'active:bg-gray-800/40'}`}
                  >
                    <span className={`text-xs font-bold ${
                      ehSel ? 'text-white' : ehHoje ? 'text-emerald-400' : 'text-gray-300'
                    }`}>
                      {dia.getDate()}
                    </span>

                    {/* Pontos das OS (até 3) */}
                    {temOS && (
                      <div className="flex gap-0.5 mt-0.5">
                        {osHoje.slice(0, 3).map((os, idx) => (
                          <div
                            key={idx}
                            className={`w-1.5 h-1.5 rounded-full ${PRIORIDADE_DOT[os.priority ?? 'low'] ?? 'bg-gray-500'}`}
                          />
                        ))}
                        {osHoje.length > 3 && (
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* OS do dia selecionado */}
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

              {osDiaSelecionado.map(os => <OSCard key={os.id} os={os} />)}

              {!diaSel && comData.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Nenhuma O.S. agendada</p>
                  <p className="text-xs mt-1">Suas ordens com datas aparecerão no calendário</p>
                </div>
              )}

              {!diaSel && comData.length > 0 && (
                <p className="text-center text-xs text-gray-600 py-4">
                  Toque em um dia para ver as O.S. agendadas
                </p>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ ABA: SEM DATA ══════════════ */}
        {aba === 'sem_data' && (
          <div className="px-4 py-4 space-y-3">
            {/* Botão criar nova O.S. — apenas para quem tem permissão */}
            {canCreateOS && (
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-emerald-500/40 bg-emerald-500/5 text-emerald-400 text-sm font-semibold active:bg-emerald-500/10"
              >
                <Plus size={15} /> Nova O.S.
              </button>
            )}

            {/* OS atribuídas sem data */}
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
                {semData.map(os => <OSCard key={os.id} os={os} />)}
              </>
            )}

            {/* Pool de OS sem responsável */}
            {semResponsavel.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-800 mt-2">
                  <ClipboardList size={13} className="text-blue-400" />
                  <span className="text-xs font-bold text-blue-400">
                    {semResponsavel.length} O.S. disponíveis para execução
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 leading-snug">
                  Sem responsável — qualquer técnico pode pegar e iniciar.
                </p>
                {semResponsavel.map(os => <OSCard key={os.id} os={os} />)}
              </>
            )}

            {semData.length === 0 && semResponsavel.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-600">
                <Inbox size={40} className="mb-3 opacity-30" />
                <p className="text-sm font-medium">Nenhuma O.S. pendente</p>
                <p className="text-xs mt-1 text-gray-700">Todas as ordens têm data definida ou estão em execução</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  );
}

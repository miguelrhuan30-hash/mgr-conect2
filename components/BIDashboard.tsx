/**
 * components/BIDashboard.tsx — Sprint 34
 * Dashboard de Inteligência e KPIs para gestores.
 * Calcula SLA via statusHistory, eficiência via tempoEstimado vs real,
 * volume por status, recall rate, e Kanban de melhorias conectado ao Gemini.
 */
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, getDocs, updateDoc, doc, addDoc, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Task, WorkflowStatus as WS, WORKFLOW_ORDER, WORKFLOW_LABELS, CollectionName, OSKpiEntry, RaciFlowEntry, RaciFlowConfig } from '../types';
import { BarChart3, Loader2, TrendingUp, Clock, CheckCircle2, AlertTriangle, Zap, RefreshCcw, Lightbulb, ChevronRight, Wrench, Tag, Users, Shield, ChevronDown } from 'lucide-react';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ──────────────────────────────────────────────────────────────────
const msToHours = (ms: number) => Math.round(ms / 3600000 * 10) / 10;
const formatBRL = (v: number) => `R$ ${v.toFixed(2)}`;

// ── Widget Card ───────────────────────────────────────────────────────────────
const Widget: React.FC<{ title: string; icon: React.ElementType; color: string; children: React.ReactNode }> = ({ title, icon: Icon, color, children }) => (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className={`flex items-center gap-2 mb-4 text-${color}-600`}>
            <Icon className="w-5 h-5" />
            <h2 className="font-bold text-gray-900">{title}</h2>
        </div>
        {children}
    </div>
);

// ── SLA Widget ────────────────────────────────────────────────────────────────
const SLAWidget: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    type PhaseSLA = { status: WS; avgHours: number; count: number };
    const slaMap: Record<string, number[]> = {};
    for (const task of tasks) {
        const hist = task.statusHistory;
        if (!hist || hist.length < 2) continue;
        for (let i = 1; i < hist.length; i++) {
            const prev = hist[i - 1];
            const curr = hist[i];
            if (!prev?.changedAt || !curr?.changedAt) continue;
            const prevTs = prev.changedAt instanceof Timestamp ? prev.changedAt.toMillis() : (prev.changedAt as any).seconds * 1000;
            const currTs = curr.changedAt instanceof Timestamp ? curr.changedAt.toMillis() : (curr.changedAt as any).seconds * 1000;
            const hours = msToHours(currTs - prevTs);
            const key = curr.status;
            if (!slaMap[key]) slaMap[key] = [];
            slaMap[key].push(hours);
        }
    }
    const phases: PhaseSLA[] = WORKFLOW_ORDER.map(s => ({
        status: s,
        avgHours: slaMap[s] ? slaMap[s].reduce((a,b) => a+b, 0) / slaMap[s].length : 0,
        count: slaMap[s]?.length || 0,
    }));
    const maxHours = Math.max(...phases.map(p => p.avgHours), 1);
    const bottleneck = phases.reduce((a, b) => a.avgHours > b.avgHours ? a : b);

    return (
        <Widget title="SLA por Fase (Tempo Médio)" icon={Clock} color="blue">
            <div className="space-y-2">
                {phases.map(phase => (
                    <div key={phase.status} className="flex items-center gap-3">
                        <p className="text-[10px] text-gray-500 w-36 truncate flex-shrink-0">{WORKFLOW_LABELS[phase.status]}</p>
                        <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${phase.status === bottleneck.status && phase.avgHours > 0 ? 'bg-red-500' : 'bg-brand-500'}`}
                                style={{ width: `${(phase.avgHours / maxHours) * 100}%` }} />
                        </div>
                        <p className={`text-[11px] font-bold w-12 text-right ${phase.status === bottleneck.status && phase.avgHours > 0 ? 'text-red-500' : 'text-gray-600'}`}>
                            {phase.avgHours > 0 ? `${phase.avgHours}h` : '—'}
                        </p>
                    </div>
                ))}
            </div>
            {bottleneck.avgHours > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700">
                    🔴 Gargalo: <strong>{WORKFLOW_LABELS[bottleneck.status]}</strong> ({bottleneck.avgHours}h em média)
                </div>
            )}
        </Widget>
    );
};

// ── Efficiency Widget ─────────────────────────────────────────────────────────
const EfficiencyWidget: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    type TechData = { name: string; total: number; count: number };
    const techMap: Record<string, TechData> = {};
    for (const task of tasks) {
        if (!task.scheduling?.tempoEstimado || !task.execution?.checkIn || !task.execution?.checkOut) continue;
        const checkIn  = task.execution.checkIn  instanceof Timestamp ? task.execution.checkIn.toMillis()  : (task.execution.checkIn as any).seconds * 1000;
        const checkOut = task.execution.checkOut instanceof Timestamp ? task.execution.checkOut.toMillis() : (task.execution.checkOut as any).seconds * 1000;
        const realMin  = (checkOut - checkIn) / 60000;
        const eff = (task.scheduling.tempoEstimado / realMin) * 100;
        const name = task.assigneeName || 'Desconhecido';
        if (!techMap[name]) techMap[name] = { name, total: 0, count: 0 };
        techMap[name].total += eff;
        techMap[name].count++;
    }
    const ranked = Object.values(techMap)
        .map(t => ({ ...t, avg: Math.round(t.total / t.count) }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 5);
    return (
        <Widget title="Eficiência de Execução" icon={Zap} color="amber">
            {ranked.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">Dados insuficientes. Finalize O.S. com tempos registados.</p>
            ) : (
                <div className="space-y-3">
                    {ranked.map((t, i) => (
                        <div key={t.name} className="flex items-center gap-3">
                            <span className={`text-[10px] font-extrabold w-5 text-center ${i===0?'text-amber-500':i===1?'text-gray-400':i===2?'text-orange-400':'text-gray-300'}`}>
                                #{i+1}
                            </span>
                            <p className="text-xs text-gray-700 flex-1 truncate">{t.name}</p>
                            <div className="w-24 bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(t.avg, 100)}%` }} />
                            </div>
                            <p className="text-xs font-bold text-amber-700 w-10 text-right">{t.avg}%</p>
                        </div>
                    ))}
                </div>
            )}
        </Widget>
    );
};

// ── Volume Widget ─────────────────────────────────────────────────────────────
const VolumeWidget: React.FC<{ tasks: Task[] }> = ({ tasks }) => {
    const active   = tasks.filter(t => !['completed','cancelled'].includes(t.status)).length;
    const exec     = tasks.filter(t => t.workflowStatus === WS.EM_EXECUCAO).length;
    const waitPay  = tasks.filter(t => t.workflowStatus === WS.AGUARDANDO_PAGAMENTO).length;
    const now      = new Date();
    const thisMonth = tasks.filter(t => {
        const d = t.createdAt instanceof Timestamp ? t.createdAt.toDate() : null;
        return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status === 'completed';
    }).length;
    // Recall rate: same assetId, < 30 days
    const byAsset: Record<string, Date[]> = {};
    for (const t of tasks) {
        if (!t.assetId || !t.createdAt) continue;
        const d = (t.createdAt as Timestamp).toDate();
        if (!byAsset[t.assetId]) byAsset[t.assetId] = [];
        byAsset[t.assetId].push(d);
    }
    let recallCount = 0;
    for (const dates of Object.values(byAsset)) {
        const sorted = dates.sort((a,b) => a.getTime()-b.getTime());
        for (let i = 1; i < sorted.length; i++) {
            if ((sorted[i].getTime() - sorted[i-1].getTime()) / 86400000 < 30) recallCount++;
        }
    }
    const kpis = [
        { label: 'Total Ativas', value: active,    color: 'bg-blue-50 border-blue-200 text-blue-700' },
        { label: 'Em Execução',  value: exec,      color: 'bg-amber-50 border-amber-200 text-amber-700' },
        { label: 'Aguard. Pagto.', value: waitPay, color: 'bg-orange-50 border-orange-200 text-orange-700' },
        { label: 'Concluídas/mês', value: thisMonth, color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
    ];
    return (
        <Widget title="Volume e Status" icon={BarChart3} color="brand">
            <div className="grid grid-cols-2 gap-3">
                {kpis.map(k => (
                    <div key={k.label} className={`border rounded-xl p-4 text-center ${k.color}`}>
                        <p className="text-2xl font-extrabold">{k.value}</p>
                        <p className="text-[10px] font-bold opacity-80">{k.label}</p>
                    </div>
                ))}
            </div>
            {recallCount > 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700 flex items-center gap-2">
                    <RefreshCcw className="w-3.5 h-3.5" />
                    Recall Rate: <strong>{recallCount} O.S.</strong> reabertas em menos de 30 dias
                </div>
            )}
        </Widget>
    );
};

// ── Improvement Kanban ────────────────────────────────────────────────────────
type ImprovCard = { id: string; titulo: string; bpmn_sugestao?: string; manual_sugestao?: string; urgencia?: string; status: string; createdAt: any };

const ImprovKanban: React.FC = () => {
    const [cards, setCards] = useState<ImprovCard[]>([]);
    const [loading, setLoading] = useState(true);
    const cols = [
        { id: 'ideacao',     label: 'Ideação',       color: 'bg-blue-50 border-blue-200' },
        { id: 'em_execucao', label: 'Em Execução',   color: 'bg-amber-50 border-amber-200' },
        { id: 'concluida',   label: 'Concluída',     color: 'bg-emerald-50 border-emerald-200' },
    ];
    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.PROCESSOS), orderBy('createdAt','desc')),
        snap => { setCards(snap.docs.map(d => ({ id: d.id, ...d.data() } as ImprovCard))); setLoading(false); },
        () => setLoading(false)
    ), []);
    const moveCard = async (id: string, status: string) => {
        await updateDoc(doc(db, CollectionName.PROCESSOS, id), { status });
    };
    if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-600 w-6 h-6" /></div>;
    return (
        <Widget title="Kanban de Melhorias (Gemini IA)" icon={Lightbulb} color="purple">
            <div className="grid grid-cols-3 gap-4">
                {cols.map(col => (
                    <div key={col.id} className={`rounded-xl border-2 p-3 min-h-32 ${col.color}`}>
                        <p className="text-[10px] font-extrabold text-gray-500 uppercase mb-3">{col.label}</p>
                        {cards.filter(c => c.status === col.id).map(card => (
                            <div key={card.id} className="bg-white rounded-xl border border-gray-200 p-3 mb-2 shadow-sm">
                                <p className="text-xs font-bold text-gray-800 mb-1">{card.titulo}</p>
                                {card.manual_sugestao && <p className="text-[10px] text-gray-500 line-clamp-2">{card.manual_sugestao}</p>}
                                <div className="flex gap-1 mt-2">
                                    {cols.filter(c => c.id !== col.id).map(next => (
                                        <button key={next.id} onClick={() => moveCard(card.id, next.id)}
                                            className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 flex items-center gap-0.5">
                                            <ChevronRight className="w-2.5 h-2.5" /> {next.label.split(' ')[0]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {cards.filter(c => c.status === col.id).length === 0 &&
                            <p className="text-[10px] text-gray-300 text-center py-4">Vazio</p>}
                    </div>
                ))}
            </div>
        </Widget>
    );
};

// ── Sprint 43 — KPIs de O.S. ──────────────────────────────────────────────
const OSKpiSection: React.FC = () => {
    const [kpis, setKpis] = useState<OSKpiEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getDocs(query(collection(db, CollectionName.TASK_KPIS), orderBy('data', 'desc')))
            .then(snap => {
                setKpis(snap.docs.map(d => ({ ...d.data() } as OSKpiEntry)));
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-600 w-6 h-6" /></div>;
    if (kpis.length === 0) return (
        <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4 text-brand-600">
                    <Tag className="w-5 h-5" />
                    <h2 className="font-bold text-gray-900">KPIs de Tarefas O.S.</h2>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Wrench className="w-10 h-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-400">Nenhum KPI registrado ainda</p>
                    <p className="text-xs text-gray-300 mt-1">Complete tarefas de O.S. para gerar métricas automaticamente.</p>
                </div>
            </div>
        </div>
    );

    // Tempo médio por tarefa
    const avgMin = Math.round(kpis.reduce((s, k) => s + (k.tempoDuracaoMinutos || 0), 0) / kpis.length);

    // Ferramentas mais usadas (from tasks)
    const ferrMap: Record<string, number> = {};
    // (kpis don't store tools; we use tasks)

    // Volume por tipo
    const tipoMap: Record<string, number> = {};
    for (const k of kpis) {
        const t = k.tipoServico || 'Não categorizado';
        tipoMap[t] = (tipoMap[t] || 0) + 1;
    }
    const tipoRanked = Object.entries(tipoMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxTipo = tipoRanked[0]?.[1] || 1;

    // Taxa conclusão (tarefas concluídas vs total)
    const concluidas = kpis.filter(k => k.tempoDuracaoMinutos > 0).length;
    const taxa = kpis.length > 0 ? Math.round((concluidas / kpis.length) * 100) : 0;

    return (
        <>
            <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-6 text-brand-600">
                        <Tag className="w-5 h-5" />
                        <h2 className="font-bold text-gray-900">KPIs de Tarefas O.S. (Sprint 43)</h2>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                            <p className="text-3xl font-extrabold text-blue-700">{avgMin}<span className="text-sm font-bold">min</span></p>
                            <p className="text-[10px] font-bold text-blue-500 mt-1">Tempo médio por tarefa</p>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                            <p className="text-3xl font-extrabold text-emerald-700">{taxa}<span className="text-sm font-bold">%</span></p>
                            <p className="text-[10px] font-bold text-emerald-500 mt-1">Taxa de conclusão</p>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                            <p className="text-3xl font-extrabold text-purple-700">{kpis.length}</p>
                            <p className="text-[10px] font-bold text-purple-500 mt-1">Tarefas registadas</p>
                        </div>
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                            <p className="text-3xl font-extrabold text-orange-700">{tipoRanked.length}</p>
                            <p className="text-[10px] font-bold text-orange-500 mt-1">Tipos de serviço</p>
                        </div>
                    </div>
                    {tipoRanked.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Volume por Tipo de Serviço</p>
                            <div className="space-y-2">
                                {tipoRanked.map(([tipo, count]) => (
                                    <div key={tipo} className="flex items-center gap-3">
                                        <p className="text-xs text-gray-700 flex-1 truncate">{tipo}</p>
                                        <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                                            <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(count / maxTipo) * 100}%` }} />
                                        </div>
                                        <p className="text-xs font-bold text-gray-600 w-6 text-right">{count}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

// ── Sprint RACI — Matriz de Responsabilidades do Flow de Atendimento ─────────
const RACI_ROLE_COLORS: Record<string, string> = {
  responsible: 'bg-brand-100 text-brand-700 border-brand-200',
  accountable:  'bg-amber-100 text-amber-700 border-amber-200',
  consulted:    'bg-purple-100 text-purple-700 border-purple-200',
  informed:     'bg-gray-100 text-gray-600 border-gray-200',
};
const RACI_ROLE_LABELS: Record<string, string> = {
  responsible: 'R — Responsável',
  accountable: 'A — Aprovador',
  consulted:   'C — Consultado',
  informed:    'I — Informado',
};

const RaciMatrizWidget: React.FC = () => {
  const [config, setConfig] = useState<Record<string, RaciFlowEntry>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, CollectionName.RACI_CONFIG, 'flow_phases'), snap => {
      if (snap.exists()) setConfig((snap.data() as RaciFlowConfig).fases || {});
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const fases = Object.values(config).sort((a, b) => {
    const ORDER = ['leads','prancheta','cotacao','proposta','contrato','gantt','os','execucao','relatorio','faturamento','historico','nao_aprovados'];
    return ORDER.indexOf(a.faseId) - ORDER.indexOf(b.faseId);
  });

  return (
    <div className="lg:col-span-2">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-brand-600">
            <Shield className="w-5 h-5" />
            <h2 className="font-bold text-gray-900">Matriz RACI — Flow de Atendimento</h2>
          </div>
          <a href="#/app/flow-atendimento"
            className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1">
            Configurar no Flow <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-brand-600 w-6 h-6" /></div>
        ) : fases.length === 0 ? (
          <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-bold text-gray-400">Nenhuma fase configurada</p>
            <p className="text-xs text-gray-300 mt-1">Acesse o Flow de Atendimento e defina o setor responsável de cada fase.</p>
            <a href="#/app/flow-atendimento"
              className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
              Ir para o Flow de Atendimento <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-2 px-3 py-1.5 text-[9px] font-extrabold text-gray-400 uppercase tracking-wide">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Fase</div>
              <div className="col-span-3">Setor Responsável (R)</div>
              <div className="col-span-2">SLA</div>
              <div className="col-span-2">Atividades</div>
              <div className="col-span-1"></div>
            </div>

            {fases.map((entry, idx) => {
              const isExp = expanded === entry.faseId;
              const actCount = entry.atividades?.length || 0;
              const hasDetails = !!entry.objetivo || actCount > 0 || (entry.criteriosSaida && entry.criteriosSaida.length > 0);

              return (
                <div key={entry.faseId} className={`rounded-xl border transition-all ${isExp ? 'border-brand-200 bg-brand-50/30' : 'border-gray-100 bg-gray-50/50 hover:border-gray-200'}`}>
                  <div className="grid grid-cols-12 gap-2 items-center px-3 py-3">
                    <div className="col-span-1">
                      <span className="text-[9px] font-extrabold text-gray-400">{idx + 1}</span>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs font-bold text-gray-900">{entry.faseLabel}</p>
                    </div>
                    <div className="col-span-3">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${RACI_ROLE_COLORS[entry.role] || RACI_ROLE_COLORS.responsible} flex items-center gap-1 w-fit`}>
                        <Users className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate max-w-[100px]">{entry.setorNome}</span>
                      </span>
                    </div>
                    <div className="col-span-2">
                      {entry.slaHoras ? (
                        <span className="text-[9px] font-bold text-gray-600 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5 text-amber-500" />{entry.slaHoras}h
                        </span>
                      ) : <span className="text-[9px] text-gray-300">—</span>}
                    </div>
                    <div className="col-span-2">
                      {actCount > 0 ? (
                        <span className="text-[9px] font-bold text-gray-600">{actCount} atividade{actCount !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-[9px] text-gray-300">—</span>
                      )}
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {hasDetails && (
                        <button onClick={() => setExpanded(isExp ? null : entry.faseId)}
                          className="p-1 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors">
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExp ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Detalhes expandidos (Enterprise Architecture) */}
                  {isExp && (
                    <div className="px-4 pb-4 space-y-3 border-t border-brand-100 pt-3">
                      {entry.objetivo && (
                        <div>
                          <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wide mb-1">Objetivo</p>
                          <p className="text-xs text-gray-700">{entry.objetivo}</p>
                        </div>
                      )}
                      {entry.criteriosSaida && entry.criteriosSaida.length > 0 && (
                        <div>
                          <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wide mb-1">Critérios de Saída</p>
                          <ul className="space-y-0.5">
                            {entry.criteriosSaida.map((c, i) => (
                              <li key={i} className="text-xs text-gray-600 flex items-start gap-1">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0 mt-0.5" />{c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {entry.atividades && entry.atividades.length > 0 && (
                        <div>
                          <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wide mb-1">Atividades de Execução</p>
                          <div className="space-y-1">
                            {entry.atividades.map(at => (
                              <div key={at.id} className="flex items-start gap-1.5 text-xs text-gray-700">
                                <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${at.obrigatoria ? 'bg-red-400' : 'bg-gray-300'}`} />
                                {at.titulo}
                                {at.obrigatoria && <span className="text-[8px] font-bold text-red-500 ml-auto flex-shrink-0">obrigatória</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {entry.indicadores && entry.indicadores.length > 0 && (
                        <div>
                          <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wide mb-1">KPIs</p>
                          <div className="flex flex-wrap gap-1">
                            {entry.indicadores.map((ind, i) => (
                              <span key={i} className="text-[8px] font-bold px-1.5 py-0.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full">{ind}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="text-[9px] text-gray-400 text-center pt-2">
              🏛️ Configure características completas de cada processo no módulo <strong>Inteligência MGR → Enterprise Architect</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main BIDashboard ──────────────────────────────────────────────────────────
const BIDashboard: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.TASKS), orderBy('createdAt','desc')),
        snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))); setLoading(false); },
        () => setLoading(false)
    ), []);

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-brand-600" />
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">BI & Inteligência MGR</h1>
                    <p className="text-gray-500 text-sm">Dashboard estratégico para gestores.</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-600 w-10 h-10" /></div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <RaciMatrizWidget />
                    <SLAWidget tasks={tasks} />
                    <EfficiencyWidget tasks={tasks} />
                    <VolumeWidget tasks={tasks} />
                    <div className="lg:col-span-2">
                        <ImprovKanban />
                    </div>
                    <OSKpiSection />
                </div>
            )}
        </div>
    );
};

export default BIDashboard;

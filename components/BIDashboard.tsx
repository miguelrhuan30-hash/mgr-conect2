/**
 * components/BIDashboard.tsx — Sprint 34
 * Dashboard de Inteligência e KPIs para gestores.
 * Calcula SLA via statusHistory, eficiência via tempoEstimado vs real,
 * volume por status, recall rate, e Kanban de melhorias conectado ao Gemini.
 */
import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, getDocs, updateDoc, doc, addDoc, serverTimestamp, Timestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Task, WorkflowStatus as WS, WORKFLOW_ORDER, WORKFLOW_LABELS, CollectionName } from '../types';
import { BarChart3, Loader2, TrendingUp, Clock, CheckCircle2, AlertTriangle, Zap, RefreshCcw, Lightbulb, ChevronRight } from 'lucide-react';
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
                    <SLAWidget tasks={tasks} />
                    <EfficiencyWidget tasks={tasks} />
                    <VolumeWidget tasks={tasks} />
                    <div className="lg:col-span-2">
                        <ImprovKanban />
                    </div>
                </div>
            )}
        </div>
    );
};

export default BIDashboard;

/**
 * components/OpsBI.tsx
 * Sprint 34 — Dashboard de BI Operacional: KPIs, SLA e Gemini pós-OS.
 *
 * Widgets:
 *  1. SLA Médio por fase (tempo médio entre cada transição de status)
 *  2. Eficiência: Tempo Previsto vs Real (scheduling.tempoEstimado vs actual)
 *  3. Taxa de Reincidência por Ativo (recall — mesmo ativo, 2+ OS no período)
 *  4. Distribuição por WorkflowStatus (volume de O.S. em cada fase)
 *
 * Gemini pós-OS:
 *  • Modal que aparece ao finalizar uma O.S. com adversidades registadas
 *  • Envia adversidades para /api/intel/analisar e exibe sugestão de SOP/BPMN
 *
 * Quadro Kanban de Melhorias (Ideação / Em Execução / Concluídas)
 */
import React, { useState, useEffect } from 'react';
import {
    BarChart2, Clock, Repeat, Target, Loader2,
    AlertTriangle, CheckCircle2, Brain, TrendingUp,
    TrendingDown, Minus, Plus, ArrowRight
} from 'lucide-react';
import {
    collection, query, onSnapshot, orderBy, addDoc,
    serverTimestamp, doc, updateDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { Task, WorkflowStatus as WS, WORKFLOW_LABELS, CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format, differenceInMinutes, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ImprovementTask {
    id: string;
    titulo: string;
    descricao?: string;
    fase: 'ideacao' | 'execucao' | 'concluida';
    prioridade: 'alta' | 'media' | 'baixa';
    createdAt: Timestamp;
    createdBy: string;
}

// ── KPI widget ────────────────────────────────────────────────────────────────
interface KpiWidgetProps {
    label: string;
    value: string;
    sub?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    color: string;
}
const KpiWidget: React.FC<KpiWidgetProps> = ({ label, value, sub, icon, trend, color }) => (
    <div className={`rounded-xl border p-5 bg-white flex flex-col gap-3 ${color}`}>
        <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</span>
            <div className="w-9 h-9 rounded-xl bg-current/10 flex items-center justify-center">{icon}</div>
        </div>
        <div>
            <p className="text-2xl font-extrabold text-gray-900 leading-none">{value}</p>
            {sub && <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                {trend === 'up' && <TrendingUp size={11} className="text-emerald-500" />}
                {trend === 'down' && <TrendingDown size={11} className="text-red-500" />}
                {trend === 'neutral' && <Minus size={11} className="text-gray-400" />}
                {sub}
            </p>}
        </div>
    </div>
);

// ── Improvement Kanban ────────────────────────────────────────────────────────
const IMPROVEMENT_PHASES = [
    { key: 'ideacao',  label: 'Ideação',       color: 'bg-blue-50 border-blue-200' },
    { key: 'execucao', label: 'Em Execução',    color: 'bg-amber-50 border-amber-200' },
    { key: 'concluida',label: 'Concluídas',     color: 'bg-emerald-50 border-emerald-200' },
] as const;

const ImprovementKanban: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const [items, setItems] = useState<ImprovementTask[]>([]);
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ titulo: '', descricao: '', prioridade: 'media' as 'alta' | 'media' | 'baixa' });
    const [saving, setSaving] = useState(false);
    const [moving, setMoving] = useState<string | null>(null);

    useEffect(() => {
        const q = query(collection(db, 'hub_improvements'), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as ImprovementTask))));
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !form.titulo.trim()) return;
        setSaving(true);
        try {
            await addDoc(collection(db, 'hub_improvements'), {
                titulo: form.titulo,
                descricao: form.descricao || undefined,
                fase: 'ideacao',
                prioridade: form.prioridade,
                createdAt: serverTimestamp(),
                createdBy: currentUser.uid,
            });
            setForm({ titulo: '', descricao: '', prioridade: 'media' });
            setAdding(false);
        } finally { setSaving(false); }
    };

    const movePhase = async (item: ImprovementTask, direction: 'next' | 'prev') => {
        const phases = ['ideacao', 'execucao', 'concluida'] as const;
        const idx = phases.indexOf(item.fase);
        const next = direction === 'next' ? phases[idx + 1] : phases[idx - 1];
        if (!next) return;
        setMoving(item.id);
        try {
            await updateDoc(doc(db, 'hub_improvements', item.id), { fase: next });
        } finally { setMoving(null); }
    };

    const PRIO_COLOR = { alta: 'text-red-600 bg-red-50', media: 'text-amber-600 bg-amber-50', baixa: 'text-gray-500 bg-gray-50' };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <BarChart2 size={16} className="text-brand-600" /> Quadro de Melhorias
                </h3>
                <button onClick={() => setAdding(!adding)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700">
                    <Plus size={12} /> Nova Melhoria
                </button>
            </div>

            {adding && (
                <form onSubmit={handleAdd} className="border-2 border-dashed border-brand-200 rounded-xl p-4 bg-brand-50/20 space-y-3">
                    <input required value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                        placeholder="Título da melhoria..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                    <textarea value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                        placeholder="Descrição (opcional)" rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none" />
                    <div className="flex items-center gap-3">
                        <select value={form.prioridade} onChange={e => setForm(p => ({ ...p, prioridade: e.target.value as any }))}
                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                            <option value="alta">Alta prioridade</option>
                            <option value="media">Média prioridade</option>
                            <option value="baixa">Baixa prioridade</option>
                        </select>
                        <button type="button" onClick={() => setAdding(false)} className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">Cancelar</button>
                        <button type="submit" disabled={saving || !form.titulo.trim()}
                            className="text-xs px-4 py-1.5 rounded-lg bg-brand-600 text-white font-bold disabled:opacity-50">
                            {saving ? 'Salvando...' : 'Adicionar'}
                        </button>
                    </div>
                </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {IMPROVEMENT_PHASES.map(phase => {
                    const phaseItems = items.filter(i => i.fase === phase.key);
                    return (
                        <div key={phase.key} className={`rounded-xl border p-4 ${phase.color}`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-extrabold">{phase.label}</p>
                                <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded-full">{phaseItems.length}</span>
                            </div>
                            <div className="space-y-2">
                                {phaseItems.length === 0 && <p className="text-[10px] text-gray-400 text-center py-3">Vazio</p>}
                                {phaseItems.map(item => (
                                    <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
                                        <div className="flex items-start justify-between gap-1 mb-1">
                                            <p className="text-xs font-bold text-gray-900 flex-1">{item.titulo}</p>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${PRIO_COLOR[item.prioridade]}`}>{item.prioridade}</span>
                                        </div>
                                        {item.descricao && <p className="text-[10px] text-gray-500 mb-2">{item.descricao}</p>}
                                        <div className="flex items-center gap-1.5">
                                            {phase.key !== 'ideacao' && (
                                                <button onClick={() => movePhase(item, 'prev')} disabled={moving === item.id}
                                                    className="text-[9px] px-1.5 py-0.5 rounded border border-gray-200 text-gray-500">←</button>
                                            )}
                                            {phase.key !== 'concluida' && (
                                                <button onClick={() => movePhase(item, 'next')} disabled={moving === item.id}
                                                    className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-brand-50 border border-brand-200 text-brand-700">
                                                    {moving === item.id ? '...' : '→'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Main OpsBI ────────────────────────────────────────────────────────────────
const OpsBI: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [geminiSuggestion, setGeminiSuggestion] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [selectedAdversidade, setSelectedAdversidade] = useState('');

    useEffect(() => {
        const q = query(collection(db, CollectionName.TASKS), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
            setLoading(false);
        });
    }, []);

    // ── KPI calculations ─────────────────────────────────────────────
    const completedTasks = tasks.filter(t => t.workflowStatus === WS.CONCLUIDO || t.status === 'completed');
    const pendingTasks   = tasks.filter(t => t.status === 'pending');
    const inProgressTasks = tasks.filter(t => t.status === 'in-progress');

    // SLA Médio: tempo médio de createdAt a execution.checkOut (em horas)
    const slaHours = completedTasks
        .filter(t => t.execution?.checkOut && t.createdAt)
        .map(t => differenceInMinutes(
            (t.execution!.checkOut as Timestamp).toDate(),
            (t.createdAt as Timestamp).toDate()
        ) / 60);
    const avgSLA = slaHours.length > 0
        ? (slaHours.reduce((a, b) => a + b, 0) / slaHours.length).toFixed(1)
        : '—';

    // Eficiência: previsto vs real
    const effTasks = completedTasks.filter(
        t => t.scheduling?.tempoEstimado && t.execution?.actualStartTime && t.execution?.actualEndTime
    );
    const avgEfficiency = effTasks.length > 0 ? (() => {
        const ratios = effTasks.map(t => {
            const real = differenceInMinutes(
                (t.execution!.actualEndTime as Timestamp).toDate(),
                (t.execution!.actualStartTime as Timestamp).toDate()
            );
            return t.scheduling!.tempoEstimado! / Math.max(real, 1);
        });
        return (ratios.reduce((a, b) => a + b, 0) / ratios.length * 100).toFixed(0);
    })() : '—';

    // Reincidência: ativos com 2+ OS no último mês
    const assetOSCount: Record<string, number> = {};
    tasks.forEach(t => { if (t.assetId) assetOSCount[t.assetId] = (assetOSCount[t.assetId] || 0) + 1; });
    const recallCount = Object.values(assetOSCount).filter(c => c >= 2).length;

    // Status distribution
    const statusDist = WORKFLOW_ORDER_DISPLAY.map(status => ({
        label: WORKFLOW_LABELS[status],
        count: tasks.filter(t => (t.workflowStatus || WS.TRIAGEM) === status).length,
        status,
    }));

    // Adversidades for Gemini
    const tasksWithAdversidades = completedTasks.filter(t => t.execution?.adversidades);

    const analyzeAdversidade = async (text: string) => {
        if (!text) return;
        setAnalyzing(true);
        setGeminiSuggestion('');
        try {
            const res = await fetch('/api/intel/analisar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `ADVERSIDADE REGISTADA EM O.S.: ${text}\n\nAnalise se há necessidade de atualização no Manual de Instrução ou no processo BPMN.`,
                    userId: 'ops-bi',
                    userName: 'OpsBI'
                }),
            });
            const data = await res.json();
            setGeminiSuggestion(data.analysis?.acao_sugerida || data.analysis?.resumo || 'Sem sugestão.');
        } catch {
            setGeminiSuggestion('Erro ao conectar com o motor Gemini.');
        } finally { setAnalyzing(false); }
    };

    if (loading) return (
        <div className="flex items-center justify-center py-20 text-brand-600">
            <Loader2 size={24} className="animate-spin" />
        </div>
    );

    return (
        <div className="space-y-8 pb-12">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                        <BarChart2 size={22} />
                    </div>
                    Business Intelligence Operacional
                </h1>
                <p className="text-gray-500 mt-1 text-sm">Métricas em tempo real de todas as O.S. da MGR.</p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiWidget
                    label="SLA Médio"
                    value={avgSLA === '—' ? '—' : `${avgSLA}h`}
                    sub={`${completedTasks.length} O.S. concluídas`}
                    icon={<Clock size={18} className="text-blue-600" />}
                    trend="neutral"
                    color="border-blue-100"
                />
                <KpiWidget
                    label="Eficiência"
                    value={avgEfficiency === '—' ? '—' : `${avgEfficiency}%`}
                    sub="Prev. vs Real"
                    icon={<Target size={18} className="text-emerald-600" />}
                    trend={Number(avgEfficiency) >= 90 ? 'up' : Number(avgEfficiency) >= 70 ? 'neutral' : 'down'}
                    color="border-emerald-100"
                />
                <KpiWidget
                    label="Reincidência"
                    value={String(recallCount)}
                    sub="ativos com 2+ O.S."
                    icon={<Repeat size={18} className="text-amber-600" />}
                    trend={recallCount > 0 ? 'down' : 'up'}
                    color="border-amber-100"
                />
                <KpiWidget
                    label="Em Aberto"
                    value={String(pendingTasks.length + inProgressTasks.length)}
                    sub={`${inProgressTasks.length} em execução`}
                    icon={<AlertTriangle size={18} className="text-red-600" />}
                    trend={pendingTasks.length > 10 ? 'down' : 'neutral'}
                    color="border-red-100"
                />
            </div>

            {/* Status distribution bar */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Distribuição por Fase</h3>
                <div className="space-y-2">
                    {statusDist.filter(d => d.count > 0).map(({ label, count }) => {
                        const pct = tasks.length > 0 ? (count / tasks.length * 100).toFixed(0) : 0;
                        return (
                            <div key={label} className="flex items-center gap-3">
                                <span className="text-[10px] font-bold text-gray-600 w-36 truncate">{label}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div className="bg-brand-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                                </div>
                                <span className="text-[10px] text-gray-500 w-8 text-right">{count}</span>
                            </div>
                        );
                    })}
                    {tasks.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma O.S. registada.</p>}
                </div>
            </div>

            {/* Gemini adversidades analysis */}
            {tasksWithAdversidades.length > 0 && (
                <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl border border-brand-100 p-5">
                    <h3 className="text-xs font-bold text-brand-700 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <Brain size={14} /> Gemini — Análise de Adversidades
                    </h3>
                    <p className="text-[11px] text-gray-500 mb-4">Selecione uma adversidade registada e peça ao Gemini uma sugestão de melhoria de processo.</p>

                    <select
                        value={selectedAdversidade}
                        onChange={e => setSelectedAdversidade(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-brand-200 rounded-lg mb-3 bg-white"
                    >
                        <option value="">Selecionar O.S. com adversidade...</option>
                        {tasksWithAdversidades.map(t => (
                            <option key={t.id} value={t.execution!.adversidades!}>
                                {t.code || t.id.slice(0, 8)} — {t.title.slice(0, 50)}
                            </option>
                        ))}
                    </select>

                    <button
                        onClick={() => analyzeAdversidade(selectedAdversidade)}
                        disabled={!selectedAdversidade || analyzing}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-bold disabled:opacity-50 hover:bg-brand-700 mb-4"
                    >
                        {analyzing ? <><Loader2 size={12} className="animate-spin" /> Analisando...</> : <><Brain size={12} /> Analisar com Gemini</>}
                    </button>

                    {geminiSuggestion && (
                        <div className="bg-white rounded-xl p-4 border border-brand-100">
                            <p className="text-[10px] font-bold text-brand-600 mb-1">✦ Sugestão de Melhoria</p>
                            <p className="text-sm text-gray-800 leading-relaxed">{geminiSuggestion}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Improvement Kanban */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
                <ImprovementKanban />
            </div>
        </div>
    );
};

// Helper — must be declared after the component uses it
const WORKFLOW_ORDER_DISPLAY = [
    WS.TRIAGEM, WS.PRE_ORCAMENTO, WS.VISITA_TECNICA, WS.ORCAMENTO_FINAL,
    WS.AGUARDANDO_APROVACAO, WS.AGENDADO, WS.EM_EXECUCAO,
    WS.AGUARDANDO_FATURAMENTO, WS.AGUARDANDO_PAGAMENTO, WS.CONCLUIDO,
];

export default OpsBI;

import React, { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp, AlertTriangle, Lightbulb, CheckCircle2,
    Loader2, Brain, Target, BarChart3, RefreshCw, Zap,
    ArrowRight, Activity
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, IntelNote } from '../types';

// ── KPI Card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ReactNode;
    color: string; // Tailwind bg class
    pulse?: boolean;
}
const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon, color, pulse }) => (
    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{label}</p>
        <div className="flex items-end justify-between">
            <div>
                <h4 className="text-3xl font-bold text-gray-900 leading-none">{value}</h4>
                {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
            </div>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                {pulse
                    ? <span className="animate-pulse">{icon}</span>
                    : icon}
            </div>
        </div>
    </div>
);

// ── Main ─────────────────────────────────────────────────────────────────────
const IntelInsights: React.FC = () => {
    const [notes, setNotes] = useState<IntelNote[]>([]);
    const [summary, setSummary] = useState<string>('');
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [notesLoading, setNotesLoading] = useState(true);

    // ── Live notes from Firestore ─────────────────────────────────────────
    useEffect(() => {
        const q = query(
            collection(db, CollectionName.NOTAS_INTEL),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        const unsub = onSnapshot(q, snap => {
            setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as IntelNote)));
            setNotesLoading(false);
        }, () => setNotesLoading(false));
        return unsub;
    }, []);

    // ── KPI calculations (client-side from Firestore data) ────────────────
    const total = notes.length;
    const criticas = notes.filter(n => n.analysis?.urgencia === 'critica' && n.status !== 'aplicada').length;
    const oportunidades = notes.filter(n => n.analysis?.sentimento === 'oportunidade').length;
    const aplicadas = notes.filter(n => n.status === 'aplicada' || n.applied).length;
    const taxaExecucao = total > 0 ? Math.round((aplicadas / total) * 100) : 0;

    // Setor em foco: área com mais notas
    const areaCounts = notes.reduce<Record<string, number>>((acc, n) => {
        const a = n.analysis?.area || 'geral';
        acc[a] = (acc[a] || 0) + 1;
        return acc;
    }, {});
    const setorFoco = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

    // Distribuição por destino
    const destinoCounts = notes.reduce<Record<string, number>>((acc, n) => {
        const d = n.analysis?.destino;
        if (d) acc[d] = (acc[d] || 0) + 1;
        return acc;
    }, {});

    // ── Gemini strategic summary ──────────────────────────────────────────
    const fetchSummary = useCallback(async () => {
        if (total === 0) return;
        setSummaryLoading(true);
        setSummaryError(null);
        try {
            const res = await fetch('/api/intel/summary');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setSummary(data.summary || '');
        } catch (err: any) {
            setSummaryError('Não foi possível gerar o resumo estratégico. Verifique a conexão com o servidor.');
        } finally {
            setSummaryLoading(false);
        }
    }, [total]);

    useEffect(() => {
        if (!notesLoading && total > 0) fetchSummary();
    }, [notesLoading]);

    // ── Empty state ───────────────────────────────────────────────────────
    if (!notesLoading && total === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-800">A MGR está a funcionar perfeitamente</h3>
                <p className="text-sm text-gray-500 max-w-xs">
                    Nenhum alerta crítico hoje. Registe a primeira observação no Feed de Insights para gerar análise estratégica.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* ── KPI Grid ─────────────────────────────────────── */}
            {notesLoading ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <KpiCard
                        label="Alertas Críticos Pendentes"
                        value={criticas}
                        sub="urgência crítica, não aplicados"
                        icon={<AlertTriangle size={20} className="text-red-600" />}
                        color="bg-red-50"
                        pulse={criticas > 0}
                    />
                    <KpiCard
                        label="Oportunidades"
                        value={oportunidades}
                        sub="sentimento positivo detectado"
                        icon={<Lightbulb size={20} className="text-emerald-600" />}
                        color="bg-emerald-50"
                    />
                    <KpiCard
                        label="Setor em Foco"
                        value={setorFoco.charAt(0).toUpperCase() + setorFoco.slice(1)}
                        sub={`${areaCounts[setorFoco] || 0} notas registadas`}
                        icon={<Target size={20} className="text-amber-600" />}
                        color="bg-amber-50"
                    />
                    <KpiCard
                        label="Taxa de Execução"
                        value={`${taxaExecucao}%`}
                        sub={`${aplicadas} de ${total} insights aplicados`}
                        icon={<CheckCircle2 size={20} className="text-brand-600" />}
                        color="bg-brand-50"
                    />
                </div>
            )}

            {/* ── Distribuição por Destino ─────────────────────── */}
            {Object.keys(destinoCounts).length > 0 && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <BarChart3 size={14} /> Distribuição por Ferramenta do Hub
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(destinoCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([dest, count]) => {
                                const pct = Math.round((count / total) * 100);
                                const colors: Record<string, string> = {
                                    eisenhower: 'bg-blue-500',
                                    ishikawa:   'bg-red-500',
                                    canvas:     'bg-indigo-500',
                                    bpmn:       'bg-purple-500',
                                    roadmap:    'bg-amber-500',
                                };
                                const labels: Record<string, string> = {
                                    eisenhower: '📋 Eisenhower',
                                    ishikawa:   '🐟 Ishikawa',
                                    canvas:     '▦ Canvas',
                                    bpmn:       '⬡ BPMN',
                                    roadmap:    '→ Roadmap',
                                };
                                return (
                                    <div key={dest}>
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-medium text-gray-700">{labels[dest] || dest}</span>
                                            <span className="text-gray-400">{count} notas ({pct}%)</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ${colors[dest] || 'bg-gray-400'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* ── Strategic Summary ────────────────────────────── */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                    <TrendingUp size={140} />
                </div>

                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                                <Brain size={20} className="text-blue-300" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Resumo Estratégico</h3>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">Baseado nas últimas {total} notas · Gemini 2.0 Flash</p>
                            </div>
                        </div>
                        <button
                            onClick={fetchSummary}
                            disabled={summaryLoading}
                            className="flex items-center gap-2 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded-lg transition-all"
                        >
                            <RefreshCw size={12} className={summaryLoading ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    </div>

                    {summaryLoading ? (
                        <div className="flex items-center gap-3 text-gray-400 py-6">
                            <Loader2 size={20} className="animate-spin text-blue-400" />
                            <span className="text-sm italic">Gemini está sintetizando os padrões operacionais...</span>
                        </div>
                    ) : summaryError ? (
                        <div className="flex items-center gap-2 text-red-400 bg-red-900/20 rounded-lg px-4 py-3 text-sm border border-red-700/30">
                            <AlertTriangle size={16} />
                            {summaryError}
                        </div>
                    ) : summary ? (
                        <div className="text-gray-200 leading-relaxed text-sm whitespace-pre-wrap">
                            {summary}
                        </div>
                    ) : total === 0 ? (
                        <p className="text-gray-500 italic text-sm">Nenhuma nota para resumir ainda.</p>
                    ) : null}

                    <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-4 text-[10px] font-medium text-gray-500 flex-wrap">
                        <span className="flex items-center gap-1.5">
                            <Activity size={12} /> Análise em tempo real
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Zap size={12} /> Gemini 2.0 Flash
                        </span>
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> {total} notas analisadas
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntelInsights;

import React, { useState, useEffect } from 'react';
import { TrendingUp, AlertTriangle, Lightbulb, CheckCircle2, Loader2, Brain } from 'lucide-react';

const IntelInsights: React.FC = () => {
    const [stats, setStats] = useState<any>(null);
    const [summary, setSummary] = useState<string>('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInsights = async () => {
            try {
                const [statsRes, summaryRes] = await Promise.all([
                    fetch('/api/intel/stats'),
                    fetch('/api/intel/summary')
                ]);
                
                const statsData = await statsRes.json();
                const summaryData = await summaryRes.json();
                
                setStats(statsData);
                setSummary(summaryData.summary);
            } catch (err) {
                console.error("Erro ao carregar insights estratégicos:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchInsights();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Gerando Resumo Estratégico...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total de Insights</p>
                    <div className="flex items-end justify-between">
                        <h4 className="text-2xl font-bold text-gray-900">{stats?.total || 0}</h4>
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Brain size={18} />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Alertas Críticos</p>
                    <div className="flex items-end justify-between">
                        <h4 className="text-2xl font-bold text-red-600">{stats?.critical || 0}</h4>
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-600">
                            <AlertTriangle size={18} />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Oportunidades</p>
                    <div className="flex items-end justify-between">
                        <h4 className="text-2xl font-bold text-emerald-600">{stats?.opportunities || 0}</h4>
                        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <Lightbulb size={18} />
                        </div>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Taxa de Aplicação</p>
                    <div className="flex items-end justify-between">
                        <h4 className="text-2xl font-bold text-brand-600">
                            {stats?.total > 0 ? Math.round((stats.applied / stats.total) * 100) : 0}%
                        </h4>
                        <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Strategic Summary */}
            <div className="bg-brand-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-2xl shadow-brand-900/20">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <TrendingUp size={120} />
                </div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20">
                            <TrendingUp size={20} className="text-brand-300" />
                        </div>
                        <h3 className="text-xl font-bold">Resumo Estratégico Semanal</h3>
                    </div>
                    
                    <div className="prose prose-invert max-w-none">
                        <p className="text-brand-100 leading-relaxed text-lg italic">
                            "{summary}"
                        </p>
                    </div>

                    <div className="mt-8 pt-6 border-t border-white/10 flex items-center gap-4 text-xs font-medium text-brand-300">
                        <span className="flex items-center gap-1.5">
                            <CheckCircle2 size={14} /> Baseado nas últimas 50 notas
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Brain size={14} /> Analisado por Claude-3.5-Sonnet
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntelInsights;

import React, { useState } from 'react';
import { Sparkles, History, Filter } from 'lucide-react';
import IntelCard from './IntelCard';
import { IntelNote, IntelDestino, IntelUrgencia, IntelArea } from '../types';

interface IntelFeedProps {
    notes: IntelNote[];
    onApply?: (note: IntelNote, destino: IntelDestino) => Promise<void>;
}

type UrgenciaFilter = IntelUrgencia | 'todas';
type AreaFilter = IntelArea | 'todas';

const URGENCIA_LABELS: Record<string, string> = {
    todas: 'Todas',
    critica: '🔴 Crítica',
    alta: '🟠 Alta',
    media: '🔵 Média',
    baixa: '⚪ Baixa',
};

const URGENCIA_BADGE: Record<string, string> = {
    critica: 'bg-red-100 text-red-700 border-red-200',
    alta:    'bg-orange-100 text-orange-700 border-orange-200',
    media:   'bg-blue-100 text-blue-700 border-blue-200',
    baixa:   'bg-gray-100 text-gray-600 border-gray-200',
};

const AREA_LABELS: Record<string, string> = {
    todas: 'Todas',
    comercial: 'Comercial',
    operacional: 'Operacional',
    financeiro: 'Financeiro',
    rh: 'RH',
    processos: 'Processos',
    geral: 'Geral',
};

const IntelFeed: React.FC<IntelFeedProps> = ({ notes, onApply }) => {
    const [urgenciaFilter, setUrgenciaFilter] = useState<UrgenciaFilter>('todas');
    const [areaFilter, setAreaFilter] = useState<AreaFilter>('todas');

    const filtered = notes.filter(n => {
        const urgOk = urgenciaFilter === 'todas' || n.analysis?.urgencia === urgenciaFilter;
        const areaOk = areaFilter === 'todas' || n.analysis?.area === areaFilter;
        return urgOk && areaOk;
    });

    // Count badges per urgencia
    const urgenciaCounts = notes.reduce<Record<string, number>>((acc, n) => {
        const u = n.analysis?.urgencia;
        if (u) acc[u] = (acc[u] || 0) + 1;
        return acc;
    }, {});

    if (notes.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-400 mb-6">
                    <Sparkles size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum insight ainda</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Registre sua primeira observação acima e o Gemini irá classificar e sugerir a melhor ação estratégica.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} /> Feed de Inteligência
                </h3>
                <span className="text-[10px] font-medium text-gray-400">
                    {filtered.length} de {notes.length} registros
                </span>
            </div>

            {/* Urgência filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
                <Filter size={12} className="text-gray-400 flex-shrink-0" />
                {(['todas', 'critica', 'alta', 'media', 'baixa'] as UrgenciaFilter[]).map(u => {
                    const isActive = urgenciaFilter === u;
                    const count = u === 'todas' ? notes.length : (urgenciaCounts[u] || 0);
                    if (u !== 'todas' && count === 0) return null;
                    return (
                        <button
                            key={u}
                            onClick={() => setUrgenciaFilter(u)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all
                                ${isActive
                                    ? (u === 'todas' ? 'bg-brand-600 text-white border-brand-600' : `${URGENCIA_BADGE[u]} font-extrabold scale-105`)
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                        >
                            {URGENCIA_LABELS[u]}
                            {count > 0 && u !== 'todas' && (
                                <span className="bg-white/50 rounded-full px-1 text-[9px]">{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Área filter chips (secondary row) */}
            <div className="flex items-center gap-2 flex-wrap">
                {(['todas', 'comercial', 'operacional', 'financeiro', 'rh', 'processos', 'geral'] as AreaFilter[]).map(a => {
                    const isActive = areaFilter === a;
                    const count = a === 'todas' ? notes.length : notes.filter(n => n.analysis?.area === a).length;
                    if (a !== 'todas' && count === 0) return null;
                    return (
                        <button
                            key={a}
                            onClick={() => setAreaFilter(a)}
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold border transition-all
                                ${isActive
                                    ? 'bg-gray-800 text-white border-gray-800'
                                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
                        >
                            {AREA_LABELS[a]} {a !== 'todas' && count > 0 && `(${count})`}
                        </button>
                    );
                })}
            </div>

            {/* No results after filter */}
            {filtered.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-8 flex flex-col items-center text-center">
                    <p className="text-sm text-gray-400 font-medium">
                        Nenhum insight para os filtros selecionados.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-5">
                    {filtered.map((note) => (
                        <IntelCard key={note.id} note={note} onApply={onApply} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default IntelFeed;

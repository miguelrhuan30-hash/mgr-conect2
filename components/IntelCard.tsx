/**
 * components/IntelCard.tsx
 * Sprint 23 + Sprint 25 — Multi-ferramenta com confirmação multi-destino.
 *
 * UX:
 *  • Se a análise retornar acoes_hub[], exibe cards coloridos por item.
 *  • Cada item tem checkbox: o utilizador pode desmarcar destinos antes de confirmar.
 *  • Botão "Confirmar Aplicação" aplica em lote os itens selecionados.
 *  • Itens já aplicados ficam desativados e mostram o ID do doc criado.
 *  • Fallback: se não houver acoes_hub, exibe botões de destino primário (Sprint 23).
 */
import React from 'react';
import {
    ArrowUpRight, Zap, TrendingUp, ShieldAlert, Clock, User,
    Check, Loader2, AlertTriangle, Info, CheckCircle2, CheckSquare, Square
} from 'lucide-react';
import { IntelNote, IntelDestino, AcaoHub } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useIntelApply } from '../hooks/useIntelApply';

interface IntelCardProps {
    note: IntelNote;
    onApply?: (note: IntelNote, destino: IntelDestino) => Promise<void>;
}

// ── Visual helpers ─────────────────────────────────────────────────────────
const URGENCIA_PILL: Record<string, string> = {
    critica: 'bg-red-50 border-red-200 text-red-700',
    alta:    'bg-orange-50 border-orange-200 text-orange-700',
    media:   'bg-blue-50 border-blue-200 text-blue-700',
    baixa:   'bg-gray-50 border-gray-200 text-gray-600',
};

const URGENCIA_ICON: Record<string, React.ReactNode> = {
    critica: <ShieldAlert size={12} />,
    alta:    <Zap size={12} />,
    media:   <Info size={12} />,
    baixa:   <Clock size={12} />,
};

const DESTINO_CFG: Record<IntelDestino, {
    label: string; icon: string; border: string; bg: string; text: string; badgeBg: string;
}> = {
    eisenhower: { label: 'Eisenhower',  icon: '📋', border: 'border-blue-200',   bg: 'bg-blue-50',   text: 'text-blue-800',   badgeBg: 'bg-blue-100'   },
    ishikawa:   { label: 'Ishikawa',    icon: '🐟', border: 'border-red-200',    bg: 'bg-red-50',    text: 'text-red-800',    badgeBg: 'bg-red-100'    },
    canvas:     { label: 'Canvas',      icon: '▦',  border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-800', badgeBg: 'bg-indigo-100' },
    bpmn:       { label: 'BPMN',        icon: '⬡',  border: 'border-purple-200', bg: 'bg-purple-50', text: 'text-purple-800', badgeBg: 'bg-purple-100' },
    roadmap:    { label: 'Roadmap',     icon: '→',  border: 'border-amber-200',  bg: 'bg-amber-50',  text: 'text-amber-800',  badgeBg: 'bg-amber-100'  },
};

const CAMPO_LABEL: Record<string, string> = {
    proposta_valor: 'Proposta de Valor',
    causa_raiz:     'Causa-Raiz de Falha',
    tarefa:         'Tarefa Operacional',
    processo:       'Etapa de Processo',
    etapa:          'Etapa de Roadmap',
    fraqueza:       'Fraqueza Identificada',
    oportunidade:   'Oportunidade',
};

// ── Multi-destino confirmation panel ──────────────────────────────────────
interface MultiApplyPanelProps {
    acoes: AcaoHub[];
    note: IntelNote;
}

const MultiApplyPanel: React.FC<MultiApplyPanelProps> = ({ acoes, note }) => {
    const { applyAcaoHub } = useIntelApply();

    // Track selected state per index (initially all selected unless already applied)
    const [selected, setSelected] = React.useState<boolean[]>(() =>
        acoes.map(a => !a.applied && !a.hub_doc_id)
    );
    const [applying, setApplying] = React.useState(false);
    const [results, setResults] = React.useState<Record<number, 'ok' | 'error' | 'idle'>>({});
    const [errors, setErrors] = React.useState<Record<number, string>>({});
    const [applied, setApplied] = React.useState<Record<number, boolean>>(() => {
        const init: Record<number, boolean> = {};
        acoes.forEach((a, i) => { if (a.applied || a.hub_doc_id) init[i] = true; });
        return init;
    });
    const [docIds, setDocIds] = React.useState<Record<number, string>>(() => {
        const init: Record<number, string> = {};
        acoes.forEach((a, i) => { if (a.hub_doc_id) init[i] = a.hub_doc_id; });
        return init;
    });

    const pendingCount = selected.filter((s, i) => s && !applied[i]).length;

    const toggleItem = (idx: number) => {
        if (applied[idx]) return; // can't deselect already applied
        setSelected(prev => prev.map((v, i) => i === idx ? !v : v));
    };

    const handleConfirmAll = async () => {
        if (!pendingCount || applying) return;
        setApplying(true);

        for (let i = 0; i < acoes.length; i++) {
            if (!selected[i] || applied[i]) continue;
            try {
                await applyAcaoHub(note, acoes[i], i);
                setApplied(prev => ({ ...prev, [i]: true }));
                setResults(prev => ({ ...prev, [i]: 'ok' }));
                // Try to capture doc ID from the updated note (optimistic)
                setDocIds(prev => ({ ...prev, [i]: acoes[i].hub_doc_id || '' }));
            } catch (err: any) {
                setResults(prev => ({ ...prev, [i]: 'error' }));
                setErrors(prev => ({ ...prev, [i]: err?.message || 'Erro desconhecido' }));
            }
        }

        setApplying(false);
    };

    const allDone = acoes.every((_, i) => applied[i] || !selected[i]);

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Zap size={10} /> {acoes.length} item(s) identificado(s) pelo Gemini
                </p>
                {!allDone && (
                    <span className="text-[10px] text-gray-400">Desmarque itens que não deseja aplicar</span>
                )}
            </div>

            {/* Item list */}
            {acoes.map((acao, idx) => {
                const cfg = DESTINO_CFG[acao.ferramenta];
                const isApplied = applied[idx];
                const isSelected = selected[idx];
                const isError = results[idx] === 'error';

                return (
                    <div
                        key={idx}
                        onClick={() => !isApplied && toggleItem(idx)}
                        className={`rounded-xl border p-4 transition-all cursor-pointer select-none
                            ${isApplied
                                ? `${cfg.border} ${cfg.bg} opacity-80`
                                : isSelected
                                    ? `${cfg.border} ${cfg.bg} ring-2 ring-inset ring-current/20`
                                    : 'border-gray-200 bg-gray-50 opacity-50 grayscale'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            {/* Checkbox */}
                            <div className="flex-shrink-0 mt-0.5">
                                {isApplied ? (
                                    <CheckCircle2 size={18} className="text-emerald-500" />
                                ) : isSelected ? (
                                    <CheckSquare size={18} className={cfg.text} />
                                ) : (
                                    <Square size={18} className="text-gray-300" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                {/* Badge + campo */}
                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${cfg.border} ${cfg.badgeBg} ${cfg.text}`}>
                                        {cfg.icon} {cfg.label}
                                    </span>
                                    {CAMPO_LABEL[acao.campo_especifico] && (
                                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">
                                            {CAMPO_LABEL[acao.campo_especifico]}
                                        </span>
                                    )}
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ml-auto ${URGENCIA_PILL[acao.urgencia] || URGENCIA_PILL.baixa}`}>
                                        {acao.urgencia}
                                    </span>
                                </div>

                                {/* Content */}
                                <p className={`text-sm font-medium leading-snug ${cfg.text}`}>
                                    "{acao.conteudo}"
                                </p>

                                {/* Rationale */}
                                {acao.contexto && (
                                    <p className="text-[10px] text-gray-400 italic mt-1 pl-2 border-l-2 border-gray-200">
                                        ↳ {acao.contexto}
                                    </p>
                                )}

                                {/* Status */}
                                {isApplied && (
                                    <p className="text-[10px] text-emerald-600 font-bold mt-1.5 flex items-center gap-1">
                                        <CheckCircle2 size={11} />
                                        Aplicado em {cfg.label}
                                        {docIds[idx] && <span className="font-mono text-gray-400 ml-1">#{docIds[idx].slice(0, 6)}</span>}
                                    </p>
                                )}
                                {isError && (
                                    <p className="text-[10px] text-red-600 mt-1 flex items-center gap-1">
                                        <AlertTriangle size={10} /> {errors[idx]}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            {/* Confirm button */}
            {!allDone && (
                <button
                    onClick={handleConfirmAll}
                    disabled={!pendingCount || applying}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border-2 transition-all
                        ${pendingCount > 0 && !applying
                            ? 'border-brand-600 bg-brand-600 text-white hover:bg-brand-700 hover:scale-[1.01] active:scale-[0.99] shadow-lg shadow-brand-600/20'
                            : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                    {applying
                        ? <><Loader2 size={16} className="animate-spin" /> Aplicando {pendingCount} item(s)...</>
                        : <><Check size={16} /> Confirmar Aplicação ({pendingCount} selecionado{pendingCount !== 1 ? 's' : ''})</>}
                </button>
            )}

            {allDone && (
                <div className="flex items-center justify-center gap-2 py-3 text-emerald-700 text-sm font-bold">
                    <CheckCircle2 size={18} /> Todos os itens selecionados foram aplicados!
                </div>
            )}
        </div>
    );
};

// ── Main Card ────────────────────────────────────────────────────────────────
const IntelCard: React.FC<IntelCardProps> = ({ note, onApply }) => {
    const { analysis } = note;
    const { handleApplyInsight } = useIntelApply();
    const [primaryLoading, setPrimaryLoading] = React.useState<IntelDestino | null>(null);
    const [primaryError, setPrimaryError] = React.useState<string | null>(null);

    const acoes = analysis?.acoes_hub || [];
    const hasAcoes = acoes.length > 0;
    const isSynced = (d: IntelDestino) => !!note.hub_sync?.[d];
    const isFullyApplied = note.status === 'aplicada';
    const primaryDestino = analysis?.destino;

    const handlePrimaryApply = async (destino: IntelDestino) => {
        if (!onApply || primaryLoading) return;
        setPrimaryError(null);
        setPrimaryLoading(destino);
        try {
            await onApply(note, destino);
        } catch (e: any) {
            setPrimaryError(e?.message || 'Erro ao aplicar');
        } finally {
            setPrimaryLoading(null);
        }
    };

    return (
        <div className={`rounded-xl border p-5 transition-all hover:shadow-md
            ${isFullyApplied ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-gray-200'}`}>

            {/* Header */}
            <div className="flex items-start justify-between mb-4 gap-2">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 border border-brand-200">
                        <User size={16} className="text-brand-700" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{note.createdBy}</p>
                        <p className="text-[10px] text-gray-500">
                            {note.createdAt
                                ? format(note.createdAt.toDate(), "dd 'de' MMM, HH:mm", { locale: ptBR })
                                : 'Agora'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {isFullyApplied && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 size={10} /> Aplicado
                        </span>
                    )}
                    {analysis && (
                        <div className={`px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 border ${URGENCIA_PILL[analysis.urgencia] || URGENCIA_PILL.baixa}`}>
                            {URGENCIA_ICON[analysis.urgencia]} {analysis.urgencia}
                        </div>
                    )}
                </div>
            </div>

            {/* Texto original */}
            <p className="text-sm text-gray-800 italic border-l-2 border-gray-200 pl-3 leading-relaxed mb-4">
                "{note.text}"
            </p>

            {/* Análise Gemini */}
            {analysis ? (
                <div className="space-y-4 pt-4 border-t border-gray-100">

                    {/* Resumo */}
                    <div className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-xl p-4 border border-brand-100">
                        <p className="text-[10px] font-bold text-brand-600 uppercase tracking-widest mb-1.5">✦ Gemini analisou</p>
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{analysis.resumo}</p>
                        {analysis.acao_sugerida && (
                            <div className="flex items-start gap-1.5 mt-2">
                                <TrendingUp size={12} className="text-brand-500 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-brand-800">{analysis.acao_sugerida}</p>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    {analysis.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {analysis.tags.map((tag, i) => (
                                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Multi-destino: panel com checkboxes */}
                    {hasAcoes ? (
                        <MultiApplyPanel acoes={acoes} note={note} />
                    ) : (
                        /* Fallback — sem acoes_hub, usa botões de destino primário */
                        <div className="pt-2 border-t border-gray-100">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Aplicar no Hub</p>
                            <div className="flex flex-wrap gap-2">
                                {(Object.keys(DESTINO_CFG) as IntelDestino[]).map(dest => {
                                    const cfg = DESTINO_CFG[dest];
                                    const synced = isSynced(dest);
                                    const isLoading = primaryLoading === dest;
                                    const isPrimary = dest === primaryDestino;
                                    return (
                                        <button
                                            key={dest}
                                            disabled={synced || !!primaryLoading}
                                            onClick={() => handlePrimaryApply(dest)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all
                                                ${synced
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                                                    : isLoading
                                                        ? `opacity-60 cursor-wait ${cfg.bg} ${cfg.text} ${cfg.border}`
                                                        : isPrimary
                                                            ? `${cfg.bg} ${cfg.text} ${cfg.border} hover:scale-105 active:scale-95 shadow-sm`
                                                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-300'}`}
                                        >
                                            {synced ? <><Check size={11} /> {cfg.icon} {cfg.label}</>
                                                : isLoading ? <><Loader2 size={11} className="animate-spin" /> {cfg.label}...</>
                                                : <>{cfg.icon} {cfg.label}{isPrimary ? ' ★' : ''}</>}
                                        </button>
                                    );
                                })}
                            </div>
                            {/* hub_sync status */}
                            {note.hub_sync && Object.keys(note.hub_sync).length > 0 && (
                                <div className="mt-2 space-y-0.5">
                                    {(Object.entries(note.hub_sync) as [IntelDestino, string][]).map(([d, id]) => (
                                        <p key={d} className="text-[10px] text-emerald-600 flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Sincronizado com <strong>{DESTINO_CFG[d]?.label}</strong>
                                            <span className="text-gray-400 font-mono">#{id.slice(0, 6)}</span>
                                        </p>
                                    ))}
                                </div>
                            )}
                            {primaryError && (
                                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2 border border-red-100">
                                    <AlertTriangle size={12} /> {primaryError}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex items-center gap-2 text-gray-400 py-4 animate-pulse border-t border-gray-100 pt-4 mt-4">
                    <Zap size={16} />
                    <span className="text-xs font-medium">Gemini está analisando esta nota...</span>
                </div>
            )}
        </div>
    );
};

export default IntelCard;

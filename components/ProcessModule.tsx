/**
 * components/ProcessModule.tsx
 * Sprint 26 — Construtor de Manuais de Processo via BPMN + Gemini SOP.
 *
 * Permite ao gestor:
 *  • Selecionar um processo da MGR
 *  • Ver e adicionar passos (ManualStep) e requisitos (ProcessRequirement)
 *  • Gerar um SOP completo via Gemini (botão "Gerar Manual")
 *  • Ver insights Intel que já foram injetados no processo via hub_sync[bpmn]
 */
import React, { useState, useEffect } from 'react';
import {
    BookOpen, Plus, Loader2, CheckCircle2, AlertTriangle, Cpu,
    FileText, Shield, Wrench, ChevronDown, ChevronRight,
    ClipboardList, Download, Sparkles, RefreshCw
} from 'lucide-react';
import { useProcessManual } from '../hooks/useProcessManual';
import { ManualStep, ProcessRequirement, BpmnProcessoId } from '../types';
import { useAuth } from '../contexts/AuthContext';

// Lightweight markdown → HTML (avoids external dependency)
const simpleMarkdown = (md: string): string =>
    md
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/`(.+?)`/g, '<code>$1</code>')
        .replace(/\n{2,}/g, '<br/><br/>');

// ── Process catalogue (seeded from MGR_CONTEXT) ──────────────────────────────
const PROCESSOS: { id: BpmnProcessoId; nome: string; area: string; desc: string }[] = [
    { id: 'atendimento-comercial',   nome: 'Atendimento Comercial',   area: 'Comercial',    desc: 'Prospecção → Orçamento → Aprovação do cliente' },
    { id: 'execucao-projetos',       nome: 'Execução de Projetos',    area: 'Operacional',  desc: 'Kickoff → Instalação → Comissionamento' },
    { id: 'compra-materiais',        nome: 'Compra de Materiais',     area: 'Financeiro',   desc: 'Requisição → Cotação → Aprovação → Compra' },
    { id: 'manutencao-preventiva',   nome: 'Manutenção Preventiva',  area: 'Operacional',  desc: 'Agenda → Execução → Relatório técnico' },
    { id: 'handoff-comercial',       nome: 'Handoff Comercial',       area: 'Comercial',    desc: 'Confirmação Comercial → Administrativo após aprovação' },
];

const TIPO_CONFIG: Record<ManualStep['tipo'], { label: string; icon: React.ReactNode; color: string }> = {
    procedure:   { label: 'Procedimento', icon: <ClipboardList size={13} />, color: 'text-blue-700 bg-blue-50 border-blue-200' },
    requirement: { label: 'Requisito',    icon: <Shield size={13} />,        color: 'text-purple-700 bg-purple-50 border-purple-200' },
    warning:     { label: 'Atenção',      icon: <AlertTriangle size={13} />, color: 'text-amber-700 bg-amber-50 border-amber-200' },
    note:        { label: 'Nota',         icon: <FileText size={13} />,      color: 'text-gray-700 bg-gray-50 border-gray-200' },
};

const CAT_COLOR: Record<ProcessRequirement['categoria'], string> = {
    tecnico:      'bg-blue-100 text-blue-700 border-blue-200',
    seguranca:    'bg-red-100 text-red-700 border-red-200',
    equipamento:  'bg-amber-100 text-amber-700 border-amber-200',
    normativa:    'bg-purple-100 text-purple-700 border-purple-200',
    outro:        'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Helper: print SOP ─────────────────────────────────────────────────────────
const printSOP = (html: string, nome: string) => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`
        <!DOCTYPE html><html><head>
        <meta charset="UTF-8"><title>SOP — ${nome}</title>
        <style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;line-height:1.6}
        h1{color:#1B4F8A}h2{color:#378ADD}pre{background:#f4f3ef;padding:1rem;border-radius:8px;white-space:pre-wrap}
        table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.4rem .8rem}
        @media print{body{margin:0}}</style></head>
        <body>${html}</body></html>`);
    w.print();
};

// ── Main Component ─────────────────────────────────────────────────────────────
const ProcessModule: React.FC = () => {
    const { currentUser } = useAuth();
    const {
        updateProcessManual, addRequirement,
        generateSOP, subscribeSteps, subscribeRequirements,
        generatingSop, sopError
    } = useProcessManual();

    const [selectedId, setSelectedId] = useState<BpmnProcessoId>('atendimento-comercial');
    const [steps, setSteps] = useState<ManualStep[]>([]);
    const [reqs, setReqs] = useState<ProcessRequirement[]>([]);
    const [sop, setSop] = useState('');
    const [tab, setTab] = useState<'steps' | 'reqs' | 'sop'>('steps');

    // Add step form
    const [addingStep, setAddingStep] = useState(false);
    const [newStep, setNewStep] = useState({ titulo: '', descricao: '', tipo: 'procedure' as ManualStep['tipo'] });
    const [savingStep, setSavingStep] = useState(false);

    // Add req form
    const [addingReq, setAddingReq] = useState(false);
    const [newReq, setNewReq] = useState({ titulo: '', categoria: 'tecnico' as ProcessRequirement['categoria'], obrigatorio: true });
    const [savingReq, setSavingReq] = useState(false);

    const processo = PROCESSOS.find(p => p.id === selectedId)!;

    // ── Live data ───────────────────────────────────────────────────────
    useEffect(() => {
        const unsub1 = subscribeSteps(selectedId, setSteps);
        const unsub2 = subscribeRequirements(selectedId, setReqs);
        setSop('');
        setTab('steps');
        return () => { unsub1(); unsub2(); };
    }, [selectedId]);

    // ── Handlers ────────────────────────────────────────────────────────
    const handleAddStep = async () => {
        if (!newStep.titulo.trim()) return;
        setSavingStep(true);
        try {
            await updateProcessManual(selectedId, {
                titulo: newStep.titulo,
                descricao: newStep.descricao || undefined,
                tipo: newStep.tipo,
                ordem: (steps[steps.length - 1]?.ordem || 0) + 10,
            });
            setNewStep({ titulo: '', descricao: '', tipo: 'procedure' });
            setAddingStep(false);
        } finally { setSavingStep(false); }
    };

    const handleAddReq = async () => {
        if (!newReq.titulo.trim()) return;
        setSavingReq(true);
        try {
            await addRequirement(selectedId, {
                titulo: newReq.titulo,
                categoria: newReq.categoria,
                obrigatorio: newReq.obrigatorio,
            });
            setNewReq({ titulo: '', categoria: 'tecnico', obrigatorio: true });
            setAddingReq(false);
        } finally { setSavingReq(false); }
    };

    const handleGenerateSOP = async () => {
        try {
            const rawSop = await generateSOP(selectedId, steps, reqs);
            setSop(rawSop);
            setTab('sop');
        } catch { /* sopError exposed by hook */ }
    };

    const sopHtml = sop ? simpleMarkdown(sop) : '';

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                            <BookOpen size={22} />
                        </div>
                        Inteligência Documental
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm">Manuais de processo gerados a partir de insights operacionais.</p>
                </div>
                <div className="flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-2 rounded-lg border border-brand-200 self-start">
                    <Sparkles size={16} className="animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider">Gemini 2.0 Flash</span>
                </div>
            </div>

            {/* Process selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {PROCESSOS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setSelectedId(p.id as BpmnProcessoId)}
                        className={`text-left p-4 rounded-xl border transition-all
                            ${selectedId === p.id
                                ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-400'
                                : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}
                    >
                        <p className="text-xs font-bold text-gray-900 mb-0.5">{p.nome}</p>
                        <p className="text-[10px] text-gray-500">{p.desc}</p>
                        <span className={`inline-block mt-2 text-[9px] font-bold px-2 py-0.5 rounded-full border
                            ${p.area === 'Comercial' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              p.area === 'Financeiro' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-green-50 text-green-700 border-green-200'}`}>
                            {p.area}
                        </span>
                    </button>
                ))}
            </div>

            {/* Content panel */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Panel header */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between flex-wrap gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">{processo.nome}</h2>
                        <p className="text-[10px] text-gray-500">{processo.desc}</p>
                    </div>
                    <button
                        onClick={handleGenerateSOP}
                        disabled={generatingSop || (steps.length === 0 && reqs.length === 0)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold border transition-all
                            ${generatingSop || (steps.length === 0 && reqs.length === 0)
                                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                : 'bg-brand-600 text-white border-brand-700 hover:bg-brand-700 shadow-lg shadow-brand-600/20 hover:scale-105 active:scale-95'}`}
                    >
                        {generatingSop
                            ? <><Loader2 size={14} className="animate-spin" /> Gerando SOP...</>
                            : <><Cpu size={14} /> Gerar Manual (SOP)</>}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-5">
                    {([
                        { key: 'steps', label: `Passos (${steps.length})` },
                        { key: 'reqs',  label: `Requisitos (${reqs.length})` },
                        { key: 'sop',   label: 'Manual Gerado' },
                    ] as const).map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`pb-3 pt-4 text-xs font-bold mr-6 border-b-2 transition-all
                                ${tab === t.key ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="p-5">
                    {/* ── Steps tab ─────────────────────────────── */}
                    {tab === 'steps' && (
                        <div className="space-y-4">
                            {steps.length === 0 && !addingStep && (
                                <div className="text-center py-10 text-gray-400">
                                    <ClipboardList size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Nenhum passo registado.</p>
                                    <p className="text-xs">Adicione procedimentos manualmente ou via insights Intel.</p>
                                </div>
                            )}

                            {steps.map((step, idx) => {
                                const cfg = TIPO_CONFIG[step.tipo];
                                return (
                                    <div key={step.id} className={`flex gap-3 p-4 rounded-xl border ${cfg.color}`}>
                                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-current flex items-center justify-center text-[10px] font-extrabold">
                                            {idx + 1}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                                                    {cfg.icon} {cfg.label}
                                                </span>
                                                {step.origin === 'intel_module' && (
                                                    <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                                                        ✦ Intel
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm font-semibold leading-snug">{step.titulo}</p>
                                            {step.descricao && (
                                                <p className="text-xs text-current/70 mt-1">{step.descricao}</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Add step form */}
                            {addingStep ? (
                                <div className="border-2 border-dashed border-brand-200 rounded-xl p-4 space-y-3 bg-brand-50/30">
                                    <input
                                        type="text"
                                        value={newStep.titulo}
                                        onChange={e => setNewStep(p => ({ ...p, titulo: e.target.value }))}
                                        placeholder="Título do passo (ex: Verificar pressão da válvula)"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none"
                                    />
                                    <textarea
                                        value={newStep.descricao}
                                        onChange={e => setNewStep(p => ({ ...p, descricao: e.target.value }))}
                                        placeholder="Descrição detalhada (opcional)"
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-400 focus:outline-none resize-none"
                                    />
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <select
                                            value={newStep.tipo}
                                            onChange={e => setNewStep(p => ({ ...p, tipo: e.target.value as ManualStep['tipo'] }))}
                                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                                        >
                                            {Object.entries(TIPO_CONFIG).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                        <div className="flex gap-2 ml-auto">
                                            <button
                                                onClick={() => setAddingStep(false)}
                                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleAddStep}
                                                disabled={!newStep.titulo.trim() || savingStep}
                                                className="text-xs px-4 py-1.5 rounded-lg bg-brand-600 text-white font-bold flex items-center gap-1 disabled:opacity-50"
                                            >
                                                {savingStep ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setAddingStep(true)}
                                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-brand-300 hover:text-brand-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} /> Adicionar Passo
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── Requirements tab ──────────────────────── */}
                    {tab === 'reqs' && (
                        <div className="space-y-3">
                            {reqs.length === 0 && !addingReq && (
                                <div className="text-center py-10 text-gray-400">
                                    <Shield size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Nenhum requisito registado.</p>
                                </div>
                            )}

                            {reqs.map(req => (
                                <div key={req.id} className={`flex items-start gap-3 p-3 rounded-xl border ${CAT_COLOR[req.categoria]}`}>
                                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold mb-0.5">{req.titulo}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] font-semibold uppercase tracking-wider">{req.categoria}</span>
                                            {req.obrigatorio && (
                                                <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-200">Obrigatório</span>
                                            )}
                                            {req.origin === 'intel_module' && (
                                                <span className="text-[9px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">✦ Intel</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add req form */}
                            {addingReq ? (
                                <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 space-y-3 bg-purple-50/20">
                                    <input
                                        type="text"
                                        value={newReq.titulo}
                                        onChange={e => setNewReq(p => ({ ...p, titulo: e.target.value }))}
                                        placeholder="Ex: Equipe com NR-35 atualizada"
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-400 focus:outline-none"
                                    />
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <select
                                            value={newReq.categoria}
                                            onChange={e => setNewReq(p => ({ ...p, categoria: e.target.value as ProcessRequirement['categoria'] }))}
                                            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                                        >
                                            <option value="tecnico">Técnico</option>
                                            <option value="seguranca">Segurança</option>
                                            <option value="equipamento">Equipamento</option>
                                            <option value="normativa">Normativa</option>
                                            <option value="outro">Outro</option>
                                        </select>
                                        <label className="flex items-center gap-1.5 text-xs font-medium cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newReq.obrigatorio}
                                                onChange={e => setNewReq(p => ({ ...p, obrigatorio: e.target.checked }))}
                                                className="rounded"
                                            />
                                            Obrigatório
                                        </label>
                                        <div className="flex gap-2 ml-auto">
                                            <button onClick={() => setAddingReq(false)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500">Cancelar</button>
                                            <button
                                                onClick={handleAddReq}
                                                disabled={!newReq.titulo.trim() || savingReq}
                                                className="text-xs px-4 py-1.5 rounded-lg bg-purple-600 text-white font-bold flex items-center gap-1 disabled:opacity-50"
                                            >
                                                {savingReq ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Adicionar
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setAddingReq(true)}
                                    className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-xs font-bold text-gray-400 hover:border-purple-300 hover:text-purple-600 transition-all flex items-center justify-center gap-2"
                                >
                                    <Plus size={14} /> Adicionar Requisito
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── SOP tab ───────────────────────────────── */}
                    {tab === 'sop' && (
                        <div className="space-y-4">
                            {sopError && (
                                <div className="flex items-center gap-2 bg-red-50 text-red-700 text-xs rounded-xl px-4 py-3 border border-red-200">
                                    <AlertTriangle size={14} /> {sopError}
                                </div>
                            )}

                            {!sop && !generatingSop && (
                                <div className="text-center py-12 text-gray-400">
                                    <Cpu size={32} className="mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium">Nenhum manual gerado ainda.</p>
                                    <p className="text-xs">Adicione passos e requisitos, depois clique em "Gerar Manual".</p>
                                </div>
                            )}

                            {generatingSop && (
                                <div className="flex items-center gap-3 text-brand-600 py-8 justify-center animate-pulse">
                                    <Loader2 size={20} className="animate-spin" />
                                    <span className="text-sm font-medium">Gemini está gerando o SOP...</span>
                                </div>
                            )}

                            {sop && !generatingSop && (
                                <>
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Manual Gerado — {processo.nome}</h3>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleGenerateSOP}
                                                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300"
                                            >
                                                <RefreshCw size={12} /> Regenerar
                                            </button>
                                            <button
                                                onClick={() => printSOP(sopHtml, processo.nome)}
                                                className="flex items-center gap-1.5 text-xs text-white bg-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-700 font-bold"
                                            >
                                                <Download size={12} /> Imprimir / PDF
                                            </button>
                                        </div>
                                    </div>
                                    <div
                                        className="prose prose-sm max-w-none bg-gray-50 rounded-xl p-6 border border-gray-200 overflow-auto"
                                        dangerouslySetInnerHTML={{ __html: sopHtml }}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProcessModule;

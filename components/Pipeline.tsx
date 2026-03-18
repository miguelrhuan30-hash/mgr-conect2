/**
 * components/Pipeline.tsx — Sprint 31
 * Pipeline Kanban de O.S. com statusHistory, modal de agendamento e Sub-OS.
 * Wrapper upgrade do OSPipeline.tsx com as funcionalidades obrigatórias da diretiva.
 */
import React, { useState, useEffect } from 'react';
import {
    collection, query, onSnapshot, doc, updateDoc,
    orderBy, addDoc, serverTimestamp, arrayUnion, Timestamp,
    increment, getDoc
} from 'firebase/firestore';
import { Analytics } from '../utils/mgr-analytics';
import { db } from '../firebase';
import {
    Task, WorkflowStatus as WS, WORKFLOW_ORDER,
    WORKFLOW_LABELS, WORKFLOW_COLORS, PriorityLevel,
    CollectionName
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Loader2, ChevronLeft, ChevronRight, AlertTriangle, Clock,
    User, Building2, Calendar, Zap, ChevronDown, ChevronUp,
    ArrowRight, DollarSign, CheckCircle2, Save, X, Kanban, Eye
} from 'lucide-react';
import { Suspense, lazy } from 'react';

const OSViewModal = lazy(() => import('./OSViewModal'));

// ── Type helpers ───────────────────────────────────────────────────────────
const PRIORITY_PILL: Record<PriorityLevel, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high:     'bg-orange-100 text-orange-700 border-orange-200',
    medium:   'bg-blue-100 text-blue-700 border-blue-200',
    low:      'bg-gray-100 text-gray-600 border-gray-200',
};

// ── Scheduling Modal ────────────────────────────────────────────────────────
interface SchedulingModalProps {
    task: Task;
    onConfirm: (data: { equipeId: string; dataPrevista: string; tempoEstimado: number }) => Promise<void>;
    onClose: () => void;
}
const SchedulingModal: React.FC<SchedulingModalProps> = ({ task, onConfirm, onClose }) => {
    const [form, setForm] = useState({ equipeId: '', dataPrevista: '', tempoEstimado: 120 });
    const [saving, setSaving] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try { await onConfirm(form); onClose(); } finally { setSaving(false); }
    };
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-brand-600" /> Agendar O.S.
                    </h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <p className="text-xs text-gray-500 mb-4">{task.code || task.id.slice(0,8)} — {task.title}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Equipe / Responsável *</label>
                        <input required value={form.equipeId}
                            onChange={e => setForm(p => ({ ...p, equipeId: e.target.value }))}
                            placeholder="Nome ou ID da equipe"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Data Prevista *</label>
                        <input required type="datetime-local" value={form.dataPrevista}
                            onChange={e => setForm(p => ({ ...p, dataPrevista: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Tempo Estimado (min)</label>
                        <input type="number" min={15} step={15} value={form.tempoEstimado}
                            onChange={e => setForm(p => ({ ...p, tempoEstimado: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">Cancelar</button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Agendar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Financial Modal ────────────────────────────────────────────────────────
interface FinancialModalProps {
    task: Task;
    onConfirm: (data: { metodoPagamento: string; previsaoPagamento: string; valor: string }) => Promise<void>;
    onClose: () => void;
}
const FinancialModal: React.FC<FinancialModalProps> = ({ task, onConfirm, onClose }) => {
    const [form, setForm] = useState({ metodoPagamento: 'pix', previsaoPagamento: '', valor: '' });
    const [saving, setSaving] = useState(false);
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try { await onConfirm(form); onClose(); } finally { setSaving(false); }
    };
    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-1">
                    <DollarSign className="w-5 h-5 text-emerald-600" /> Lançar Faturamento
                </h3>
                <p className="text-xs text-gray-500 mb-4">{task.code || task.id.slice(0,8)} — {task.title}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Método de Pagamento</label>
                        <select value={form.metodoPagamento}
                            onChange={e => setForm(p => ({ ...p, metodoPagamento: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                            <option value="pix">Pix</option>
                            <option value="boleto">Boleto</option>
                            <option value="transferencia">Transferência</option>
                            <option value="cartao">Cartão</option>
                            <option value="cheque">Cheque</option>
                            <option value="dinheiro">Dinheiro</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Valor (R$)</label>
                        <input type="number" step="0.01" value={form.valor}
                            onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                            placeholder="0,00"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Previsão de Pagamento *</label>
                        <input required type="date" value={form.previsaoPagamento}
                            onChange={e => setForm(p => ({ ...p, previsaoPagamento: e.target.value }))}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">Cancelar</button>
                        <button type="submit" disabled={saving || !form.previsaoPagamento}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── OS Card ────────────────────────────────────────────────────────────────
interface OSCardProps {
    task: Task;
    allTasks: Task[];
    onMove: (task: Task, direction: 'next' | 'prev') => void;
    onPaymentConfirm: (task: Task) => void;
    moving: string | null;
    onViewOS: (taskId: string) => void;
}
const OSCard: React.FC<OSCardProps> = ({ task, allTasks, onMove, onPaymentConfirm, moving, onViewOS }) => {
    const [expanded, setExpanded] = useState(false);
    const children  = allTasks.filter(t => t.parentOSId === task.id);
    const wfIdx     = WORKFLOW_ORDER.indexOf(task.workflowStatus || WS.TRIAGEM);
    const isLast    = wfIdx >= WORKFLOW_ORDER.length - 1;
    const isFirst   = wfIdx <= 0;
    const isMoving  = moving === task.id;
    const isBlocked = task.workflowStatus === WS.AGUARDANDO_PAGAMENTO &&
                      task.financial?.statusPagamento !== 'confirmado';
    const colorClass = WORKFLOW_COLORS[task.workflowStatus || WS.TRIAGEM];

    return (
        <div className={`rounded-xl border-2 p-4 bg-white shadow-sm transition-all cursor-pointer ${isBlocked ? 'border-red-300' : 'border-gray-100'} hover:shadow-md hover:border-brand-200`}
          onClick={() => onViewOS(task.id)}>
            <div className="flex items-start justify-between gap-2 mb-3" onClick={e => e.stopPropagation()}>
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400">{task.code || task.id.slice(0, 8)}</p>
                    <button
                      onClick={() => onViewOS(task.id)}
                      className="text-sm font-bold text-gray-900 leading-snug truncate text-left hover:text-brand-700 transition-colors">
                      {task.title}
                    </button>
                    {task.clientName && (
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Building2 size={9} /> {task.clientName}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={e => { e.stopPropagation(); onViewOS(task.id); }}
                    className="p-1 rounded-lg text-brand-400 hover:bg-brand-50 hover:text-brand-600">
                    <Eye size={13} />
                  </button>
                  <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${PRIORITY_PILL[task.priority]}`}>
                      {task.priority}
                  </div>
                </div>
            </div>

            <div className="flex items-center gap-3 mb-3 flex-wrap text-[10px] text-gray-500">
                {task.assigneeName && <span className="flex items-center gap-1"><User size={10} /> {task.assigneeName}</span>}
                {task.scheduling?.dataPrevista && (
                    <span className="flex items-center gap-1">
                        <Calendar size={10} />
                        {format((task.scheduling.dataPrevista as Timestamp).toDate(), 'dd/MM', { locale: ptBR })}
                    </span>
                )}
            </div>

            {isBlocked && (
                <button onClick={() => onPaymentConfirm(task)}
                    className="w-full mb-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-1">
                    <CheckCircle2 size={12} /> Confirmar Recebimento
                </button>
            )}

            {children.length > 0 && (
                <button onClick={() => setExpanded(!expanded)}
                    className="w-full text-[10px] text-gray-400 flex items-center gap-1 mb-1">
                    {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    {children.length} sub-OS
                </button>
            )}
            {expanded && (
                <div className="space-y-1 mb-3 pl-2 border-l-2 border-gray-100">
                    {children.map(c => (
                        <div key={c.id} className="text-[10px] text-gray-600 flex items-center gap-1.5 py-0.5">
                            <ArrowRight size={9} className="text-gray-300" />
                            {c.title}
                            <span className={`ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold border ${WORKFLOW_COLORS[c.workflowStatus || WS.TRIAGEM]}`}>
                                {WORKFLOW_LABELS[c.workflowStatus || WS.TRIAGEM]}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => onMove(task, 'prev')} disabled={isFirst || isMoving}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 disabled:opacity-30">
                    <ChevronLeft size={11} /> Recuar
                </button>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                    {WORKFLOW_LABELS[task.workflowStatus || WS.TRIAGEM]}
                </span>
                <button onClick={() => onMove(task, 'next')} disabled={isLast || isMoving || isBlocked}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-brand-200 text-brand-700 bg-brand-50 disabled:opacity-30">
                    {isMoving ? <Loader2 size={11} className="animate-spin" /> : <>Avançar <ChevronRight size={11} /></>}
                </button>
            </div>
        </div>
    );
};

// ── Main Pipeline ──────────────────────────────────────────────────────────
const Pipeline: React.FC = () => {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [moving, setMoving] = useState<string | null>(null);
    const [financialModal, setFinancialModal] = useState<Task | null>(null);
    const [schedulingModal, setSchedulingModal] = useState<Task | null>(null);
    const [search, setSearch] = useState('');
    const [filterPriority, setFilterPriority] = useState<PriorityLevel | 'all'>('all');
    const [viewOSId, setViewOSId] = useState<string | null>(null); // Sprint 46

    useEffect(() => {
        const q = query(collection(db, CollectionName.TASKS), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
            setLoading(false);
        });
    }, []);

    const filteredTasks = tasks.filter(t => {
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
            !t.clientName?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });
    const rootTasks = filteredTasks.filter(t => !t.parentOSId);

    const recordStatusHistory = async (taskId: string, newStatus: WS) => {
        if (!currentUser) return;
        await updateDoc(doc(db, CollectionName.TASKS, taskId), {
            statusHistory: arrayUnion({
                status: newStatus,
                changedAt: Timestamp.now(),
                changedBy: currentUser.uid,
            }),
        });
    };

    const moveTask = async (task: Task, direction: 'next' | 'prev') => {
        const idx  = WORKFLOW_ORDER.indexOf(task.workflowStatus || WS.TRIAGEM);
        const next = direction === 'next' ? WORKFLOW_ORDER[idx + 1] : WORKFLOW_ORDER[idx - 1];
        if (!next || !currentUser) return;

        if (next === WS.AGENDADO) { setSchedulingModal(task); return; }
        if (next === WS.AGUARDANDO_FATURAMENTO) { setFinancialModal(task); return; }
        if (next === WS.CONCLUIDO && task.financial?.statusPagamento !== 'confirmado') {
            alert('Pagamento não confirmado. Confirme o recebimento antes de concluir.'); return;
        }

        setMoving(task.id);
        try {
            await updateDoc(doc(db, CollectionName.TASKS, task.id), {
                workflowStatus: next,
                status: next === WS.CONCLUIDO ? 'completed' : next === WS.EM_EXECUCAO ? 'in-progress' : 'pending',
                updatedAt: serverTimestamp(),
            });
            await recordStatusHistory(task.id, next);

            // Analytics — transição de fase
            await Analytics.logTransition({
                collectionName: CollectionName.TASKS,
                docId: task.id,
                de: task.workflowStatus || WS.TRIAGEM,
                para: next,
                userId: currentUser.uid,
                area: 'pipeline',
                eventType: 'os_status_changed',
                extraPayload: { clientId: task.clientId, clientName: task.clientName },
            });

            // Ao concluir: actualizar dados do cliente
            if (next === WS.CONCLUIDO && task.clientId) {
                const clientRef = doc(db, CollectionName.CLIENTS, task.clientId);
                const clientSnap = await getDoc(clientRef);
                const clientData = clientSnap.data();
                const previousStatus = clientData?.status || 'ativo';
                await updateDoc(clientRef, {
                    ultimaOSData: serverTimestamp(),
                    totalOS: increment(1),
                    status: previousStatus === 'inativo' ? 'reativado' : 'ativo',
                });
                if (previousStatus === 'inativo') {
                    await Analytics.logTransition({
                        collectionName: CollectionName.CLIENTS,
                        docId: task.clientId,
                        de: 'inativo',
                        para: 'reativado',
                        userId: currentUser.uid,
                        area: 'clientes',
                        eventType: 'cliente_status_changed',
                        extraPayload: { motivo: 'os_concluida', taskId: task.id },
                    });
                }
                await Analytics.logEvent({
                    eventType: 'os_concluida',
                    area: 'pipeline',
                    userId: currentUser.uid,
                    entityId: task.id,
                    entityType: 'task',
                    payload: { clientId: task.clientId, clientName: task.clientName, valor: task.financial?.valor },
                });
            }
        } finally { setMoving(null); }
    };

    const handleSchedulingConfirm = async (data: { equipeId: string; dataPrevista: string; tempoEstimado: number }) => {
        if (!schedulingModal) return;
        const task = schedulingModal;
        await updateDoc(doc(db, CollectionName.TASKS, task.id), {
            workflowStatus: WS.AGENDADO,
            status: 'in-progress',
            scheduling: {
                equipeId: data.equipeId,
                dataPrevista: Timestamp.fromDate(new Date(data.dataPrevista)),
                tempoEstimado: data.tempoEstimado,
            },
            updatedAt: serverTimestamp(),
        });
        await recordStatusHistory(task.id, WS.AGENDADO);
        setSchedulingModal(null);
    };

    const handleFinancialConfirm = async (data: { metodoPagamento: string; previsaoPagamento: string; valor: string }) => {
        if (!financialModal || !currentUser) return;
        const task = financialModal;
        const previsao = data.previsaoPagamento ? Timestamp.fromDate(new Date(data.previsaoPagamento)) : undefined;
        await updateDoc(doc(db, CollectionName.TASKS, task.id), {
            workflowStatus: WS.AGUARDANDO_FATURAMENTO,
            status: 'in-progress',
            financial: {
                metodoPagamento: data.metodoPagamento,
                previsaoPagamento: previsao ?? null,
                statusPagamento: 'pendente',
                valor: data.valor ? parseFloat(data.valor) : undefined,
            },
            updatedAt: serverTimestamp(),
        });
        await recordStatusHistory(task.id, WS.AGUARDANDO_FATURAMENTO);
        await addDoc(collection(db, CollectionName.RECEIVABLES), {
            taskId: task.id,
            taskCode: task.code || task.id,
            clientId: task.clientId || '',
            clientName: task.clientName || 'N/A',
            valor: data.valor ? parseFloat(data.valor) : undefined,
            metodoPagamento: data.metodoPagamento,
            previsaoPagamento: previsao,
            status: 'pendente' as const,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid,
        });
        setFinancialModal(null);
    };

    const confirmPayment = async (task: Task) => {
        if (!currentUser) return;
        await updateDoc(doc(db, CollectionName.TASKS, task.id), {
            'financial.statusPagamento': 'confirmado',
            workflowStatus: WS.AGUARDANDO_PAGAMENTO,
            updatedAt: serverTimestamp(),
        });
        await Analytics.logEvent({
            eventType: 'payment_confirmed',
            area: 'financeiro',
            userId: currentUser.uid,
            entityId: task.id,
            entityType: 'task',
            payload: { clientId: task.clientId, clientName: task.clientName, valor: task.financial?.valor },
        });
    };

    const tasksByStatus = (status: WS) => rootTasks.filter(t => (t.workflowStatus || WS.TRIAGEM) === status);

    return (
        <div className="flex flex-col h-full pb-4">
            <div className="flex items-center gap-3 mb-5 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Kanban className="w-5 h-5 text-brand-600" /> Pipeline de O.S.
                </h1>
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar O.S. ou cliente..."
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48" />
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value as any)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                    <option value="all">Todas prioridades</option>
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                </select>
            </div>

            {loading ? (
                <div className="flex items-center justify-center flex-1">
                    <Loader2 className="animate-spin text-brand-600 w-8 h-8" />
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-2 flex-1">
                    {WORKFLOW_ORDER.map(status => {
                        const col = tasksByStatus(status);
                        const colorClass = WORKFLOW_COLORS[status];
                        return (
                            <div key={status} className="flex-shrink-0 w-64 flex flex-col">
                                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0 ${colorClass}`}>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">{WORKFLOW_LABELS[status]}</span>
                                    <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded-full">{col.length}</span>
                                </div>
                                <div className={`flex-1 border rounded-b-xl p-3 space-y-3 min-h-32 ${colorClass}`}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.015)' }}>
                                    {col.length === 0 && <p className="text-[10px] text-gray-300 text-center py-4">Vazio</p>}
                                    {col.map(task => (
                                        <OSCard key={task.id} task={task} allTasks={tasks}
                                            onMove={moveTask} onPaymentConfirm={confirmPayment}
                                            moving={moving} onViewOS={setViewOSId} />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {schedulingModal && (
                <SchedulingModal task={schedulingModal}
                    onConfirm={handleSchedulingConfirm}
                    onClose={() => setSchedulingModal(null)} />
            )}
            {financialModal && (
                <FinancialModal task={financialModal}
                    onConfirm={handleFinancialConfirm}
                    onClose={() => setFinancialModal(null)} />
            )}
            {viewOSId && (
                <Suspense fallback={null}>
                    <OSViewModal taskId={viewOSId} onClose={() => setViewOSId(null)} />
                </Suspense>
            )}
        </div>
    );
};

export default Pipeline;

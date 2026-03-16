/**
 * components/OSPipeline.tsx
 * Sprint 31 — Pipeline Linear: Kanban visual por WorkflowStatus.
 *
 * Features:
 *  • Colunas Kanban baseadas no WorkflowStatus (esquerda → direita)
 *  • Drag visual via botões de avanço/recuo de status
 *  • Cards de O.S. com cliente, prioridade, prazo e assignee
 *  • Botão de criar nova O.S. que abre OSCreationModal
 *  • Sub-OS: cards filhos mostrados dentro do card pai (accordion)
 *  • Ao mover para AGUARDANDO_FATURAMENTO, abre formulário financeiro
 *  • Ao mover para CONCLUIDO, bloqueia se pagamento não confirmado
 */
import React, { useState, useEffect } from 'react';
import {
    ChevronRight, ChevronLeft, Plus, AlertTriangle, Clock,
    User, Building2, Loader2, CheckCircle2, DollarSign, Calendar,
    Zap, Filter, ChevronDown, ChevronUp, ArrowRight
} from 'lucide-react';
import {
    collection, query, onSnapshot, doc, updateDoc,
    orderBy, addDoc, serverTimestamp, where, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import {
    Task, WorkflowStatus, WorkflowStatus as WS, WORKFLOW_ORDER,
    WORKFLOW_LABELS, WORKFLOW_COLORS, PriorityLevel,
    CollectionName, Receivable
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Priority badges ───────────────────────────────────────────────────────────
const PRIORITY_PILL: Record<PriorityLevel, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high:     'bg-orange-100 text-orange-700 border-orange-200',
    medium:   'bg-blue-100 text-blue-700 border-blue-200',
    low:      'bg-gray-100 text-gray-600 border-gray-200',
};
const PRIORITY_ICONS: Record<PriorityLevel, React.ReactNode> = {
    critical: <Zap size={10} className="text-red-600" />,
    high:     <AlertTriangle size={10} className="text-orange-500" />,
    medium:   <Clock size={10} className="text-blue-500" />,
    low:      <Clock size={10} className="text-gray-400" />,
};

// ── Financial Modal ───────────────────────────────────────────────────────────
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-600" /> Lançar Faturamento
                </h3>
                <p className="text-xs text-gray-500 mb-5">O.S.: <strong>{task.code || task.id.slice(0, 8)}</strong> — {task.title}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Método de Pagamento</label>
                        <select
                            value={form.metodoPagamento}
                            onChange={e => setForm(p => ({ ...p, metodoPagamento: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        >
                            <option value="pix">Pix</option>
                            <option value="boleto">Boleto</option>
                            <option value="transferencia">Transferência Bancária</option>
                            <option value="cartao">Cartão</option>
                            <option value="cheque">Cheque</option>
                            <option value="dinheiro">Dinheiro</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Valor (R$)</label>
                        <input
                            type="number" step="0.01" min="0"
                            value={form.valor}
                            onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                            placeholder="0,00"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-600 mb-1 block">Previsão de Pagamento</label>
                        <input
                            type="date" required
                            value={form.previsaoPagamento}
                            onChange={e => setForm(p => ({ ...p, previsaoPagamento: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving || !form.previsaoPagamento}
                            className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                            Confirmar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── OS Card ───────────────────────────────────────────────────────────────────
interface OSCardProps {
    task: Task;
    allTasks: Task[];
    onMove: (task: Task, direction: 'next' | 'prev') => void;
    onPaymentConfirm: (task: Task) => void;
    moving: string | null;
}

const OSCard: React.FC<OSCardProps> = ({ task, allTasks, onMove, onPaymentConfirm, moving }) => {
    const [expanded, setExpanded] = useState(false);
    const children = allTasks.filter(t => t.parentOSId === task.id);
    const wfIdx = WORKFLOW_ORDER.indexOf(task.workflowStatus || WS.TRIAGEM);
    const isLast = wfIdx >= WORKFLOW_ORDER.length - 1;
    const isFirst = wfIdx <= 0;
    const isMoving = moving === task.id;
    const isBlocked = task.workflowStatus === WS.AGUARDANDO_PAGAMENTO && task.financial?.statusPagamento !== 'confirmado';
    const colorClass = WORKFLOW_COLORS[task.workflowStatus || WS.TRIAGEM];

    return (
        <div className={`rounded-xl border-2 p-4 bg-white shadow-sm transition-all
            ${isBlocked ? 'border-red-300' : 'border-gray-100'} hover:shadow-md`}>

            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="min-w-0">
                    <p className="text-[10px] font-bold text-gray-400 mb-0.5">{task.code || task.id.slice(0, 8)}</p>
                    <p className="text-sm font-bold text-gray-900 leading-snug">{task.title}</p>
                    {task.clientName && (
                        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
                            <Building2 size={9} /> {task.clientName}
                        </p>
                    )}
                </div>
                <div className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 flex-shrink-0 ${PRIORITY_PILL[task.priority]}`}>
                    {PRIORITY_ICONS[task.priority]} {task.priority}
                </div>
            </div>

            {/* Assignee + Date */}
            <div className="flex items-center gap-3 mb-3 flex-wrap">
                {task.assigneeName && (
                    <span className="text-[10px] flex items-center gap-1 text-gray-500">
                        <User size={10} /> {task.assigneeName}
                    </span>
                )}
                {task.scheduling?.dataPrevista && (
                    <span className="text-[10px] flex items-center gap-1 text-gray-500">
                        <Calendar size={10} />
                        {format((task.scheduling.dataPrevista as Timestamp).toDate(), 'dd/MM', { locale: ptBR })}
                    </span>
                )}
                {task.endDate && (
                    <span className="text-[10px] flex items-center gap-1 text-gray-500">
                        <Clock size={10} />
                        {format((task.endDate as Timestamp).toDate(), 'dd/MM/yy', { locale: ptBR })}
                    </span>
                )}
            </div>

            {/* Payment confirmation */}
            {isBlocked && (
                <button onClick={() => onPaymentConfirm(task)}
                    className="w-full mb-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-center gap-1 hover:bg-emerald-100">
                    <CheckCircle2 size={12} /> Confirmar Recebimento
                </button>
            )}

            {/* Sub-OS accordion */}
            {children.length > 0 && (
                <button onClick={() => setExpanded(!expanded)}
                    className="w-full text-[10px] text-gray-400 flex items-center gap-1 mb-2">
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

            {/* Nav buttons */}
            <div className="flex items-center justify-between gap-2">
                <button onClick={() => onMove(task, 'prev')} disabled={isFirst || isMoving}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-gray-200 text-gray-500 hover:border-gray-300 disabled:opacity-30">
                    <ChevronLeft size={11} /> Recuar
                </button>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                    {WORKFLOW_LABELS[task.workflowStatus || WS.TRIAGEM]}
                </span>
                <button onClick={() => onMove(task, 'next')}
                    disabled={isLast || isMoving || isBlocked}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-30">
                    {isMoving ? <Loader2 size={11} className="animate-spin" /> : <>Avançar <ChevronRight size={11} /></>}
                </button>
            </div>
        </div>
    );
};

// ── Main Pipeline ─────────────────────────────────────────────────────────────
const OSPipeline: React.FC = () => {
    const { currentUser, userProfile } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [moving, setMoving] = useState<string | null>(null);
    const [financialModal, setFinancialModal] = useState<Task | null>(null);
    const [filterPriority, setFilterPriority] = useState<PriorityLevel | 'all'>('all');
    const [search, setSearch] = useState('');

    useEffect(() => {
        const q = query(collection(db, CollectionName.TASKS), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, snap => {
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
            setLoading(false);
        });
        return unsub;
    }, []);

    const filteredTasks = tasks.filter(t => {
        if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
        if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
            !t.clientName?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // Only show root tasks in columns (sub-OS shown inside parent)
    const rootTasks = filteredTasks.filter(t => !t.parentOSId);

    const moveTask = async (task: Task, direction: 'next' | 'prev') => {
        const currentStatus = task.workflowStatus || WS.TRIAGEM;
        const idx = WORKFLOW_ORDER.indexOf(currentStatus);
        const nextStatus = direction === 'next' ? WORKFLOW_ORDER[idx + 1] : WORKFLOW_ORDER[idx - 1];
        if (!nextStatus) return;

        // Intercept: moving to AGUARDANDO_FATURAMENTO → open financial modal
        if (nextStatus === WS.AGUARDANDO_FATURAMENTO) {
            setFinancialModal(task);
            return;
        }

        // Intercept: completing → check payment
        if (nextStatus === WS.CONCLUIDO && task.financial?.statusPagamento !== 'confirmado') {
            alert('Esta O.S. não pode ser concluída sem pagamento confirmado.');
            return;
        }

        setMoving(task.id);
        try {
            await updateDoc(doc(db, CollectionName.TASKS, task.id), {
                workflowStatus: nextStatus,
                status: nextStatus === WS.CONCLUIDO ? 'completed' : nextStatus === WS.EM_EXECUCAO ? 'in-progress' : 'pending',
                updatedAt: serverTimestamp(),
            });
        } finally { setMoving(null); }
    };

    const handleFinancialConfirm = async (
        data: { metodoPagamento: string; previsaoPagamento: string; valor: string }
    ) => {
        if (!financialModal || !currentUser) return;
        const task = financialModal;

        const previsao = data.previsaoPagamento
            ? Timestamp.fromDate(new Date(data.previsaoPagamento))
            : undefined;

        // Update the task
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

        // Create receivable
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
        await updateDoc(doc(db, CollectionName.TASKS, task.id), {
            'financial.statusPagamento': 'confirmado',
            workflowStatus: WS.AGUARDANDO_PAGAMENTO,
            updatedAt: serverTimestamp(),
        });
    };

    const tasksByStatus = (status: WS) =>
        rootTasks.filter(t => (t.workflowStatus || WS.TRIAGEM) === status);

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-5 flex-wrap">
                <h2 className="text-xl font-bold text-gray-900 flex-1">Pipeline de O.S.</h2>
                <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar O.S. ou cliente..."
                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48"
                />
                <select
                    value={filterPriority}
                    onChange={e => setFilterPriority(e.target.value as any)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
                >
                    <option value="all">Todas prioridades</option>
                    <option value="critical">Crítica</option>
                    <option value="high">Alta</option>
                    <option value="medium">Média</option>
                    <option value="low">Baixa</option>
                </select>
            </div>

            {/* Board */}
            {loading ? (
                <div className="flex items-center justify-center flex-1 text-brand-600">
                    <Loader2 size={24} className="animate-spin" />
                </div>
            ) : (
                <div className="flex gap-3 overflow-x-auto pb-4 flex-1">
                    {WORKFLOW_ORDER.map(status => {
                        const col = tasksByStatus(status);
                        const colorClass = WORKFLOW_COLORS[status];
                        return (
                            <div key={status} className="flex-shrink-0 w-64 flex flex-col">
                                {/* Column header */}
                                <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl border border-b-0 mb-0 ${colorClass}`}>
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider">
                                        {WORKFLOW_LABELS[status]}
                                    </span>
                                    <span className="text-[10px] font-bold bg-white/60 px-1.5 py-0.5 rounded-full">
                                        {col.length}
                                    </span>
                                </div>
                                {/* Cards */}
                                <div className={`flex-1 border rounded-b-xl p-3 space-y-3 min-h-32 ${colorClass} bg-opacity-20`}
                                    style={{ backgroundColor: 'rgba(0,0,0,0.015)' }}>
                                    {col.length === 0 && (
                                        <p className="text-[10px] text-gray-300 text-center py-4">Vazio</p>
                                    )}
                                    {col.map(task => (
                                        <OSCard
                                            key={task.id}
                                            task={task}
                                            allTasks={tasks}
                                            onMove={moveTask}
                                            onPaymentConfirm={confirmPayment}
                                            moving={moving}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Financial modal */}
            {financialModal && (
                <FinancialModal
                    task={financialModal}
                    onConfirm={handleFinancialConfirm}
                    onClose={() => setFinancialModal(null)}
                />
            )}
        </div>
    );
};

export default OSPipeline;

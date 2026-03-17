/**
 * components/Billing.tsx — Sprint 33
 * Faturamento e Recebíveis — 3 abas.
 */
import React, { useState, useEffect } from 'react';
import {
    collection, query, where, onSnapshot, orderBy, updateDoc,
    doc, addDoc, serverTimestamp, Timestamp, arrayUnion, getDocs
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from '../utils/mgr-analytics';
import { Task, WorkflowStatus as WS, CollectionName, Receivable } from '../types';
import {
    Receipt, FileCheck, Clock, CheckCircle2, AlertTriangle,
    DollarSign, Loader2, X, Save, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
    format, differenceInCalendarDays, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameDay, addDays
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const METHOD_LABELS: Record<string, string> = {
    pix: 'PIX', boleto: 'Boleto', transferencia: 'Transferência',
    cartao: 'Cartão', cheque: 'Cheque', dinheiro: 'Dinheiro',
};
const formatBRL = (v?: number) => v != null ? `R$ ${v.toFixed(2)}` : '—';

// ── Invoice Modal ────────────────────────────────────────────────────────────
const InvoiceModal: React.FC<{ task: Task; onClose: () => void }> = ({ task, onClose }) => {
    const { currentUser } = useAuth();
    const [form, setForm] = useState({ valor: '', metodoPagamento: 'pix', previsaoPagamento: '', observacoes: '' });
    const [saving, setSaving] = useState(false);
    const set = (k: string) => (e: React.ChangeEvent<any>) => setForm(p => ({ ...p, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !form.previsaoPagamento) return;
        setSaving(true);
        try {
            const previsao = Timestamp.fromDate(new Date(form.previsaoPagamento));
            const valor = form.valor ? parseFloat(form.valor) : undefined;
            await updateDoc(doc(db, CollectionName.TASKS, task.id), {
                workflowStatus: WS.AGUARDANDO_PAGAMENTO, status: 'in-progress',
                financial: { valor, metodoPagamento: form.metodoPagamento, previsaoPagamento: previsao, statusPagamento: 'pendente' },
                statusHistory: arrayUnion({ status: WS.AGUARDANDO_PAGAMENTO, changedAt: Timestamp.now(), changedBy: currentUser.uid }),
                updatedAt: serverTimestamp(),
            });
            await addDoc(collection(db, CollectionName.RECEIVABLES), {
                taskId: task.id, taskCode: task.code || task.id,
                clientId: task.clientId || '', clientName: task.clientName || 'N/A',
                assigneeName: task.assigneeName || '', valor,
                metodoPagamento: form.metodoPagamento, previsaoPagamento: previsao,
                status: 'pendente' as const, observacoes: form.observacoes || undefined,
                createdAt: serverTimestamp(), createdBy: currentUser.uid,
            });
            onClose();
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2"><FileCheck className="w-5 h-5 text-brand-600" /> Faturar O.S.</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600">
                    <p className="font-bold">{task.code || task.id.slice(0,8)}</p>
                    <p>{task.title}</p>
                    {task.clientName && <p className="text-gray-400">{task.clientName}</p>}
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div><label className="text-xs font-bold text-gray-600 block mb-1">Valor (R$)</label>
                        <input type="number" step="0.01" value={form.valor} onChange={set('valor')} placeholder="0,00" className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs font-bold text-gray-600 block mb-1">Método</label>
                        <select value={form.metodoPagamento} onChange={set('metodoPagamento')} className="w-full border rounded-lg px-3 py-2 text-sm">
                            {Object.entries(METHOD_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                    <div><label className="text-xs font-bold text-gray-600 block mb-1">Data Prevista *</label>
                        <input required type="date" value={form.previsaoPagamento} onChange={set('previsaoPagamento')} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
                        <textarea rows={2} value={form.observacoes} onChange={set('observacoes')} className="w-full border rounded-lg px-3 py-2 text-sm resize-none" /></div>
                    <div className="flex gap-3 pt-1">
                        <button type="button" onClick={onClose} className="flex-1 py-2 border rounded-xl text-sm font-bold text-gray-500">Cancelar</button>
                        <button type="submit" disabled={saving} className="flex-1 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Faturar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Tab 1: Para Faturar ──────────────────────────────────────────────────────
const TabFaturar: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<Task | null>(null);
    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.TASKS), where('workflowStatus', '==', WS.AGUARDANDO_FATURAMENTO), orderBy('createdAt','asc')),
        snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))); setLoading(false); },
        () => setLoading(false)
    ), []);
    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
    return (
        <div className="space-y-3">
            {tasks.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">Nenhuma O.S. aguardando faturamento.</div>}
            {tasks.map(task => (
                <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 font-bold">{task.code || task.id.slice(0,8)}</p>
                        <p className="font-bold text-gray-900 truncate">{task.title}</p>
                        {task.clientName && <p className="text-xs text-gray-500">{task.clientName}</p>}
                        {task.assigneeName && <p className="text-xs text-gray-400">Técnico: {task.assigneeName}</p>}
                    </div>
                    <button onClick={() => setModal(task)} className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 flex items-center gap-2 flex-shrink-0">
                        <DollarSign className="w-4 h-4" /> Faturar</button>
                </div>
            ))}
            {modal && <InvoiceModal task={modal} onClose={() => setModal(null)} />}
        </div>
    );
};

// ── Tab 2: Aguardando Pagamento ──────────────────────────────────────────────
const TabAguardando: React.FC = () => {
    const { currentUser } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [confirming, setConfirming] = useState<string | null>(null);
    const today = new Date();
    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.TASKS), where('workflowStatus', '==', WS.AGUARDANDO_PAGAMENTO), orderBy('financial.previsaoPagamento','asc')),
        snap => { setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))); setLoading(false); },
        () => setLoading(false)
    ), []);
    const confirmPayment = async (task: Task) => {
        if (!currentUser) return;
        setConfirming(task.id);
        try {
            await updateDoc(doc(db, CollectionName.TASKS, task.id), {
                workflowStatus: WS.CONCLUIDO, status: 'completed',
                'financial.statusPagamento': 'confirmado',
                statusHistory: arrayUnion({ status: WS.CONCLUIDO, changedAt: Timestamp.now(), changedBy: currentUser.uid }),
                updatedAt: serverTimestamp(),
            });
            const recQ = query(collection(db, CollectionName.RECEIVABLES), where('taskId','==',task.id), where('status','==','pendente'));
            const recSnap = await getDocs(recQ);
            for (const d of recSnap.docs) {
                await updateDoc(d.ref, { status: 'confirmado', confirmedAt: Timestamp.now(), confirmedBy: currentUser.uid });
            }
            await Analytics.logEvent({
                eventType: 'payment_confirmed',
                area: 'financeiro',
                userId: currentUser.uid,
                entityId: task.id,
                entityType: 'task',
                payload: { clientId: task.clientId, clientName: task.clientName, valor: task.financial?.valor },
            });
        } finally { setConfirming(null); }
    };
    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
    return (
        <div className="space-y-3">
            {tasks.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">Nenhuma O.S. aguardando pagamento.</div>}
            {tasks.map(task => {
                const prevDate = task.financial?.previsaoPagamento ? (task.financial.previsaoPagamento as Timestamp).toDate() : null;
                const daysLeft = prevDate ? differenceInCalendarDays(prevDate, today) : null;
                const isOverdue = daysLeft !== null && daysLeft < 0;
                const isSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3;
                return (
                    <div key={task.id} className={`bg-white rounded-xl border p-5 flex items-center gap-4 shadow-sm ${isOverdue ? 'border-red-300' : isSoon ? 'border-amber-300' : 'border-gray-200'}`}>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <p className="font-bold text-gray-900 truncate">{task.title}</p>
                                {isOverdue && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full">Vencido</span>}
                                {isSoon && !isOverdue && <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 border border-amber-200 rounded-full">A vencer</span>}
                            </div>
                            {task.clientName && <p className="text-xs text-gray-500">{task.clientName}</p>}
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
                                {task.financial?.valor !== undefined && <span className="font-bold text-emerald-700">{formatBRL(task.financial.valor)}</span>}
                                {task.financial?.metodoPagamento && <span>{METHOD_LABELS[task.financial.metodoPagamento] || task.financial.metodoPagamento}</span>}
                                {prevDate && <span>{format(prevDate, 'dd/MM/yyyy', { locale: ptBR })}</span>}
                            </div>
                        </div>
                        <button onClick={() => confirmPayment(task)} disabled={confirming === task.id}
                            className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1 flex-shrink-0">
                            {confirming === task.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Confirmar
                        </button>
                    </div>
                );
            })}
        </div>
    );
};

// ── Tab 3: Calendário ────────────────────────────────────────────────────────
const TabCalendario: React.FC = () => {
    const [receivables, setReceivables] = useState<Receivable[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date());
    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.RECEIVABLES), where('status','!=','cancelado'), orderBy('status'), orderBy('previsaoPagamento','asc')),
        snap => { setReceivables(snap.docs.map(d => ({ id: d.id, ...d.data() } as Receivable))); setLoading(false); },
        () => setLoading(false)
    ), []);
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    const totalPendente   = receivables.filter(r => r.status === 'pendente').reduce((s,r) => s + (r.valor||0), 0);
    const totalConfirmado = receivables.filter(r => r.status === 'confirmado').reduce((s,r) => s + (r.valor||0), 0);
    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] font-bold text-amber-500 uppercase">Pendente</p>
                    <p className="text-xl font-extrabold text-amber-700">{formatBRL(totalPendente)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Confirmado</p>
                    <p className="text-xl font-extrabold text-emerald-700">{formatBRL(totalConfirmado)}</p>
                </div>
            </div>
            <div className="flex items-center justify-between">
                <button onClick={() => setMonth(m => addDays(startOfMonth(m),-1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronLeft className="w-5 h-5 text-gray-500" /></button>
                <p className="font-bold text-gray-900">{format(month, 'MMMM yyyy', { locale: ptBR })}</p>
                <button onClick={() => setMonth(m => addDays(endOfMonth(m),1))} className="p-1.5 rounded-lg hover:bg-gray-100"><ChevronRight className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="grid grid-cols-7 gap-1">
                {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => <p key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</p>)}
                {Array.from({ length: startOfMonth(month).getDay() }).map((_,i) => <div key={i} />)}
                {days.map(day => {
                    const dayRecs = receivables.filter(r => {
                        const d = r.previsaoPagamento ? (r.previsaoPagamento as Timestamp).toDate() : null;
                        return d && isSameDay(d, day);
                    });
                    const hasConf = dayRecs.some(r => r.status === 'confirmado');
                    return (
                        <div key={day.toISOString()} className={`min-h-[52px] rounded-lg border p-1 text-center ${dayRecs.length > 0 ? hasConf ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
                            <p className="text-[11px] font-bold text-gray-600">{format(day,'d')}</p>
                            {dayRecs.slice(0,2).map(r => (
                                <p key={r.id} className={`text-[8px] truncate leading-tight ${r.status==='confirmado'?'text-emerald-700':'text-amber-700'}`}>{r.clientName}</p>
                            ))}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Main Billing ─────────────────────────────────────────────────────────────
const Billing: React.FC = () => {
    const [tab, setTab] = useState<'faturar'|'aguardando'|'calendario'>('faturar');
    const tabs = [
        { id: 'faturar', label: 'Para Faturar', icon: FileCheck },
        { id: 'aguardando', label: 'Aguardando Pagto.', icon: Clock },
        { id: 'calendario', label: 'Calendário', icon: Calendar },
    ] as const;
    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <Receipt className="w-6 h-6 text-brand-600" />
                <div><h1 className="text-2xl font-bold text-gray-900">Faturamento & Recebíveis</h1>
                    <p className="text-gray-500 text-sm">Gestão financeira completa de O.S.</p></div>
            </div>
            <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                {tabs.map(t => {
                    const Icon = t.icon;
                    return (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${tab===t.id?'bg-white text-brand-700 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
                            <Icon className="w-4 h-4" /> {t.label}
                        </button>
                    );
                })}
            </div>
            {tab === 'faturar'    && <TabFaturar />}
            {tab === 'aguardando' && <TabAguardando />}
            {tab === 'calendario' && <TabCalendario />}
        </div>
    );
};

export default Billing;

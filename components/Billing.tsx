/**
 * components/Billing.tsx
 * Faturamento e Recebíveis — 3 abas. Reformulado pra usar o mesmo motor de
 * cobrança com parcelas do faturamento de projeto (ver hooks/useFaturamento.ts,
 * components/FaturamentoPanel.tsx, components/OSFaturamentoModal.tsx) — permite
 * parcelamento, método por parcela, agrupar várias O.S. numa cobrança só, e
 * upload de comprovante/boleto/NF. O antigo fluxo (valor único via `receivables`)
 * foi substituído; docs antigos em `receivables` ficam como histórico.
 */
import React, { useState, useEffect } from 'react';
import {
    collection, query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Task, WorkflowStatus as WS, CollectionName, ProjectFaturamento, FaturamentoParcela } from '../types';
import { getTipoOrigemOS } from '../services/osService';
import OSFaturamentoModal from './OSFaturamentoModal';
import {
    Receipt, FileCheck, Clock,
    DollarSign, Loader2, Calendar, ChevronLeft, ChevronRight,
    FolderOpen, Users,
} from 'lucide-react';
import {
    format, startOfMonth, endOfMonth,
    eachDayOfInterval, isSameDay, addDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatBRL = (v?: number) => v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';
const fmtDate = (ts: any) => {
    if (!ts) return '—';
    try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), 'dd/MM/yyyy', { locale: ptBR }); }
    catch { return '—'; }
};

// ── Tab 1: Para Faturar ──────────────────────────────────────────────────────
const TabFaturar: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
    const [modalTasks, setModalTasks] = useState<Task[] | null>(null);

    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.TASKS), where('workflowStatus', '==', WS.AGUARDANDO_FATURAMENTO)),
        snap => {
            const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            setTasks(all.filter(t => !(t as any).faturamentoPeloProjeto));
            setLoading(false);
        },
        () => setLoading(false)
    ), []);

    const toggle = (id: string) => setSelecionadas(prev => {
        const n = new Set(prev);
        n.has(id) ? n.delete(id) : n.add(id);
        return n;
    });

    const tarefasSelecionadas = tasks.filter(t => selecionadas.has(t.id));
    const clientesDistintos = new Set(tarefasSelecionadas.map(t => t.clientId || t.clientName));
    const podeAgrupar = tarefasSelecionadas.length >= 2 && clientesDistintos.size === 1;

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
    return (
        <div className="space-y-3">
            {tasks.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">Nenhuma O.S. aguardando faturamento.</div>}

            {tarefasSelecionadas.length > 0 && (
                <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl p-3">
                    <span className="text-xs font-bold text-brand-700">{tarefasSelecionadas.length} selecionada(s)</span>
                    <button
                        onClick={() => { if (podeAgrupar) { setModalTasks(tarefasSelecionadas); setSelecionadas(new Set()); } }}
                        disabled={!podeAgrupar}
                        title={tarefasSelecionadas.length >= 2 && clientesDistintos.size > 1 ? 'Selecione O.S. do mesmo cliente pra agrupar' : undefined}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 disabled:opacity-50">
                        <DollarSign className="w-3.5 h-3.5" /> Criar Cobrança{tarefasSelecionadas.length > 1 ? ` (${tarefasSelecionadas.length} O.S.)` : ''}
                    </button>
                </div>
            )}

            {tasks.map(task => {
                const tipo = getTipoOrigemOS(task);
                return (
                <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
                    <input type="checkbox" checked={selecionadas.has(task.id)} onChange={() => toggle(task.id)}
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-gray-400 font-bold">{(task as any).numeroOS || task.code || task.id.slice(0,8)}</p>
                            {tipo === 'projeto' && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full text-[9px] font-bold">
                                    <FolderOpen className="w-2.5 h-2.5" /> Projeto
                                </span>
                            )}
                        </div>
                        <p className="font-bold text-gray-900 truncate">{task.title}</p>
                        {task.clientName && <p className="text-xs text-gray-500">{task.clientName}</p>}
                        {task.assigneeName && <p className="text-xs text-gray-400">Técnico: {task.assigneeName}</p>}
                    </div>
                    <button onClick={() => setModalTasks([task])} className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 flex items-center gap-2 flex-shrink-0">
                        <DollarSign className="w-4 h-4" /> Faturar</button>
                </div>
                );
            })}
            {modalTasks && <OSFaturamentoModal tasks={modalTasks} onClose={() => setModalTasks(null)} />}
        </div>
    );
};

// ── Tab 2: Aguardando Pagamento ──────────────────────────────────────────────
const TabAguardando: React.FC = () => {
    const [tasksPorId, setTasksPorId] = useState<Record<string, Task>>({});
    const [faturamentos, setFaturamentos] = useState<ProjectFaturamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalTasks, setModalTasks] = useState<Task[] | null>(null);

    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.TASKS), where('workflowStatus', '==', WS.AGUARDANDO_PAGAMENTO)),
        snap => {
            const map: Record<string, Task> = {};
            snap.docs.forEach(d => { map[d.id] = { id: d.id, ...d.data() } as Task; });
            setTasksPorId(map);
            setLoading(false);
        },
        () => setLoading(false)
    ), []);

    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.PROJECT_FATURAMENTOS), where('status', '==', 'aberto')),
        snap => {
            setFaturamentos(
                snap.docs
                    .map(d => ({ id: d.id, ...d.data() } as ProjectFaturamento))
                    .filter(f => (f.taskIds?.length ?? 0) > 0)
            );
        },
        () => {}
    ), []);

    const abrirCobranca = (fat: ProjectFaturamento) => {
        const tasks = (fat.taskIds || []).map(id => tasksPorId[id]).filter(Boolean) as Task[];
        if (tasks.length > 0) setModalTasks(tasks);
    };

    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
    return (
        <div className="space-y-3">
            {faturamentos.length === 0 && <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">Nenhuma cobrança de O.S. aguardando pagamento.</div>}
            {faturamentos.map(fat => {
                const atrasadas = fat.parcelas.filter((p: FaturamentoParcela) => p.status === 'atrasado').length;
                const proximaPendente = fat.parcelas
                    .filter((p: FaturamentoParcela) => p.status !== 'pago')
                    .sort((a, b) => (a.dataVencimento?.seconds ?? 0) - (b.dataVencimento?.seconds ?? 0))[0];
                return (
                    <button key={fat.id} onClick={() => abrirCobranca(fat)}
                        className={`w-full text-left bg-white rounded-xl border p-5 flex items-center gap-4 shadow-sm hover:shadow-md transition-all ${atrasadas > 0 ? 'border-red-300' : 'border-gray-200'}`}>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <p className="font-bold text-gray-900">{fat.clientName}</p>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-brand-100 text-brand-700 border border-brand-200 rounded-full text-[9px] font-bold">
                                    <Users className="w-2.5 h-2.5" /> {fat.taskIds?.length} O.S.
                                </span>
                                {atrasadas > 0 && <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 border border-red-200 rounded-full">{atrasadas} parcela(s) atrasada(s)</span>}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 flex-wrap">
                                <span className="font-bold text-emerald-700">{formatBRL(fat.totalPago)} pago</span>
                                <span className="font-bold text-yellow-700">{formatBRL(fat.totalPendente)} pendente</span>
                                {proximaPendente && <span>Próx. venc: {fmtDate(proximaPendente.dataVencimento)}</span>}
                            </div>
                        </div>
                        <DollarSign className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    </button>
                );
            })}
            {modalTasks && <OSFaturamentoModal tasks={modalTasks} onClose={() => setModalTasks(null)} />}
        </div>
    );
};

// ── Tab 3: Calendário ────────────────────────────────────────────────────────
interface ParcelaCalendario extends FaturamentoParcela { clientName: string; }

const TabCalendario: React.FC = () => {
    const [faturamentos, setFaturamentos] = useState<ProjectFaturamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date());
    useEffect(() => onSnapshot(
        query(collection(db, CollectionName.PROJECT_FATURAMENTOS)),
        snap => {
            setFaturamentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectFaturamento)).filter(f => (f.taskIds?.length ?? 0) > 0));
            setLoading(false);
        },
        () => setLoading(false)
    ), []);

    const parcelas: ParcelaCalendario[] = faturamentos.flatMap(f => f.parcelas.map(p => ({ ...p, clientName: f.clientName })));
    const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
    const totalPendente   = parcelas.filter(p => p.status !== 'pago').reduce((s,p) => s + (p.valor||0), 0);
    const totalConfirmado = parcelas.filter(p => p.status === 'pago').reduce((s,p) => s + (p.valor||0), 0);
    if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8" /></div>;
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] font-bold text-amber-500 uppercase">Pendente</p>
                    <p className="text-xl font-extrabold text-amber-700">{formatBRL(totalPendente)}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Recebido</p>
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
                    const dayParcelas = parcelas.filter(p => {
                        const d = p.dataVencimento ? (p.dataVencimento as any).toDate?.() ?? new Date((p.dataVencimento as any).seconds * 1000) : null;
                        return d && isSameDay(d, day);
                    });
                    const hasPago = dayParcelas.some(p => p.status === 'pago');
                    return (
                        <div key={day.toISOString()} className={`min-h-[52px] rounded-lg border p-1 text-center ${dayParcelas.length > 0 ? hasPago ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
                            <p className="text-[11px] font-bold text-gray-600">{format(day,'d')}</p>
                            {dayParcelas.slice(0,2).map((p, i) => (
                                <p key={p.id + i} className={`text-[8px] truncate leading-tight ${p.status==='pago' ? 'text-emerald-700' : 'text-amber-700'}`}>{p.clientName}</p>
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
                    <p className="text-gray-500 text-sm">Gestão financeira completa de O.S. — parcelas, agrupamento e documentos</p></div>
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

/**
 * components/OSEditModal.tsx — Sprint 47 (Unified Full Rewrite)
 *
 * Painel de edição 100% unificado — acessível de qualquer módulo.
 * Inclui:
 *  • Todos os campos (identificação, cliente, projeto, equipe, agendamento, financeiro, campo, tarefas)
 *  • Reagendamento com motivos pré-definidos
 *  • Arquivamento (soft-delete)
 *  • Exclusão permanente com Zona de Perigo (somente canDeleteTasks)
 *  • Progresso automático baseado em tarefas concluídas
 *  • Gestor: todos os campos    • Técnico: ferramentas + tarefas
 */
import React, { useState, useEffect } from 'react';
import {
  doc, updateDoc, deleteDoc, addDoc, serverTimestamp, Timestamp, getDocs,
  collection, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Task, CollectionName, OSEdicao, PriorityLevel, WorkflowStatus,
  WORKFLOW_ORDER, WORKFLOW_LABELS, REAGENDAMENTO_MOTIVOS, OSItemTarefa,
} from '../types';
import {
  X, Save, Loader2, ChevronDown, ChevronUp, Plus, Trash2, AlertCircle,
  Building, User, Calendar, Wrench, ClipboardList, Package, Archive,
  AlertTriangle, DollarSign, Users, MapPin, RefreshCw, Briefcase,
  Clock, CheckCircle2,
} from 'lucide-react';

/* ─── Props ─────────────────────────────────────────────────────────────────── */
interface OSEditModalProps {
  task: Task;
  onClose: () => void;
  onSaved: (updated: Task) => void;
}

/* ─── Constants ─────────────────────────────────────────────────────────────── */
const PRIORIDADES: { value: PriorityLevel; label: string }[] = [
  { value: 'low',      label: 'Baixa'    },
  { value: 'medium',   label: 'Média'    },
  { value: 'high',     label: 'Alta'     },
  { value: 'critical', label: 'Crítica'  },
];

const STATUS_LIST = [
  { value: 'pending',     label: 'Pendente'     },
  { value: 'in-progress', label: 'Em execução'  },
  { value: 'completed',   label: 'Concluída'    },
  { value: 'blocked',     label: 'Bloqueada'    },
  { value: 'cancelled',   label: 'Cancelada'    },
];

const METODOS_PAGAMENTO = [
  { value: 'pix',           label: 'PIX'           },
  { value: 'boleto',        label: 'Boleto'        },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cartao',        label: 'Cartão'        },
  { value: 'cheque',        label: 'Cheque'        },
  { value: 'dinheiro',      label: 'Dinheiro'      },
];

/* ─── Collapsible Section ───────────────────────────────────────────────────── */
const Section: React.FC<{
  title: string; icon: React.ReactNode; children: React.ReactNode;
  defaultOpen?: boolean; badge?: string;
}> = ({ title, icon, children, defaultOpen = true, badge }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50/80 hover:bg-gray-100/80 transition-colors"
      >
        {icon}
        <span className="text-xs font-bold text-gray-600 uppercase tracking-wide flex-1 text-left">{title}</span>
        {badge && <span className="text-[10px] font-bold bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{badge}</span>}
        {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 py-3 space-y-3">{children}</div>}
    </div>
  );
};

/* ─── Main Component ────────────────────────────────────────────────────────── */
const OSEditModal: React.FC<OSEditModalProps> = ({ task, onClose, onSaved }) => {
  const { currentUser, userProfile } = useAuth();
  const isGestor = ['admin', 'gestor', 'manager', 'developer'].includes(userProfile?.role || '');
  const canDelete = isGestor && (userProfile?.permissions?.canDeleteTasks ?? (userProfile?.role === 'admin' || userProfile?.role === 'developer'));

  // ── Data sources ──────────────────────────────────────────────────────────
  const [clients,  setClients]  = useState<any[]>([]);
  const [users,    setUsers]    = useState<any[]>([]);
  const [ativos,   setAtivos]   = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Tipo serviço autocomplete
  const [tipoSugestoes, setTipoSugestoes] = useState<string[]>([]);

  // ── Gestor-only fields ────────────────────────────────────────────────────
  const [titulo,        setTitulo]        = useState(task.title);
  const [descricao,     setDescricao]     = useState(task.description || '');
  const [status,        setStatus]        = useState(task.status);
  const [prioridade,    setPrioridade]    = useState<PriorityLevel>(task.priority || 'medium');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(task.workflowStatus || WorkflowStatus.TRIAGEM);
  const [tipoServico,   setTipoServico]   = useState((task as any).tipoServico || '');
  const [clientId,      setClientId]      = useState((task as any).clientId || '');
  const [clientName,    setClientName]    = useState((task as any).clientName || '');
  const [assigneeId,    setAssigneeId]    = useState((task as any).assigneeId || (task as any).assignedTo || '');
  const [assigneeName,  setAssigneeName]  = useState((task as any).assigneeName || '');
  const [assignedUsers, setAssignedUsers] = useState<string[]>((task as any).assignedUsers || []);
  const [ativoId,       setAtivoId]       = useState((task as any).ativoId || '');
  const [ativoNome,     setAtivoNome]     = useState((task as any).ativoNome || '');
  const [projectId,     setProjectId]     = useState((task as any).projectId || '');
  const [projectName,   setProjectName]   = useState((task as any).projectName || '');

  const [startDate, setStartDate] = useState(() => {
    const d = (task as any)?.scheduling?.dataInicio || (task as any)?.startDate;
    if (!d) return '';
    const ms = d.toMillis ? d.toMillis() : d;
    return new Date(ms).toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = (task as any)?.scheduling?.dataPrevista || (task as any)?.endDate;
    if (!d) return '';
    const ms = d.toMillis ? d.toMillis() : d;
    return new Date(ms).toISOString().slice(0, 16);
  });
  const [tempoEstimado, setTempoEstimado] = useState<number>((task as any)?.scheduling?.tempoEstimado || 0);

  // Financial
  const [valorFinanceiro,     setValorFinanceiro]     = useState<string>(
    (task as any)?.financial?.valor != null ? String((task as any).financial.valor) : ''
  );
  const [metodoPagamento,     setMetodoPagamento]     = useState((task as any)?.financial?.metodoPagamento || 'pix');
  const [previsaoPagamento,   setPrevisaoPagamento]   = useState(() => {
    const d = (task as any)?.financial?.previsaoPagamento;
    if (!d) return '';
    return new Date(d.toMillis ? d.toMillis() : d).toISOString().slice(0, 10);
  });

  // Ponto
  const [pontoEntrada, setPontoEntrada] = useState((task as any)?.ponto?.permiteEntrada ?? false);
  const [pontoSaida,   setPontoSaida]   = useState((task as any)?.ponto?.permiteSaida ?? false);

  // ── Both roles ────────────────────────────────────────────────────────────
  const [ferramenta,  setFerramenta]  = useState('');
  const [ferramentas, setFerramentas] = useState<string[]>((task as any).ferramentasUtilizadas || []);
  const [novaTarefa,  setNovaTarefa]  = useState('');
  const [tarefasOS,   setTarefasOS]   = useState<any[]>((task as any).tarefasOS || []);

  // ── Reagendamento ─────────────────────────────────────────────────────────
  const [showReagendar,        setShowReagendar]        = useState(false);
  const [reagendamentoMotivo,  setReagendamentoMotivo]  = useState<string>(REAGENDAMENTO_MOTIVOS[0]);
  const [reagendamentoOutro,   setReagendamentoOutro]   = useState('');
  const [reagendamentoData,    setReagendamentoData]    = useState('');
  const [reagendamentoDesc,    setReagendamentoDesc]    = useState('');
  const [reagendando,          setReagendando]          = useState(false);

  // ── State ─────────────────────────────────────────────────────────────────
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError]       = useState('');

  // ── Progress ──────────────────────────────────────────────────────────────
  const totalTarefas = tarefasOS.length;
  const tarefasConcluidas = tarefasOS.filter((t: any) => t.status === 'concluida').length;
  const progresso = totalTarefas > 0 ? Math.round((tarefasConcluidas / totalTarefas) * 100) : 0;

  // ── Load selects ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isGestor) { setLoadingData(false); return; }
    (async () => {
      try {
        const [cs, us] = await Promise.all([
          getDocs(collection(db, CollectionName.CLIENTS)),
          getDocs(collection(db, CollectionName.USERS)),
        ]);
        setClients(cs.docs.map(d => ({ id: d.id, ...d.data() })));
        setUsers(us.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* silent */ }
      finally { setLoadingData(false); }
    })();
  }, [isGestor]);

  // Load ativos when clientId changes
  useEffect(() => {
    if (!clientId) { setAtivos([]); setAtivoId(''); setAtivoNome(''); return; }
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(snap => setAtivos(snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  // Load projects when clientId changes
  useEffect(() => {
    if (!clientId) { setProjects([]); return; }
    getDocs(query(collection(db, CollectionName.PROJECTS), where('clientId', '==', clientId)))
      .then(snap => setProjects(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
      .catch(() => setProjects([]));
    // Also try os_projects
    getDocs(query(collection(db, CollectionName.OS_PROJECTS), where('clientId', '==', clientId)))
      .then(snap => {
        const ps = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).nome, ...(d.data() as any) }));
        setProjects(prev => [...prev, ...ps]);
      })
      .catch(() => {});
  }, [clientId]);

  // Tipo serviço autocomplete
  const buscarTipos = async (val: string) => {
    if (!val.trim()) { setTipoSugestoes([]); return; }
    try {
      const snap = await getDocs(collection(db, CollectionName.SERVICE_TYPES));
      const all = snap.docs.map(d => (d.data() as any).nome as string);
      setTipoSugestoes(all.filter(n => n.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
    } catch { setTipoSugestoes([]); }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const adicionarFerramenta = () => {
    const f = ferramenta.trim();
    if (!f || ferramentas.includes(f)) return;
    setFerramentas(prev => [...prev, f]);
    setFerramenta('');
  };

  const adicionarTarefa = () => {
    const t = novaTarefa.trim();
    if (!t) return;
    setTarefasOS(prev => [...prev, {
      id: `tarefa_${Date.now()}`,
      descricao: t,
      status: 'pendente',
      fotoSlots: [
        { id: 'antes',  titulo: 'Foto Antes',  instrucao: 'Antes de iniciar', obrigatoria: true, ordem: 0 },
        { id: 'depois', titulo: 'Foto Depois', instrucao: 'Após concluir',    obrigatoria: true, ordem: 1 },
      ],
      fotosEvidencia: [],
    }]);
    setNovaTarefa('');
  };

  const removeTarefa = (id: string) => setTarefasOS(prev => prev.filter(t => t.id !== id));

  // ── Save ──────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError('');
    try {
      const agora = Timestamp.now();
      const edicao: OSEdicao = {
        campo: 'edição_geral',
        valorAnterior: task.title,
        valorNovo: isGestor ? titulo : task.title,
        editadoPor: currentUser.uid,
        editadoPorNome: userProfile?.displayName || currentUser.email || 'Usuário',
        editadoEm: agora,
        viaDados: 'sistema',
      };

      const patch: Record<string, any> = {
        updatedAt: serverTimestamp(),
        edicoes: [...((task as any).edicoes || []), edicao],
        ferramentasUtilizadas: ferramentas,
        tarefasOS,
      };

      if (isGestor) {
        if (titulo      !== task.title)         patch.title       = titulo;
        if (descricao   !== task.description)   patch.description = descricao;
        if (status      !== task.status)        patch.status      = status;
        if (prioridade  !== task.priority)      patch.priority    = prioridade;
        if (workflowStatus !== task.workflowStatus) patch.workflowStatus = workflowStatus;
        if (tipoServico !== (task as any).tipoServico) patch.tipoServico = tipoServico;

        if (clientId !== (task as any).clientId) {
          patch.clientId   = clientId;
          patch.clientName = clientName;
        }
        if (assigneeId !== ((task as any).assigneeId || (task as any).assignedTo)) {
          patch.assignedTo   = assigneeId;
          patch.assigneeId   = assigneeId;
          patch.assigneeName = assigneeName;
        }
        patch.assignedUsers = assignedUsers;
        patch.assignedUserNames = assignedUsers.map(uid => {
          const u = users.find((x: any) => x.id === uid || x.uid === uid);
          return u?.displayName || u?.name || 'Desconhecido';
        });

        if (ativoId !== (task as any).ativoId) {
          patch.ativoId   = ativoId;
          patch.ativoNome = ativoNome;
        }
        if (projectId !== (task as any).projectId) {
          patch.projectId   = projectId;
          patch.projectName = projectName;
        }

        // Scheduling
        const scheduling: any = { ...((task as any).scheduling || {}) };
        if (startDate) scheduling.dataInicio    = Timestamp.fromDate(new Date(startDate));
        if (endDate)   scheduling.dataPrevista  = Timestamp.fromDate(new Date(endDate));
        if (tempoEstimado > 0) scheduling.tempoEstimado = tempoEstimado;
        if (startDate || endDate || tempoEstimado > 0) patch.scheduling = scheduling;

        // Dates (legacy)
        if (startDate) patch.startDate = Timestamp.fromDate(new Date(startDate));
        if (endDate)   patch.endDate   = Timestamp.fromDate(new Date(endDate));

        // Financial
        const financial: any = { ...((task as any).financial || {}) };
        if (valorFinanceiro)     financial.valor             = parseFloat(valorFinanceiro);
        if (metodoPagamento)     financial.metodoPagamento   = metodoPagamento;
        if (previsaoPagamento)   financial.previsaoPagamento = Timestamp.fromDate(new Date(previsaoPagamento));
        if (valorFinanceiro || previsaoPagamento) patch.financial = financial;

        // Ponto
        patch.ponto = { permiteEntrada: pontoEntrada, permiteSaida: pontoSaida };
      }

      await updateDoc(doc(db, CollectionName.TASKS, task.id), patch);

      const updated: Task = {
        ...task,
        ...patch,
        updatedAt: agora,
      } as unknown as Task;

      onSaved(updated);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────
  const arquivar = async () => {
    if (!currentUser) return;
    if (!window.confirm('Tem certeza que deseja arquivar esta O.S.? Ela será movida para a aba "Arquivadas".')) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, CollectionName.TASKS, task.id), {
        archived: true,
        archivedAt: serverTimestamp(),
        archivedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      });
      onSaved({ ...task, archived: true } as unknown as Task);
    } catch (e: any) {
      setError(e.message || 'Erro ao arquivar');
    } finally {
      setSaving(false);
    }
  };

  // ── Unarchive ─────────────────────────────────────────────────────────────
  const desarquivar = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, CollectionName.TASKS, task.id), {
        archived: false,
        archivedAt: null,
        archivedBy: null,
        updatedAt: serverTimestamp(),
      });
      onSaved({ ...task, archived: false } as unknown as Task);
    } catch (e: any) {
      setError(e.message || 'Erro ao desarquivar');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const excluir = async () => {
    if (!currentUser || !canDelete) return;
    if (!window.confirm('⚠️ ATENÇÃO: Esta ação é IRREVERSÍVEL!\n\nA Ordem de Serviço será excluída PERMANENTEMENTE e não poderá ser recuperada.\n\nDeseja realmente excluir?')) return;
    if (!window.confirm('Confirme mais uma vez: EXCLUIR PERMANENTEMENTE esta O.S.?')) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, CollectionName.TASKS, task.id));
      onSaved({ ...task, id: '__deleted__' } as unknown as Task);
    } catch (e: any) {
      setError(e.message || 'Erro ao excluir');
      setDeleting(false);
    }
  };

  // ── Reagendar ─────────────────────────────────────────────────────────────
  const handleReagendar = async () => {
    if (!currentUser || !reagendamentoData) return;
    setReagendando(true);
    try {
      const motivo = reagendamentoMotivo === 'Outro' ? reagendamentoOutro : (reagendamentoMotivo as string);

      // Create new OS linked to original
      const tarefasPendentes = tarefasOS
        .filter((t: any) => t.status !== 'concluida')
        .map((t: any) => ({ ...t, id: `tarefa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, status: 'pendente' }));

      const novaOS: Record<string, any> = {
        title: `[Reag.] ${titulo}`,
        description: reagendamentoDesc || descricao,
        status: 'pending',
        priority: prioridade,
        clientId, clientName,
        assignedTo: assigneeId, assigneeName, assigneeId,
        assignedUsers,
        tipoServico,
        ativoId, ativoNome,
        projectId, projectName,
        scheduling: {
          dataPrevista: Timestamp.fromDate(new Date(reagendamentoData)),
          tempoEstimado: tempoEstimado || undefined,
        },
        startDate: Timestamp.fromDate(new Date(reagendamentoData)),
        tarefasOS: tarefasPendentes.length > 0 ? tarefasPendentes : [{
          id: `tarefa_${Date.now()}`,
          descricao: 'Continuação do serviço',
          status: 'pendente',
          fotoSlots: [
            { id: 'antes', titulo: 'Foto Antes', instrucao: 'Antes de iniciar', obrigatoria: true, ordem: 0 },
            { id: 'depois', titulo: 'Foto Depois', instrucao: 'Após concluir', obrigatoria: true, ordem: 1 },
          ],
          fotosEvidencia: [],
        }],
        ferramentasUtilizadas: ferramentas,
        ponto: { permiteEntrada: pontoEntrada, permiteSaida: pontoSaida },
        reagendamentoDe: task.id,
        reagendamentoMotivo: motivo,
        workflowStatus: WorkflowStatus.TRIAGEM,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const novaRef = await addDoc(collection(db, CollectionName.TASKS), novaOS);

      // Finalize original OS
      await updateDoc(doc(db, CollectionName.TASKS, task.id), {
        status: 'completed',
        statusOS: 'reagendar',
        reagendamentoMotivo: motivo,
        reagendamentoPara: novaRef.id,
        updatedAt: serverTimestamp(),
      });

      onSaved({ ...task, status: 'completed', statusOS: 'reagendar' } as unknown as Task);
    } catch (e: any) {
      setError(e.message || 'Erro ao reagendar');
    } finally {
      setReagendando(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '96vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-sm">
              ✏️ Editar O.S. — {task.title.slice(0, 40)}{task.title.length > 40 ? '…' : ''}
            </h3>
            {!isGestor && (
              <p className="text-[10px] text-amber-600 mt-0.5">Modo técnico — apenas ferramentas e tarefas extras</p>
            )}
          </div>
          {/* Progress badge */}
          {totalTarefas > 0 && (
            <div className="flex items-center gap-2 mr-3">
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${progresso >= 100 ? 'bg-green-500' : 'bg-brand-500'}`}
                  style={{ width: `${progresso}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-500">{progresso}%</span>
            </div>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* ── GESTOR SECTIONS ── */}
          {isGestor && (
            <>
              {/* Section 1: Identificação */}
              <Section title="Identificação" icon={<ClipboardList size={13} className="text-gray-400" />}>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Título *</label>
                  <input
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Descrição</label>
                  <textarea
                    value={descricao}
                    onChange={e => setDescricao(e.target.value)}
                    rows={3}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                {/* Tipo de Serviço com autocomplete */}
                <div className="relative">
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Tipo de Serviço</label>
                  <input
                    value={tipoServico}
                    onChange={e => { setTipoServico(e.target.value); buscarTipos(e.target.value); }}
                    placeholder="Ex: Manutenção preventiva, Instalação..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  {tipoSugestoes.length > 0 && (
                    <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-36 overflow-y-auto">
                      {tipoSugestoes.map(s => (
                        <button key={s} type="button" onClick={() => { setTipoServico(s); setTipoSugestoes([]); }}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Status, Prioridade, Workflow */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Status</label>
                    <div className="relative">
                      <select value={status} onChange={e => setStatus(e.target.value as any)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                        {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Prioridade</label>
                    <div className="relative">
                      <select value={prioridade} onChange={e => setPrioridade(e.target.value as PriorityLevel)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                        {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Pipeline</label>
                    <div className="relative">
                      <select value={workflowStatus} onChange={e => setWorkflowStatus(e.target.value as WorkflowStatus)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                        {WORKFLOW_ORDER.map(ws => <option key={ws} value={ws}>{WORKFLOW_LABELS[ws]}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
              </Section>

              {/* Section 2: Cliente & Projeto */}
              <Section title="Cliente & Projeto" icon={<Building size={13} className="text-gray-400" />}>
                {loadingData ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-brand-500" /></div>
                ) : (
                  <>
                    <div className="relative">
                      <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Cliente</label>
                      <select value={clientId} onChange={e => {
                        const c = clients.find(x => x.id === e.target.value);
                        setClientId(e.target.value);
                        setClientName(c?.name || c?.nome || '');
                        setAtivoId(''); setAtivoNome('');
                        setProjectId(''); setProjectName('');
                      }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                        <option value="">Selecione o cliente...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.nome}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-[calc(50%+8px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {ativos.length > 0 && (
                      <div className="relative">
                        <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Ativo</label>
                        <select value={ativoId} onChange={e => {
                          const a = ativos.find(x => x.id === e.target.value);
                          setAtivoId(e.target.value); setAtivoNome(a?.nome || '');
                        }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                          <option value="">Selecione o ativo (opcional)...</option>
                          {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-[calc(50%+8px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    )}
                    {projects.length > 0 && (
                      <div className="relative">
                        <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">
                          <Briefcase size={11} className="inline mr-1" />Projeto
                        </label>
                        <select value={projectId} onChange={e => {
                          const p = projects.find(x => x.id === e.target.value);
                          setProjectId(e.target.value); setProjectName(p?.name || p?.nome || '');
                        }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                          <option value="">Nenhum projeto</option>
                          {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.nome}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-[calc(50%+8px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* Section 3: Equipe */}
              <Section title="Equipe" icon={<Users size={13} className="text-gray-400" />}>
                {loadingData ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-brand-500" /></div>
                ) : (
                  <>
                    <div className="relative">
                      <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Responsável Principal</label>
                      <select value={assigneeId} onChange={e => {
                        const u = users.find(x => x.id === e.target.value || x.uid === e.target.value);
                        setAssigneeId(e.target.value);
                        setAssigneeName(u?.displayName || u?.name || '');
                      }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                        <option value="">Nenhum responsável</option>
                        {users.map(u => <option key={u.id || u.uid} value={u.id || u.uid}>{u.displayName || u.name}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-[calc(50%+8px)] -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1.5">Colaboradores Adicionais</label>
                      <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                        {users.map(u => (
                          <label key={u.id || u.uid} className={`
                            flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs cursor-pointer transition-colors
                            ${assignedUsers.includes(u.id || u.uid) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                          `}>
                            <input
                              type="checkbox"
                              className="rounded text-brand-600 w-3 h-3"
                              checked={assignedUsers.includes(u.id || u.uid)}
                              onChange={e => {
                                const uid = u.id || u.uid;
                                if (e.target.checked) setAssignedUsers(prev => [...prev, uid]);
                                else setAssignedUsers(prev => prev.filter(id => id !== uid));
                              }}
                            />
                            <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold flex-shrink-0">
                              {(u.displayName || u.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            {(u.displayName || u.name || 'Usuário').split(' ')[0]}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </Section>

              {/* Section 4: Agendamento */}
              <Section title="Agendamento" icon={<Calendar size={13} className="text-gray-400" />}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Data Início</label>
                    <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Prazo Previsto</label>
                    <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1 flex items-center gap-1">
                    <Clock size={10} /> Tempo Estimado (minutos)
                  </label>
                  <input type="number" min={0} step={15} value={tempoEstimado || ''}
                    onChange={e => setTempoEstimado(Number(e.target.value))}
                    placeholder="Ex: 120"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200" />
                </div>
              </Section>

              {/* Section 5: Financeiro */}
              <Section title="Financeiro" icon={<DollarSign size={13} className="text-gray-400" />} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Valor (R$)</label>
                    <input type="number" step="0.01" value={valorFinanceiro}
                      onChange={e => setValorFinanceiro(e.target.value)} placeholder="0,00"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200" />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Método Pagamento</label>
                    <div className="relative">
                      <select value={metodoPagamento} onChange={e => setMetodoPagamento(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none bg-white focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8">
                        {METODOS_PAGAMENTO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-gray-400 block mb-1">Previsão de Pagamento</label>
                  <input type="date" value={previsaoPagamento}
                    onChange={e => setPrevisaoPagamento(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200" />
                </div>
              </Section>

              {/* Section 6: Campo */}
              <Section title="Execução em Campo" icon={<MapPin size={13} className="text-gray-400" />} defaultOpen={false}>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Registro de Ponto em Campo</p>
                  <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={pontoEntrada} onChange={e => setPontoEntrada(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    Permite ponto de entrada neste local
                  </label>
                  <label className="flex items-center gap-3 text-sm text-gray-700 cursor-pointer">
                    <input type="checkbox" checked={pontoSaida} onChange={e => setPontoSaida(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                    Permite ponto de saída neste local
                  </label>
                </div>
              </Section>
            </>
          )}

          {/* ── BOTH ROLES: Ferramentas ── */}
          <Section title="Ferramentas" icon={<Wrench size={13} className="text-gray-400" />}
            badge={ferramentas.length > 0 ? `${ferramentas.length}` : undefined}>
            <div className="flex gap-2">
              <input value={ferramenta} onChange={e => setFerramenta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarFerramenta()}
                placeholder="Digitar e pressionar Enter..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300" />
              <button onClick={adicionarFerramenta} className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700">
                <Plus size={14} />
              </button>
            </div>
            {ferramentas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ferramentas.map(f => (
                  <span key={f} className="flex items-center gap-1 px-2 py-0.5 bg-orange-50 text-orange-700 border border-orange-200 rounded-full text-xs">
                    {f}
                    <button onClick={() => setFerramentas(prev => prev.filter(x => x !== f))} className="text-orange-400 hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Section>

          {/* ── BOTH ROLES: Tarefas ── */}
          <Section title="Tarefas" icon={<CheckCircle2 size={13} className="text-gray-400" />}
            badge={totalTarefas > 0 ? `${tarefasConcluidas}/${totalTarefas}` : undefined}>
            {tarefasOS.length > 0 && (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {tarefasOS.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-sm border border-gray-100">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.status === 'concluida' ? 'bg-green-500' : t.status === 'em_andamento' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span className={`flex-1 text-sm ${t.status === 'concluida' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.descricao}</span>
                    {isGestor && (
                      <button onClick={() => removeTarefa(t.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input value={novaTarefa} onChange={e => setNovaTarefa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarTarefa()}
                placeholder="Nova tarefa..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300" />
              <button onClick={adicionarTarefa} disabled={!novaTarefa.trim()}
                className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
                <Plus size={14} />
              </button>
            </div>
          </Section>

          {/* ── Technician readonly info ── */}
          {!isGestor && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-blue-700">Informações da O.S. (somente leitura)</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div><span className="font-medium">Título:</span> {task.title}</div>
                <div><span className="font-medium">Status:</span> {task.status}</div>
                <div><span className="font-medium">Cliente:</span> {(task as any).clientName || '—'}</div>
                <div><span className="font-medium">Prioridade:</span> {task.priority}</div>
              </div>
            </div>
          )}

          {/* ── GESTOR: Reagendamento ── */}
          {isGestor && (
            <div className="border border-orange-200 rounded-xl overflow-hidden">
              <button type="button" onClick={() => setShowReagendar(!showReagendar)}
                className="w-full flex items-center gap-2 px-4 py-3 bg-orange-50/80 hover:bg-orange-100/80 transition-colors">
                <RefreshCw size={13} className="text-orange-500" />
                <span className="text-xs font-bold text-orange-700 uppercase tracking-wide flex-1 text-left">Reagendar O.S.</span>
                {showReagendar ? <ChevronUp size={13} className="text-orange-400" /> : <ChevronDown size={13} className="text-orange-400" />}
              </button>
              {showReagendar && (
                <div className="px-4 py-3 space-y-3 bg-orange-50/30">
                  <p className="text-[10px] text-orange-600">
                    Ao reagendar, esta O.S. será finalizada e uma nova será criada com vínculo à original.
                  </p>
                  <div>
                    <label className="text-xs text-orange-700 font-bold block mb-1">Motivo *</label>
                    <select value={reagendamentoMotivo} onChange={e => setReagendamentoMotivo(e.target.value)}
                      className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200">
                      {REAGENDAMENTO_MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  {reagendamentoMotivo === 'Outro' && (
                    <div>
                      <label className="text-xs text-orange-700 font-bold block mb-1">Especifique o motivo</label>
                      <input value={reagendamentoOutro} onChange={e => setReagendamentoOutro(e.target.value)}
                        className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-orange-700 font-bold block mb-1">Nova Data Prevista *</label>
                    <input type="datetime-local" value={reagendamentoData} onChange={e => setReagendamentoData(e.target.value)}
                      className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />
                  </div>
                  <div>
                    <label className="text-xs text-orange-700 font-bold block mb-1">Descrição complementar</label>
                    <textarea value={reagendamentoDesc} onChange={e => setReagendamentoDesc(e.target.value)} rows={2}
                      placeholder="Observações sobre o reagendamento..."
                      className="w-full border border-orange-200 rounded-xl px-3 py-2 text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-orange-200" />
                  </div>
                  <button onClick={handleReagendar}
                    disabled={reagendando || !reagendamentoData || (reagendamentoMotivo === 'Outro' && !reagendamentoOutro.trim())}
                    className="w-full py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center gap-2">
                    {reagendando ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Confirmar Reagendamento
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Arquivar ── */}
          {isGestor && (
            <div className="flex gap-2">
              {!(task as any).archived ? (
                <button onClick={arquivar} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-300 text-gray-600 text-sm font-bold hover:bg-gray-50 disabled:opacity-50">
                  <Archive size={14} /> Arquivar O.S.
                </button>
              ) : (
                <button onClick={desarquivar} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-green-300 text-green-700 text-sm font-bold hover:bg-green-50 disabled:opacity-50">
                  <Package size={14} /> Desarquivar O.S.
                </button>
              )}
            </div>
          )}

          {/* ── ZONA DE PERIGO ── */}
          {canDelete && (
            <div className="mt-4 border-2 border-red-300 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-red-50 border-b border-red-200">
                <h4 className="text-xs font-extrabold text-red-700 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertTriangle size={13} /> Zona de Perigo
                </h4>
                <p className="text-[10px] text-red-500 mt-0.5">
                  Esta ação é irreversível. A O.S. será excluída permanentemente e não poderá ser recuperada.
                </p>
              </div>
              <div className="px-4 py-3 bg-red-50/50">
                <button onClick={excluir} disabled={deleting}
                  className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Excluir O.S. Permanentemente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end bg-white flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving || (isGestor && !titulo.trim())}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

export default OSEditModal;

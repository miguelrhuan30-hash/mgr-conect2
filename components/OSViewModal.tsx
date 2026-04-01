/**
 * components/OSViewModal.tsx — Sprint 46
 *
 * Visualização completa de uma O.S. acessível ao clicar qualquer card.
 *
 * Modos:
 *  • Gestor/Admin → leitura + botão [✏️ Editar] que abre OSEditModal
 *  • Técnico      → modo execução: check-in GPS, tarefas editáveis,
 *                   fotos de evidência (PhotoAnnotator), finalizar O.S.
 */
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate }  from 'react-router-dom';
import {
  doc, getDoc, updateDoc, serverTimestamp, arrayUnion, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Task, CollectionName, OSItemTarefa, OSObservacao, WorkflowStatus as WS,
} from '../types';
import {
  X, Edit2, Printer, CheckCircle2, Circle, Clock, MapPin, User,
  Wrench, ClipboardList, Camera, MessageSquare, ChevronDown, ChevronUp,
  AlertTriangle, Loader2, Plus, Navigation, CheckSquare, Square,
} from 'lucide-react';

const OSEditModal    = lazy(() => import('./OSEditModal'));
const OSSuporteChat  = lazy(() => import('./OSSuporteChat'));

// ── helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  'pending':        { label: 'Pendente',      cls: 'bg-yellow-100 text-yellow-800' },
  'in-progress':    { label: 'Em execução',   cls: 'bg-blue-100   text-blue-800'   },
  'completed':      { label: 'Concluída',     cls: 'bg-green-100  text-green-800'  },
  'blocked':        { label: 'Bloqueada',     cls: 'bg-red-100    text-red-800'    },
  'cancelled':      { label: 'Cancelada',     cls: 'bg-gray-100   text-gray-600'   },
  'reagendar':      { label: 'Reagendar',     cls: 'bg-orange-100 text-orange-800' },
};

const PRIO_LABELS: Record<string, { label: string; cls: string }> = {
  low:      { label: 'Baixa',  cls: 'bg-gray-100 text-gray-600'    },
  medium:   { label: 'Média',  cls: 'bg-amber-100 text-amber-700'  },
  high:     { label: 'Alta',   cls: 'bg-red-100 text-red-700'      },
  urgent:   { label: 'Urgente',cls: 'bg-red-600 text-white'        },
};

const fmtDate = (ts?: Timestamp | null) =>
  ts ? new Date(ts.toMillis()).toLocaleDateString('pt-BR') : '—';

// ── Checklist tarefa row ──────────────────────────────────────────────────────
interface TarefaRowProps {
  tarefa: OSItemTarefa;
  isTechExec: boolean;
  onToggle: (id: string) => void;
  onOpenFoto: (tarefaId: string) => void;
}
const TarefaRow: React.FC<TarefaRowProps> = ({ tarefa, isTechExec, onToggle, onOpenFoto }) => {
  const done = tarefa.status === 'concluida';
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${done ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <button
        onClick={() => isTechExec && onToggle(tarefa.id)}
        className={`flex-shrink-0 ${isTechExec ? 'cursor-pointer' : 'cursor-default'}`}
      >
        {done
          ? <CheckSquare size={20} className="text-green-600" />
          : <Square      size={20} className="text-gray-400"  />
        }
      </button>
      <span className={`flex-1 text-sm ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {tarefa.descricao}
      </span>
      {isTechExec && (
        <button
          onClick={() => onOpenFoto(tarefa.id)}
          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"
          title="Fotos de evidência"
        >
          <Camera size={14} />
        </button>
      )}
      {tarefa.concluidaEm && (
        <span className="text-[10px] text-gray-400">{fmtDate(tarefa.concluidaEm as Timestamp)}</span>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
interface OSViewModalProps {
  taskId: string;
  onClose: () => void;
}

const OSViewModal: React.FC<OSViewModalProps> = ({ taskId, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [task, setTask]             = useState<Task | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [showEdit, setShowEdit]     = useState(false);
  const [showChat, setShowChat]     = useState(false);
  const [showObs, setShowObs]       = useState(false);
  const [novaObs, setNovaObs]       = useState('');
  const [addingObs, setAddingObs]   = useState(false);
  const [addingTarefa, setAddingTarefa] = useState(false);
  const [novaTarefa, setNovaTarefa] = useState('');

  const isGestor = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');
  const isTech   = !isGestor && ['technician', 'tecnico', 'employee'].includes(userProfile?.role || '');
  // Technician sees execution mode (check-in already done OR is their task)
  const isTechExec = isTech;

  // ── Load task ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, CollectionName.TASKS, taskId));
        if (snap.exists()) setTask({ id: snap.id, ...snap.data() } as Task);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [taskId]);

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-10 flex flex-col items-center gap-3">
        <Loader2 className="animate-spin w-8 h-8 text-brand-600" />
        <p className="text-sm text-gray-500">Carregando O.S...</p>
      </div>
    </div>
  );

  if (!task) return null;

  // ── Derived ───────────────────────────────────────────────────────────────
  const tarefasOS: OSItemTarefa[] = (task as any).tarefasOS || [];
  const observacoes: OSObservacao[] = (task as any).observacoes || [];
  const statusInfo  = STATUS_LABELS[task.status] ?? { label: task.status, cls: 'bg-gray-100 text-gray-600' };
  const prioInfo    = PRIO_LABELS[task.priority  ?? 'medium'];
  const checkinFeito = (task as any).checkinOS?.feito === true;

  // ── Actions ───────────────────────────────────────────────────────────────
  const toggleTarefa = async (id: string) => {
    if (!task || !currentUser) return;
    setSaving(true);
    try {
      const updated = tarefasOS.map(t =>
        t.id === id
          ? { ...t,
              status: t.status === 'concluida' ? 'pendente' : 'concluida',
              concluidaEm: t.status !== 'concluida' ? Timestamp.now() : null,
              executorId: currentUser.uid,
            } as OSItemTarefa
          : t
      );
      await updateDoc(doc(db, CollectionName.TASKS, taskId), { tarefasOS: updated, updatedAt: serverTimestamp() });
      setTask(prev => prev ? { ...prev, tarefasOS: updated } as Task : prev);
    } finally {
      setSaving(false);
    }
  };

  const adicionarObservacao = async () => {
    if (!novaObs.trim() || !currentUser) return;
    setAddingObs(true);
    const obs: OSObservacao = {
      id: `obs_${Date.now()}`,
      texto: novaObs.trim(),
      autorId: currentUser.uid,
      autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
      autorRole: userProfile?.role || 'employee',
      criadaEm: Timestamp.now(),
    };
    try {
      await updateDoc(doc(db, CollectionName.TASKS, taskId), {
        observacoes: arrayUnion(obs),
        updatedAt: serverTimestamp(),
      });
      setTask(prev => prev ? { ...prev, observacoes: [...observacoes, obs] } as Task : prev);
      setNovaObs('');
    } finally {
      setAddingObs(false);
    }
  };

  const adicionarTarefa = async () => {
    if (!novaTarefa.trim() || !currentUser) return;
    setAddingTarefa(true);
    const nova: OSItemTarefa = {
      id: `tarefa_${Date.now()}`,
      descricao: novaTarefa.trim(),
      status: 'pendente',
      fotoSlots: [
        { id: 'antes', titulo: 'Foto Antes', instrucao: 'Tire uma foto antes de iniciar', obrigatoria: true, ordem: 0 },
        { id: 'depois', titulo: 'Foto Depois', instrucao: 'Tire uma foto após concluir', obrigatoria: true, ordem: 1 },
      ],
      fotosEvidencia: [],
    };
    try {
      await updateDoc(doc(db, CollectionName.TASKS, taskId), {
        tarefasOS: arrayUnion(nova),
        updatedAt: serverTimestamp(),
      });
      setTask(prev => prev ? { ...prev, tarefasOS: [...tarefasOS, nova] } as Task : prev);
      setNovaTarefa('');
    } finally {
      setAddingTarefa(false);
    }
  };

  const iniciarCheckin = () => {
    // Navigate to OS execution for check-in (reuses existing logic)
    navigate(`/app/execucao/${taskId}`);
    onClose();
  };

  const finalizarOS = () => {
    navigate(`/app/execucao/${taskId}#finalizar`);
    onClose();
  };

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div className="bg-gray-50 w-full sm:max-w-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
          style={{ height: '95vh', maxHeight: 820 }}>

          {/* ── Header ── */}
          <div className={`px-5 py-4 flex items-start gap-3 border-b border-gray-200
            ${isTechExec ? 'bg-gradient-to-r from-blue-600 to-blue-700' : 'bg-white'}`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isTechExec ? 'bg-blue-400/30 text-white' : statusInfo.cls}`}>
                  {isTechExec ? '⚡ MODO EXECUÇÃO' : statusInfo.label}
                </span>
                {!isTechExec && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prioInfo.cls}`}>
                    {prioInfo.label}
                  </span>
                )}
              </div>
              <h2 className={`text-lg font-extrabold mt-1 leading-tight ${isTechExec ? 'text-white' : 'text-gray-900'}`}>
                {task.title}
              </h2>
              <p className={`text-xs mt-0.5 ${isTechExec ? 'text-blue-100' : 'text-gray-500'}`}>
                {task.clientName || '—'} {(task as any).ativoNome ? `• ${(task as any).ativoNome}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {isGestor && (
                <>
                  <button
                    onClick={() => setShowEdit(true)}
                    className="p-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-600 transition-colors"
                    title="Editar O.S."
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => navigate(`/app/os/${taskId}/print`)}
                    className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors"
                    title="Imprimir O.S."
                  >
                    <Printer size={16} />
                  </button>
                </>
              )}
              <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isTechExec ? 'hover:bg-blue-500 text-white' : 'hover:bg-gray-100 text-gray-500'}`}>
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto space-y-3 p-4">

            {/* Tech: Check-in banner */}
            {isTechExec && !checkinFeito && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                <Navigation size={22} className="text-amber-600 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-amber-800">Check-in necessário</p>
                  <p className="text-xs text-amber-600">Verifique sua localização para iniciar a O.S.</p>
                </div>
                <button onClick={iniciarCheckin} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600">
                  Verificar GPS
                </button>
              </div>
            )}

            {/* Dados gerais (Gestor view) */}
            {isGestor && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList size={13} /> Dados Gerais
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-gray-400 text-xs">Status</span><p className="font-medium">{statusInfo.label}</p></div>
                  <div><span className="text-gray-400 text-xs">Prioridade</span><p className="font-medium">{prioInfo.label}</p></div>
                  <div><span className="text-gray-400 text-xs">Tipo serviço</span><p className="font-medium">{(task as any).tipoServico || '—'}</p></div>
                  <div><span className="text-gray-400 text-xs">Agendada</span><p className="font-medium">{fmtDate((task as any).scheduling?.dataPrevista)}</p></div>
                  {task.assigneeName && <div><span className="text-gray-400 text-xs">Técnico</span><p className="font-medium">{task.assigneeName}</p></div>}
                  {(task as any).ativoNome && <div><span className="text-gray-400 text-xs">Ativo</span><p className="font-medium">{(task as any).ativoNome}</p></div>}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 border-t border-gray-100 pt-2">{task.description}</p>
                )}
              </div>
            )}

            {/* Tarefas */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 size={13} /> Tarefas
                  <span className="ml-1 text-gray-400 font-normal">
                    ({tarefasOS.filter(t => t.status === 'concluida').length}/{tarefasOS.length})
                  </span>
                </h3>
              </div>

              {tarefasOS.length === 0 && (
                <p className="text-xs text-gray-400 py-2">Nenhuma tarefa cadastrada.</p>
              )}

              <div className="space-y-1.5">
                {tarefasOS.map(t => (
                  <TarefaRow
                    key={t.id}
                    tarefa={t}
                    isTechExec={isTechExec}
                    onToggle={toggleTarefa}
                    onOpenFoto={(tarefaId) => navigate(`/app/execucao/${taskId}#tarefa-${tarefaId}`)}
                  />
                ))}
              </div>

              {/* Technician: add task */}
              {isTechExec && (
                <div className="pt-1">
                  <div className="flex gap-2">
                    <input
                      value={novaTarefa}
                      onChange={e => setNovaTarefa(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && adicionarTarefa()}
                      placeholder="Adicionar tarefa extra..."
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button
                      onClick={adicionarTarefa}
                      disabled={!novaTarefa.trim() || addingTarefa}
                      className="p-2 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                    >
                      {addingTarefa ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Ferramentas */}
            {((task as any).ferramentasUtilizadas || []).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Wrench size={13} /> Ferramentas
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {((task as any).ferramentasUtilizadas || []).map((f: string) => (
                    <span key={f} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">{f}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Observações */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <button
                onClick={() => setShowObs(!showObs)}
                className="w-full flex items-center justify-between"
              >
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={13} /> Observações ({observacoes.length})
                </h3>
                {showObs ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>
              {showObs && (
                <div className="mt-3 space-y-2">
                  {observacoes.map(o => (
                    <div key={o.id} className="bg-gray-50 rounded-xl p-3">
                      <p className="text-sm text-gray-800">{o.texto}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{o.autorNome} · {fmtDate(o.criadaEm)}</p>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <textarea
                      value={novaObs}
                      onChange={e => setNovaObs(e.target.value)}
                      rows={2}
                      placeholder="Adicionar observação..."
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button
                      onClick={adicionarObservacao}
                      disabled={!novaObs.trim() || addingObs}
                      className="p-2 self-end rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                    >
                      {addingObs ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Finalizacao (Gestor: read only) */}
            {isGestor && (task as any).finalizacaoRespostas?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <CheckCircle2 size={13} /> Questionário de Finalização
                </h3>
                <div className="space-y-2">
                  {((task as any).finalizacaoRespostas || []).map((r: any, i: number) => (
                    <div key={i} className="text-sm">
                      <p className="text-gray-500 text-xs">{r.perguntaTexto}</p>
                      <p className="text-gray-800 font-medium">{String(r.resposta)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>{/* end scrollable */}

          {/* ── Footer actions ── */}
          <div className="px-4 py-3 bg-white border-t border-gray-200 flex gap-2">
            {isTechExec ? (
              <>
                {/* Suporte chat FAB */}
                <button
                  onClick={() => setShowChat(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-sm font-bold hover:bg-purple-100"
                >
                  <MessageSquare size={14} /> Suporte
                </button>
                <div className="flex-1" />
                <button
                  onClick={finalizarOS}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 shadow"
                >
                  <CheckCircle2 size={16} /> Finalizar O.S.
                </button>
              </>
            ) : (
              <>
                <div className="flex-1" />
                <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                  Fechar
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* OSEditModal */}
      {showEdit && task && (
        <Suspense fallback={null}>
          <OSEditModal
            task={task}
            onClose={() => setShowEdit(false)}
            onSaved={(updated: Task) => { setTask(updated); setShowEdit(false); }}
          />
        </Suspense>
      )}

      {/* OSSuporteChat */}
      {showChat && task && (
        <Suspense fallback={null}>
          <OSSuporteChat task={task} onClose={() => setShowChat(false)} />
        </Suspense>
      )}
    </>
  );
};

export default OSViewModal;

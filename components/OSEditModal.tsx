/**
 * components/OSEditModal.tsx — Sprint 46 (Full Rewrite)
 *
 * Edição completa de O.S. com níveis de acesso:
 *  • Gestor/Admin: todos os campos (cliente, responsável, datas, prioridade, status, tarefas, etc.)
 *  • Técnico: apenas ferramentas usadas e tarefas extras (leitura dos demais)
 */
import React, { useState, useEffect } from 'react';
import {
  doc, updateDoc, serverTimestamp, Timestamp, getDocs,
  collection, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task, CollectionName, OSEdicao, PriorityLevel } from '../types';
import {
  X, Save, Loader2, ChevronDown, Plus, Trash2, AlertCircle,
  Building, User, Calendar, Wrench, ClipboardList, Package,
} from 'lucide-react';

interface OSEditModalProps {
  task: Task;
  onClose: () => void;
  onSaved: (updated: Task) => void;
}

const PRIORIDADES = [
  { value: 'low',    label: 'Baixa'   },
  { value: 'medium', label: 'Média'   },
  { value: 'high',   label: 'Alta'    },
  { value: 'urgent', label: 'Urgente' },
];

const STATUS_LIST = [
  { value: 'pending',     label: 'Pendente'     },
  { value: 'in-progress', label: 'Em execução'  },
  { value: 'completed',   label: 'Concluída'    },
  { value: 'blocked',     label: 'Bloqueada'    },
  { value: 'cancelled',   label: 'Cancelada'    },
];

// Inline toggle
const Toggle: React.FC<{ on: boolean; onChange: () => void; label: string }> = ({ on, onChange, label }) => (
  <label className="flex items-center gap-2 cursor-pointer">
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${on ? 'bg-brand-600' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
    <span className="text-xs text-gray-700">{label}</span>
  </label>
);

const OSEditModal: React.FC<OSEditModalProps> = ({ task, onClose, onSaved }) => {
  const { currentUser, userProfile } = useAuth();
  const isGestor = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  // ── Data sources ────────────────────────────────────────────────────────────
  const [clients,  setClients]  = useState<any[]>([]);
  const [users,    setUsers]    = useState<any[]>([]);
  const [ativos,   setAtivos]   = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // ── Gestor-only fields ──────────────────────────────────────────────────────
  const [titulo,        setTitulo]        = useState(task.title);
  const [descricao,     setDescricao]     = useState(task.description || '');
  const [status,        setStatus]        = useState(task.status);
  const [prioridade,    setPrioridade]    = useState<PriorityLevel>(task.priority || 'medium');
  const [tipoServico,   setTipoServico]   = useState((task as any).tipoServico || '');
  const [clientId,      setClientId]      = useState((task as any).clientId || '');
  const [clientName,    setClientName]    = useState((task as any).clientName || '');
  const [assigneeId,    setAssigneeId]    = useState((task as any).assigneeId || '');
  const [assigneeName,  setAssigneeName]  = useState((task as any).assigneeName || '');
  const [ativoId,       setAtivoId]       = useState((task as any).ativoId || '');
  const [ativoNome,     setAtivoNome]     = useState((task as any).ativoNome || '');
  const [startDate,     setStartDate]     = useState(() => {
    const d = (task as any)?.scheduling?.dataInicio;
    return d ? new Date(d.toMillis()).toISOString().slice(0, 10) : '';
  });
  const [endDate,       setEndDate]       = useState(() => {
    const d = (task as any)?.scheduling?.dataPrevista;
    return d ? new Date(d.toMillis()).toISOString().slice(0, 10) : '';
  });

  // ── Both roles ──────────────────────────────────────────────────────────────
  const [ferramenta,   setFerramenta]   = useState('');
  const [ferramentas,  setFerramentas]  = useState<string[]>((task as any).ferramentasUtilizadas || []);
  const [novaTarefa,   setNovaTarefa]   = useState('');
  const [tarefasOS,    setTarefasOS]    = useState<any[]>((task as any).tarefasOS || []);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  // ── Load selects ─────────────────────────────────────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────────────────────
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

  // ── Save ─────────────────────────────────────────────────────────────────────
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
        if (tipoServico !== (task as any).tipoServico) patch.tipoServico = tipoServico;
        if (clientId    !== (task as any).clientId) {
          patch.clientId   = clientId;
          patch.clientName = clientName;
        }
        if (assigneeId  !== (task as any).assigneeId) {
          patch.assigneeId   = assigneeId;
          patch.assigneeName = assigneeName;
        }
        if (ativoId !== (task as any).ativoId) {
          patch.ativoId   = ativoId;
          patch.ativoNome = ativoNome;
        }
        // Scheduling dates
        const scheduling: any = { ...((task as any).scheduling || {}) };
        if (startDate) scheduling.dataInicio    = Timestamp.fromDate(new Date(startDate));
        if (endDate)   scheduling.dataPrevista  = Timestamp.fromDate(new Date(endDate));
        if (startDate || endDate) patch.scheduling = scheduling;
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

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '94vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900 text-sm">
              ✏️ Editar O.S. — {task.title.slice(0, 40)}{task.title.length > 40 ? '…' : ''}
            </h3>
            {!isGestor && (
              <p className="text-[10px] text-amber-600 mt-0.5">Modo técnico — apenas ferramentas e tarefas extras</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* ── GESTOR ONLY ── */}
          {isGestor && (
            <>
              {/* Título e Descrição */}
              <div className="space-y-3">
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
              </div>

              {/* Status e Prioridade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Status</label>
                  <div className="relative">
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8"
                    >
                      {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Prioridade</label>
                  <div className="relative">
                    <select
                      value={prioridade}
                      onChange={e => setPrioridade(e.target.value as PriorityLevel)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8"
                    >
                      {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Tipo de Serviço */}
              <div>
                <label className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-1">Tipo de Serviço</label>
                <input
                  value={tipoServico}
                  onChange={e => setTipoServico(e.target.value)}
                  placeholder="Ex: Manutenção preventiva, Instalação..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                />
              </div>

              {/* Cliente e Ativo */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Building size={12} /> Cliente & Ativo</p>
                {loadingData ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-brand-500" /></div>
                ) : (
                  <>
                    <div className="relative">
                      <select
                        value={clientId}
                        onChange={e => {
                          const c = clients.find(x => x.id === e.target.value);
                          setClientId(e.target.value);
                          setClientName(c?.name || c?.nome || '');
                          setAtivoId(''); setAtivoNome('');
                        }}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8"
                      >
                        <option value="">Selecione o cliente...</option>
                        {clients.map(c => <option key={c.id} value={c.id}>{c.name || c.nome}</option>)}
                      </select>
                      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
                    {ativos.length > 0 && (
                      <div className="relative">
                        <select
                          value={ativoId}
                          onChange={e => {
                            const a = ativos.find(x => x.id === e.target.value);
                            setAtivoId(e.target.value); setAtivoNome(a?.nome || '');
                          }}
                          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8"
                        >
                          <option value="">Selecione o ativo (opcional)...</option>
                          {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                        </select>
                        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Responsável */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><User size={12} /> Responsável</p>
                {loadingData ? (
                  <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin text-brand-500" /></div>
                ) : (
                  <div className="relative">
                    <select
                      value={assigneeId}
                      onChange={e => {
                        const u = users.find(x => x.id === e.target.value || x.uid === e.target.value);
                        setAssigneeId(e.target.value);
                        setAssigneeName(u?.displayName || u?.name || '');
                      }}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-brand-200 pr-8"
                    >
                      <option value="">Nenhum responsável</option>
                      {users.map(u => <option key={u.id || u.uid} value={u.id || u.uid}>{u.displayName || u.name}</option>)}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                )}
              </div>

              {/* Datas */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5"><Calendar size={12} /> Agendamento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Data Início</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-400 block mb-1">Prazo Previsto</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── BOTH ROLES ── */}

          {/* Ferramentas */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wide flex items-center gap-1.5"><Wrench size={11} /> Ferramentas</label>
            <div className="flex gap-2">
              <input
                value={ferramenta}
                onChange={e => setFerramenta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarFerramenta()}
                placeholder="Digitar e pressionar Enter..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
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
          </div>

          {/* Tarefas */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-bold uppercase tracking-wide flex items-center gap-1.5"><ClipboardList size={11} /> Tarefas</label>
            {tarefasOS.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {tarefasOS.map((t: any) => (
                  <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 text-sm border border-gray-100">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'concluida' ? 'bg-green-500' : t.status === 'em_andamento' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                    <span className="flex-1 text-gray-800 text-sm">{t.descricao}</span>
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
              <input
                value={novaTarefa}
                onChange={e => setNovaTarefa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarTarefa()}
                placeholder="Nova tarefa..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
              <button onClick={adicionarTarefa} disabled={!novaTarefa.trim()} className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Info readonly for technician */}
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
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end bg-white">
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

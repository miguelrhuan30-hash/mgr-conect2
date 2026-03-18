/**
 * components/OSEditModal.tsx — Sprint 46
 *
 * Modal de edição de O.S. com niveis de acesso:
 *  • Gestor/Admin: todos os campos
 *  • Técnico: apenas observações, tarefas extras, ferramentas
 */
import React, { useState } from 'react';
import {
  doc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task, CollectionName, OSEdicao, PriorityLevel } from '../types';
import {
  X, Save, Loader2, ChevronDown, Plus, Trash2, AlertCircle,
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

const OSEditModal: React.FC<OSEditModalProps> = ({ task, onClose, onSaved }) => {
  const { currentUser, userProfile } = useAuth();
  const isGestor = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  // ── field state ───────────────────────────────────────────────────────────
  const [titulo,       setTitulo]       = useState(task.title);
  const [descricao,    setDescricao]    = useState(task.description || '');
  const [status,       setStatus]       = useState(task.status);
  const [prioridade,   setPrioridade]   = useState(task.priority || 'medium');
  const [tipoServico,  setTipoServico]  = useState((task as any).tipoServico || '');
  const [ferramenta,   setFerramenta]   = useState('');
  const [ferramentas,  setFerramentas]  = useState<string[]>((task as any).ferramentasUtilizadas || []);
  const [novaTarefa,   setNovaTarefa]   = useState('');
  const [tarefasOS,    setTarefasOS]    = useState<any[]>((task as any).tarefasOS || []);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState('');

  // ── helpers ───────────────────────────────────────────────────────────────
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

  const removeTarefa = (id: string) =>
    setTarefasOS(prev => prev.filter(t => t.id !== id));

  // ── save ─────────────────────────────────────────────────────────────────
  const salvar = async () => {
    if (!currentUser) return;
    setSaving(true);
    setError('');
    try {
      const agora = Timestamp.now();

      // Build audit trail entry
      const edicao: OSEdicao = {
        campo: 'edição_geral',
        valorAnterior: task.title,
        valorNovo: titulo,
        editadoPor: currentUser.uid,
        editadoPorNome: userProfile?.displayName || currentUser.email || 'Usuário',
        editadoEm: agora,
        viaDados: 'sistema',
      };

      // Build patch object based on role
      const patch: Record<string, any> = {
        updatedAt: serverTimestamp(),
        edicoes: [...((task as any).edicoes || []), edicao],
      };

      if (isGestor) {
        if (titulo !== task.title)           patch.title = titulo;
        if (descricao !== task.description)  patch.description = descricao;
        if (status !== task.status)          patch.status = status;
        if (prioridade !== task.priority)    patch.priority = prioridade;
        if (tipoServico !== (task as any).tipoServico) patch.tipoServico = tipoServico;
      }

      // Both roles can update these
      patch.ferramentasUtilizadas = ferramentas;
      patch.tarefasOS = tarefasOS;

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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">
            ✏️ Editar O.S. — {task.title.slice(0, 35)}{task.title.length > 35 ? '…' : ''}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Gestor-only fields */}
          {isGestor && (
            <>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-semibold">Título</label>
                <input
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-semibold">Descrição</label>
                <textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-semibold">Status</label>
                  <div className="relative">
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as any)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-300 pr-8"
                    >
                      {STATUS_LIST.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-500 font-semibold">Prioridade</label>
                  <div className="relative">
                    <select
                      value={prioridade}
                      onChange={e => setPrioridade(e.target.value as PriorityLevel)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-300 pr-8"
                    >
                      {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-gray-500 font-semibold">Tipo de Serviço</label>
                <input
                  value={tipoServico}
                  onChange={e => setTipoServico(e.target.value)}
                  placeholder="Ex: Manutenção preventiva, Instalação..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </>
          )}

          {/* Ferramentas (both roles) */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-semibold">Ferramentas Necessárias</label>
            <div className="flex gap-2">
              <input
                value={ferramenta}
                onChange={e => setFerramenta(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarFerramenta()}
                placeholder="Digite e pressione Enter..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-300"
              />
              <button onClick={adicionarFerramenta} className="p-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700">
                <Plus size={14} />
              </button>
            </div>
            {ferramentas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {ferramentas.map(f => (
                  <span key={f} className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs">
                    {f}
                    <button onClick={() => setFerramentas(prev => prev.filter(x => x !== f))} className="text-gray-400 hover:text-red-500">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Tarefas — add new */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 font-semibold">Tarefas</label>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {tarefasOS.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 text-sm">
                  <span className="flex-1 text-gray-800">{t.descricao}</span>
                  {isGestor && (
                    <button onClick={() => removeTarefa(t.id)} className="text-gray-300 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
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
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={salvar}
            disabled={saving || !titulo.trim()}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

export default OSEditModal;

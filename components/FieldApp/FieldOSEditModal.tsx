/**
 * FieldOSEditModal — tela de edição completa de uma O.S.
 * Idêntica ao formulário "Nova O.S." mas pré-preenchida e usa updateDoc.
 */
import React, { useState, useEffect } from 'react';
import {
  doc, updateDoc, collection, getDocs, query, where, Timestamp, addDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName } from '../../types';
import { registrarAtividade } from '../../services/activityFeedService';
import { OSField } from './FieldOS';
import {
  X, Save, Loader2, User, Users, Building, Briefcase, Tag,
  Calendar, ListTodo, Plus, Trash2, CheckCircle2,
} from 'lucide-react';

interface Props {
  os: OSField;
  onClose: () => void;
  onSaved: (updates: Partial<OSField> & Record<string, any>) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'baixa',   label: 'Baixa',   cls: 'border-emerald-500 bg-emerald-500/10 text-emerald-400' },
  { value: 'media',   label: 'Média',   cls: 'border-yellow-500 bg-yellow-500/10 text-yellow-400'   },
  { value: 'alta',    label: 'Alta',    cls: 'border-red-500 bg-red-500/10 text-red-400'            },
  { value: 'critica', label: 'Crítica', cls: 'border-red-700 bg-red-700/20 text-red-300'            },
];

const tsToLocal = (ts: any): string => {
  if (!ts) return '';
  const d = (ts as Timestamp).toDate?.() ?? new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export default function FieldOSEditModal({ os, onClose, onSaved }: Props) {
  const { currentUser, userProfile } = useAuth();
  const raw = os as any;

  /* ── form state (pré-preenchido) ─────────────────────────────────── */
  const [title,        setTitle]       = useState(os.title ?? '');
  const [description,  setDescription] = useState(os.description ?? '');
  const [priority,     setPriority]    = useState(os.priority ?? 'media');
  const [clientId,     setClientId]    = useState(raw.clientId ?? '');
  const [projectId,    setProjectId]   = useState(raw.projectId ?? '');
  const [tipoServico,  setTipoServico] = useState(os.tipoServico ?? '');
  const [assigneeId,   setAssigneeId]  = useState(os.assignedTo ?? '');
  const [assignedUsers,setAssignedUsers] = useState<string[]>(os.assignedUsers ?? []);
  const [startDate,    setStartDate]   = useState(tsToLocal(os.startDate));
  const [endDate,      setEndDate]     = useState(tsToLocal(raw.endDate));

  /* tarefas */
  interface TarefaEdit { id: string; descricao: string; status: string; fotoSlots?: any[]; iniciadaEm?: any; concluidaEm?: any; }
  const initTarefas = (): TarefaEdit[] =>
    (raw.tarefasOS ?? []).map((t: any) => ({ ...t }));
  const [tarefas,      setTarefas]     = useState<TarefaEdit[]>(initTarefas);
  const [novaTarefa,   setNovaTarefa]  = useState('');

  /* data sources */
  const [clients,  setClients]  = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users,    setUsers]    = useState<any[]>([]);
  const [tipoSugestoes, setTipoSugestoes] = useState<string[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  /* ── carga inicial ───────────────────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [cSnap, uSnap] = await Promise.all([
          getDocs(collection(db, CollectionName.CLIENTS)),
          getDocs(collection(db, CollectionName.USERS)),
        ]);
        setClients(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setUsers(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const [p2, p1] = await Promise.all([
          getDocs(collection(db, CollectionName.PROJECTS_V2)).catch(() => null),
          getDocs(collection(db, CollectionName.PROJECTS)).catch(() => null),
        ]);
        const seen = new Set<string>();
        const all: any[] = [];
        [...(p2?.docs ?? []), ...(p1?.docs ?? [])].forEach(d => {
          if (!seen.has(d.id)) { seen.add(d.id); all.push({ id: d.id, name: d.data().nome || d.data().name, ...d.data() }); }
        });
        setProjects(all);
      } catch (e) { console.error('[FieldOSEditModal] load:', e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  /* ativos quando cliente muda */
  const [ativos, setAtivos] = useState<any[]>([]);
  useEffect(() => {
    if (!clientId) { setAtivos([]); return; }
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(s => setAtivos(s.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  /* autocomplete tipo */
  const buscarTipos = async (val: string) => {
    if (!val.trim()) { setTipoSugestoes([]); return; }
    try {
      const snap = await getDocs(collection(db, CollectionName.SERVICE_TYPES));
      const all = snap.docs.map(d => (d.data() as any).nome as string);
      setTipoSugestoes(all.filter(n => n.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
    } catch { setTipoSugestoes([]); }
  };

  /* ── helpers tarefas ─────────────────────────────────────────────── */
  const addTarefa = () => {
    if (!novaTarefa.trim()) return;
    setTarefas(prev => [...prev, {
      id: `edit_${Date.now()}`,
      descricao: novaTarefa.trim(),
      status: 'pendente',
      fotoSlots: [
        { id: `slot_antes_${Date.now()}`, titulo: 'Antes',  descricao: 'Foto antes',  obrigatoria: true, ordem: 0 },
        { id: `slot_dep_${Date.now()}`,   titulo: 'Depois', descricao: 'Foto depois', obrigatoria: true, ordem: 1 },
      ],
    }]);
    setNovaTarefa('');
  };

  const removeTarefa = (id: string) =>
    setTarefas(prev => prev.filter(t => t.id !== id));

  /* ── colaboradores toggle ────────────────────────────────────────── */
  const toggleColab = (uid: string) =>
    setAssignedUsers(prev =>
      prev.includes(uid) ? prev.filter(u => u !== uid) : [...prev, uid]
    );

  /* ── salvar ──────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!title.trim()) { alert('O título é obrigatório.'); return; }
    setSaving(true);
    try {
      const clientName    = clients.find(c => c.id === clientId)?.name ?? (raw.clientName ?? '');
      const projectName   = projects.find(p => p.id === projectId)?.name ?? (raw.projectName ?? '');
      const assigneeUser  = users.find(u => u.id === assigneeId);
      const assigneeName  = assigneeUser
        ? (assigneeUser.nomeCompleto || assigneeUser.displayName || assigneeUser.email)
        : null;
      const assignedUserNames = assignedUsers.map(uid => {
        const u = users.find(x => x.id === uid);
        return u ? (u.nomeCompleto || u.displayName || u.email || uid) : uid;
      });

      const updates: Record<string, any> = {
        title:              title.trim(),
        description:        description.trim(),
        priority,
        clientId:           clientId || null,
        clientName,
        projectId:          projectId || null,
        projectName,
        tipoServico:        tipoServico.trim() || null,
        assignedTo:         assigneeId || null,
        assigneeName:       assigneeId ? assigneeName : null,
        assignedUsers,
        assignedUserNames,
        startDate:          startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        endDate:            endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
        tarefasOS:          tarefas,
        atualizadoPor:      currentUser?.uid,
        atualizadoEm:       Timestamp.now(),
      };

      await updateDoc(doc(db, 'tasks', os.id), updates);

      registrarAtividade({
        tipo: 'os_editada',
        autorId: currentUser?.uid ?? '',
        autorNome: (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor',
        titulo: `O.S. editada: ${title.trim()}`,
        osId: os.id, osNumero: os.numeroOS, osTitulo: title.trim(),
        clienteNome: clientName || undefined,
        meta: { ambiente: 'app_gestor' },
      });

      // upsert tipo de serviço
      if (tipoServico.trim()) {
        try {
          const tSnap = await getDocs(query(
            collection(db, CollectionName.SERVICE_TYPES),
            where('nome', '==', tipoServico.trim()),
          ));
          if (tSnap.empty) {
            await addDoc(collection(db, CollectionName.SERVICE_TYPES), {
              nome: tipoServico.trim(), usoCount: 1, criadoEm: Timestamp.now(),
            });
          }
        } catch { /* silent */ }
      }

      onSaved(updates);
    } catch (e) {
      console.error('[FieldOSEditModal] save:', e);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  /* ── ui helpers ──────────────────────────────────────────────────── */
  const label = 'block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1';
  const input  = 'w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-orange-500 appearance-none';
  const select = 'w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-3 text-sm text-white focus:outline-none focus:border-orange-500 appearance-none';

  /* filtro de projetos pelo cliente */
  const projetosFiltrados = clientId
    ? projects.filter((p: any) => !p.clientId || p.clientId === clientId)
    : projects;

  return (
    <div className="fixed inset-0 z-[60] bg-gray-950 flex flex-col overflow-hidden">

      {/* ── header ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-lg bg-gray-800 active:bg-gray-700">
          <X size={18} className="text-gray-300" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-white">Editar O.S.</p>
          {os.numeroOS && <p className="text-[10px] text-gray-500">{os.numeroOS}</p>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm active:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar
        </button>
      </div>

      {/* ── body ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={28} className="text-orange-400 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">

          {/* Título */}
          <div>
            <label className={label}>Título <span className="text-red-400">*</span></label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Troca de compressor câmara fria"
              className={input}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className={label}>Descrição / Problema</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Descreva o serviço ou problema..."
              className={`${input} resize-none`}
            />
          </div>

          {/* Cliente */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Building size={12} className="text-gray-600" />
              <label className={label} style={{marginBottom:0}}>Cliente</label>
            </div>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setProjectId(''); }}
              className={select}
            >
              <option value="">Sem cliente</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Projeto */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Briefcase size={12} className="text-gray-600" />
              <label className={label} style={{marginBottom:0}}>Projeto</label>
            </div>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className={select}
            >
              <option value="">Nenhum projeto (O.S. avulsa)</option>
              {projetosFiltrados.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo de serviço */}
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <Tag size={12} className="text-gray-600" />
              <label className={label} style={{marginBottom:0}}>Tipo de Serviço</label>
            </div>
            <input
              value={tipoServico}
              onChange={e => { setTipoServico(e.target.value); buscarTipos(e.target.value); }}
              placeholder="Ex: Manutenção preventiva, Instalação..."
              className={input}
            />
            {tipoSugestoes.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-10">
                {tipoSugestoes.map(s => (
                  <button
                    key={s}
                    type="button"
                    onMouseDown={() => { setTipoServico(s); setTipoSugestoes([]); }}
                    className="w-full px-3 py-2.5 text-left text-sm text-gray-200 hover:bg-gray-700 active:bg-gray-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Prioridade */}
          <div>
            <label className={label}>Prioridade</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORITY_OPTIONS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all ${
                    priority === p.value ? p.cls : 'border-gray-700 text-gray-500 bg-gray-900'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} className="text-gray-600" />
                <label className={label} style={{marginBottom:0}}>Início Previsto</label>
              </div>
              <input
                type="datetime-local"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className={select}
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar size={12} className="text-gray-600" />
                <label className={label} style={{marginBottom:0}}>Prazo Final</label>
              </div>
              <input
                type="datetime-local"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className={select}
              />
            </div>
          </div>

          {/* Responsável */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <User size={12} className="text-gray-600" />
              <label className={label} style={{marginBottom:0}}>Responsável</label>
            </div>
            <select
              value={assigneeId}
              onChange={e => setAssigneeId(e.target.value)}
              className={select}
            >
              <option value="">Sem responsável (disponível para todos)</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.nomeCompleto || u.displayName || u.email}
                </option>
              ))}
            </select>
          </div>

          {/* Colaboradores adicionais */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Users size={12} className="text-gray-600" />
              <label className={label} style={{marginBottom:0}}>Colaboradores Adicionais</label>
            </div>
            <div className="flex flex-wrap gap-2">
              {users.map(u => {
                const uid = u.id;
                const nome = u.nomeCompleto || u.displayName || u.email || uid;
                const selected = assignedUsers.includes(uid);
                const foto = u.photoURL || u.avatar;
                return (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => toggleColab(uid)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      selected
                        ? 'border-orange-500 bg-orange-500/15 text-orange-300'
                        : 'border-gray-700 bg-gray-900 text-gray-400'
                    }`}
                  >
                    {foto ? (
                      <img src={foto} alt="" className="w-4 h-4 rounded-full object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded-full bg-gray-700 flex items-center justify-center">
                        <span className="text-[8px] font-black text-gray-300">{nome[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    {nome}
                    {selected && <CheckCircle2 size={11} className="text-orange-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tarefas */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <ListTodo size={12} className="text-gray-600" />
              <label className={label} style={{marginBottom:0}}>Tarefas ({tarefas.length})</label>
            </div>

            {tarefas.length === 0 && (
              <p className="text-xs text-gray-600 italic mb-3">
                Sem tarefas — a O.S. terá uma única tarefa geral de execução.
              </p>
            )}

            <div className="space-y-2 mb-3">
              {tarefas.map(t => (
                <div key={t.id} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
                  t.status === 'concluida'
                    ? 'border-emerald-700/40 bg-emerald-900/10'
                    : 'border-gray-700 bg-gray-900'
                }`}>
                  <span className={`flex-1 text-sm ${t.status === 'concluida' ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {t.descricao}
                  </span>
                  {t.status !== 'concluida' && (
                    <button
                      type="button"
                      onClick={() => removeTarefa(t.id)}
                      className="p-1 text-gray-600 active:text-red-400"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* add tarefa */}
            <div className="flex gap-2">
              <input
                value={novaTarefa}
                onChange={e => setNovaTarefa(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTarefa()}
                placeholder="Descrição da tarefa..."
                className={`${input} flex-1`}
              />
              <button
                type="button"
                onClick={addTarefa}
                disabled={!novaTarefa.trim()}
                className="w-11 h-11 flex items-center justify-center bg-emerald-600 rounded-xl active:bg-emerald-700 disabled:opacity-40"
              >
                <Plus size={18} className="text-white" />
              </button>
            </div>
          </div>

          {/* Ativos */}
          {ativos.length > 0 && (
            <div>
              <label className={label}>Ativo Vinculado</label>
              <select
                value={raw.ativoId ?? ''}
                className={select}
              >
                <option value="">Nenhum ativo</option>
                {ativos.map(a => (
                  <option key={a.id} value={a.id}>{a.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div className="h-8" />
        </div>
      )}

      {/* ── footer fixo ── */}
      <div className="flex-shrink-0 px-4 py-4 bg-gray-900 border-t border-gray-800 flex gap-3 safe-area-bottom">
        <button
          onClick={onClose}
          className="flex-1 py-3 bg-gray-800 border border-gray-700 text-gray-300 font-bold text-sm rounded-xl active:bg-gray-700"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={saving || loading || !title.trim()}
          className="flex-1 py-3 bg-emerald-600 text-white font-bold text-sm rounded-xl active:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar O.S.
        </button>
      </div>
    </div>
  );
}

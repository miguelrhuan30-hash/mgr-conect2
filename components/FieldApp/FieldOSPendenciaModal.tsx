import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, getDocs, query, where,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, WorkflowStatus } from '../../types';
import { gerarNumeroOS } from '../../services/osService';
import {
  X, Plus, Trash2, ChevronDown, ChevronUp, Loader2,
  User, Users, Building, Briefcase, Calendar, Wrench,
  ListTodo, FileText, AlertTriangle, UserPlus, Save,
} from 'lucide-react';

interface Props {
  onClose: () => void;
}

const PRIORIDADE = [
  { value: 'low',      label: 'Baixa',   sel: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
  { value: 'medium',   label: 'Média',   sel: 'border-yellow-500 text-yellow-400  bg-yellow-500/10' },
  { value: 'high',     label: 'Alta',    sel: 'border-orange-500 text-orange-400  bg-orange-500/10' },
  { value: 'critical', label: 'Crítica', sel: 'border-red-500    text-red-400     bg-red-500/10' },
];

const makeFotoSlots = (ts: number) => [
  { id: `slot_${ts}_a`,  titulo: 'Antes',  descricao: 'Estado antes da execução', obrigatoria: true, ordem: 0 },
  { id: `slot_${ts}_d`,  titulo: 'Depois', descricao: 'Estado após a execução',   obrigatoria: true, ordem: 1 },
];

interface Tarefa { id: string; descricao: string; }

/* ────────────────────────────────────────────────────── */

export default function FieldOSPendenciaModal({ onClose }: Props) {
  const { currentUser, userProfile } = useAuth();

  /* Campos */
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]     = useState('medium');
  const [tipoServico, setTipoServico] = useState('');
  const [tipoSugestoes, setTipoSugestoes] = useState<string[]>([]);

  /* Cliente */
  const [clientId, setClientId]     = useState('');
  const [clients, setClients]       = useState<any[]>([]);
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [savingClient, setSavingClient] = useState(false);
  const quickRef = useRef<HTMLInputElement>(null);

  /* Projeto */
  const [projectId, setProjectId]   = useState('');
  const [projects, setProjects]     = useState<any[]>([]);
  const [fatProjeto, setFatProjeto] = useState(false);

  /* Responsáveis */
  const [assigneeId, setAssigneeId]       = useState('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [users, setUsers]                 = useState<any[]>([]);

  /* Datas */
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');

  /* Ativos */
  const [ativoId, setAtivoId]       = useState('');
  const [ativoNome, setAtivoNome]   = useState('');
  const [ativos, setAtivos]         = useState<any[]>([]);

  /* Ponto */
  const [pontoEntrada, setPontoEntrada] = useState(false);
  const [pontoSaida, setPontoSaida]     = useState(false);

  /* Tarefas */
  const [tarefas, setTarefas]       = useState<Tarefa[]>([]);
  const [novaTarefa, setNovaTarefa] = useState('');

  /* Templates */
  const [templates, setTemplates]   = useState<any[]>([]);

  /* UI */
  const [showAvancado, setShowAvancado] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [erro, setErro]             = useState('');

  /* ── Carga inicial ──────────────────────────────────── */
  useEffect(() => {
    const load = async () => {
      try {
        const [cSnap, uSnap, tSnap] = await Promise.all([
          getDocs(collection(db, CollectionName.CLIENTS)),
          getDocs(collection(db, CollectionName.USERS)),
          getDocs(collection(db, CollectionName.TASK_TEMPLATES)),
        ]);
        setClients(cSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setUsers(uSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        setTemplates(tSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));

        const [p2Snap, pSnap] = await Promise.all([
          getDocs(collection(db, CollectionName.PROJECTS_V2)).catch(() => ({ docs: [] as any[] })),
          getDocs(collection(db, CollectionName.PROJECTS)).catch(() => ({ docs: [] as any[] })),
        ]);
        const seen = new Set<string>(); const all: any[] = [];
        [...(p2Snap as any).docs, ...(pSnap as any).docs].forEach((d: any) => {
          if (!seen.has(d.id)) { seen.add(d.id); all.push({ id: d.id, ...(d.data() as any) }); }
        });
        setProjects(all);
      } catch (e) { console.error('load error', e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  /* ── Ativos do cliente ──────────────────────────────── */
  useEffect(() => {
    if (!clientId) { setAtivos([]); setAtivoId(''); setAtivoNome(''); return; }
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(s => setAtivos(s.docs.map(d => ({ id: d.id, ...(d.data() as any) }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  /* Foco no campo de cliente rápido */
  useEffect(() => {
    if (showQuickClient) setTimeout(() => quickRef.current?.focus(), 50);
  }, [showQuickClient]);

  /* ── Autocomplete tipo de serviço ───────────────────── */
  const buscarTipos = async (val: string) => {
    if (!val.trim()) { setTipoSugestoes([]); return; }
    try {
      const snap = await getDocs(collection(db, CollectionName.SERVICE_TYPES));
      const all = snap.docs.map(d => (d.data() as any).nome as string);
      setTipoSugestoes(all.filter(n => n.toLowerCase().includes(val.toLowerCase())).slice(0, 5));
    } catch { setTipoSugestoes([]); }
  };

  /* ── Criar cliente rápido ───────────────────────────── */
  const criarClienteRapido = async () => {
    const nome = quickClientName.trim();
    if (!nome) return;
    setSavingClient(true);
    try {
      const ref = await addDoc(collection(db, CollectionName.CLIENTS), {
        name: nome, dadosIncompletos: true, createdAt: serverTimestamp(),
      });
      const novo = { id: ref.id, name: nome, dadosIncompletos: true };
      setClients(prev => [...prev, novo]);
      setClientId(ref.id);
      setQuickClientName('');
      setShowQuickClient(false);
    } catch { alert('Erro ao criar cliente. Tente novamente.'); }
    finally { setSavingClient(false); }
  };

  /* ── Aplicar template ───────────────────────────────── */
  const aplicarTemplate = (tplId: string) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    if (tpl.title)       setTitle(tpl.title);
    if (tpl.description) setDescription(tpl.description);
    if (Array.isArray(tpl.checklist)) {
      setTarefas(tpl.checklist.map((item: any) => ({
        id: `tpl_${Math.random().toString(36).slice(2)}`,
        descricao: item.title || item.text || item.descricao || '',
      })));
    }
  };

  /* ── Tarefas ─────────────────────────────────────────── */
  const adicionarTarefa = () => {
    if (!novaTarefa.trim()) return;
    setTarefas(prev => [...prev, { id: `t_${Math.random().toString(36).slice(2)}`, descricao: novaTarefa.trim() }]);
    setNovaTarefa('');
  };

  /* ── Toggle colaborador ─────────────────────────────── */
  const toggleColab = (uid: string) =>
    setAssignedUsers(prev => prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]);

  /* ── Salvar ──────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!title.trim()) { setErro('Título é obrigatório.'); return; }
    if (!currentUser)  { setErro('Não autenticado.'); return; }
    setSaving(true); setErro('');
    try {
      const clientName  = clients.find(c => c.id === clientId)?.name || '';
      const proj        = projects.find(p => p.id === projectId);
      const projectName = proj?.name || proj?.nome || '';
      const assigneeUser = users.find(u => u.id === assigneeId);
      const assigneeName = assigneeUser?.displayName || assigneeUser?.email || null;
      const assignedUserNames = assignedUsers.map(uid => {
        const u = users.find(u2 => u2.id === uid);
        return u?.displayName || u?.email || uid;
      });
      const criadoPorNome = userProfile?.nomeCompleto || userProfile?.displayName || currentUser.email || '';
      const ts = Date.now();
      const numeroOS = await gerarNumeroOS();

      await addDoc(collection(db, CollectionName.TASKS), {
        numeroOS,
        title:        title.trim(),
        description:  description.trim(),
        status:       'pending',
        priority,
        workflowStatus: WorkflowStatus.AGUARDANDO_APROVACAO,
        fonteAbertura: 'FIELD_APP',
        dadosCompletos: true,
        clientId:     clientId  || null,
        clientName:   clientName || null,
        projectId:    projectId  || null,
        projectName:  projectName || null,
        faturamentoPeloProjeto: !!(projectId && fatProjeto),
        assignedTo:       assigneeId || null,
        assigneeName:     assigneeName,
        assignedUsers,
        assignedUserNames,
        startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        endDate:   endDate   ? Timestamp.fromDate(new Date(endDate))   : null,
        tipoServico: tipoServico.trim() || null,
        ativoId:   ativoId   || null,
        ativoNome: ativoNome || null,
        ponto: { permiteEntrada: pontoEntrada, permiteSaida: pontoSaida },
        tarefasOS: tarefas.map(t => ({
          id: t.id,
          descricao: t.descricao,
          status: 'pendente',
          iniciadaEm: null,
          concluidaEm: null,
          fotoSlots: makeFotoSlots(ts),
        })),
        criadoPor:     currentUser.uid,
        criadoPorNome,
        criadoEm:      Timestamp.now(),
        createdAt:     serverTimestamp(),
      });

      /* Upsert tipo de serviço */
      if (tipoServico.trim()) {
        getDocs(query(collection(db, CollectionName.SERVICE_TYPES), where('nome', '==', tipoServico.trim())))
          .then(snap => {
            if (snap.empty) addDoc(collection(db, CollectionName.SERVICE_TYPES), { nome: tipoServico.trim(), criadoEm: Timestamp.now() });
          }).catch(() => {});
      }

      onClose();
    } catch (e) {
      console.error(e);
      setErro('Erro ao criar a O.S. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  /* ──────────────── helpers de estilo ─────────────────── */
  const input  = 'w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500';
  const lbl    = 'block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5';

  const clientProjects = clientId ? projects.filter(p => p.clientId === clientId) : [];
  const otherProjects  = clientId ? projects.filter(p => p.clientId !== clientId) : projects;

  /* ─────────────────────────── LOADING ──────────────── */
  if (loading) {
    return (
      <div className="fixed inset-0 z-[55] bg-gray-950 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  /* ──────────────────────────── UI ────────────────────── */
  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-gray-950">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800">
        <button onClick={onClose} className="p-2 -ml-2 rounded-full active:bg-gray-800">
          <X size={20} className="text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white">Nova O.S.</h2>
          <p className="text-[11px] text-gray-500">Preencha os dados da ordem de serviço</p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm disabled:opacity-50 active:bg-emerald-700"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Criar
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* Modelo / Template */}
        {templates.length > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-3 py-3">
            <label className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-wide mb-2">
              <FileText size={11} /> Usar modelo existente (opcional)
            </label>
            <select
              defaultValue=""
              onChange={e => aplicarTemplate(e.target.value)}
              className="w-full bg-gray-800 border border-blue-500/30 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Selecionar modelo...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        {/* Título */}
        <div>
          <label className={lbl}>Título <span className="text-red-400">*</span></label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Ex: Troca de compressor câmara fria"
            className={input}
          />
        </div>

        {/* Descrição */}
        <div>
          <label className={lbl}>Descrição / Problema</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Descreva o serviço ou problema..."
            rows={3}
            spellCheck autoCorrect="on" autoCapitalize="sentences"
            className={`${input} resize-none`}
          />
        </div>

        {/* Cliente */}
        <div>
          <label className={`${lbl} flex items-center gap-1`}>
            <Building size={10} /> Cliente
          </label>
          <div className="flex gap-2">
            <select
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              className={`${input} flex-1`}
            >
              <option value="">Sem cliente</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.dadosIncompletos ? ' ⚠' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={() => setShowQuickClient(v => !v)}
              className={`flex-shrink-0 p-2.5 rounded-xl border transition-colors ${
                showQuickClient
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'bg-gray-800 border-gray-700 text-gray-400 active:bg-gray-700'
              }`}
              title="Cadastrar novo cliente"
            >
              <UserPlus size={16} />
            </button>
          </div>

          {showQuickClient && (
            <div className="mt-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-3 space-y-2">
              <p className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase">
                <AlertTriangle size={11} /> Novo cliente (cadastro incompleto)
              </p>
              <input
                ref={quickRef}
                value={quickClientName}
                onChange={e => setQuickClientName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); criarClienteRapido(); }
                  if (e.key === 'Escape') setShowQuickClient(false);
                }}
                placeholder="Nome do cliente..."
                className="w-full bg-gray-800 border border-amber-500/30 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={criarClienteRapido}
                  disabled={!quickClientName.trim() || savingClient}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-amber-600 text-white text-sm font-bold rounded-xl disabled:opacity-50 active:bg-amber-700"
                >
                  {savingClient ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
                <button
                  onClick={() => { setShowQuickClient(false); setQuickClientName(''); }}
                  className="px-4 py-2.5 border border-gray-700 text-gray-400 text-sm font-bold rounded-xl active:bg-gray-800"
                >
                  Cancelar
                </button>
              </div>
              <p className="text-[10px] text-amber-600/70">Complete os dados depois em Clientes.</p>
            </div>
          )}
        </div>

        {/* Projeto */}
        <div>
          <label className={`${lbl} flex items-center gap-1`}>
            <Briefcase size={10} /> Projeto
          </label>
          <select
            value={projectId}
            onChange={e => { setProjectId(e.target.value); if (!e.target.value) setFatProjeto(false); }}
            className={input}
          >
            <option value="">Nenhum projeto (O.S. avulsa)</option>
            {clientProjects.length > 0 && (
              <optgroup label="Projetos do cliente">
                {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name || p.nome}</option>)}
              </optgroup>
            )}
            {otherProjects.length > 0 && (
              <optgroup label={clientProjects.length > 0 ? 'Outros projetos' : 'Todos os projetos'}>
                {otherProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.nome}{p.clientName ? ` — ${p.clientName}` : ''}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {projectId && (
            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={fatProjeto}
                onChange={e => setFatProjeto(e.target.checked)}
                className="w-4 h-4 accent-blue-500 rounded"
              />
              <span className="text-xs text-gray-400">
                Faturamento pelo projeto{' '}
                <span className="text-gray-600">(sem cobrança individual)</span>
              </span>
            </label>
          )}
        </div>

        {/* Tipo de Serviço */}
        <div className="relative">
          <label className={`${lbl} flex items-center gap-1`}>
            <Wrench size={10} /> Tipo de Serviço
          </label>
          <input
            value={tipoServico}
            onChange={e => { setTipoServico(e.target.value); buscarTipos(e.target.value); }}
            onBlur={() => setTimeout(() => setTipoSugestoes([]), 200)}
            placeholder="Ex: Manutenção preventiva, Instalação..."
            className={input}
          />
          {tipoSugestoes.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl">
              {tipoSugestoes.map(s => (
                <button
                  key={s}
                  onMouseDown={() => { setTipoServico(s); setTipoSugestoes([]); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 active:bg-gray-700 border-b border-gray-700/40 last:border-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prioridade */}
        <div>
          <label className={lbl}>Prioridade</label>
          <div className="grid grid-cols-4 gap-2">
            {PRIORIDADE.map(p => (
              <button
                key={p.value}
                onClick={() => setPriority(p.value)}
                className={`py-2.5 text-[11px] font-bold rounded-xl border transition-all ${
                  priority === p.value
                    ? p.sel
                    : 'border-gray-700 text-gray-500 bg-gray-800/50'
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
            <label className={`${lbl} flex items-center gap-1`}>
              <Calendar size={10} /> Início previsto
            </label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label className={`${lbl} flex items-center gap-1`}>
              <Calendar size={10} /> Prazo final
            </label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className={input}
            />
          </div>
        </div>

        {/* Responsável */}
        <div>
          <label className={`${lbl} flex items-center gap-1`}>
            <User size={10} /> Responsável
          </label>
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            className={input}
          >
            <option value="">Sem responsável (disponível para todos)</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.displayName || u.email || u.id}
              </option>
            ))}
          </select>
        </div>

        {/* Colaboradores */}
        <div>
          <label className={`${lbl} flex items-center gap-1`}>
            <Users size={10} /> Colaboradores adicionais
          </label>
          {users.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Nenhum usuário disponível</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {users.map(u => {
                const sel = assignedUsers.includes(u.id);
                const ini = (u.displayName || u.email || 'U')[0].toUpperCase();
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleColab(u.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-all ${
                      sel
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-gray-800 border-gray-700 text-gray-400 active:bg-gray-700'
                    }`}
                  >
                    {u.photoURL ? (
                      <img src={u.photoURL} className="w-4 h-4 rounded-full object-cover" alt="" />
                    ) : (
                      <span className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[9px] font-bold text-white">
                        {ini}
                      </span>
                    )}
                    {(u.displayName || u.email || '').split(' ')[0]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Tarefas */}
        <div>
          <label className={`${lbl} flex items-center gap-1`}>
            <ListTodo size={10} /> Tarefas{' '}
            <span className="text-gray-600 font-normal normal-case">({tarefas.length})</span>
          </label>

          <div className="space-y-2 mb-2">
            {tarefas.map(t => (
              <div key={t.id} className="flex items-center gap-2 bg-gray-800/60 border border-gray-700/50 rounded-xl px-3 py-2.5">
                <span className="flex-1 text-sm text-gray-200 leading-snug">{t.descricao}</span>
                <button
                  onClick={() => setTarefas(prev => prev.filter(x => x.id !== t.id))}
                  className="flex-shrink-0 p-1 text-gray-600 active:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {tarefas.length === 0 && (
              <p className="text-xs text-gray-600 italic px-1">
                Sem tarefas — a O.S. terá uma única tarefa geral de execução.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={novaTarefa}
              onChange={e => setNovaTarefa(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarTarefa(); } }}
              placeholder="Descrição da tarefa..."
              className={`${input} flex-1`}
            />
            <button
              onClick={adicionarTarefa}
              disabled={!novaTarefa.trim()}
              className="flex-shrink-0 p-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl active:bg-emerald-600/40 disabled:opacity-40"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>

        {/* ── Avançado ─────────────────────────────────── */}
        <div className="border border-gray-800 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowAvancado(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 active:bg-gray-800"
          >
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
              Opções avançadas
            </span>
            {showAvancado
              ? <ChevronUp size={15} className="text-gray-500" />
              : <ChevronDown size={15} className="text-gray-500" />
            }
          </button>

          {showAvancado && (
            <div className="px-4 py-4 bg-gray-900/40 space-y-4">

              {/* Ativo vinculado */}
              {ativos.length > 0 && (
                <div>
                  <label className={lbl}>Ativo vinculado</label>
                  <select
                    value={ativoId}
                    onChange={e => {
                      setAtivoId(e.target.value);
                      setAtivoNome(ativos.find(a => a.id === e.target.value)?.nome || '');
                    }}
                    className={input}
                  >
                    <option value="">Nenhum ativo</option>
                    {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                  </select>
                </div>
              )}
              {!clientId && (
                <p className="text-[11px] text-gray-600 italic">
                  Selecione um cliente para ver os ativos disponíveis.
                </p>
              )}
              {clientId && ativos.length === 0 && (
                <p className="text-[11px] text-gray-600 italic">
                  Nenhum ativo cadastrado para este cliente.
                </p>
              )}

              {/* Registro de Ponto */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-3">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                  Registro de Ponto em Campo
                </p>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pontoEntrada}
                    onChange={e => setPontoEntrada(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded"
                  />
                  <span className="text-sm text-gray-300">Permite ponto de entrada neste local</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={pontoSaida}
                    onChange={e => setPontoSaida(e.target.checked)}
                    className="w-4 h-4 accent-blue-500 rounded"
                  />
                  <span className="text-sm text-gray-300">Permite ponto de saída neste local</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-400">{erro}</p>
          </div>
        )}

        <div className="h-4" />
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div className="px-4 py-4 bg-gray-900 border-t border-gray-800">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onClose}
            className="py-4 bg-gray-800 text-gray-300 rounded-2xl font-bold text-sm active:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50 active:bg-emerald-700"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Criando...' : 'Criar O.S.'}
          </button>
        </div>
      </div>
    </div>
  );
}

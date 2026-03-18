import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, PriorityLevel, ChecklistItem, TaskTemplate } from '../types';
import { X, Plus, Trash2, FileText, Calendar, User, Users, Building, Briefcase, ListTodo, Save, Loader2, Wrench, Camera, AlignLeft, MapPin, Clock } from 'lucide-react';

interface OSCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const OSCreationModal: React.FC<OSCreationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Advanced State
  const [tools, setTools] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [newPhotoTitles, setNewPhotoTitles] = useState<Record<string, string>>({});

  // Sprint 43 — tipo de serviço
  const [tipoServico, setTipoServico] = useState('');
  const [tipoSugestoes, setTipoSugestoes] = useState<string[]>([]);
  // Sprint 41 — ponto
  const [pontoEntrada, setPontoEntrada] = useState(false);
  const [pontoSaida,   setPontoSaida]   = useState(false);
  // Sprint 44 — ativo
  const [ativoId,   setAtivoId]   = useState('');
  const [ativoNome, setAtivoNome] = useState('');
  const [ativos,    setAtivos]    = useState<{ id: string; nome: string }[]>([]);

  // Data Source State
  const [clients, setClients] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  
  const [loadingData, setLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Initial Data
  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        setLoadingData(true);
        try {
          const clientsSnap = await getDocs(collection(db, CollectionName.CLIENTS));
          setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
          const usersSnap = await getDocs(collection(db, CollectionName.USERS));
          setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
          const tplSnap = await getDocs(collection(db, CollectionName.TASK_TEMPLATES));
          setTemplates(tplSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as TaskTemplate)));
        } catch (error) {
          console.error("Error loading form data:", error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  // Sprint 44 — load ativos when client changes
  useEffect(() => {
    if (!clientId) { setAtivos([]); setAtivoId(''); return; }
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(snap => setAtivos(snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  // Sprint 43 — buscar tipos
  const buscarTipos = async (val: string) => {
    if (!val.trim()) { setTipoSugestoes([]); return; }
    try {
      const snap = await getDocs(collection(db, CollectionName.SERVICE_TYPES));
      const all = snap.docs.map(d => (d.data() as any).nome as string);
      setTipoSugestoes(all.filter(n => n.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
    } catch { setTipoSugestoes([]); }
  };

  const selecionarTipo = (tipo: string) => {
    setTipoServico(tipo); setTipoSugestoes([]);
  };

  // Filter Projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!clientId) {
        setProjects([]);
        return;
      }
      try {
        const q = query(collection(db, CollectionName.PROJECTS), where("clientId", "==", clientId));
        const snap = await getDocs(q);
        setProjects(snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (error) {
        console.error("Error loading projects:", error);
      }
    };
    fetchProjects();
  }, [clientId]);

  const applyTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTitle(template.title);
      setDescription(template.description);
      setTools(template.tools || []);
      
      // Map template checklist to task checklist structure
      setChecklist(template.checklist.map(item => ({
        id: Math.random().toString(36).substr(2, 9),
        text: item.title,
        description: item.description,
        evidenceRequired: item.evidenceRequired,
        completed: false
      })));
    }
  };

  const DEFAULT_FOTO_SLOTS = (): any[] => [
    { id: `slot_${Date.now()}_antes`, titulo: 'Antes', descricao: 'Foto do estado antes da execução', obrigatoria: true, ordem: 0 },
    { id: `slot_${Date.now() + 1}_depois`, titulo: 'Depois', descricao: 'Foto do estado após a execução', obrigatoria: true, ordem: 1 },
  ];

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const id = Math.random().toString(36).substr(2, 9);
    setChecklist([...checklist, {
      id,
      text: newChecklistItem.trim(),
      completed: false,
      evidenceRequired: 'NONE',
      fotoSlots: DEFAULT_FOTO_SLOTS(),
    } as any]);
    setNewChecklistItem('');
  };

  const removeChecklistItem = (id: string) => {
    setChecklist(checklist.filter(item => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const clientName = clients.find(c => c.id === clientId)?.name || 'Cliente N/A';
      const projectName = projects.find(p => p.id === projectId)?.name || 'Projeto Geral';
      const assigneeUser = users.find(u => u.id === assigneeId);
      const assigneeName = assigneeUser?.displayName || assigneeUser?.email || 'Não Atribuído';
      
      const assignedUserNames = assignedUsers.map(uid => {
        const u = users.find(usr => usr.id === uid);
        return u?.displayName || u?.email || 'Desconhecido';
      });

      const taskPayload = {
        title,
        description,
        status: 'pending',
        priority,
        clientId,
        clientName,
        projectId,
        projectName,
        assignedTo: assigneeId,
        assigneeName,
        assignedUsers,
        assignedUserNames,
        startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
        checklist,
        tools,
        tipoServico: tipoServico || null,
        ativoId: ativoId || null,
        ativoNome: ativoNome || null,
        ponto: { permiteEntrada: pontoEntrada, permiteSaida: pontoSaida },
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, CollectionName.TASKS), taskPayload);

      // Upsert tipo de serviço
      if (tipoServico.trim()) {
        try {
          const tSnap = await getDocs(query(collection(db, CollectionName.SERVICE_TYPES), where('nome', '==', tipoServico.trim())));
          if (tSnap.empty) await addDoc(collection(db, CollectionName.SERVICE_TYPES), { nome: tipoServico.trim(), usoCount: 1, criadoEm: Timestamp.now() });
        } catch { /* silent */ }
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating O.S.:", error);
      alert("Erro ao criar Ordem de Serviço.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Nova Ordem de Serviço</h2>
            <p className="text-sm text-gray-500">Preencha os detalhes para abrir uma nova O.S.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="os-form" onSubmit={handleSubmit} className="space-y-6">
            
            {/* Template Selector */}
            <div className="bg-brand-50 p-4 rounded-xl border border-brand-100 flex items-center gap-4">
              <FileText className="text-brand-600 w-5 h-5" />
              <div className="flex-1">
                <label className="text-sm font-medium text-brand-800 block mb-1">Carregar Modelo (Template)</label>
                <select 
                  onChange={(e) => applyTemplate(e.target.value)}
                  className="block w-full text-sm rounded-lg border-brand-200 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                  defaultValue=""
                >
                  <option value="" disabled>Selecione um modelo para preencher...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título da O.S. *</label>
                  <input
                    required
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                    placeholder="Ex: Instalação de Câmeras"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <Building className="w-4 h-4 mr-1 text-gray-400" /> Cliente
                    </label>
                    <select 
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                    >
                      <option value="">Selecione...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <Briefcase className="w-4 h-4 mr-1 text-gray-400" /> Projeto
                    </label>
                    <select 
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      disabled={!clientId}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100 bg-white text-gray-900"
                    >
                      <option value="">{clientId ? 'Selecione...' : 'Escolha Cliente'}</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Detalhada</label>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 resize-none bg-white text-gray-900"
                    placeholder="Descreva o serviço a ser executado..."
                  />
                </div>

                {/* Tools Display */}
                {tools.length > 0 && (
                  <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                    <label className="flex items-center text-xs font-bold text-orange-800 mb-2 uppercase tracking-wide">
                      <Wrench className="w-3 h-3 mr-1" /> Ferramentas Necessárias
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {tools.map((t, i) => (
                        <span key={i} className="text-xs bg-white text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sprint 43 — Tipo de Serviço */}
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Serviço</label>
                  <input value={tipoServico} onChange={e => { setTipoServico(e.target.value); buscarTipos(e.target.value); }}
                    placeholder="Ex: Instalação, Manutenção..."
                    className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900 text-sm" />
                  {tipoSugestoes.length > 0 && (
                    <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-36 overflow-y-auto">
                      {tipoSugestoes.map(s => (
                        <button key={s} type="button" onClick={() => selecionarTipo(s)}
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50">{s}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                    <select 
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <User className="w-4 h-4 mr-1 text-gray-400" /> Responsável
                    </label>
                    <select 
                      value={assigneeId}
                      onChange={(e) => setAssigneeId(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                    >
                      <option value="">Selecione...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                    </select>
                  </div>
                </div>

                {/* Multi-Assignee Selection */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                   <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                      <Users className="w-4 h-4 mr-1 text-gray-400" /> Colaboradores Adicionais
                   </label>
                   <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {users.map(u => (
                        <label key={u.id} className={`
                           flex items-center gap-2 px-2 py-1 rounded border text-xs cursor-pointer transition-colors
                           ${assignedUsers.includes(u.id) ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}
                        `}>
                           <input 
                             type="checkbox" 
                             className="rounded text-brand-600 focus:ring-brand-500 w-3 h-3"
                             checked={assignedUsers.includes(u.id)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setAssignedUsers([...assignedUsers, u.id]);
                               } else {
                                 setAssignedUsers(assignedUsers.filter(id => id !== u.id));
                               }
                             }}
                           />
                           {u.photoURL ? (
                             <img src={u.photoURL} className="w-4 h-4 rounded-full object-cover" alt="" />
                           ) : (
                             <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-[8px] font-bold">{(u.displayName || u.email || 'U').charAt(0).toUpperCase()}</div>
                           )}
                           {(u.displayName || u.email || 'Usuário').split(' ')[0]}
                        </label>
                      ))}
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" /> Início Previsto
                    </label>
                    <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" /> Prazo Final
                    </label>
                    <input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border-gray-300 text-sm bg-white text-gray-900" />
                  </div>
                </div>

                {/* Sprint 44 — Ativo do cliente */}
                {ativos.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ativo vinculado</label>
                    <select value={ativoId} onChange={e => {
                      setAtivoId(e.target.value);
                      setAtivoNome(ativos.find(a => a.id === e.target.value)?.nome || '');
                    }} className="w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm">
                      <option value="">Nenhum ativo</option>
                      {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
                    </select>
                  </div>
                )}

                {/* Sprint 41 — Ponto */}
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-2">
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

                {/* Checklist / Tarefas com foto slots por tarefa */}
                 <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
                    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <label className="flex items-center text-sm font-bold text-gray-700 gap-1">
                        <ListTodo className="w-4 h-4 text-brand-500" /> Tarefas da O.S.
                      </label>
                      <span className="text-[10px] text-gray-400">{checklist.length} tarefa(s)</span>
                    </div>

                    {/* Add task row */}
                    <div className="flex gap-2 p-3 border-b border-gray-100">
                      <input
                        type="text"
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                        placeholder="Descrever nova tarefa e pressionar Enter..."
                        className="flex-1 text-sm rounded-lg border-gray-200 bg-white text-gray-900 px-3 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="p-2 bg-brand-100 text-brand-600 rounded-lg hover:bg-brand-200"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    {/* Task list */}
                    <ul className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
                      {checklist.length === 0 && (
                        <li className="px-3 py-4 text-xs text-gray-400 italic text-center">
                          Nenhuma tarefa adicionada. As fotos padrão (Antes e Depois) são criadas automaticamente por tarefa.
                        </li>
                      )}
                      {checklist.map(item => {
                        const fotoSlots: any[] = (item as any).fotoSlots || [];
                        const isExpanded = expandedTaskId === item.id;
                        return (
                          <li key={item.id} className="bg-white">
                            {/* Task header row */}
                            <div className="flex items-center gap-2 px-3 py-2">
                              <span className="flex-1 text-sm font-medium text-gray-800 truncate">{item.text}</span>
                              <button
                                type="button"
                                onClick={() => setExpandedTaskId(isExpanded ? null : item.id)}
                                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg font-bold transition-colors ${
                                  isExpanded ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500 hover:bg-brand-50 hover:text-brand-600'
                                }`}
                                title="Configurar fotos desta tarefa"
                              >
                                <Camera size={11} />
                                {fotoSlots.length} foto{fotoSlots.length !== 1 ? 's' : ''}
                              </button>
                              <button
                                type="button"
                                onClick={() => removeChecklistItem(item.id)}
                                className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>

                            {/* Expanded photo slots */}
                            {isExpanded && (
                              <div className="bg-blue-50/60 border-t border-blue-100 px-3 py-3 space-y-2">
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                                  <Camera size={10} /> Fotos obrigatórias desta tarefa
                                </p>

                                {/* Existing slots */}
                                {fotoSlots.map((slot, si) => (
                                  <div key={slot.id} className="flex items-center gap-2 bg-white rounded-lg px-2 py-2 border border-blue-100">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className={`text-[9px] font-extrabold px-1.5 rounded ${
                                          slot.obrigatoria ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                          {slot.obrigatoria ? 'OBRIG.' : 'OPC.'}
                                        </span>
                                        <span className="text-xs font-bold text-gray-700 truncate">{slot.titulo}</span>
                                      </div>
                                      {slot.descricao && (
                                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{slot.descricao}</p>
                                      )}
                                    </div>
                                    {/* Toggle obrigatória */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = checklist.map(c => c.id !== item.id ? c : {
                                          ...c,
                                          fotoSlots: fotoSlots.map((s, i) => i === si ? { ...s, obrigatoria: !s.obrigatoria } : s),
                                        } as any);
                                        setChecklist(updated);
                                      }}
                                      className={`text-[10px] px-2 py-0.5 rounded font-bold ${slot.obrigatoria ? 'text-red-600 hover:bg-red-50' : 'text-gray-400 hover:bg-gray-50'}`}
                                      title={slot.obrigatoria ? 'Tornar opcional' : 'Tornar obrigatória'}
                                    >
                                      {slot.obrigatoria ? '🔒' : '🔓'}
                                    </button>
                                    {/* Delete slot — can't delete default Antes/Depois */}
                                    {si >= 2 && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const updated = checklist.map(c => c.id !== item.id ? c : {
                                            ...c,
                                            fotoSlots: fotoSlots.filter((_, i) => i !== si),
                                          } as any);
                                          setChecklist(updated);
                                        }}
                                        className="text-gray-300 hover:text-red-500 p-0.5"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                ))}

                                {/* Add new slot */}
                                <div className="flex gap-2 mt-2">
                                  <input
                                    type="text"
                                    value={newPhotoTitles[item.id] || ''}
                                    onChange={e => setNewPhotoTitles(p => ({ ...p, [item.id]: e.target.value }))}
                                    placeholder="Título da nova foto (ex: Painel elétrico)..."
                                    className="flex-1 text-xs rounded-lg border-gray-200 bg-white px-2.5 py-1.5"
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        const titulo = (newPhotoTitles[item.id] || '').trim();
                                        if (!titulo) return;
                                        const newSlot = {
                                          id: `slot_${Date.now()}`,
                                          titulo,
                                          descricao: '',
                                          obrigatoria: true,
                                          ordem: fotoSlots.length,
                                        };
                                        const updated = checklist.map(c => c.id !== item.id ? c : {
                                          ...c, fotoSlots: [...fotoSlots, newSlot],
                                        } as any);
                                        setChecklist(updated);
                                        setNewPhotoTitles(p => ({ ...p, [item.id]: '' }));
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const titulo = (newPhotoTitles[item.id] || '').trim();
                                      if (!titulo) return;
                                      const newSlot = {
                                        id: `slot_${Date.now()}`,
                                        titulo,
                                        descricao: '',
                                        obrigatoria: true,
                                        ordem: fotoSlots.length,
                                      };
                                      const updated = checklist.map(c => c.id !== item.id ? c : {
                                        ...c, fotoSlots: [...fotoSlots, newSlot],
                                      } as any);
                                      setChecklist(updated);
                                      setNewPhotoTitles(p => ({ ...p, [item.id]: '' }));
                                    }}
                                    className="px-2 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700"
                                  >
                                    <Plus size={13} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                 </div>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button 
            type="submit" 
            form="os-form"
            disabled={isSubmitting}
            className="flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 border border-transparent rounded-lg hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 disabled:opacity-75"
          >
            {isSubmitting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />}
            Criar Ordem de Serviço
          </button>
        </div>

      </div>
    </div>
  );
};

export default OSCreationModal;
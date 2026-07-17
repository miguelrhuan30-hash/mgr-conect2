import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, Timestamp, updateDoc, doc } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, PriorityLevel, ChecklistItem, TaskTemplate, WorkflowStatus, BacklogTarefa, ProjectDocument, OSArquivoApoio, ContratoSLA, PrioridadeSLA } from '../types';
import { gerarNumeroOS } from '../services/osService';
import { registrarAtividade } from '../services/activityFeedService';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, FileText, Calendar, User, Users, Building, Briefcase, ListTodo, Save, Loader2, Wrench, Camera, AlignLeft, MapPin, Clock, UserPlus, ExternalLink, AlertTriangle, Paperclip, Video, Image as ImageIcon, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function tipoArquivoFromName(nome: string): OSArquivoApoio['tipo'] {
  const ext = nome.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'imagem';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return 'outro';
}

interface OSCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (taskId?: string) => void;
  // Pré-preenchimento — usado ao converter um chamado de contrato SLA (Portal do Cliente) em O.S.
  prefill?: {
    clientId: string;
    contratoSlaId?: string;
    prioridadeSla?: PrioridadeSLA;
    title?: string;
    description?: string;
  };
}

const OSCreationModal: React.FC<OSCreationModalProps> = ({ isOpen, onClose, onSuccess, prefill }) => {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [faturamentoPeloProjeto, setFaturamentoPeloProjeto] = useState(false);

  // Tipo de O.S. — Avulsa (padrão) | Projeto | Contrato SLA. Mutuamente exclusivos.
  const [tipoOSSelecionado, setTipoOSSelecionado] = useState<'avulsa' | 'projeto' | 'contrato'>('avulsa');
  // Contrato de Manutenção SLA — atendimento direto (sem passar pelo portal do cliente).
  // Um cliente pode ter mais de um contrato ativo (ex: unidades/plantas diferentes).
  const [contratosAtivos, setContratosAtivos] = useState<ContratoSLA[]>([]);
  const [contratoSlaIdSelecionado, setContratoSlaIdSelecionado] = useState('');
  const [prioridadeSla, setPrioridadeSla] = useState<PrioridadeSLA>('P3');
  const contratoSelecionado = contratosAtivos.find(c => c.id === contratoSlaIdSelecionado) || null;

  // Hub de Tarefas do Projeto — itens do backlog disponíveis para distribuir
  const [backlogItens, setBacklogItens] = useState<BacklogTarefa[]>([]);
  const [backlogSelecionados, setBacklogSelecionados] = useState<Set<string>>(new Set());

  // Informações Adicionais — instrução + arquivos de apoio (novos ou já do projeto)
  const [infoTexto, setInfoTexto] = useState('');
  const [novosArquivos, setNovosArquivos] = useState<File[]>([]);
  const [projectDocs, setProjectDocs] = useState<ProjectDocument[]>([]);
  const [docsSelecionados, setDocsSelecionados] = useState<Set<string>>(new Set());
  const infoArquivoRef = useRef<HTMLInputElement>(null);
  const [assigneeId, setAssigneeId] = useState('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Criação rápida de cliente
  const [showQuickClient, setShowQuickClient] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [savingQuickClient, setSavingQuickClient] = useState(false);
  const quickClientInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showQuickClient) setTimeout(() => quickClientInputRef.current?.focus(), 50);
  }, [showQuickClient]);

  const handleCreateQuickClient = async () => {
    const nome = quickClientName.trim();
    if (!nome) return;
    setSavingQuickClient(true);
    try {
      const ref = await addDoc(collection(db, CollectionName.CLIENTS), {
        name: nome,
        dadosIncompletos: true,
        createdAt: serverTimestamp(),
      });
      const newClient = { id: ref.id, name: nome, dadosIncompletos: true };
      setClients(prev => [...prev, newClient]);
      setClientId(ref.id);
      setQuickClientName('');
      setShowQuickClient(false);
    } catch {
      alert('Erro ao criar cliente. Tente novamente.');
    } finally {
      setSavingQuickClient(false);
    }
  };
  
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

  // Pré-preenchimento vindo de um chamado de contrato SLA convertido em O.S.
  useEffect(() => {
    if (isOpen && prefill) {
      setTitle(prefill.title || '');
      setDescription(prefill.description || '');
      setClientId(prefill.clientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Sprint 44 — load ativos when client changes
  useEffect(() => {
    if (!clientId) { setAtivos([]); setAtivoId(''); return; }
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(snap => setAtivos(snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  // Contrato(s) SLA ativo(s) do cliente selecionado — um cliente pode ter mais de um.
  // Trocar de cliente reseta o tipo de O.S. e as seleções de projeto/contrato, já
  // que elas pertencem ao cliente anterior.
  useEffect(() => {
    setTipoOSSelecionado('avulsa');
    setProjectId('');
    setFaturamentoPeloProjeto(false);
    setContratoSlaIdSelecionado('');
    if (!clientId) { setContratosAtivos([]); return; }
    getDocs(query(
      collection(db, CollectionName.CONTRATOS_SLA),
      where('clientId', '==', clientId),
      where('status', '==', 'ativo'),
    ))
      .then(snap => {
        const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as ContratoSLA));
        setContratosAtivos(lista);
        // Se veio de um chamado convertido, já seleciona o tipo "Contrato SLA" e o contrato/prioridade indicados.
        if (prefill && prefill.clientId === clientId) {
          setTipoOSSelecionado('contrato');
          setContratoSlaIdSelecionado(prefill.contratoSlaId || lista[0]?.id || '');
          if (prefill.prioridadeSla) setPrioridadeSla(prefill.prioridadeSla);
        }
      })
      .catch(() => setContratosAtivos([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Hub de Tarefas — carrega itens do backlog do projeto (status 'backlog')
  useEffect(() => {
    setBacklogSelecionados(new Set());
    if (!projectId) { setBacklogItens([]); return; }
    getDocs(query(
      collection(db, CollectionName.PROJECT_TASK_BACKLOG),
      where('projectId', '==', projectId),
      where('status', '==', 'backlog'),
    ))
      .then(snap => setBacklogItens(snap.docs.map(d => ({ id: d.id, ...d.data() } as BacklogTarefa))))
      .catch(() => setBacklogItens([]));
  }, [projectId]);

  const toggleBacklogItem = (id: string) => {
    setBacklogSelecionados(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  // Informações Adicionais — carrega arquivos já existentes do projeto
  // (PROJECT_DOCS já é estruturalmente só suporte técnico — cotação, contrato
  // e apresentação vivem em coleções próprias e nunca aparecem aqui).
  useEffect(() => {
    setDocsSelecionados(new Set());
    if (!projectId) { setProjectDocs([]); return; }
    getDocs(query(collection(db, CollectionName.PROJECT_DOCS), where('projectId', '==', projectId)))
      .then(snap => setProjectDocs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectDocument))))
      .catch(() => setProjectDocs([]));
  }, [projectId]);

  const toggleProjectDoc = (id: string) => {
    setDocsSelecionados(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const addNovosArquivos = (files: FileList | null) => {
    if (!files?.length) return;
    setNovosArquivos(prev => [...prev, ...Array.from(files)]);
  };
  const removerNovoArquivo = (i: number) => setNovosArquivos(prev => prev.filter((_, idx) => idx !== i));

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

  // Load all projects (from all collections) — each query independent to avoid one failure killing all
  useEffect(() => {
    (async () => {
      const fetch = async (col: string) => {
        try {
          const snap = await getDocs(collection(db, col));
          return snap.docs.map(d => ({ id: d.id, name: (d.data() as any).nome || (d.data() as any).name, ...(d.data() as any) }));
        } catch (e) { console.warn(`[OSCreate] Failed to load ${col}:`, e); return []; }
      };
      const [p2s, ps] = await Promise.all([
        fetch(CollectionName.PROJECTS_V2),
        fetch(CollectionName.PROJECTS),
      ]);
      const seen = new Set<string>();
      const all: any[] = [];
      [...p2s, ...ps].forEach(p => { if (!seen.has(p.id)) { seen.add(p.id); all.push(p); } });
      setProjects(all);
    })();
  }, []);

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

      // Gerar número sequencial para rastreabilidade
      const numeroOS = await gerarNumeroOS();

      const taskPayload = {
        numeroOS,
        title: title || numeroOS,
        description,
        status: 'pending',
        priority,
        workflowStatus: WorkflowStatus.AGUARDANDO_APROVACAO,
        fonteAbertura: 'MODAL_COMPLETO' as const,
        dadosCompletos: true,
        clientId,
        clientName,
        projectId: tipoOSSelecionado === 'projeto' ? projectId : '',
        projectName: tipoOSSelecionado === 'projeto' ? projectName : '',
        faturamentoPeloProjeto: tipoOSSelecionado === 'projeto' && !!(projectId && faturamentoPeloProjeto),
        ...(tipoOSSelecionado === 'contrato' && contratoSelecionado ? {
          tipoOrigemOS: 'contrato_sla' as const,
          contratoSlaId: contratoSelecionado.id,
          prioridadeSla,
          prazoSlaLimite: Timestamp.fromDate(new Date(Date.now() + contratoSelecionado.prazosPrioridade[prioridadeSla] * 3600 * 1000)),
        } : {}),
        assignedTo: assigneeId || null,
        assigneeName: assigneeId ? assigneeName : null,
        assignedUsers,
        assignedUserNames,
        startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
        tarefasOS: [
          ...checklist.map(item => ({
            id:          item.id,
            descricao:   item.text,
            status:      item.completed ? 'concluida' : 'pendente',
            iniciadaEm:  null,
            concluidaEm: null,
            fotoSlots:   (item as any).fotoSlots ?? [],
          })),
          ...backlogItens.filter(b => backlogSelecionados.has(b.id)).map(b => ({
            id:          `backlog_${b.id}`,
            descricao:   b.descricao,
            status:      'pendente',
            iniciadaEm:  null,
            concluidaEm: null,
            fotoSlots:   [],
            backlogId:   b.id,
          })),
        ],
        tools,
        tipoServico: tipoServico || null,
        ativoId: ativoId || null,
        ativoNome: ativoNome || null,
        ponto: { permiteEntrada: pontoEntrada, permiteSaida: pontoSaida },
        ...((infoTexto.trim() || docsSelecionados.size > 0) ? {
          informacoesAdicionais: {
            texto: infoTexto.trim() || undefined,
            arquivos: projectDocs.filter(d => docsSelecionados.has(d.id)).map(d => ({
              url: d.url, nome: d.nome, tipo: d.tipo, projectDocId: d.id,
            } as OSArquivoApoio)),
          },
        } : {}),
        createdAt: serverTimestamp()
      };

      const ref = await addDoc(collection(db, CollectionName.TASKS), taskPayload);

      // Marca os itens do backlog selecionados como distribuídos nesta O.S.
      const backlogSelecionadosArr = backlogItens.filter(b => backlogSelecionados.has(b.id));
      for (const item of backlogSelecionadosArr) {
        updateDoc(doc(db, CollectionName.PROJECT_TASK_BACKLOG, item.id), {
          status: 'em_os',
          osDestinoId: ref.id,
        }).catch(() => {});
      }

      // Informações Adicionais: novos arquivos — sobem para o Storage, entram
      // no histórico de documentos do projeto E ficam vinculados à O.S.
      if (novosArquivos.length > 0) {
        try {
          const nomeAutor = (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Gestor';
          const uploads: OSArquivoApoio[] = [];
          for (const file of novosArquivos) {
            const path = `os_evidencias/${ref.id}/informacoes-adicionais/${Date.now()}_${file.name}`;
            const snap = await uploadBytes(storageRef(storage, path), file);
            const url = await getDownloadURL(snap.ref);
            const tipo = tipoArquivoFromName(file.name);
            uploads.push({ url, nome: file.name, tipo });

            if (projectId) {
              await addDoc(collection(db, CollectionName.PROJECT_DOCS), {
                projectId,
                nome: file.name,
                tipo,
                url,
                tamanhoBytes: file.size,
                uploadPor: currentUser?.uid || '',
                uploadPorNome: nomeAutor,
                uploadEm: serverTimestamp(),
                origemOsId: ref.id,
              });
            }
          }
          const existentes = projectDocs.filter(d => docsSelecionados.has(d.id)).map(d => ({
            url: d.url, nome: d.nome, tipo: d.tipo, projectDocId: d.id,
          } as OSArquivoApoio));
          await updateDoc(doc(db, CollectionName.TASKS, ref.id), {
            informacoesAdicionais: {
              texto: infoTexto.trim() || undefined,
              arquivos: [...existentes, ...uploads],
            },
          });
        } catch {
          // Falha no upload não deve impedir a criação da O.S. — o gestor pode reenviar depois via edição.
        }
      }

      registrarAtividade({
        tipo: 'os_aberta',
        autorId: currentUser?.uid ?? 'web',
        autorNome: (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Gestor',
        titulo: `O.S. criada: ${taskPayload.title || numeroOS}`,
        descricao: clientName ? `Cliente: ${clientName}` : undefined,
        osId: ref.id,
        osNumero: taskPayload.numeroOS,
        osTitulo: taskPayload.title || taskPayload.numeroOS,
        clienteNome: clientName || undefined,
        meta: { ambiente: 'web' },
      });

      // Upsert tipo de serviço
      if (tipoServico.trim()) {
        try {
          const tSnap = await getDocs(query(collection(db, CollectionName.SERVICE_TYPES), where('nome', '==', tipoServico.trim())));
          if (tSnap.empty) await addDoc(collection(db, CollectionName.SERVICE_TYPES), { nome: tipoServico.trim(), usoCount: 1, criadoEm: Timestamp.now() });
        } catch { /* silent */ }
      }
      onSuccess(ref.id);
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
            <div className="bg-brand-50 p-4 rounded-xl border border-brand-100">
              <div className="flex items-center gap-4">
                <FileText className="text-brand-600 w-5 h-5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-brand-800">Carregar Modelo (Template)</label>
                    <button
                      type="button"
                      onClick={() => { onClose(); navigate('/app/modelos'); }}
                      className="flex items-center gap-1 text-[10px] font-bold text-brand-600 hover:text-brand-800 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Gerenciar modelos
                    </button>
                  </div>
                  {templates.length > 0 ? (
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
                  ) : (
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-brand-500 italic">Nenhum modelo cadastrado.</span>
                      <button
                        type="button"
                        onClick={() => { onClose(); navigate('/app/modelos'); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg hover:bg-brand-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Criar modelo
                      </button>
                    </div>
                  )}
                </div>
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
                    <div className="flex gap-1.5">
                      <select
                        value={clientId}
                        onChange={(e) => setClientId(e.target.value)}
                        className="flex-1 min-w-0 rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900 text-sm"
                      >
                        <option value="">Selecione...</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}{c.dadosIncompletos ? ' ⚠' : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowQuickClient(v => !v)}
                        title="Criar cliente rápido"
                        className={`flex-shrink-0 p-2 rounded-lg border transition-colors ${showQuickClient ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-brand-600 border-gray-300 hover:bg-brand-50'}`}
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Mini-form criação rápida */}
                    {showQuickClient && (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                        <p className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                          <AlertTriangle className="w-3 h-3" /> Novo cliente (dados incompletos)
                        </p>
                        <input
                          ref={quickClientInputRef}
                          type="text"
                          value={quickClientName}
                          onChange={e => setQuickClientName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreateQuickClient(); } if (e.key === 'Escape') setShowQuickClient(false); }}
                          placeholder="Nome do cliente..."
                          className="w-full rounded-lg border-amber-200 bg-white text-gray-900 text-sm px-3 py-1.5 focus:ring-amber-400 focus:border-amber-400"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleCreateQuickClient}
                            disabled={!quickClientName.trim() || savingQuickClient}
                            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                          >
                            {savingQuickClient ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => { setShowQuickClient(false); setQuickClientName(''); }}
                            className="px-3 py-1.5 border border-amber-200 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                        <p className="text-[9px] text-amber-600">O cliente será salvo com alerta de cadastro incompleto. Complete os dados depois em Clientes.</p>
                      </div>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de O.S.</label>
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                      {([
                        { key: 'avulsa',   label: 'Avulsa' },
                        { key: 'projeto',  label: 'Projeto' },
                        { key: 'contrato', label: 'Contrato SLA' },
                      ] as const).map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setTipoOSSelecionado(opt.key);
                            if (opt.key !== 'projeto') { setProjectId(''); setFaturamentoPeloProjeto(false); }
                            if (opt.key !== 'contrato') { setContratoSlaIdSelecionado(''); }
                          }}
                          className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${
                            tipoOSSelecionado === opt.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {tipoOSSelecionado === 'projeto' && (
                    <>
                      <div className="col-span-2">
                        <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                          <Briefcase className="w-4 h-4 mr-1 text-gray-400" /> Projeto
                        </label>
                        <select
                          value={projectId}
                          onChange={(e) => {
                            setProjectId(e.target.value);
                            if (!e.target.value) setFaturamentoPeloProjeto(false);
                          }}
                          className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                        >
                          <option value="">Selecione o projeto...</option>
                          {(() => {
                            const clientProjects = clientId ? projects.filter(p => p.clientId === clientId) : [];
                            const otherProjects = clientId ? projects.filter(p => p.clientId !== clientId) : projects;
                            return (<>
                              {clientProjects.length > 0 && (
                                <optgroup label="Projetos do cliente">
                                  {clientProjects.map(p => <option key={p.id} value={p.id}>{p.name || p.nome}</option>)}
                                </optgroup>
                              )}
                              {otherProjects.length > 0 && (
                                <optgroup label={clientProjects.length > 0 ? 'Outros projetos' : 'Todos os projetos'}>
                                  {otherProjects.map(p => <option key={p.id} value={p.id}>{p.name || p.nome}{p.clientName ? ` (${p.clientName})` : ''}</option>)}
                                </optgroup>
                              )}
                            </>);
                          })()}
                        </select>
                        {clientId && projects.filter(p => p.clientId === clientId).length === 0 && (
                          <p className="text-[10px] text-amber-600 mt-1">Este cliente não tem projetos cadastrados ainda.</p>
                        )}
                      </div>
                      {projectId && (
                        <div className="col-span-2">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={faturamentoPeloProjeto}
                              onChange={e => setFaturamentoPeloProjeto(e.target.checked)}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-600">Faturamento pelo projeto <span className="text-xs text-gray-400">(O.S. não gera cobrança individual)</span></span>
                          </label>
                        </div>
                      )}
                    </>
                  )}

                  {tipoOSSelecionado === 'contrato' && (
                    <div className="col-span-2 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3 space-y-3">
                      {contratosAtivos.length === 0 ? (
                        <p className="text-xs text-indigo-700">
                          {clientId ? 'Este cliente não tem contrato SLA ativo. Cadastre um em Clientes → Contrato SLA.' : 'Selecione um cliente para ver os contratos ativos.'}
                        </p>
                      ) : (
                        <>
                          <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">Contrato</label>
                            <select
                              value={contratoSlaIdSelecionado}
                              onChange={e => setContratoSlaIdSelecionado(e.target.value)}
                              className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 text-sm"
                            >
                              <option value="">Selecione o contrato...</option>
                              {contratosAtivos.map(c => (
                                <option key={c.id} value={c.id}>{c.identificador || `Contrato ${c.id.slice(0, 6)}`}</option>
                              ))}
                            </select>
                          </div>
                          {contratoSelecionado && (
                            <div>
                              <label className="text-xs font-bold text-gray-500 mb-1 block">Prioridade</label>
                              <select
                                value={prioridadeSla}
                                onChange={e => setPrioridadeSla(e.target.value as PrioridadeSLA)}
                                className="w-full rounded-lg border-gray-300 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-gray-900 text-sm"
                              >
                                {(['P1', 'P2', 'P3', 'P4'] as PrioridadeSLA[]).map(p => (
                                  <option key={p} value={p}>{p} — resposta em {contratoSelecionado.prazosPrioridade[p]}h</option>
                                ))}
                              </select>
                            </div>
                          )}
                          <p className="text-[10px] text-indigo-500">O.S. não gera cobrança individual — já coberta pelo contrato.</p>
                        </>
                      )}
                    </div>
                  )}
                  {projectId && backlogItens.length > 0 && (
                    <div className="col-span-2 bg-brand-50/60 border border-brand-100 rounded-xl p-3">
                      <p className="text-xs font-bold text-brand-700 flex items-center gap-1.5 mb-2">
                        <ListTodo size={13} /> Tarefas do backlog do projeto ({backlogSelecionados.size} selecionada{backlogSelecionados.size !== 1 ? 's' : ''})
                      </p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {backlogItens.map(item => (
                          <label key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer">
                            <input
                              type="checkbox"
                              checked={backlogSelecionados.has(item.id)}
                              onChange={() => toggleBacklogItem(item.id)}
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="text-sm text-gray-700 flex-1">{item.descricao}</span>
                            {item.origem === 'nao_concluida' && (
                              <span className="text-[9px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">retomada</span>
                            )}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
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
                      {users.filter(u => u.ativo !== false).map(u => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}
                    </select>
                  </div>
                </div>

                {/* Multi-Assignee Selection */}
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                   <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                      <Users className="w-4 h-4 mr-1 text-gray-400" /> Colaboradores Adicionais
                   </label>
                   <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                      {users.filter(u => u.ativo !== false).map(u => (
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

                {/* Informações Adicionais — instrução + arquivos de apoio para o técnico */}
                <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
                  <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
                    <Paperclip className="w-4 h-4 text-brand-500" />
                    <label className="text-sm font-bold text-gray-700">Informações Adicionais</label>
                    <span className="text-[10px] text-gray-400 ml-1">(opcional)</span>
                  </div>
                  <div className="p-3 space-y-3">
                    <textarea
                      value={infoTexto}
                      onChange={e => setInfoTexto(e.target.value)}
                      placeholder="Instrução rápida para o técnico (ex: seguir planta baixa em anexo, atenção ao ponto X do croqui...)"
                      rows={2}
                      className="w-full text-sm rounded-lg border-gray-200 bg-white text-gray-900 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />

                    {/* Upload de arquivo novo */}
                    <div>
                      <button
                        type="button"
                        onClick={() => infoArquivoRef.current?.click()}
                        className="flex items-center gap-1.5 text-xs font-bold text-brand-600 bg-brand-50 border border-brand-100 rounded-lg px-3 py-1.5 hover:bg-brand-100"
                      >
                        <Plus className="w-3.5 h-3.5" /> Anexar foto, vídeo ou arquivo
                      </button>
                      <input
                        ref={infoArquivoRef} type="file" multiple accept="image/*,video/*,.pdf" className="hidden"
                        onChange={e => { addNovosArquivos(e.target.files); e.target.value = ''; }}
                      />
                      {novosArquivos.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {novosArquivos.map((f, i) => (
                            <span key={i} className="flex items-center gap-1.5 text-xs bg-white border border-gray-200 rounded-lg px-2 py-1">
                              {f.type.startsWith('video') ? <Video className="w-3 h-3 text-gray-400" /> : f.type.startsWith('image') ? <ImageIcon className="w-3 h-3 text-gray-400" /> : <FileText className="w-3 h-3 text-gray-400" />}
                              <span className="max-w-[140px] truncate">{f.name}</span>
                              <button type="button" onClick={() => removerNovoArquivo(i)} className="text-gray-400 hover:text-red-500">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">Novos arquivos ficam salvos no histórico de documentos do projeto.</p>
                    </div>

                    {/* Selecionar arquivos já existentes do projeto */}
                    {projectId && projectDocs.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Arquivos já existentes no projeto</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {projectDocs.map(d => {
                            const sel = docsSelecionados.has(d.id);
                            return (
                              <label key={d.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer border ${sel ? 'border-brand-300 bg-brand-50' : 'border-transparent hover:bg-gray-100'}`}>
                                <input type="checkbox" checked={sel} onChange={() => toggleProjectDoc(d.id)} className="w-3.5 h-3.5 accent-brand-600" />
                                {d.tipo === 'video' ? <Video className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : d.tipo === 'imagem' ? <ImageIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                                <span className="text-xs text-gray-700 truncate flex-1">{d.nome}</span>
                                {sel && <Check className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
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
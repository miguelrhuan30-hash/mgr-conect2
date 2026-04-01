/**
 * components/Projects.tsx — Sprint 47
 *
 * Módulo completo de Projetos dentro do sistema de O.S.
 * CRUD de projetos, upload de documentos (PDF/imagens), vinculação de O.S.,
 * divisão em O.S. diárias e cálculo de progresso geral.
 */
import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, Timestamp, getDocs, where, arrayUnion
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, ProjectFull, ProjectDocument, Task, Client
} from '../types';
import {
  Briefcase, Plus, Search, Loader2, X, Save, Upload, FileText,
  Image, Trash2, ChevronDown, ChevronUp, Calendar, Building2,
  ClipboardList, BarChart3, Eye, ListFilter, FolderOpen, AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Firebase Storage import with fallback
let storage: any = null;
try {
  const storageModule = require('../firebase');
  storage = storageModule.storage;
} catch { /* storage not configured */ }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  planejamento: { label: 'Planejamento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  em_andamento: { label: 'Em Andamento', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  concluido:    { label: 'Concluído',    color: 'bg-green-100 text-green-700 border-green-200' },
  cancelado:    { label: 'Cancelado',    color: 'bg-red-100 text-red-700 border-red-200' },
};

/* ─── Project Form Modal ────────────────────────────────────────────────── */
const ProjectFormModal: React.FC<{
  project?: ProjectFull | null;
  clients: Client[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}> = ({ project, clients, onSave, onClose }) => {
  const [nome,         setNome]         = useState(project?.nome || '');
  const [descricao,    setDescricao]    = useState(project?.descricao || '');
  const [clientId,     setClientId]     = useState(project?.clientId || '');
  const [clientName,   setClientName]   = useState(project?.clientName || '');
  const [status,       setStatus]       = useState(project?.status || 'planejamento');
  const [dataInicio,   setDataInicio]   = useState(() => {
    if (project?.dataInicio) return new Date((project.dataInicio as any).toMillis()).toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  });
  const [dataPrevista, setDataPrevista] = useState(() => {
    if (project?.dataPrevista) return new Date((project.dataPrevista as any).toMillis()).toISOString().slice(0, 10);
    return '';
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !clientId) return;
    setSaving(true);
    try {
      await onSave({
        nome, descricao, clientId, clientName, status,
        dataInicio: dataInicio ? Timestamp.fromDate(new Date(dataInicio)) : null,
        dataPrevista: dataPrevista ? Timestamp.fromDate(new Date(dataPrevista)) : null,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-brand-600" />
            {project ? 'Editar Projeto' : 'Novo Projeto'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Nome do Projeto *</label>
            <input required value={nome} onChange={e => setNome(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" placeholder="Ex: Retrofit Supermercado Central" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Cliente *</label>
            <select required value={clientId} onChange={e => {
              const c = clients.find(x => x.id === e.target.value);
              setClientId(e.target.value); setClientName(c?.name || '');
            }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              <option value="">Selecione...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as any)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Início</label>
              <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Previsão conclusão</label>
              <input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">Cancelar</button>
            <button type="submit" disabled={saving || !nome.trim() || !clientId}
              className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {project ? 'Salvar' : 'Criar Projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ─── Generate Daily OS Modal ───────────────────────────────────────────── */
const GenerateOSModal: React.FC<{
  project: ProjectFull;
  onClose: () => void;
  onGenerated: () => void;
}> = ({ project, onClose, onGenerated }) => {
  const { currentUser, userProfile } = useAuth();
  const [numDias,      setNumDias]      = useState(5);
  const [tarefasPorDia, setTarefasPorDia] = useState(3);
  const [dataInicio,   setDataInicio]   = useState(new Date().toISOString().slice(0, 10));
  const [descBase,     setDescBase]     = useState(project.descricao || '');
  const [generating,   setGenerating]   = useState(false);

  const handleGenerate = async () => {
    if (!currentUser) return;
    setGenerating(true);
    try {
      const osIds: string[] = [];
      for (let i = 0; i < numDias; i++) {
        const date = new Date(dataInicio);
        date.setDate(date.getDate() + i);
        const tarefas = Array.from({ length: tarefasPorDia }, (_, j) => ({
          id: `tarefa_${Date.now()}_${i}_${j}`,
          descricao: `Tarefa ${j + 1} - Dia ${i + 1}`,
          status: 'pendente',
          fotoSlots: [
            { id: 'antes', titulo: 'Foto Antes', instrucao: 'Antes', obrigatoria: true, ordem: 0 },
            { id: 'depois', titulo: 'Foto Depois', instrucao: 'Depois', obrigatoria: true, ordem: 1 },
          ],
          fotosEvidencia: [],
        }));

        const osRef = await addDoc(collection(db, CollectionName.TASKS), {
          title: `${project.nome} - Dia ${i + 1}`,
          description: descBase,
          status: 'pending',
          priority: 'medium',
          clientId: project.clientId,
          clientName: project.clientName,
          projectId: project.id,
          projectName: project.nome,
          tarefasOS: tarefas,
          startDate: Timestamp.fromDate(date),
          endDate: Timestamp.fromDate(date),
          scheduling: { dataPrevista: Timestamp.fromDate(date) },
          workflowStatus: 'TRIAGEM',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        osIds.push(osRef.id);
      }

      // Update project with generated OS IDs
      await updateDoc(doc(db, CollectionName.OS_PROJECTS, project.id), {
        osIds: arrayUnion(...osIds),
        totalOSPrevistas: (project.totalOSPrevistas || 0) + numDias,
        updatedAt: serverTimestamp(),
      });

      onGenerated();
      onClose();
    } catch (e) {
      console.error('Error generating OS:', e);
      alert('Erro ao gerar O.S. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-brand-600" /> Gerar O.S. do Projeto
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <p className="text-xs text-gray-500">
          Cria múltiplas O.S. diárias automaticamente vinculadas ao projeto <strong>{project.nome}</strong>.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Nº de dias</label>
            <input type="number" min={1} max={30} value={numDias} onChange={e => setNumDias(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Tarefas/dia</label>
            <input type="number" min={1} max={20} value={tarefasPorDia} onChange={e => setTarefasPorDia(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">Data início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">Descrição base das O.S.</label>
          <textarea value={descBase} onChange={e => setDescBase(e.target.value)} rows={2}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          Serão criadas <strong>{numDias}</strong> Ordens de Serviço, cada uma com <strong>{tarefasPorDia}</strong> tarefas, totalizando <strong>{numDias * tarefasPorDia}</strong> tarefas.
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-500">Cancelar</button>
          <button onClick={handleGenerate} disabled={generating}
            className="flex-1 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Gerar {numDias} O.S.
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Project Detail View ───────────────────────────────────────────────── */
const ProjectDetail: React.FC<{
  project: ProjectFull;
  linkedTasks: Task[];
  documents: ProjectDocument[];
  onBack: () => void;
  onEdit: () => void;
  onGenerateOS: () => void;
  onUploadDoc: (file: File) => Promise<void>;
  onDeleteDoc: (docId: string) => void;
}> = ({ project, linkedTasks, documents, onBack, onEdit, onGenerateOS, onUploadDoc, onDeleteDoc }) => {
  const [uploading, setUploading] = useState(false);
  const totalOS = linkedTasks.length;
  const completedOS = linkedTasks.filter(t => t.status === 'completed').length;
  const progressPct = totalOS > 0 ? Math.round((completedOS / totalOS) * 100) : 0;
  const statusInfo = STATUS_LABELS[project.status] || STATUS_LABELS.planejamento;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try { await onUploadDoc(file); } finally { setUploading(false); }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500"><X size={18} /></button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{project.nome}</h2>
            <p className="text-xs text-gray-500 flex items-center gap-2">
              <Building2 size={11} /> {project.clientName}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusInfo.color}`}>{statusInfo.label}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={onGenerateOS} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-bold">
            <ClipboardList size={14} /> Gerar O.S.
          </button>
          <button onClick={onEdit} className="px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-50">Editar</button>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Progresso Geral</span>
          <span className="text-sm font-extrabold text-gray-900">{progressPct}%</span>
        </div>
        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${progressPct >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400">
          <span>{completedOS} de {totalOS} O.S. concluídas</span>
          {project.dataPrevista && <span>Prazo: {format((project.dataPrevista as any).toDate(), 'dd/MM/yyyy', { locale: ptBR })}</span>}
        </div>
      </div>

      {/* Description */}
      {project.descricao && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Descrição</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.descricao}</p>
        </div>
      )}

      {/* Documents */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <FolderOpen size={13} /> Documentos ({documents.length})
          </h3>
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-200">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Nenhum documento anexado.</p>
        ) : (
          <div className="space-y-2">
            {documents.map(d => (
              <div key={d.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                {d.tipo === 'pdf' ? <FileText size={16} className="text-red-500" /> : <Image size={16} className="text-blue-500" />}
                <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 text-sm font-medium text-gray-700 truncate hover:text-brand-600">{d.nome}</a>
                <span className="text-[9px] text-gray-400">{format((d.uploadEm as any).toDate(), 'dd/MM/yy')}</span>
                <button onClick={() => onDeleteDoc(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked OS */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <ClipboardList size={13} /> O.S. Vinculadas ({linkedTasks.length})
        </h3>
        {linkedTasks.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Nenhuma O.S. vinculada. Use "Gerar O.S." para criar.</p>
        ) : (
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {linkedTasks.map(t => {
              const taskProgress = t.tarefasOS && t.tarefasOS.length > 0
                ? Math.round(t.tarefasOS.filter((x: any) => x.status === 'concluida').length / t.tarefasOS.length * 100) : 0;
              return (
                <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.status === 'completed' ? 'bg-green-500' : t.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    {t.startDate && <p className="text-[10px] text-gray-400">{format((t.startDate as any).toDate(), 'dd/MM/yyyy', { locale: ptBR })}</p>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${taskProgress >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${taskProgress}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-gray-400">{taskProgress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main Projects ─────────────────────────────────────────────────────── */
const Projects: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [projects, setProjects]   = useState<ProjectFull[]>([]);
  const [tasks,    setTasks]      = useState<Task[]>([]);
  const [clients,  setClients]    = useState<Client[]>([]);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [search,   setSearch]     = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editProject, setEditProject] = useState<ProjectFull | null>(null);
  const [viewProject, setViewProject] = useState<ProjectFull | null>(null);
  const [showGenerateOS, setShowGenerateOS] = useState(false);

  useEffect(() => {
    // Load projects
    const unsub1 = onSnapshot(
      query(collection(db, CollectionName.OS_PROJECTS), orderBy('createdAt', 'desc')),
      snap => { setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectFull))); setLoading(false); },
      () => setLoading(false)
    );
    // Load all tasks for linking
    const unsub2 = onSnapshot(
      query(collection(db, CollectionName.TASKS), orderBy('createdAt', 'desc')),
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)))
    );
    // Load clients
    getDocs(collection(db, CollectionName.CLIENTS))
      .then(snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))))
      .catch(() => {});
    // Load documents
    const unsub3 = onSnapshot(
      collection(db, CollectionName.PROJECT_DOCS),
      snap => setDocuments(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectDocument)))
    );
    return () => { unsub1(); unsub2(); unsub3(); };
  }, []);

  const filteredProjects = projects.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  const getLinkedTasks = (projectId: string) => tasks.filter(t => (t as any).projectId === projectId);
  const getProjectDocs = (projectId: string) => documents.filter(d => d.projectId === projectId);

  const handleSaveProject = async (data: any) => {
    if (!currentUser) return;
    if (editProject) {
      await updateDoc(doc(db, CollectionName.OS_PROJECTS, editProject.id), { ...data, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, CollectionName.OS_PROJECTS), {
        ...data,
        osIds: [],
        totalOSPrevistas: 0,
        totalOSConcluidas: 0,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
      });
    }
    setEditProject(null);
    setShowForm(false);
  };

  const handleUploadDoc = async (file: File) => {
    if (!currentUser || !viewProject || !storage) {
      alert('Storage não configurado.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const tipo = ext === 'pdf' ? 'pdf' : ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'imagem' : 'outro';
    const storageRef = ref(storage, `projects/${viewProject.id}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await addDoc(collection(db, CollectionName.PROJECT_DOCS), {
      projectId: viewProject.id,
      nome: file.name,
      tipo,
      url,
      tamanhoBytes: file.size,
      uploadPor: currentUser.uid,
      uploadPorNome: userProfile?.displayName || '',
      uploadEm: serverTimestamp(),
    });
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Excluir este documento?')) return;
    await deleteDoc(doc(db, CollectionName.PROJECT_DOCS, docId));
  };

  // Detail view
  if (viewProject) {
    const p = projects.find(x => x.id === viewProject.id) || viewProject;
    return (
      <div className="max-w-5xl mx-auto pb-8">
        <ProjectDetail
          project={p}
          linkedTasks={getLinkedTasks(p.id)}
          documents={getProjectDocs(p.id)}
          onBack={() => setViewProject(null)}
          onEdit={() => { setEditProject(p); setShowForm(true); }}
          onGenerateOS={() => setShowGenerateOS(true)}
          onUploadDoc={handleUploadDoc}
          onDeleteDoc={handleDeleteDoc}
        />
        {showGenerateOS && (
          <GenerateOSModal project={p} onClose={() => setShowGenerateOS(false)} onGenerated={() => {}} />
        )}
        {showForm && (
          <ProjectFormModal project={editProject} clients={clients} onSave={handleSaveProject}
            onClose={() => { setShowForm(false); setEditProject(null); }} />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand-600" /> Projetos
          </h1>
          <p className="text-sm text-gray-500">Gerencie projetos e divida em O.S. diárias</p>
        </div>
        <button onClick={() => { setEditProject(null); setShowForm(true); }}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-bold shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Projeto
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Buscar projeto..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <ListFilter size={13} /> <span className="font-bold">{filteredProjects.length}</span> projetos
        </div>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">Nenhum projeto</h3>
          <p className="text-sm text-gray-500">Crie seu primeiro projeto para organizar suas O.S.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map(p => {
            const linked = getLinkedTasks(p.id);
            const done = linked.filter(t => t.status === 'completed').length;
            const pct = linked.length > 0 ? Math.round((done / linked.length) * 100) : 0;
            const statusInfo = STATUS_LABELS[p.status] || STATUS_LABELS.planejamento;
            return (
              <div key={p.id}
                onClick={() => setViewProject(p)}
                className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-brand-200 transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{p.nome}</h3>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                      <Building2 size={10} /> {p.clientName}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${pct >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{pct}%</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-400">
                  <span>{linked.length} O.S. vinculadas</span>
                  {p.dataPrevista && <span className="flex items-center gap-1"><Calendar size={9} /> {format((p.dataPrevista as any).toDate(), 'dd/MM/yy', { locale: ptBR })}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <ProjectFormModal project={editProject} clients={clients} onSave={handleSaveProject}
          onClose={() => { setShowForm(false); setEditProject(null); }} />
      )}
    </div>
  );
};

export default Projects;
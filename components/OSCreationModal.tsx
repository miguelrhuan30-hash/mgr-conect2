import React, { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, PriorityLevel, ChecklistItem, TaskTemplate } from '../types';
import { X, Plus, Trash2, FileText, Calendar, User, Building, Briefcase, ListTodo, Save, Loader2, Wrench, Camera, AlignLeft } from 'lucide-react';

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Advanced State
  const [tools, setTools] = useState<string[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');

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
          // Fetch Clients
          const clientsSnap = await getDocs(collection(db, CollectionName.CLIENTS));
          setClients(clientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Users
          const usersSnap = await getDocs(collection(db, CollectionName.USERS));
          setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

          // Fetch Templates
          const tplSnap = await getDocs(collection(db, CollectionName.TASK_TEMPLATES));
          setTemplates(tplSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TaskTemplate)));

        } catch (error) {
          console.error("Error loading form data:", error);
        } finally {
          setLoadingData(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

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
        setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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

  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setChecklist([...checklist, {
      id: Math.random().toString(36).substr(2, 9),
      text: newChecklistItem.trim(),
      completed: false,
      evidenceRequired: 'NONE'
    }]);
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
      const assigneeName = users.find(u => u.id === assigneeId)?.displayName || 'Não Atribuído';

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
        startDate: startDate ? Timestamp.fromDate(new Date(startDate)) : null,
        endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : null,
        checklist,
        tools, // Save tools
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, CollectionName.TASKS), taskPayload);
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
                  className="block w-full text-sm rounded-lg border-brand-200 focus:ring-brand-500 focus:border-brand-500 bg-white"
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
                    className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
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
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
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
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 disabled:bg-gray-100"
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
                    className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 resize-none"
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
              </div>

              {/* Right Column */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                    <select 
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
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
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="">Selecione...</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" /> Início Previsto
                    </label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border-gray-300 text-sm"
                    />
                  </div>
                  <div>
                    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
                      <Calendar className="w-4 h-4 mr-1 text-gray-400" /> Prazo Final
                    </label>
                    <input
                      type="datetime-local"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border-gray-300 text-sm"
                    />
                  </div>
                </div>

                {/* Checklist Section */}
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                   <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
                      <ListTodo className="w-4 h-4 mr-1 text-brand-500" /> Checklist de Execução
                   </label>
                   
                   <div className="flex gap-2 mb-2">
                     <input 
                        type="text" 
                        value={newChecklistItem}
                        onChange={(e) => setNewChecklistItem(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addChecklistItem())}
                        placeholder="Adicionar item rápido..."
                        className="flex-1 text-sm rounded-md border-gray-300"
                     />
                     <button 
                        type="button" 
                        onClick={addChecklistItem}
                        className="p-2 bg-brand-100 text-brand-600 rounded-md hover:bg-brand-200"
                     >
                        <Plus size={16} />
                     </button>
                   </div>

                   <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {checklist.length === 0 && <p className="text-xs text-gray-400 italic">Nenhum item adicionado.</p>}
                      {checklist.map(item => (
                        <li key={item.id} className="text-sm bg-white p-2 rounded border border-gray-100 shadow-sm flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                             <span className="font-medium text-gray-800">{item.text}</span>
                             <button type="button" onClick={() => removeChecklistItem(item.id)} className="text-red-400 hover:text-red-600">
                               <Trash2 size={14} />
                             </button>
                          </div>
                          {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                          {item.evidenceRequired && item.evidenceRequired !== 'NONE' && (
                            <div className="flex items-center gap-1 mt-1">
                               <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded flex items-center gap-1 border border-blue-100">
                                  {item.evidenceRequired === 'PHOTO' && <Camera size={10} />}
                                  {item.evidenceRequired === 'TEXT' && <AlignLeft size={10} />}
                                  {item.evidenceRequired === 'BOTH' && <><Camera size={10}/><AlignLeft size={10}/></>}
                                  Requer Evidência
                               </span>
                            </div>
                          )}
                        </li>
                      ))}
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
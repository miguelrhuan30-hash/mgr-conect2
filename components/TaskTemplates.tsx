import React, { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TaskTemplate, EvidenceType } from '../types';
import { 
  FileText, Plus, Trash2, Save, Wrench, ListTodo, 
  Camera, AlignLeft, CheckSquare, X, Loader2, Copy
} from 'lucide-react';

const TaskTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tools, setTools] = useState<string[]>([]);
  const [newTool, setNewTool] = useState('');
  const [steps, setSteps] = useState<TaskTemplate['checklist']>([]);
  
  // New Step State
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDesc, setNewStepDesc] = useState('');
  const [newStepEvidence, setNewStepEvidence] = useState<EvidenceType>('NONE');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, CollectionName.TASK_TEMPLATES), orderBy('title', 'asc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })) as TaskTemplate[];
      setTemplates(data);
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTool = () => {
    if (newTool.trim()) {
      setTools([...tools, newTool.trim()]);
      setNewTool('');
    }
  };

  const handleRemoveTool = (index: number) => {
    setTools(tools.filter((_, i) => i !== index));
  };

  const handleAddStep = () => {
    if (newStepTitle.trim()) {
      setSteps([...steps, {
        id: Math.random().toString(36).substr(2, 9),
        title: newStepTitle.trim(),
        description: newStepDesc.trim(),
        evidenceRequired: newStepEvidence
      }]);
      setNewStepTitle('');
      setNewStepDesc('');
      setNewStepEvidence('NONE');
    }
  };

  const handleRemoveStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const handleDeleteTemplate = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este modelo?')) {
      try {
        await deleteDoc(doc(db, CollectionName.TASK_TEMPLATES, id));
        setTemplates(templates.filter(t => t.id !== id));
      } catch (error) {
        console.error("Error deleting template:", error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const payload: Omit<TaskTemplate, 'id'> = {
        title,
        description,
        tools,
        checklist: steps,
        createdAt: serverTimestamp() as any
      };
      
      const docRef = await addDoc(collection(db, CollectionName.TASK_TEMPLATES), payload);
      setTemplates([...templates, { id: docRef.id, ...payload }]);
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      console.error("Error saving template:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setTools([]);
    setSteps([]);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modelos de Tarefas</h1>
          <p className="text-gray-500">Padronize seus processos criando templates de O.S.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Modelo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.length === 0 && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Copy className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum modelo criado</h3>
              <p className="text-gray-500">Crie seu primeiro template para agilizar a abertura de O.S.</p>
            </div>
          )}
          {templates.map(template => (
            <div key={template.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-brand-50 rounded-lg text-brand-600">
                  <FileText className="w-6 h-6" />
                </div>
                <button 
                  onClick={() => handleDeleteTemplate(template.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">{template.title}</h3>
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 flex-1">{template.description}</p>
              
              <div className="space-y-2 border-t border-gray-100 pt-3">
                <div className="flex items-center text-xs text-gray-600">
                  <ListTodo className="w-3.5 h-3.5 mr-2 text-brand-500" />
                  {template.checklist.length} Etapas configuradas
                </div>
                <div className="flex items-center text-xs text-gray-600">
                  <Wrench className="w-3.5 h-3.5 mr-2 text-orange-500" />
                  {template.tools.length} Ferramentas necessárias
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE/EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">Criar Modelo de Tarefa</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <form id="template-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Título do Modelo</label>
                      <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full rounded-lg border-gray-300 bg-white text-gray-900" placeholder="Ex: Manutenção Preventiva" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Geral</label>
                      <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900" placeholder="Objetivo deste procedimento..." />
                    </div>
                  </div>

                  {/* Tools */}
                  <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                    <label className="flex items-center text-sm font-medium text-orange-800 mb-2">
                      <Wrench className="w-4 h-4 mr-2" /> Ferramentas e Materiais
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input 
                        type="text" 
                        value={newTool} 
                        onChange={e => setNewTool(e.target.value)} 
                        onKeyPress={e => e.key === 'Enter' && (e.preventDefault(), handleAddTool())}
                        className="flex-1 rounded-md border-orange-200 text-sm focus:ring-orange-500 focus:border-orange-500 bg-white text-gray-900" 
                        placeholder="Adicionar ferramenta..."
                      />
                      <button type="button" onClick={handleAddTool} className="p-2 bg-orange-200 text-orange-700 rounded-md hover:bg-orange-300"><Plus size={16}/></button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tools.map((tool, idx) => (
                        <span key={idx} className="bg-white border border-orange-200 text-orange-700 px-2 py-1 rounded-full text-xs flex items-center">
                          {tool}
                          <button type="button" onClick={() => handleRemoveTool(idx)} className="ml-1 hover:text-red-500"><X size={12}/></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Checklist Builder */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                    <ListTodo className="w-5 h-5 mr-2 text-brand-600" /> Etapas do Processo
                  </h3>
                  
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      <div className="md:col-span-5">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Título da Etapa</label>
                        <input type="text" value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)} className="w-full rounded-md border-gray-300 text-sm bg-white text-gray-900" placeholder="Ex: Verificar conexões" />
                      </div>
                      <div className="md:col-span-4">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Descrição (Opcional)</label>
                        <input type="text" value={newStepDesc} onChange={e => setNewStepDesc(e.target.value)} className="w-full rounded-md border-gray-300 text-sm bg-white text-gray-900" placeholder="Detalhes..." />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Evidência</label>
                        <select value={newStepEvidence} onChange={e => setNewStepEvidence(e.target.value as EvidenceType)} className="w-full rounded-md border-gray-300 text-sm bg-white text-gray-900">
                          <option value="NONE">Apenas Check</option>
                          <option value="PHOTO">Exigir Foto</option>
                          <option value="TEXT">Exigir Texto</option>
                          <option value="BOTH">Foto + Texto</option>
                        </select>
                      </div>
                      <div className="md:col-span-1">
                        <button type="button" onClick={handleAddStep} className="w-full p-2 bg-brand-600 text-white rounded-md hover:bg-brand-700 flex justify-center"><Plus size={20}/></button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {steps.map((step, idx) => (
                      <div key={step.id} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-lg shadow-sm group">
                        <div className="mt-1 text-gray-400 font-mono text-xs">{idx + 1}.</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{step.title}</span>
                            {step.evidenceRequired !== 'NONE' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                                {step.evidenceRequired === 'PHOTO' && <Camera size={10} />}
                                {step.evidenceRequired === 'TEXT' && <AlignLeft size={10} />}
                                {step.evidenceRequired === 'BOTH' && <><Camera size={10}/><AlignLeft size={10}/></>}
                                {step.evidenceRequired === 'PHOTO' ? 'FOTO' : step.evidenceRequired === 'TEXT' ? 'TEXTO' : 'FOTO+TXT'}
                              </span>
                            )}
                          </div>
                          {step.description && <p className="text-sm text-gray-500">{step.description}</p>}
                        </div>
                        <button type="button" onClick={() => handleRemoveStep(step.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                    {steps.length === 0 && <p className="text-sm text-gray-400 text-center italic py-4">Nenhuma etapa adicionada.</p>}
                  </div>
                </div>
              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
              <button type="submit" form="template-form" disabled={isSubmitting} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-75">
                {isSubmitting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />} Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskTemplates;
/**
 * components/TaskTemplates.tsx
 *
 * Modelos de O.S. — lista de cards clicáveis.
 * Clicar no card abre o painel de visualização completa.
 * Dentro do painel, o botão Editar habilita edição inline de todos os campos.
 */
import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, orderBy, query, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, TaskTemplate, EvidenceType } from '../types';
import {
  FileText, Plus, Trash2, Save, Wrench, ListTodo,
  Camera, AlignLeft, CheckSquare, X, Loader2, Copy,
  Edit2, ChevronRight, Eye,
} from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  NONE: 'Apenas Check',
  PHOTO: 'Exigir Foto',
  TEXT: 'Exigir Texto',
  BOTH: 'Foto + Texto',
};

const EvidenceBadge: React.FC<{ type: EvidenceType }> = ({ type }) => {
  if (type === 'NONE') return null;
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
      {(type === 'PHOTO' || type === 'BOTH') && <Camera size={9} />}
      {(type === 'TEXT'  || type === 'BOTH') && <AlignLeft size={9} />}
      {type === 'PHOTO' ? 'FOTO' : type === 'TEXT' ? 'TEXTO' : 'FOTO+TXT'}
    </span>
  );
};

// ── empty form factory ────────────────────────────────────────────────────────
const emptyForm = () => ({
  title: '',
  description: '',
  tools: [] as string[],
  steps: [] as TaskTemplate['checklist'],
});

// ── main component ────────────────────────────────────────────────────────────
const TaskTemplates: React.FC = () => {
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [loading, setLoading]     = useState(true);

  // ── View / Edit state ──────────────────────────────────────────────────────
  const [viewTemplate, setViewTemplate] = useState<TaskTemplate | null>(null);
  const [isEditing, setIsEditing]       = useState(false);   // edit mode inside detail panel
  const [isCreating, setIsCreating]     = useState(false);   // create modal

  // ── Form fields (shared between create & edit) ─────────────────────────────
  const [form, setForm] = useState(emptyForm());
  const [newTool, setNewTool]           = useState('');
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDesc, setNewStepDesc]   = useState('');
  const [newStepEvidence, setNewStepEvidence] = useState<EvidenceType>('NONE');
  const [isSaving, setIsSaving]         = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, CollectionName.TASK_TEMPLATES), orderBy('title', 'asc'));
      const snap = await getDocs(q);
      setTemplates(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as TaskTemplate[]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ── Open view detail ───────────────────────────────────────────────────────
  const openView = (t: TaskTemplate) => {
    setViewTemplate(t);
    setIsEditing(false);
  };

  // ── Open edit mode (from detail panel) ────────────────────────────────────
  const startEdit = (t: TaskTemplate) => {
    setForm({ title: t.title, description: t.description || '', tools: [...t.tools], steps: [...t.checklist] });
    setNewTool(''); setNewStepTitle(''); setNewStepDesc(''); setNewStepEvidence('NONE');
    setIsEditing(true);
  };

  // ── Open create modal ──────────────────────────────────────────────────────
  const openCreate = () => {
    setForm(emptyForm());
    setNewTool(''); setNewStepTitle(''); setNewStepDesc(''); setNewStepEvidence('NONE');
    setIsCreating(true);
  };

  // ── Close everything ───────────────────────────────────────────────────────
  const closeAll = () => {
    setViewTemplate(null);
    setIsEditing(false);
    setIsCreating(false);
  };

  // ── Tool helpers ───────────────────────────────────────────────────────────
  const addTool = () => {
    const t = newTool.trim();
    if (!t) return;
    setForm(f => ({ ...f, tools: [...f.tools, t] }));
    setNewTool('');
  };
  const removeTool = (i: number) => setForm(f => ({ ...f, tools: f.tools.filter((_, idx) => idx !== i) }));

  // ── Step helpers ───────────────────────────────────────────────────────────
  const addStep = () => {
    if (!newStepTitle.trim()) return;
    setForm(f => ({
      ...f,
      steps: [...f.steps, {
        id: Math.random().toString(36).slice(2, 10),
        title: newStepTitle.trim(),
        description: newStepDesc.trim(),
        evidenceRequired: newStepEvidence,
      }],
    }));
    setNewStepTitle(''); setNewStepDesc(''); setNewStepEvidence('NONE');
  };
  const removeStep = (id: string) => setForm(f => ({ ...f, steps: f.steps.filter(s => s.id !== id) }));

  // ── Save (create or update) ────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setIsSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        tools: form.tools,
        checklist: form.steps,
        updatedAt: serverTimestamp(),
      };

      if (isCreating) {
        const ref = await addDoc(collection(db, CollectionName.TASK_TEMPLATES), {
          ...payload, createdAt: serverTimestamp(),
        });
        const newT = { id: ref.id, ...payload } as unknown as TaskTemplate;
        setTemplates(prev => [...prev, newT].sort((a,b) => a.title.localeCompare(b.title)));
        closeAll();
      } else if (viewTemplate) {
        await updateDoc(doc(db, CollectionName.TASK_TEMPLATES, viewTemplate.id), payload);
        const updated = { ...viewTemplate, ...payload, checklist: form.steps } as unknown as TaskTemplate;
        setTemplates(prev => prev.map(t => t.id === viewTemplate.id ? updated : t).sort((a,b) => a.title.localeCompare(b.title)));
        setViewTemplate(updated);
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Erro ao salvar modelo:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este modelo permanentemente?')) return;
    try {
      await deleteDoc(doc(db, CollectionName.TASK_TEMPLATES, id));
      setTemplates(prev => prev.filter(t => t.id !== id));
      if (viewTemplate?.id === id) closeAll();
    } catch { /* silent */ }
  };

  // ── Shared Form Body JSX ───────────────────────────────────────────────────
  const FormBody = () => (
    <form id="tmpl-form" onSubmit={handleSave} className="space-y-6">
      {/* Basic info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Título do Modelo *</label>
            <input
              required type="text" value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-brand-200 focus:border-brand-400 bg-white text-gray-900"
              placeholder="Ex: Manutenção Preventiva"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Geral</label>
            <textarea
              rows={4} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-brand-200 bg-white text-gray-900"
              placeholder="Objetivo deste procedimento..."
            />
          </div>
        </div>

        {/* Tools */}
        <div className="bg-orange-50/60 p-4 rounded-xl border border-orange-100">
          <label className="flex items-center gap-1.5 text-sm font-bold text-orange-800 mb-3">
            <Wrench size={14} /> Ferramentas e Materiais
          </label>
          <div className="flex gap-2 mb-3">
            <input
              type="text" value={newTool}
              onChange={e => setNewTool(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTool())}
              className="flex-1 rounded-lg border border-orange-200 px-3 py-1.5 text-sm bg-white text-gray-900"
              placeholder="Adicionar ferramenta..."
            />
            <button type="button" onClick={addTool} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600">
              <Plus size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {form.tools.map((t, i) => (
              <span key={i} className="flex items-center gap-1 bg-white border border-orange-200 text-orange-700 px-2 py-0.5 rounded-full text-xs">
                {t}
                <button type="button" onClick={() => removeTool(i)} className="hover:text-red-500"><X size={10} /></button>
              </span>
            ))}
            {form.tools.length === 0 && <p className="text-xs text-orange-400 italic">Nenhuma ferramenta.</p>}
          </div>
        </div>
      </div>

      {/* Checklist builder */}
      <div className="border-t border-gray-200 pt-5">
        <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-1.5">
          <ListTodo size={14} className="text-brand-600" /> Etapas do Processo
        </h4>

        {/* Add step row */}
        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 mb-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
          <div className="md:col-span-5">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Título da Etapa</label>
            <input type="text" value={newStepTitle} onChange={e => setNewStepTitle(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white text-gray-900"
              placeholder="Ex: Verificar conexões" />
          </div>
          <div className="md:col-span-4">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Descrição (opcional)</label>
            <input type="text" value={newStepDesc} onChange={e => setNewStepDesc(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white text-gray-900"
              placeholder="Detalhes..." />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-medium text-gray-500 mb-1">Evidência</label>
            <select value={newStepEvidence} onChange={e => setNewStepEvidence(e.target.value as EvidenceType)}
              className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs bg-white text-gray-900">
              {(Object.keys(EVIDENCE_LABELS) as EvidenceType[]).map(k => (
                <option key={k} value={k}>{EVIDENCE_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1 flex justify-end">
            <button type="button" onClick={addStep}
              className="w-full py-1.5 bg-brand-600 text-white rounded-lg flex items-center justify-center hover:bg-brand-700">
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {form.steps.map((step, idx) => (
            <div key={step.id} className="flex items-start gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm group">
              <span className="text-xs font-mono text-gray-400 mt-0.5">{idx + 1}.</span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900">{step.title}</span>
                  <EvidenceBadge type={step.evidenceRequired || 'NONE'} />
                </div>
                {step.description && <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>}
              </div>
              <button type="button" onClick={() => removeStep(step.id)}
                className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {form.steps.length === 0 && (
            <p className="text-xs text-gray-400 text-center italic py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              Nenhuma etapa adicionada.
            </p>
          )}
        </div>
      </div>
    </form>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Modelos de O.S.</h1>
          <p className="text-sm text-gray-500">Padronize seus processos criando templates de ordens de serviço.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 transition-colors shadow-sm text-sm font-bold"
        >
          <Plus size={16} /> Novo Modelo
        </button>
      </div>

      {/* Cards grid */}
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {templates.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-gray-300">
              <Copy className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-bold text-gray-900">Nenhum modelo criado</h3>
              <p className="text-sm text-gray-500 mt-1">Crie seu primeiro template para agilizar a abertura de O.S.</p>
            </div>
          )}
          {templates.map(t => (
            <div
              key={t.id}
              onClick={() => openView(t)}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-pointer p-5 flex flex-col gap-3 group"
            >
              <div className="flex justify-between items-start">
                <div className="p-2 bg-brand-50 rounded-xl text-brand-600 group-hover:bg-brand-100 transition-colors">
                  <FileText size={20} />
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(t.id); }}
                  className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Excluir modelo"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <div>
                <h3 className="font-bold text-gray-900 text-sm leading-tight">{t.title}</h3>
                {t.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                )}
              </div>

              <div className="border-t border-gray-100 pt-2 space-y-1 mt-auto">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <ListTodo size={11} className="text-brand-500" />
                  {t.checklist.length} etapa{t.checklist.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Wrench size={11} className="text-orange-500" />
                  {t.tools.length} ferramenta{t.tools.length !== 1 ? 's' : ''}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 text-[10px] text-brand-500 font-bold">
                <Eye size={10} /> Ver detalhes
                <ChevronRight size={10} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── VIEW / EDIT DETAIL PANEL ── */}
      {viewTemplate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 bg-brand-100 rounded-xl text-brand-600 flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-base leading-tight truncate">
                    {isEditing ? '✏️ Editar Modelo' : viewTemplate.title}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {viewTemplate.checklist.length} etapas · {viewTemplate.tools.length} ferramentas
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!isEditing && (
                  <button
                    onClick={() => startEdit(viewTemplate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 border border-brand-200 rounded-xl transition-colors"
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                )}
                <button onClick={closeAll} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {isEditing ? (
                <FormBody />
              ) : (
                /* VIEW MODE */
                <div className="space-y-6">
                  {/* Description */}
                  {viewTemplate.description && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Descrição</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewTemplate.description}</p>
                    </div>
                  )}

                  {/* Tools */}
                  {viewTemplate.tools.length > 0 && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <Wrench size={11} /> Ferramentas e Materiais
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {viewTemplate.tools.map((tool, i) => (
                          <span key={i} className="bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-1 rounded-full text-xs font-medium">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checklist */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                      <ListTodo size={11} /> Etapas do Processo ({viewTemplate.checklist.length})
                    </h4>
                    <div className="space-y-2">
                      {viewTemplate.checklist.map((step, idx) => (
                        <div key={step.id} className="flex items-start gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900">{step.title}</span>
                              <EvidenceBadge type={step.evidenceRequired || 'NONE'} />
                            </div>
                            {step.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                      {viewTemplate.checklist.length === 0 && (
                        <p className="text-xs text-gray-400 italic text-center py-4">Nenhuma etapa configurada.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center gap-3">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    form="tmpl-form"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Salvar Alterações
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleDelete(viewTemplate.id)}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 rounded-xl transition-colors"
                  >
                    <Trash2 size={12} /> Excluir Modelo
                  </button>
                  <button
                    onClick={closeAll}
                    className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100"
                  >
                    Fechar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE MODAL ── */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 rounded-t-2xl flex items-center justify-between">
              <h2 className="font-bold text-gray-900 text-base">➕ Novo Modelo de O.S.</h2>
              <button onClick={closeAll} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <FormBody />
            </div>
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end gap-3">
              <button type="button" onClick={closeAll}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-100">
                Cancelar
              </button>
              <button type="submit" form="tmpl-form" disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50">
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskTemplates;
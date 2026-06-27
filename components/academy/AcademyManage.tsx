// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Gestão de Módulos (Admin)
// Criação livre e incremental: cada seção (PDF/vídeo/infográfico/prova) salva
// independente. Rascunho só o adm vê. Pré-visualização e publicação manuais.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, AcademyModule, AcademyQuestion } from '../../types';
import {
  GraduationCap, Plus, FileText, Video, Image as ImageIcon, ClipboardList, Save,
  Upload, Trash2, Eye, CheckCircle2, Circle, X, Loader2, ArrowLeft, Clock, Award,
  PlusCircle, Globe, Lock, AlertTriangle,
} from 'lucide-react';
import {
  emptyModule, computeReadiness, readinessPercent, uploadAcademyFile,
  deleteAcademyFile, detectVideoSource, BADGE_TIERS,
} from './academyHelpers';
import ModulePreview from './ModulePreview';

type Tab = 'geral' | 'pdf' | 'video' | 'infografico' | 'prova';

const AcademyManage: React.FC = () => {
  const { currentUser } = useAuth();
  const [modules, setModules] = useState<AcademyModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewModule, setPreviewModule] = useState<AcademyModule | null>(null);
  const [previewQuestions, setPreviewQuestions] = useState<AcademyQuestion[]>([]);

  // ── Carrega módulos (todos — adm vê rascunhos e publicados) ──
  useEffect(() => {
    const q = query(collection(db, CollectionName.ACADEMY_MODULES), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyModule)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const handleCreate = async () => {
    if (!currentUser) return;
    const ref = await addDoc(collection(db, CollectionName.ACADEMY_MODULES), {
      ...emptyModule(currentUser.uid, modules.length),
      criadoEm: serverTimestamp(),
    });
    setEditingId(ref.id);
  };

  const openPreview = async (m: AcademyModule) => {
    const snap = await getDocs(query(
      collection(db, CollectionName.ACADEMY_QUESTIONS),
      where('moduleId', '==', m.id),
      orderBy('order', 'asc'),
    ));
    setPreviewQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyQuestion)));
    setPreviewModule(m);
  };

  const editing = modules.find(m => m.id === editingId) || null;

  if (editing) {
    return (
      <>
        <ModuleEditor
          module={editing}
          onBack={() => setEditingId(null)}
          onPreview={() => openPreview(editing)}
        />
        {previewModule && (
          <ModulePreview module={previewModule} questions={previewQuestions} onClose={() => setPreviewModule(null)} />
        )}
      </>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center">
            <GraduationCap className="text-brand-700" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Academia MGR — Gestão</h1>
            <p className="text-sm text-gray-500">Crie e edite módulos. Cada parte é salva separadamente.</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus size={18} /> Novo Módulo
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>
      ) : modules.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <GraduationCap className="mx-auto text-gray-300 mb-3" size={48} />
          <p className="text-gray-500 font-medium">Nenhum módulo criado ainda.</p>
          <p className="text-sm text-gray-400 mb-4">Comece criando seu primeiro módulo — você pode subir o conteúdo aos poucos.</p>
          <button onClick={handleCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg font-semibold text-sm hover:bg-brand-700">
            <Plus size={16} /> Criar primeiro módulo
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(m => {
            const pct = readinessPercent(m.readiness);
            return (
              <div key={m.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="h-24 bg-gradient-to-br from-brand-500 to-brand-700 relative flex items-end p-3">
                  {m.coverUrl && <img src={m.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <span className={`relative z-10 px-2 py-0.5 rounded-full text-[10px] font-bold ${m.status === 'published' ? 'bg-green-500 text-white' : 'bg-amber-400 text-amber-900'}`}>
                    {m.status === 'published' ? '● PUBLICADO' : '✎ RASCUNHO'}
                  </span>
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-bold text-gray-900 truncate">{m.title || 'Módulo sem título'}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-3 flex-1">{m.description || 'Sem descrição.'}</p>
                  {/* Prontidão */}
                  <div className="mb-3">
                    <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                      <span>Prontidão</span><span className="font-bold">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex gap-2 mt-2 text-[10px]">
                      <ReadyChip ok={m.readiness.pdf} label="PDF" />
                      <ReadyChip ok={m.readiness.video} label="Vídeo" />
                      <ReadyChip ok={m.readiness.infographic} label="Info" />
                      <ReadyChip ok={m.readiness.exam} label="Prova" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(m.id)} className="flex-1 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-100">Editar</button>
                    <button onClick={() => openPreview(m)} title="Pré-visualizar" className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"><Eye size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewModule && (
        <ModulePreview module={previewModule} questions={previewQuestions} onClose={() => setPreviewModule(null)} />
      )}
    </div>
  );
};

const ReadyChip: React.FC<{ ok: boolean; label: string }> = ({ ok, label }) => (
  <span className={`flex items-center gap-0.5 ${ok ? 'text-green-600' : 'text-gray-300'}`}>
    {ok ? <CheckCircle2 size={12} /> : <Circle size={12} />} {label}
  </span>
);

// ═══════════════════════════════════════════════════════════════════════════
// EDITOR DE MÓDULO — abas com salvamento independente
// ═══════════════════════════════════════════════════════════════════════════
const ModuleEditor: React.FC<{ module: AcademyModule; onBack: () => void; onPreview: () => void }> = ({ module, onBack, onPreview }) => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<Tab>('geral');
  const [questions, setQuestions] = useState<AcademyQuestion[]>([]);

  // ── Carrega questões do módulo ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.ACADEMY_QUESTIONS),
      where('moduleId', '==', module.id),
      orderBy('order', 'asc'),
    );
    return onSnapshot(q, snap => setQuestions(snap.docs.map(d => ({ id: d.id, ...d.data() } as AcademyQuestion))));
  }, [module.id]);

  /** Salva campos parciais do módulo e recalcula a prontidão. */
  const saveModule = async (patch: Partial<AcademyModule>) => {
    const merged = { ...module, ...patch };
    const readiness = computeReadiness(merged, questions.length);
    await updateDoc(doc(db, CollectionName.ACADEMY_MODULES, module.id), {
      ...patch,
      readiness,
      atualizadoEm: serverTimestamp(),
    } as any);
  };

  const togglePublish = async () => {
    if (module.status === 'published') {
      await saveModule({ status: 'draft' });
    } else {
      await updateDoc(doc(db, CollectionName.ACADEMY_MODULES, module.id), {
        status: 'published',
        publishedAt: serverTimestamp(),
        publishedBy: currentUser?.uid,
        atualizadoEm: serverTimestamp(),
      });
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType; done?: boolean }[] = [
    { key: 'geral', label: 'Geral', icon: GraduationCap },
    { key: 'pdf', label: 'PDF', icon: FileText, done: module.readiness.pdf },
    { key: 'video', label: 'Vídeo', icon: Video, done: module.readiness.video },
    { key: 'infografico', label: 'Infográfico', icon: ImageIcon, done: module.readiness.infographic },
    { key: 'prova', label: 'Prova', icon: ClipboardList, done: module.readiness.exam },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          <button onClick={onPreview} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">
            <Eye size={16} /> Pré-visualizar
          </button>
          <button
            onClick={togglePublish}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition-colors
              ${module.status === 'published' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {module.status === 'published' ? <><Lock size={16} /> Despublicar</> : <><Globe size={16} /> Publicar</>}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Título do módulo */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${module.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {module.status === 'published' ? 'PUBLICADO' : 'RASCUNHO'}
          </span>
          <h2 className="font-bold text-gray-900 truncate">{module.title || 'Módulo sem título'}</h2>
        </div>

        {/* Abas */}
        <div className="flex border-b border-gray-100 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors
                ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
            >
              <t.icon size={15} />
              {t.label}
              {t.done && <CheckCircle2 size={13} className="text-green-500" />}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'geral' && <TabGeral module={module} onSave={saveModule} />}
          {tab === 'pdf' && <TabPdf module={module} onSave={saveModule} />}
          {tab === 'video' && <TabVideo module={module} onSave={saveModule} />}
          {tab === 'infografico' && <TabInfografico module={module} onSave={saveModule} />}
          {tab === 'prova' && <TabProva module={module} questions={questions} onSave={saveModule} />}
        </div>
      </div>
    </div>
  );
};

// ── Aba GERAL ──
const TabGeral: React.FC<{ module: AcademyModule; onSave: (p: Partial<AcademyModule>) => Promise<void> }> = ({ module, onSave }) => {
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description || '');
  const [xpReward, setXpReward] = useState(module.xpReward);
  const [passingScore, setPassingScore] = useState(module.passingScore);
  const [sequential, setSequential] = useState(module.sequential);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave({ title: title.trim(), description: description.trim(), xpReward, passingScore, sequential, freeNavigation: !sequential });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Field label="Título do módulo">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: NR-10 — Segurança em Instalações Elétricas"
          className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </Field>
      <Field label="Descrição">
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Resumo do que o colaborador vai aprender."
          className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="XP ao concluir">
          <input type="number" min={0} value={xpReward} onChange={e => setXpReward(Number(e.target.value))}
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </Field>
        <Field label="Nota de corte (% de acertos)">
          <input type="number" min={0} max={100} value={passingScore} onChange={e => setPassingScore(Number(e.target.value))}
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={sequential} onChange={e => setSequential(e.target.checked)} className="rounded" />
        Navegação sequencial (PDF → Vídeo → Infográfico → Prova). Desmarque para liberar ordem livre.
      </label>
      <div className="bg-brand-50 border border-brand-100 rounded-lg p-3 text-xs text-brand-800 flex gap-2">
        <Award size={16} className="flex-shrink-0" />
        Badges por módulo: {BADGE_TIERS.bronze.emoji} {BADGE_TIERS.bronze.min}–{BADGE_TIERS.bronze.max}% ·
        {' '}{BADGE_TIERS.silver.emoji} {BADGE_TIERS.silver.min}–{BADGE_TIERS.silver.max}% ·
        {' '}{BADGE_TIERS.gold.emoji} {BADGE_TIERS.gold.min}–{BADGE_TIERS.gold.max}%
      </div>
      <SaveBar saving={saving} saved={saved} onSave={save} disabled={!title.trim()} />
    </div>
  );
};

// ── Aba PDF ──
const TabPdf: React.FC<{ module: AcademyModule; onSave: (p: Partial<AcademyModule>) => Promise<void> }> = ({ module, onSave }) => (
  <UploadSlot
    icon={FileText}
    title="Conteúdo em PDF"
    hint="O colaborador lê página a página; o progresso avança conforme a leitura."
    accept="application/pdf"
    currentUrl={module.pdfUrl}
    currentPath={module.pdfPath}
    moduleId={module.id}
    slot="conteudo"
    onUploaded={({ url, path }) => onSave({ pdfUrl: url, pdfPath: path })}
    onRemove={() => onSave({ pdfUrl: undefined, pdfPath: undefined })}
    renderPreview={url => <iframe title="PDF" src={url} className="w-full h-72 rounded-lg border border-gray-200" />}
  />
);

// ── Aba VÍDEO (upload OU link) ──
const TabVideo: React.FC<{ module: AcademyModule; onSave: (p: Partial<AcademyModule>) => Promise<void> }> = ({ module, onSave }) => {
  const [mode, setMode] = useState<'upload' | 'link'>(module.videoSource && module.videoSource !== 'upload' ? 'link' : 'upload');
  const [link, setLink] = useState(module.videoSource !== 'upload' ? module.videoUrl || '' : '');
  const [savingLink, setSavingLink] = useState(false);

  const saveLink = async () => {
    if (!link.trim()) return;
    setSavingLink(true);
    await onSave({ videoUrl: link.trim(), videoSource: detectVideoSource(link.trim()), videoPath: undefined });
    setSavingLink(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ModeBtn active={mode === 'upload'} onClick={() => setMode('upload')} label="Enviar arquivo" />
        <ModeBtn active={mode === 'link'} onClick={() => setMode('link')} label="Link (YouTube/Vimeo)" />
      </div>
      {mode === 'upload' ? (
        <UploadSlot
          icon={Video}
          title="Vídeo do módulo"
          hint="O vídeo conta como concluído quando assistido até o fim."
          accept="video/*"
          currentUrl={module.videoSource === 'upload' ? module.videoUrl : undefined}
          currentPath={module.videoPath}
          moduleId={module.id}
          slot="video"
          onUploaded={({ url, path }) => onSave({ videoUrl: url, videoPath: path, videoSource: 'upload' })}
          onRemove={() => onSave({ videoUrl: undefined, videoPath: undefined, videoSource: undefined })}
          renderPreview={url => <video src={url} controls className="w-full max-h-72 rounded-lg bg-black" />}
        />
      ) : (
        <div className="space-y-3 max-w-2xl">
          <Field label="URL do vídeo">
            <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://youtube.com/watch?v=..."
              className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </Field>
          {module.videoSource !== 'upload' && module.videoUrl && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle2 size={14} /> Vídeo salvo: {module.videoUrl}
            </div>
          )}
          <button onClick={saveLink} disabled={!link.trim() || savingLink} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50">
            {savingLink ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar link
          </button>
        </div>
      )}
    </div>
  );
};

// ── Aba INFOGRÁFICO ──
const TabInfografico: React.FC<{ module: AcademyModule; onSave: (p: Partial<AcademyModule>) => Promise<void> }> = ({ module, onSave }) => (
  <UploadSlot
    icon={ImageIcon}
    title="Infográfico de apoio"
    hint="Concluído após o colaborador abrir e visualizar (rolar até o fim)."
    accept="image/*"
    currentUrl={module.infographicUrl}
    currentPath={module.infographicPath}
    moduleId={module.id}
    slot="infografico"
    onUploaded={({ url, path }) => onSave({ infographicUrl: url, infographicPath: path })}
    onRemove={() => onSave({ infographicUrl: undefined, infographicPath: undefined })}
    renderPreview={url => <img src={url} alt="Infográfico" className="w-full max-h-72 object-contain rounded-lg border border-gray-200 bg-gray-50" />}
  />
);

// ── Aba PROVA + Banco de Questões ──
const TabProva: React.FC<{ module: AcademyModule; questions: AcademyQuestion[]; onSave: (p: Partial<AcademyModule>) => Promise<void> }> = ({ module, questions, onSave }) => {
  const [exam, setExam] = useState(module.exam);
  const [savingCfg, setSavingCfg] = useState(false);

  const saveCfg = async () => {
    setSavingCfg(true);
    await onSave({ exam });
    setSavingCfg(false);
  };

  const addQuestion = async () => {
    await addDoc(collection(db, CollectionName.ACADEMY_QUESTIONS), {
      moduleId: module.id,
      text: '',
      options: ['', ''],
      correctIndex: 0,
      weight: 1,
      order: questions.length,
      criadoEm: serverTimestamp(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Configuração da prova */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-4">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><Clock size={16} /> Configuração da Prova</h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Tempo (minutos)">
            <input type="number" min={1} value={exam.durationMinutes} onChange={e => setExam({ ...exam, durationMinutes: Number(e.target.value) })}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </Field>
          <Field label={`Questões sorteadas (de ${questions.length})`}>
            <input type="number" min={1} value={exam.questionsPerExam} onChange={e => setExam({ ...exam, questionsPerExam: Number(e.target.value) })}
              className="w-full p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </Field>
          <label className="flex items-end gap-2 text-sm text-gray-700 pb-2.5">
            <input type="checkbox" checked={exam.shuffleOptions} onChange={e => setExam({ ...exam, shuffleOptions: e.target.checked })} className="rounded" />
            Embaralhar alternativas
          </label>
        </div>
        <Field label="Regras exibidas antes de iniciar a prova">
          <textarea value={exam.rulesText} onChange={e => setExam({ ...exam, rulesText: e.target.value })} rows={4}
            className="w-full p-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </Field>
        {exam.questionsPerExam > questions.length && (
          <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertTriangle size={14} /> Você quer sortear {exam.questionsPerExam} questões mas só há {questions.length} cadastradas. Cadastre mais abaixo.
          </div>
        )}
        <button onClick={saveCfg} disabled={savingCfg} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50">
          {savingCfg ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar configuração
        </button>
      </div>

      {/* Banco de questões */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900">Banco de Questões ({questions.length})</h3>
          <button onClick={addQuestion} className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-100">
            <PlusCircle size={16} /> Adicionar questão
          </button>
        </div>
        <div className="space-y-3">
          {questions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">Nenhuma questão cadastrada ainda.</p>
          )}
          {questions.map((q, i) => <QuestionCard key={q.id} q={q} index={i} />)}
        </div>
      </div>
    </div>
  );
};

// ── Card de questão (edição inline + salvar/excluir) ──
const QuestionCard: React.FC<{ q: AcademyQuestion; index: number }> = ({ q, index }) => {
  const [text, setText] = useState(q.text);
  const [options, setOptions] = useState<string[]>(q.options);
  const [correctIndex, setCorrectIndex] = useState(q.correctIndex);
  const [weight, setWeight] = useState(q.weight);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setText(q.text); setOptions(q.options); setCorrectIndex(q.correctIndex); setWeight(q.weight); }, [q]);

  const save = async () => {
    setSaving(true);
    await updateDoc(doc(db, CollectionName.ACADEMY_QUESTIONS, q.id), {
      text: text.trim(),
      options: options.map(o => o.trim()),
      correctIndex: Math.min(correctIndex, options.length - 1),
      weight,
    });
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  };
  const remove = async () => {
    if (confirm('Excluir esta questão?')) await deleteDoc(doc(db, CollectionName.ACADEMY_QUESTIONS, q.id));
  };
  const setOption = (i: number, v: string) => setOptions(prev => prev.map((o, idx) => idx === i ? v : o));
  const addOption = () => options.length < 6 && setOptions([...options, '']);
  const removeOption = (i: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, idx) => idx !== i));
    if (correctIndex >= options.length - 1) setCorrectIndex(0);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-start gap-2 mb-3">
        <span className="mt-2 text-xs font-bold text-gray-400">{index + 1}</span>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Enunciado da pergunta"
          className="flex-1 p-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button onClick={remove} title="Excluir" className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
      </div>
      <div className="space-y-2 pl-6">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`correct-${q.id}`} checked={correctIndex === i} onChange={() => setCorrectIndex(i)} title="Marcar como correta" className="flex-shrink-0" />
            <span className="text-xs font-bold text-gray-400 w-4">{String.fromCharCode(65 + i)}</span>
            <input value={opt} onChange={e => setOption(i, e.target.value)} placeholder={`Alternativa ${String.fromCharCode(65 + i)}`}
              className={`flex-1 p-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${correctIndex === i ? 'border-green-300 bg-green-50' : 'border-gray-200'}`} />
            {options.length > 2 && <button onClick={() => removeOption(i)} className="p-1.5 text-gray-400 hover:text-red-500"><X size={14} /></button>}
          </div>
        ))}
        {options.length < 6 && (
          <button onClick={addOption} className="text-xs text-brand-600 font-semibold hover:underline ml-6">+ alternativa</button>
        )}
      </div>
      <div className="flex items-center justify-between mt-3 pl-6">
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Peso <input type="number" min={1} value={weight} onChange={e => setWeight(Number(e.target.value))} className="w-14 p-1.5 border border-gray-200 rounded text-sm" />
        </label>
        <button onClick={save} disabled={saving || !text.trim()} className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 disabled:opacity-50">
          {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
          {saved ? 'Salvo' : 'Salvar questão'}
        </button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Componentes auxiliares de UI
// ═══════════════════════════════════════════════════════════════════════════
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-gray-500 mb-1.5">{label}</label>
    {children}
  </div>
);

const SaveBar: React.FC<{ saving: boolean; saved: boolean; onSave: () => void; disabled?: boolean }> = ({ saving, saved, onSave, disabled }) => (
  <div className="flex items-center gap-3 pt-2">
    <button onClick={onSave} disabled={saving || disabled} className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-50">
      {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
    </button>
    {saved && <span className="flex items-center gap-1 text-sm text-green-600 font-semibold"><CheckCircle2 size={16} /> Salvo!</span>}
  </div>
);

const ModeBtn: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${active ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{label}</button>
);

// ── Slot de upload reutilizável (PDF / vídeo / infográfico) ──
interface UploadSlotProps {
  icon: React.ElementType;
  title: string;
  hint: string;
  accept: string;
  currentUrl?: string;
  currentPath?: string;
  moduleId: string;
  slot: 'conteudo' | 'video' | 'infografico' | 'capa';
  onUploaded: (r: { url: string; path: string }) => Promise<void>;
  onRemove: () => Promise<void>;
  renderPreview: (url: string) => React.ReactNode;
}
const UploadSlot: React.FC<UploadSlotProps> = ({ icon: Icon, title, hint, accept, currentUrl, currentPath, moduleId, slot, onUploaded, onRemove, renderPreview }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');

  const handleFile = async (file: File) => {
    setError(''); setProgress(0);
    try {
      const { promise } = uploadAcademyFile(moduleId, slot, file, setProgress);
      const result = await promise;
      // remove arquivo antigo se o path mudou
      if (currentPath && currentPath !== result.path) await deleteAcademyFile(currentPath);
      await onUploaded(result);
    } catch (e: any) {
      setError('Falha no envio. Tente novamente.');
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    if (!confirm('Remover este arquivo?')) return;
    await deleteAcademyFile(currentPath);
    await onRemove();
  };

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-start gap-2">
        <Icon size={18} className="text-brand-600 mt-0.5" />
        <div>
          <h3 className="font-bold text-gray-900">{title}</h3>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
      </div>

      {currentUrl ? (
        <div className="space-y-3">
          {renderPreview(currentUrl)}
          <div className="flex gap-2">
            <button onClick={() => inputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-200">
              <Upload size={15} /> Trocar arquivo
            </button>
            <button onClick={remove} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100">
              <Trash2 size={15} /> Remover
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} disabled={progress !== null}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors">
          {progress !== null ? (
            <>
              <Loader2 className="animate-spin" size={28} />
              <span className="text-sm font-semibold">Enviando… {progress}%</span>
              <div className="w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : (
            <>
              <Upload size={28} />
              <span className="text-sm font-semibold">Clique para enviar</span>
            </>
          )}
        </button>
      )}

      {error && <div className="flex items-center gap-2 text-sm text-red-600"><AlertTriangle size={15} /> {error}</div>}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
};

export default AcademyManage;

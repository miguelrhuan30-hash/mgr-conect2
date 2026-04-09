import React, { useState, useEffect } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { MultiLandingPage, LPStatus } from '../types';
import { LP_TEMPLATES } from '../constants/lpTemplates';
import {
  Plus, Globe, Edit, Trash2, Copy, Eye, LayoutDashboard,
  Snowflake, Wrench, Wind, Ruler, Droplets, CheckCircle2,
  AlertTriangle, Loader2, ExternalLink, Archive, BookOpen,
} from 'lucide-react';

// ─── helpers ─────────────────────────────────────────────────────────────────

function iconForTemplate(iconName: string) {
  const map: Record<string, React.ReactNode> = {
    Snowflake: <Snowflake size={20} />,
    Wrench: <Wrench size={20} />,
    Wind: <Wind size={20} />,
    Ruler: <Ruler size={20} />,
    Droplets: <Droplets size={20} />,
    LayoutDashboard: <LayoutDashboard size={20} />,
  };
  return map[iconName] ?? <Globe size={20} />;
}

const STATUS_LABELS: Record<LPStatus, string> = {
  draft: 'Rascunho',
  published: 'Publicada',
  archived: 'Arquivada',
};

const STATUS_CLASSES: Record<LPStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

// ─── component ───────────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreate: (templateId: string, name: string, slug: string) => Promise<void>;
  creating: boolean;
}

function CreateModal({ onClose, onCreate, creating }: CreateModalProps) {
  const [step, setStep] = useState<'template' | 'name'>(LP_TEMPLATES.length > 0 ? 'template' : 'name');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  function handleNameChange(v: string) {
    setName(v);
    setSlug(
      v.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    await onCreate(selectedTemplate ?? '', name.trim(), slug.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Nova Landing Page</h2>

        {step === 'template' && (
          <>
            <p className="text-sm text-gray-500 mb-4">Escolha um modelo como ponto de partida (ou comece em branco).</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {LP_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTemplate(t.id)}
                  className={`flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                    selectedTemplate === t.id
                      ? 'border-brand-600 bg-brand-50'
                      : 'border-gray-200 hover:border-brand-400'
                  }`}
                >
                  <span className="text-brand-600">{iconForTemplate(t.icon)}</span>
                  <span className="text-sm font-bold text-gray-800">{t.name}</span>
                  <span className="text-xs text-gray-500 leading-tight">{t.description}</span>
                </button>
              ))}
              <button
                onClick={() => setSelectedTemplate(null)}
                className={`flex flex-col items-start gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                  selectedTemplate === null
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-gray-200 hover:border-brand-400'
                }`}
              >
                <span className="text-gray-400"><BookOpen size={20} /></span>
                <span className="text-sm font-bold text-gray-800">Em branco</span>
                <span className="text-xs text-gray-500">Comece do zero.</span>
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => setStep('name')}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg transition-colors active:scale-95"
              >
                Continuar
              </button>
            </div>
          </>
        )}

        {step === 'name' && (
          <form onSubmit={handleSubmit}>
            <p className="text-sm text-gray-500 mb-4">
              {selectedTemplate
                ? `Usando modelo: ${LP_TEMPLATES.find((t) => t.id === selectedTemplate)?.name}`
                : 'Começando em branco'}
            </p>
            <div className="space-y-4 mb-5">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Nome interno
                </label>
                <input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="ex: Câmaras Frias - Curitiba"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
                  Slug (URL pública)
                </label>
                <div className="flex items-center gap-0">
                  <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-xs text-gray-500 whitespace-nowrap">
                    /lp/
                  </span>
                  <input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="camaras-frias-curitiba"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-r-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('template')} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Voltar
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim() || !slug.trim()}
                className="flex-1 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Criar LP
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── main ────────────────────────────────────────────────────────────────────

interface LandingPagesManagerProps {
  onEdit: (lpId: string) => void;
}

export default function LandingPagesManager({ onEdit }: LandingPagesManagerProps) {
  const { currentUser } = useAuth();
  const [pages, setPages] = useState<MultiLandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'landing_pages'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setPages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as MultiLandingPage)));
      setLoading(false);
    });
    return unsub;
  }, []);

  function toast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  }

  async function handleCreate(templateId: string, name: string, slug: string) {
    if (!currentUser) return;
    setCreating(true);
    try {
      const tpl = LP_TEMPLATES.find((t) => t.id === templateId);
      const blankContent = tpl?.content ?? buildBlankContent();
      await addDoc(collection(db, 'landing_pages'), {
        name,
        slug,
        templateId: templateId || null,
        status: 'draft' as LPStatus,
        content: blankContent,
        primaryColor: tpl?.primaryColor ?? '#1B5E8A',
        accentColor: tpl?.accentColor ?? '#D4792A',
        metaTitle: name,
        metaDescription: '',
        views: 0,
        createdBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShowCreate(false);
      toast('Landing page criada!');
    } catch (err) {
      console.error(err);
      toast('Erro ao criar landing page.');
    } finally {
      setCreating(false);
    }
  }

  async function toggleStatus(lp: MultiLandingPage) {
    const next: LPStatus = lp.status === 'published' ? 'draft' : 'published';
    await updateDoc(doc(db, 'landing_pages', lp.id), { status: next, updatedAt: serverTimestamp() });
    toast(next === 'published' ? 'LP publicada!' : 'LP despublicada.');
  }

  async function handleDelete(id: string) {
    await deleteDoc(doc(db, 'landing_pages', id));
    setDeleteConfirm(null);
    toast('LP excluída.');
  }

  function copyLink(lp: MultiLandingPage) {
    const url = `${window.location.origin}/#/lp/${lp.slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(lp.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast('Link copiado!');
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-4 rounded-xl text-white flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">Landing Pages</h1>
          <p className="text-sm text-brand-100 mt-0.5">{pages.length} página{pages.length !== 1 ? 's' : ''} criada{pages.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 text-sm font-bold rounded-lg hover:bg-brand-50 transition-colors active:scale-95"
        >
          <Plus size={16} />
          Nova LP
        </button>
      </div>

      {/* Empty state */}
      {pages.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
          <Globe size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma landing page criada ainda.</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">Crie sua primeira LP a partir de um modelo.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-lg transition-colors active:scale-95"
          >
            Criar primeira LP
          </button>
        </div>
      )}

      {/* Pages list */}
      <div className="space-y-3">
        {pages.map((lp) => (
          <div key={lp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900">{lp.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${STATUS_CLASSES[lp.status]}`}>
                    {STATUS_LABELS[lp.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 font-mono">/lp/{lp.slug}</p>
                {lp.views != null && lp.views > 0 && (
                  <p className="text-xs text-gray-400 mt-1">{lp.views} visualizaç{lp.views !== 1 ? 'ões' : 'ão'}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Toggle publish */}
                <button
                  onClick={() => toggleStatus(lp)}
                  title={lp.status === 'published' ? 'Despublicar' : 'Publicar'}
                  className={`p-2 rounded-lg border text-sm transition-colors ${
                    lp.status === 'published'
                      ? 'border-green-200 text-green-700 hover:bg-green-50'
                      : 'border-gray-200 text-gray-400 hover:bg-gray-50'
                  }`}
                >
                  <CheckCircle2 size={16} />
                </button>
                {/* Preview */}
                <a
                  href={`/#/lp/${lp.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Visualizar"
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <Eye size={16} />
                </a>
                {/* Copy link */}
                <button
                  onClick={() => copyLink(lp)}
                  title="Copiar link"
                  className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  {copiedId === lp.id ? <CheckCircle2 size={16} className="text-green-600" /> : <Copy size={16} />}
                </button>
                {/* Edit */}
                <button
                  onClick={() => onEdit(lp.id)}
                  title="Editar"
                  className="p-2 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  <Edit size={16} />
                </button>
                {/* Delete */}
                <button
                  onClick={() => setDeleteConfirm(lp.id)}
                  title="Excluir"
                  className="p-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
          creating={creating}
        />
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-red-500"><AlertTriangle size={24} /></span>
              <h2 className="text-lg font-bold text-gray-900">Excluir landing page?</h2>
            </div>
            <p className="text-sm text-gray-600 mb-5">Esta ação é permanente e não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-bold rounded-lg hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors">
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function buildBlankContent() {
  return {
    header: { tagline: 'MGR Soluções em Refrigeração Industrial', phone: '', whatsapp: '' },
    hero: { title: 'Título da sua LP', subtitle: 'Subtítulo', backgroundImageUrl: '', ctaText: 'Fale conosco', ctaLink: '' },
    problem: { title: 'Você enfrenta esses problemas?', items: [] },
    solution: { title: 'Nossa solução', subtitle: '', items: [] },
    socialProof: { title: 'Quem confia na MGR', items: [] },
    differentials: { title: 'Por que a MGR?', items: [] },
    bridge: { title: 'A MGR é a parceira certa', description: '', stats: [] },
    cta: { title: 'Pronto para começar?', description: '', buttonText: 'Fale conosco', buttonLink: '', phone: '', whatsapp: '', email: '' },
    footer: { address: '', phone: '', email: '', copyright: `© ${new Date().getFullYear()} MGR Soluções em Refrigeração Industrial.` },
  };
}

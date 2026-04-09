import React, { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { MultiLandingPage, MultiLPSection, LPStatus } from '../types';
import {
  ArrowLeft, Save, Eye, Loader2, Globe, CheckCircle2,
  ChevronDown, ChevronUp, Plus, Trash2, Image,
} from 'lucide-react';
import clsx from 'clsx';

// ─── section tabs ─────────────────────────────────────────────────────────────

type SectionKey = keyof MultiLPSection;

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'header',       label: 'Cabeçalho' },
  { key: 'hero',         label: 'Hero / Banner' },
  { key: 'problem',      label: 'Problema / Dor' },
  { key: 'solution',     label: 'Solução / Serviços' },
  { key: 'socialProof',  label: 'Prova Social' },
  { key: 'differentials',label: 'Diferenciais' },
  { key: 'bridge',       label: 'Ponte (Por que nós)' },
  { key: 'cta',          label: 'CTA Final' },
  { key: 'footer',       label: 'Rodapé' },
];

// ─── small helpers ────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, multiline = false, type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  type?: string;
}) {
  const base = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={base + ' resize-none'}
        />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={base} />
      )}
    </div>
  );
}

function ItemsEditor<T extends Record<string, string>>({
  items,
  fields,
  placeholders,
  onChange,
  addLabel = 'Adicionar item',
  emptyItem,
}: {
  items: T[];
  fields: (keyof T)[];
  placeholders?: Partial<Record<keyof T, string>>;
  onChange: (items: T[]) => void;
  addLabel?: string;
  emptyItem: T;
}) {
  function update(idx: number, key: keyof T, value: string) {
    const next = items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
    onChange(next);
  }
  function remove(idx: number) { onChange(items.filter((_, i) => i !== idx)); }
  function add() { onChange([...items, { ...emptyItem }]); }

  return (
    <div className="space-y-3">
      {items.map((item, idx) => (
        <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
          {fields.map((f) => (
            <div key={String(f)}>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-1">{String(f)}</label>
              <input
                value={String(item[f] ?? '')}
                onChange={(e) => update(idx, f, e.target.value)}
                placeholder={placeholders?.[f] as string | undefined}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          ))}
          <button
            onClick={() => remove(idx)}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 mt-1"
          >
            <Trash2 size={12} /> Remover
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="flex items-center gap-2 px-3 py-1.5 border border-dashed border-brand-400 text-brand-600 text-xs font-bold rounded-lg hover:bg-brand-50 transition-colors"
      >
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

// ─── per-section editors ──────────────────────────────────────────────────────

function SectionPanel({
  sKey, content, onChange,
}: {
  sKey: SectionKey;
  content: MultiLPSection;
  onChange: (content: MultiLPSection) => void;
}) {
  function patch<K extends SectionKey>(key: K, value: MultiLPSection[K]) {
    onChange({ ...content, [key]: value });
  }

  switch (sKey) {
    case 'header': {
      const s = content.header;
      return (
        <div className="space-y-3">
          <Field label="Tagline" value={s.tagline} onChange={(v) => patch('header', { ...s, tagline: v })} placeholder="MGR Soluções em Refrigeração Industrial" />
          <Field label="Telefone" value={s.phone} onChange={(v) => patch('header', { ...s, phone: v })} placeholder="(41) 3333-0000" />
          <Field label="WhatsApp (só números)" value={s.whatsapp} onChange={(v) => patch('header', { ...s, whatsapp: v })} placeholder="5541999990000" />
          <Field label="URL do Logo (opcional)" value={s.logo ?? ''} onChange={(v) => patch('header', { ...s, logo: v })} placeholder="https://..." />
        </div>
      );
    }

    case 'hero': {
      const s = content.hero;
      return (
        <div className="space-y-3">
          <Field label="Título principal" value={s.title} onChange={(v) => patch('hero', { ...s, title: v })} placeholder="Câmaras Frias Industriais sob Medida" />
          <Field label="Subtítulo" value={s.subtitle} onChange={(v) => patch('hero', { ...s, subtitle: v })} multiline placeholder="Descrição breve do serviço ou proposta de valor..." />
          <Field label="Badge (texto de destaque, opcional)" value={s.badgeText ?? ''} onChange={(v) => patch('hero', { ...s, badgeText: v })} placeholder="Especialistas em Câmaras Frias" />
          <Field label="URL da imagem de fundo" value={s.backgroundImageUrl} onChange={(v) => patch('hero', { ...s, backgroundImageUrl: v })} placeholder="https://..." />
          <Field label="Texto do botão CTA" value={s.ctaText} onChange={(v) => patch('hero', { ...s, ctaText: v })} placeholder="Solicitar orçamento grátis" />
          <Field label="Link do botão CTA" value={s.ctaLink} onChange={(v) => patch('hero', { ...s, ctaLink: v })} placeholder="https://wa.me/55419..." />
        </div>
      );
    }

    case 'problem': {
      const s = content.problem;
      return (
        <div className="space-y-3">
          <Field label="Título da seção" value={s.title} onChange={(v) => patch('problem', { ...s, title: v })} />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Itens de dor</p>
          <ItemsEditor
            items={s.items as any}
            fields={['icon', 'title', 'description']}
            placeholders={{ icon: 'AlertTriangle', title: 'Problema', description: 'Descrição...' }}
            onChange={(items) => patch('problem', { ...s, items: items as any })}
            addLabel="Adicionar problema"
            emptyItem={{ icon: 'AlertTriangle', title: '', description: '' }}
          />
        </div>
      );
    }

    case 'solution': {
      const s = content.solution;
      return (
        <div className="space-y-3">
          <Field label="Título" value={s.title} onChange={(v) => patch('solution', { ...s, title: v })} />
          <Field label="Subtítulo" value={s.subtitle} onChange={(v) => patch('solution', { ...s, subtitle: v })} />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Serviços / itens de solução</p>
          <ItemsEditor
            items={s.items as any}
            fields={['icon', 'title', 'description']}
            placeholders={{ icon: 'CheckCircle2', title: 'Serviço', description: 'Descrição...' }}
            onChange={(items) => patch('solution', { ...s, items: items as any })}
            addLabel="Adicionar serviço"
            emptyItem={{ icon: 'CheckCircle2', title: '', description: '' }}
          />
        </div>
      );
    }

    case 'socialProof': {
      const s = content.socialProof;
      return (
        <div className="space-y-3">
          <Field label="Título da seção" value={s.title} onChange={(v) => patch('socialProof', { ...s, title: v })} />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Depoimentos / logos de clientes</p>
          <ItemsEditor
            items={s.items as any}
            fields={['name', 'testimonial', 'logoUrl']}
            placeholders={{ name: 'Nome da empresa', testimonial: '"Depoimento..."', logoUrl: 'URL do logo (opcional)' }}
            onChange={(items) => patch('socialProof', { ...s, items: items as any })}
            addLabel="Adicionar cliente"
            emptyItem={{ name: '', testimonial: '', logoUrl: '' }}
          />
        </div>
      );
    }

    case 'differentials': {
      const s = content.differentials;
      return (
        <div className="space-y-3">
          <Field label="Título da seção" value={s.title} onChange={(v) => patch('differentials', { ...s, title: v })} />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Diferenciais</p>
          <ItemsEditor
            items={s.items as any}
            fields={['icon', 'title', 'description']}
            placeholders={{ icon: 'ShieldCheck', title: 'Diferencial', description: 'Descrição...' }}
            onChange={(items) => patch('differentials', { ...s, items: items as any })}
            addLabel="Adicionar diferencial"
            emptyItem={{ icon: 'ShieldCheck', title: '', description: '' }}
          />
        </div>
      );
    }

    case 'bridge': {
      const s = content.bridge;
      return (
        <div className="space-y-3">
          <Field label="Título" value={s.title} onChange={(v) => patch('bridge', { ...s, title: v })} />
          <Field label="Descrição" value={s.description} onChange={(v) => patch('bridge', { ...s, description: v })} multiline />
          <Field label="URL da imagem (opcional)" value={s.imageUrl ?? ''} onChange={(v) => patch('bridge', { ...s, imageUrl: v })} placeholder="https://..." />
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Estatísticas</p>
          <ItemsEditor
            items={s.stats as any}
            fields={['value', 'label']}
            placeholders={{ value: '+500', label: 'Clientes atendidos' }}
            onChange={(items) => patch('bridge', { ...s, stats: items as any })}
            addLabel="Adicionar estatística"
            emptyItem={{ value: '', label: '' }}
          />
        </div>
      );
    }

    case 'cta': {
      const s = content.cta;
      return (
        <div className="space-y-3">
          <Field label="Título" value={s.title} onChange={(v) => patch('cta', { ...s, title: v })} />
          <Field label="Descrição" value={s.description} onChange={(v) => patch('cta', { ...s, description: v })} multiline />
          <Field label="Texto do botão" value={s.buttonText} onChange={(v) => patch('cta', { ...s, buttonText: v })} />
          <Field label="Link do botão" value={s.buttonLink} onChange={(v) => patch('cta', { ...s, buttonLink: v })} placeholder="https://wa.me/..." />
          <Field label="Telefone" value={s.phone} onChange={(v) => patch('cta', { ...s, phone: v })} />
          <Field label="WhatsApp (só números)" value={s.whatsapp} onChange={(v) => patch('cta', { ...s, whatsapp: v })} />
          <Field label="E-mail" value={s.email} onChange={(v) => patch('cta', { ...s, email: v })} type="email" />
        </div>
      );
    }

    case 'footer': {
      const s = content.footer;
      return (
        <div className="space-y-3">
          <Field label="Endereço" value={s.address} onChange={(v) => patch('footer', { ...s, address: v })} />
          <Field label="Telefone" value={s.phone} onChange={(v) => patch('footer', { ...s, phone: v })} />
          <Field label="E-mail" value={s.email} onChange={(v) => patch('footer', { ...s, email: v })} type="email" />
          <Field label="Instagram (URL, opcional)" value={s.instagram ?? ''} onChange={(v) => patch('footer', { ...s, instagram: v })} placeholder="https://instagram.com/..." />
          <Field label="LinkedIn (URL, opcional)" value={s.linkedin ?? ''} onChange={(v) => patch('footer', { ...s, linkedin: v })} placeholder="https://linkedin.com/..." />
          <Field label="Texto de copyright" value={s.copyright} onChange={(v) => patch('footer', { ...s, copyright: v })} />
        </div>
      );
    }

    default:
      return <p className="text-sm text-gray-400">Seção não reconhecida.</p>;
  }
}

// ─── main editor ──────────────────────────────────────────────────────────────

interface LandingPageEditorMultiProps {
  lpId: string;
  onBack: () => void;
}

export default function LandingPageEditorMulti({ lpId, onBack }: LandingPageEditorMultiProps) {
  const [lp, setLp] = useState<MultiLandingPage | null>(null);
  const [content, setContent] = useState<MultiLPSection | null>(null);
  const [name, setName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1B5E8A');
  const [accentColor, setAccentColor] = useState('#D4792A');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionKey>('hero');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'landing_pages', lpId)).then((snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const data = { id: snap.id, ...snap.data() } as MultiLandingPage;
      setLp(data);
      setContent(data.content);
      setName(data.name);
      setPrimaryColor(data.primaryColor ?? '#1B5E8A');
      setAccentColor(data.accentColor ?? '#D4792A');
      setMetaTitle(data.metaTitle ?? data.name);
      setMetaDescription(data.metaDescription ?? '');
      setLoading(false);
    });
  }, [lpId]);

  const handleSave = useCallback(async () => {
    if (!content) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'landing_pages', lpId), {
        name,
        content,
        primaryColor,
        accentColor,
        metaTitle,
        metaDescription,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }, [lpId, name, content, primaryColor, accentColor, metaTitle, metaDescription]);

  // Ctrl/Cmd+S save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={28} className="animate-spin text-brand-600" />
      </div>
    );
  }

  if (!lp || !content) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500">Landing page não encontrada.</p>
        <button onClick={onBack} className="mt-3 text-brand-600 text-sm font-bold">Voltar</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Topbar */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-4 rounded-xl text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold truncate">{name}</h1>
              <p className="text-xs text-brand-100 font-mono">/lp/{lp.slug}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={`/#/lp/${lp.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Preview"
            >
              <Eye size={16} />
            </a>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-700 text-sm font-bold rounded-lg hover:bg-brand-50 transition-colors active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} className="text-green-600" /> : <Save size={14} />}
              {saved ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>

      {/* Settings accordion */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <button
          onClick={() => setShowSettings((v) => !v)}
          className="w-full flex items-center justify-between p-4 text-left"
        >
          <span className="text-sm font-bold text-gray-700">Configurações gerais</span>
          {showSettings ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {showSettings && (
          <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Nome interno" value={name} onChange={setName} />
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Cor primária</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
                  <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">Cor de acento (CTA)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-9 w-12 rounded border border-gray-200 cursor-pointer" />
                  <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent font-mono" />
                </div>
              </div>
              <Field label="Meta título (SEO)" value={metaTitle} onChange={setMetaTitle} />
            </div>
            <Field label="Meta descrição (SEO)" value={metaDescription} onChange={setMetaDescription} multiline placeholder="Descrição para mecanismos de busca (até 160 caracteres)" />
          </div>
        )}
      </div>

      {/* Section nav + editor */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tab strip */}
        <div className="flex overflow-x-auto border-b border-gray-100 px-2 pt-2 gap-1 scrollbar-hide">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={clsx(
                'flex-shrink-0 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors whitespace-nowrap',
                activeSection === s.key
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Section form */}
        <div className="p-4">
          <SectionPanel
            sKey={activeSection}
            content={content}
            onChange={setContent}
          />
        </div>
      </div>

      {/* Bottom save bar */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl shadow-lg transition-colors active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
          {saved ? 'Salvo!' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  );
}

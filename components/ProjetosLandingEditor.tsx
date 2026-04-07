/**
 * components/ProjetosLandingEditor.tsx — Sprint 3
 *
 * Editor visual sem código para a ProjetosLanding.
 * Permite editar textos, fotos (upload), depoimentos, projetos e configs.
 * Salva diretamente no Firestore (system_settings/projetos_landing).
 * Acessível em /app/editor-projetos (somente admin/developer).
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  Save, Loader2, Check, ExternalLink, Trash2, Plus,
  Image, Upload, ChevronDown, ChevronUp, Eye,
} from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import type { ProjetosLandingContent } from './ProjetosLanding';

// ── Helpers UI ──
const Section: React.FC<{ title: string; icon?: string; children: React.ReactNode; defaultOpen?: boolean }> = ({
  title, icon, children, defaultOpen = true,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
        <span className="font-extrabold text-gray-900 flex items-center gap-2">
          {icon && <span>{icon}</span>} {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </div>
  );
};

const Field: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  multiline?: boolean; placeholder?: string; hint?: string;
}> = ({ label, value, onChange, multiline, placeholder, hint }) => (
  <div>
    <label className="text-xs font-bold text-gray-600 block mb-1.5">{label}</label>
    {multiline ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={3}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-brand-500" />
    ) : (
      <input type="text" value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
    )}
    {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
  </div>
);

// ── Upload de imagem ──
const ImageUpload: React.FC<{
  label: string; currentUrl: string; path: string;
  onUpload: (url: string) => void;
}> = ({ label, currentUrl, path, onUpload }) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const sRef = storageRef(storage, `${path}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(sRef, file, { contentType: file.type });
      await new Promise<void>((res, rej) => {
        task.on('state_changed', undefined, rej, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          onUpload(url);
          res();
        });
      });
    } finally { setUploading(false); }
  };

  return (
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
          {currentUrl
            ? <img src={currentUrl} alt="" className="w-full h-full object-cover" />
            : <Image className="w-6 h-6 text-gray-300" />}
        </div>
        <div>
          <button onClick={() => inputRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Enviando...' : 'Enviar Foto'}
          </button>
          {currentUrl && (
            <a href={currentUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-brand-600 mt-1 hover:underline">
              <ExternalLink className="w-3 h-3" /> Ver imagem
            </a>
          )}
        </div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
    </div>
  );
};

// ── Componente principal ──
const ProjetosLandingEditor: React.FC = () => {
  const [content, setContent] = useState<ProjetosLandingContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'system_settings', 'projetos_landing'), snap => {
      if (snap.exists()) setContent(snap.data() as ProjetosLandingContent);
    });
    return () => unsub();
  }, []);

  const update = (path: string[], value: any) => {
    setContent(prev => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      let obj: any = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'projetos_landing'), content);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  if (!content) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-20 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Editor — LP Projetos</h1>
          <p className="text-sm text-gray-500">Edite e salve. As alterações aparecem em tempo real na página pública.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/projetos" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50">
            <Eye className="w-3.5 h-3.5" /> Ver Página
          </a>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
              saved ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
            } disabled:opacity-60`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* SEO */}
      <Section title="SEO" icon="🔍" defaultOpen={false}>
        <Field label="Título da Página (title tag)" value={content.seo.title}
          onChange={v => update(['seo', 'title'], v)} />
        <Field label="Descrição (meta description)" value={content.seo.description}
          onChange={v => update(['seo', 'description'], v)} multiline
          hint="Aparece nos resultados de busca do Google. Ideal: 150-160 caracteres." />
      </Section>

      {/* Hero */}
      <Section title="Hero (Seção Principal)" icon="🦸">
        <Field label="Título Principal" value={content.hero.titulo}
          onChange={v => update(['hero', 'titulo'], v)} multiline />
        <Field label="Subtítulo" value={content.hero.subtitulo}
          onChange={v => update(['hero', 'subtitulo'], v)} multiline />
        <Field label="Badge (selo destaque)" value={content.hero.badge}
          onChange={v => update(['hero', 'badge'], v)}
          placeholder="✅ Mais de 300 projetos entregues" />
        <Field label="Texto do Botão CTA" value={content.hero.cta}
          onChange={v => update(['hero', 'cta'], v)} />
      </Section>

      {/* Diferenciais */}
      <Section title="Diferenciais" icon="⚡">
        {content.diferenciais.map((d, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3 relative">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Diferencial {i + 1}</span>
              {content.diferenciais.length > 1 && (
                <button onClick={() => {
                  const arr = [...content.diferenciais];
                  arr.splice(i, 1);
                  update(['diferenciais'], arr);
                }} className="w-6 h-6 bg-red-100 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-200">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Ícone (emoji)" value={d.icone}
                onChange={v => { const arr = [...content.diferenciais]; arr[i] = { ...arr[i], icone: v }; update(['diferenciais'], arr); }}
                placeholder="⚡" />
              <div className="col-span-2">
                <Field label="Título" value={d.titulo}
                  onChange={v => { const arr = [...content.diferenciais]; arr[i] = { ...arr[i], titulo: v }; update(['diferenciais'], arr); }} />
              </div>
            </div>
            <Field label="Descrição" value={d.descricao}
              onChange={v => { const arr = [...content.diferenciais]; arr[i] = { ...arr[i], descricao: v }; update(['diferenciais'], arr); }}
              multiline />
          </div>
        ))}
        <button onClick={() => {
          update(['diferenciais'], [...content.diferenciais, { icone: '🏅', titulo: 'Novo Diferencial', descricao: 'Descrição...' }]);
        }} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">
          <Plus className="w-3.5 h-3.5" /> Adicionar Diferencial
        </button>
      </Section>

      {/* Projetos */}
      <Section title="Galeria de Projetos" icon="🏗️">
        <Field label="Título da Seção" value={content.projetos.secaoTitulo}
          onChange={v => update(['projetos', 'secaoTitulo'], v)} />
        {content.projetos.itens.map((p, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide">Projeto {i + 1}</span>
              {content.projetos.itens.length > 1 && (
                <button onClick={() => {
                  const arr = [...content.projetos.itens];
                  arr.splice(i, 1);
                  update(['projetos', 'itens'], arr);
                }} className="w-6 h-6 bg-red-100 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-200">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título" value={p.titulo}
                onChange={v => { const arr = [...content.projetos.itens]; arr[i] = { ...arr[i], titulo: v }; update(['projetos', 'itens'], arr); }} />
              <Field label="Tag" value={p.tag}
                onChange={v => { const arr = [...content.projetos.itens]; arr[i] = { ...arr[i], tag: v }; update(['projetos', 'itens'], arr); }}
                placeholder="Câmara Fria" />
            </div>
            <Field label="Descrição" value={p.descricao}
              onChange={v => { const arr = [...content.projetos.itens]; arr[i] = { ...arr[i], descricao: v }; update(['projetos', 'itens'], arr); }}
              multiline />
            <ImageUpload label="Foto do Projeto" currentUrl={p.fotoUrl}
              path="projetos_landing/projetos"
              onUpload={url => { const arr = [...content.projetos.itens]; arr[i] = { ...arr[i], fotoUrl: url }; update(['projetos', 'itens'], arr); }} />
          </div>
        ))}
        <button onClick={() => {
          update(['projetos', 'itens'], [...content.projetos.itens, { titulo: 'Novo Projeto', descricao: '', fotoUrl: '', tag: 'Câmara' }]);
        }} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">
          <Plus className="w-3.5 h-3.5" /> Adicionar Projeto
        </button>
      </Section>

      {/* Empresa */}
      <Section title="Sobre a Empresa" icon="🏢">
        <Field label="Título da Seção" value={content.empresa.secaoTitulo}
          onChange={v => update(['empresa', 'secaoTitulo'], v)} />
        <Field label="Descrição" value={content.empresa.descricao}
          onChange={v => update(['empresa', 'descricao'], v)} multiline />

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">Fotos da Empresa (galeria 2x2)</p>
          <div className="grid grid-cols-2 gap-3">
            {[0,1,2,3].map(i => (
              <ImageUpload key={i} label={`Foto ${i + 1}`}
                currentUrl={content.empresa.fotos[i] || ''}
                path="projetos_landing/empresa"
                onUpload={url => {
                  const arr = [...content.empresa.fotos];
                  arr[i] = url;
                  update(['empresa', 'fotos'], arr);
                }} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-600 mb-2">Números / Stats</p>
          {content.empresa.stats.map((s, i) => (
            <div key={i} className="grid grid-cols-2 gap-3 mb-2">
              <Field label={`Valor ${i + 1}`} value={s.valor}
                onChange={v => { const arr = [...content.empresa.stats]; arr[i] = { ...arr[i], valor: v }; update(['empresa', 'stats'], arr); }} />
              <Field label={`Rótulo ${i + 1}`} value={s.label}
                onChange={v => { const arr = [...content.empresa.stats]; arr[i] = { ...arr[i], label: v }; update(['empresa', 'stats'], arr); }} />
            </div>
          ))}
        </div>
      </Section>

      {/* Depoimentos */}
      <Section title="Depoimentos de Clientes" icon="⭐" defaultOpen={false}>
        {content.depoimentos.map((d, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-gray-500">Depoimento {i + 1}</span>
              <button onClick={() => {
                const arr = [...content.depoimentos];
                arr.splice(i, 1);
                update(['depoimentos'], arr);
              }} className="w-6 h-6 bg-red-100 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-200">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome" value={d.nome}
                onChange={v => { const arr = [...content.depoimentos]; arr[i] = { ...arr[i], nome: v }; update(['depoimentos'], arr); }} />
              <Field label="Empresa" value={d.empresa}
                onChange={v => { const arr = [...content.depoimentos]; arr[i] = { ...arr[i], empresa: v }; update(['depoimentos'], arr); }} />
            </div>
            <Field label="Texto do Depoimento" value={d.texto}
              onChange={v => { const arr = [...content.depoimentos]; arr[i] = { ...arr[i], texto: v }; update(['depoimentos'], arr); }}
              multiline />
          </div>
        ))}
        <button onClick={() => {
          update(['depoimentos'], [...content.depoimentos, { nome: 'Cliente', empresa: 'Empresa', texto: 'Ótimo serviço!', nota: 5 }]);
        }} className="flex items-center gap-1.5 px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50">
          <Plus className="w-3.5 h-3.5" /> Adicionar Depoimento
        </button>
      </Section>

      {/* Formulário */}
      <Section title="Formulário de Lead" icon="📩" defaultOpen={false}>
        <Field label="Título do Formulário" value={content.form.titulo}
          onChange={v => update(['form', 'titulo'], v)} />
        <Field label="Subtítulo" value={content.form.subtitulo}
          onChange={v => update(['form', 'subtitulo'], v)} />
      </Section>

      {/* Contato */}
      <Section title="Informações de Contato" icon="📞" defaultOpen={false}>
        <Field label="WhatsApp (só números, com DDI)" value={content.contato.whatsapp}
          onChange={v => update(['contato', 'whatsapp'], v)}
          placeholder="5519999999999"
          hint="Formato: 55 + DDD + número. Ex: 5519987654321" />
        <Field label="Telefone (exibição)" value={content.contato.telefone}
          onChange={v => update(['contato', 'telefone'], v)} placeholder="(19) 3333-3333" />
        <Field label="Instagram" value={content.contato.instagram}
          onChange={v => update(['contato', 'instagram'], v)} placeholder="@mgrrefrigeracao" />
      </Section>

      {/* Salvar fixo no rodapé */}
      <div className="fixed bottom-6 right-6 left-6 max-w-4xl mx-auto">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl p-4 flex items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            {saved ? '✅ Todas as alterações foram salvas!' : 'Você tem alterações não salvas.'}
          </p>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-extrabold transition-all ${
              saved ? 'bg-emerald-600 text-white' : 'bg-brand-600 text-white hover:bg-brand-700'
            } disabled:opacity-60`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjetosLandingEditor;

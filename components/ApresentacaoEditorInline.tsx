/**
 * components/ApresentacaoEditorInline.tsx
 *
 * Editor de apresentação embutido dentro do Flow de Proposta (F3).
 * Abre em overlay full-screen — sem abrir nova aba.
 *
 * Regra central: slides de INVESTIMENTO (preço) não estão disponíveis aqui.
 * Preço é comunicado via Documento Comercial (PropostaDoc) — não nos slides visuais.
 *
 * Tipos disponíveis: cover · overview · deliverables · timeline · closing
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, doc, onSnapshot, updateDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  Presentation, SlideData, SlideType, PresentationTema, PresentationStatus,
  CoverData, OverviewData, DeliverablesData, TimelineData, ClosingData,
  DeliverableItem, TimelineFase, CollectionName,
} from '../types';
import {
  X, Save, Loader2, Check, ChevronLeft, ChevronRight, Eye, Link2,
  Plus, Trash2, GripVertical, ExternalLink, Copy, Palette, AlertCircle,
  Play, Globe,
} from 'lucide-react';
import {
  SlideCover as CoverSlide,
  SlideOverview as OverviewSlide,
  SlideDeliverables as DeliverablesSlide,
  SlideTimeline as TimelineSlide,
  SlideClosing as ClosingSlide,
  TEMAS, SLIDE_KEYFRAMES,
} from './ApresentacaoSlides';

// ── Tipos de slide disponíveis (SEM investimento) ─────────────────────────────
const TIPOS_DISPONIVEIS: { type: SlideType; label: string; emoji: string; desc: string }[] = [
  { type: 'cover',        label: 'Capa',        emoji: '🎯', desc: 'Título, cliente e data' },
  { type: 'overview',     label: 'Visão Geral',  emoji: '📋', desc: 'Localização, temperatura, finalidade' },
  { type: 'deliverables', label: 'Entregas',     emoji: '✅', desc: 'O que o cliente vai receber' },
  { type: 'timeline',     label: 'Cronograma',   emoji: '📅', desc: 'Fases e prazos de execução' },
  { type: 'closing',      label: 'Encerramento', emoji: '🤝', desc: 'CTA e contato final' },
];

const TEMAS_LIST: { value: PresentationTema; label: string; dot: string }[] = [
  { value: 'mgr-classic', label: 'MGR Laranja (Padrão)', dot: '#E8593C' },
  { value: 'dark-navy',   label: 'Dark Navy',            dot: '#3b82f6' },
  { value: 'dark-slate',  label: 'Dark Slate',           dot: '#22d3ee' },
  { value: 'dark-teal',   label: 'Dark Teal',            dot: '#10b981' },
];

// ── Utils ─────────────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const SLIDE_LABELS: Record<SlideType, string> = {
  cover: 'Capa', overview: 'Visão Geral', deliverables: 'Entregas',
  timeline: 'Cronograma', investment: 'Investimento', closing: 'Encerramento',
};

// ── Formulários por tipo ──────────────────────────────────────────────────────
const CoverForm: React.FC<{ data: CoverData; onChange: (d: CoverData) => void }> = ({ data, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Título do projeto *</label>
      <input value={data.titulo} onChange={e => onChange({ ...data, titulo: e.target.value })}
        maxLength={80} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
        placeholder="Ex: Câmara Frigorífica Industrial" />
    </div>
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Subtítulo</label>
      <input value={data.subtitulo ?? ''} onChange={e => onChange({ ...data, subtitulo: e.target.value })}
        maxLength={120} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
        placeholder="Ex: Proposta de Solução e Entregáveis Estratégicos" />
    </div>
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Nome do cliente *</label>
      <input value={data.clienteNome} onChange={e => onChange({ ...data, clienteNome: e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
        placeholder="Ex: Indaia Pescados" />
    </div>
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Validade da proposta</label>
      <input value={data.dataValidade ?? ''} onChange={e => onChange({ ...data, dataValidade: e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
        placeholder="Ex: 30/06/2026" />
    </div>
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input type="checkbox" checked={data.usarLogoMGR !== false}
        onChange={e => onChange({ ...data, usarLogoMGR: e.target.checked })}
        className="rounded" />
      Exibir logo MGR
    </label>
  </div>
);

const OverviewForm: React.FC<{ data: OverviewData; onChange: (d: OverviewData) => void }> = ({ data, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Descrição do projeto</label>
      <textarea value={data.descricao ?? ''} onChange={e => onChange({ ...data, descricao: e.target.value })}
        maxLength={400} rows={4}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
        placeholder="Descreva o escopo e objetivos..." />
    </div>
    {([
      { key: 'localizacao', label: 'Localização',        ph: 'Ex: Indaiatuba, SP' },
      { key: 'temperatura', label: 'Temperatura alvo',   ph: 'Ex: 0°C ou -18°C' },
      { key: 'finalidade',  label: 'Finalidade',         ph: 'Ex: Armazenamento de insumos perecíveis' },
      { key: 'metragem',    label: 'Metragem / Dimensões', ph: 'Ex: 17,5m × 5,4m × 6m — 94,5 m²' },
    ] as const).map(({ key, label, ph }) => (
      <div key={key}>
        <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
        <input value={(data as any)[key] ?? ''} onChange={e => onChange({ ...data, [key]: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
          placeholder={ph} />
      </div>
    ))}
  </div>
);

const DeliverablesForm: React.FC<{ data: DeliverablesData; onChange: (d: DeliverablesData) => void }> = ({ data, onChange }) => {
  const add = () => onChange({ items: [...data.items, { id: uid(), categoria: '', descricao: '' }] });
  const rm  = (id: string) => onChange({ items: data.items.filter(i => i.id !== id) });
  const upd = (id: string, f: 'categoria' | 'descricao', v: string) =>
    onChange({ items: data.items.map(i => i.id === id ? { ...i, [f]: v } : i) });
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">Máximo 8 itens · Foca no <strong>benefício</strong>, não no preço</p>
      {data.items.map((item, i) => (
        <div key={item.id} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 w-4 text-center">{i + 1}</span>
            <input value={item.categoria} onChange={e => upd(item.id, 'categoria', e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-400 bg-white font-semibold"
              placeholder="Título da entrega (ex: ❄ PIR 200mm)" />
            <button onClick={() => rm(item.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input value={item.descricao} onChange={e => upd(item.id, 'descricao', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-400 bg-white text-gray-600"
            placeholder="Benefício para o cliente (ex: Máxima eficiência energética com isolamento premium)" />
        </div>
      ))}
      {data.items.length < 8 && (
        <button onClick={add} className="flex items-center gap-1.5 text-xs text-brand-600 font-bold hover:text-brand-700">
          <Plus className="w-3.5 h-3.5" /> Adicionar entrega
        </button>
      )}
    </div>
  );
};

const TimelineForm: React.FC<{ data: TimelineData; onChange: (d: TimelineData) => void }> = ({ data, onChange }) => {
  const add = () => onChange({ ...data, fases: [...data.fases, { id: uid(), nome: '', prazo: '', descricao: '' }] });
  const rm  = (id: string) => onChange({ ...data, fases: data.fases.filter(f => f.id !== id) });
  const upd = (id: string, field: keyof TimelineFase, val: string) =>
    onChange({ ...data, fases: data.fases.map(f => f.id === id ? { ...f, [field]: val } : f) });
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Total estimado</label>
        <input value={data.totalDias ?? ''} onChange={e => onChange({ ...data, totalDias: e.target.value })}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
          placeholder="Ex: 30 dias úteis" />
      </div>
      <p className="text-xs font-bold text-gray-600">Fases</p>
      {data.fases.map((fase, i) => (
        <div key={fase.id} className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 w-4 text-center">{i + 1}</span>
            <input value={fase.nome} onChange={e => upd(fase.id, 'nome', e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-400 bg-white font-semibold"
              placeholder={`Fase ${i + 1} (ex: Estrutura Térmica)`} />
            <input value={fase.prazo} onChange={e => upd(fase.id, 'prazo', e.target.value)}
              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-400 bg-white text-center"
              placeholder="10 dias" />
            <button onClick={() => rm(fase.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
          <input value={fase.descricao ?? ''} onChange={e => upd(fase.id, 'descricao', e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-400 bg-white text-gray-600"
            placeholder="Descrição da fase (opcional)" />
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs text-brand-600 font-bold hover:text-brand-700">
        <Plus className="w-3.5 h-3.5" /> Adicionar fase
      </button>
    </div>
  );
};

const ClosingForm: React.FC<{
  data: ClosingData;
  responsavel: string; email: string; telefone: string;
  onChange: (d: ClosingData) => void;
  onContact: (f: string, v: string) => void;
}> = ({ data, responsavel, email, telefone, onChange, onContact }) => (
  <div className="space-y-4">
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Texto do botão CTA</label>
      <input value={data.textoCTA ?? ''} onChange={e => onChange({ ...data, textoCTA: e.target.value })}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400"
        placeholder="Ver documento comercial completo" />
    </div>
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-1">Texto de encerramento</label>
      <textarea value={data.textoFechamento ?? ''} onChange={e => onChange({ ...data, textoFechamento: e.target.value })}
        rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-400 resize-none"
        placeholder="Agradecemos a confiança e estamos à disposição..." />
    </div>
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
      <input type="checkbox" checked={data.exibirContato !== false}
        onChange={e => onChange({ ...data, exibirContato: e.target.checked })} className="rounded" />
      Exibir contato no slide
    </label>
    {data.exibirContato !== false && (
      <div className="space-y-2 pl-4 border-l-2 border-gray-100">
        {[
          { field: 'responsavel',  label: 'Responsável', ph: 'Miguel / Giovanni' },
          { field: 'email',        label: 'E-mail',       ph: 'administrativo.mgr@gmail.com' },
          { field: 'telefone',     label: 'Telefone',     ph: '(19) 97138-2628' },
        ].map(({ field, label, ph }) => (
          <div key={field}>
            <label className="text-[10px] font-bold text-gray-500 block mb-1">{label}</label>
            <input
              value={field === 'responsavel' ? responsavel : field === 'email' ? email : telefone}
              onChange={e => onContact(field, e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-400"
              placeholder={ph}
            />
          </div>
        ))}
      </div>
    )}
  </div>
);

// ── Renderizador de slide por tipo ────────────────────────────────────────────
function renderSlide(slide: SlideData, tema: PresentationTema, responsavel?: string, email?: string, tel?: string) {
  const tc = TEMAS[tema];
  switch (slide.type) {
    case 'cover':        return <CoverSlide       data={slide.data as CoverData}        tema={tc} />;
    case 'overview':     return <OverviewSlide     data={slide.data as OverviewData}     tema={tc} />;
    case 'deliverables': return <DeliverablesSlide data={slide.data as DeliverablesData} tema={tc} />;
    case 'timeline':     return <TimelineSlide     data={slide.data as TimelineData}     tema={tc} />;
    case 'closing':      return <ClosingSlide      data={slide.data as ClosingData} tema={tc}
                            presentation={{ responsavel: responsavel || '', responsavelEmail: email || '', responsavelTelefone: tel || '' }} />;
    default:             return <div className="flex items-center justify-center h-full text-white/40 text-sm">Slide sem preview</div>;
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  apresentacaoId: string;
  projetoNome: string;
  onClose: () => void;
}

// ── Componente Principal ──────────────────────────────────────────────────────
const ApresentacaoEditorInline: React.FC<Props> = ({ apresentacaoId, projetoNome, onClose }) => {
  const [apresentacao, setApresentacao] = useState<Presentation | null>(null);
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tema, setTema] = useState<PresentationTema>('mgr-classic');
  const [meta, setMeta] = useState({ responsavel: '', email: '', telefone: '' });

  // Carrega apresentação em tempo real
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, CollectionName.PRESENTATIONS, apresentacaoId),
      snap => {
        if (!snap.exists()) return;
        const d = snap.data() as Presentation;
        const ap = { ...d, id: snap.id };
        setApresentacao(ap);
        const sorted = [...(d.slides || [])].sort((a, b) => a.order - b.order);
        setSlides(sorted);
        setTema(d.tema || 'mgr-classic');
        setMeta({
          responsavel: d.responsavel || '',
          email: d.responsavelEmail || '',
          telefone: d.responsavelTelefone || '',
        });
        setPublished(d.status === 'ativa');
      },
    );
    return () => unsub();
  }, [apresentacaoId]);

  // ── Atualizar slide selecionado ──────────────────────────────────────────
  const updateCurrentSlide = useCallback((updated: SlideData) => {
    setSlides(prev => prev.map((s, i) => i === selectedIdx ? updated : s));
    setSaved(false);
  }, [selectedIdx]);

  // ── Adicionar novo slide ──────────────────────────────────────────────────
  const addSlide = (type: SlideType) => {
    const novoSlide: SlideData = (() => {
      switch (type) {
        case 'cover':        return { type, order: slides.length, visible: true, data: { titulo: projetoNome, subtitulo: 'Proposta de Solução', clienteNome: apresentacao?.clienteNome || '', dataValidade: '', usarLogoMGR: true } as CoverData };
        case 'overview':     return { type, order: slides.length, visible: true, data: { descricao: '', localizacao: '', temperatura: '', finalidade: '', metragem: '' } as OverviewData };
        case 'deliverables': return { type, order: slides.length, visible: true, data: { items: [{ id: uid(), categoria: '', descricao: '' }] } as DeliverablesData };
        case 'timeline':     return { type, order: slides.length, visible: true, data: { fases: [{ id: uid(), nome: 'Fase 1', prazo: '', descricao: '' }], totalDias: '' } as TimelineData };
        case 'closing':      return { type, order: slides.length, visible: true, data: { textoCTA: 'Ver documento comercial completo', textoFechamento: 'Agradecemos a confiança e estamos à disposição para esclarecer qualquer dúvida.', exibirContato: true } as ClosingData };
        default:             return { type, order: slides.length, visible: true, data: {} as any };
      }
    })();
    const newSlides = [...slides, novoSlide];
    setSlides(newSlides);
    setSelectedIdx(newSlides.length - 1);
    setAdding(false);
    setSaved(false);
  };

  // ── Remover slide ────────────────────────────────────────────────────────
  const removeSlide = (idx: number) => {
    if (slides.length <= 1) return;
    const next = slides.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }));
    setSlides(next);
    setSelectedIdx(Math.max(0, Math.min(idx, next.length - 1)));
    setSaved(false);
  };

  // ── Mover slide ──────────────────────────────────────────────────────────
  const moveSlide = (from: number, to: number) => {
    if (to < 0 || to >= slides.length) return;
    const arr = [...slides];
    const [item] = arr.splice(from, 1);
    arr.splice(to, 0, item);
    setSlides(arr.map((s, i) => ({ ...s, order: i })));
    setSelectedIdx(to);
    setSaved(false);
  };

  // ── Salvar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      const orderedSlides = slides.map((s, i) => ({ ...s, order: i }));
      await updateDoc(doc(db, CollectionName.PRESENTATIONS, apresentacaoId), {
        slides: orderedSlides,
        tema,
        responsavel: meta.responsavel,
        responsavelEmail: meta.email,
        responsavelTelefone: meta.telefone,
        updatedAt: serverTimestamp(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  // ── Publicar ─────────────────────────────────────────────────────────────
  const handlePublicar = async () => {
    setPublishing(true);
    try {
      const orderedSlides = slides.map((s, i) => ({ ...s, order: i }));
      await updateDoc(doc(db, CollectionName.PRESENTATIONS, apresentacaoId), {
        slides: orderedSlides,
        tema,
        responsavel: meta.responsavel,
        responsavelEmail: meta.email,
        responsavelTelefone: meta.telefone,
        status: 'ativa' as PresentationStatus,
        updatedAt: serverTimestamp(),
      });
      setPublished(true);
    } finally {
      setPublishing(false);
    }
  };

  const linkPublico = apresentacao?.slug
    ? `${window.location.origin}/#/apresentacao/${apresentacao.slug}`
    : null;

  const handleCopyLink = async () => {
    if (!linkPublico) return;
    await navigator.clipboard.writeText(linkPublico);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentSlide = slides[selectedIdx];

  if (!apresentacao) {
    return (
      <div className="fixed inset-0 z-[100] bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    );
  }

  return (
    <>
      <style>{SLIDE_KEYFRAMES}</style>

      {/* Overlay full-screen */}
      <div className="fixed inset-0 z-[100] bg-[#0A1628] flex flex-col">

        {/* ── Barra superior ── */}
        <div className="flex-none h-12 bg-[#0d1f35] border-b border-white/10 flex items-center justify-between px-4 gap-3">
          {/* Voltar */}
          <button onClick={onClose}
            className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-bold transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Voltar ao Projeto</span>
          </button>

          {/* Título */}
          <div className="flex items-center gap-2 text-white/90 text-sm font-bold truncate flex-1 justify-center">
            <span className="text-brand-400">●</span>
            <span className="truncate">{projetoNome}</span>
            <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full text-white/50 flex-shrink-0">Slides</span>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Link público */}
            {linkPublico && (
              <button onClick={handleCopyLink}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Link2 className="w-3 h-3" />}
                <span className="hidden sm:inline">{copied ? 'Copiado!' : 'Copiar link'}</span>
              </button>
            )}
            {/* Ver público */}
            {linkPublico && (
              <a href={linkPublico} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors">
                <Eye className="w-3 h-3" />
                <span className="hidden sm:inline">Ver</span>
              </a>
            )}
            {/* Salvar */}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <Check className="w-3 h-3 text-emerald-400" /> : <Save className="w-3 h-3" />}
              <span className="hidden sm:inline">{saved ? 'Salvo!' : 'Salvar'}</span>
            </button>
            {/* Publicar */}
            <button onClick={handlePublicar} disabled={publishing}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
                published
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-brand-500 text-white hover:bg-brand-600'
              }`}>
              {publishing
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : published ? <Check className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
              <span className="hidden sm:inline">{published ? 'Publicado' : 'Publicar'}</span>
            </button>
          </div>
        </div>

        {/* ── Corpo: 3 colunas ── */}
        <div className="flex-1 flex overflow-hidden">

          {/* ── Coluna 1: Lista de slides ── */}
          <div className="w-48 flex-none bg-[#091423] border-r border-white/10 flex flex-col overflow-y-auto">
            <div className="p-3 space-y-1.5">
              {slides.map((slide, i) => (
                <div
                  key={`${slide.type}-${i}`}
                  onClick={() => setSelectedIdx(i)}
                  className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                    i === selectedIdx
                      ? 'bg-brand-500/20 border border-brand-500/40 text-white'
                      : 'hover:bg-white/5 text-white/60 hover:text-white/80'
                  }`}>
                  <span className="font-extrabold text-[10px] text-white/30 w-4 text-center flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 truncate font-medium">{SLIDE_LABELS[slide.type]}</span>
                  <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
                    <button onClick={e => { e.stopPropagation(); moveSlide(i, i - 1); }}
                      disabled={i === 0}
                      className="p-1 hover:bg-white/10 rounded disabled:opacity-20 text-white/50">
                      <ChevronLeft className="w-3 h-3 rotate-90" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); moveSlide(i, i + 1); }}
                      disabled={i === slides.length - 1}
                      className="p-1 hover:bg-white/10 rounded disabled:opacity-20 text-white/50">
                      <ChevronRight className="w-3 h-3 rotate-90" />
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeSlide(i); }}
                      disabled={slides.length <= 1}
                      className="p-1 hover:bg-red-500/20 rounded disabled:opacity-20 text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar slide */}
            <div className="p-3 border-t border-white/10 mt-auto">
              {!adding ? (
                <button onClick={() => setAdding(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-white/40 hover:text-white/70 border border-dashed border-white/20 hover:border-white/40 rounded-xl transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Novo slide
                </button>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] text-white/40 font-bold">Tipo de slide</span>
                    <button onClick={() => setAdding(false)} className="text-white/30 hover:text-white/60">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {TIPOS_DISPONIVEIS.map(t => (
                    <button key={t.type} onClick={() => addSlide(t.type)}
                      className="w-full text-left flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                      <span>{t.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{t.label}</p>
                        <p className="text-[10px] text-white/30 truncate">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                  {/* Aviso sobre investment */}
                  <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-[10px] text-amber-400/80 leading-relaxed">
                      ⚠️ <strong>Slide de Preço</strong> não disponível aqui — use o <em>Documento Comercial</em> para comunicar valores ao cliente.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Coluna 2: Preview do slide ── */}
          <div className="flex-1 flex flex-col bg-[#0A1628] overflow-hidden">
            {/* Seletor de tema */}
            <div className="flex-none flex items-center gap-2 px-4 py-2 border-b border-white/10">
              <Palette className="w-3.5 h-3.5 text-white/30" />
              <span className="text-[10px] text-white/30 font-bold">TEMA</span>
              <div className="flex items-center gap-1.5 ml-1">
                {TEMAS_LIST.map(t => (
                  <button key={t.value} onClick={() => { setTema(t.value); setSaved(false); }}
                    title={t.label}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      tema === t.value ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'
                    }`}
                    style={{ background: t.dot }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-white/20 ml-auto">
                Slide {selectedIdx + 1} de {slides.length}
              </span>
            </div>

            {/* Preview do slide */}
            <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
              {currentSlide ? (
                <div
                  className="w-full rounded-2xl overflow-hidden shadow-2xl"
                  style={{
                    aspectRatio: '16/9',
                    maxWidth: '720px',
                    maxHeight: '405px',
                    background: TEMAS[tema].bg,
                  }}>
                  {renderSlide(currentSlide, tema, meta.responsavel, meta.email, meta.telefone)}
                </div>
              ) : (
                <div className="text-white/30 text-sm">Selecione um slide</div>
              )}
            </div>

            {/* Navegação rápida de slide */}
            <div className="flex-none flex items-center justify-center gap-3 pb-3">
              <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))}
                disabled={selectedIdx === 0}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex gap-1.5">
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setSelectedIdx(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === selectedIdx ? 'bg-brand-400 w-4' : 'bg-white/20 hover:bg-white/40'
                    }`}
                  />
                ))}
              </div>
              <button onClick={() => setSelectedIdx(i => Math.min(slides.length - 1, i + 1))}
                disabled={selectedIdx === slides.length - 1}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white disabled:opacity-20 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Coluna 3: Formulário de edição ── */}
          <div className="w-80 flex-none bg-white overflow-y-auto flex flex-col">
            {/* Header do form */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex items-center gap-2 z-10">
              <span className="text-lg">{TIPOS_DISPONIVEIS.find(t => t.type === currentSlide?.type)?.emoji || '📄'}</span>
              <div>
                <p className="text-sm font-extrabold text-gray-800">{SLIDE_LABELS[currentSlide?.type || 'cover']}</p>
                <p className="text-[10px] text-gray-400">Slide {selectedIdx + 1}</p>
              </div>
            </div>

            {/* Formulário */}
            <div className="flex-1 px-5 py-4">
              {currentSlide?.type === 'cover' && (
                <CoverForm
                  data={currentSlide.data as CoverData}
                  onChange={d => updateCurrentSlide({ ...currentSlide, data: d })}
                />
              )}
              {currentSlide?.type === 'overview' && (
                <OverviewForm
                  data={currentSlide.data as OverviewData}
                  onChange={d => updateCurrentSlide({ ...currentSlide, data: d })}
                />
              )}
              {currentSlide?.type === 'deliverables' && (
                <DeliverablesForm
                  data={currentSlide.data as DeliverablesData}
                  onChange={d => updateCurrentSlide({ ...currentSlide, data: d })}
                />
              )}
              {currentSlide?.type === 'timeline' && (
                <TimelineForm
                  data={currentSlide.data as TimelineData}
                  onChange={d => updateCurrentSlide({ ...currentSlide, data: d })}
                />
              )}
              {currentSlide?.type === 'closing' && (
                <ClosingForm
                  data={currentSlide.data as ClosingData}
                  responsavel={meta.responsavel}
                  email={meta.email}
                  telefone={meta.telefone}
                  onChange={d => updateCurrentSlide({ ...currentSlide, data: d })}
                  onContact={(f, v) => setMeta(m => ({ ...m, [f === 'email' ? 'email' : f === 'telefone' ? 'telefone' : 'responsavel']: v }))}
                />
              )}
              {currentSlide?.type === 'investment' && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                  <p className="font-bold mb-1">⚠️ Slide de Investimento</p>
                  <p className="text-xs">Este slide contém preço e <strong>não deve ser usado na apresentação ao cliente</strong>.</p>
                  <p className="text-xs mt-2">Use o <strong>Documento Comercial</strong> (Passo 3) para comunicar valores ao cliente de forma estruturada.</p>
                  <button onClick={() => removeSlide(selectedIdx)}
                    className="mt-3 flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-800">
                    <Trash2 className="w-3.5 h-3.5" /> Remover este slide
                  </button>
                </div>
              )}
            </div>

            {/* Link público no rodapé do form */}
            {linkPublico && (
              <div className="flex-none p-4 border-t border-gray-100 bg-emerald-50">
                <p className="text-[10px] font-bold text-emerald-700 mb-1.5">✅ Publicado — Link para o cliente:</p>
                <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-emerald-200">
                  <span className="text-[10px] text-gray-500 flex-1 truncate font-mono">{linkPublico}</span>
                  <button onClick={handleCopyLink}
                    className="flex-shrink-0 p-1 hover:bg-emerald-50 rounded-lg text-emerald-600">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ApresentacaoEditorInline;

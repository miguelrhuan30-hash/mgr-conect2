/**
 * components/Apresentacoes.tsx — Sprint 51
 *
 * Módulo admin de Apresentações Interativas.
 * Inclui:
 *  - Lista de apresentações com busca / status
 *  - Editor inline: painel de slides + formulário por tipo + upload PDF
 *  - Geração de link público /p/{slug}
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  updateDoc, doc, getDoc, serverTimestamp, getDocs, where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Presentation, SlideData, SlideType, PresentationTema, PresentationStatus,
  CoverData, OverviewData, DeliverablesData, TimelineData, InvestmentData, ClosingData,
  DeliverableItem, TimelineFase, InvestmentBreakdownItem, InvestmentParcela,
  CollectionName,
} from '../types';
import {
  Presentation as PresentIcon, Plus, Loader2, X, Save, Search,
  Copy, Check, ExternalLink, Eye, Archive, FileText, Upload,
  ChevronRight, ChevronLeft, Trash2, GripVertical, Link2,
  Palette, Settings, AlertCircle, Play,
} from 'lucide-react';

// ── Tipos de slide com label ──
const SLIDE_TYPES: { type: SlideType; label: string; emoji: string }[] = [
  { type: 'cover',        label: 'Capa',           emoji: '🎯' },
  { type: 'overview',     label: 'Visão Geral',     emoji: '📋' },
  { type: 'deliverables', label: 'Entregas',         emoji: '✅' },
  { type: 'timeline',     label: 'Cronograma',       emoji: '📅' },
  { type: 'investment',   label: 'Investimento',     emoji: '💰' },
  { type: 'closing',      label: 'Encerramento',     emoji: '🤝' },
];

const TEMAS_LIST: { value: PresentationTema; label: string; dot: string }[] = [
  { value: 'dark-navy',  label: 'Dark Navy',  dot: '#3b82f6' },
  { value: 'dark-slate', label: 'Dark Slate', dot: '#22d3ee' },
  { value: 'dark-teal',  label: 'Dark Teal',  dot: '#10b981' },
];

// ── Gera slug único sem nanoid ──
async function generateSlug(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => chars[b % chars.length]).join('');
    const slug = `mgr-${rand}`;
    const q = query(collection(db, CollectionName.PRESENTATIONS), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return slug;
  }
  return `mgr-${Date.now().toString(36)}`;
}

// ── Slides padrão ao criar nova apresentação ──
function defaultSlides(clienteNome = ''): SlideData[] {
  return [
    { type: 'cover',        order: 0, visible: true, data: { titulo: 'Título do Projeto', subtitulo: 'Proposta de Execução', clienteNome, dataValidade: '', usarLogoMGR: true } as CoverData },
    { type: 'overview',     order: 1, visible: true, data: { descricao: 'Descreva o escopo e objetivos do projeto.', localizacao: '', temperatura: '', finalidade: '', metragem: '' } as OverviewData },
    { type: 'deliverables', order: 2, visible: true, data: { items: [{ id: '1', categoria: 'Exemplo', descricao: 'Descrição da entrega' }] } as DeliverablesData },
    { type: 'timeline',     order: 3, visible: true, data: { fases: [{ id: '1', nome: 'Fase 1', prazo: '10 dias', descricao: '' }, { id: '2', nome: 'Fase 2', prazo: '15 dias', descricao: '' }], totalDias: '25 dias úteis' } as TimelineData },
    { type: 'investment',   order: 4, visible: true, data: { valorTotal: 'R$ 0,00', parcelas: [{ id: '1', percentual: '40%', label: 'Entrada', valor: 'R$ 0,00' }], observacoes: '' } as InvestmentData },
    { type: 'closing',      order: 5, visible: true, data: { textoCTA: 'Ver proposta completa', textoFechamento: 'Agradecemos a confiança e estamos à disposição para esclarecer qualquer dúvida.', exibirContato: true } as ClosingData },
  ];
}

// ── Helpers ──
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

// ─── Toast ───────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type?: 'success' | 'error' | 'info'; onClose: () => void }> = ({ msg, type = 'success', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'success' ? '#059669' : type === 'error' ? '#dc2626' : '#2563eb';
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: bg, color: 'white',
      padding: '12px 24px', borderRadius: 12, fontWeight: 600,
      boxShadow: '0 8px 32px #0004', display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 14,
    }}>
      {type === 'success' ? <Check size={16} /> : type === 'error' ? <AlertCircle size={16} /> : <Link2 size={16} />}
      {msg}
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', marginLeft: 4 }}>
        <X size={14} />
      </button>
    </div>
  );
};

// ─── Formulários de slide por tipo ────────────────────────────────────────────
const CoverForm: React.FC<{ data: CoverData; onChange: (d: CoverData) => void }> = ({ data, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <FieldGroup label="Título do projeto *" hint="Exibido em destaque na capa">
      <input value={data.titulo} onChange={e => onChange({ ...data, titulo: e.target.value })}
        maxLength={80} className="form-input" placeholder="Ex: Câmara Frigorífica Industrial" />
      <span style={{ fontSize: 11, color: data.titulo.length > 70 ? '#ef4444' : '#9ca3af', textAlign: 'right', display: 'block', marginTop: 4 }}>
        {data.titulo.length}/80
      </span>
    </FieldGroup>
    <FieldGroup label="Subtítulo">
      <input value={data.subtitulo ?? ''} onChange={e => onChange({ ...data, subtitulo: e.target.value })}
        maxLength={120} className="form-input" placeholder="Ex: Proposta de Execução" />
      <span style={{ fontSize: 11, color: (data.subtitulo ?? '').length > 100 ? '#ef4444' : '#9ca3af', textAlign: 'right', display: 'block', marginTop: 4 }}>
        {(data.subtitulo ?? '').length}/120
      </span>
    </FieldGroup>
    <FieldGroup label="Nome do cliente *">
      <input value={data.clienteNome} onChange={e => onChange({ ...data, clienteNome: e.target.value })}
        className="form-input" placeholder="Ex: Indaia Pescados" />
    </FieldGroup>
    <FieldGroup label="Validade da proposta">
      <input value={data.dataValidade ?? ''} onChange={e => onChange({ ...data, dataValidade: e.target.value })}
        className="form-input" placeholder="Ex: 30/06/2026" />
    </FieldGroup>
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
      <input type="checkbox" checked={data.usarLogoMGR !== false}
        onChange={e => onChange({ ...data, usarLogoMGR: e.target.checked })}
        style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
      Exibir logo MGR na capa
    </label>
  </div>
);

const OverviewForm: React.FC<{ data: OverviewData; onChange: (d: OverviewData) => void }> = ({ data, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <FieldGroup label="Descrição do projeto" hint="Parágrafo livre — máx. 400 caracteres">
      <textarea value={data.descricao ?? ''} onChange={e => onChange({ ...data, descricao: e.target.value })}
        maxLength={400} rows={4} className="form-input" placeholder="Descreva o escopo e objetivos..." style={{ resize: 'vertical' }} />
    </FieldGroup>
    {[
      { key: 'localizacao', label: 'Localização', placeholder: 'Ex: Indaiatuba, SP' },
      { key: 'temperatura', label: 'Temperatura alvo', placeholder: 'Ex: 0°C ou -18°C' },
      { key: 'finalidade',  label: 'Finalidade',        placeholder: 'Ex: Armazenamento de insumos perecíveis' },
      { key: 'metragem',    label: 'Metragem / Dimensões', placeholder: 'Ex: 120 m²' },
    ].map(({ key, label, placeholder }) => (
      <FieldGroup key={key} label={label}>
        <input value={(data as any)[key] ?? ''} onChange={e => onChange({ ...data, [key]: e.target.value })}
          className="form-input" placeholder={placeholder} />
      </FieldGroup>
    ))}
  </div>
);

const DeliverablesForm: React.FC<{ data: DeliverablesData; onChange: (d: DeliverablesData) => void }> = ({ data, onChange }) => {
  const addItem = () => onChange({ items: [...data.items, { id: uid(), categoria: '', descricao: '' }] });
  const rmItem = (id: string) => onChange({ items: data.items.filter(i => i.id !== id) });
  const updateItem = (id: string, field: 'categoria' | 'descricao', val: string) =>
    onChange({ items: data.items.map(i => i.id === id ? { ...i, [field]: val } : i) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>Máximo 8 itens</p>
      {data.items.map((item, i) => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: 8, alignItems: 'center' }}>
          <input value={item.categoria} onChange={e => updateItem(item.id, 'categoria', e.target.value)}
            className="form-input" placeholder={`Categoria ${i + 1}`} />
          <input value={item.descricao} onChange={e => updateItem(item.id, 'descricao', e.target.value)}
            className="form-input" placeholder="Descrição" />
          <button onClick={() => rmItem(item.id)} style={rmBtnStyle}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {data.items.length < 8 && (
        <button onClick={addItem} style={addBtnStyle}><Plus size={14} /> Adicionar item</button>
      )}
    </div>
  );
};

const TimelineForm: React.FC<{ data: TimelineData; onChange: (d: TimelineData) => void }> = ({ data, onChange }) => {
  const addFase = () => onChange({ ...data, fases: [...data.fases, { id: uid(), nome: '', prazo: '', descricao: '' }] });
  const rmFase = (id: string) => onChange({ ...data, fases: data.fases.filter(f => f.id !== id) });
  const updateFase = (id: string, field: keyof TimelineFase, val: string) =>
    onChange({ ...data, fases: data.fases.map(f => f.id === id ? { ...f, [field]: val } : f) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <FieldGroup label="Total estimado">
        <input value={data.totalDias ?? ''} onChange={e => onChange({ ...data, totalDias: e.target.value })}
          className="form-input" placeholder="Ex: 30 dias úteis" />
      </FieldGroup>
      <p style={{ fontSize: 13, color: '#6b7280', margin: 0, fontWeight: 600 }}>Fases</p>
      {data.fases.map((fase, i) => (
        <div key={fase.id} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginBottom: 8 }}>
            <input value={fase.nome} onChange={e => updateFase(fase.id, 'nome', e.target.value)}
              className="form-input" placeholder={`Fase ${i + 1}`} />
            <input value={fase.prazo} onChange={e => updateFase(fase.id, 'prazo', e.target.value)}
              className="form-input" placeholder="Ex: 10 dias" />
            <button onClick={() => rmFase(fase.id)} style={rmBtnStyle}><Trash2 size={14} /></button>
          </div>
          <input value={fase.descricao ?? ''} onChange={e => updateFase(fase.id, 'descricao', e.target.value)}
            className="form-input" placeholder="Descrição curta (opcional)" style={{ width: '100%', boxSizing: 'border-box' }} />
        </div>
      ))}
      <button onClick={addFase} style={addBtnStyle}><Plus size={14} /> Adicionar fase</button>
    </div>
  );
};

const InvestmentForm: React.FC<{ data: InvestmentData; onChange: (d: InvestmentData) => void }> = ({ data, onChange }) => {
  const addBk = () => onChange({ ...data, breakdown: [...(data.breakdown ?? []), { id: uid(), label: '', valor: '' }] });
  const rmBk  = (id: string) => onChange({ ...data, breakdown: (data.breakdown ?? []).filter(b => b.id !== id) });
  const updBk = (id: string, field: 'label' | 'valor', val: string) =>
    onChange({ ...data, breakdown: (data.breakdown ?? []).map(b => b.id === id ? { ...b, [field]: val } : b) });
  const addPc = () => onChange({ ...data, parcelas: [...data.parcelas, { id: uid(), percentual: '', label: '', valor: '' }] });
  const rmPc  = (id: string) => onChange({ ...data, parcelas: data.parcelas.filter(p => p.id !== id) });
  const updPc = (id: string, field: keyof InvestmentParcela, val: string) =>
    onChange({ ...data, parcelas: data.parcelas.map(p => p.id === id ? { ...p, [field]: val } : p) });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FieldGroup label="Valor total *">
        <input value={data.valorTotal} onChange={e => onChange({ ...data, valorTotal: e.target.value })}
          className="form-input" placeholder="Ex: R$ 232.990,00" />
      </FieldGroup>

      {/* Parcelas */}
      <div>
        <p style={{ fontSize: 13, color: '#374151', fontWeight: 700, margin: '0 0 8px' }}>Parcelas *</p>
        {data.parcelas.map((p, i) => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr 1.5fr auto', gap: 8, marginBottom: 8 }}>
            <input value={p.percentual} onChange={e => updPc(p.id, 'percentual', e.target.value)}
              className="form-input" placeholder="40%" />
            <input value={p.label} onChange={e => updPc(p.id, 'label', e.target.value)}
              className="form-input" placeholder="Entrada" />
            <input value={p.valor} onChange={e => updPc(p.id, 'valor', e.target.value)}
              className="form-input" placeholder="R$ 93.196,00" />
            <button onClick={() => rmPc(p.id)} style={rmBtnStyle}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={addPc} style={addBtnStyle}><Plus size={14} /> Adicionar parcela</button>
      </div>

      {/* Breakdown */}
      <div>
        <p style={{ fontSize: 13, color: '#374151', fontWeight: 700, margin: '0 0 8px' }}>Composição (opcional)</p>
        {(data.breakdown ?? []).map(b => (
          <div key={b.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr auto', gap: 8, marginBottom: 8 }}>
            <input value={b.label} onChange={e => updBk(b.id, 'label', e.target.value)}
              className="form-input" placeholder="Ex: Estrutura metálica" />
            <input value={b.valor} onChange={e => updBk(b.id, 'valor', e.target.value)}
              className="form-input" placeholder="Ex: R$ 80.000,00" />
            <button onClick={() => rmBk(b.id)} style={rmBtnStyle}><Trash2 size={14} /></button>
          </div>
        ))}
        <button onClick={addBk} style={addBtnStyle}><Plus size={14} /> Adicionar item</button>
      </div>

      <FieldGroup label="Observações">
        <textarea value={data.observacoes ?? ''} onChange={e => onChange({ ...data, observacoes: e.target.value })}
          rows={2} className="form-input" placeholder="Ex: Valores sujeitos à variação cambial" style={{ resize: 'vertical' }} />
      </FieldGroup>
    </div>
  );
};

const ClosingForm: React.FC<{
  data: ClosingData;
  responsavel: string; responsavelEmail: string; responsavelTelefone: string;
  onChangeData: (d: ClosingData) => void;
  onChangeContact: (field: string, val: string) => void;
}> = ({ data, responsavel, responsavelEmail, responsavelTelefone, onChangeData, onChangeContact }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <FieldGroup label="Texto do botão CTA">
      <input value={data.textoCTA ?? ''} onChange={e => onChangeData({ ...data, textoCTA: e.target.value })}
        className="form-input" placeholder="Ver proposta completa" />
    </FieldGroup>
    <FieldGroup label="Texto de encerramento">
      <textarea value={data.textoFechamento ?? ''} onChange={e => onChangeData({ ...data, textoFechamento: e.target.value })}
        rows={3} className="form-input" style={{ resize: 'vertical' }}
        placeholder="Agradecemos a confiança e estamos à disposição..." />
    </FieldGroup>
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: '#374151' }}>
      <input type="checkbox" checked={data.exibirContato !== false}
        onChange={e => onChangeData({ ...data, exibirContato: e.target.checked })}
        style={{ width: 16, height: 16, accentColor: '#2563eb' }} />
      Exibir bloco de contato
    </label>
    {data.exibirContato !== false && (
      <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 12, color: '#0369a1', fontWeight: 700, margin: 0 }}>Dados de contato (herdados da apresentação)</p>
        <input value={responsavel} onChange={e => onChangeContact('responsavel', e.target.value)}
          className="form-input" placeholder="Nome do responsável" />
        <input value={responsavelEmail} onChange={e => onChangeContact('responsavelEmail', e.target.value)}
          className="form-input" placeholder="email@empresa.com" />
        <input value={responsavelTelefone} onChange={e => onChangeContact('responsavelTelefone', e.target.value)}
          className="form-input" placeholder="(11) 99999-9999" />
      </div>
    )}
  </div>
);

// ── Auxiliares de estilo ──
const rmBtnStyle: React.CSSProperties = {
  background: 'none', border: '1px solid #fca5a5', color: '#ef4444',
  borderRadius: 8, width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
};
const addBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#f0f9ff', border: '1px solid #bae6fd', color: '#2563eb',
  borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};

const FieldGroup: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>
      {label}
    </label>
    {hint && <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 6px' }}>{hint}</p>}
    {children}
  </div>
);

// ─── Editor de Slides ─────────────────────────────────────────────────────────
const SlideEditor: React.FC<{
  slide: SlideData;
  presentation: Partial<Presentation>;
  onChangeSlide: (updated: SlideData) => void;
  onChangePresentation: (field: string, val: any) => void;
}> = ({ slide, presentation, onChangeSlide, onChangePresentation }) => {
  const changeData = (d: any) => onChangeSlide({ ...slide, data: d } as SlideData);

  switch (slide.type) {
    case 'cover':
      return <CoverForm data={slide.data as CoverData} onChange={changeData} />;
    case 'overview':
      return <OverviewForm data={slide.data as OverviewData} onChange={changeData} />;
    case 'deliverables':
      return <DeliverablesForm data={slide.data as DeliverablesData} onChange={changeData} />;
    case 'timeline':
      return <TimelineForm data={slide.data as TimelineData} onChange={changeData} />;
    case 'investment':
      return <InvestmentForm data={slide.data as InvestmentData} onChange={changeData} />;
    case 'closing':
      return (
        <ClosingForm
          data={slide.data as ClosingData}
          responsavel={presentation.responsavel ?? ''}
          responsavelEmail={presentation.responsavelEmail ?? ''}
          responsavelTelefone={presentation.responsavelTelefone ?? ''}
          onChangeData={changeData}
          onChangeContact={(field, val) => onChangePresentation(field, val)}
        />
      );
    default:
      return null;
  }
};

// ─── Main: Apresentacoes ──────────────────────────────────────────────────────
const Apresentacoes: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [editing, setEditing]     = useState<Partial<Presentation> | null>(null);
  const [slides, setSlides]       = useState<SlideData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Auto-abrir editor se vier de ?orcamentoId= (integração com Orçamentos) ──
  useEffect(() => {
    const orcId = searchParams.get('orcamentoId');
    if (!orcId) return;
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, CollectionName.OS_ORCAMENTOS, orcId));
        if (!snap.exists()) return;
        const orc = snap.data() as any;
        const empty: Partial<Presentation> = {
          clienteNome: orc.clientName || '',
          projetoTitulo: orc.titulo || '',
          responsavel: '',
          responsavelEmail: '',
          responsavelTelefone: '',
          pdfUrl: orc.pdfUrl || null,
          pdfStoragePath: null,
          orcamentoId: orcId,
          status: 'rascunho',
          tema: 'dark-navy',
          slideAutoplay: true,
          slideDelayMs: 6000,
        };
        setEditing(empty);
        setSlides(defaultSlides(orc.clientName || ''));
        setSelectedIdx(0);
        setSaved(false);
      } catch { /* ignora erros de carregamento */ }
    };
    load();
  }, [searchParams]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, CollectionName.PRESENTATIONS), orderBy('createdAt', 'desc')),
      snap => { setPresentations(snap.docs.map(d => ({ id: d.id, ...d.data() } as Presentation))); setLoading(false); },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  const filtered = presentations.filter(p =>
    p.status !== 'arquivada' &&
    (p.projetoTitulo + p.clienteNome + p.slug).toLowerCase().includes(search.toLowerCase())
  );

  const archived = presentations.filter(p => p.status === 'arquivada');

  // ── Criar nova ──
  const handleNew = () => {
    const empty: Partial<Presentation> = {
      clienteNome: '', projetoTitulo: '',
      responsavel: '', responsavelEmail: '', responsavelTelefone: '',
      pdfUrl: null, pdfStoragePath: null,
      status: 'rascunho', tema: 'dark-navy',
      slideAutoplay: true, slideDelayMs: 6000,
    };
    setEditing(empty);
    setSlides(defaultSlides(''));
    setSelectedIdx(0);
    setSaved(false);
  };

  // ── Editar existente ──
  const handleEdit = (p: Presentation) => {
    setEditing({ ...p });
    const sorted = [...p.slides].sort((a, b) => a.order - b.order);
    setSlides(sorted);
    setSelectedIdx(0);
    setSaved(false);
  };

  // ── Salvar ──
  const handleSave = async () => {
    if (!currentUser || !editing) return;
    if (!editing.projetoTitulo?.trim() || !editing.clienteNome?.trim()) {
      setToast({ msg: 'Preencha título do projeto e nome do cliente.', type: 'error' }); return;
    }
    setSaving(true);
    try {
      const orderedSlides = slides.map((s, i) => ({ ...s, order: i }));
      if (editing.id) {
        // Update
        await updateDoc(doc(db, CollectionName.PRESENTATIONS, editing.id), {
          ...editing, slides: orderedSlides, updatedAt: serverTimestamp(),
        });
        setEditing(prev => ({ ...prev!, slides: orderedSlides }));
      } else {
        // Create — gera slug
        const slug = await generateSlug();
        const docRef = await addDoc(collection(db, CollectionName.PRESENTATIONS), {
          ...editing, slug, slides: orderedSlides,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          createdBy: currentUser.uid,
        });
        setEditing(prev => ({ ...prev!, id: docRef.id, slug }));
      }
      setSaved(true);
      setToast({ msg: 'Apresentação salva com sucesso!', type: 'success' });
    } catch {
      setToast({ msg: 'Erro ao salvar. Tente novamente.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── Upload PDF ──
  const handleUploadPDF = async (file: File) => {
    if (!editing) return;
    // Gap 3: validação de 20MB antes de qualquer request ao Storage
    if (file.size > 20 * 1024 * 1024) {
      setToast({ msg: 'O PDF deve ter no máximo 20 MB.', type: 'error' }); return;
    }
    const slug = editing.slug ?? `temp-${Date.now()}`;
    setUploading(true); setUploadPct(0);
    try {
      const fileRef2 = storageRef(storage, `presentations/${slug}/proposta.pdf`);
      const task = uploadBytesResumable(fileRef2, file, { contentType: 'application/pdf' });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            const path = `presentations/${slug}/proposta.pdf`;
            setEditing(prev => ({ ...prev!, pdfUrl: url, pdfStoragePath: path }));
            if (editing.id) {
              await updateDoc(doc(db, CollectionName.PRESENTATIONS, editing.id), { pdfUrl: url, pdfStoragePath: path });
            }
            resolve();
          }
        );
      });
      setToast({ msg: 'PDF enviado com sucesso!', type: 'success' });
    } catch {
      setToast({ msg: 'Erro ao enviar PDF.', type: 'error' });
    } finally {
      setUploading(false); setUploadPct(0);
    }
  };

  // ── Copiar link ──
  const handleCopyLink = async (p: Partial<Presentation>) => {
    const url = `https://mgrrefrigeracao.com.br/p/${p.slug}`;
    try { await navigator.clipboard.writeText(url); } catch { }
    setToast({ msg: 'Link copiado!', type: 'info' });
  };

  // ── Arquivar ──
  const handleArchive = async (p: Presentation) => {
    if (!confirm(`Arquivar "${p.projetoTitulo}"?`)) return;
    await updateDoc(doc(db, CollectionName.PRESENTATIONS, p.id), { status: 'arquivada' });
  };

  // ── Slide ops ──
  const updateSlide = (idx: number, updated: SlideData) =>
    setSlides(prev => prev.map((s, i) => i === idx ? updated : s));

  const addSlide = () => {
    const taken = new Set(slides.map(s => s.type));
    const next = SLIDE_TYPES.find(t => !taken.has(t.type));
    if (!next) { setToast({ msg: 'Todos os tipos de slide já foram adicionados.', type: 'info' }); return; }
    const ns: SlideData = { type: next.type, order: slides.length, visible: true, data: {} } as any;
    setSlides(prev => [...prev, ns]);
    setSelectedIdx(slides.length);
  };

  const removeSlide = () => {
    if (slides.length <= 1) return;
    setSlides(prev => {
      const next = prev.filter((_, i) => i !== selectedIdx);
      return next;
    });
    setSelectedIdx(Math.max(0, selectedIdx - 1));
  };

  const toggleVisible = (idx: number) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, visible: !s.visible } : s));
  };

  // ── Render: Editor ──
  if (editing !== null) {
    const publicUrl = editing.slug ? `https://mgrrefrigeracao.com.br/p/${editing.slug}` : null;
    const currentSlide = slides[selectedIdx];
    const type = currentSlide ? SLIDE_TYPES.find(t => t.type === currentSlide.type) : null;

    return (
      <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
        {/* ── Header do editor ── */}
        <div style={{
          background: 'white', borderBottom: '1px solid #e5e7eb',
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <button onClick={() => setEditing(null)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            border: '1px solid #e5e7eb', borderRadius: 8, background: 'white',
            cursor: 'pointer', fontSize: 13, color: '#374151',
          }}>
            <ChevronLeft size={14} /> Voltar
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={editing.projetoTitulo ?? ''}
              onChange={e => setEditing(prev => ({ ...prev!, projetoTitulo: e.target.value }))}
              placeholder="Título do projeto *"
              style={{
                border: 'none', outline: 'none', fontSize: 18, fontWeight: 800,
                color: '#111827', background: 'transparent', width: '100%',
              }}
            />
            <input
              value={editing.clienteNome ?? ''}
              onChange={e => setEditing(prev => ({ ...prev!, clienteNome: e.target.value }))}
              placeholder="Nome do cliente *"
              style={{
                border: 'none', outline: 'none', fontSize: 12, color: '#6b7280',
                background: 'transparent', width: '100%',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Tema */}
            <select
              value={editing.tema ?? 'dark-navy'}
              onChange={e => setEditing(prev => ({ ...prev!, tema: e.target.value as PresentationTema }))}
              style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}
            >
              {TEMAS_LIST.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            {/* Abrir (se salvo) */}
            {saved && editing.slug && (
              <button onClick={() => window.open(`/p/${editing.slug}`, '_blank')} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid #e5e7eb', borderRadius: 8,
                padding: '7px 14px', background: 'white', cursor: 'pointer', fontSize: 13,
              }}>
                <Play size={13} /> Visualizar
              </button>
            )}

            {/* Copiar link */}
            {saved && editing.slug && (
              <button onClick={() => handleCopyLink(editing)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid #bae6fd', borderRadius: 8, background: '#f0f9ff',
                padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: '#2563eb',
              }}>
                <Link2 size={13} /> Copiar link
              </button>
            )}

            {/* Salvar */}
            <button onClick={handleSave} disabled={saving} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: saving ? '#9ca3af' : '#2563eb', color: 'white',
              border: 'none', borderRadius: 8, padding: '8px 18px',
              cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 700,
            }}>
              {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>

        {/* ── Corpo: painel de slides + formulário ── */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Painel esquerdo — lista de slides */}
          <div style={{
            width: 220, flexShrink: 0, background: 'white',
            borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 14px 8px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 }}>
              Slides
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {slides.map((slide, i) => {
                const info = SLIDE_TYPES.find(t => t.type === slide.type);
                return (
                  <div key={i} onClick={() => setSelectedIdx(i)} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
                    background: i === selectedIdx ? '#eff6ff' : 'white',
                    borderLeft: i === selectedIdx ? '3px solid #2563eb' : '3px solid transparent',
                    transition: 'all 0.15s',
                  }}>
                    <span style={{ fontSize: 16 }}>{info?.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: i === selectedIdx ? 700 : 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {info?.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>Slide {i + 1}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); toggleVisible(i); }} title={slide.visible !== false ? 'Ocultar' : 'Exibir'} style={{
                      background: 'none', border: 'none', cursor: 'pointer', padding: 2,
                      opacity: slide.visible !== false ? 1 : 0.3, fontSize: 13,
                    }}>
                      👁️
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: 10, borderTop: '1px solid #f3f4f6', display: 'flex', gap: 6 }}>
              <button onClick={addSlide} title="Adicionar slide" style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '7px 0', background: '#f0f9ff', border: '1px solid #bae6fd',
                borderRadius: 8, cursor: 'pointer', fontSize: 12, color: '#2563eb', fontWeight: 600,
              }}>
                <Plus size={12} /> Adicionar
              </button>
              <button onClick={removeSlide} title="Remover slide selecionado" disabled={slides.length <= 1} style={{
                width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: '1px solid #fca5a5', borderRadius: 8,
                cursor: slides.length <= 1 ? 'not-allowed' : 'pointer', color: '#ef4444', opacity: slides.length <= 1 ? 0.4 : 1,
              }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Área central — formulário */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {currentSlide && (
              <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px', width: '100%', boxSizing: 'border-box' }}>
                {/* Cabeçalho do slide */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
                  <span style={{ fontSize: 24 }}>{type?.emoji}</span>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>
                      {type?.label}
                    </h2>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>Slide {selectedIdx + 1} de {slides.length}</span>
                  </div>
                </div>

                {/* Formulário contextual */}
                <SlideEditor
                  slide={currentSlide}
                  presentation={editing}
                  onChangeSlide={updated => updateSlide(selectedIdx, updated)}
                  onChangePresentation={(field, val) => setEditing(prev => ({ ...prev!, [field]: val }))}
                />
              </div>
            )}
          </div>

          {/* Painel direito — configurações gerais + PDF */}
          <div style={{
            width: 260, flexShrink: 0, background: 'white',
            borderLeft: '1px solid #e5e7eb', overflowY: 'auto', padding: 16,
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
                Configurações
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Gap 4: Toggle de status */}
                <FieldGroup label="Status">
                  <select
                    value={editing.status ?? 'rascunho'}
                    onChange={e => setEditing(prev => ({ ...prev!, status: e.target.value as PresentationStatus }))}
                    className="form-input"
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="rascunho">📝 Rascunho</option>
                    <option value="ativa">✅ Ativa (link público visível)</option>
                    <option value="arquivada">📦 Arquivada</option>
                  </select>
                </FieldGroup>
                <FieldGroup label="Responsável">
                  <input value={editing.responsavel ?? ''} onChange={e => setEditing(prev => ({ ...prev!, responsavel: e.target.value }))}
                    className="form-input" placeholder="Nome do responsável" />
                </FieldGroup>
                <FieldGroup label="Email">
                  <input value={editing.responsavelEmail ?? ''} onChange={e => setEditing(prev => ({ ...prev!, responsavelEmail: e.target.value }))}
                    className="form-input" placeholder="email@mgr.com.br" />
                </FieldGroup>
                <FieldGroup label="Telefone">
                  <input value={editing.responsavelTelefone ?? ''} onChange={e => setEditing(prev => ({ ...prev!, responsavelTelefone: e.target.value }))}
                    className="form-input" placeholder="(11) 99999-9999" />
                </FieldGroup>
                <FieldGroup label="Autoplay delay (ms)">
                  <input type="number" min={2000} max={20000} step={500}
                    value={editing.slideDelayMs ?? 6000}
                    onChange={e => setEditing(prev => ({ ...prev!, slideDelayMs: Number(e.target.value) }))}
                    className="form-input" />
                </FieldGroup>
              </div>
            </div>

            {/* PDF Upload */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
                PDF da Proposta
              </p>
              <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadPDF(f); }} />

              {editing.pdfUrl ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12 }}>
                  <p style={{ fontSize: 12, color: '#166534', fontWeight: 600, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={13} /> PDF vinculado
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <a href={editing.pdfUrl} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: 'white', border: '1px solid #d1d5db', borderRadius: 7,
                      padding: '5px 0', fontSize: 12, color: '#374151', textDecoration: 'none',
                    }}>
                      <Eye size={11} /> Ver
                    </a>
                    <button onClick={() => fileRef.current?.click()} style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                      background: 'white', border: '1px solid #d1d5db', borderRadius: 7,
                      padding: '5px 0', fontSize: 12, cursor: 'pointer', color: '#374151',
                    }}>
                      <Upload size={11} /> Substituir
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{
                  width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                  border: '2px dashed #93c5fd', borderRadius: 10, padding: '20px 0',
                  background: '#f0f9ff', cursor: uploading ? 'not-allowed' : 'pointer',
                }}>
                  {uploading
                    ? <><Loader2 size={20} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} /><span style={{ color: '#2563eb', fontSize: 12 }}>{uploadPct}%</span></>
                    : <><Upload size={20} color="#3b82f6" /><span style={{ color: '#2563eb', fontSize: 12, fontWeight: 600 }}>Selecionar PDF</span><span style={{ color: '#93c5fd', fontSize: 11 }}>máx. 20 MB</span></>
                  }
                </button>
              )}

              {uploading && (
                <div style={{ marginTop: 8, height: 4, background: '#dbeafe', borderRadius: 2 }}>
                  <div style={{ height: '100%', background: '#2563eb', borderRadius: 2, width: `${uploadPct}%`, transition: 'width 0.3s' }} />
                </div>
              )}
            </div>

            {/* Link público */}
            {saved && editing.slug && (
              <div>
                <p style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
                  Link Público
                </p>
                <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 10 }}>
                  <code style={{ fontSize: 11, color: '#2563eb', display: 'block', wordBreak: 'break-all', lineHeight: 1.5 }}>
                    mgrrefrigeracao.com.br/p/{editing.slug}
                  </code>
                  <button onClick={() => handleCopyLink(editing)} style={{
                    marginTop: 8, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    background: '#2563eb', color: 'white', border: 'none',
                    borderRadius: 7, padding: '7px 0', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  }}>
                    <Copy size={11} /> Copiar link
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Estilos globais do editor */}
        <style>{`
          .form-input {
            width: 100%; padding: 8px 12px; border: 1px solid #e5e7eb;
            border-radius: 8px; font-size: 14px; outline: none;
            background: white; color: #111827; box-sizing: border-box;
            transition: border-color .15s;
          }
          .form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px #dbeafe; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      </div>
    );
  }

  // ─── Lista de apresentações ──────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg">
            <Play size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Apresentações</h1>
            <p className="text-sm text-gray-500">Apresentações interativas para clientes com link exclusivo</p>
          </div>
        </div>
        <button onClick={handleNew}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-bold text-sm shadow-md transition-all">
          <Plus size={16} /> Nova Apresentação
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar por projeto ou cliente..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white outline-none" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <Play size={28} className="text-indigo-300" />
          </div>
          <p className="text-gray-500 font-medium">Nenhuma apresentação criada</p>
          <p className="text-gray-400 text-sm mt-1">Clique em "Nova Apresentação" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(p => {
            const tema = { 'dark-navy': '#3b82f6', 'dark-slate': '#22d3ee', 'dark-teal': '#10b981' }[p.tema ?? 'dark-navy'];
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="flex items-stretch">
                  {/* Tema indicator */}
                  <div style={{ width: 4, background: tema, flexShrink: 0 }} />
                  <div className="flex-1 p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900 text-base truncate">{p.projetoTitulo}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            p.status === 'ativa'    ? 'bg-green-100 text-green-700 border-green-200' :
                            p.status === 'rascunho' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                                                      'bg-amber-100 text-amber-700 border-amber-200'
                          }`}>
                            {p.status === 'ativa' ? 'Ativa' : p.status === 'rascunho' ? 'Rascunho' : 'Arquivada'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500">{p.clienteNome}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <code className="text-xs text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md font-mono">
                            /p/{p.slug}
                          </code>
                          {p.slides?.length > 0 && (
                            <span className="text-xs text-gray-400">· {p.slides.filter(s => s.visible !== false).length} slides</span>
                          )}
                          {p.pdfUrl && (
                            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">+ PDF</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <button onClick={() => handleEdit(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors">
                        <Settings size={12} /> Editar
                      </button>
                      <a href={`/p/${p.slug}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors">
                        <Eye size={12} /> Visualizar
                      </a>
                      <button onClick={() => handleCopyLink(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors">
                        <Copy size={12} /> Copiar link
                      </button>
                      {!p.pdfUrl && (
                        <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                          ⚠️ Sem PDF
                        </span>
                      )}
                      <button onClick={() => handleArchive(p)}
                        className="ml-auto text-gray-300 hover:text-red-400 transition-colors p-1.5 rounded-lg"
                        title="Arquivar">
                        <Archive size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Arquivadas */}
      {archived.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 font-medium py-2">
            Arquivadas ({archived.length})
          </summary>
          <div className="mt-2 space-y-2 opacity-60">
            {archived.map(p => (
              <div key={p.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                <Play size={14} className="text-gray-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-600 font-medium truncate">{p.projetoTitulo}</p>
                  <p className="text-xs text-gray-400">{p.clienteNome} · /p/{p.slug}</p>
                </div>
                <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">Arquivada</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Apresentacoes;

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, LandingPageContent, Partner, GalleryItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import {
  ArrowLeft, Save, Loader2, Monitor, Globe, Image as ImageIcon, Settings,
  MessageSquare, Plus, Trash2, BarChart2, Users, LayoutDashboard, X, Edit, UploadCloud,
  Camera, GripVertical, Calendar, FileText, CheckCircle2,
  AlertTriangle, Wifi, Activity, Zap, Building2, Download, Quote
} from 'lucide-react';

/* ── ImageUploadField ─ MUST live at module scope (Rules of Hooks) ── */
interface ImageUploadFieldProps {
  label: string;
  currentUrl: string;
  isUploading: boolean;
  onFileChange: (file: File) => void;
  onRemove: () => void;
  previewHeight?: number;
}
const ImageUploadField: React.FC<ImageUploadFieldProps> = ({
  label, currentUrl, isUploading, onFileChange, onRemove, previewHeight = 140
}) => (
  <div>
    <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#374151', marginBottom:4 }}>{label}</label>
    <div style={{ border:'2px dashed #D1D5DB', borderRadius:12, overflow:'hidden', position:'relative', background:'#fff', cursor:'pointer', transition:'.2s' }}
      onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.borderColor='#1B5E8A'}
      onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.borderColor='#D1D5DB'}>
      <input
        type="file" accept="image/*"
        style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:0, cursor:'pointer', zIndex:10 }}
        onChange={e => { if (e.target.files?.[0]) onFileChange(e.target.files[0]); }}
      />
      {isUploading ? (
        <div style={{ height: previewHeight, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, color:'#6B7280' }}>
          <Loader2 style={{ width:32, height:32, color:'#1B5E8A', animation:'spin 1s linear infinite' }} />
          <span style={{ fontSize:13 }}>Enviando...</span>
        </div>
      ) : currentUrl ? (
        <div style={{ position:'relative' }} className="group">
          <img src={currentUrl} alt={label} style={{ height: previewHeight, width:'100%', objectFit:'cover', display:'block' }} />
          <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'.2s' }}
            onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.opacity='1'}
            onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.opacity='0'}>
            <span style={{ color:'#fff', fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:8 }}><UploadCloud size={16}/> Substituir imagem</span>
          </div>
        </div>
      ) : (
        <div style={{ height: previewHeight, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, color:'#9CA3AF' }}>
          <UploadCloud style={{ width:40, height:40, color:'#D1D5DB' }} />
          <span style={{ fontSize:13, fontWeight:600, color:'#6B7280' }}>Clique para fazer upload</span>
          <span style={{ fontSize:11, color:'#9CA3AF' }}>JPG, PNG, WebP — comprimido automaticamente</span>
        </div>
      )}
    </div>
    {currentUrl && (
      <button onClick={onRemove}
        style={{ marginTop:4, fontSize:11, color:'#EF4444', background:'none', border:'none', cursor:'pointer', display:'flex', alignItems:'center', gap:4, padding:0 }}>
        <Trash2 size={11}/> Remover imagem
      </button>
    )}
  </div>
);

/* ── TAB → SECTION ID MAP (module-level, safe for useEffect deps) ── */
const TAB_SECTION_MAP: Record<string, string> = {
  hero:        'mgr-sec-hero',
  stats:       'mgr-sec-testimonial',   // content.stats = animated counters in prova social
  painPoints:  'mgr-sec-pain',
  clients:     'mgr-sec-clients',
  plan:        'mgr-sec-plan',
  stakes:      'mgr-sec-stakes',
  mgrConnect:  'mgr-sec-connect',
  leadMagnet:  'mgr-sec-leadmagnet',
  segments:    'mgr-sec-setores',
  testimonial: 'mgr-sec-testimonial',
  gallery:     'mgr-sec-gallery',
  about:       'mgr-sec-about',
  contact:     'mgr-sec-contact',
  features:    'mgr-sec-hero',
};

/* ── Factory defaults for "Restaurar Padrões" ── */
const MGR_EDITOR_DEFAULT: LandingPageContent = {
  hero: { title: 'Sua operação nunca para.', subtitle: 'Mais de 20 anos mantendo a continuidade operacional de plantas industriais que não podem parar. Manutenção inteligente, gestão do Ciclo de Vida MGR e resposta imediata.', backgroundImageUrl: '', ctaText: 'Agendar Visita de Valor', ctaLink: '#contato' },
  stats: [
    { value: '+20', label: 'Anos de Expertise' },
    { value: '+300', label: 'Projetos Entregues' },
    { value: '+50', label: 'Contratos Ativos' },
    { value: '24/7', label: 'Suporte Emergencial' },
  ],
  services: { title: 'O Ciclo de Vida MGR', items: [
    { title: 'Visita de Valor', description: 'Diagnóstico completo com Relatório de Saúde antes de qualquer decisão de investimento.', icon: 'Eye' },
    { title: 'Manutenção Preditiva', description: 'Antecipamos falhas com inteligência técnica de campo e análise de vibração e óleo.', icon: 'Activity' },
    { title: 'Resposta 24/7', description: 'Especialistas de Campo com SLA de resposta garantido e frota própria disponível.', icon: 'Zap' },
    { title: 'MGR Connect', description: 'Monitoramento remoto e gestão digital dos seus ativos de refrigeração em tempo real.', icon: 'Wifi' },
    { title: 'Gestão do Ciclo de Vida', description: 'Planejamento estratégico para máxima vida útil e menor custo total de operação.', icon: 'BarChart3' },
  ]},
  clients: { title: 'Parceiros de Operação', description: 'Indústrias que confiam na MGR para nunca parar.', partners: [
    { id:'1', name:'Halipar', logoUrl:'' }, { id:'2', name:'Sorvetão', logoUrl:'' },
    { id:'3', name:'Dellys', logoUrl:'' }, { id:'4', name:'Indaíá Pescados', logoUrl:'' },
  ]},
  gallery: { title: 'Projetos em Campo', description: 'Cada projeto é uma operação que nunca mais vai parar.', items: [] },
  about: { title: 'Engenharia que Garante Continuidade', description: 'A MGR nasceu com uma premissa: fazer refrigeração do jeito certo, do começo ao fim.', imageUrl: '', manifesto: 'Não somos apenas técnicos que consertam equipamentos. Somos parceiros de operação.', differentials: ['Equipe técnica certificada e frota própria', 'Atendimento ágil em Indaiatuba e região', 'Gestão digital de manutenção via MGR Connect', 'SLA contratual com penalidades — compromisso real'] },
  contact: { address: 'Indaiatuba - SP e Região', phone: '(19) 3333-3333', email: 'contato@mgrrefrigeracao.com.br', whatsapp: '5519999999999', instagram: '@mgrrefrigeracao' },
  features: { whatsappFloat: true, contactForm: true },
  painPoints: { headline: 'Você sabe o que uma parada não planejada custa à sua operação?', items: [
    { icon: 'PackageX', stat: 'R$ 200 mil', description: 'Uma falha de 4 horas em câmara fria pode destruir um lote inteiro de produto armazenado.' },
    { icon: 'TrendingDown', stat: '3x mais caro', description: 'Manutenção reativa custa até 3 vezes mais do que a gestão inteligente do ciclo de vida.' },
    { icon: 'AlertTriangle', stat: '68% das falhas', description: 'Acontecem nos piores momentos. Sem monitoramento, o risco é permanente e silencioso.' },
  ]},
  plan: { headline: 'Como a MGR protege sua operação', steps: [
    { number: 1, title: 'Visita de Valor', description: 'Nosso Especialista de Campo faz um diagnóstico completo e entrega o Relatório de Saúde da sua instalação — sem compromisso.' },
    { number: 2, title: 'Plano sob medida', description: 'Com base no diagnóstico, desenhamos a estratégia de continuidade operacional ideal para a sua realidade e orçamento.' },
    { number: 3, title: 'Parceiro de Operação', description: 'Atuamos como extensão da sua equipe. Monitoramento, manutenção e resposta imediata — sua operação nunca para.' },
  ], ctaText: 'Comece pela Visita de Valor' },
  stakes: { headline: 'O que está em jogo quando a refrigeração falha', items: [
    { icon: 'PackageX', title: 'Perda de produto e receita', description: 'Lotes inteiros comprometidos por variação térmica em câmaras e túneis sem monitoramento.' },
    { icon: 'Gavel', title: 'Multas e não-conformidade', description: 'Auditorias da vigilância sanitária e ANVISA. Uma falha de temperatura pode comprometer a licença de operação.' },
    { icon: 'Users', title: 'Reputação e contratos', description: 'Um único incidente pode custar um cliente-chave. A confiança leva anos para construir e horas para perder.' },
  ], transition: 'A diferença entre risco e tranquilidade é ter um Parceiro de Operação com 20 anos de campo.' },
  mgrConnect: { headline: 'MGR Connect: seus ativos monitorados em tempo real', description: 'Tecnologia própria desenvolvida para a realidade da refrigeração industrial brasileira.', features: ['Alertas preditivos antes da falha acontecer','Relatório de Saúde digital acessível 24/7','Histórico completo do ciclo de vida de cada ativo','Integração com equipe de campo para resposta imediata','QR Code nos equipamentos para abertura instantânea de chamados'], ctaText: 'Conheça o MGR Connect', imageUrl: '' },
  leadMagnet: { headline: '7 Sinais de que Seu Sistema de Refrigeração Precisa de Atenção Imediata', ctaText: 'Baixar o Guia Gratuito', description: 'Material técnico desenvolvido pelos nossos Especialistas de Campo.' },
  segments: { headline: 'Soluções para a sua operação', items: [
    { title: 'Indústria Alimentícia', description: 'Câmaras frias, túneis de congelamento e girofreezers com controle rigoroso de temperatura.', icon: 'Factory', imageUrl: '' },
    { title: 'Farmacêutica e Hospitalar', description: 'Controle térmico de precisão e conformidade com normas regulatórias ANVISA e ABNT.', icon: 'Pill', imageUrl: '' },
    { title: 'Logística e Cold Storage', description: 'Continuidade da cadeia de frio do armazém à distribuição. Zero ruptura de temperatura.', icon: 'Truck', imageUrl: '' },
    { title: 'Indústria Geral', description: 'Processos térmicos industriais, chillers, torres de resfriamento e HVAC industrial.', icon: 'Building2', imageUrl: '' },
  ]},
  testimonial: { quote: 'Desde que a MGR assumiu a gestão do nosso sistema, não tivemos uma única parada não planejada. O Relatório de Saúde mensal nos dá tranquilidade para focar no negócio.', name: 'Gestor de Manutenção', role: 'Gerente de Manutenção Industrial', company: 'Indústria Alimentícia — Indaiatuba/SP', photoUrl: '' },
};

const LandingPageEditor: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [content, setContent] = useState<LandingPageContent | null>(null);
  type TabId = 'hero' | 'stats' | 'clients' | 'gallery' | 'about' | 'contact' | 'features'
    | 'painPoints' | 'plan' | 'stakes' | 'mgrConnect' | 'leadMagnet' | 'segments' | 'testimonial';
  const [activeTab, setActiveTab] = useState<TabId>('hero');

  // Stats input state
  const [newStatValue, setNewStatValue] = useState('');
  const [newStatLabel, setNewStatLabel] = useState('');

  // Partner (Client) State
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerLogoFile, setPartnerLogoFile] = useState<File | null>(null);
  const [partnerLogoPreview, setPartnerLogoPreview] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  // Gallery Modal State
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [editingGalleryItem, setEditingGalleryItem] = useState<GalleryItem | null>(null);
  const [galleryTitle, setGalleryTitle] = useState('');
  const [galleryCaption, setGalleryCaption] = useState('');
  const [galleryDate, setGalleryDate] = useState('');
  const [galleryFile, setGalleryFile] = useState<File | null>(null);
  const [galleryPreview, setGalleryPreview] = useState<string>('');
  const [isGalleryUploading, setIsGalleryUploading] = useState(false);

  // About Differentials
  const [newDifferential, setNewDifferential] = useState('');

  // Security Redirect
  useEffect(() => {
    if (!loading && userProfile?.role !== 'developer' && userProfile?.role !== 'admin') {
      navigate('/app');
    }
  }, [userProfile, loading, navigate]);

  // Load Content
  useEffect(() => {
    if (!userProfile || (userProfile.role !== 'developer' && userProfile.role !== 'admin')) {
      return;
    }

    const fetchContent = async () => {
      try {
        const docRef = doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as any;

          // Migration Logic for Editor
          let partners = data.clients?.partners || [];
          if (data.clients?.logos && Array.isArray(data.clients.logos) && partners.length === 0) {
            partners = data.clients.logos.map((name: string, index: number) => ({
              id: `legacy-${index}`,
              name: name,
              logoUrl: ''
            }));
          }

          const normalizedData: LandingPageContent = {
            ...data,
            clients: {
              ...data.clients,
              partners: partners
            },
            gallery: {
              title: data.gallery?.title || 'Projetos em Campo',
              description: data.gallery?.description || '',
              items: data.gallery?.items || [],
            },
            about: {
              ...data.about,
              manifesto: data.about?.manifesto || '',
              differentials: data.about?.differentials || [],
            }
          };
          setContent(normalizedData);
        } else {
          alert("Nenhum conteúdo encontrado. Visite a página inicial primeiro para gerar os dados padrão.");
          navigate('/');
        }
      } catch (err: any) {
        if (err?.code !== 'permission-denied') {
          console.error("Error loading CMS content", err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [userProfile, navigate]);

  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<'idle'|'applying'|'done'>('idle');

  // ⚠️ Must be before early returns — Rules of Hooks
  useEffect(() => {
    const sectionId = TAB_SECTION_MAP[activeTab] ?? 'mgr-sec-hero';
    const timeout = setTimeout(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          { type: 'mgr-editor-highlight', sectionId },
          '*'
        );
      }
    }, 600);
    return () => clearTimeout(timeout);
  }, [activeTab, previewKey]);

  // Aplicar Edições: salva no Firestore + atualiza preview sem mostrar modal de confirmação
  const handleApply = async () => {
    if (!content) return;
    setApplyFeedback('applying');
    try {
      await setDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page'), content, { merge: true });
      setHasUnsavedChanges(false);
      setPreviewKey(k => k + 1);
      setApplyFeedback('done');
      setTimeout(() => setApplyFeedback('idle'), 2500);
    } catch (error) {
      console.error('Error applying content:', error);
      alert('Erro ao aplicar edições.');
      setApplyFeedback('idle');
    }
  };

  // Salvar Site: salva no Firestore + atualiza preview + exibe confirmação de publicação
  const handleSave = async () => {
    if (!content) return;
    setSaving(true);
    try {
      await setDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page'), content, { merge: true });
      setSavedAt(new Date());
      setHasUnsavedChanges(false);
      setPreviewKey(k => k + 1);
    } catch (error) {
      console.error('Error saving content:', error);
      alert('Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Isso vai RESTAURAR todo o conteúdo do site para os padrões de fábrica MGR. Continuar?')) return;
    setSaving(true);
    try {
      await setDoc(doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page'), MGR_EDITOR_DEFAULT);
      setContent(MGR_EDITOR_DEFAULT);
      setSavedAt(new Date());
      setHasUnsavedChanges(false);
      setPreviewKey(k => k + 1);
      alert('✅ Conteúdo restaurado para os padrões MGR!');
    } catch (error) {
      console.error('Error resetting:', error);
      alert('Erro ao restaurar.');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (section: keyof LandingPageContent, field: string, value: any) => {
    if (!content) return;
    setHasUnsavedChanges(true);
    setContent({
      ...content,
      [section]: {
        ...content[section],
        [field]: value
      }
    });
  };

  // ── Stats Handlers ──
  const addStat = () => {
    if (!content || !newStatValue || !newStatLabel) return;
    const currentStats = content.stats || [];
    setHasUnsavedChanges(true);
    setContent({
      ...content,
      stats: [...currentStats, { value: newStatValue, label: newStatLabel }]
    });
    setNewStatValue('');
    setNewStatLabel('');
  };

  const removeStat = (index: number) => {
    if (!content) return;
    const newStats = [...(content.stats || [])];
    newStats.splice(index, 1);
    setHasUnsavedChanges(true);
    setContent({ ...content, stats: newStats });
  };

  // ── Partner (Client) Logic ──
  const openPartnerModal = (partner?: Partner) => {
    if (partner) {
      setEditingPartner(partner);
      setPartnerName(partner.name);
      setPartnerLogoPreview(partner.logoUrl);
    } else {
      setEditingPartner(null);
      setPartnerName('');
      setPartnerLogoPreview('');
    }
    setPartnerLogoFile(null);
    setIsPartnerModalOpen(true);
  };

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPartnerLogoFile(file);
      setPartnerLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSavePartner = async () => {
    if (!content || !partnerName.trim()) return;
    setIsUploading(true);
    try {
      let logoUrl = editingPartner?.logoUrl || '';
      if (partnerLogoFile) {
        const compressedFile = await compressImage(partnerLogoFile, 400, 0.8);
        const storageRef = ref(storage, `landing/partners/${Date.now()}_${compressedFile.name}`);
        await uploadBytes(storageRef, compressedFile);
        logoUrl = await getDownloadURL(storageRef);
      }
      const newPartner: Partner = {
        id: editingPartner?.id || Math.random().toString(36).substr(2, 9),
        name: partnerName.trim(),
        logoUrl: logoUrl
      };
      const currentPartners = content.clients?.partners || [];
      let updatedPartners;
      if (editingPartner) {
        updatedPartners = currentPartners.map(p => p.id === editingPartner.id ? newPartner : p);
      } else {
        updatedPartners = [...currentPartners, newPartner];
      }
      setContent({
        ...content,
        clients: { ...content.clients, partners: updatedPartners }
      });
      setIsPartnerModalOpen(false);
    } catch (error) {
      console.error("Error saving partner:", error);
      alert("Erro ao salvar parceiro.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePartner = (id: string) => {
    if (!content || !window.confirm("Remover este parceiro?")) return;
    const updatedPartners = (content.clients?.partners || []).filter(p => p.id !== id);
    setContent({
      ...content,
      clients: { ...content.clients, partners: updatedPartners }
    });
  };

  // ── Gallery Logic ──
  const openGalleryModal = (item?: GalleryItem) => {
    if (item) {
      setEditingGalleryItem(item);
      setGalleryTitle(item.title);
      setGalleryCaption(item.caption);
      setGalleryDate(item.date);
      setGalleryPreview(item.imageUrl);
    } else {
      setEditingGalleryItem(null);
      setGalleryTitle('');
      setGalleryCaption('');
      setGalleryDate('');
      setGalleryPreview('');
    }
    setGalleryFile(null);
    setIsGalleryModalOpen(true);
  };

  const handleGalleryFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setGalleryFile(file);
      setGalleryPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveGalleryItem = async () => {
    if (!content || !galleryTitle.trim()) return;
    if (!editingGalleryItem && !galleryFile) {
      alert("Selecione uma imagem para o projeto.");
      return;
    }
    setIsGalleryUploading(true);
    try {
      let imageUrl = editingGalleryItem?.imageUrl || '';
      if (galleryFile) {
        const compressedFile = await compressImage(galleryFile, 1200, 0.85);
        const storageRef = ref(storage, `landing/gallery/${Date.now()}_${compressedFile.name}`);
        await uploadBytes(storageRef, compressedFile);
        imageUrl = await getDownloadURL(storageRef);
      }
      const currentItems = content.gallery?.items || [];
      const newItem: GalleryItem = {
        id: editingGalleryItem?.id || Math.random().toString(36).substr(2, 9),
        imageUrl,
        title: galleryTitle.trim(),
        caption: galleryCaption.trim(),
        date: galleryDate.trim(),
        order: editingGalleryItem?.order || currentItems.length + 1,
      };
      let updatedItems;
      if (editingGalleryItem) {
        updatedItems = currentItems.map(i => i.id === editingGalleryItem.id ? newItem : i);
      } else {
        updatedItems = [...currentItems, newItem];
      }
      setContent({
        ...content,
        gallery: { ...content.gallery, items: updatedItems }
      });
      setIsGalleryModalOpen(false);
    } catch (error) {
      console.error("Error saving gallery item:", error);
      alert("Erro ao salvar projeto.");
    } finally {
      setIsGalleryUploading(false);
    }
  };

  const handleDeleteGalleryItem = (id: string) => {
    if (!content || !window.confirm("Remover este projeto da galeria?")) return;
    const updatedItems = (content.gallery?.items || []).filter(i => i.id !== id);
    setContent({
      ...content,
      gallery: { ...content.gallery, items: updatedItems }
    });
  };

  // ── About Differentials ──
  const addDifferential = () => {
    if (!content || !newDifferential.trim()) return;
    const current = content.about?.differentials || [];
    setContent({
      ...content,
      about: { ...content.about, differentials: [...current, newDifferential.trim()] }
    });
    setNewDifferential('');
  };

  const removeDifferential = (index: number) => {
    if (!content) return;
    const updated = [...(content.about?.differentials || [])];
    updated.splice(index, 1);
    setContent({
      ...content,
      about: { ...content.about, differentials: updated }
    });
  };

  // ── Generic section image upload ──
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const uploadSectionImage = async (
    file: File,
    storagePath: string,
    onSuccess: (url: string) => void
  ) => {
    setUploadingKey(storagePath);
    try {
      const compressed = await compressImage(file, 1600, 0.88);
      const storageRef = ref(storage, `landing/${storagePath}/${Date.now()}_${compressed.name}`);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      onSuccess(url);
    } catch (err) {
      console.error('Upload error', err);
      alert('Erro ao fazer upload da imagem.');
    } finally {
      setUploadingKey(null);
    }
  };

  // (ImageUploadField moved to module scope — see top of file)
  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-brand-500 w-8 h-8" /></div>;
  if (!content) return <div>Erro ao carregar editor.</div>;

  const tabs = [
    { id: 'hero' as const, label: 'Hero', icon: <Monitor size={15} />, sectionId: 'mgr-sec-hero' },
    { id: 'stats' as const, label: 'Estatísticas', icon: <BarChart2 size={15} />, sectionId: 'mgr-sec-stats' },
    { id: 'painPoints' as const, label: 'Problema', icon: <AlertTriangle size={15} />, sectionId: 'mgr-sec-pain' },
    { id: 'clients' as const, label: 'Parceiros', icon: <Users size={15} />, sectionId: 'mgr-sec-clients' },
    { id: 'plan' as const, label: 'Plano 3 Passos', icon: <CheckCircle2 size={15} />, sectionId: 'mgr-sec-plan' },
    { id: 'stakes' as const, label: 'Stakes', icon: <Activity size={15} />, sectionId: 'mgr-sec-stakes' },
    { id: 'mgrConnect' as const, label: 'MGR Connect', icon: <Wifi size={15} />, sectionId: 'mgr-sec-connect' },
    { id: 'leadMagnet' as const, label: 'Lead Magnet', icon: <Download size={15} />, sectionId: 'mgr-sec-leadmagnet' },
    { id: 'segments' as const, label: 'Setores', icon: <Building2 size={15} />, sectionId: 'mgr-sec-setores' },
    { id: 'testimonial' as const, label: 'Depoimento', icon: <Quote size={15} />, sectionId: 'mgr-sec-testimonial' },
    { id: 'gallery' as const, label: 'Galeria', icon: <Camera size={15} />, sectionId: 'mgr-sec-gallery' },
    { id: 'about' as const, label: 'Sobre', icon: <FileText size={15} />, sectionId: 'mgr-sec-about' },
    { id: 'contact' as const, label: 'Contato', icon: <MessageSquare size={15} />, sectionId: 'mgr-sec-contact' },
    { id: 'features' as const, label: 'Config', icon: <Settings size={15} />, sectionId: 'mgr-sec-hero' },
  ];

  const activeTabSectionId = TAB_SECTION_MAP[activeTab] ?? 'mgr-sec-hero';
  const previewSrc = `${window.location.origin}/`;

  return (
    <React.Fragment>
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', background:'#F1F5F9' }}>

      {/* ─── TOP BAR ─── */}
      <div style={{ background:'#0F172A', borderBottom:'1px solid rgba(255,255,255,.08)', padding:'0 20px', height:56, display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0, zIndex:60 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => navigate('/app')} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.8)', fontSize:13, fontWeight:600, cursor:'pointer', transition:'.2s' }}>
            <ArrowLeft size={14}/> Voltar
          </button>
          <div style={{ width:1, height:24, background:'rgba(255,255,255,.1)' }}/>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#1B5E8A,#2272a8)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Monitor size={15} color="#fff"/>
            </div>
            <div>
              <span style={{ display:'block', fontWeight:700, fontSize:14, color:'#fff', lineHeight:1.2 }}>Editor do Site</span>
              <span style={{ fontSize:10, color:'rgba(255,255,255,.4)', letterSpacing:'.5px' }}>MGR Refrigeração v3.0</span>
            </div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {savedAt && !saving && (
            <span style={{ fontSize:12, color:'#4ADE80', display:'flex', alignItems:'center', gap:6 }}>
              <CheckCircle2 size={13}/> Publicado às {savedAt.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}
            </span>
          )}
          <button onClick={() => window.open('/', '_blank')} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.1)', color:'rgba(255,255,255,.7)', fontSize:13, cursor:'pointer' }}>
            <Globe size={14}/> Ver Site
          </button>
          <button onClick={handleReset} disabled={saving} title="Restaurar todos os campos para os valores padrão MGR" style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', color:'#FCA5A5', fontSize:12, fontWeight:600, cursor:'pointer' }}>
            ↺ Restaurar Padrões
          </button>
          <button
            id="btn-salvar-site"
            onClick={handleSave}
            disabled={saving}
            title="Salva definitivamente e publica no site real"
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', borderRadius:8, background: saving ? '#60748A' : '#1B5E8A', border:'2px solid rgba(255,255,255,.15)', color:'#fff', fontSize:13, fontWeight:700, cursor:'pointer', opacity: saving ? .7 : 1, transition:'.2s' }}
          >
            {saving ? <Loader2 className="animate-spin w-4 h-4"/> : <Save size={15}/>}
            {saving ? 'Publicando...' : 'Salvar Site'}
          </button>
        </div>
      </div>

      {/* ─── SPLIT BODY ─── */}
      <div style={{ display:'flex', flex:'1 1 0', overflow:'hidden', minHeight:0 }}>

        {/* ── LEFT PANEL: Section Nav + Form Fields ── */}
        <div style={{ width:420, flexShrink:0, display:'flex', flexDirection:'column', borderRight:'1px solid #E2E8F0', background:'#fff', minHeight:0, overflow:'clip' }}>

          {/* Section Navigator */}
          <div style={{ borderBottom:'1px solid #E2E8F0', padding:'12px', background:'#F8FAFC', flexShrink:0 }}>
            <p style={{ fontSize:10, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'.8px', marginBottom:8, paddingLeft:4 }}>Seções</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display:'flex', alignItems:'center', gap:6,
                    padding:'6px 10px', borderRadius:8, fontSize:12, fontWeight:600,
                    border: activeTab === tab.id ? '1.5px solid #1B5E8A' : '1.5px solid transparent',
                    background: activeTab === tab.id ? '#EFF6FF' : 'transparent',
                    color: activeTab === tab.id ? '#1B5E8A' : '#64748B',
                    cursor:'pointer', transition:'.15s', whiteSpace:'nowrap'
                  }}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form content — scrollable */}
          <div style={{ flex:'1 1 0px', overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:20, minHeight:0, scrollbarWidth:'thin', scrollbarColor:'#CBD5E1 transparent' }}>

        {/* ── HERO SECTION ── */}
        {activeTab === 'hero' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Monitor size={18} /> Seção Hero (Topo)
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título Principal</label>
                <input
                  type="text"
                  value={content.hero.title}
                  onChange={e => updateField('hero', 'title', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtítulo</label>
                <textarea
                  rows={3}
                  value={content.hero.subtitle}
                  onChange={e => updateField('hero', 'subtitle', e.target.value)}
                  className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900"
                />
              </div>
              <ImageUploadField
                label="Imagem de Fundo do Hero (opcional)"
                currentUrl={content.hero.backgroundImageUrl}
                isUploading={uploadingKey === 'hero'}
                onFileChange={file => uploadSectionImage(file, 'hero', url => updateField('hero', 'backgroundImageUrl', url))}
                onRemove={() => updateField('hero', 'backgroundImageUrl', '')}
                previewHeight={160}
              />
              <p className="text-xs text-gray-400 -mt-2">ℹ️ Deixe sem imagem para usar o gradiente premium animado.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Botão</label>
                  <input
                    type="text"
                    value={content.hero.ctaText}
                    onChange={e => updateField('hero', 'ctaText', e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link do Botão</label>
                  <input
                    type="text"
                    value={content.hero.ctaLink}
                    onChange={e => updateField('hero', 'ctaLink', e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STATS SECTION ── */}
        {activeTab === 'stats' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <BarChart2 size={18} /> Estatísticas (Barra de Números)
            </div>
            <div className="p-6">
              <div className="space-y-3 mb-4">
                {(content.stats || []).map((stat, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                    <div className="flex-1 font-bold text-accent-500 text-lg">{stat.value}</div>
                    <div className="flex-[2] text-sm text-gray-600">{stat.label}</div>
                    <button onClick={() => removeStat(idx)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <input
                  placeholder="Valor (ex: +10)"
                  value={newStatValue}
                  onChange={e => setNewStatValue(e.target.value)}
                  className="flex-1 rounded border-gray-300 text-sm bg-white text-gray-900"
                />
                <input
                  placeholder="Rótulo (ex: Anos)"
                  value={newStatLabel}
                  onChange={e => setNewStatLabel(e.target.value)}
                  className="flex-[2] rounded border-gray-300 text-sm bg-white text-gray-900"
                />
                <button onClick={addStat} className="p-2 bg-brand-500 text-white rounded hover:bg-brand-600">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PARTNERS / CLIENTS SECTION ── */}
        {activeTab === 'clients' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Users size={18} /> Parceiros de Operação
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Seção</label>
                <input
                  type="text"
                  value={content.clients?.title || ''}
                  onChange={e => updateField('clients', 'title', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input
                  type="text"
                  value={content.clients?.description || ''}
                  onChange={e => updateField('clients', 'description', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-gray-700">Lista de Parceiros (Logos)</label>
                  <button
                    onClick={() => openPartnerModal()}
                    className="text-xs bg-brand-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-brand-600"
                  >
                    <Plus size={14} /> Adicionar
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {(content.clients?.partners || []).map((partner) => (
                    <div key={partner.id} className="border border-gray-200 rounded-lg p-3 flex flex-col items-center gap-2 bg-gray-50 hover:bg-white hover:shadow-sm transition-all group relative">
                      <div className="h-12 w-full flex items-center justify-center bg-white rounded border border-gray-100 overflow-hidden">
                        {partner.logoUrl ? (
                          <img src={partner.logoUrl} alt={partner.name} className="max-h-full max-w-full object-contain p-1" />
                        ) : (
                          <span className="text-xs text-gray-300">Sem Logo</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-700 truncate w-full text-center">{partner.name}</span>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded p-0.5">
                        <button onClick={() => openPartnerModal(partner)} className="text-blue-500 hover:text-blue-700"><Edit size={14} /></button>
                        <button onClick={() => handleDeletePartner(partner.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-600 mt-3 bg-green-50 p-2 rounded flex items-center gap-1">
                  <CheckCircle2 size={14} /> Os logos aparecerão sempre coloridos no site (sem filtro P&B).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════
            GALLERY EDITOR — "Projetos em Campo"
           ══════════════════════════════════════════ */}
        {activeTab === 'gallery' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Camera size={18} /> Galeria — Projetos em Campo
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título da Seção</label>
                  <input
                    type="text"
                    value={content.gallery?.title || ''}
                    onChange={e => updateField('gallery', 'title', e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <input
                    type="text"
                    value={content.gallery?.description || ''}
                    onChange={e => updateField('gallery', 'description', e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Fotos de Projetos</label>
                    <p className="text-xs text-gray-400">Adicione fotos de obras com nome, legenda e data.</p>
                  </div>
                  <button
                    onClick={() => openGalleryModal()}
                    className="text-xs bg-accent-500 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-accent-600 font-bold"
                  >
                    <Plus size={14} /> Adicionar Projeto
                  </button>
                </div>

                {(content.gallery?.items || []).length === 0 && (
                  <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                    <Camera className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">Nenhum projeto cadastrado</p>
                    <p className="text-xs text-gray-300 mt-1">A seção ficará oculta no site até adicionar fotos.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(content.gallery?.items || [])
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((item) => (
                      <div key={item.id} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 hover:shadow-md transition-all group relative">
                        <div className="aspect-[4/3] overflow-hidden bg-gray-200">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="w-8 h-8 text-gray-300" />
                            </div>
                          )}
                        </div>
                        <div className="p-3">
                          <div className="flex items-center gap-1 text-xs text-accent-500 font-bold mb-1">
                            <Calendar size={10} /> {item.date || 'Sem data'}
                          </div>
                          <h4 className="text-sm font-bold text-gray-900 truncate">{item.title}</h4>
                          <p className="text-xs text-gray-500 truncate">{item.caption}</p>
                        </div>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openGalleryModal(item)} className="bg-white/90 p-1.5 rounded-lg shadow text-blue-500 hover:text-blue-700"><Edit size={14} /></button>
                          <button onClick={() => handleDeleteGalleryItem(item.id)} className="bg-white/90 p-1.5 rounded-lg shadow text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ABOUT/ MANIFESTO SECTION ── */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
                <FileText size={18} /> Seção Sobre / Manifesto
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Título</label>
                  <input
                    type="text"
                    value={content.about?.title || ''}
                    onChange={e => updateField('about', 'title', e.target.value)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                  <textarea
                    rows={4}
                    value={content.about?.description || ''}
                    onChange={e => updateField('about', 'description', e.target.value)}
                    className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900"
                  />
                </div>
                <ImageUploadField
                  label="Foto da Seção Sobre"
                  currentUrl={content.about?.imageUrl || ''}
                  isUploading={uploadingKey === 'about'}
                  onFileChange={file => uploadSectionImage(file, 'about', url => updateField('about', 'imageUrl', url))}
                  onRemove={() => updateField('about', 'imageUrl', '')}
                  previewHeight={180}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manifesto da Marca</label>
                  <textarea
                    rows={3}
                    value={content.about?.manifesto || ''}
                    onChange={e => updateField('about', 'manifesto', e.target.value)}
                    className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900"
                    placeholder="Texto que aparece em destaque com borda laranja..."
                  />
                  <p className="text-xs text-gray-400 mt-1">Aparece como citação em destaque na seção Sobre.</p>
                </div>
              </div>
            </div>

            {/* Differentials */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700 flex items-center gap-2">
                <CheckCircle2 size={18} /> Diferenciais
              </div>
              <div className="p-6">
                <div className="space-y-2 mb-4">
                  {(content.about?.differentials || []).map((diff, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
                      <CheckCircle2 size={16} className="text-accent-500 flex-shrink-0" />
                      <span className="flex-1 text-sm text-gray-700">{diff}</span>
                      <button onClick={() => removeDifferential(idx)} className="text-red-400 hover:text-red-600">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    placeholder="Novo diferencial (ex: Equipe técnica certificada)"
                    value={newDifferential}
                    onChange={e => setNewDifferential(e.target.value)}
                    className="flex-1 rounded-lg border-gray-300 text-sm bg-white text-gray-900"
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addDifferential())}
                  />
                  <button onClick={addDifferential} className="p-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CONTACT INFO ── */}
        {activeTab === 'contact' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <MessageSquare size={18} /> Informações de Contato
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <input
                  type="text"
                  value={content.contact.address}
                  onChange={e => updateField('contact', 'address', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input
                  type="text"
                  value={content.contact.phone}
                  onChange={e => updateField('contact', 'phone', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="text"
                  value={content.contact.email}
                  onChange={e => updateField('contact', 'email', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (número completo)</label>
                <input
                  type="text"
                  value={content.contact.whatsapp}
                  onChange={e => updateField('contact', 'whatsapp', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="5519999999999"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                <input
                  type="text"
                  value={content.contact.instagram || ''}
                  onChange={e => updateField('contact', 'instagram', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="@mgrrefrigeracao"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── FEATURES TOGGLE ── */}
        {activeTab === 'features' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Settings size={18} /> Funcionalidades
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700 block">Botão Flutuante WhatsApp</span>
                  <span className="text-xs text-gray-400">Aparece no canto inferior direito</span>
                </div>
                <input
                  type="checkbox"
                  checked={content.features.whatsappFloat}
                  onChange={e => updateField('features', 'whatsappFloat', e.target.checked)}
                  className="h-5 w-5 text-brand-500 focus:ring-brand-500 border-gray-300 rounded bg-white"
                />
              </div>
              <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                <div>
                  <span className="text-sm font-medium text-gray-700 block">Formulário de Contato</span>
                  <span className="text-xs text-gray-400">Formulário no footer do site</span>
                </div>
                <input
                  type="checkbox"
                  checked={content.features.contactForm}
                  onChange={e => updateField('features', 'contactForm', e.target.checked)}
                  className="h-5 w-5 text-brand-500 focus:ring-brand-500 border-gray-300 rounded bg-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── SERVICES NOTE ── */}
        {activeTab === 'hero' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 font-bold text-gray-700">
              Seção Soluções (Serviços)
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Seção</label>
                <input
                  type="text"
                  value={content.services.title}
                  onChange={e => updateField('services', 'title', e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                  ℹ️ Os itens de serviço devem ser editados via código para manter o layout alinhado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══ PAIN POINTS ══ */}
        {activeTab === 'painPoints' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-yellow-600 px-6 py-4 text-white font-bold flex items-center gap-2">
              <AlertTriangle size={18} /> Seção "Problema" — Pain Points
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline da Seção</label>
                <input type="text" value={content.painPoints?.headline ?? ''}
                  onChange={e => setContent(prev => prev ? ({ ...prev, painPoints: { ...prev.painPoints!, headline: e.target.value } }) : prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="Você sabe o que uma parada não planejada custa..."
                />
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-gray-700">Cards de Pain Points ({(content.painPoints?.items || []).length})</h4>
                </div>
                {(content.painPoints?.items || []).map((item, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-gray-500">CARD {i+1}</span>
                      <button onClick={() => { const items = [...(content.painPoints?.items||[])]; items.splice(i,1); setContent(prev => prev ? ({...prev, painPoints: {...prev.painPoints!, items}}) : prev); }} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                    </div>
                    <input type="text" placeholder="Ícone (ex: PackageX, TrendingDown, AlertTriangle)" value={item.icon}
                      onChange={e => { const items = [...(content.painPoints?.items||[])]; items[i]={...items[i],icon:e.target.value}; setContent(prev => prev?({...prev,painPoints:{...prev.painPoints!,items}}):prev); }}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <input type="text" placeholder="Estatística (ex: R$ 200 mil)" value={item.stat}
                      onChange={e => { const items = [...(content.painPoints?.items||[])]; items[i]={...items[i],stat:e.target.value}; setContent(prev => prev?({...prev,painPoints:{...prev.painPoints!,items}}):prev); }}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <textarea rows={2} placeholder="Descrição do pain point" value={item.description}
                      onChange={e => { const items = [...(content.painPoints?.items||[])]; items[i]={...items[i],description:e.target.value}; setContent(prev => prev?({...prev,painPoints:{...prev.painPoints!,items}}):prev); }}
                      className="w-full rounded border-gray-300 bg-white text-sm resize-none text-gray-900"/>
                  </div>
                ))}
                <button onClick={() => setContent(prev => prev ? ({...prev, painPoints: {...prev.painPoints!, items: [...(prev.painPoints?.items||[]), {icon:'AlertTriangle',stat:'',description:''}]}}) : prev)}
                  className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700">
                  <Plus size={16}/> Adicionar Card
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ PLANO 3 PASSOS ══ */}
        {activeTab === 'plan' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <CheckCircle2 size={18}/> Seção "Plano 3 Passos"
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input type="text" value={content.plan?.headline ?? ''}
                  onChange={e => setContent(prev => prev ? ({...prev, plan:{...prev.plan!, headline:e.target.value}}) : prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900" placeholder="Como a MGR protege sua operação"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do CTA</label>
                <input type="text" value={content.plan?.ctaText ?? ''}
                  onChange={e => setContent(prev => prev ? ({...prev, plan:{...prev.plan!, ctaText:e.target.value}}) : prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900" placeholder="Comece pela Visita de Valor"/>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Passos ({(content.plan?.steps||[]).length})</h4>
                {(content.plan?.steps||[]).map((step, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-gray-500">PASSO {step.number}</span>
                      <button onClick={() => { const steps=[...(content.plan?.steps||[])]; steps.splice(i,1); setContent(prev => prev?({...prev,plan:{...prev.plan!,steps}}):prev); }} className="text-red-500"><Trash2 size={14}/></button>
                    </div>
                    <input type="text" placeholder="Título do passo" value={step.title}
                      onChange={e => { const steps=[...(content.plan?.steps||[])]; steps[i]={...steps[i],title:e.target.value}; setContent(prev => prev?({...prev,plan:{...prev.plan!,steps}}):prev); }}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <textarea rows={2} placeholder="Descrição" value={step.description}
                      onChange={e => { const steps=[...(content.plan?.steps||[])]; steps[i]={...steps[i],description:e.target.value}; setContent(prev => prev?({...prev,plan:{...prev.plan!,steps}}):prev); }}
                      className="w-full rounded border-gray-300 bg-white text-sm resize-none text-gray-900"/>
                  </div>
                ))}
                <button onClick={() => { const n=(content.plan?.steps||[]).length+1; setContent(prev => prev?({...prev,plan:{...prev.plan!,steps:[...(prev.plan?.steps||[]),{number:n,title:'',description:''}]}}):prev); }}
                  className="flex items-center gap-2 text-sm font-medium text-brand-600">
                  <Plus size={16}/> Adicionar Passo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ STAKES ══ */}
        {activeTab === 'stakes' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-red-700 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Activity size={18}/> Seção "Stakes / Risco"
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input type="text" value={content.stakes?.headline ?? ''}
                  onChange={e => setContent(prev => prev?({...prev,stakes:{...prev.stakes!,headline:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frase de Transição</label>
                <textarea rows={2} value={content.stakes?.transition ?? ''}
                  onChange={e => setContent(prev => prev?({...prev,stakes:{...prev.stakes!,transition:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white resize-none text-gray-900"/>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Cards de Risco</h4>
                {(content.stakes?.items||[]).map((item,i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-gray-500">RISCO {i+1}</span>
                      <button onClick={() => { const items=[...(content.stakes?.items||[])]; items.splice(i,1); setContent(prev=>prev?({...prev,stakes:{...prev.stakes!,items}}):prev); }} className="text-red-500"><Trash2 size={14}/></button>
                    </div>
                    <input type="text" placeholder="Ícone (ex: PackageX, Gavel, Users)" value={item.icon}
                      onChange={e=>{const items=[...(content.stakes?.items||[])];items[i]={...items[i],icon:e.target.value};setContent(prev=>prev?({...prev,stakes:{...prev.stakes!,items}}):prev);}}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <input type="text" placeholder="Título" value={item.title}
                      onChange={e=>{const items=[...(content.stakes?.items||[])];items[i]={...items[i],title:e.target.value};setContent(prev=>prev?({...prev,stakes:{...prev.stakes!,items}}):prev);}}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <textarea rows={2} placeholder="Descrição" value={item.description}
                      onChange={e=>{const items=[...(content.stakes?.items||[])];items[i]={...items[i],description:e.target.value};setContent(prev=>prev?({...prev,stakes:{...prev.stakes!,items}}):prev);}}
                      className="w-full rounded border-gray-300 bg-white text-sm resize-none text-gray-900"/>
                  </div>
                ))}
                <button onClick={()=>setContent(prev=>prev?({...prev,stakes:{...prev.stakes!,items:[...(prev.stakes?.items||[]),{icon:'AlertTriangle',title:'',description:''}]}}):prev)}
                  className="flex items-center gap-2 text-sm font-medium text-brand-600">
                  <Plus size={16}/> Adicionar Risco
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MGR CONNECT ══ */}
        {activeTab === 'mgrConnect' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Wifi size={18}/> Seção "MGR Connect"
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline</label>
                <input type="text" value={content.mgrConnect?.headline ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,mgrConnect:{...prev.mgrConnect!,headline:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea rows={3} value={content.mgrConnect?.description ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,mgrConnect:{...prev.mgrConnect!,description:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white resize-none text-gray-900"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do CTA</label>
                <input type="text" value={content.mgrConnect?.ctaText ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,mgrConnect:{...prev.mgrConnect!,ctaText:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"/>
              </div>
              <ImageUploadField
                label="Imagem / Screenshot do Dashboard MGR Connect"
                currentUrl={content.mgrConnect?.imageUrl ?? ''}
                isUploading={uploadingKey === 'connect'}
                onFileChange={file => uploadSectionImage(file, 'connect', url => setContent(prev => prev?({...prev,mgrConnect:{...prev.mgrConnect!,imageUrl:url}}):prev))}
                onRemove={() => setContent(prev => prev?({...prev,mgrConnect:{...prev.mgrConnect!,imageUrl:''}}):prev)}
                previewHeight={180}
              />
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Features / Benefícios</h4>
                {(content.mgrConnect?.features||[]).map((f,i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input type="text" value={f}
                      onChange={e=>{const features=[...(content.mgrConnect?.features||[])];features[i]=e.target.value;setContent(prev=>prev?({...prev,mgrConnect:{...prev.mgrConnect!,features}}):prev);}}
                      className="flex-1 rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <button onClick={()=>{const features=[...(content.mgrConnect?.features||[])];features.splice(i,1);setContent(prev=>prev?({...prev,mgrConnect:{...prev.mgrConnect!,features}}):prev);}} className="text-red-500"><Trash2 size={16}/></button>
                  </div>
                ))}
                <button onClick={()=>setContent(prev=>prev?({...prev,mgrConnect:{...prev.mgrConnect!,features:[...(prev.mgrConnect?.features||[]),'']}}):prev)}
                  className="flex items-center gap-2 text-sm font-medium text-brand-600 mt-2">
                  <Plus size={16}/> Adicionar Feature
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ LEAD MAGNET ══ */}
        {activeTab === 'leadMagnet' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-accent-600 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Download size={18}/> Seção "Lead Magnet"
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título do Guia</label>
                <input type="text" value={content.leadMagnet?.headline ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,leadMagnet:{...prev.leadMagnet!,headline:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="7 Sinais de que Seu Sistema..."/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta</label>
                <textarea rows={2} value={content.leadMagnet?.description ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,leadMagnet:{...prev.leadMagnet!,description:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white resize-none text-gray-900"/>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Texto do Botão</label>
                <input type="text" value={content.leadMagnet?.ctaText ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,leadMagnet:{...prev.leadMagnet!,ctaText:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900" placeholder="Baixar o Guia Gratuito"/>
              </div>
            </div>
          </div>
        )}

        {/* ══ SEGMENTAÇÃO ══ */}
        {activeTab === 'segments' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Building2 size={18}/> Seção "Setores / Segmentos"
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Headline da Seção</label>
                <input type="text" value={content.segments?.headline ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,segments:{...prev.segments!,headline:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"/>
              </div>
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Segmentos ({(content.segments?.items||[]).length})</h4>
                {(content.segments?.items||[]).map((seg,i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-4 mb-3 bg-gray-50 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs font-bold text-gray-500">SETOR {i+1}</span>
                      <button onClick={()=>{const items=[...(content.segments?.items||[])];items.splice(i,1);setContent(prev=>prev?({...prev,segments:{...prev.segments!,items}}):prev);}} className="text-red-500"><Trash2 size={14}/></button>
                    </div>
                    <input type="text" placeholder="Título" value={seg.title}
                      onChange={e=>{const items=[...(content.segments?.items||[])];items[i]={...items[i],title:e.target.value};setContent(prev=>prev?({...prev,segments:{...prev.segments!,items}}):prev);}}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <input type="text" placeholder="Ícone (ex: Factory, Pill, Truck, Building2)" value={seg.icon}
                      onChange={e=>{const items=[...(content.segments?.items||[])];items[i]={...items[i],icon:e.target.value};setContent(prev=>prev?({...prev,segments:{...prev.segments!,items}}):prev);}}
                      className="w-full rounded border-gray-300 bg-white text-sm text-gray-900"/>
                    <ImageUploadField
                      label={`Foto do Setor ${i+1} (opcional)`}
                      currentUrl={seg.imageUrl}
                      isUploading={uploadingKey === `segments/seg_${i}`}
                      onFileChange={file => uploadSectionImage(file, `segments/seg_${i}`, url=>{const items=[...(content.segments?.items||[])];items[i]={...items[i],imageUrl:url};setContent(prev=>prev?({...prev,segments:{...prev.segments!,items}}):prev);})}
                      onRemove={() => {const items=[...(content.segments?.items||[])];items[i]={...items[i],imageUrl:''};setContent(prev=>prev?({...prev,segments:{...prev.segments!,items}}):prev);}}
                      previewHeight={100}
                    />
                    <textarea rows={2} placeholder="Descrição" value={seg.description}
                      onChange={e=>{const items=[...(content.segments?.items||[])];items[i]={...items[i],description:e.target.value};setContent(prev=>prev?({...prev,segments:{...prev.segments!,items}}):prev);}}
                      className="w-full rounded border-gray-300 bg-white text-sm resize-none text-gray-900"/>
                  </div>
                ))}
                <button onClick={()=>setContent(prev=>prev?({...prev,segments:{...prev.segments!,items:[...(prev.segments?.items||[]),{title:'',description:'',icon:'Factory',imageUrl:''}]}}):prev)}
                  className="flex items-center gap-2 text-sm font-medium text-brand-600">
                  <Plus size={16}/> Adicionar Setor
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ DEPOIMENTO ══ */}
        {activeTab === 'testimonial' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-brand-900 px-6 py-4 text-white font-bold flex items-center gap-2">
              <Quote size={18}/> Seção "Depoimento / Prova Social"
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Citação</label>
                <textarea rows={4} value={content.testimonial?.quote ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,testimonial:{...prev.testimonial!,quote:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white resize-none text-gray-900"
                  placeholder="Desde que a MGR assumiu a gestão..."/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input type="text" value={content.testimonial?.name ?? ''}
                    onChange={e=>setContent(prev=>prev?({...prev,testimonial:{...prev.testimonial!,name:e.target.value}}):prev)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input type="text" value={content.testimonial?.role ?? ''}
                    onChange={e=>setContent(prev=>prev?({...prev,testimonial:{...prev.testimonial!,role:e.target.value}}):prev)}
                    className="w-full rounded-lg border-gray-300 bg-white text-gray-900"/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Empresa / Contexto</label>
                <input type="text" value={content.testimonial?.company ?? ''}
                  onChange={e=>setContent(prev=>prev?({...prev,testimonial:{...prev.testimonial!,company:e.target.value}}):prev)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="Indústria Alimentícia — Indaiatuba/SP"/>
              </div>
              <ImageUploadField
                label="Foto do Depoente (opcional)"
                currentUrl={content.testimonial?.photoUrl ?? ''}
                isUploading={uploadingKey === 'testimonial'}
                onFileChange={file => uploadSectionImage(file, 'testimonial', url => setContent(prev => prev?({...prev,testimonial:{...prev.testimonial!,photoUrl:url}}):prev))}
                onRemove={() => setContent(prev => prev?({...prev,testimonial:{...prev.testimonial!,photoUrl:''}}):prev)}
                previewHeight={100}
              />
            </div>
          </div>
        )}
          </div>{/* end scrollable form */}

          {/* ── STICKY APPLY BUTTON ── */}
          <div style={{
            flexShrink:0, padding:'12px 16px',
            borderTop: hasUnsavedChanges ? '2px solid #D4792A' : '1px solid #E2E8F0',
            background: hasUnsavedChanges ? '#FFF7ED' : '#F8FAFC',
            transition: 'all .3s'
          }}>
            {hasUnsavedChanges && (
              <p style={{ fontSize:11, color:'#92400E', fontWeight:600, marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:'#D4792A', display:'inline-block', animation:'pulse 1.5s ease-in-out infinite' }}/>
                Você tem alterações não aplicadas no preview
              </p>
            )}
            <div style={{ display:'flex', gap:8, alignItems:'center' }}>
              <button
                id="btn-aplicar-edicoes"
                onClick={handleApply}
                disabled={applyFeedback === 'applying' || (!hasUnsavedChanges && applyFeedback === 'idle')}
                style={{
                  flex:1,
                  display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                  padding:'10px 16px', borderRadius:10, border:'none',
                  background: applyFeedback === 'done' ? '#16A34A' : hasUnsavedChanges ? '#D4792A' : '#94A3B8',
                  color:'#fff', fontSize:13, fontWeight:700, cursor: hasUnsavedChanges ? 'pointer' : 'default',
                  opacity: applyFeedback === 'applying' ? 0.7 : 1,
                  transition: 'all .3s',
                  boxShadow: hasUnsavedChanges ? '0 4px 12px rgba(212,121,42,.35)' : 'none'
                }}
              >
                {applyFeedback === 'applying' ? (
                  <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }}/> Aplicando...</>
                ) : applyFeedback === 'done' ? (
                  <><CheckCircle2 size={15}/> Preview Atualizado!</>
                ) : (
                  <><Monitor size={15}/> Aplicar Edições no Preview</>
                )}
              </button>
            </div>
          </div>

        </div>{/* end left panel */}

        {/* ── RIGHT PANEL: live iframe preview ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', background:'#E2E8F0', overflow:'hidden' }}>
          {/* Preview toolbar */}
          <div style={{ height:44, background:'#1E293B', display:'flex', alignItems:'center', padding:'0 16px', gap:12, flexShrink:0 }}>
            <div style={{ display:'flex', gap:6 }}>
              <div style={{ width:11, height:11, borderRadius:'50%', background:'#EF4444' }}/>
              <div style={{ width:11, height:11, borderRadius:'50%', background:'#F59E0B' }}/>
              <div style={{ width:11, height:11, borderRadius:'50%', background:'#22C55E' }}/>
            </div>
            <div style={{ flex:1, background:'rgba(255,255,255,.06)', borderRadius:8, padding:'4px 12px', fontSize:12, color:'rgba(255,255,255,.5)', border:'1px solid rgba(255,255,255,.08)', display:'flex', alignItems:'center', gap:8 }}>
              <Globe size={12} color="rgba(255,255,255,.4)"/>
              <span>mgrrefrigeracao.com.br — #{activeTabSectionId}</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:600,
              color: saving ? '#F59E0B' : hasUnsavedChanges ? '#FB923C' : '#4ADE80' }}>
              {saving
                ? <Loader2 size={12} className="animate-spin"/>
                : <div style={{ width:8, height:8, borderRadius:'50%', background: hasUnsavedChanges ? '#FB923C' : '#4ADE80', transition:'.3s' }}/>}
              {saving ? 'Publicando...' : hasUnsavedChanges ? 'Alterações pendentes — clique em Aplicar' : 'Preview sincronizado'}
            </div>
          </div>
          {/* iframe */}
          <div style={{ flex:1, overflow:'hidden', padding:16, display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ flex:1, borderRadius:12, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,.2)', background:'#fff', position:'relative' }}>
              <iframe
                key={previewKey}
                ref={iframeRef}
                src={previewSrc}
                style={{ width:'100%', height:'100%', border:'none', display:'block' }}
                title="Preview do site MGR"
              />
              {saving && (
                <div style={{ position:'absolute', inset:0, background:'rgba(255,255,255,.6)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
                    <Loader2 size={32} className="animate-spin" style={{ color:'#1B5E8A' }}/>
                    <span style={{ fontSize:14, fontWeight:600, color:'#1B5E8A' }}>Publicando alterações...</span>
                  </div>
                </div>
              )}
            </div>
            <div style={{ textAlign:'center', fontSize:11, color:'#94A3B8', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              <CheckCircle2 size={12}/>
              Use <strong style={{ color:'#D4792A' }}>Aplicar Edições</strong> para ver no preview · depois <strong style={{ color:'#1B5E8A' }}>Salvar Site</strong> para publicar
            </div>
          </div>{/* end iframe padding wrapper */}
        </div>{/* end right panel */}

      </div>{/* end split body */}
    </div>{/* end wrapper */}

      {/* Modais */}
      {isPartnerModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900">{editingPartner ? 'Editar Parceiro' : 'Adicionar Parceiro'}</h3>
              <button onClick={() => setIsPartnerModalOpen(false)}><X className="text-gray-500 w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="Ex: MGR Refrigeração"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logotipo (Imagem)</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer relative bg-white">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {partnerLogoPreview ? (
                    <div className="flex flex-col items-center">
                      <img src={partnerLogoPreview} alt="Preview" className="h-20 object-contain mb-2" />
                      <span className="text-xs text-brand-500 font-medium">Clique para alterar</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <UploadCloud className="w-8 h-8 mb-2 text-gray-400" />
                      <span className="text-sm">Clique para upload</span>
                      <span className="text-xs text-gray-400 mt-1">PNG, JPG ou SVG</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsPartnerModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-300 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={handleSavePartner} disabled={isUploading} className="px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 flex items-center gap-2 disabled:opacity-70">
                {isUploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Salvar Parceiro
              </button>
            </div>
          </div>
        </div>
      )}

      {isGalleryModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center bg-brand-900 text-white">
              <h3 className="font-bold flex items-center gap-2">
                <Camera size={18} />
                {editingGalleryItem ? 'Editar Projeto' : 'Adicionar Projeto à Galeria'}
              </h3>
              <button onClick={() => setIsGalleryModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Foto do Projeto *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer relative bg-white">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleGalleryFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {galleryPreview ? (
                    <div className="flex flex-col items-center">
                      <img src={galleryPreview} alt="Preview" className="h-40 object-cover rounded-lg mb-2" />
                      <span className="text-xs text-brand-500 font-medium">Clique para alterar</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500 py-6">
                      <UploadCloud className="w-10 h-10 mb-3 text-gray-300" />
                      <span className="text-sm font-medium">Clique para upload da foto</span>
                      <span className="text-xs text-gray-400 mt-1">JPG ou PNG — será comprimida automaticamente</span>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Projeto *</label>
                <input
                  type="text"
                  value={galleryTitle}
                  onChange={e => setGalleryTitle(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="Ex: Câmara Fria Walk-in — Halipar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legenda (descrição curta)</label>
                <textarea
                  rows={2}
                  value={galleryCaption}
                  onChange={e => setGalleryCaption(e.target.value)}
                  className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900"
                  placeholder="Ex: 48h de trabalho, câmara operando a -25°C"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
                <input
                  type="text"
                  value={galleryDate}
                  onChange={e => setGalleryDate(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white text-gray-900"
                  placeholder="Ex: Março 2026"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
              <button onClick={() => setIsGalleryModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white border border-transparent hover:border-gray-300 rounded-lg transition-all">
                Cancelar
              </button>
              <button onClick={handleSaveGalleryItem} disabled={isGalleryUploading} className="px-4 py-2 bg-accent-600 text-white text-sm font-bold rounded-lg hover:bg-accent-700 flex items-center gap-2 disabled:opacity-70">
                {isGalleryUploading ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                Salvar Projeto
              </button>
            </div>
          </div>
        </div>
      )}
    </React.Fragment>
  );
};

export default LandingPageEditor;


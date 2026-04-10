import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, LandingPageContent, GalleryItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Phone, Mail, MapPin, Instagram, Edit, X, Snowflake, Wrench, Thermometer,
  Fan, CheckCircle2, ArrowRight, ShieldCheck, Send, MessageCircle, Factory,
  QrCode, Camera, Calendar, Shield, Clock, Award, Menu, AlertTriangle,
  TrendingDown, DollarSign, Zap, Monitor, BarChart3, Wifi, FileText,
  Building2, Pill, Truck, ChevronRight, Activity, PackageX, Gavel, Users,
  Download, Eye
} from 'lucide-react';

/* ═══════════════════════════════════════════════
   DEFAULT DATA — Brand Guide MGR v3.0
   ═══════════════════════════════════════════════ */
const MGR_DEFAULT: LandingPageContent = {
  hero: {
    title: "Sua operação nunca para.",
    subtitle: "Mais de 20 anos mantendo a continuidade operacional de plantas industriais que não podem parar. Manutenção inteligente, gestão do Ciclo de Vida MGR e resposta imediata.",
    backgroundImageUrl: "",
    ctaText: "Agendar Visita de Valor",
    ctaLink: "#contato"
  },
  stats: [
    { value: "+20", label: "Anos de Expertise" },
    { value: "+300", label: "Projetos Entregues" },
    { value: "+50", label: "Contratos Ativos" },
    { value: "24/7", label: "Suporte Emergencial" }
  ],
  services: {
    title: "O Ciclo de Vida MGR",
    items: [
      { title: "Visita de Valor", description: "Diagnóstico completo com Relatório de Saúde antes de qualquer decisão de investimento.", icon: "Eye" },
      { title: "Manutenção Preditiva", description: "Antecipamos falhas com inteligência técnica de campo e análise de vibração e óleo.", icon: "Activity" },
      { title: "Resposta 24/7", description: "Especialistas de Campo com SLA de resposta garantido e frota própria disponível.", icon: "Zap" },
      { title: "MGR Connect", description: "Monitoramento remoto e gestão digital dos seus ativos de refrigeração em tempo real.", icon: "Wifi" },
      { title: "Gestão do Ciclo de Vida", description: "Planejamento estratégico para máxima vida útil e menor custo total de operação.", icon: "BarChart3" }
    ]
  },
  clients: {
    title: "Parceiros de Operação",
    description: "Indústrias que confiam na MGR para nunca parar.",
    partners: [
      { id: '1', name: "Halipar", logoUrl: "" },
      { id: '2', name: "Sorvetão", logoUrl: "" },
      { id: '3', name: "Dellys", logoUrl: "" },
      { id: '4', name: "Indaiá Pescados", logoUrl: "" }
    ]
  },
  gallery: { title: "Projetos em Campo", description: "Cada projeto é uma operação que nunca mais vai parar.", items: [] },
  about: {
    title: "Engenharia que Garante Continuidade",
    description: "A MGR nasceu com uma premissa: fazer refrigeração do jeito certo, do começo ao fim. Com mais de 20 anos de experiência em campo, unimos expertise técnica com tecnologia própria para oferecer o acompanhamento do ciclo de vida completo.",
    imageUrl: "",
    manifesto: "Não somos apenas técnicos que consertam equipamentos. Somos parceiros de operação que projetam, constroem, mantêm e monitoram com uma única obsessão: que o seu negócio funcione, sempre.",
    differentials: [
      "Equipe técnica certificada e frota própria",
      "Atendimento ágil em Indaiatuba e região",
      "Gestão digital de manutenção via MGR Connect",
      "SLA contratual com penalidades — compromisso real"
    ]
  },
  contact: { address: "Indaiatuba - SP e Região", phone: "(19) 3333-3333", email: "contato@mgrrefrigeracao.com.br", whatsapp: "5519999999999", instagram: "@mgrrefrigeracao" },
  features: { whatsappFloat: true, contactForm: true },
  painPoints: {
    headline: "Você sabe o que uma parada não planejada custa à sua operação?",
    items: [
      { icon: "PackageX", stat: "R$ 200 mil", description: "Uma falha de 4 horas em câmara fria pode destruir um lote inteiro de produto armazenado." },
      { icon: "TrendingDown", stat: "3x mais caro", description: "Manutenção reativa custa até 3 vezes mais do que a gestão inteligente do ciclo de vida." },
      { icon: "AlertTriangle", stat: "68% das falhas", description: "Acontecem nos piores momentos. Sem monitoramento, o risco é permanente e silencioso." }
    ]
  },
  plan: {
    headline: "Como a MGR protege sua operação",
    steps: [
      { number: 1, title: "Visita de Valor", description: "Nosso Especialista de Campo faz um diagnóstico completo e entrega o Relatório de Saúde da sua instalação — sem compromisso." },
      { number: 2, title: "Plano sob medida", description: "Com base no diagnóstico, desenhamos a estratégia de continuidade operacional ideal para a sua realidade e orçamento." },
      { number: 3, title: "Parceiro de Operação", description: "Atuamos como extensão da sua equipe. Monitoramento, manutenção e resposta imediata — sua operação nunca para." }
    ],
    ctaText: "Comece pela Visita de Valor"
  },
  stakes: {
    headline: "O que está em jogo quando a refrigeração falha",
    items: [
      { icon: "PackageX", title: "Perda de produto e receita", description: "Lotes inteiros comprometidos por variação térmica em câmaras e túneis sem monitoramento." },
      { icon: "Gavel", title: "Multas e não-conformidade", description: "Auditorias da vigilância sanitária e ANVISA. Uma falha de temperatura pode comprometer a licença de operação." },
      { icon: "Users", title: "Reputação e contratos", description: "Um único incidente pode custar um cliente-chave. A confiança leva anos para construir e horas para perder." }
    ],
    transition: "A diferença entre risco e tranquilidade é ter um Parceiro de Operação com 20 anos de campo."
  },
  mgrConnect: {
    headline: "MGR Connect: seus ativos monitorados em tempo real",
    description: "Tecnologia própria desenvolvida para a realidade da refrigeração industrial brasileira. Do alerta preditivo ao histórico completo do ciclo de vida.",
    features: [
      "Alertas preditivos antes da falha acontecer",
      "Relatório de Saúde digital acessível 24/7",
      "Histórico completo do ciclo de vida de cada ativo",
      "Integração com equipe de campo para resposta imediata",
      "QR Code nos equipamentos para abertura instantânea de chamados"
    ],
    ctaText: "Conheça o MGR Connect",
    imageUrl: ""
  },
  leadMagnet: {
    headline: "7 Sinais de que Seu Sistema de Refrigeração Precisa de Atenção Imediata",
    ctaText: "Baixar o Guia Gratuito",
    description: "Material técnico desenvolvido pelos nossos Especialistas de Campo. Identifique riscos antes que virem paradas."
  },
  segments: {
    headline: "Soluções para a sua operação",
    items: [
      { title: "Indústria Alimentícia", description: "Câmaras frias, túneis de congelamento e girofreezers com controle rigoroso de temperatura.", icon: "Factory", imageUrl: "" },
      { title: "Farmacêutica e Hospitalar", description: "Controle térmico de precisão e conformidade com normas regulatórias ANVISA e ABNT.", icon: "Pill", imageUrl: "" },
      { title: "Logística e Cold Storage", description: "Continuidade da cadeia de frio do armazém à distribuição. Zero ruptura de temperatura.", icon: "Truck", imageUrl: "" },
      { title: "Indústria Geral", description: "Processos térmicos industriais, chillers, torres de resfriamento e HVAC industrial.", icon: "Building2", imageUrl: "" }
    ]
  },
  testimonial: {
    quote: "Desde que a MGR assumiu a gestão do nosso sistema, não tivemos uma única parada não planejada. O Relatório de Saúde mensal nos dá tranquilidade para focar no negócio.",
    name: "Gestor de Manutenção",
    role: "Gerente de Manutenção Industrial",
    company: "Indústria Alimentícia — Indaiatuba/SP",
    photoUrl: ""
  }
};

/* ═══════════════════════════════════════════════
   HELPER — ícone por nome
   ═══════════════════════════════════════════════ */
const getIcon = (name: string, cls = "w-6 h-6") => {
  const map: Record<string, React.ReactElement> = {
    Wrench: <Wrench className={cls} />, Thermometer: <Thermometer className={cls} />,
    Fan: <Fan className={cls} />, ShieldCheck: <ShieldCheck className={cls} />,
    Snowflake: <Snowflake className={cls} />, Factory: <Factory className={cls} />,
    QrCode: <QrCode className={cls} />, Eye: <Eye className={cls} />,
    Activity: <Activity className={cls} />, Zap: <Zap className={cls} />,
    Wifi: <Wifi className={cls} />, BarChart3: <BarChart3 className={cls} />,
    Monitor: <Monitor className={cls} />, FileText: <FileText className={cls} />,
    Building2: <Building2 className={cls} />, Pill: <Pill className={cls} />,
    Truck: <Truck className={cls} />, PackageX: <PackageX className={cls} />,
    TrendingDown: <TrendingDown className={cls} />, AlertTriangle: <AlertTriangle className={cls} />,
    Gavel: <Gavel className={cls} />, Users: <Users className={cls} />,
    DollarSign: <DollarSign className={cls} />, Download: <Download className={cls} />,
  };
  return map[name] || <CheckCircle2 className={cls} />;
};

/* ═══════════════════════════════════════════════
   HOOK — IntersectionObserver
   ═══════════════════════════════════════════════ */
const useVisible = (threshold = 0.15) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
};

/* ═══════════════════════════════════════════════
   HOOK — countUp animation
   ═══════════════════════════════════════════════ */
const useCountUp = (target: string, active: boolean) => {
  const [display, setDisplay] = useState('0');
  useEffect(() => {
    if (!active) return;
    const numeric = parseFloat(target.replace(/[^0-9.]/g, ''));
    const prefix = target.match(/^[^0-9]*/)?.[0] || '';
    const suffix = target.match(/[^0-9.]+$/)?.[0] || '';
    if (isNaN(numeric)) { setDisplay(target); return; }
    let start = 0;
    const step = numeric / 40;
    const timer = setInterval(() => {
      start = Math.min(start + step, numeric);
      setDisplay(prefix + (Number.isInteger(numeric) ? Math.floor(start) : start.toFixed(1)) + suffix);
      if (start >= numeric) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [active, target]);
  return display;
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const [content, setContent] = useState<LandingPageContent>(MGR_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Forms
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formStatus, setFormStatus] = useState<'idle'|'sending'|'success'|'error'>('idle');

  // Lead Modal
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadNome, setLeadNome] = useState('');
  const [leadTelefone, setLeadTelefone] = useState('');
  const [leadTipo, setLeadTipo] = useState('');
  const [leadSending, setLeadSending] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  // Gallery Modal
  const [galleryModal, setGalleryModal] = useState<GalleryItem | null>(null);

  // Lead Magnet Modal
  const [showLeadMagnet, setShowLeadMagnet] = useState(false);
  const [lmEmail, setLmEmail] = useState('');
  const [lmName, setLmName] = useState('');
  const [lmSent, setLmSent] = useState(false);

  const canEdit = userProfile?.role === 'developer' || userProfile?.role === 'admin';

  // Editor highlight listener
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'mgr-editor-highlight') return;
      const id = e.data.sectionId as string;
      // Remove previous highlight
      document.querySelectorAll('.mgr-editor-highlight').forEach(el => {
        el.classList.remove('mgr-editor-highlight');
      });
      const el = document.getElementById(id);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Small delay so scroll settles before highlight animates
      setTimeout(() => el.classList.add('mgr-editor-highlight'), 200);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Scroll listener
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  // Firestore sync
  useEffect(() => {
    const ref = doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page');
    const unsub = onSnapshot(ref, async (snap) => {
      if (snap.exists()) {
        const d = snap.data() as any;
        let partners = d.clients?.partners || [];
        if (d.clients?.logos && partners.length === 0)
          partners = d.clients.logos.map((n: string, i: number) => ({ id: `l${i}`, name: n, logoUrl: '' }));
        setContent({
          ...MGR_DEFAULT, ...d,
          clients: { ...MGR_DEFAULT.clients, ...d.clients, partners },
          gallery: { ...MGR_DEFAULT.gallery, ...d.gallery },
          about: { ...MGR_DEFAULT.about, ...d.about },
          painPoints: d.painPoints || MGR_DEFAULT.painPoints,
          plan: d.plan || MGR_DEFAULT.plan,
          stakes: d.stakes || MGR_DEFAULT.stakes,
          mgrConnect: d.mgrConnect || MGR_DEFAULT.mgrConnect,
          leadMagnet: d.leadMagnet || MGR_DEFAULT.leadMagnet,
          segments: d.segments || MGR_DEFAULT.segments,
          testimonial: d.testimonial || MGR_DEFAULT.testimonial,
        });
      } else {
        if (currentUser) { try { await setDoc(ref, MGR_DEFAULT); } catch {} }
        setContent(MGR_DEFAULT);
      }
      setLoading(false);
    }, (err: any) => { if (err?.code !== 'permission-denied') console.error(err); setContent(MGR_DEFAULT); setLoading(false); });
    return () => unsub();
  }, [currentUser]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormStatus('sending');
    try {
      await addDoc(collection(db, CollectionName.CONTACT_MESSAGES), { name: formName, email: formEmail, message: formMessage, createdAt: serverTimestamp(), status: 'new' });
      setFormStatus('success'); setFormName(''); setFormEmail(''); setFormMessage('');
      setTimeout(() => setFormStatus('idle'), 5000);
    } catch { setFormStatus('error'); }
  };

  const handleLeadRapido = async (e: React.FormEvent) => {
    e.preventDefault(); if (!leadNome.trim() || !leadTelefone.trim()) return; setLeadSending(true);
    try {
      await addDoc(collection(db, 'project_leads'), { nomeContato: leadNome.trim(), telefone: leadTelefone.trim(), tipoProjetoSlug: leadTipo || 'nao_definido', origem: 'formulario_site', status: 'novo', criadoEm: serverTimestamp(), userAgent: navigator.userAgent });
      setLeadSent(true);
      setTimeout(() => { setShowLeadModal(false); setLeadSent(false); setLeadNome(''); setLeadTelefone(''); setLeadTipo(''); }, 3000);
    } finally { setLeadSending(false); }
  };

  const handleLeadMagnet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'project_leads'), { nomeContato: lmName.trim(), email: lmEmail.trim(), origem: 'lead_magnet_guia', status: 'novo', criadoEm: serverTimestamp() });
      setLmSent(true);
    } catch {}
  };

  // Visible section refs
  const secPain = useVisible();
  const secServices = useVisible();
  const secPlan = useVisible();
  const secStats = useVisible();
  const secStakes = useVisible();
  const secConnect = useVisible();
  const secSegments = useVisible();

  if (loading) return <div className="min-h-screen bg-white" />;

  const pp = content.painPoints || MGR_DEFAULT.painPoints!;
  const pl = content.plan || MGR_DEFAULT.plan!;
  const st = content.stakes || MGR_DEFAULT.stakes!;
  const mc = content.mgrConnect || MGR_DEFAULT.mgrConnect!;
  const lm = content.leadMagnet || MGR_DEFAULT.leadMagnet!;
  const sg = content.segments || MGR_DEFAULT.segments!;
  const tm = content.testimonial || MGR_DEFAULT.testimonial!;
  const galleryItems = (content.gallery?.items || []).sort((a, b) => (a.order||0)-(b.order||0));
  const partners = content.clients?.partners || [];
  const loopPartners = partners.length > 0 ? [...partners, ...partners, ...partners] : [];

  const fadeIn = (visible: boolean, delay = '0s') =>
    ({ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(28px)', transition: `opacity .7s ease ${delay}, transform .7s ease ${delay}` });

  return (
    <div className="min-h-screen bg-white antialiased" style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      {/* ── FONTS + CSS VARS + ANIMATIONS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap');
        :root{
          --blue:#1B5E8A;--blue-dark:#144a6f;--orange:#D4792A;--orange-dark:#b8641f;
          --navy:#0F172A;--gray-ice:#F8FAFC;--text:#1F2937;--muted:#6B7280;--border:#E5E7EB;
          --display:'Instrument Serif',Georgia,serif;--body:'DM Sans',system-ui,sans-serif;
        }
        @keyframes meshMove{0%,100%{transform:scale(1) translate(0,0)}40%{transform:scale(1.06) translate(-14px,10px)}70%{transform:scale(.96) translate(12px,-8px)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        @keyframes pulseRing{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.8);opacity:0}}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-100%)}}
        @keyframes waGlow{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}50%{box-shadow:0 0 0 14px rgba(34,197,94,0)}}
        .mesh{position:absolute;inset:-20%;animation:meshMove 18s ease-in-out infinite;
          background:radial-gradient(ellipse 70% 65% at 15% 30%,rgba(27,94,138,.65) 0%,transparent 65%),
          radial-gradient(ellipse 50% 70% at 85% 20%,rgba(212,121,42,.18) 0%,transparent 60%),
          radial-gradient(ellipse 60% 55% at 50% 80%,rgba(27,94,138,.35) 0%,transparent 70%);}
        .grid-overlay{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.03) 1px,transparent 1px);background-size:60px 60px;}
        .vignette{position:absolute;inset:0;background:radial-gradient(ellipse 140% 100% at 50% 50%,transparent 25%,rgba(15,23,42,.7) 100%);}
        .kpi{animation:float 5s ease-in-out infinite;}
        .kpi-dot::after{content:'';position:absolute;inset:0;border-radius:50%;background:#059669;animation:pulseRing 2s ease-out infinite;}
        .marquee-wrap{animation:marquee 42s linear infinite;}
        .wa-btn{animation:waGlow 2.2s infinite;}
        .btn-orange{display:inline-flex;align-items:center;gap:8px;background:var(--orange);color:#fff;font-weight:700;border:none;border-radius:8px;cursor:pointer;text-decoration:none;transition:.2s;}
        .btn-orange:hover{background:var(--orange-dark);transform:translateY(-2px);box-shadow:0 10px 28px rgba(212,121,42,.38);}
        .btn-outline-w{display:inline-flex;align-items:center;gap:8px;background:transparent;color:#fff;font-weight:600;border:2px solid rgba(255,255,255,.45);border-radius:8px;cursor:pointer;text-decoration:none;transition:.2s;}
        .btn-outline-w:hover{background:rgba(255,255,255,.1);border-color:#fff;}
        .btn-blue{display:inline-flex;align-items:center;gap:8px;background:var(--blue);color:#fff;font-weight:700;border:none;border-radius:8px;cursor:pointer;text-decoration:none;transition:.2s;}
        .btn-blue:hover{background:var(--blue-dark);transform:translateY(-1px);}
        .nav-link{font-weight:500;font-size:14px;color:var(--text);text-decoration:none;padding:8px 12px;border-radius:8px;transition:.2s;}
        .nav-link:hover{color:var(--blue);background:rgba(27,94,138,.06);}
        .service-card:hover{border-color:var(--orange);box-shadow:0 12px 40px rgba(212,121,42,.1);}
        .service-card:hover .svc-icon{background:var(--orange);color:#fff;}
        .segment-card:hover{transform:translateY(-4px);box-shadow:0 20px 48px rgba(0,0,0,.14);}
        .step-line::after{content:'';position:absolute;top:22px;left:calc(50% + 22px);width:calc(100% - 44px);height:2px;background:linear-gradient(90deg,var(--orange),var(--blue));border-radius:2px;}
        /* ── EDITOR HIGHLIGHT ── */
        @keyframes editorPulse{0%,100%{outline-color:#EF4444;outline-offset:-4px}50%{outline-color:#F97316;outline-offset:2px}}
        .mgr-editor-highlight{
          outline:3px solid #EF4444!important;
          outline-offset:-3px;
          animation:editorPulse 1.5s ease-in-out infinite;
          scroll-margin-top:80px;
          position:relative;z-index:5;
        }
        .mgr-editor-highlight::before{
          content:'Editando esta seção';
          position:absolute;top:0;left:0;z-index:9999;
          background:#EF4444;color:#fff;font-size:11px;font-weight:700;
          padding:4px 10px;letter-spacing:.5px;text-transform:uppercase;
          border-radius:0 0 8px 0;font-family:system-ui;pointer-events:none;
        }
        @media(max-width:768px){
          .desk-only{display:none!important;}
          .hamburger{display:flex!important;}
          .hero-ctas{flex-direction:column;align-items:stretch;}
          .btn-orange,.btn-outline-w{justify-content:center;}
          .trust-grid{grid-template-columns:repeat(2,1fr)!important;}
          .step-line::after{display:none;}
          .steps-row{flex-direction:column!important;gap:28px!important;}
          .segment-grid{grid-template-columns:repeat(2,1fr)!important;}
          .connect-layout{flex-direction:column!important;}
        }
        @media(max-width:520px){
          .trust-grid{grid-template-columns:1fr!important;}
          .segment-grid{grid-template-columns:1fr!important;}
          .pain-grid{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* ── WhatsApp Float ── */}
      {content.features.whatsappFloat && (
        <a href={`https://wa.me/${content.contact.whatsapp}`} target="_blank" rel="noopener noreferrer"
          className="wa-btn fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 hover:scale-110 transition-all flex items-center justify-center"
          title="WhatsApp">
          <MessageCircle className="w-7 h-7" fill="white" />
        </a>
      )}

      {/* ── Admin Edit Button ── */}
      {canEdit && (
        <button onClick={() => navigate('/editor-site')}
          className="fixed bottom-24 right-6 z-50 bg-orange-500 text-white p-3 rounded-full shadow-xl hover:bg-orange-600 hover:scale-105 transition-all" title="Editar site">
          <Edit className="w-5 h-5" />
        </button>
      )}

      {/* ═══════════════════ HEADER ═══════════════════ */}
      <header style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background:'rgba(255,255,255,.97)', borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent', boxShadow: scrolled ? '0 2px 24px rgba(27,94,138,.1)' : 'none', backdropFilter: scrolled ? 'blur(12px)' : 'none', transition:'all .35s ease' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px', height:72, display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
            <a href="#" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
              <div style={{ width:44, height:44, background:'linear-gradient(135deg,#1B5E8A,#2272a8)', borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontWeight:800, fontSize:13, color:'#fff', letterSpacing:'-.5px' }}>MGR</span>
              </div>
              <div>
                <span style={{ display:'block', fontWeight:700, fontSize:16, color:'var(--blue)', letterSpacing:'-.3px', lineHeight:1.1 }}>MGR Refrigeração</span>
                <span style={{ fontSize:10, color:'var(--muted)', letterSpacing:'.6px', textTransform:'uppercase' }}>Soluções &amp; Tecnologia</span>
              </div>
            </a>
          </div>

          <nav className="desk-only" style={{ display:'flex', alignItems:'center', gap:2, flex:1, justifyContent:'center' }}>
            {['#servicos|Serviços','#setores|Setores','#sobre|Sobre','#connect|MGR Connect','#contato|Contato'].map(i => {
              const [h,l] = i.split('|');
              return <a key={l} href={h} className="nav-link">{l}</a>;
            })}
          </nav>

          <div className="desk-only" style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
            <a href={`tel:${content.contact.phone}`} style={{ display:'flex', alignItems:'center', gap:6, fontWeight:600, fontSize:13, color:'var(--blue)', textDecoration:'none', padding:'8px 12px', borderRadius:8, border:'1.5px solid rgba(27,94,138,.2)' }}>
              <Phone size={14} /> {content.contact.phone}
            </a>
            <button onClick={() => navigate('/login')} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 16px', fontSize:13, fontWeight:600, color:'var(--blue)', background:'rgba(27,94,138,.06)', border:'1.5px solid rgba(27,94,138,.18)', borderRadius:8, cursor:'pointer', transition:'.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(27,94,138,.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background='rgba(27,94,138,.06)'; }}>
              <Shield size={14} /> Acessar Sistema
            </button>
            <button onClick={() => setShowLeadModal(true)} className="btn-orange" style={{ padding:'10px 20px', fontSize:14 }}>
              <Calendar size={15} /> Agendar Visita
            </button>
          </div>

          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}
            style={{ display:'none', width:38, height:38, alignItems:'center', justifyContent:'center', background:'none', border:'none', cursor:'pointer', borderRadius:8, flexShrink:0 }}>
            <Menu size={22} color="var(--text)" />
          </button>
        </div>

        {menuOpen && (
          <div style={{ background:'#fff', borderTop:'1px solid var(--border)', padding:'12px 24px 20px', display:'flex', flexDirection:'column', gap:4 }}>
            {['#servicos|Serviços','#setores|Setores','#sobre|Sobre','#connect|MGR Connect','#contato|Contato'].map(i => {
              const [h,l] = i.split('|');
              return <a key={l} href={h} onClick={() => setMenuOpen(false)} style={{ padding:'11px 8px', borderBottom:'1px solid var(--border)', fontWeight:500, color:'var(--text)', textDecoration:'none' }}>{l}</a>;
            })}
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:10 }}>
              <a href={`tel:${content.contact.phone}`} style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', fontWeight:600, fontSize:14, color:'var(--blue)', textDecoration:'none', padding:'11px', border:'1.5px solid rgba(27,94,138,.25)', borderRadius:8 }}>
                <Phone size={16}/>{content.contact.phone}
              </a>
              <button onClick={() => { setMenuOpen(false); navigate('/login'); }} style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center', fontWeight:600, fontSize:14, color:'var(--blue)', background:'rgba(27,94,138,.06)', border:'1.5px solid rgba(27,94,138,.18)', borderRadius:8, padding:'11px', cursor:'pointer' }}>
                <Shield size={16}/> Acessar Sistema
              </button>
              <button onClick={() => { setMenuOpen(false); setShowLeadModal(true); }} className="btn-orange" style={{ padding:'13px 20px', fontSize:15, justifyContent:'center' }}>
                <Calendar size={16}/> Agendar Visita de Valor
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════════════ HERO ═══════════════════ */}
      <section id="mgr-sec-hero" style={{ minHeight:'100vh', position:'relative', display:'flex', flexDirection:'column', justifyContent:'center', overflow:'hidden', paddingTop:72, background:'var(--navy)' }}>
        <div className="mesh" />
        <div className="grid-overlay" />
        <div className="vignette" />
        <div style={{ position:'absolute', top:'22%', right:'-5%', width:'55%', height:1, background:'linear-gradient(90deg,transparent,rgba(212,121,42,.22),transparent)', transform:'rotate(-7deg)', zIndex:3 }} />

        {/* Floating KPI */}
        <div className="kpi desk-only" style={{ position:'absolute', right:'7%', top:'30%', zIndex:10 }}>
          <div style={{ background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.13)', backdropFilter:'blur(16px)', borderRadius:18, padding:'22px 28px', minWidth:190 }}>
            <div style={{ position:'absolute', top:-5, right:-5, width:13, height:13, borderRadius:'50%', background:'#059669' }} className="kpi-dot" />
            <span style={{ fontFamily:'var(--display)', fontSize:46, color:'var(--orange)', lineHeight:1, display:'block' }}>98%</span>
            <span style={{ fontSize:12, color:'rgba(255,255,255,.6)', display:'block', marginTop:4, lineHeight:1.5 }}>Taxa de continuidade<br/>operacional dos clientes</span>
          </div>
        </div>

        <div style={{ position:'relative', zIndex:10, maxWidth:1280, margin:'0 auto', padding:'80px 24px 64px', width:'100%' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(212,121,42,.14)', border:'1px solid rgba(212,121,42,.3)', borderRadius:100, padding:'6px 14px', marginBottom:28 }}>
            <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--orange)', display:'inline-block' }} />
            <span style={{ fontWeight:600, fontSize:12, color:'var(--orange)', letterSpacing:'.8px', textTransform:'uppercase' }}>+20 anos de expertise em campo</span>
            <CheckCircle2 size={13} color="var(--orange)" />
          </div>

          <h1 style={{ fontFamily:'var(--display)', fontSize:'clamp(38px,5.8vw,76px)', lineHeight:1.06, color:'#fff', maxWidth:840, marginBottom:24 }}>
            {content.hero.title.includes('nunca para') ? (
              <>Sua operação<br /><em style={{ fontStyle:'italic', color:'var(--orange)' }}>nunca para.</em><br />Nós garantimos isso.</>
            ) : content.hero.title}
          </h1>

          <p style={{ fontSize:'clamp(16px,1.9vw,20px)', color:'rgba(255,255,255,.7)', maxWidth:620, lineHeight:1.8, marginBottom:42 }}>
            {content.hero.subtitle}
          </p>

          <div className="hero-ctas" style={{ display:'flex', flexWrap:'wrap', gap:14, alignItems:'center' }}>
            <button onClick={() => setShowLeadModal(true)} className="btn-orange" style={{ padding:'16px 32px', fontSize:16 }}>
              <Calendar size={18} /> {content.hero.ctaText}
            </button>
            <a href="#servicos" className="btn-outline-w" style={{ padding:'14px 28px', fontSize:15 }}>
              Conheça o Ciclo de Vida MGR <ArrowRight size={16} />
            </a>
          </div>

          <div style={{ marginTop:56, display:'flex', alignItems:'center', gap:12, opacity:.4 }}>
            <div style={{ width:32, height:1, background:'rgba(255,255,255,.5)' }} />
            <span style={{ fontSize:11, color:'rgba(255,255,255,.5)', letterSpacing:'1.5px', textTransform:'uppercase' }}>Role para explorar</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════ TRUST BAR ═══════════════════ */}
      <div id="mgr-sec-stats" style={{ background:'var(--blue)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 120% at 0% 50%,rgba(255,255,255,.04),transparent 60%)' }} />
        <div className="trust-grid" style={{ position:'relative', zIndex:1, maxWidth:1280, margin:'0 auto', padding:'0 24px', display:'grid', gridTemplateColumns:'repeat(4,1fr)' }}>
          {[
            { icon:<Award size={20} strokeWidth={1.8}/>, val:'+20 anos de campo', lbl:'Especialistas com história', href: null },
            { icon:<Clock size={20} strokeWidth={1.8}/>, val:'Resposta 24/7', lbl:'Atendimento de emergência', href: null },
            { icon:<Shield size={20} strokeWidth={1.8}/>, val:'Zero Downtime', lbl:'Continuidade operacional', href: null },
            { icon:<Phone size={20} strokeWidth={1.8}/>, val:content.contact.phone, lbl:'Ligue agora — sem espera', href:`tel:${content.contact.phone}` },
          ].map((b,i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:14, padding:'22px 20px', borderRight: i<3 ? '1px solid rgba(255,255,255,.1)' : 'none' }}>
              <div style={{ width:42, height:42, borderRadius:10, background:'rgba(255,255,255,.1)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, color:'rgba(255,255,255,.9)' }}>{b.icon}</div>
              <div>
                {b.href ? <a href={b.href} style={{ textDecoration:'none', display:'block', fontWeight:700, fontSize:14, color:'#fff', lineHeight:1.2 }}>{b.val}<span style={{ display:'block', fontSize:11, color:'rgba(255,255,255,.55)', fontWeight:400 }}>{b.lbl}</span></a>
                  : <><span style={{ display:'block', fontWeight:700, fontSize:14, color:'#fff', lineHeight:1.2 }}>{b.val}</span><span style={{ fontSize:11, color:'rgba(255,255,255,.55)' }}>{b.lbl}</span></>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════ PAIN POINTS ═══════════════════ */}
      <section id="mgr-sec-pain" ref={secPain.ref} style={{ padding:'96px 24px', background:'#fff' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ textAlign:'center', maxWidth:720, margin:'0 auto 56px', ...fadeIn(secPain.visible) }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'#FEF3C7', color:'#92400E', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>
              <AlertTriangle size={13}/> A realidade do gestor industrial
            </div>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'var(--text)', lineHeight:1.15, marginBottom:0 }}>{pp.headline}</h2>
          </div>
          <div className="pain-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 }}>
            {(pp.items || []).map((item, i) => (
              <div key={i} style={{ ...fadeIn(secPain.visible, `${i*0.15}s`), background:'var(--gray-ice)', borderRadius:20, padding:36, border:'1px solid var(--border)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,var(--orange),var(--blue))' }} />
                <div style={{ width:52, height:52, borderRadius:14, background:'rgba(212,121,42,.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, color:'var(--orange)' }}>
                  {getIcon(item.icon || 'AlertTriangle', 'w-6 h-6')}
                </div>
                <div style={{ fontFamily:'var(--display)', fontSize:36, color:'var(--blue)', fontWeight:700, lineHeight:1, marginBottom:12 }}>{item.stat || '—'}</div>
                <p style={{ color:'var(--muted)', lineHeight:1.7, fontSize:15 }}>{item.description || ''}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ SERVIÇOS / CICLO DE VIDA ═══════════════════ */}
      <section id="mgr-sec-services" ref={secServices.ref} style={{ padding:'96px 24px', background:'var(--gray-ice)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 56px', ...fadeIn(secServices.visible) }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(27,94,138,.08)', color:'var(--blue)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>
              Ciclo de Vida Completo
            </div>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'var(--text)', lineHeight:1.15, marginBottom:16 }}>{content.services.title}</h2>
            <div style={{ height:3, width:56, background:'var(--orange)', borderRadius:4, margin:'0 auto' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))', gap:20 }}>
            {content.services.items.map((svc, i) => (
              <div key={i} className="service-card" style={{ ...fadeIn(secServices.visible, `${i*0.1}s`), background:'#fff', borderRadius:20, padding:32, border:'1px solid var(--border)', transition:'.3s', cursor:'default' }}>
                <div className="svc-icon" style={{ width:56, height:56, borderRadius:14, background:'rgba(27,94,138,.08)', color:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:24, transition:'.3s' }}>
                  {getIcon(svc.icon, 'w-7 h-7')}
                </div>
                <h3 style={{ fontWeight:700, fontSize:17, color:'var(--text)', marginBottom:10 }}>{svc.title}</h3>
                <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.7 }}>{svc.description}</p>
                <div style={{ marginTop:20, display:'flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color:'var(--orange)', cursor:'pointer' }}>
                  Saiba mais <ChevronRight size={14}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ PLANO 3 PASSOS ═══════════════════ */}
      <section id="mgr-sec-plan" ref={secPlan.ref} style={{ padding:'96px 24px', background:'#fff' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ textAlign:'center', marginBottom:64, ...fadeIn(secPlan.visible) }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(27,94,138,.08)', color:'var(--blue)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>
              Como funciona
            </div>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'var(--text)', lineHeight:1.15 }}>{pl.headline}</h2>
          </div>
          <div className="steps-row" style={{ display:'flex', gap:32, justifyContent:'center', position:'relative', marginBottom:56 }}>
            {pl.steps.map((step, i) => (
              <div key={i} className={i < pl.steps.length-1 ? 'step-line' : ''} style={{ ...fadeIn(secPlan.visible, `${i*0.2}s`), flex:1, textAlign:'center', position:'relative', maxWidth:280 }}>
                <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--orange)', color:'#fff', fontWeight:800, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', position:'relative', zIndex:1 }}>{step.number}</div>
                <h3 style={{ fontWeight:700, fontSize:18, color:'var(--text)', marginBottom:10 }}>{step.title}</h3>
                <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.7 }}>{step.description}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center', ...fadeIn(secPlan.visible, '.6s') }}>
            <button onClick={() => setShowLeadModal(true)} className="btn-orange" style={{ padding:'18px 40px', fontSize:16 }}>
              {pl.ctaText} <ArrowRight size={18}/>
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PROVA SOCIAL ═══════════════════ */}
      <section id="mgr-sec-testimonial" ref={secStats.ref} style={{ padding:'96px 24px', background:'var(--blue)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 80% at 80% 50%,rgba(212,121,42,.08),transparent)' }} />
        <div style={{ maxWidth:1280, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 64px' }}>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'#fff', lineHeight:1.15 }}>
              Mais de duas décadas protegendo<br/>operações que não podem parar
            </h2>
          </div>

          {/* Stats countUp */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24, marginBottom:64 }}>
            {content.stats.map((s, i) => {
              const StatItem = () => {
                const display = useCountUp(s.value, secStats.visible);
                return (
                  <div key={i} style={{ textAlign:'center', padding:'32px 16px', background:'rgba(255,255,255,.06)', borderRadius:16, border:'1px solid rgba(255,255,255,.1)' }}>
                    <div style={{ fontFamily:'var(--display)', fontSize:'clamp(36px,4vw,56px)', color:'var(--orange)', lineHeight:1, marginBottom:8 }}>{display}</div>
                    <div style={{ fontSize:14, color:'rgba(255,255,255,.65)' }}>{s.label}</div>
                  </div>
                );
              };
              return <StatItem key={i} />;
            })}
          </div>

          {/* Depoimento */}
          <div style={{ maxWidth:740, margin:'0 auto', background:'rgba(255,255,255,.07)', border:'1px solid rgba(255,255,255,.12)', borderRadius:24, padding:48, backdropFilter:'blur(8px)' }}>
            <div style={{ fontSize:52, color:'var(--orange)', lineHeight:1, marginBottom:16, fontFamily:'Georgia,serif' }}>"</div>
            <p style={{ fontSize:'clamp(16px,2vw,20px)', color:'rgba(255,255,255,.9)', lineHeight:1.75, fontStyle:'italic', marginBottom:32 }}>{tm.quote}</p>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div style={{ width:52, height:52, borderRadius:'50%', background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {tm.photoUrl ? <img src={tm.photoUrl} alt={tm.name} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }}/> : <Users size={22} color="rgba(255,255,255,.6)"/>}
              </div>
              <div>
                <div style={{ fontWeight:700, color:'#fff', fontSize:15 }}>{tm.name}</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>{tm.role} — {tm.company}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ PARCEIROS (marquee) ═══════════════════ */}
      <section id="mgr-sec-clients" style={{ padding:'64px 0', background:'#fff', borderTop:'1px solid var(--border)', overflow:'hidden' }}>
        <div style={{ textAlign:'center', marginBottom:40, padding:'0 24px' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(27,94,138,.08)', color:'var(--blue)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:16 }}>Quem confia na MGR</div>
          <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(22px,2.5vw,32px)', color:'var(--text)' }}>{content.clients?.title}</h2>
          <p style={{ color:'var(--muted)', marginTop:8 }}>{content.clients?.description}</p>
        </div>
        <div style={{ position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:'0 0 0', background:'linear-gradient(90deg,#fff 0%,transparent 10%,transparent 90%,#fff 100%)', zIndex:2, pointerEvents:'none' }} />
          <div style={{ display:'flex', gap:48, width:'max-content' }}>
            <div className="marquee-wrap" style={{ display:'flex', gap:48, alignItems:'center', minWidth:'100%', justifyContent:'space-around' }}>
              {(loopPartners.length === 0 ? [{ id:'1', name:'Sem parceiros', logoUrl:'' }] : loopPartners).map((p, i) => (
                <div key={`${p.id}-${i}`} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, width:140, flexShrink:0 }}>
                  <div style={{ height:72, width:140, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {p.logoUrl ? <img src={p.logoUrl} alt={p.name} style={{ maxHeight:'100%', maxWidth:'100%', objectFit:'contain' }}/> : <div style={{ background:'rgba(27,94,138,.06)', borderRadius:12, width:'100%', height:56, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid var(--border)' }}><Factory className="w-5 h-5" color="rgba(27,94,138,.3)"/></div>}
                  </div>
                  <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px' }}>{p.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ STAKES ═══════════════════ */}
      <section id="mgr-sec-stakes" ref={secStakes.ref} style={{ padding:'96px 24px', background:'var(--navy)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 50% 80% at 20% 50%,rgba(27,94,138,.2),transparent 60%)' }} />
        <div style={{ maxWidth:1280, margin:'0 auto', position:'relative', zIndex:1 }}>
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 64px', ...fadeIn(secStakes.visible) }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(239,68,68,.15)', color:'#FCA5A5', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>
              <AlertTriangle size={13}/> Risco real
            </div>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'#fff', lineHeight:1.15 }}>{st.headline}</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:24, marginBottom:64 }}>
            {st.items.map((item, i) => (
              <div key={i} style={{ ...fadeIn(secStakes.visible, `${i*0.15}s`), background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20, padding:36, position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:'linear-gradient(90deg,#EF4444,#DC2626)' }} />
                <div style={{ width:52, height:52, borderRadius:14, background:'rgba(239,68,68,.15)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, color:'#FCA5A5' }}>
                  {getIcon(item.icon, 'w-6 h-6')}
                </div>
                <h3 style={{ fontWeight:700, fontSize:18, color:'#fff', marginBottom:10 }}>{item.title}</h3>
                <p style={{ color:'rgba(255,255,255,.6)', lineHeight:1.7, fontSize:14 }}>{item.description}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:'center', maxWidth:680, margin:'0 auto', ...fadeIn(secStakes.visible, '.45s') }}>
            <p style={{ fontSize:'clamp(16px,2vw,20px)', color:'rgba(255,255,255,.75)', lineHeight:1.7, fontStyle:'italic', marginBottom:32 }}>{st.transition}</p>
            <button onClick={() => setShowLeadModal(true)} className="btn-orange" style={{ padding:'16px 36px', fontSize:16 }}>
              <Calendar size={18}/> Agendar Visita de Valor
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════ MGR CONNECT ═══════════════════ */}
      <section id="mgr-sec-connect" ref={secConnect.ref} style={{ padding:'96px 24px', background:'var(--gray-ice)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div className="connect-layout" style={{ display:'flex', alignItems:'center', gap:64 }}>
            {/* Visual side */}
            <div style={{ ...fadeIn(secConnect.visible), flex:'0 0 55%', maxWidth:'55%' }}>
              {mc.imageUrl ? <img src={mc.imageUrl} alt="MGR Connect Dashboard" style={{ width:'100%', borderRadius:24, boxShadow:'0 24px 64px rgba(27,94,138,.2)' }}/> : (
                <div style={{ width:'100%', aspectRatio:'16/10', borderRadius:24, background:'linear-gradient(135deg,var(--navy),var(--blue))', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', boxShadow:'0 24px 64px rgba(27,94,138,.25)', position:'relative', overflow:'hidden', padding:40 }}>
                  <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px)', backgroundSize:'40px 40px' }} />
                  <Monitor size={64} color="rgba(255,255,255,.25)" style={{ marginBottom:20 }}/>
                  <div style={{ background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.15)', borderRadius:16, padding:'20px 28px', textAlign:'center', backdropFilter:'blur(8px)' }}>
                    <div style={{ fontFamily:'var(--display)', fontSize:32, color:'var(--orange)' }}>98.6%</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,.6)', marginTop:4 }}>Disponibilidade operacional média</div>
                  </div>
                </div>
              )}
            </div>
            {/* Text side */}
            <div style={{ ...fadeIn(secConnect.visible, '.2s'), flex:1 }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(27,94,138,.08)', color:'var(--blue)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>
                <Wifi size={13}/> Tecnologia MGR
              </div>
              <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(26px,3vw,40px)', color:'var(--text)', lineHeight:1.2, marginBottom:16 }}>{mc.headline}</h2>
              <p style={{ color:'var(--muted)', lineHeight:1.8, fontSize:16, marginBottom:32 }}>{mc.description}</p>
              <ul style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:36 }}>
                {mc.features.map((f, i) => (
                  <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(212,121,42,.12)', color:'var(--orange)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                      <CheckCircle2 size={14}/>
                    </div>
                    <span style={{ color:'var(--text)', fontWeight:500, fontSize:15, lineHeight:1.5 }}>{f}</span>
                  </li>
                ))}
              </ul>
              <button onClick={() => setShowLeadModal(true)} className="btn-blue" style={{ padding:'14px 28px', fontSize:15 }}>
                {mc.ctaText} <ArrowRight size={16}/>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════ LEAD MAGNET ═══════════════════ */}
      <div id="mgr-sec-leadmagnet" style={{ background:'var(--orange)', padding:'48px 24px', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 120% at 100% 50%,rgba(255,255,255,.08),transparent)' }} />
        <div style={{ maxWidth:1280, margin:'0 auto', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:24, position:'relative', zIndex:1 }}>
          <div style={{ flex:1, minWidth:280 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <FileText size={16} color="rgba(255,255,255,.9)"/>
              <span style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,.85)', textTransform:'uppercase', letterSpacing:'.7px' }}>Guia Gratuito</span>
            </div>
            <h3 style={{ fontFamily:'var(--display)', fontSize:'clamp(22px,2.5vw,30px)', color:'#fff', lineHeight:1.2, marginBottom:8 }}>{lm.headline}</h3>
            <p style={{ color:'rgba(255,255,255,.8)', fontSize:14 }}>{lm.description}</p>
          </div>
          <button onClick={() => setShowLeadMagnet(true)} style={{ display:'flex', alignItems:'center', gap:10, background:'#fff', color:'var(--orange)', fontWeight:700, fontSize:15, padding:'16px 32px', borderRadius:10, border:'none', cursor:'pointer', transition:'.2s', flexShrink:0 }}>
            <Download size={18}/> {lm.ctaText}
          </button>
        </div>
      </div>

      {/* ═══════════════════ SEGMENTAÇÃO ═══════════════════ */}
      <section id="mgr-sec-setores" ref={secSegments.ref} style={{ padding:'96px 24px', background:'#fff' }}>
        <div style={{ maxWidth:1280, margin:'0 auto' }}>
          <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 56px', ...fadeIn(secSegments.visible) }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(27,94,138,.08)', color:'var(--blue)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>Setores Atendidos</div>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'var(--text)', lineHeight:1.15 }}>{sg.headline}</h2>
          </div>
          <div className="segment-grid" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24 }}>
            {sg.items.map((seg, i) => (
              <div key={i} className="segment-card" style={{ ...fadeIn(secSegments.visible, `${i*0.1}s`), borderRadius:20, overflow:'hidden', border:'1px solid var(--border)', transition:'.35s', cursor:'default', position:'relative' }}>
                <div style={{ height:180, background: seg.imageUrl ? `url(${seg.imageUrl}) center/cover` : 'linear-gradient(135deg,var(--navy),var(--blue))', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                  {!seg.imageUrl && <div style={{ color:'rgba(255,255,255,.3)' }}>{getIcon(seg.icon, 'w-12 h-12')}</div>}
                  <div style={{ position:'absolute', inset:0, background:'rgba(15,23,42,.35)' }} />
                  <div style={{ position:'absolute', bottom:16, left:16, color:'rgba(255,255,255,.9)', display:'flex', alignItems:'center', gap:8, zIndex:1 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:'rgba(255,255,255,.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>{getIcon(seg.icon, 'w-5 h-5')}</div>
                    <span style={{ fontWeight:700, fontSize:16 }}>{seg.title}</span>
                  </div>
                </div>
                <div style={{ padding:'20px 24px 24px', background:'#fff' }}>
                  <p style={{ color:'var(--muted)', fontSize:14, lineHeight:1.7 }}>{seg.description}</p>
                  <a href="#contato" style={{ display:'inline-flex', alignItems:'center', gap:6, marginTop:16, fontSize:13, fontWeight:600, color:'var(--blue)', textDecoration:'none' }}>
                    Saiba mais <ChevronRight size={13}/>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════ GALERIA ═══════════════════ */}
      {galleryItems.length > 0 && (
        <section id="mgr-sec-gallery" style={{ padding:'96px 24px', background:'var(--navy)' }}>
          <div style={{ maxWidth:1280, margin:'0 auto' }}>
            <div style={{ textAlign:'center', maxWidth:640, margin:'0 auto 56px' }}>
              <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(255,255,255,.08)', color:'rgba(255,255,255,.7)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', border:'1px solid rgba(255,255,255,.1)', marginBottom:20 }}>
                <Camera size={13}/> Portfólio
              </div>
              <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3.5vw,44px)', color:'#fff', lineHeight:1.15 }}>{content.gallery?.title}</h2>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:24 }}>
              {galleryItems.map((item) => (
                <div key={item.id} onClick={() => setGalleryModal(item)} style={{ borderRadius:20, overflow:'hidden', cursor:'pointer', position:'relative', aspectRatio:'4/3' }}>
                  <img src={item.imageUrl} alt={item.title} style={{ width:'100%', height:'100%', objectFit:'cover', transition:'.6s' }}/>
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(15,23,42,.9) 0%,transparent 60%)', transition:'.3s' }}/>
                  <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:24 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:'var(--orange)', marginBottom:4, textTransform:'uppercase' }}><Calendar size={11}/>{item.date}</div>
                    <h3 style={{ fontWeight:700, fontSize:16, color:'#fff', marginBottom:4 }}>{item.title}</h3>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,.65)' }}>{item.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════ SOBRE ═══════════════════ */}
      <section id="mgr-sec-about" style={{ padding:'96px 24px', background:'var(--gray-ice)' }}>
        <div style={{ maxWidth:1280, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:80, alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            {content.about.imageUrl ? <img src={content.about.imageUrl} alt="Sobre a MGR" style={{ width:'100%', borderRadius:24, boxShadow:'0 24px 64px rgba(27,94,138,.2)', objectFit:'cover', height:500 }}/> : (
              <div style={{ width:'100%', height:500, borderRadius:24, background:'linear-gradient(135deg,var(--blue),var(--blue-dark))', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 24px 64px rgba(27,94,138,.25)', flexDirection:'column', gap:16 }}>
                <Snowflake size={72} color="rgba(255,255,255,.2)"/>
                <span style={{ fontSize:14, color:'rgba(255,255,255,.5)', fontWeight:500 }}>Engenharia de Frio Industrial</span>
              </div>
            )}
          </div>
          <div>
            <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'5px 14px', borderRadius:100, background:'rgba(27,94,138,.08)', color:'var(--blue)', fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>Sobre a MGR</div>
            <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(28px,3vw,40px)', color:'var(--text)', lineHeight:1.2, marginBottom:20 }}>{content.about.title}</h2>
            <p style={{ color:'var(--muted)', lineHeight:1.8, fontSize:16, marginBottom:24 }}>{content.about.description}</p>
            {content.about.manifesto && (
              <div style={{ borderLeft:'4px solid var(--orange)', paddingLeft:20, marginBottom:32, background:'#fff', borderRadius:'0 12px 12px 0', padding:'20px 20px 20px 24px', boxShadow:'0 2px 12px rgba(0,0,0,.04)' }}>
                <p style={{ color:'var(--text)', fontStyle:'italic', lineHeight:1.7, fontWeight:500 }}>"{content.about.manifesto}"</p>
              </div>
            )}
            <ul style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {(content.about.differentials||[]).map((d, i) => (
                <li key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ width:24, height:24, borderRadius:'50%', background:'rgba(212,121,42,.1)', color:'var(--orange)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><CheckCircle2 size={14}/></div>
                  <span style={{ color:'var(--text)', fontWeight:500, fontSize:15 }}>{d}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════════════════ CTA FINAL ═══════════════════ */}
      <section style={{ padding:'96px 24px', background:'linear-gradient(135deg,var(--navy) 0%,var(--blue) 100%)', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />
        <div style={{ maxWidth:800, margin:'0 auto', textAlign:'center', position:'relative', zIndex:1 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 16px', borderRadius:100, background:'rgba(255,255,255,.1)', color:'rgba(255,255,255,.85)', fontSize:12, fontWeight:700, border:'1px solid rgba(255,255,255,.15)', marginBottom:28 }}>
            <Snowflake size={14} color="var(--orange)"/> Não espere a próxima parada
          </div>
          <h2 style={{ fontFamily:'var(--display)', fontSize:'clamp(30px,4vw,52px)', color:'#fff', lineHeight:1.1, marginBottom:20 }}>
            Agende sua Visita de Valor hoje.
          </h2>
          <p style={{ fontSize:18, color:'rgba(255,255,255,.65)', marginBottom:48, lineHeight:1.7 }}>
            Diagnóstico completo, Relatório de Saúde e plano de continuidade — sem compromisso.
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:16, justifyContent:'center' }}>
            <button onClick={() => setShowLeadModal(true)} className="btn-orange" style={{ padding:'18px 40px', fontSize:17 }}>
              <Calendar size={20}/> Agendar Visita de Valor
            </button>
            <a href={`https://wa.me/${content.contact.whatsapp}`} target="_blank" rel="noopener noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:10, padding:'18px 36px', background:'#22C55E', color:'#fff', fontWeight:700, fontSize:17, borderRadius:10, textDecoration:'none', transition:'.2s' }}>
              <MessageCircle size={20}/> Falar no WhatsApp
            </a>
          </div>
          <p style={{ marginTop:28, fontSize:13, color:'rgba(255,255,255,.5)' }}>Atendemos Indaiatuba e região · Resposta em até 2 horas úteis</p>
        </div>
      </section>

      {/* ═══════════════════ FOOTER ═══════════════════ */}
      <footer id="mgr-sec-contact" style={{ background:'#070D1A', paddingTop:80, paddingBottom:40 }}>
        <div style={{ maxWidth:1280, margin:'0 auto', padding:'0 24px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:48, marginBottom:64 }}>
            {/* Col 1 */}
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
                <div style={{ width:44, height:44, borderRadius:10, background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center' }}><Snowflake size={22} color="#fff"/></div>
                <div><span style={{ display:'block', fontWeight:700, fontSize:17, color:'#fff' }}>MGR Refrigeração</span><span style={{ fontSize:10, color:'#4B5563', letterSpacing:'.7px', textTransform:'uppercase' }}>Soluções e Tecnologia</span></div>
              </div>
              <p style={{ color:'#6B7280', fontSize:14, lineHeight:1.8, maxWidth:280 }}>Engenharia de frio industrial do projeto à operação contínua.</p>
              <div style={{ display:'flex', gap:10, marginTop:24 }}>
                {content.contact.instagram && <a href={`https://instagram.com/${content.contact.instagram.replace('@','')}`} target="_blank" rel="noopener noreferrer" style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #1F2937', color:'#6B7280', transition:'.2s', textDecoration:'none' }}><Instagram size={17}/></a>}
                <a href={`https://wa.me/${content.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', border:'1px solid #1F2937', color:'#6B7280', transition:'.2s', textDecoration:'none' }}><MessageCircle size={17}/></a>
              </div>
            </div>
            {/* Col 2 — Serviços */}
            <div>
              <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>Serviços</h4>
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
                {content.services.items.map((s,i) => <li key={i}><a href="#servicos" style={{ color:'#6B7280', textDecoration:'none', fontSize:14, transition:'.2s' }}>{s.title}</a></li>)}
              </ul>
            </div>
            {/* Col 3 — Setores */}
            <div>
              <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>Setores</h4>
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:10 }}>
                {sg.items.map((s,i) => <li key={i}><a href="#setores" style={{ color:'#6B7280', textDecoration:'none', fontSize:14 }}>{s.title}</a></li>)}
              </ul>
            </div>
            {/* Col 4 — Contato + Form */}
            <div>
              <h4 style={{ fontWeight:700, color:'#fff', fontSize:14, textTransform:'uppercase', letterSpacing:'.7px', marginBottom:20 }}>Contato</h4>
              <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:14 }}>
                <li style={{ display:'flex', gap:10, alignItems:'flex-start' }}><MapPin size={16} color="var(--orange)" style={{ flexShrink:0, marginTop:2 }}/><span style={{ color:'#6B7280', fontSize:14 }}>{content.contact.address}</span></li>
                <li><a href={`tel:${content.contact.phone}`} style={{ display:'flex', gap:10, alignItems:'center', color:'#6B7280', textDecoration:'none', fontSize:14 }}><Phone size={16} color="var(--orange)"/>{content.contact.phone}</a></li>
                <li><a href={`mailto:${content.contact.email}`} style={{ display:'flex', gap:10, alignItems:'center', color:'#6B7280', textDecoration:'none', fontSize:14 }}><Mail size={16} color="var(--orange)"/>{content.contact.email}</a></li>
              </ul>
            </div>
          </div>

          {/* Contact Form */}
          {content.features.contactForm && (
            <div style={{ background:'#0F172A', borderRadius:24, padding:40, marginBottom:48, border:'1px solid #1F2937' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:40, alignItems:'start' }}>
                <div>
                  <h3 style={{ fontFamily:'var(--display)', fontSize:'clamp(22px,2.5vw,30px)', color:'#fff', marginBottom:12 }}>Fale Conosco</h3>
                  <p style={{ color:'#6B7280', fontSize:14, lineHeight:1.7 }}>Nossa equipe técnica retorna em até 24 horas úteis com uma análise inicial da sua necessidade.</p>
                </div>
                <form onSubmit={handleContactSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <input type="text" required value={formName} onChange={e=>setFormName(e.target.value)} placeholder="Nome / Empresa" style={{ background:'#1F2937', border:'1px solid #374151', borderRadius:10, padding:'12px 16px', color:'#fff', fontSize:14, outline:'none' }}/>
                  <input type="email" required value={formEmail} onChange={e=>setFormEmail(e.target.value)} placeholder="E-mail" style={{ background:'#1F2937', border:'1px solid #374151', borderRadius:10, padding:'12px 16px', color:'#fff', fontSize:14, outline:'none' }}/>
                  <textarea rows={3} required value={formMessage} onChange={e=>setFormMessage(e.target.value)} placeholder="Descreva sua necessidade..." style={{ background:'#1F2937', border:'1px solid #374151', borderRadius:10, padding:'12px 16px', color:'#fff', fontSize:14, outline:'none', resize:'none' }}/>
                  <button type="submit" disabled={formStatus==='sending'} className="btn-orange" style={{ padding:'13px 24px', fontSize:15, justifyContent:'center' }}>
                    {formStatus==='sending' ? 'Enviando...' : <><Send size={16}/> Enviar Mensagem</>}
                  </button>
                  {formStatus==='success' && <div style={{ padding:'10px 16px', background:'rgba(5,150,105,.15)', border:'1px solid rgba(5,150,105,.3)', borderRadius:10, color:'#6EE7B7', fontSize:13, textAlign:'center' }}>✅ Mensagem enviada! Retornaremos em breve.</div>}
                  {formStatus==='error' && <div style={{ padding:'10px 16px', background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.3)', borderRadius:10, color:'#FCA5A5', fontSize:13, textAlign:'center' }}>Erro ao enviar. Use o WhatsApp.</div>}
                </form>
              </div>
            </div>
          )}

          <div style={{ borderTop:'1px solid #1F2937', paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
            <p style={{ color:'#374151', fontSize:13 }}>© {new Date().getFullYear()} MGR Soluções e Tecnologia da Refrigeração. Todos os direitos reservados.</p>
            <p style={{ fontSize:13, fontWeight:700, color:'var(--orange)' }}>Engenharia de Frio como Ativo Estratégico</p>
          </div>
        </div>
      </footer>

      {/* ═══════════════════ MODAL: LEAD RÁPIDO ═══════════════════ */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLeadModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div style={{ background:'linear-gradient(135deg,var(--navy),var(--blue))', padding:'24px', position:'relative' }}>
              <button onClick={() => setShowLeadModal(false)} style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><X size={18}/></button>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}><Snowflake size={18} color="var(--orange)"/><span style={{ fontSize:12, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px', color:'rgba(255,255,255,.7)' }}>MGR Refrigeração</span></div>
              <h3 style={{ fontFamily:'var(--display)', fontSize:24, color:'#fff', marginBottom:4 }}>Agendar Visita de Valor</h3>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.6)' }}>Nossa equipe retorna em até 2 horas úteis.</p>
            </div>
            <div style={{ padding:24 }}>
              {leadSent ? (
                <div style={{ textAlign:'center', padding:'32px 0' }}>
                  <div style={{ width:64, height:64, borderRadius:'50%', background:'#ECFDF5', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}><CheckCircle2 className="w-8 h-8" color="#059669"/></div>
                  <h4 style={{ fontWeight:700, fontSize:20, color:'var(--text)', marginBottom:8 }}>Recebemos seu contato!</h4>
                  <p style={{ color:'var(--muted)' }}>Nossa equipe técnica entrará em contato em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadRapido} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div><label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:4 }}>Nome / Empresa *</label><input type="text" required value={leadNome} onChange={e=>setLeadNome(e.target.value)} placeholder="Seu nome ou empresa" style={{ width:'100%', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', background:'var(--gray-ice)', boxSizing:'border-box' }}/></div>
                  <div><label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:4 }}>WhatsApp / Telefone *</label><input type="tel" required value={leadTelefone} onChange={e=>setLeadTelefone(e.target.value)} placeholder="(19) 9 0000-0000" style={{ width:'100%', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', background:'var(--gray-ice)', boxSizing:'border-box' }}/></div>
                  <div><label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:4 }}>O que você precisa?</label>
                    <select value={leadTipo} onChange={e=>setLeadTipo(e.target.value)} style={{ width:'100%', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', background:'var(--gray-ice)', boxSizing:'border-box' }}>
                      <option value="">Selecione (opcional)</option>
                      <option value="camara_fria">Câmara Fria / Frigorífico</option>
                      <option value="tunel_congelamento">Túnel de Congelamento</option>
                      <option value="girofreezer">Girofreezer</option>
                      <option value="climatizacao">Climatização Industrial</option>
                      <option value="manutencao">Manutenção Preventiva/Corretiva</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  <button type="submit" disabled={leadSending} className="btn-orange" style={{ padding:'15px 24px', fontSize:15, justifyContent:'center' }}>
                    {leadSending ? <><span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin 1s linear infinite' }}/> Enviando...</> : <><Send size={17}/> Quero ser Atendido</>}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ MODAL: LEAD MAGNET ═══════════════════ */}
      {showLeadMagnet && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowLeadMagnet(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div style={{ background:'linear-gradient(135deg,var(--orange),var(--orange-dark))', padding:'24px', position:'relative' }}>
              <button onClick={() => setShowLeadMagnet(false)} style={{ position:'absolute', top:16, right:16, width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,.15)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><X size={18}/></button>
              <FileText size={28} color="rgba(255,255,255,.9)" style={{ marginBottom:12 }}/>
              <h3 style={{ fontFamily:'var(--display)', fontSize:22, color:'#fff', marginBottom:4 }}>Guia Gratuito MGR</h3>
              <p style={{ fontSize:13, color:'rgba(255,255,255,.75)' }}>{lm.headline}</p>
            </div>
            <div style={{ padding:24 }}>
              {lmSent ? (
                <div style={{ textAlign:'center', padding:'24px 0' }}>
                  <CheckCircle2 size={48} color="#059669" style={{ margin:'0 auto 16px' }}/>
                  <h4 style={{ fontWeight:700, fontSize:18, color:'var(--text)', marginBottom:8 }}>Guia enviado!</h4>
                  <p style={{ color:'var(--muted)', fontSize:14 }}>Nossa equipe enviará o material ao seu e-mail em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadMagnet} style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  <div><label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:4 }}>Seu Nome</label><input type="text" required value={lmName} onChange={e=>setLmName(e.target.value)} placeholder="Nome completo" style={{ width:'100%', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', background:'var(--gray-ice)', boxSizing:'border-box' }}/></div>
                  <div><label style={{ fontSize:12, fontWeight:700, color:'var(--muted)', display:'block', marginBottom:4 }}>E-mail</label><input type="email" required value={lmEmail} onChange={e=>setLmEmail(e.target.value)} placeholder="email@empresa.com.br" style={{ width:'100%', border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px', fontSize:14, outline:'none', background:'var(--gray-ice)', boxSizing:'border-box' }}/></div>
                  <button type="submit" className="btn-orange" style={{ padding:'14px 24px', fontSize:15, justifyContent:'center' }}>
                    <Download size={17}/> Receber o Guia Gratuito
                  </button>
                  <p style={{ fontSize:11, color:'var(--muted)', textAlign:'center' }}>Sem spam. Apenas conteúdo técnico relevante.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════ MODAL: GALERIA ═══════════════════ */}
      {galleryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setGalleryModal(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setGalleryModal(null)} style={{ position:'absolute', top:-48, right:0, width:40, height:40, borderRadius:'50%', background:'rgba(255,255,255,.1)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><X size={22}/></button>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <img src={galleryModal.imageUrl} alt={galleryModal.title} className="w-full max-h-[60vh] object-cover"/>
              <div style={{ padding:24 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, fontWeight:700, color:'var(--orange)', marginBottom:8, textTransform:'uppercase' }}><Calendar size={11}/>{galleryModal.date}</div>
                <h3 style={{ fontWeight:700, fontSize:20, color:'var(--text)', marginBottom:8 }}>{galleryModal.title}</h3>
                <p style={{ color:'var(--muted)', lineHeight:1.7 }}>{galleryModal.caption}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;

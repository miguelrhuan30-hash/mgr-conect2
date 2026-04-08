import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, onSnapshot, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, LandingPageContent, GalleryItem } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Phone, Mail, MapPin, Instagram, LogIn, Edit, X,
  Snowflake, Wrench, Thermometer, Fan, CheckCircle2, ArrowRight, ShieldCheck, Send,
  MessageCircle, Factory, QrCode, Camera, Calendar, ChevronLeft, ChevronRight
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════
   DADOS DEFAULT — Brand Guide MGR v1.0 (Abril 2026)
   Tom de voz: técnico-acessível, direto, confiável
   Vocabulário: continuidade, parceiro de operação, ciclo de vida
   ══════════════════════════════════════════════════════════════════ */
const MGR_REAL_DATA: LandingPageContent = {
  hero: {
    title: "Sua operação nunca para.",
    subtitle: "Refrigeração industrial é o sistema nervoso invisível do seu negócio. Quando funciona, ninguém percebe. Quando falha, tudo para. A MGR existe para garantir que isso nunca aconteça.",
    backgroundImageUrl: "",
    ctaText: "Solicitar Consultoria Gratuita",
    ctaLink: "#contact"
  },
  stats: [
    { value: "+15", label: "Anos de Experiência" },
    { value: "+300", label: "Projetos Entregues" },
    { value: "+50", label: "Contratos Ativos" },
    { value: "24/7", label: "Suporte Emergencial" }
  ],
  services: {
    title: "Soluções de Engenharia do Frio",
    items: [
      {
        title: "Projetos Sob Medida",
        description: "Túneis de congelamento, câmaras frias e girofreezers projetados com memorial de cálculo para sua demanda industrial.",
        icon: "Factory"
      },
      {
        title: "Manutenção Zero Downtime",
        description: "Contratos preventivos e corretivos com SLA contratual. Análise de vibração, óleo e monitoramento contínuo.",
        icon: "Wrench"
      },
      {
        title: "Gestão Digital QR Code",
        description: "Etiquetas QR Code nos equipamentos para abertura de chamados e histórico digital completo via MGR Connect.",
        icon: "QrCode"
      },
      {
        title: "Climatização Industrial",
        description: "Instalação de sistemas centrais e projetos HVAC seguindo normas NR-10 e NR-18. Do projeto à operação.",
        icon: "Fan"
      }
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
  gallery: {
    title: "Projetos em Campo",
    description: "Cada projeto é uma operação que nunca mais vai parar.",
    items: []
  },
  about: {
    title: "Engenharia que Garante Continuidade",
    description: "A MGR nasceu com uma premissa: fazer refrigeração do jeito certo, do começo ao fim. Com mais de 15 anos de experiência em campo, unimos expertise técnica com tecnologia própria para oferecer o que nenhum outro fornecedor oferece — acompanhamento do ciclo de vida completo do seu sistema de refrigeração.",
    imageUrl: "",
    manifesto: "Não somos apenas técnicos que consertam equipamentos. Somos parceiros de operação que projetam, constroem, mantêm e monitoram com uma única obsessão: que o seu negócio funcione, sempre.",
    differentials: [
      "Equipe técnica certificada e frota própria",
      "Atendimento ágil em Indaiatuba e região",
      "Gestão digital de manutenção via MGR Connect",
      "SLA contratual com penalidades — compromisso real"
    ]
  },
  contact: {
    address: "Indaiatuba - SP e Região",
    phone: "(19) 3333-3333",
    email: "contato@mgrrefrigeracao.com.br",
    whatsapp: "5519999999999",
    instagram: "@mgrrefrigeracao"
  },
  features: {
    whatsappFloat: true,
    contactForm: true
  }
};

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile, currentUser } = useAuth();
  const [content, setContent] = useState<LandingPageContent>(MGR_REAL_DATA);
  const [loading, setLoading] = useState(true);

  // Contact Form State
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  // Modal Lead Rapido
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadNome, setLeadNome] = useState('');
  const [leadTelefone, setLeadTelefone] = useState('');
  const [leadTipo, setLeadTipo] = useState('');
  const [leadSending, setLeadSending] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  // Gallery Modal
  const [galleryModal, setGalleryModal] = useState<GalleryItem | null>(null);

  // Check permissions
  const canEdit = userProfile?.role === 'developer' || userProfile?.role === 'admin';

  useEffect(() => {
    const docRef = doc(db, CollectionName.SYSTEM_SETTINGS, 'landing_page');
    const unsub = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as any;

        // --- DATA MIGRATION LOGIC ---
        let partners = data.clients?.partners || [];
        if (data.clients?.logos && Array.isArray(data.clients.logos) && partners.length === 0) {
          partners = data.clients.logos.map((name: string, index: number) => ({
            id: `legacy-${index}`,
            name: name,
            logoUrl: ''
          }));
        }

        const safeData: LandingPageContent = {
          ...MGR_REAL_DATA,
          ...data,
          clients: {
            ...MGR_REAL_DATA.clients,
            ...data.clients,
            partners: partners
          },
          gallery: {
            ...MGR_REAL_DATA.gallery,
            ...data.gallery,
          },
          about: {
            ...MGR_REAL_DATA.about,
            ...data.about,
          }
        };

        setContent(safeData);
      } else {
        if (currentUser) {
          try {
            await setDoc(docRef, MGR_REAL_DATA);
          } catch (e) {
            // Ignore write errors for non-admins
          }
        }
        setContent(MGR_REAL_DATA);
      }
      setLoading(false);
    }, (error: any) => {
      if (error?.code !== 'permission-denied') {
        console.error("Error fetching landing page settings:", error);
      }
      setContent(MGR_REAL_DATA);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    try {
      await addDoc(collection(db, CollectionName.CONTACT_MESSAGES), {
        name: formName,
        email: formEmail,
        message: formMessage,
        createdAt: serverTimestamp(),
        status: 'new'
      });
      setFormStatus('success');
      setFormName('');
      setFormEmail('');
      setFormMessage('');
      setTimeout(() => setFormStatus('idle'), 5000);
    } catch (error) {
      console.error("Error sending message:", error);
      setFormStatus('error');
    }
  };

  const handleLeadRapido = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadNome.trim() || !leadTelefone.trim()) return;
    setLeadSending(true);
    try {
      await addDoc(collection(db, 'project_leads'), {
        nomeContato: leadNome.trim(),
        telefone: leadTelefone.trim(),
        tipoProjetoSlug: leadTipo || 'nao_definido',
        tipoProjetoTexto: leadTipo || 'Não definido',
        origem: 'formulario_site',
        status: 'novo',
        criadoEm: serverTimestamp(),
        userAgent: window.navigator.userAgent,
      });
      setLeadSent(true);
      setTimeout(() => {
        setShowLeadModal(false);
        setLeadSent(false);
        setLeadNome('');
        setLeadTelefone('');
        setLeadTipo('');
      }, 3000);
    } finally { setLeadSending(false); }
  };

  const getIcon = (iconName: string) => {
    const cls = "w-7 h-7";
    switch (iconName) {
      case 'Wrench': return <Wrench className={cls} />;
      case 'Thermometer': return <Thermometer className={cls} />;
      case 'Fan': return <Fan className={cls} />;
      case 'ShieldCheck': return <ShieldCheck className={cls} />;
      case 'Snowflake': return <Snowflake className={cls} />;
      case 'Factory': return <Factory className={cls} />;
      case 'QrCode': return <QrCode className={cls} />;
      default: return <CheckCircle2 className={cls} />;
    }
  };

  if (loading) return <div className="min-h-screen bg-white" />;

  const basePartners = content.clients?.partners || [];
  const loopPartners = basePartners.length > 0
    ? [...basePartners, ...basePartners, ...basePartners]
    : [];

  const galleryItems = (content.gallery?.items || []).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="min-h-screen bg-white font-sans text-mgr-grafite antialiased">

      {/* ── CSS Animations ── */}
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-100%); }
        }
        .animate-marquee {
          animation: marquee 40s linear infinite;
        }
        .paused {
          animation-play-state: paused;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s ease-out forwards;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212, 121, 42, 0.4); }
          50% { box-shadow: 0 0 0 12px rgba(212, 121, 42, 0); }
        }
      `}</style>

      {/* ── WhatsApp Float ── */}
      {content.features.whatsappFloat && (
        <a
          href={`https://wa.me/${content.contact.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 hover:scale-110 transition-all duration-300 flex items-center justify-center"
          style={{ animation: 'pulse-glow 2s infinite' }}
          title="Fale conosco no WhatsApp"
        >
          <MessageCircle className="w-7 h-7" fill="white" />
        </a>
      )}

      {/* ── Edit Button (Admin) ── */}
      {canEdit && (
        <button
          onClick={() => navigate('/editor-site')}
          className="fixed bottom-24 right-6 z-50 bg-accent-500 text-white p-3 rounded-full shadow-2xl hover:bg-accent-600 hover:scale-105 transition-all duration-300 flex items-center gap-2 font-bold text-sm"
        >
          <Edit className="w-5 h-5" />
        </button>
      )}

      {/* ══════════════════════════════════════════
          NAV — Brand Guide: logo + links + CTA
         ══════════════════════════════════════════ */}
      <nav className="fixed w-full bg-white/95 backdrop-blur-md z-40 border-b border-brand-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center text-white shadow-md">
                <Snowflake size={22} />
              </div>
              <div>
                <span className="text-xl font-bold text-brand-900 tracking-tight block leading-tight">MGR Refrigeração</span>
                <span className="text-[10px] text-mgr-cinza font-medium tracking-widest uppercase hidden sm:block">Soluções e Tecnologia</span>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6 text-sm font-medium text-mgr-cinza">
                <a href="#home" className="hover:text-brand-500 transition-colors duration-300">Início</a>
                <a href="#services" className="hover:text-brand-500 transition-colors duration-300">Soluções</a>
                <a href="#clients" className="hover:text-brand-500 transition-colors duration-300">Parceiros</a>
                {galleryItems.length > 0 && (
                  <a href="#gallery" className="hover:text-brand-500 transition-colors duration-300">Projetos</a>
                )}
                <a href="#about" className="hover:text-brand-500 transition-colors duration-300">Sobre</a>
              </div>
              <button
                onClick={() => navigate(currentUser ? '/app' : '/login')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-50 text-brand-500 hover:bg-brand-100 transition-colors duration-300 font-semibold text-sm border border-brand-200"
              >
                {currentUser ? 'Ir para o Sistema' : 'Acesso ao Sistema'}
                {currentUser ? <ArrowRight size={16} /> : <LogIn size={16} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          HERO — Brand Guide: gradiente premium
         ══════════════════════════════════════════ */}
      <section id="home" className="relative pt-20 pb-16 md:pt-32 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {content.hero.backgroundImageUrl ? (
            <img
              src={content.hero.backgroundImageUrl}
              alt="Background"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700"></div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-brand-900/95 via-brand-900/80 to-brand-900/40"></div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-sm font-bold mb-6 border border-white/20 backdrop-blur-sm">
              <Snowflake size={14} className="text-accent-400" /> Especialistas em Frio Industrial
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
              {content.hero.title}
            </h1>
            <p className="text-lg md:text-xl text-brand-200 mb-8 leading-relaxed max-w-2xl">
              {content.hero.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => setShowLeadModal(true)}
                className="px-8 py-4 bg-accent-600 text-white rounded-xl font-bold text-lg hover:bg-accent-700 transition-all duration-300 shadow-lg shadow-accent-600/30 flex items-center justify-center gap-2 hover:scale-[1.02]"
              >
                <Phone size={20} />
                {content.hero.ctaText}
              </button>
              <a
                href="#services"
                className="px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-bold text-lg hover:bg-white/20 transition-all duration-300 flex items-center justify-center backdrop-blur-sm"
              >
                Conhecer Soluções
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          STATS — Barra flutuante premium
         ══════════════════════════════════════════ */}
      <section className="bg-white py-0 relative z-20 -mt-10 md:-mt-16 mx-4 md:mx-auto max-w-6xl rounded-2xl shadow-2xl border border-brand-100">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0">
          {content.stats?.map((stat, idx) => (
            <div key={idx} className={`text-center py-8 px-4 ${idx < (content.stats?.length || 0) - 1 ? 'border-r border-brand-50' : ''}`}>
              <div className="text-3xl md:text-4xl font-bold text-accent-500 mb-1">{stat.value}</div>
              <div className="text-xs md:text-sm text-mgr-cinza uppercase tracking-wider font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          SOLUÇÕES — Cards com ícones Lucide
         ══════════════════════════════════════════ */}
      <section id="services" className="py-24 bg-mgr-cinzaClaro">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-500 text-xs font-bold mb-4 uppercase tracking-wider">
              Ciclo de Vida Completo
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-brand-900 mb-4">{content.services.title}</h2>
            <div className="h-1 w-16 bg-accent-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.services.items.map((item, idx) => {
              const isQrService = item.title.includes('QR Code');
              return (
                <div
                  key={idx}
                  className={`
                    bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border group relative overflow-hidden
                    ${isQrService ? 'border-accent-300 ring-2 ring-accent-100' : 'border-gray-100 hover:border-brand-200'}
                  `}
                >
                  {isQrService && (
                    <div className="absolute top-0 right-0 bg-accent-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                      Tecnologia MGR
                    </div>
                  )}
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-all duration-300
                    ${isQrService
                      ? 'bg-accent-50 text-accent-500 group-hover:bg-accent-500 group-hover:text-white'
                      : 'bg-brand-50 text-brand-500 group-hover:bg-brand-500 group-hover:text-white'}
                  `}>
                    {getIcon(item.icon)}
                  </div>
                  <h3 className="text-lg font-bold text-brand-900 mb-3 leading-tight">{item.title}</h3>
                  <p className="text-mgr-cinza leading-relaxed text-sm">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          PARCEIROS DE OPERAÇÃO — Logos SEMPRE coloridos
         ══════════════════════════════════════════ */}
      <section id="clients" className="py-16 bg-white border-t border-brand-50 overflow-hidden">
        <div className="w-full">
          <div className="text-center mb-12 px-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-500 text-xs font-bold mb-4 uppercase tracking-wider">
              Quem Confia na MGR
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-brand-900">{content.clients?.title || "Parceiros de Operação"}</h2>
            <p className="text-mgr-cinza mt-2">{content.clients?.description}</p>
          </div>

          <div className="relative w-full overflow-hidden group">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent z-20 pointer-events-none"></div>
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-white to-transparent z-20 pointer-events-none"></div>

            <div className="flex gap-12 w-max hover:paused group-hover:paused">
              <div className="flex gap-12 items-center animate-marquee shrink-0 min-w-full justify-around">
                {loopPartners.length === 0 && (
                  <p className="text-mgr-cinza italic">Nenhum parceiro cadastrado.</p>
                )}
                {loopPartners.map((partner, idx) => (
                  <div key={`${partner.id}-1-${idx}`} className="flex flex-col items-center gap-3 w-36 shrink-0 group/item cursor-pointer">
                    <div className="h-20 w-36 flex items-center justify-center transition-all duration-300 transform hover:scale-110">
                      {partner.logoUrl ? (
                        <img
                          src={partner.logoUrl}
                          alt={partner.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="bg-brand-50 rounded-xl w-full h-16 flex items-center justify-center border border-brand-100">
                          <Factory className="text-brand-300 w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-mgr-cinza uppercase tracking-wider group-hover/item:text-brand-500 transition-colors duration-300">
                      {partner.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-12 items-center animate-marquee shrink-0 min-w-full justify-around" aria-hidden="true">
                {loopPartners.map((partner, idx) => (
                  <div key={`${partner.id}-2-${idx}`} className="flex flex-col items-center gap-3 w-36 shrink-0 group/item cursor-pointer">
                    <div className="h-20 w-36 flex items-center justify-center transition-all duration-300 transform hover:scale-110">
                      {partner.logoUrl ? (
                        <img
                          src={partner.logoUrl}
                          alt={partner.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="bg-brand-50 rounded-xl w-full h-16 flex items-center justify-center border border-brand-100">
                          <Factory className="text-brand-300 w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold text-mgr-cinza uppercase tracking-wider group-hover/item:text-brand-500 transition-colors duration-300">
                      {partner.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          GALERIA — "Projetos em Campo"
         ══════════════════════════════════════════ */}
      {galleryItems.length > 0 && (
        <section id="gallery" className="py-24 bg-brand-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-bold mb-4 uppercase tracking-wider border border-white/10">
                <Camera size={14} /> Nosso Portfólio
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{content.gallery?.title || "Projetos em Campo"}</h2>
              <p className="text-brand-200">{content.gallery?.description}</p>
              <div className="h-1 w-16 bg-accent-500 mx-auto rounded-full mt-4"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {galleryItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500"
                  onClick={() => setGalleryModal(item)}
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                  {/* Overlay azul (Brand Guide: 20-30% opacidade) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 via-brand-900/30 to-transparent transition-opacity duration-300 group-hover:opacity-80"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <div className="flex items-center gap-2 text-xs text-accent-400 font-bold mb-1 uppercase tracking-wider">
                      <Calendar size={12} />
                      {item.date}
                    </div>
                    <h3 className="text-lg font-bold leading-tight mb-1">{item.title}</h3>
                    <p className="text-sm text-brand-200 line-clamp-2">{item.caption}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════
          SOBRE / MANIFESTO — Essência CONTINUIDADE
         ══════════════════════════════════════════ */}
      <section id="about" className="py-24 bg-mgr-cinzaClaro">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -top-6 -left-6 w-72 h-72 bg-brand-200 rounded-full blur-3xl opacity-30"></div>
              {content.about.imageUrl ? (
                <img
                  src={content.about.imageUrl}
                  alt="Sobre a MGR"
                  className="relative rounded-2xl shadow-2xl w-full object-cover h-[500px]"
                />
              ) : (
                <div className="relative rounded-2xl shadow-2xl w-full h-[500px] bg-gradient-to-br from-brand-800 to-brand-900 flex items-center justify-center">
                  <div className="text-center">
                    <Snowflake className="w-20 h-20 text-brand-400 mx-auto mb-4" />
                    <p className="text-brand-300 text-sm font-medium">Engenharia de Frio Industrial</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-8 -right-4 lg:-right-8 bg-white p-5 rounded-xl shadow-xl hidden md:block border border-brand-100">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-mgr-sucesso/10 rounded-full flex items-center justify-center text-mgr-sucesso">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-mgr-cinza font-medium">Qualidade Garantida</p>
                    <p className="font-bold text-brand-900 text-sm">Normas NR-10 e NR-18</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 text-brand-500 text-xs font-bold mb-4 uppercase tracking-wider">
                Sobre a MGR
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-brand-900 mb-6">{content.about.title}</h2>
              <p className="text-mgr-cinza leading-relaxed text-lg mb-6 whitespace-pre-line">
                {content.about.description}
              </p>

              {/* Manifesto */}
              {content.about.manifesto && (
                <div className="bg-white rounded-xl p-6 border-l-4 border-accent-500 shadow-sm mb-8">
                  <p className="text-brand-900 font-medium italic leading-relaxed">
                    "{content.about.manifesto}"
                  </p>
                </div>
              )}

              {/* Diferenciais */}
              <ul className="space-y-3">
                {(content.about.differentials || []).map((diff, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent-50 text-accent-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 size={14} />
                    </div>
                    <span className="text-mgr-grafite font-medium">{diff}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          CTA CONSULTORIA — Gradiente premium
         ══════════════════════════════════════════ */}
      <section className="py-24 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-brand-400/10 rounded-full blur-3xl"></div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-white/90 text-sm font-bold mb-6 border border-white/20 backdrop-blur-sm">
            <Snowflake size={14} className="text-accent-400" /> Novo Projeto?
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4 leading-tight">
            Solicite uma consultoria gratuita
          </h2>
          <p className="text-lg text-brand-200 mb-10 max-w-2xl mx-auto">
            Preencha nosso formulário e nossa equipe técnica entra em contato para entender
            suas necessidades e montar o projeto ideal para o seu negócio.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="/solicitar-projeto"
              className="inline-flex items-center gap-2 px-8 py-4 bg-accent-600 text-white rounded-xl font-bold text-lg hover:bg-accent-700 transition-all duration-300 shadow-lg shadow-accent-600/30 hover:scale-[1.02]"
            >
              <ArrowRight size={20} />
              Solicitar Projeto Agora
            </a>
            <a
              href={`https://wa.me/${content.contact.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 transition-all duration-300 shadow-lg"
            >
              <MessageCircle size={20} />
              Falar no WhatsApp
            </a>
          </div>
          <p className="text-sm text-brand-300 mt-8">
            Atendemos Indaiatuba e região · Resposta em até 24h
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          FOOTER — Contato + assinatura de marca
         ══════════════════════════════════════════ */}
      <footer id="contact" className="bg-mgr-preto text-white pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">

            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-500 rounded-lg flex items-center justify-center shadow-md">
                    <Snowflake size={20} />
                  </div>
                  <div>
                    <span className="text-xl font-bold block leading-tight">MGR Refrigeração</span>
                    <span className="text-[10px] text-gray-500 font-medium tracking-widest uppercase">Soluções e Tecnologia</span>
                  </div>
                </div>
                <p className="text-gray-400 max-w-md leading-relaxed">
                  Engenharia de frio industrial do projeto à operação contínua. 
                  Garantimos a continuidade da sua operação com expertise técnica e tecnologia própria.
                </p>
              </div>

              <ul className="space-y-4 text-gray-400">
                <li className="flex items-center gap-3">
                  <MapPin className="text-accent-500 w-5 h-5 flex-shrink-0" />
                  {content.contact.address}
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="text-accent-500 w-5 h-5 flex-shrink-0" />
                  {content.contact.phone}
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="text-accent-500 w-5 h-5 flex-shrink-0" />
                  {content.contact.email}
                </li>
              </ul>

              <div className="flex gap-3">
                {content.contact.instagram && (
                  <a href={`https://instagram.com/${content.contact.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-accent-500 transition-all duration-300 border border-white/10">
                    <Instagram size={18} />
                  </a>
                )}
                {content.contact.whatsapp && (
                  <a href={`https://wa.me/${content.contact.whatsapp}`} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-green-500 transition-all duration-300 border border-white/10">
                    <MessageCircle size={18} />
                  </a>
                )}
              </div>
            </div>

            {content.features.contactForm && (
              <div className="bg-white rounded-2xl p-8 text-mgr-grafite shadow-xl">
                <h3 className="text-xl font-bold mb-1 text-brand-900">Fale Conosco</h3>
                <p className="text-sm text-mgr-cinza mb-5">Nossa equipe retorna em até 24 horas.</p>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-mgr-cinza mb-1">Nome</label>
                    <input
                      type="text"
                      required
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 bg-mgr-cinzaClaro px-4 py-3 text-sm"
                      placeholder="Seu nome ou empresa"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mgr-cinza mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 bg-mgr-cinzaClaro px-4 py-3 text-sm"
                      placeholder="email@empresa.com.br"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-mgr-cinza mb-1">Mensagem</label>
                    <textarea
                      rows={3}
                      required
                      value={formMessage}
                      onChange={e => setFormMessage(e.target.value)}
                      className="w-full rounded-xl border-gray-200 focus:ring-brand-500 focus:border-brand-500 resize-none bg-mgr-cinzaClaro px-4 py-3 text-sm"
                      placeholder="Descreva brevemente sua necessidade..."
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={formStatus === 'sending'}
                    className="w-full py-3.5 px-4 bg-brand-500 text-white rounded-xl font-bold hover:bg-brand-600 transition-all duration-300 flex items-center justify-center disabled:opacity-70 shadow-md"
                  >
                    {formStatus === 'sending' ? 'Enviando...' : <><Send size={16} className="mr-2" /> Enviar Mensagem</>}
                  </button>

                  {formStatus === 'success' && (
                    <div className="p-3 bg-green-50 text-green-700 rounded-xl text-sm text-center font-medium border border-green-200">
                      ✅ Mensagem enviada com sucesso!
                    </div>
                  )}
                  {formStatus === 'error' && (
                    <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm text-center font-medium border border-red-200">
                      Erro ao enviar. Tente novamente ou use o WhatsApp.
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>

          {/* Footer Bottom — Assinatura de marca */}
          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-gray-500 text-sm">
                &copy; {new Date().getFullYear()} MGR Soluções e Tecnologia da Refrigeração. Todos os direitos reservados.
              </p>
              <p className="text-accent-500 text-sm font-bold tracking-wide">
                Engenharia de Frio como Ativo Estratégico
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════
          MODAL: Solicitar Projeto Rápido
         ══════════════════════════════════════════ */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowLeadModal(false)}>
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-900 to-brand-700 p-6 text-white relative">
              <button onClick={() => setShowLeadModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-300">
                <X size={18} />
              </button>
              <div className="flex items-center gap-2 mb-2">
                <Snowflake size={20} className="text-accent-400" />
                <span className="text-sm font-bold uppercase tracking-wide text-brand-200">MGR Refrigeração</span>
              </div>
              <h3 className="text-2xl font-bold">Solicitar Consultoria Gratuita</h3>
              <p className="text-brand-200 text-sm mt-1">Nossa equipe retorna em até 2 horas úteis.</p>
            </div>
            <div className="p-6">
              {leadSent ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-mgr-sucesso" />
                  </div>
                  <h4 className="text-xl font-bold text-brand-900">Recebemos seu contato!</h4>
                  <p className="text-mgr-cinza mt-2">Nossa equipe técnica entrará em contato em breve.</p>
                </div>
              ) : (
                <form onSubmit={handleLeadRapido} className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-mgr-cinza block mb-1">Nome / Empresa *</label>
                    <input type="text" required value={leadNome} onChange={e => setLeadNome(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-mgr-cinzaClaro"
                      placeholder="Seu nome ou empresa" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-mgr-cinza block mb-1">WhatsApp / Telefone *</label>
                    <input type="tel" required value={leadTelefone} onChange={e => setLeadTelefone(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-mgr-cinzaClaro"
                      placeholder="(19) 9 0000-0000" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-mgr-cinza block mb-1">O que você precisa?</label>
                    <select value={leadTipo} onChange={e => setLeadTipo(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 bg-mgr-cinzaClaro">
                      <option value="">Selecione (opcional)</option>
                      <option value="camara_fria">Câmara Fria / Frigorífico</option>
                      <option value="tunel_congelamento">Túnel de Congelamento</option>
                      <option value="girofreezer">Girofreezer</option>
                      <option value="climatizacao">Climatização Industrial</option>
                      <option value="manutencao">Manutenção Preventiva/Corretiva</option>
                      <option value="outros">Outros</option>
                    </select>
                  </div>
                  <button type="submit" disabled={leadSending}
                    className="w-full py-4 bg-accent-600 text-white rounded-xl font-bold text-base hover:bg-accent-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-accent-600/30">
                    {leadSending
                      ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" /> Enviando...</>
                      : <><Send size={18} /> Quero ser Atendido</>}
                  </button>
                  <p className="text-xs text-center text-mgr-cinza">
                    Ou acesse{' '}
                    <a href="/solicitar-projeto" className="text-brand-500 font-bold hover:underline">o formulário completo</a>
                    {' '}com mais detalhes técnicos.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          MODAL: Gallery Viewer
         ══════════════════════════════════════════ */}
      {galleryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setGalleryModal(null)}>
          <div className="relative max-w-4xl w-full animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <button onClick={() => setGalleryModal(null)}
              className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors duration-300 z-10">
              <X size={22} />
            </button>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <img
                src={galleryModal.imageUrl}
                alt={galleryModal.title}
                className="w-full max-h-[60vh] object-cover"
              />
              <div className="p-6">
                <div className="flex items-center gap-2 text-xs text-accent-500 font-bold mb-2 uppercase tracking-wider">
                  <Calendar size={12} />
                  {galleryModal.date}
                </div>
                <h3 className="text-xl font-bold text-brand-900 mb-2">{galleryModal.title}</h3>
                <p className="text-mgr-cinza leading-relaxed">{galleryModal.caption}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;

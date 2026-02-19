import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import firebase from '../firebase';
import { db } from '../firebase';
import { CollectionName, LandingPageContent } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  Phone, Mail, MapPin, Instagram, LogIn, Edit, 
  Snowflake, Wrench, Thermometer, Fan, CheckCircle2, ArrowRight, ShieldCheck, Send, MessageCircle, Factory, QrCode
} from 'lucide-react';

const MGR_REAL_DATA: LandingPageContent = {
  hero: {
    title: "Solução do Frio. Eficiência e Economia.",
    subtitle: "Na indústria, refrigeração parada é prejuízo na certa. Garantimos que sua operação funcione, protegendo seu produto e sua lucratividade.",
    backgroundImageUrl: "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&q=80&w=1920",
    ctaText: "Solicitar Vistoria Técnica",
    ctaLink: "#contact"
  },
  stats: [
    { value: "+15", label: "Anos de Experiência" },
    { value: "+300", label: "Projetos Entregues" },
    { value: "+50", label: "Contratos de Manutenção" },
    { value: "+500", label: "Equipamentos sob Gestão" }
  ],
  services: {
    title: "Nossas Soluções de Engenharia",
    items: [
      {
        title: "Projetos Especiais",
        description: "Túneis de Congelamento, Câmaras Frias e Girofreezers feitos sob medida para sua demanda industrial.",
        icon: "Factory"
      },
      {
        title: "Manutenção Preventiva & Corretiva",
        description: "Atendimento emergencial e contratos com análise de vibração e óleo para reduzir downtime.",
        icon: "Wrench"
      },
      {
        title: "Sistema de Gestão QR Code",
        description: "Implementamos etiquetas QR Code em suas máquinas para abertura de chamados e histórico digital completo.",
        icon: "QrCode"
      },
      {
        title: "Instalação e Climatização (HVAC)",
        description: "Instalação de sistemas centrais e projetos de climatização industrial seguindo normas NR-10 e NR-18.",
        icon: "Fan"
      }
    ]
  },
  clients: {
    title: "Quem Confia na MGR",
    description: "Grandes indústrias e parceiros que não podem parar.",
    partners: [
      { id: '1', name: "Halipar", logoUrl: "" },
      { id: '2', name: "Sorvetão", logoUrl: "" },
      { id: '3', name: "Dellys", logoUrl: "" },
      { id: '4', name: "Indaiá Pescados", logoUrl: "" }
    ]
  },
  about: {
    title: "Engenharia que Gera Resultados",
    description: "Nossa missão é entregar a solução completa: equipamentos robustos feitos sob medida e o serviço de manutenção mais transparente do mercado. Com uma frota própria e equipe técnica certificada, atendemos Indaiatuba e região com agilidade.",
    imageUrl: "https://images.unsplash.com/photo-1581092921461-eab6245b0262?auto=format&fit=crop&q=80&w=800"
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

  // Check permissions
  const canEdit = userProfile?.role === 'developer' || userProfile?.role === 'admin';

  useEffect(() => {
    const docRef = db.collection(CollectionName.SYSTEM_SETTINGS).doc('landing_page');
    
    // Improved error handling to suppress logs for public visitors
    const unsub = docRef.onSnapshot(async (docSnap) => {
      if (docSnap.exists) {
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
           }
        };

        setContent(safeData);
      } else {
        // Only try to set defaults if user is authorized (admin/developer), 
        // otherwise just use static data to avoid permission errors on write.
        if (currentUser) {
            try {
               await docRef.set(MGR_REAL_DATA);
            } catch (e) {
               // Ignore write errors for non-admins
            }
        }
        setContent(MGR_REAL_DATA);
      }
      setLoading(false);
    }, (error: any) => {
      // Suppress permission-denied errors for public users as this is expected behavior
      if (error?.code !== 'permission-denied') {
          console.error("Error fetching landing page settings:", error);
      }
      // Fallback to static data
      setContent(MGR_REAL_DATA);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    try {
      await db.collection(CollectionName.CONTACT_MESSAGES).add({
        name: formName,
        email: formEmail,
        message: formMessage,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
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

  const getIcon = (iconName: string) => {
    switch(iconName) {
      case 'Wrench': return <Wrench className="w-8 h-8" />;
      case 'Thermometer': return <Thermometer className="w-8 h-8" />;
      case 'Fan': return <Fan className="w-8 h-8" />;
      case 'ShieldCheck': return <ShieldCheck className="w-8 h-8" />;
      case 'Snowflake': return <Snowflake className="w-8 h-8" />;
      case 'Factory': return <Factory className="w-8 h-8" />;
      case 'QrCode': return <QrCode className="w-8 h-8" />;
      default: return <CheckCircle2 className="w-8 h-8" />;
    }
  };

  if (loading) return <div className="min-h-screen bg-white" />;

  const basePartners = content.clients?.partners || [];
  const loopPartners = basePartners.length > 0 
    ? [...basePartners, ...basePartners, ...basePartners] 
    : [];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      
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
      `}</style>

      {content.features.whatsappFloat && (
        <a
          href={`https://wa.me/${content.contact.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-2xl hover:bg-green-600 hover:scale-110 transition-all flex items-center justify-center"
          title="Fale conosco no WhatsApp"
        >
          <MessageCircle className="w-8 h-8" fill="white" />
        </a>
      )}

      {canEdit && (
        <button 
          onClick={() => navigate('/editor-site')}
          className="fixed bottom-24 right-6 z-50 bg-brand-600 text-white p-3 rounded-full shadow-2xl hover:bg-brand-700 hover:scale-105 transition-all flex items-center gap-2 font-bold text-sm"
        >
          <Edit className="w-5 h-5" />
        </button>
      )}

      <nav className="fixed w-full bg-white/95 backdrop-blur-sm z-40 border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-brand-600 rounded-lg flex items-center justify-center text-white">
                <Snowflake size={24} />
              </div>
              <span className="text-2xl font-bold text-brand-900 tracking-tight">MGR Refrigeração</span>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
                <a href="#home" className="hover:text-brand-600 transition-colors">Início</a>
                <a href="#services" className="hover:text-brand-600 transition-colors">Soluções</a>
                <a href="#clients" className="hover:text-brand-600 transition-colors">Clientes</a>
                <a href="#about" className="hover:text-brand-600 transition-colors">Sobre</a>
              </div>
              <button 
                onClick={() => navigate(currentUser ? '/app' : '/login')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors font-medium text-sm"
              >
                {currentUser ? 'Ir para o Sistema' : 'Acesso ao Sistema'}
                {currentUser ? <ArrowRight size={16} /> : <LogIn size={16} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <section id="home" className="relative pt-20 pb-16 md:pt-32 md:pb-32 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={content.hero.backgroundImageUrl} 
            alt="Background" 
            className="w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-50 via-white/80 to-transparent"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-sm font-bold mb-6">
              <Snowflake size={14} /> Especialistas em Frio Industrial
            </div>
            <h1 className="text-4xl md:text-6xl font-extrabold text-brand-900 leading-tight mb-6">
              {content.hero.title}
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed max-w-2xl">
              {content.hero.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a 
                href={content.hero.ctaLink} 
                className="px-8 py-4 bg-brand-600 text-white rounded-lg font-bold text-lg hover:bg-brand-700 transition-all shadow-lg shadow-brand-200 flex items-center justify-center gap-2"
              >
                <Phone size={20} />
                {content.hero.ctaText}
              </a>
              <a 
                href="#services"
                className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-lg font-bold text-lg hover:bg-gray-50 transition-all flex items-center justify-center"
              >
                Conhecer Soluções
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-brand-900 text-white py-12 relative z-20 -mt-10 md:-mt-16 mx-4 md:mx-auto max-w-6xl rounded-2xl shadow-2xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 px-8">
          {content.stats?.map((stat, idx) => (
            <div key={idx} className="text-center border-r border-brand-700 last:border-0">
              <div className="text-3xl md:text-4xl font-extrabold text-white mb-1">{stat.value}</div>
              <div className="text-xs md:text-sm text-brand-200 uppercase tracking-wider font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="services" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">{content.services.title}</h2>
            <div className="h-1 w-20 bg-brand-500 mx-auto rounded-full"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.services.items.map((item, idx) => {
              const isQrService = item.title.includes('QR Code');
              return (
                <div 
                  key={idx} 
                  className={`
                    bg-white p-8 rounded-2xl shadow-sm hover:shadow-xl transition-all border group relative overflow-hidden
                    ${isQrService ? 'border-brand-300 ring-2 ring-brand-100' : 'border-gray-100'}
                  `}
                >
                  {isQrService && (
                    <div className="absolute top-0 right-0 bg-brand-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                      TECNOLOGIA
                    </div>
                  )}
                  <div className={`
                    w-14 h-14 rounded-xl flex items-center justify-center mb-6 transition-colors
                    ${isQrService ? 'bg-brand-100 text-brand-600 group-hover:bg-brand-600 group-hover:text-white' : 'bg-gray-100 text-gray-600 group-hover:bg-brand-600 group-hover:text-white'}
                  `}>
                    {getIcon(item.icon)}
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 leading-tight">{item.title}</h3>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="clients" className="py-16 bg-white border-t border-gray-100 overflow-hidden">
        <div className="w-full">
          <div className="text-center mb-12 px-4">
            <h2 className="text-2xl font-bold text-gray-900">{content.clients?.title || "Quem Confia na MGR"}</h2>
            <p className="text-gray-500 mt-2">{content.clients?.description}</p>
          </div>
          
          <div className="relative w-full overflow-hidden group">
             <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white to-transparent z-20 pointer-events-none"></div>
             <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent z-20 pointer-events-none"></div>

             <div className="flex gap-12 w-max hover:paused group-hover:paused">
                <div className="flex gap-12 items-center animate-marquee shrink-0 min-w-full justify-around">
                   {loopPartners.length === 0 && (
                      <p className="text-gray-400 italic">Nenhum parceiro cadastrado.</p>
                   )}
                   {loopPartners.map((partner, idx) => (
                      <div key={`${partner.id}-1-${idx}`} className="flex flex-col items-center gap-3 w-32 shrink-0 group/item cursor-pointer">
                         <div className="h-20 w-32 flex items-center justify-center grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300 transform hover:scale-105">
                            {partner.logoUrl ? (
                               <img 
                                 src={partner.logoUrl} 
                                 alt={partner.name} 
                                 className="max-h-full max-w-full object-contain"
                               />
                            ) : (
                               <div className="bg-gray-100 rounded-lg w-full h-16 flex items-center justify-center border border-gray-200">
                                  <Factory className="text-gray-300 w-6 h-6" />
                               </div>
                            )}
                         </div>
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover/item:text-brand-600 transition-colors">
                           {partner.name}
                         </span>
                      </div>
                   ))}
                </div>

                <div className="flex gap-12 items-center animate-marquee shrink-0 min-w-full justify-around" aria-hidden="true">
                   {loopPartners.map((partner, idx) => (
                      <div key={`${partner.id}-2-${idx}`} className="flex flex-col items-center gap-3 w-32 shrink-0 group/item cursor-pointer">
                         <div className="h-20 w-32 flex items-center justify-center grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300 transform hover:scale-105">
                            {partner.logoUrl ? (
                               <img 
                                 src={partner.logoUrl} 
                                 alt={partner.name} 
                                 className="max-h-full max-w-full object-contain"
                               />
                            ) : (
                               <div className="bg-gray-100 rounded-lg w-full h-16 flex items-center justify-center border border-gray-200">
                                  <Factory className="text-gray-300 w-6 h-6" />
                               </div>
                            )}
                         </div>
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-wider group-hover/item:text-brand-600 transition-colors">
                           {partner.name}
                         </span>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative order-2 lg:order-1">
              <div className="absolute -top-4 -left-4 w-72 h-72 bg-brand-100 rounded-full blur-3xl opacity-50"></div>
              <img 
                src={content.about.imageUrl} 
                alt="Sobre a Empresa" 
                className="relative rounded-2xl shadow-2xl w-full object-cover h-[500px]"
              />
              <div className="absolute bottom-8 -right-8 bg-white p-6 rounded-xl shadow-xl hidden md:block">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Qualidade Garantida</p>
                    <p className="font-bold text-gray-900">Normas NR-10 e NR-18</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">{content.about.title}</h2>
              <div className="prose prose-lg text-gray-600">
                <p className="whitespace-pre-line leading-relaxed">
                  {content.about.description}
                </p>
              </div>
              <ul className="mt-8 space-y-4">
                <li className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={14}/></div>
                   <span className="text-gray-700">Equipe técnica certificada e frota própria</span>
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={14}/></div>
                   <span className="text-gray-700">Atendimento ágil em Indaiatuba e região</span>
                </li>
                <li className="flex items-center gap-3">
                   <div className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center flex-shrink-0"><CheckCircle2 size={14}/></div>
                   <span className="text-gray-700">Gestão digital de manutenção via App</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-gray-900 text-white pt-20 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 mb-16">
            
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-brand-600 rounded flex items-center justify-center">
                    <Snowflake size={18} />
                  </div>
                  <span className="text-xl font-bold">MGR Refrigeração</span>
                </div>
                <p className="text-gray-400 max-w-md">
                  Soluções inteligentes em climatização e refrigeração para o seu negócio.
                </p>
              </div>

              <ul className="space-y-4 text-gray-400">
                <li className="flex items-center gap-3">
                  <MapPin className="text-brand-500 w-5 h-5 flex-shrink-0" />
                  {content.contact.address}
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="text-brand-500 w-5 h-5 flex-shrink-0" />
                  {content.contact.phone}
                </li>
                <li className="flex items-center gap-3">
                  <Mail className="text-brand-500 w-5 h-5 flex-shrink-0" />
                  {content.contact.email}
                </li>
              </ul>

              <div className="flex gap-4">
                {content.contact.instagram && (
                   <a href={`https://instagram.com/${content.contact.instagram.replace('@','')}`} target="_blank" className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-brand-600 transition-colors">
                     <Instagram size={20} />
                   </a>
                )}
              </div>
            </div>

            {content.features.contactForm && (
              <div className="bg-white rounded-2xl p-8 text-gray-900 shadow-xl">
                <h3 className="text-xl font-bold mb-4">Fale Conosco</h3>
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                    <input 
                      type="text" 
                      required
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                    <input 
                      type="email" 
                      required
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                    <textarea 
                      rows={3}
                      required
                      value={formMessage}
                      onChange={e => setFormMessage(e.target.value)}
                      className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 resize-none"
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={formStatus === 'sending'}
                    className="w-full py-3 px-4 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 transition-colors flex items-center justify-center disabled:opacity-70"
                  >
                    {formStatus === 'sending' ? 'Enviando...' : <><Send size={16} className="mr-2" /> Enviar Mensagem</>}
                  </button>
                  
                  {formStatus === 'success' && (
                    <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm text-center font-medium">
                      Mensagem enviada com sucesso!
                    </div>
                  )}
                  {formStatus === 'error' && (
                    <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center font-medium">
                      Erro ao enviar. Tente novamente ou use o WhatsApp.
                    </div>
                  )}
                </form>
              </div>
            )}
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} MGR Refrigeração. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
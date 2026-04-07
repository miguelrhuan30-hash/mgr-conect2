/**
 * components/ProjetosLanding.tsx — Sprint 3
 *
 * Landing Page exclusiva para anúncios patrocinados.
 * Rota pública: /projetos
 * Foco total em conversão: galeria de projetos, fotos empresa, formulário de lead.
 * Conteúdo editável via Firestore (ProjetosLandingEditor).
 */
import React, { useState, useEffect } from 'react';
import {
  Phone, CheckCircle2, ArrowRight, Send, Snowflake, MessageCircle,
  Star, Shield, Clock, Zap, ChevronDown, X, Factory,
} from 'lucide-react';
import {
  doc, onSnapshot, addDoc, collection, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';

// ── Tipos ──
export interface ProjetosLandingContent {
  hero: {
    titulo: string;
    subtitulo: string;
    badge: string;
    cta: string;
    bgColor: string;
  };
  diferenciais: { icone: string; titulo: string; descricao: string }[];
  projetos: {
    secaoTitulo: string;
    itens: { titulo: string; descricao: string; fotoUrl: string; tag: string }[];
  };
  empresa: {
    secaoTitulo: string;
    descricao: string;
    fotos: string[];
    stats: { valor: string; label: string }[];
  };
  depoimentos: { nome: string; empresa: string; texto: string; nota: number }[];
  form: {
    titulo: string;
    subtitulo: string;
  };
  contato: {
    whatsapp: string;
    telefone: string;
    instagram: string;
  };
  seo: {
    title: string;
    description: string;
  };
}

const DEFAULT_CONTENT: ProjetosLandingContent = {
  hero: {
    titulo: 'Projetos de Refrigeração Industrial sob Medida',
    subtitulo: 'Câmaras Frias, Túneis de Congelamento e Girofreezers projetados e instalados pela MGR — a empresa que não para quando você precisa.',
    badge: '✅ Mais de 300 projetos entregues',
    cta: 'Solicitar Orçamento Gratuito',
    bgColor: 'from-slate-900 via-brand-950 to-slate-900',
  },
  diferenciais: [
    { icone: '⚡', titulo: 'Atendimento em 24h', descricao: 'Equipe técnica responde em até 24 horas úteis para qualquer demanda.' },
    { icone: '🏆', titulo: '+15 Anos de Experiência', descricao: 'Especialistas em refrigeração industrial com vasto portfólio comprovado.' },
    { icone: '🛡️', titulo: 'Garantia Completa', descricao: 'Garantia na instalação e suporte técnico pós-entrega incluídos.' },
    { icone: '📊', titulo: 'Projeto Personalizado', descricao: 'Cada projeto é único. Desenvolvemos a solução certa para sua necessidade.' },
  ],
  projetos: {
    secaoTitulo: 'Projetos Entregues',
    itens: [
      { titulo: 'Câmara Fria Industrial — Ceasa', descricao: 'Câmara de 200m² com controle digital de temperatura para armazenamento de hortifrutigranjeiros.', fotoUrl: '', tag: 'Câmara Fria' },
      { titulo: 'Túnel de Congelamento — Frigorífico', descricao: 'Tunnel de congelamento rápido para até 500kg/h, com sistema de monitoramento remoto.', fotoUrl: '', tag: 'Túnel' },
      { titulo: 'Girofreezer — Indústria de Pão', descricao: 'Girofreezer de 3 torres para congelamento contínuo de pães, capacidade 800 peças/hora.', fotoUrl: '', tag: 'Girofreezer' },
      { titulo: 'Climatização Industrial — Galpão Logístico', descricao: 'Sistema HVAC completo para galpão de 5.000m² com controle central e automação.', fotoUrl: '', tag: 'HVAC' },
    ],
  },
  empresa: {
    secaoTitulo: 'A MGR Refrigeração',
    descricao: 'Fundada em Indaiatuba/SP, a MGR Refrigeração é referência em projetos industriais de frio e climatização. Nossa equipe certificada atende dos menores aos maiores projetos com a mesma excelência.',
    fotos: [],
    stats: [
      { valor: '+300', label: 'Projetos Entregues' },
      { valor: '+15', label: 'Anos de Mercado' },
      { valor: '+50', label: 'Contratos Ativos' },
      { valor: '24h', label: 'Tempo de Resposta' },
    ],
  },
  depoimentos: [
    { nome: 'Carlos Mendes', empresa: 'Halipar Alimentos', texto: 'A MGR entregou nossa câmara fria no prazo e com qualidade excelente. Recomendo a todos do setor.', nota: 5 },
    { nome: 'Ana Lima', empresa: 'Sorvetão Industrial', texto: 'Profissionalismo e competência técnica acima do esperado. O girofreezer opera sem nenhuma ocorrência.', nota: 5 },
    { nome: 'Roberto Santos', empresa: 'Indaiá Pescados', texto: 'Atendimento rápido, equipe capacitada e resultado impecável. Parceira de confiança há 8 anos.', nota: 5 },
  ],
  form: {
    titulo: 'Solicite seu Orçamento Gratuito',
    subtitulo: 'Preencha o formulário. Nossa equipe técnica entra em contato em até 24 horas.',
  },
  contato: {
    whatsapp: '5519999999999',
    telefone: '(19) 3333-3333',
    instagram: '@mgrrefrigeracao',
  },
  seo: {
    title: 'Projetos de Refrigeração Industrial | MGR Refrigeração',
    description: 'Câmaras frias, túneis de congelamento e girofreezers sob medida. Mais de 300 projetos entregues em Indaiatuba e região.',
  },
};

// ── Helper: detectar origem via UTM ──
const detectarOrigem = (): string => {
  const params = new URLSearchParams(window.location.search);
  const utmMedium = params.get('utm_medium') || '';
  const utmSource = params.get('utm_source') || '';
  if (utmMedium.includes('cpc') || utmSource.includes('google')) return 'anuncio_google';
  if (utmSource.includes('facebook') || utmSource.includes('instagram') || utmMedium.includes('social')) return 'anuncio_meta';
  return 'anuncio_meta'; // default da LP de anúncios
};

// ── Componente estrelas ──
const Stars: React.FC<{ n: number }> = ({ n }) => (
  <div className="flex gap-0.5">
    {[1,2,3,4,5].map(i => <Star key={i} className={`w-4 h-4 ${i <= n ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />)}
  </div>
);

// ── FAQ simples ──
const FAQ: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
        <span className="font-bold text-gray-900 text-sm">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{a}</div>}
    </div>
  );
};

// ── Formulário de Lead ──
const LeadForm: React.FC<{ formContent: ProjetosLandingContent['form']; contato: ProjetosLandingContent['contato'] }> = ({ formContent, contato }) => {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState('');
  const [medidas, setMedidas] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    const params = new URLSearchParams(window.location.search);
    try {
      await addDoc(collection(db, 'project_leads'), {
        nomeContato: nome.trim(),
        telefone: telefone.trim(),
        email: email.trim() || null,
        tipoProjetoSlug: tipo || 'nao_definido',
        tipoProjetoTexto: tipo || 'Não definido',
        medidasAproximadas: medidas.trim() || null,
        observacoes: mensagem.trim() || null,
        origem: detectarOrigem(),
        utmSource: params.get('utm_source') || null,
        utmMedium: params.get('utm_medium') || null,
        utmCampaign: params.get('utm_campaign') || null,
        status: 'novo',
        criadoEm: serverTimestamp(),
        userAgent: window.navigator.userAgent,
      });
      setSent(true);
    } finally { setSending(false); }
  };

  if (sent) {
    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-2xl font-extrabold text-gray-900">Recebemos seu pedido!</h3>
        <p className="text-gray-500 mt-3 max-w-sm mx-auto">Nossa equipe técnica entrará em contato em até 24 horas úteis. Fique de olho no seu WhatsApp!</p>
        <a href={`https://wa.me/${contato.whatsapp}`} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600">
          <MessageCircle className="w-5 h-5" fill="white" />
          Falar agora no WhatsApp
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">Nome / Empresa *</label>
          <input type="text" required value={nome} onChange={e => setNome(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="Seu nome ou empresa" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">WhatsApp *</label>
          <input type="tel" required value={telefone} onChange={e => setTelefone(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="(19) 9 0000-0000" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            placeholder="email@empresa.com" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">Tipo de Projeto *</label>
          <select required value={tipo} onChange={e => setTipo(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent">
            <option value="">Selecione...</option>
            <option value="camara_fria">Câmara Fria / Frigorífico</option>
            <option value="tunel_congelamento">Túnel de Congelamento</option>
            <option value="girofreezer">Girofreezer</option>
            <option value="climatizacao">Climatização / HVAC</option>
            <option value="manutencao">Manutenção de Equipamentos</option>
            <option value="outros">Outros</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">Medidas Aproximadas (opcional)</label>
        <input type="text" value={medidas} onChange={e => setMedidas(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          placeholder="Ex: 10m x 8m x 4m de altura" />
      </div>
      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">Conte um pouco mais sobre sua necessidade</label>
        <textarea value={mensagem} onChange={e => setMensagem(e.target.value)} rows={3}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
          placeholder="Para que vai usar? Produto a armazenar? Volume estimado?" />
      </div>
      <button type="submit" disabled={sending}
        className="w-full py-4 bg-brand-600 text-white rounded-xl font-extrabold text-base hover:bg-brand-700 transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-xl">
        {sending
          ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Enviando...</>
          : <><Send className="w-5 h-5" />Quero Meu Orçamento Gratuito</>}
      </button>
      <p className="text-xs text-center text-gray-400">🔒 Seus dados são protegidos. Sem spam.</p>
    </form>
  );
};

// ── Componente principal ──
const ProjetosLanding: React.FC = () => {
  const [content, setContent] = useState<ProjetosLandingContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Update meta tags for SEO
    document.title = content.seo.title;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', content.seo.description);
  }, [content.seo]);

  useEffect(() => {
    const docRef = doc(db, 'system_settings', 'projetos_landing');
    const unsub = onSnapshot(docRef, snap => {
      if (snap.exists()) setContent({ ...DEFAULT_CONTENT, ...snap.data() as ProjetosLandingContent });
      else {
        setDoc(docRef, DEFAULT_CONTENT).catch(() => {});
        setContent(DEFAULT_CONTENT);
      }
      setLoading(false);
    }, () => { setContent(DEFAULT_CONTENT); setLoading(false); });
    return () => unsub();
  }, []);

  if (loading) return <div className="min-h-screen bg-white" />;

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <title>{content.seo.title}</title>

      {/* FloatWhatsApp */}
      <a href={`https://wa.me/${content.contato.whatsapp}?text=Olá! Vim pelo anúncio e gostaria de um orçamento de projeto.`}
        target="_blank" rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-green-500 text-white px-4 py-3 rounded-full shadow-2xl hover:bg-green-600 hover:scale-105 transition-all">
        <MessageCircle className="w-6 h-6" fill="white" />
        <span className="text-sm font-bold hidden sm:block">Falar no WhatsApp</span>
      </a>

      {/* ── Header Sticky ── */}
      <header className="fixed top-0 w-full bg-white/95 backdrop-blur-sm z-40 border-b border-gray-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Snowflake className="w-5 h-5 text-white" />
            </div>
            <span className="font-extrabold text-brand-900">MGR Refrigeração</span>
          </div>
          <button onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors flex items-center gap-1.5">
            <Phone className="w-4 h-4" /> Solicitar Orçamento
          </button>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className={`pt-16 pb-0 min-h-[90vh] flex items-center bg-gradient-to-br ${content.hero.bgColor} relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-96 h-96 bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-brand-500 rounded-full blur-3xl" />
        </div>
        <div className="max-w-6xl mx-auto px-4 py-20 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 text-white/90 rounded-full text-sm font-bold mb-6 border border-white/20">
              <span>{content.hero.badge}</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">
              {content.hero.titulo}
            </h1>
            <p className="text-lg text-white/75 mb-8 leading-relaxed max-w-xl">
              {content.hero.subtitulo}
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => setShowModal(true)}
                className="px-8 py-5 bg-brand-500 text-white rounded-2xl font-extrabold text-lg hover:bg-brand-400 transition-all shadow-2xl shadow-brand-900/50 flex items-center justify-center gap-2">
                <Phone className="w-5 h-5" /> {content.hero.cta}
              </button>
              <a href="#projetos"
                className="px-8 py-5 bg-white/10 text-white border border-white/20 rounded-2xl font-bold text-lg hover:bg-white/20 transition-all flex items-center justify-center gap-2">
                Ver Projetos <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Hero Form (desktop) */}
          <div className="bg-white rounded-3xl shadow-2xl p-8 hidden lg:block">
            <h2 className="text-xl font-extrabold text-gray-900 mb-1">{content.form.titulo}</h2>
            <p className="text-sm text-gray-500 mb-5">{content.form.subtitulo}</p>
            <LeadForm formContent={content.form} contato={content.contato} />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ── Diferenciais ── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {content.diferenciais.map((d, i) => (
              <div key={i} className="text-center p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-lg transition-all group">
                <div className="text-4xl mb-3">{d.icone}</div>
                <h3 className="font-extrabold text-gray-900 text-sm mb-2">{d.titulo}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{d.descricao}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Galeria de Projetos ── */}
      <section id="projetos" className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-sm font-bold mb-4">
              <Factory className="w-4 h-4" /> Portfólio
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">{content.projetos.secaoTitulo}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.projetos.itens.map((p, i) => (
              <div key={i} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-200 hover:shadow-xl transition-all group">
                <div className="h-52 bg-gradient-to-br from-brand-50 to-gray-100 relative overflow-hidden flex items-center justify-center">
                  {p.fotoUrl ? (
                    <img src={p.fotoUrl} alt={p.titulo} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      <Factory className="w-12 h-12" />
                      <span className="text-xs font-medium">Foto do projeto</span>
                    </div>
                  )}
                  <span className="absolute top-3 left-3 bg-brand-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide">
                    {p.tag}
                  </span>
                </div>
                <div className="p-6">
                  <h3 className="font-extrabold text-gray-900 text-base mb-2">{p.titulo}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{p.descricao}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button onClick={() => setShowModal(true)}
              className="px-8 py-4 bg-brand-600 text-white rounded-2xl font-extrabold text-base hover:bg-brand-700 transition-all shadow-lg">
              Quero um projeto como esses →
            </button>
          </div>
        </div>
      </section>

      {/* ── Empresa ── */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-100 text-brand-700 text-sm font-bold mb-4">
                <Shield className="w-4 h-4" /> Sobre Nós
              </div>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6">{content.empresa.secaoTitulo}</h2>
              <p className="text-gray-600 leading-relaxed mb-8">{content.empresa.descricao}</p>
              <div className="grid grid-cols-2 gap-4">
                {content.empresa.stats.map((s, i) => (
                  <div key={i} className="bg-gradient-to-br from-brand-50 to-blue-50 rounded-2xl p-4 border border-brand-100">
                    <div className="text-2xl font-extrabold text-brand-700">{s.valor}</div>
                    <div className="text-xs text-gray-600 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {content.empresa.fotos.length > 0 ? (
                content.empresa.fotos.map((f, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden aspect-square bg-gray-100">
                    <img src={f} alt={`Empresa ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                ))
              ) : (
                [0,1,2,3].map(i => (
                  <div key={i} className="rounded-2xl bg-gradient-to-br from-brand-50 to-gray-100 aspect-square flex items-center justify-center border border-gray-200">
                    <div className="text-center text-gray-300">
                      <Factory className="w-8 h-8 mx-auto mb-1" />
                      <span className="text-[10px]">Foto empresa</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      {content.depoimentos.length > 0 && (
        <section className="py-20 bg-gray-50">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900">O que nossos clientes dizem</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {content.depoimentos.map((d, i) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all">
                  <Stars n={d.nota} />
                  <p className="text-gray-700 mt-4 mb-5 leading-relaxed text-sm italic">"{d.texto}"</p>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{d.nome}</p>
                    <p className="text-xs text-gray-500">{d.empresa}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Formulário Mobile (seção dedicada) ── */}
      <section id="orcamento" className="py-20 bg-gradient-to-br from-brand-700 to-brand-900">
        <div className="max-w-2xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-white">{content.form.titulo}</h2>
            <p className="text-white/70 mt-3">{content.form.subtitulo}</p>
          </div>
          <div className="bg-white rounded-3xl shadow-2xl p-8">
            <LeadForm formContent={content.form} contato={content.contato} />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-gray-900 text-center mb-8">Perguntas Frequentes</h2>
          <div className="space-y-3">
            {[
              { q: 'Qual o prazo médio de um projeto de câmara fria?', a: 'Depende do porte. Câmaras pequenas (até 50m²) ficam prontas em 2-3 semanas. Projetos maiores entre 4-8 semanas após aprovação do orçamento.' },
              { q: 'Vocês atendem fora de Indaiatuba?', a: 'Sim! Atendemos toda a região de Campinas e interior de São Paulo. Para projetos maiores, atendemos outros estados.' },
              { q: 'O orçamento é gratuito?', a: 'Sim, 100% gratuito e sem compromisso. Nossa equipe técnica vai até o local para fazer o levantamento correto.' },
              { q: 'Quais são as garantias dos projetos?', a: 'Garantia de manutenção por 6 meses e garantia dos equipamentos conforme o fabricante. Tudo documentado no contrato.' },
            ].map((faq, i) => <FAQ key={i} q={faq.q} a={faq.a} />)}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-white py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Snowflake className="w-5 h-5" />
            </div>
            <span className="font-bold">MGR Refrigeração</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{content.contato.telefone}</span>
            <span>·</span>
            <span>{content.contato.instagram}</span>
            <span>·</span>
            <a href="/" className="hover:text-white transition-colors">Site Principal</a>
          </div>
          <p className="text-xs text-gray-600">© {new Date().getFullYear()} MGR Refrigeração</p>
        </div>
      </footer>

      {/* ── Modal lead (mobile CTA) ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowModal(false)}>
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-brand-700 to-brand-900 p-5 text-white relative">
              <button onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
              <h3 className="text-xl font-extrabold">{content.form.titulo}</h3>
              <p className="text-white/70 text-sm mt-1">{content.form.subtitulo}</p>
            </div>
            <div className="p-6">
              <LeadForm formContent={content.form} contato={content.contato} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjetosLanding;

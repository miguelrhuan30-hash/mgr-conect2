import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, limit, getDocs, updateDoc, doc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { MultiLandingPage } from '../types';
import {
  Phone, Mail, MapPin, Instagram, Linkedin, MessageCircle,
  CheckCircle2, Star, ArrowRight, Loader2,
  ShieldCheck, Clock, Award, Users, Wrench, Snowflake,
  Wind, Ruler, Droplets, LayoutDashboard, Globe,
  AlertTriangle, TrendingUp, Package, Zap, Timer,
  Thermometer, Settings, BarChart2, Activity, Cpu,
  Calendar, FileText, Wifi, Search, Scale, Leaf,
  AlertCircle, DollarSign, ClipboardList, BookOpen,
  type LucideIcon,
} from 'lucide-react';

// ─── dynamic icon resolver ────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  ShieldCheck, Clock, Award, Users, Wrench, Snowflake, Wind, Ruler, Droplets,
  LayoutDashboard, Globe, AlertTriangle, TrendingUp, Package, Zap, Timer,
  Thermometer, Settings, BarChart2, Activity, Cpu, Calendar, FileText,
  Wifi, Search, Scale, Leaf, AlertCircle, DollarSign, ClipboardList,
  BookOpen, CheckCircle2, Star, Phone, Mail, MapPin,
  // aliases used in templates
  ThermometerSnowflake: Thermometer,
};

function DynIcon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICON_MAP[name] ?? Globe;
  return <Icon size={size} className={className} />;
}

// ─── css vars helper ──────────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
}

// ─── WhatsApp float button ────────────────────────────────────────────────────

function WhatsAppButton({ whatsapp, accent }: { whatsapp: string; accent: string }) {
  if (!whatsapp) return null;
  return (
    <a
      href={`https://wa.me/${whatsapp}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
      style={{ backgroundColor: '#25D366' }}
      aria-label="WhatsApp"
    >
      <MessageCircle size={28} className="text-white" />
    </a>
  );
}

// ─── section renderers ────────────────────────────────────────────────────────

function HeroSection({ hero, header, primary, accent }: {
  hero: MultiLandingPage['content']['hero'];
  header: MultiLandingPage['content']['header'];
  primary: string;
  accent: string;
}) {
  return (
    <section
      className="relative min-h-[80vh] flex flex-col justify-center px-4 py-20 text-white overflow-hidden"
      style={{ backgroundColor: primary }}
    >
      {hero.backgroundImageUrl && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${hero.backgroundImageUrl})` }}
          />
          <div className="absolute inset-0 bg-black/50" />
        </>
      )}
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {hero.badgeText && (
          <span
            className="inline-block mb-4 px-4 py-1.5 rounded-full text-sm font-bold"
            style={{ backgroundColor: accent, color: '#fff' }}
          >
            {hero.badgeText}
          </span>
        )}
        <h1 className="text-3xl sm:text-5xl font-extrabold leading-tight mb-5">{hero.title}</h1>
        <p className="text-lg sm:text-xl text-white/90 mb-8 max-w-xl mx-auto">{hero.subtitle}</p>
        <a
          href={hero.ctaLink || `https://wa.me/${header.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-7 py-4 rounded-xl text-white text-base font-extrabold shadow-lg transition-transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: accent }}
        >
          {hero.ctaText}
          <ArrowRight size={18} />
        </a>
        {header.phone && (
          <p className="mt-5 text-sm text-white/70">
            Ou ligue agora: <a href={`tel:${header.phone}`} className="font-bold text-white">{header.phone}</a>
          </p>
        )}
      </div>
    </section>
  );
}

function ProblemSection({ problem, primary }: { problem: MultiLandingPage['content']['problem']; primary: string }) {
  if (!problem.items.length) return null;
  return (
    <section className="py-16 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-10">{problem.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {problem.items.map((item, i) => (
            <div key={i} className="bg-white rounded-xl border border-red-100 p-5 flex gap-4 items-start shadow-sm">
              <span className="text-red-500 flex-shrink-0 mt-0.5"><DynIcon name={item.icon} size={22} /></span>
              <div>
                <p className="font-bold text-gray-800 mb-1">{item.title}</p>
                <p className="text-sm text-gray-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SolutionSection({ solution, primary, accent }: { solution: MultiLandingPage['content']['solution']; primary: string; accent: string }) {
  if (!solution.items.length) return null;
  return (
    <section className="py-16 px-4" style={{ backgroundColor: primary }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">{solution.title}</h2>
          {solution.subtitle && <p className="text-white/80 text-lg max-w-xl mx-auto">{solution.subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {solution.items.map((item, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-5 flex gap-4 items-start border border-white/20">
              <span className="flex-shrink-0 mt-0.5" style={{ color: accent }}><DynIcon name={item.icon} size={22} /></span>
              <div>
                <p className="font-bold text-white mb-1">{item.title}</p>
                <p className="text-sm text-white/70">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SocialProofSection({ socialProof }: { socialProof: MultiLandingPage['content']['socialProof'] }) {
  if (!socialProof.items.length) return null;
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-10">{socialProof.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {socialProof.items.map((item, i) => (
            <div key={i} className="bg-gray-50 rounded-xl border border-gray-200 p-5 shadow-sm">
              {item.logoUrl && (
                <img src={item.logoUrl} alt={item.name} className="h-10 object-contain mb-3 opacity-80" />
              )}
              {item.testimonial && (
                <p className="text-sm text-gray-600 italic mb-3 leading-relaxed">{item.testimonial}</p>
              )}
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">{item.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DifferentialsSection({ differentials, primary }: { differentials: MultiLandingPage['content']['differentials']; primary: string }) {
  if (!differentials.items.length) return null;
  return (
    <section className="py-16 px-4 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 text-center mb-10">{differentials.title}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {differentials.items.map((item, i) => (
            <div key={i} className="text-center p-5">
              <span className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-3" style={{ backgroundColor: primary + '20', color: primary }}>
                <DynIcon name={item.icon} size={24} />
              </span>
              <p className="font-bold text-gray-800 mb-1">{item.title}</p>
              <p className="text-sm text-gray-500">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function BridgeSection({ bridge, primary }: { bridge: MultiLandingPage['content']['bridge']; primary: string }) {
  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-4">{bridge.title}</h2>
            <p className="text-gray-600 leading-relaxed mb-6">{bridge.description}</p>
            {bridge.stats.length > 0 && (
              <div className="grid grid-cols-2 gap-4">
                {bridge.stats.map((s, i) => (
                  <div key={i} className="text-center p-4 rounded-xl border border-gray-100 bg-gray-50">
                    <p className="text-2xl font-extrabold mb-1" style={{ color: primary }}>{s.value}</p>
                    <p className="text-xs text-gray-500 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
          {bridge.imageUrl && (
            <div>
              <img src={bridge.imageUrl} alt="" className="rounded-2xl shadow-lg w-full object-cover" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CTASection({ cta, accent, primary }: { cta: MultiLandingPage['content']['cta']; accent: string; primary: string }) {
  return (
    <section className="py-20 px-4 text-white text-center" style={{ backgroundColor: primary }}>
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">{cta.title}</h2>
        <p className="text-white/80 text-lg mb-8">{cta.description}</p>
        <a
          href={cta.buttonLink || `https://wa.me/${cta.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-white text-base font-extrabold shadow-xl transition-transform hover:scale-105 active:scale-95 mb-8"
          style={{ backgroundColor: accent }}
        >
          {cta.buttonText}
          <ArrowRight size={18} />
        </a>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-white/70">
          {cta.phone && (
            <a href={`tel:${cta.phone}`} className="flex items-center gap-2 hover:text-white transition-colors">
              <Phone size={16} /> {cta.phone}
            </a>
          )}
          {cta.email && (
            <a href={`mailto:${cta.email}`} className="flex items-center gap-2 hover:text-white transition-colors">
              <Mail size={16} /> {cta.email}
            </a>
          )}
          {cta.whatsapp && (
            <a href={`https://wa.me/${cta.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
              <MessageCircle size={16} /> WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function FooterSection({ footer, primary }: { footer: MultiLandingPage['content']['footer']; primary: string }) {
  return (
    <footer className="bg-gray-900 text-gray-400 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
          <div className="space-y-2 text-sm">
            {footer.address && (
              <div className="flex items-center gap-2"><MapPin size={14} /> {footer.address}</div>
            )}
            {footer.phone && (
              <div className="flex items-center gap-2"><Phone size={14} />
                <a href={`tel:${footer.phone}`} className="hover:text-white transition-colors">{footer.phone}</a>
              </div>
            )}
            {footer.email && (
              <div className="flex items-center gap-2"><Mail size={14} />
                <a href={`mailto:${footer.email}`} className="hover:text-white transition-colors">{footer.email}</a>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {footer.instagram && (
              <a href={footer.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Instagram size={16} />
              </a>
            )}
            {footer.linkedin && (
              <a href={footer.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                <Linkedin size={16} />
              </a>
            )}
          </div>
        </div>
        <div className="border-t border-white/10 pt-6 text-center text-xs text-gray-500">
          {footer.copyright}
        </div>
      </div>
    </footer>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function LandingPagePublicMulti() {
  const { slug } = useParams<{ slug: string }>();
  const [lp, setLp] = useState<MultiLandingPage | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }

    const q = query(
      collection(db, 'landing_pages'),
      where('slug', '==', slug),
      where('status', '==', 'published'),
      limit(1)
    );

    getDocs(q).then((snap) => {
      if (snap.empty) { setNotFound(true); setLoading(false); return; }
      const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as MultiLandingPage;
      setLp(data);
      setLoading(false);

      // Count page view (fire-and-forget)
      updateDoc(doc(db, 'landing_pages', data.id), { views: increment(1) }).catch(() => {});
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={36} className="animate-spin text-[#1B5E8A]" />
      </div>
    );
  }

  if (notFound || !lp) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4 px-4 text-center">
        <Globe size={48} className="text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-700">Página não encontrada</h1>
        <p className="text-gray-500 text-sm max-w-xs">Esta landing page não existe ou ainda não foi publicada.</p>
      </div>
    );
  }

  const { content, primaryColor: primary, accentColor: accent } = lp;

  return (
    <div className="min-h-screen font-sans" style={{ '--color-primary': hexToRgb(primary), '--color-accent': hexToRgb(accent) } as React.CSSProperties}>
      {/* Sticky nav */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 shadow-md" style={{ backgroundColor: primary }}>
        {content.header.logo ? (
          <img src={content.header.logo} alt="Logo" className="h-8 object-contain" />
        ) : (
          <p className="text-white font-bold text-sm">{content.header.tagline}</p>
        )}
        {content.header.whatsapp && (
          <a
            href={`https://wa.me/${content.header.whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-sm font-bold transition-colors"
            style={{ backgroundColor: accent }}
          >
            <MessageCircle size={14} />
            <span className="hidden sm:inline">WhatsApp</span>
          </a>
        )}
      </nav>

      {/* Sections */}
      <HeroSection hero={content.hero} header={content.header} primary={primary} accent={accent} />
      <ProblemSection problem={content.problem} primary={primary} />
      <SolutionSection solution={content.solution} primary={primary} accent={accent} />
      <SocialProofSection socialProof={content.socialProof} />
      <DifferentialsSection differentials={content.differentials} primary={primary} />
      <BridgeSection bridge={content.bridge} primary={primary} />
      <CTASection cta={content.cta} accent={accent} primary={primary} />
      <FooterSection footer={content.footer} primary={primary} />

      {/* WhatsApp float */}
      <WhatsAppButton whatsapp={content.cta.whatsapp || content.header.whatsapp} accent={accent} />
    </div>
  );
}

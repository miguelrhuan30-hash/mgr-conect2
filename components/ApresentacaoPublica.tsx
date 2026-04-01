/**
 * components/ApresentacaoPublica.tsx — Sprint 51
 *
 * Página pública de visualização de apresentações interativas.
 * Acessível sem autenticação via rota: /p/:slug
 *
 * Fluxo: busca o documento por slug → renderiza slides animados →
 * slide final tem botão "Ver proposta completa" que abre o PDF.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Presentation, SlideData, CollectionName } from '../types';
import {
  SlideRenderer, TEMAS, SLIDE_KEYFRAMES,
} from './ApresentacaoSlides';
import {
  ChevronLeft, ChevronRight, Pause, Play,
  Loader2, AlertCircle, Grid3X3, Download, FileText, X,
} from 'lucide-react';

// ── Labels para cada tipo de slide ──
const SLIDE_LABELS: Record<string, string> = {
  cover: 'Capa', overview: 'Visão Geral', deliverables: 'Entregas',
  timeline: 'Cronograma', investment: 'Investimento', closing: 'Encerramento',
};

// ── PDF Overlay — ORC-05 ─────────────────────────────────────────────────────────────────
type PDFTema = { cardBg: string; border: string; accent: string; text: string; textMuted: string };
const PDFOverlay: React.FC<{ url: string; titulo: string; tema: PDFTema; onClose: () => void }> = ({
  url, titulo, tema, onClose,
}) => {
  const [zoom, setZoom] = useState(1.0);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  const btn: React.CSSProperties = {
    background: tema.cardBg, border: `1px solid ${tema.border}`, color: tema.text,
    borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  };
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column',
        fontFamily: 'system-ui, sans-serif' }}
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', background: tema.cardBg, borderBottom: `1px solid ${tema.border}`,
        flexShrink: 0, gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={15} color={tema.accent} />
          <span style={{ color: tema.text, fontWeight: 700, fontSize: 13, maxWidth: 260,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button style={btn} onClick={() => setZoom(z => parseFloat(Math.max(0.5, z - 0.25).toFixed(2)))}>−</button>
          <span style={{ color: tema.textMuted, fontSize: 12, minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button style={btn} onClick={() => setZoom(z => parseFloat(Math.min(2.0, z + 0.25).toFixed(2)))}>+</button>
          <div style={{ width: 1, height: 20, background: tema.border, margin: '0 2px' }} />
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ ...btn, textDecoration: 'none', color: tema.accent }}>
            <Download size={13} /> Download
          </a>
          <button style={{ ...btn, background: '#ef444411', borderColor: '#ef444466', color: '#ef4444' }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>
      </div>
      {/* PDF iframe */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', justifyContent: 'center', padding: 16 }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top center',
          transition: 'transform 0.2s', width: Math.min(window.innerWidth - 32, 960), flexShrink: 0 }}>
          <iframe src={url} title="Proposta"
            style={{ width: '100%', height: Math.max(window.innerHeight - 80, 500),
              border: 'none', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.6)', display: 'block' }} />
        </div>
      </div>
    </div>
  );
};

const ApresentacaoPublica: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [presentation, setPresentation] = useState<Presentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showDots, setShowDots] = useState(true);
  const [showNav, setShowNav] = useState(false);
  const [showPDF, setShowPDF] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [slideKey, setSlideKey] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideDotsRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // ── Busca por slug + view tracking (ORC-08) ──
  useEffect(() => {
    if (!slug) { setNotFound(true); setLoading(false); return; }
    const fetch = async () => {
      try {
        const q = query(collection(db, CollectionName.PRESENTATIONS), where('slug', '==', slug));
        const snap = await getDocs(q);
        if (snap.empty) { setNotFound(true); setLoading(false); return; }
        const d = snap.docs[0];
        const data = { id: d.id, ...d.data() } as Presentation;
        setPresentation(data);

        // ── Rate limiting: 1 registro por slug a cada 30min (localStorage) ──
        const RL_KEY = `mgr_view_${slug}`;
        const lastView = localStorage.getItem(RL_KEY);
        const now = Date.now();
        const skip = lastView && now - parseInt(lastView) < 30 * 60 * 1000;

        if (!skip) {
          localStorage.setItem(RL_KEY, now.toString());
          // Detectar dispositivo
          const ua = navigator.userAgent;
          const device: 'mobile' | 'tablet' | 'desktop' =
            /Mobi|Android|iPhone/i.test(ua) ? 'mobile' :
            /iPad|Tablet/i.test(ua) ? 'tablet' : 'desktop';
          // Incrementa contador + atualiza lastAccess no Presentation
          updateDoc(doc(db, CollectionName.PRESENTATIONS, d.id), {
            linkPublicoViews: increment(1),
            linkPublicoLastAccess: serverTimestamp(),
          }).catch(() => {});
          // Registra documento em presentationViews
          addDoc(collection(db, CollectionName.PRESENTATION_VIEWS), {
            presentationId: d.id,
            slug,
            viewedAt: serverTimestamp(),
            userAgent: ua.slice(0, 300), // limita tamanho
            device,
          }).catch(() => {});
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [slug]);

  // ── Slides visíveis ──
  const visibleSlides: SlideData[] = presentation
    ? [...presentation.slides].sort((a, b) => a.order - b.order).filter(s => s.visible !== false)
    : [];

  const total = visibleSlides.length;

  const goTo = useCallback((idx: number) => {
    setCurrentIdx(idx);
    setSlideKey(k => k + 1);
    setShowDots(true);
    if (hideDotsRef.current) clearTimeout(hideDotsRef.current);
    hideDotsRef.current = setTimeout(() => setShowDots(false), 3000);
  }, []);

  // goNext / goPrev implemented below
  const goNext = useCallback(() => {
    setCurrentIdx(prev => {
      const next = Math.min(prev + 1, total - 1);
      setSlideKey(k => k + 1);
      return next;
    });
    setShowDots(true);
    if (hideDotsRef.current) clearTimeout(hideDotsRef.current);
    hideDotsRef.current = setTimeout(() => setShowDots(false), 3000);
  }, [total]);

  const goPrev = useCallback(() => {
    setCurrentIdx(prev => {
      const next = Math.max(prev - 1, 0);
      setSlideKey(k => k + 1);
      return next;
    });
    setShowDots(true);
    if (hideDotsRef.current) clearTimeout(hideDotsRef.current);
    hideDotsRef.current = setTimeout(() => setShowDots(false), 3000);
  }, []);

  // ── Autoplay — pausa no hover ou interação manual ──
  useEffect(() => {
    if (!presentation || !playing || total === 0 || isHovering) return;
    const delay = presentation.slideDelayMs ?? 6000;
    timerRef.current = setInterval(() => {
      setCurrentIdx(prev => {
        if (prev >= total - 1) { setPlaying(false); return prev; }
        setSlideKey(k => k + 1);
        return prev + 1;
      });
    }, delay);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [presentation, playing, total, isHovering]);

  // ── Teclado ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { setPlaying(false); goNext(); }
      if (e.key === 'ArrowLeft') { setPlaying(false); goPrev(); }
      if (e.key === 'Escape') { setShowNav(n => !n); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // ── Mostrar dots com movimento do mouse ──
  useEffect(() => {
    const handler = () => {
      setShowDots(true);
      if (hideDotsRef.current) clearTimeout(hideDotsRef.current);
      hideDotsRef.current = setTimeout(() => setShowDots(false), 3000);
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  // ── Loading ──
  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a1628',
    }}>
      <Loader2 size={40} color="#3b82f6" style={{ animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ── Not found ──
  if (notFound || !presentation) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a1628', color: '#94a3b8', gap: 16,
    }}>
      <AlertCircle size={48} color="#ef4444" />
      <h1 style={{ color: 'white', fontSize: 28, fontWeight: 800, margin: 0 }}>Apresentação não encontrada</h1>
      <p>O link pode ter expirado ou a apresentação foi removida.</p>
    </div>
  );

  if (presentation.status === 'arquivada') return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a1628', color: '#94a3b8', gap: 16,
    }}>
      <AlertCircle size={48} color="#f59e0b" />
      <h1 style={{ color: 'white', fontSize: 24, fontWeight: 800, margin: 0 }}>Esta apresentação foi arquivada</h1>
      <p>Por favor solicite um novo link ao responsável pelo projeto.</p>
    </div>
  );

  if (total === 0) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0a1628', color: '#94a3b8',
    }}>
      <p>Esta apresentação não possui slides visíveis.</p>
    </div>
  );

  const tema = TEMAS[presentation.tema ?? 'dark-navy'];
  const currentSlide = visibleSlides[currentIdx];
  const progress = ((currentIdx) / (total - 1)) * 100;

  // ── Touch handlers (swipe mobile) ──
  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) { setPlaying(false); if (diff > 0) goNext(); else goPrev(); }
  };

  return (
    <div
      style={{ width: '100vw', height: '100vh', overflow: 'hidden',
        background: tema.bg, position: 'relative', fontFamily: 'system-ui, sans-serif',
        userSelect: 'none' }}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── CSS animações ── */}
      <style>{SLIDE_KEYFRAMES}</style>

      {/* ── Slide atual ── */}
      <div
        key={`slide-${currentIdx}-${slideKey}`}
        style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }}
      >
        <SlideRenderer
          slide={currentSlide}
          tema={tema}
          pdfUrl={presentation.pdfUrl}
          onOpenPDF={() => setShowPDF(true)}
          presentation={{
            responsavel: presentation.responsavel,
            responsavelEmail: presentation.responsavelEmail,
            responsavelTelefone: presentation.responsavelTelefone,
          }}
        />
      </div>

      {/* ── Barra de progresso ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: `${tema.accent}22`, zIndex: 50,
      }}>
        <div style={{
          height: '100%', background: tema.accent,
          width: `${progress}%`, transition: 'width 0.6s ease',
        }} />
      </div>

      {/* ── Navegação (setas) ── */}
      {currentIdx > 0 && (
        <button onClick={() => { setPlaying(false); goPrev(); }} style={{
          position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
          background: `${tema.cardBg}cc`, border: `1px solid ${tema.border}`,
          borderRadius: 12, width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 50,
          opacity: showDots ? 1 : 0, transition: 'opacity 0.3s',
          backdropFilter: 'blur(8px)',
        }}>
          <ChevronLeft size={20} color={tema.text} />
        </button>
      )}
      {currentIdx < total - 1 && (
        <button onClick={() => { setPlaying(false); goNext(); }} style={{
          position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)',
          background: `${tema.cardBg}cc`, border: `1px solid ${tema.border}`,
          borderRadius: 12, width: 44, height: 44,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', zIndex: 50,
          opacity: showDots ? 1 : 0, transition: 'opacity 0.3s',
          backdropFilter: 'blur(8px)',
        }}>
          <ChevronRight size={20} color={tema.text} />
        </button>
      )}

      {/* ── Controles inferiores (dots + play) ── */}
      <div style={{
        position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 50,
        opacity: showDots ? 1 : 0, transition: 'opacity 0.4s',
      }}>
        {/* Play/Pause */}
        <button onClick={() => setPlaying(p => !p)} style={{
          background: `${tema.cardBg}cc`, border: `1px solid ${tema.border}`,
          borderRadius: 10, width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}>
          {playing
            ? <Pause size={14} color={tema.text} />
            : <Play size={14} color={tema.accent} />}
        </button>

        {/* Dots */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {visibleSlides.map((_, i) => (
            <button key={i} onClick={() => { setPlaying(false); setCurrentIdx(i); setSlideKey(k => k + 1); }} style={{
              width: i === currentIdx ? 24 : 8,
              height: 8, borderRadius: 4,
              background: i === currentIdx ? tema.accent : `${tema.accent}44`,
              border: 'none', cursor: 'pointer',
              transition: 'width 0.3s, background 0.3s',
              padding: 0,
            }} title={SLIDE_LABELS[visibleSlides[i].type] ?? ''} />
          ))}
        </div>

        {/* Índice */}
        <span style={{
          color: tema.textMuted, fontSize: 12, fontWeight: 600,
          background: `${tema.cardBg}cc`, padding: '4px 10px',
          borderRadius: 20, backdropFilter: 'blur(8px)',
          border: `1px solid ${tema.border}`,
        }}>
          {currentIdx + 1} / {total}
        </span>

        {/* Grade thumbnails */}
        <button onClick={() => setShowNav(n => !n)} style={{
          background: `${tema.cardBg}cc`, border: `1px solid ${tema.border}`,
          borderRadius: 10, width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(8px)',
        }}>
          <Grid3X3 size={14} color={tema.text} />
        </button>
      </div>

      {/* ── Panel de navegação por grade ── */}
      {showNav && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: `${tema.bg}ee`, backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 24,
          padding: 40,
        }} onClick={() => setShowNav(false)}>
          <h3 style={{ color: tema.text, fontSize: 20, fontWeight: 700, margin: 0 }}>
            {presentation.projetoTitulo}
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(total, 3)}, 1fr)`,
            gap: 16, maxWidth: 700,
          }}>
            {visibleSlides.map((s, i) => (
              <button key={i} onClick={(e) => {
                e.stopPropagation();
                setCurrentIdx(i); setSlideKey(k => k + 1); setShowNav(false); setPlaying(false);
              }} style={{
                background: i === currentIdx ? `${tema.accent}22` : tema.cardBg,
                border: `2px solid ${i === currentIdx ? tema.accent : tema.border}`,
                borderRadius: 12, padding: '16px 20px',
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 12,
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: i === currentIdx ? tema.accent : `${tema.accent}22`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: i === currentIdx ? 'white' : tema.accent,
                  fontWeight: 800, fontSize: 14, flexShrink: 0,
                }}>
                  {i + 1}
                </div>
                <div>
                  <div style={{ color: tema.text, fontWeight: 600, fontSize: 14 }}>
                    {SLIDE_LABELS[s.type]}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p style={{ color: tema.textMuted, fontSize: 13 }}>Pressione ESC para fechar</p>
        </div>
      )}

      {/* Click em área central para avançar */}
      <div
        style={{ position: 'absolute', inset: 0, zIndex: 10 }}
        onClick={() => { if (!showNav) { setPlaying(false); goNext(); } }}
      />

      {/* ── PDF Overlay (ORC-05) — abre lazy ao clicar no botão CTA ── */}
      {showPDF && presentation.pdfUrl && (
        <PDFOverlay
          url={presentation.pdfUrl}
          titulo={presentation.projetoTitulo}
          tema={tema}
          onClose={() => setShowPDF(false)}
        />
      )}
    </div>
  );
};

export default ApresentacaoPublica;

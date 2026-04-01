/**
 * components/ApresentacaoSlides.tsx — Sprint 51
 *
 * Renderizadores dos 6 tipos de slide para apresentações interativas.
 * Design dark premium com animações CSS puras (@keyframes).
 * Usado tanto na visualização pública (/p/:slug) quanto no preview do editor.
 */
import React from 'react';
import {
  SlideData, CoverData, OverviewData, DeliverablesData,
  TimelineData, InvestmentData, ClosingData, PresentationTema,
} from '../types';
import {
  MapPin, Thermometer, Target, Maximize2, CheckCircle2,
  Clock, DollarSign, Mail, Phone, FileText, ExternalLink,
  ChevronRight, Layers,
} from 'lucide-react';

// ─── Tema ─────────────────────────────────────────────────────────────────────
export interface TemaConfig {
  bg: string;
  bgSecondary: string;
  accent: string;
  accentLight: string;
  accentMuted: string;
  text: string;
  textMuted: string;
  border: string;
  cardBg: string;
}

export const TEMAS: Record<PresentationTema, TemaConfig> = {
  'dark-navy': {
    bg: '#0a1628',           bgSecondary: '#0f2040',
    accent: '#3b82f6',       accentLight: '#60a5fa',
    accentMuted: '#1e3a5f',  text: '#f0f6ff',
    textMuted: '#94a3b8',    border: '#1e3a5f',
    cardBg: '#0d1f3c',
  },
  'dark-slate': {
    bg: '#0f172a',           bgSecondary: '#1e293b',
    accent: '#22d3ee',       accentLight: '#67e8f9',
    accentMuted: '#164e63',  text: '#f0fdff',
    textMuted: '#94a3b8',    border: '#1e3a5f',
    cardBg: '#1e293b',
  },
  'dark-teal': {
    bg: '#0f2027',           bgSecondary: '#1a3040',
    accent: '#10b981',       accentLight: '#34d399',
    accentMuted: '#064e3b',  text: '#f0fdf4',
    textMuted: '#94a3b8',    border: '#065f46',
    cardBg: '#1a3040',
  },
  // Tema laranja MGR — replica o visual dos HTMLs aprovados pela equipe
  'mgr-classic': {
    bg: '#0A1628',           bgSecondary: '#0d1f35',
    accent: '#E8593C',       accentLight: '#f07249',
    accentMuted: '#3d1a10',  text: '#f8fafc',
    textMuted: '#94a3b8',    border: '#1e3550',
    cardBg: '#0d1f35',
  },
};

// ─── CSS de animação injetado globalmente ─────────────────────────────────────
export const SLIDE_KEYFRAMES = `
@keyframes slideIn    { from { opacity:0; transform:translateY(40px); } to { opacity:1; transform:translateY(0); } }
@keyframes fadeIn     { from { opacity:0; } to { opacity:1; } }
@keyframes slideLeft  { from { opacity:0; transform:translateX(-30px); } to { opacity:1; transform:translateX(0); } }
@keyframes slideRight { from { opacity:0; transform:translateX(30px); } to { opacity:1; transform:translateX(0); } }
@keyframes pulse      { 0%,100% { opacity:1; } 50% { opacity:.6; } }
@keyframes shimmer    { from { background-position:-200% 0; } to { background-position:200% 0; } }
@keyframes countUp    { from { transform:scaleY(0); } to { transform:scaleY(1); } }
.slide-anim-in    { animation: slideIn  0.7s cubic-bezier(.16,1,.3,1) both; }
.slide-anim-fade  { animation: fadeIn   0.6s ease both; }
.slide-anim-left  { animation: slideLeft  0.6s cubic-bezier(.16,1,.3,1) both; }
.slide-anim-right { animation: slideRight 0.6s cubic-bezier(.16,1,.3,1) both; }
.slide-delay-1 { animation-delay: 0.1s; }
.slide-delay-2 { animation-delay: 0.25s; }
.slide-delay-3 { animation-delay: 0.4s; }
.slide-delay-4 { animation-delay: 0.55s; }
.slide-delay-5 { animation-delay: 0.7s; }
.slide-delay-6 { animation-delay: 0.85s; }
`;

// ─── Componentes auxiliares ───────────────────────────────────────────────────
const MGRLogo: React.FC<{ accent: string; size?: number }> = ({ accent, size = 40 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 0 20px ${accent}44`,
    }}>
      <svg viewBox="0 0 24 24" fill="white" width={size * 0.55} height={size * 0.55}>
        <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
      </svg>
    </div>
    <span style={{ color: 'white', fontWeight: 800, fontSize: size * 0.45, letterSpacing: 2 }}>MGR</span>
  </div>
);

const Divider: React.FC<{ accent: string }> = ({ accent }) => (
  <div style={{ width: 60, height: 3, borderRadius: 2, background: accent, margin: '16px 0' }} />
);

// ─── Slide: COVER ─────────────────────────────────────────────────────────────
export const SlideCover: React.FC<{ data: CoverData; tema: TemaConfig }> = ({ data, tema }) => (
  <div style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: `radial-gradient(ellipse at 20% 50%, ${tema.accentMuted} 0%, ${tema.bg} 60%)`,
    padding: '6% 8%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
  }}>
    {/* Background geometric accent */}
    <div style={{
      position: 'absolute', right: '-5%', top: '50%', transform: 'translateY(-50%)',
      width: '45%', aspectRatio: '1', borderRadius: '50%',
      background: `radial-gradient(circle, ${tema.accentMuted} 0%, transparent 70%)`,
      opacity: 0.6,
    }} />

    {/* Logo */}
    {data.usarLogoMGR !== false && (
      <div className="slide-anim-fade slide-delay-1" style={{ marginBottom: 'auto' }}>
        <MGRLogo accent={tema.accent} size={44} />
      </div>
    )}

    {/* Main content */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', zIndex: 1 }}>
      {data.clienteNome && (
        <div className="slide-anim-left slide-delay-1" style={{
          color: tema.accent, fontSize: 'clamp(11px, 1.8vw, 16px)', fontWeight: 700,
          letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16,
        }}>
          {data.clienteNome}
        </div>
      )}

      <h1 className="slide-anim-in slide-delay-2" style={{
        color: tema.text, fontSize: 'clamp(24px, 5vw, 58px)',
        fontWeight: 900, lineHeight: 1.1, margin: 0, maxWidth: '70%',
      }}>
        {data.titulo || 'Título do Projeto'}
      </h1>

      {data.subtitulo && (
        <p className="slide-anim-in slide-delay-3" style={{
          color: tema.textMuted, fontSize: 'clamp(13px, 2vw, 22px)',
          marginTop: 16, maxWidth: '60%',
        }}>
          {data.subtitulo}
        </p>
      )}

      <Divider accent={tema.accent} />

      {data.dataValidade && (
        <div className="slide-anim-fade slide-delay-4" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          color: tema.textMuted, fontSize: 'clamp(11px, 1.5vw, 14px)',
        }}>
          <Clock size={14} color={tema.accent} />
          Válido até {data.dataValidade}
        </div>
      )}
    </div>

    {/* Footer */}
    <div className="slide-anim-fade slide-delay-5" style={{
      color: tema.textMuted, fontSize: 'clamp(10px, 1.2vw, 12px)',
      borderTop: `1px solid ${tema.border}`, paddingTop: 16, marginTop: 32,
    }}>
      MGR Refrigeração · mgrrefrigeracao.com.br
    </div>
  </div>
);

// ─── Slide: OVERVIEW ──────────────────────────────────────────────────────────
export const SlideOverview: React.FC<{ data: OverviewData; tema: TemaConfig }> = ({ data, tema }) => {
  const infos = [
    { icon: MapPin,      label: 'Localização',   value: data.localizacao },
    { icon: Thermometer, label: 'Temperatura',    value: data.temperatura },
    { icon: Target,      label: 'Finalidade',     value: data.finalidade },
    { icon: Maximize2,   label: 'Metragem',       value: data.metragem },
  ].filter(i => i.value);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: `linear-gradient(160deg, ${tema.bg} 0%, ${tema.bgSecondary} 100%)`,
      padding: '6% 8%', boxSizing: 'border-box',
    }}>
      <div className="slide-anim-left slide-delay-1" style={{
        color: tema.accent, fontSize: 'clamp(10px, 1.5vw, 13px)',
        fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
      }}>
        Visão Geral do Projeto
      </div>
      <h2 className="slide-anim-in" style={{
        color: tema.text, fontSize: 'clamp(22px, 4vw, 42px)',
        fontWeight: 800, margin: 0, lineHeight: 1.1,
      }}>
        Escopo & Especificações
      </h2>
      <Divider accent={tema.accent} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4% 5%', flex: 1 }}>
        {/* Descrição */}
        {data.descricao && (
          <div className="slide-anim-fade slide-delay-2" style={{
            gridColumn: '1 / -1', background: tema.cardBg,
            border: `1px solid ${tema.border}`, borderRadius: 16,
            padding: '4% 5%',
          }}>
            <p style={{ color: tema.textMuted, fontSize: 'clamp(12px, 1.6vw, 16px)', lineHeight: 1.7, margin: 0 }}>
              {data.descricao}
            </p>
          </div>
        )}

        {infos.map(({ icon: Icon, label, value }, i) => (
          <div key={label} className={`slide-anim-in slide-delay-${i + 3}`} style={{
            background: tema.cardBg, border: `1px solid ${tema.border}`,
            borderRadius: 16, padding: '5% 6%',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `${tema.accent}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon size={18} color={tema.accent} />
            </div>
            <div>
              <div style={{ color: tema.textMuted, fontSize: 'clamp(9px, 1.2vw, 11px)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
                {label}
              </div>
              <div style={{ color: tema.text, fontSize: 'clamp(12px, 1.8vw, 18px)', fontWeight: 700 }}>
                {value}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Slide: DELIVERABLES ──────────────────────────────────────────────────────
export const SlideDeliverables: React.FC<{ data: DeliverablesData; tema: TemaConfig }> = ({ data, tema }) => (
  <div style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: `linear-gradient(160deg, ${tema.bg} 0%, ${tema.bgSecondary} 100%)`,
    padding: '5% 7%', boxSizing: 'border-box',
  }}>
    <div className="slide-anim-left slide-delay-1" style={{
      color: tema.accent, fontSize: 'clamp(10px, 1.5vw, 13px)',
      fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
    }}>
      Entregas & Escopo
    </div>
    <h2 className="slide-anim-in" style={{
      color: tema.text, fontSize: 'clamp(22px, 4vw, 42px)',
      fontWeight: 800, margin: 0, lineHeight: 1.1,
    }}>
      O que está incluído
    </h2>
    <Divider accent={tema.accent} />

    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${Math.min(data.items.length, 4) <= 2 ? 2 : Math.min(data.items.length, 4) <= 3 ? 3 : 4}, 1fr)`,
      gap: '3% 2%', flex: 1,
    }}>
      {data.items.map((item, i) => (
        <div key={item.id} className={`slide-anim-in slide-delay-${Math.min(i + 2, 6)}`} style={{
          background: tema.cardBg, border: `1px solid ${tema.border}`,
          borderLeft: `3px solid ${tema.accent}`,
          borderRadius: 12, padding: '5%',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <CheckCircle2 size={16} color={tema.accent} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{
                color: tema.accent, fontSize: 'clamp(9px, 1.1vw, 11px)',
                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4,
              }}>
                {item.categoria}
              </div>
              <div style={{ color: tema.text, fontSize: 'clamp(11px, 1.3vw, 14px)', lineHeight: 1.5 }}>
                {item.descricao}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Slide: TIMELINE ──────────────────────────────────────────────────────────
export const SlideTimeline: React.FC<{ data: TimelineData; tema: TemaConfig }> = ({ data, tema }) => (
  <div style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: `linear-gradient(160deg, ${tema.bg} 0%, ${tema.bgSecondary} 100%)`,
    padding: '5% 7%', boxSizing: 'border-box',
  }}>
    <div className="slide-anim-left slide-delay-1" style={{
      color: tema.accent, fontSize: 'clamp(10px, 1.5vw, 13px)',
      fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
    }}>
      Cronograma
    </div>
    <h2 className="slide-anim-in" style={{
      color: tema.text, fontSize: 'clamp(22px, 4vw, 42px)',
      fontWeight: 800, margin: 0, lineHeight: 1.1,
    }}>
      Fases do Projeto
    </h2>
    {data.totalDias && (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8,
        background: `${tema.accent}22`, border: `1px solid ${tema.accent}44`,
        borderRadius: 20, padding: '4px 14px',
        color: tema.accent, fontSize: 'clamp(11px, 1.4vw, 14px)', fontWeight: 700,
      }}>
        <Clock size={12} />
        Total: {data.totalDias}
      </div>
    )}
    <Divider accent={tema.accent} />

    {/* Timeline horizontal */}
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 0 }}>
        {data.fases.map((fase, i) => (
          <div key={fase.id} className={`slide-anim-${i % 2 === 0 ? 'in' : 'fade'} slide-delay-${Math.min(i + 2, 6)}`}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            {/* Connector line */}
            {i < data.fases.length - 1 && (
              <div style={{
                position: 'absolute', left: '50%', top: 18,
                width: '100%', height: 2, background: `${tema.accent}44`,
              }} />
            )}
            {/* Node */}
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: `linear-gradient(135deg, ${tema.accent}, ${tema.accentLight})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, color: 'white', fontSize: 14,
              zIndex: 1, boxShadow: `0 0 15px ${tema.accent}55`,
              position: 'relative',
            }}>
              {i + 1}
            </div>
            {/* Content */}
            <div style={{
              textAlign: 'center',
              background: tema.cardBg, border: `1px solid ${tema.border}`,
              borderRadius: 12, padding: 16, marginTop: 12, width: '85%',
            }}>
              <div style={{
                color: tema.accent, fontSize: 'clamp(10px, 1.2vw, 12px)',
                fontWeight: 700, marginBottom: 4,
              }}>
                {fase.prazo}
              </div>
              <div style={{ color: tema.text, fontSize: 'clamp(11px, 1.4vw, 14px)', fontWeight: 700, marginBottom: 4 }}>
                {fase.nome}
              </div>
              {fase.descricao && (
                <div style={{ color: tema.textMuted, fontSize: 'clamp(9px, 1.1vw, 11px)', lineHeight: 1.4 }}>
                  {fase.descricao}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─── Slide: INVESTMENT ────────────────────────────────────────────────────────
export const SlideInvestment: React.FC<{ data: InvestmentData; tema: TemaConfig }> = ({ data, tema }) => (
  <div style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    background: `radial-gradient(ellipse at 80% 20%, ${tema.accentMuted} 0%, ${tema.bg} 60%)`,
    padding: '5% 7%', boxSizing: 'border-box',
  }}>
    <div className="slide-anim-left slide-delay-1" style={{
      color: tema.accent, fontSize: 'clamp(10px, 1.5vw, 13px)',
      fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 8,
    }}>
      Investimento
    </div>
    <h2 className="slide-anim-in" style={{
      color: tema.text, fontSize: 'clamp(22px, 4vw, 42px)',
      fontWeight: 800, margin: 0, lineHeight: 1.1,
    }}>
      Condições Financeiras
    </h2>
    <Divider accent={tema.accent} />

    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4% 5%', flex: 1 }}>
      {/* Valor total */}
      <div className="slide-anim-left slide-delay-2" style={{
        background: `linear-gradient(135deg, ${tema.accent}22, ${tema.accentMuted})`,
        border: `1px solid ${tema.accent}66`,
        borderRadius: 20, padding: '8% 6%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{
          color: tema.textMuted, fontSize: 'clamp(10px, 1.3vw, 13px)',
          textTransform: 'uppercase', letterSpacing: 2, marginBottom: 12,
        }}>
          Valor Total do Projeto
        </div>
        <div style={{
          color: tema.text, fontWeight: 900,
          fontSize: 'clamp(20px, 4vw, 46px)', lineHeight: 1,
        }}>
          {data.valorTotal || '—'}
        </div>
      </div>

      {/* Parcelas */}
      <div className="slide-anim-right slide-delay-3" style={{
        background: tema.cardBg, border: `1px solid ${tema.border}`,
        borderRadius: 20, padding: '5% 6%',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{
          color: tema.textMuted, fontSize: 'clamp(10px, 1.3vw, 13px)',
          textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4,
        }}>
          Forma de Pagamento
        </div>
        {data.parcelas?.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: `${tema.accent}11`,
            borderRadius: 10, border: `1px solid ${tema.border}`,
          }}>
            <div>
              <span style={{
                color: tema.accent, fontWeight: 800,
                fontSize: 'clamp(11px, 1.5vw, 16px)', marginRight: 8,
              }}>
                {p.percentual}
              </span>
              <span style={{ color: tema.textMuted, fontSize: 'clamp(10px, 1.2vw, 13px)' }}>
                {p.label}
              </span>
            </div>
            <span style={{ color: tema.text, fontWeight: 700, fontSize: 'clamp(10px, 1.3vw, 14px)' }}>
              {p.valor}
            </span>
          </div>
        ))}
      </div>

      {/* Breakdown (se existir) */}
      {data.breakdown && data.breakdown.length > 0 && (
        <div className="slide-anim-in slide-delay-4" style={{
          gridColumn: '1 / -1',
          background: tema.cardBg, border: `1px solid ${tema.border}`,
          borderRadius: 16, padding: '4% 5%',
        }}>
          <div style={{ color: tema.textMuted, fontSize: '12px', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            Composição do Valor
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {data.breakdown.map(b => (
              <div key={b.id} style={{
                flex: '1 1 auto', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', padding: '6px 10px',
                borderBottom: `1px solid ${tema.border}`,
              }}>
                <span style={{ color: tema.textMuted, fontSize: '13px' }}>{b.label}</span>
                <span style={{ color: tema.text, fontWeight: 700, fontSize: '13px' }}>{b.valor}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observações */}
      {data.observacoes && (
        <div className="slide-anim-fade slide-delay-5" style={{
          gridColumn: '1 / -1',
          color: tema.textMuted, fontSize: 'clamp(10px, 1.3vw, 13px)',
          fontStyle: 'italic', padding: '8px 0',
        }}>
          * {data.observacoes}
        </div>
      )}
    </div>
  </div>
);

// ─── Slide: CLOSING ───────────────────────────────────────────────────────────
export const SlideClosing: React.FC<{
  data: ClosingData;
  tema: TemaConfig;
  pdfUrl?: string | null;
  onOpenPDF?: () => void;
  presentation: { responsavel?: string; responsavelEmail?: string; responsavelTelefone?: string };
}> = ({ data, tema, pdfUrl, onOpenPDF, presentation }) => (
  <div style={{
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: `radial-gradient(ellipse at 50% 30%, ${tema.accentMuted} 0%, ${tema.bg} 65%)`,
    padding: '6% 10%', boxSizing: 'border-box', textAlign: 'center',
  }}>
    <div className="slide-anim-fade slide-delay-1" style={{ marginBottom: 24 }}>
      <MGRLogo accent={tema.accent} size={48} />
    </div>

    {data.textoFechamento && (
      <p className="slide-anim-in slide-delay-2" style={{
        color: tema.textMuted, fontSize: 'clamp(14px, 2vw, 22px)',
        maxWidth: 600, lineHeight: 1.7, margin: '0 0 40px',
      }}>
        {data.textoFechamento}
      </p>
    )}

    {/* Botão CTA — abre overlay de PDF (ORC-05) */}
    {pdfUrl && (
      <button
        onClick={onOpenPDF}
        className="slide-anim-in slide-delay-3"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 10,
          background: `linear-gradient(135deg, ${tema.accent}, ${tema.accentLight})`,
          color: 'white', fontWeight: 800,
          fontSize: 'clamp(13px, 1.8vw, 18px)',
          padding: '14px 32px', borderRadius: 50,
          border: 'none', cursor: 'pointer', marginBottom: 40,
          boxShadow: `0 8px 30px ${tema.accent}55`,
          transition: 'transform .2s, box-shadow .2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = `0 12px 40px ${tema.accent}77`;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = `0 8px 30px ${tema.accent}55`;
        }}
      >
        <FileText size={18} />
        {data.textoCTA || 'Ver proposta completa'}
        <ExternalLink size={14} />
      </button>
    )}

    {/* Contato */}
    {data.exibirContato !== false && (presentation.responsavel || presentation.responsavelEmail) && (
      <div className="slide-anim-fade slide-delay-4" style={{
        display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center',
      }}>
        {presentation.responsavel && (
          <div style={{ color: tema.textMuted, fontSize: 'clamp(11px, 1.4vw, 14px)' }}>
            <span style={{ color: tema.text, fontWeight: 700 }}>{presentation.responsavel}</span>
          </div>
        )}
        {presentation.responsavelEmail && (
          <a href={`mailto:${presentation.responsavelEmail}`} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: tema.textMuted, fontSize: 'clamp(11px, 1.4vw, 14px)', textDecoration: 'none',
          }}>
            <Mail size={13} color={tema.accent} />
            {presentation.responsavelEmail}
          </a>
        )}
        {presentation.responsavelTelefone && (
          <a href={`tel:${presentation.responsavelTelefone}`} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            color: tema.textMuted, fontSize: 'clamp(11px, 1.4vw, 14px)', textDecoration: 'none',
          }}>
            <Phone size={13} color={tema.accent} />
            {presentation.responsavelTelefone}
          </a>
        )}
      </div>
    )}
  </div>
);

// ─── Dispatcher ───────────────────────────────────────────────────────────────
export const SlideRenderer: React.FC<{
  slide: SlideData;
  tema: TemaConfig;
  pdfUrl?: string | null;
  onOpenPDF?: () => void;
  presentation: { responsavel?: string; responsavelEmail?: string; responsavelTelefone?: string };
}> = ({ slide, tema, pdfUrl, onOpenPDF, presentation }) => {
  switch (slide.type) {
    case 'cover':        return <SlideCover        data={slide.data} tema={tema} />;
    case 'overview':     return <SlideOverview      data={slide.data} tema={tema} />;
    case 'deliverables': return <SlideDeliverables  data={slide.data} tema={tema} />;
    case 'timeline':     return <SlideTimeline      data={slide.data} tema={tema} />;
    case 'investment':   return <SlideInvestment    data={slide.data} tema={tema} />;
    case 'closing':      return <SlideClosing data={slide.data} tema={tema} pdfUrl={pdfUrl} onOpenPDF={onOpenPDF} presentation={presentation} />;
    default:             return null;
  }
};

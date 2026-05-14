// Injeta CSS responsivo global — cobre todas as páginas
(function() {
  const s = document.createElement('style');
  s.textContent = `
    /* ── carousel de fotos ──────────────────────────────────── */
    .photo-carousel-scroll::-webkit-scrollbar { display: none; }
    .carousel-item {
      flex: 0 0 560px;
      height: 380px;
      flex-shrink: 0;
      scroll-snap-align: start;
      border-radius: 4px;
      overflow: hidden;
      position: relative;
      background: #0d3b5e;
    }

    /* ── componentes UI ─────────────────────────────────────── */
    .hamburger-btn { display: none !important; }
    .mobile-nav {
      display: none; position: absolute; top: 100%; left: 0; right: 0;
      background: rgba(13,59,94,0.99); backdrop-filter: blur(16px);
      border-top: 1px solid rgba(255,255,255,0.12); z-index: 200;
      max-height: 85vh; overflow-y: auto;
    }
    .mobile-nav.open { display: block; }

    /* ══ TABLET ≤ 1100px ══════════════════════════════════════ */
    @media (max-width: 1100px) {
      /* Header */
      .hamburger-btn { display: flex !important; align-items: center; justify-content: center;
        background: transparent; border: 1px solid rgba(255,255,255,0.28); border-radius: 8px;
        padding: 9px; cursor: pointer; color: white; flex-shrink: 0; }
      .nav-links { display: none !important; }
      .header-cta-secondary { display: none !important; }
      .header-logo-img { height: 64px !important; width: auto !important; }

      /* Footer */
      .footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
      footer.pad { padding-left: 32px !important; padding-right: 32px !important; }

      /* Grids 3-6 colunas → 2 colunas */
      [style*="repeat(3, 1fr)"],
      [style*="repeat(4, 1fr)"],
      [style*="repeat(5, 1fr)"],
      [style*="repeat(6, 1fr)"] {
        grid-template-columns: repeat(2, 1fr) !important;
        gap: 24px !important;
      }
      /* Colunas fixas largas */
      [style*="480px 1fr"], [style*="1fr 480px"], [style*="380px 1fr"] {
        grid-template-columns: 1fr !important; gap: 40px !important;
      }
      /* Seções com padding grande */
      [style*="120px 56px"] { padding: 72px 32px !important; }
      [style*="80px 56px 96px"] { padding: 56px 32px 64px !important; }
      [style*="80px 56px 32px"] { padding: 48px 32px 24px !important; }
      [style*="56px 64px"] { padding: 40px 32px !important; }
      /* Alturas fixas fotos */
      [style*="height: 460px"] { height: 260px !important; }
      [style*="gridTemplateRows"][style*="220px"] { grid-template-rows: 160px 160px !important; }
      /* Carousel + foto destaque */
      .carousel-item { flex: 0 0 75vw; height: 300px; }
      .feat-photo { min-height: 360px !important; }
    }

    /* ══ MOBILE ≤ 640px ═══════════════════════════════════════ */
    @media (max-width: 640px) {
      /* Header */
      .header-logo-img { height: 48px !important; }

      /* Footer */
      .footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
      footer.pad { padding: 48px 20px 28px !important; }
      footer .header-logo-img { height: 80px !important; }

      /* TODOS os grids inline → 1 coluna */
      [style*="grid-template-columns"] {
        grid-template-columns: 1fr !important;
        gap: 20px !important;
      }

      /* Seções — paddings */
      [style*="120px 56px"] { padding: 48px 20px !important; }
      [style*="80px 56px"] { padding: 40px 20px !important; }
      [style*="56px 64px"] { padding: 36px 20px !important; }
      [style*="48px 48px 56px"] { padding: 32px 20px !important; }

      /* Fotos com altura fixa */
      [style*="height: 460px"],
      [style*="height: 220px"] {
        height: auto !important;
        aspect-ratio: 16/9 !important;
        min-height: 180px !important;
      }
      /* Carousel + foto destaque mobile */
      .carousel-item { flex: 0 0 85vw; height: 220px; }
      .feat-photo { min-height: 220px !important; }
      /* Reset row span */
      [style*="grid-row:"], [style*="gridRow"] { grid-row: auto !important; }

      /* Títulos h1/h2 (override inline) */
      h1 { font-size: clamp(32px, 9vw, 56px) !important; line-height: 1.05 !important; letter-spacing: -1px !important; }
      h2 { font-size: clamp(26px, 7vw, 40px) !important; line-height: 1.1 !important; }
      h3 { font-size: clamp(20px, 5vw, 30px) !important; }

      /* Texto manifesto (42px hardcoded) */
      p[style*="font-size: 42px"],
      p[style*="fontSize: 42"] { font-size: clamp(22px, 5.5vw, 36px) !important; }

      /* Números da trust strip */
      div[style*="font-size: 42px"] { font-size: clamp(28px, 7vw, 42px) !important; }

      /* CTA buttons → largura total */
      section button, section a[style*="border-radius: 8px"] {
        width: 100% !important; justify-content: center !important; box-sizing: border-box !important;
      }

      /* Grids de botões lado a lado → coluna */
      div[style*="display: flex"][style*="gap: 12px"] {
        flex-direction: column !important;
        align-items: stretch !important;
      }
    }
  `;
  document.head.appendChild(s);
})();

// Tokens oficiais do Brand Guide MGR + helpers compartilhados
const MGR = {
  // Primárias
  azul: '#1B5E8A',
  laranja: '#D4792A',
  // Secundárias
  azulEscuro: '#0D3B5E',
  azulClaro: '#E8F1F8',
  laranjaSuave: '#FDF0E4',
  // Acento CTA
  acento: '#E8611A',
  // Neutros
  grafite: '#2D2D2D',
  cinzaMedio: '#6B7280',
  cinzaClaro: '#F3F4F6',
  branco: '#FFFFFF',
  preto: '#111111',
  // Semânticas
  sucesso: '#16A34A',
  alerta: '#EAB308',
  erro: '#DC2626',
  info: '#2563EB',
  // Fontes
  sans: 'Inter, Arial, sans-serif',
  mono: '"JetBrains Mono", "Courier New", monospace',
};

// Logo MGR oficial — imagem real (montanhas + arco + wordmark + descritivo)
function MGRLogo({ size = 48, inverse = false, descritivo = false }) {
  // O PNG tem bastante padding transparente; tratamos size como altura visual total.
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MGR.sans }}>
      <img
        src="assets/mgr-logo.png"
        alt="MGR Soluções e Tecnologia da Refrigeração"
        className="header-logo-img"
        style={{
          height: size,
          width: 'auto',
          display: 'block',
          filter: inverse ? 'brightness(1.15)' : 'none',
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// Placeholder seguindo regra: foto real, levemente dessaturada c/ overlay azul 20-30%
function MGRPhoto({ label, aspect, height, tone = 'azul', overlay = true }) {
  const bases = {
    azul: { bg: '#0d3b5e', stripe: 'rgba(27,94,138,0.18)', text: 'rgba(232,241,248,0.6)' },
    dark: { bg: '#0a1a2a', stripe: 'rgba(27,94,138,0.22)', text: 'rgba(232,241,248,0.55)' },
    claro: { bg: '#dce8f2', stripe: 'rgba(27,94,138,0.08)', text: 'rgba(13,59,94,0.6)' },
    laranja: { bg: '#3a2416', stripe: 'rgba(212,121,42,0.15)', text: 'rgba(253,240,228,0.6)' },
  };
  const t = bases[tone];
  return (
    <div style={{
      height: aspect ? undefined : height,
      aspectRatio: aspect,
      width: '100%',
      background: `repeating-linear-gradient(135deg, ${t.bg} 0 18px, ${t.stripe} 18px 36px)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: t.text,
      fontFamily: MGR.mono,
      fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase',
      position: 'relative', overflow: 'hidden',
      border: tone === 'claro' ? `1px solid rgba(13,59,94,0.1)` : 'none',
    }}>
      {overlay && tone !== 'claro' && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0.1) 0%, rgba(13,59,94,0.35) 100%)' }} />
      )}
      <div style={{ position: 'relative', padding: '8px 14px', border: `1px dashed ${t.text}`, fontSize: 10 }}>
        ▢ FOTO REAL · {label}
      </div>
    </div>
  );
}

// Chip / badge
function Chip({ children, color = MGR.azul, bg, border = true, size = 'md' }) {
  const sizes = {
    sm: { p: '4px 10px', f: 10 },
    md: { p: '6px 14px', f: 11 },
    lg: { p: '8px 18px', f: 13 },
  };
  const s = sizes[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: s.p, fontSize: s.f, fontWeight: 500, letterSpacing: 0.8, textTransform: 'uppercase',
      color, background: bg || 'transparent',
      border: border ? `1px solid ${color}` : 'none',
      borderRadius: 40, fontFamily: MGR.sans,
    }}>{children}</span>
  );
}

function SectionTag({ num, label, color = MGR.laranja }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontFamily: MGR.mono, fontSize: 11, color, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20 }}>
      <span style={{ color }}>●</span>
      <span>{num} · {label}</span>
    </div>
  );
}

// Ícone simples line-style (1.5px) seguindo branding
function Ico({ name, size = 24, color = 'currentColor' }) {
  const paths = {
    shield: 'M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 Z',
    clock: 'M12 7 V12 L15 14 M12 3 A9 9 0 1 0 12.01 3',
    chart: 'M4 20 H20 M7 16 V11 M12 16 V7 M17 16 V13',
    gear: 'M12 9 A3 3 0 1 0 12.01 9 M19 12 L21 12 M3 12 L5 12 M12 3 V5 M12 19 V21 M18 6 L16.5 7.5 M7.5 16.5 L6 18 M18 18 L16.5 16.5 M7.5 7.5 L6 6',
    flake: 'M12 3 V21 M3 12 H21 M5 5 L19 19 M19 5 L5 19',
    check: 'M5 12 L10 17 L19 7',
    arrow: 'M5 12 H19 M13 6 L19 12 L13 18',
    mountain: 'M3 19 L9 9 L13 14 L17 7 L21 19 Z',
    doc: 'M6 3 H14 L18 7 V21 H6 Z M8 12 H16 M8 16 H13',
    bell: 'M6 16 V11 A6 6 0 0 1 18 11 V16 L20 18 H4 Z M10 21 A2 2 0 0 0 14 21',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

// =====================================================================
// HEADER GLOBAL — usado em TODAS as páginas para consistência
// =====================================================================
// Props: active = 'home' | 'ciclo' | 'sobre' | 'trabalhe' | 'contato' | null
const MGR_HOME = '/';
const MGR_LOGIN = 'https://app.mgrrefrigeracao.com.br/#/login';
const MGR_WHATS = 'https://wa.me/5519983073630';
const MGR_TEL = '+5519983073630';
const MGR_EMAIL = 'administrativo.mgr@gmail.com';

function MGRHeader({ active = null }) {
  const [openCiclo, setOpenCiclo] = React.useState(false);
  const [openMobile, setOpenMobile] = React.useState(false);
  const linkBase = { fontSize: 15, color: 'rgba(255,255,255,0.78)', fontWeight: 500, padding: '6px 2px', position: 'relative', whiteSpace: 'nowrap', transition: 'color .15s ease' };
  const linkActive = { color: '#fff', fontWeight: 600 };
  const Underline = ({ show }) => (
    <span style={{ position: 'absolute', left: 0, right: 0, bottom: -8, height: 2, background: show ? MGR.laranja : 'transparent', transition: 'background .15s ease' }} />
  );

  const cicloItems = [
    ['Turnkey Completo', 'turnkey-completo.html'],
    ['Retrofit Turnkey', 'retrofit-turnkey.html'],
    ['Anti-Downtime', 'anti-downtime.html'],
    ['Manutenção Corretiva', 'manutencao-corretiva.html'],
    ['Soluções MGR', 'solucoes-mgr.html'],
  ];

  const allNavItems = [
    { label: 'Início', href: MGR_HOME },
    { label: 'Turnkey Completo', href: 'turnkey-completo.html' },
    { label: 'Retrofit Turnkey', href: 'retrofit-turnkey.html' },
    { label: 'Anti-Downtime', href: 'anti-downtime.html' },
    { label: 'Manutenção Corretiva', href: 'manutencao-corretiva.html' },
    { label: 'Soluções MGR', href: 'solucoes-mgr.html' },
    { label: 'Sobre', href: 'sobre.html' },
    { label: 'Trabalhe Conosco', href: 'trabalhe-conosco.html' },
    { label: 'Contato', href: `${MGR_HOME}#contato` },
    { label: 'Acessar Sistema', href: MGR_LOGIN, accent: true },
  ];

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(13,59,94,0.97)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}>
      <div className="pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 56px', fontFamily: MGR.sans, gap: 24, position: 'relative' }}>
        <a href={MGR_HOME} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-label="Voltar para a home MGR">
          <MGRLogo inverse size={232} />
        </a>

        <nav className="nav-links" style={{ display: 'flex', gap: 38, alignItems: 'center', fontFamily: MGR.sans }}>
          <a href={MGR_HOME} style={{ ...linkBase, ...(active === 'home' ? linkActive : {}) }}>
            Início
            <Underline show={active === 'home'} />
          </a>

          <div
            onMouseEnter={() => setOpenCiclo(true)}
            onMouseLeave={() => setOpenCiclo(false)}
            style={{ position: 'relative', paddingBottom: 4 }}
          >
            <a href={`${MGR_HOME}#ciclo`} style={{ ...linkBase, ...(active === 'ciclo' ? linkActive : {}), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Ciclo de Vida
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: openCiclo ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}>
                <path d="M2 4 L6 8 L10 4" />
              </svg>
              <Underline show={active === 'ciclo'} />
            </a>
            {openCiclo && (
              <div style={{ position: 'absolute', top: '100%', left: -16, marginTop: 8, background: '#fff', minWidth: 260, borderRadius: 10, boxShadow: '0 12px 40px rgba(0,0,0,0.22)', overflow: 'hidden', border: `1px solid ${MGR.cinzaClaro}` }}>
                {cicloItems.map(([label, href], i) => (
                  <a key={i} href={href} style={{ display: 'block', padding: '14px 20px', fontSize: 14, color: MGR.azulEscuro, fontWeight: 500, borderBottom: i < cicloItems.length - 1 ? `1px solid ${MGR.cinzaClaro}` : 'none', transition: 'background .12s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = MGR.azulClaro; e.currentTarget.style.color = MGR.azul; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = MGR.azulEscuro; }}>
                    {label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <a href="sobre.html" style={{ ...linkBase, ...(active === 'sobre' ? linkActive : {}) }}>
            Sobre
            <Underline show={active === 'sobre'} />
          </a>
          <a href="trabalhe-conosco.html" style={{ ...linkBase, ...(active === 'trabalhe' ? linkActive : {}) }}>
            Trabalhe Conosco
            <Underline show={active === 'trabalhe'} />
          </a>
          <a href={`${MGR_HOME}#contato`} style={{ ...linkBase, ...(active === 'contato' ? linkActive : {}) }}>
            Contato
            <Underline show={active === 'contato'} />
          </a>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <a href={MGR_LOGIN} className="header-cta-secondary" style={{ color: 'rgba(255,255,255,0.85)', padding: '11px 16px', fontSize: 13.5, fontWeight: 500, fontFamily: MGR.sans, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: 0.2, border: '1px solid rgba(255,255,255,0.22)' }}>
            Acessar Sistema
          </a>
          <a href={MGR_WHATS} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '11px 20px', fontSize: 13.5, fontWeight: 600, fontFamily: MGR.sans, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8, letterSpacing: 0.2 }}>
            Visita de Valor
            <Ico name="arrow" size={14} />
          </a>
          {/* Hamburger — visível apenas em mobile via CSS */}
          <button
            className="hamburger-btn"
            aria-label={openMobile ? 'Fechar menu' : 'Abrir menu'}
            onClick={() => setOpenMobile(o => !o)}
          >
            {openMobile
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M6 6 L18 18 M6 18 L18 6"/></svg>
              : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M4 6 H20 M4 12 H20 M4 18 H20"/></svg>
            }
          </button>
        </div>

        {/* Menu mobile — dropdown */}
        <div className={`mobile-nav${openMobile ? ' open' : ''}`}>
          <div style={{ padding: '12px 20px 20px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            {allNavItems.map(({ label, href, accent }, i) => (
              <a key={i} href={href} onClick={() => setOpenMobile(false)}
                style={{
                  display: 'block', padding: '13px 16px', fontSize: 15, fontWeight: accent ? 600 : 500,
                  color: accent ? MGR.acento : 'rgba(255,255,255,0.85)',
                  borderRadius: 8, borderBottom: i < allNavItems.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
                  letterSpacing: 0.1,
                }}>
                {label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// FOOTER GLOBAL — padronizado em TODAS as páginas
// =====================================================================
function MGRFooter() {
  const cicloLinks = [
    ['Turnkey Completo', 'turnkey-completo.html'],
    ['Retrofit Turnkey', 'retrofit-turnkey.html'],
    ['Anti-Downtime · Contratos 24/7', 'anti-downtime.html'],
    ['Manutenção Corretiva', 'manutencao-corretiva.html'],
    ['Soluções MGR · PCM, Hack, Connect', 'solucoes-mgr.html'],
  ];
  const empresaLinks = [
    ['Sobre a MGR', 'sobre.html'],
    ['Trabalhe conosco', 'trabalhe-conosco.html'],
  ];

  return (
    <footer style={{ background: MGR.preto, color: 'rgba(255,255,255,0.7)', padding: '80px 56px 32px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr', gap: 48, marginBottom: 56 }} className="grid-footer footer-grid">
          {/* Coluna 1 — Marca e endereço */}
          <div>
            <div style={{ marginBottom: 24 }}><MGRLogo inverse size={200} /></div>
            <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)' }}>
              MGR Soluções e Tecnologia<br />
              da Refrigeração Ltda<br /><br />
              R. Alberto Magnusson, 440<br />
              Comercial Vitoria Martini<br />
              Indaiatuba - SP · 13347-633<br /><br />
              <span style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 0.5, color: 'rgba(255,255,255,0.4)' }}>
                CNPJ 38.062.685/0001-73<br />
                IE 353.426.803.110
              </span>
            </div>
          </div>

          {/* Coluna 2 — Ciclo de Vida */}
          <div>
            <div style={{ fontSize: 11, fontFamily: MGR.mono, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.laranja, marginBottom: 18 }}>Ciclo de Vida</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {cicloLinks.map(([label, href], i) => (
                <a key={i} href={href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', transition: 'color .15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}>{label}</a>
              ))}
            </div>
          </div>

          {/* Coluna 3 — Empresa */}
          <div>
            <div style={{ fontSize: 11, fontFamily: MGR.mono, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.laranja, marginBottom: 18 }}>Empresa</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {empresaLinks.map(([label, href], i) => (
                <a key={i} href={href} style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', transition: 'color .15s' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}>{label}</a>
              ))}
            </div>
          </div>

          {/* Coluna 4 — Contato real */}
          <div>
            <div style={{ fontSize: 11, fontFamily: MGR.mono, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.laranja, marginBottom: 18 }}>Contato</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <a href={MGR_WHATS} target="_blank" rel="noopener" style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#fff' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 }}>WhatsApp Comercial</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>(19) 98307-3630</span>
              </a>
              <a href="https://wa.me/5519971382628" target="_blank" rel="noopener" style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#fff' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 }}>WhatsApp Administrativo</span>
                <span style={{ fontSize: 15, fontWeight: 600 }}>(19) 97138-2628</span>
              </a>
              <a href={`mailto:${MGR_EMAIL}`} style={{ display: 'flex', flexDirection: 'column', gap: 2, color: '#fff', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 }}>E-mail</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{MGR_EMAIL}</span>
              </a>
            </div>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
          <div>© 2026 MGR Soluções e Tecnologia da Refrigeração Ltda · Todos os direitos reservados</div>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ color: 'rgba(255,255,255,0.5)' }}>Política de Privacidade</a>
            <a href="#" style={{ color: 'rgba(255,255,255,0.5)' }}>Termos de Uso</a>
            <a href={MGR_HOME} style={{ color: 'rgba(255,255,255,0.5)' }}>Voltar para a home</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

Object.assign(window, { MGR, MGRLogo, MGRPhoto, Chip, SectionTag, Ico, MGRHeader, MGRFooter, MGR_HOME, MGR_LOGIN, MGR_WHATS, MGR_TEL, MGR_EMAIL });

// ── Eventos de conversão GTM ──────────────────────────────────────────────────
document.addEventListener('click', function(e) {
  var target = e.target.closest('a, button');
  if (!target || !window.dataLayer) return;
  var text = target.textContent.trim().toLowerCase();
  if (text.includes('visita de valor') || text.includes('solicitar visita')) {
    window.dataLayer.push({ event: 'cta_click', cta_name: 'solicitar_visita_de_valor', page_path: window.location.pathname });
  }
  if (text.includes('ciclo de vida')) {
    window.dataLayer.push({ event: 'cta_click', cta_name: 'conhecer_ciclo_de_vida', page_path: window.location.pathname });
  }
});
document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"]').forEach(function(link) {
  link.addEventListener('click', function() {
    if (window.dataLayer) window.dataLayer.push({ event: 'whatsapp_click', page_path: window.location.pathname });
  });
});

// MGR · Soluções MGR — produtos proprietários
// Acessada pelo card 05 (Saber mais) da home.

const WHATS_S = 'https://wa.me/5519983073630';

function S_Nav() {
  return <MGRHeader active="ciclo" />;
}

function S_Crumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <a href="index.html#ciclo" style={{ color: 'rgba(255,255,255,0.7)' }}>Ciclo de Vida</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Soluções MGR · Produtos proprietários</span>
    </div>
  );
}

// Placeholder serigrafado do PCM (não temos foto real ainda)
function PCMPlaceholder({ height = '100%' }) {
  const zonas = [
    ['CONGELADO', 'MATÉRIA-PRIMA'],
    ['RESFRIADO', 'MATÉRIA-PRIMA'],
    ['CÂMARA FRIA', 'RECHEIO'],
    ['CÂMARA FRIA', 'EQUALIZAÇÃO'],
  ];
  return (
    <div style={{ position: 'relative', width: '100%', height, background: '#0d3b5e', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ position: 'absolute', top: 16, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: MGR.mono, fontSize: 10, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5 }}>
        <span>● PCM · MGR</span>
        <span>PAINEL DE CONTROLE MASTER</span>
      </div>
      <div style={{ position: 'absolute', inset: '52px 24px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {zonas.map((z, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.laranja, fontWeight: 600, letterSpacing: 1.5 }}>ZONA {String(i + 1).padStart(2, '0')}</div>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginTop: 6, letterSpacing: 0.3 }}>{z[0]}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{z[1]}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 12 }}>
              <span style={{ fontFamily: MGR.mono, fontSize: 22, color: MGR.laranja, fontWeight: 600 }}>{['-22°', '+4°', '+2°', '+6°'][i]}</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: MGR.sucesso }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center', fontFamily: MGR.mono, fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 2 }}>
        SERIGRAFIA CUSTOMIZADA · MGR
      </div>
    </div>
  );
}

function S_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <S_Nav />
      <S_Crumb />
      <div className="pad" style={{ padding: '64px 56px 88px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="05" label="Produtos proprietários" color={MGR.laranja} />
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 72, lineHeight: 0.98, letterSpacing: -2.2, color: '#fff', margin: 0 }}>
              Tecnologia própria, <br />
              <span style={{ color: MGR.laranja }}>desenvolvida por quem vive refrigeração todo dia.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 600 }}>
              Mais que serviço — <strong style={{ color: '#fff' }}>soluções proprietárias MGR</strong> para centralizar controle, otimizar consumo e, em breve, conectar sua operação em tempo real.
            </p>
            <a href="#solucoes" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              Conheça nossas soluções <Ico name="arrow" size={16} />
            </a>
          </div>
          <div className="hero-img" style={{ minHeight: 460 }}>
            <PCMPlaceholder height={460} />
          </div>
        </div>
      </div>
    </section>
  );
}

function S_Intro() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '80px 56px', fontFamily: MGR.sans, borderBottom: `1px solid ${MGR.cinzaClaro}` }}>
      <p style={{ maxWidth: 920, fontSize: 22, lineHeight: 1.5, color: MGR.grafite, margin: 0, fontWeight: 400, letterSpacing: -0.3 }}>
        A MGR não vende equipamento de prateleira. Desenvolvemos <strong style={{ color: MGR.acento }}>tecnologia própria</strong> quando o mercado não entrega o que sua operação precisa — controle centralizado, otimização energética e, em breve, gestão remota integrada.
      </p>
    </section>
  );
}

function S_Badge({ tipo }) {
  const cfg = {
    disponivel: { bg: 'rgba(34,197,94,0.12)', fg: MGR.sucesso, label: '● DISPONÍVEL' },
    breve: { bg: 'rgba(212,121,42,0.14)', fg: MGR.laranja, label: '○ EM DESENVOLVIMENTO · ACESSO ANTECIPADO' },
  }[tipo];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', background: cfg.bg, color: cfg.fg, fontFamily: MGR.mono, fontSize: 10, fontWeight: 600, letterSpacing: 1.5, padding: '6px 12px', borderRadius: 4 }}>
      {cfg.label}
    </span>
  );
}

// SUB-CARD 1 — PCM (destaque visual maior)
function S_PCM() {
  return (
    <section id="solucoes" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="01" label="Disponível hoje · Hardware proprietário" color={MGR.acento} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          O cérebro da sua produção.
        </h2>
      </div>

      <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 60px rgba(13,59,94,0.08)' }}>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '56px 56px 64px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: MGR.azulClaro, color: MGR.azul, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico name="gear" size={24} />
              </div>
              <S_Badge tipo="disponivel" />
            </div>
            <h3 style={{ fontSize: 38, fontWeight: 700, color: MGR.grafite, margin: 0, letterSpacing: -1, lineHeight: 1.05 }}>
              PCM <span style={{ color: MGR.cinzaMedio, fontWeight: 400 }}>—</span> Painel de Controle Master
            </h3>
            <div style={{ fontSize: 16, color: MGR.acento, fontWeight: 600, marginTop: 8, marginBottom: 24 }}>
              O cérebro da sua produção
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 28px' }}>
              Núcleo de inteligência para operações com múltiplos ambientes refrigerados. Centraliza controle de temperatura, degelo e segurança em uma única interface — projetada e montada pela MGR.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
              {[
                'Reduz ronda técnica em até 70%',
                'Customizado por projeto · cada zona serigrafada conforme mapa térmico',
                'Pronto para integração industrial (Modbus / Ethernet)',
                'Alarmes multinível com log para auditoria de qualidade',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: MGR.acento, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <Ico name="check" size={12} />
                  </div>
                  <div style={{ fontSize: 14.5, color: MGR.grafite, lineHeight: 1.5 }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <a href={WHATS_S} target="_blank" rel="noopener" style={{ fontSize: 14, color: MGR.acento, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${MGR.cinzaClaro}`, paddingTop: 22 }}>
              Saber mais sobre o PCM <Ico name="arrow" size={14} />
            </a>
          </div>
          <div style={{ background: MGR.azulEscuro, padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 480 }}>
            <PCMPlaceholder height={400} />
          </div>
        </div>
      </div>
    </section>
  );
}

// SUB-CARD 2 — HACK
function S_Hack() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 64, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ aspectRatio: '4/5', width: '100%', borderRadius: 8, overflow: 'hidden', background: MGR.azulEscuro, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="100%" height="100%" viewBox="0 0 400 500" preserveAspectRatio="none">
              <defs>
                <pattern id="hgrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="400" height="500" fill="url(#hgrid)" />
              <g stroke={MGR.laranja} strokeWidth="1.5" fill="none" opacity="0.7">
                <circle cx="200" cy="250" r="120" />
                <circle cx="200" cy="250" r="80" />
                <circle cx="200" cy="250" r="40" />
                <line x1="80" y1="250" x2="320" y2="250" />
                <line x1="200" y1="130" x2="200" y2="370" />
              </g>
              <g fill={MGR.laranja}>
                <circle cx="200" cy="250" r="6" />
                <circle cx="280" cy="250" r="3" />
                <circle cx="120" cy="250" r="3" />
                <circle cx="200" cy="170" r="3" />
                <circle cx="200" cy="330" r="3" />
              </g>
              <g fontFamily="JetBrains Mono, monospace" fontSize="10" fill="rgba(255,255,255,0.4)" letterSpacing="1">
                <text x="20" y="30">HACK · MGR</text>
                <text x="20" y="480">CONHECIMENTO APLICADO · 20 ANOS</text>
                <text x="320" y="480" textAnchor="end">FILE 02</text>
              </g>
            </svg>
          </div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(212,121,42,0.14)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Ico name="bell" size={24} />
            </div>
            <S_Badge tipo="disponivel" />
          </div>
          <SectionTag num="02" label="Disponível hoje · Conhecimento aplicado" color={MGR.azul} />
          <h3 className="h2" style={{ fontSize: 44, fontWeight: 700, color: MGR.grafite, margin: 0, letterSpacing: -1.2, lineHeight: 1.05 }}>
            Hack de Refrigeração MGR
          </h3>
          <div style={{ fontSize: 16, color: MGR.acento, fontWeight: 600, marginTop: 10, marginBottom: 24 }}>
            Conhecimento aplicado — 20 anos destilados
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: MGR.cinzaMedio, margin: '0 0 28px' }}>
            Conjunto de práticas, ajustes e otimizações proprietárias desenvolvidas em mais de 20 anos de campo. Aplicamos no seu sistema para ganhar eficiência energética e estender vida útil de equipamentos.
          </p>
          <div style={{ background: MGR.cinzaClaro, padding: '22px 24px', borderRadius: 6, borderLeft: `3px solid ${MGR.laranja}`, marginBottom: 28 }}>
            <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.laranja, fontWeight: 600, letterSpacing: 1.5, marginBottom: 8 }}>EM CONSTRUÇÃO</div>
            <div style={{ fontSize: 14, color: MGR.grafite, lineHeight: 1.55 }}>
              Conteúdo técnico detalhado em breve. Para casos específicos, fale com nossa equipe técnica.
            </div>
          </div>
          <a href={WHATS_S} target="_blank" rel="noopener" style={{ fontSize: 14, color: MGR.acento, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Falar com a equipe técnica <Ico name="arrow" size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

// SUB-CARD 3 — CONNECT (visual mais discreto)
function S_Connect() {
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans, position: 'relative', overflow: 'hidden' }}>
      <svg style={{ position: 'absolute', right: -200, top: -100, opacity: 0.06 }} width="800" height="800" viewBox="0 0 800 800">
        <circle cx="400" cy="400" r="380" fill="none" stroke={MGR.laranja} strokeWidth="1" strokeDasharray="4 8" />
        <circle cx="400" cy="400" r="280" fill="none" stroke={MGR.laranja} strokeWidth="1" strokeDasharray="4 8" />
        <circle cx="400" cy="400" r="180" fill="none" stroke={MGR.laranja} strokeWidth="1" strokeDasharray="4 8" />
      </svg>
      <div style={{ position: 'relative' }}>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(212,121,42,0.18)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico name="chart" size={24} />
              </div>
              <S_Badge tipo="breve" />
            </div>
            <SectionTag num="03" label="A próxima camada do Ciclo de Vida MGR" color={MGR.laranja} />
            <h3 className="h2" style={{ fontSize: 44, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: -1.2, lineHeight: 1.05 }}>
              MGR Connect
            </h3>
            <div style={{ fontSize: 16, color: MGR.laranja, fontWeight: 600, marginTop: 10, marginBottom: 24 }}>
              A próxima camada do Ciclo de Vida MGR
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'rgba(255,255,255,0.75)', margin: '0 0 28px' }}>
              Plataforma proprietária onde o parceiro acompanha cada O.S., histórico de manutenção e indicadores da sua operação. Em breve, integrada ao <strong style={{ color: '#fff' }}>Controlador Connect 2.0</strong> — visualize e controle sua refrigeração remotamente.
            </p>
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, padding: '20px 22px', marginBottom: 28 }}>
              <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.laranja, fontWeight: 600, letterSpacing: 1.5, marginBottom: 10 }}>● TRANSPARÊNCIA</div>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                <strong style={{ color: '#fff' }}>Status:</strong> desenvolvimento ativo · parceiros piloto em testes. Optamos por não anunciar o que ainda não está em produção. Se você quer ser um dos primeiros a usar, entre na lista de acesso antecipado.
              </div>
            </div>
            <a href={WHATS_S} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '18px 28px', fontSize: 14, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              Quero ser piloto <Ico name="arrow" size={14} />
            </a>
          </div>
          <div>
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 32, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5 }}>● MGR CONNECT · ROADMAP</div>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.laranja, letterSpacing: 1.5 }}>Q1 · 2026</div>
              </div>
              {[
                { fase: 'FASE 01', t: 'Plataforma de O.S. e histórico', s: 'Em testes com parceiros piloto', ativo: true },
                { fase: 'FASE 02', t: 'Indicadores preditivos integrados', s: 'Em desenvolvimento', ativo: false },
                { fase: 'FASE 03', t: 'Controlador Connect 2.0 · monitoramento remoto', s: 'Roadmap', ativo: false },
                { fase: 'FASE 04', t: 'Controle remoto + automação MGR', s: 'Roadmap', ativo: false },
              ].map((f, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <div style={{ width: 14, height: 14, borderRadius: '50%', background: f.ativo ? MGR.laranja : 'transparent', border: `2px solid ${f.ativo ? MGR.laranja : 'rgba(255,255,255,0.25)'}`, marginTop: 4, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: MGR.mono, fontSize: 10, color: f.ativo ? MGR.laranja : 'rgba(255,255,255,0.4)', letterSpacing: 1.5, fontWeight: 600 }}>{f.fase}</div>
                    <div style={{ fontSize: 14, color: f.ativo ? '#fff' : 'rgba(255,255,255,0.7)', fontWeight: 500, margin: '4px 0 2px' }}>{f.t}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{f.s}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function S_Diferencial() {
  const pilares = [
    { i: 'gear', t: 'Hardware proprietário (PCM)', d: 'Projetado e montado pela MGR para o ambiente industrial brasileiro. Customizado por projeto, não tirado da prateleira.' },
    { i: 'bell', t: 'Conhecimento aplicado (Hack)', d: 'Práticas e ajustes destilados em duas décadas de campo. Eficiência que só quem viveu o problema sabe entregar.' },
    { i: 'chart', t: 'Roadmap claro (Connect 2.0)', d: 'Você não compra promessa de slide — acompanha a evolução com transparência e participa do desenvolvimento.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 64 }}>
        <SectionTag num="04" label="Diferencial Soluções MGR" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Três pilares. Tecnologia da MGR, para a MGR.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {pilares.map((p, i) => (
          <div key={i} style={{ background: MGR.cinzaClaro, padding: '36px 32px 40px', borderRadius: 6, borderTop: `3px solid ${MGR.acento}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento, marginBottom: 24 }}>
              <Ico name={p.i} size={22} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 600, color: MGR.grafite, margin: '0 0 12px', letterSpacing: -0.4 }}>{p.t}</h4>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function S_CTA() {
  return (
    <section className="pad" style={{ background: MGR.azul, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 72, alignItems: 'center' }}>
        <div>
          <SectionTag num="05" label="Conhecer as Soluções" color={MGR.laranja} />
          <h2 className="h1" style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1.6, color: '#fff', margin: '0 0 32px', lineHeight: 1 }}>
            Refrigeração de missão crítica merece <span style={{ color: MGR.laranja }}>tecnologia construída pra ela.</span>
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={WHATS_S} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              WhatsApp · (19) 98307-3630 <Ico name="arrow" size={16} />
            </a>
            <a href="tel:+5519983073630" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
              Ligar agora
            </a>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 32 }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600, marginBottom: 18 }}>● CONTATO DIRETO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>WhatsApp Comercial</div>
              <a href={WHATS_S} target="_blank" rel="noopener" style={{ fontSize: 17, color: '#fff', fontWeight: 600 }}>(19) 98307-3630</a>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>E-mail</div>
              <a href="mailto:administrativo.mgr@gmail.com" style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>administrativo.mgr@gmail.com</a>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              MGR Soluções e Tecnologia da Refrigeração Ltda<br />Indaiatuba/SP
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function S_Footer() {
  return <MGRFooter />;
}

function S_FooterDead() {
  return (
    <footer style={{ display: 'none' }}>
      <div className="pad grid-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 56, marginBottom: 48 }}>
        <div>
          <MGRLogo inverse size={256} />
          <p style={{ marginTop: 20, lineHeight: 1.6, maxWidth: 320, color: 'rgba(255,255,255,0.55)' }}>
            MGR Soluções e Tecnologia da Refrigeração.<br />Do projeto à operação contínua.
          </p>
        </div>
        {[
          ['Serviços', [['Anti-Downtime', 'anti-downtime.html'], ['Corretiva sob demanda', 'manutencao-corretiva.html'], ['Soluções MGR', 'solucoes-mgr.html']]],
          ['Soluções', [['PCM', '#'], ['Hack MGR', '#'], ['MGR Connect (em breve)', '#']]],
          ['Contato', ['Indaiatuba · SP', '(19) 98307-3630', 'administrativo.mgr@gmail.com']],
        ].map(([t, items], i) => (
          <div key={i}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 16, fontSize: 13 }}>{t}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'rgba(255,255,255,0.55)' }}>
              {items.map((x, j) => Array.isArray(x) ? <a key={j} href={x[1]}>{x[0]}</a> : <a key={j}>{x}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div className="pad" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        © 2026 MGR Soluções e Tecnologia da Refrigeração Ltda
      </div>
    </footer>
  );
}

function S_FloatBack() {
  return (
    <a href="index.html#ciclo" className="float-back" style={{
      position: 'fixed', left: 24, bottom: 24, zIndex: 30,
      background: MGR.azulEscuro, color: '#fff', padding: '14px 22px',
      borderRadius: 999, fontSize: 13, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 10,
      boxShadow: '0 12px 32px rgba(13,59,94,0.35)', fontFamily: MGR.sans,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><Ico name="arrow" size={14} /></span>
      Voltar ao Ciclo de Vida MGR
    </a>
  );
}

function PageSolucoes() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <S_Hero />
      <S_Intro />
      <S_PCM />
      <S_Hack />
      <S_Connect />
      <S_Diferencial />
      <S_CTA />
      <S_Footer />
      <S_FloatBack />
    </div>
  );
}

Object.assign(window, { PageSolucoes });

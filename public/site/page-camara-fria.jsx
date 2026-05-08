// MGR · LP Câmara Fria Industrial
// Captura de demanda — formulário único; WhatsApp abre pós-submit com dados pré-preenchidos.

const CF_PHONE = '(19) 98307-3630';
const CF_TEL = 'tel:+5519983073630';
const CF_WHATS_NUM = '5519983073630';

// =====================================================================
// 1. HEADER (sem menu)
// =====================================================================
function CF_Header() {
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: MGR.azulEscuro,
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
    }}>
      <div className="pad" style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 56px', gap: 24, fontFamily: MGR.sans, minHeight: 64,
      }}>
        <a href="MGR Homepage.html" style={{ display: 'flex', alignItems: 'center' }} aria-label="Home MGR">
          <MGRLogo inverse size={48} />
        </a>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href={CF_TEL} className="hide-mobile" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            color: '#fff', fontSize: 15, fontWeight: 600,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {CF_PHONE}
          </a>
          <a href="#form" style={{
            background: MGR.acento, color: '#fff',
            padding: '13px 22px', fontSize: 14, fontWeight: 600,
            borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 12px rgba(232,97,26,0.3)', whiteSpace: 'nowrap',
          }}>
            Solicitar Orçamento
          </a>
        </div>
      </div>
    </header>
  );
}

// =====================================================================
// 2. HERO
// =====================================================================
function CF_Hero() {
  return (
    <section style={{
      background: `linear-gradient(180deg, ${MGR.azulEscuro} 0%, ${MGR.azul} 100%)`,
      color: '#fff', fontFamily: MGR.sans, position: 'relative', overflow: 'hidden',
    }}>
      <div className="pad" style={{ maxWidth: 1280, margin: '0 auto', padding: '88px 56px 96px' }}>
        <div className="grid-2" style={{
          display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 64, alignItems: 'center',
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '8px 18px', border: `1.5px solid ${MGR.laranja}`, borderRadius: 999,
              fontFamily: MGR.mono, fontSize: 11.5, letterSpacing: 1.6,
              textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600,
              marginBottom: 32,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: MGR.laranja }} />
              Câmara Fria Industrial
            </div>
            <h1 className="h1" style={{
              fontFamily: MGR.sans, fontWeight: 800,
              fontSize: 'clamp(40px, 5.4vw, 60px)', lineHeight: 1.04,
              letterSpacing: -1.6, margin: '0 0 28px',
            }}>
              Câmara fria industrial<br />
              projetada para sua operação<br />
              <span style={{ fontStyle: 'italic', color: MGR.laranja, fontWeight: 800 }}>nunca parar</span>.
            </h1>
            <p style={{
              fontSize: 'clamp(16px, 1.4vw, 19px)', lineHeight: 1.55,
              color: 'rgba(255,255,255,0.82)', margin: '0 0 36px', maxWidth: 580, fontWeight: 400,
            }}>
              Do dimensionamento térmico à entrega operacional. Construção em isopainel, sistema de refrigeração e elétrica executados pela mesma equipe MGR. Para câmaras novas ou expansão da existente.
            </p>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 40 }}>
              <a href="#form" style={{
                background: MGR.acento, color: '#fff',
                padding: '20px 32px', fontSize: 15, fontWeight: 600,
                borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 12,
                boxShadow: '0 8px 24px rgba(232,97,26,0.35)',
              }}>
                Solicitar Orçamento
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </a>
              <a href="#projetos" style={{
                background: 'transparent', color: '#fff',
                padding: '20px 32px', fontSize: 15, fontWeight: 500,
                borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.4)',
                display: 'inline-flex', alignItems: 'center', gap: 12,
              }}>
                Ver projetos executados
              </a>
            </div>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0,
              paddingTop: 28, borderTop: '1px solid rgba(255,255,255,0.12)',
              fontSize: 13, color: 'rgba(255,255,255,0.72)', fontWeight: 500,
            }}>
              {['+20 anos de campo', '+200 projetos entregues', 'Equipe técnica própria', 'Atendemos todo o Brasil'].map((it, i, a) => (
                <React.Fragment key={i}>
                  <span>{it}</span>
                  {i < a.length - 1 && <span style={{ margin: '0 18px', color: 'rgba(255,255,255,0.3)' }}>·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <div className="hero-img" style={{
            position: 'relative', minHeight: 500, borderRadius: 10, overflow: 'hidden',
            background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}>
            <img src="assets/tropsabor-interior.png" alt="Câmara fria industrial MGR — interior em isopainel"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.55) 100%)' }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
              <div style={{ background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.sucesso, letterSpacing: 1.5, fontWeight: 600 }}>● ENTREGUE EM OPERAÇÃO</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Câmara fria · Isopainel + refrigeração</div>
              </div>
              <div style={{ background: MGR.laranja, color: '#fff', padding: '10px 14px', borderRadius: 6, fontFamily: MGR.mono, fontSize: 11, fontWeight: 600, letterSpacing: 1.2 }}>
                CHAVE-NA-MÃO
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 3. PROBLEMA
// =====================================================================
function CF_Problema() {
  const cards = [
    { i: 'gear', t: 'Sub-dimensionamento que não aguenta a operação',
      d: 'Câmara que não chega na temperatura no pico. Sistema que opera no limite e queima compressor com 2 anos. O erro não está no equipamento — está no cálculo térmico que ninguém fez direito desde o projeto.' },
    { i: 'shield', t: 'Construtora "fez câmara fria" — mas não é o ofício dela',
      d: 'Empreiteira de obra civil que aceitou o escopo. Isolamento mal feito. Vedação que não veda. Refrigeração de uma empresa, isopainel de outra, elétrica de uma terceira — ninguém assume o resultado térmico final.' },
    { i: 'chart', t: 'Conta de luz que sangra a margem todo mês',
      d: 'Câmara mal isolada ou mal dimensionada consome 30-40% mais energia do que deveria. Em 5 anos, o custo de energia desperdiçada paga uma câmara nova bem feita.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● O Que a Maioria dos Projetos Erra</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 64px', maxWidth: 920 }}>
          Câmara fria mal projetada<br />custa caro pelos próximos <em style={{ color: MGR.acento, fontStyle: 'italic' }}>10 anos</em>.
        </h2>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 28 }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: '#fff', border: `1px solid ${MGR.cinzaClaro}`, borderRadius: 12, padding: 32, display: 'flex', flexDirection: 'column', gap: 16, boxShadow: '0 2px 8px rgba(13,59,94,0.04)' }}>
              <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(232,97,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento }}>
                <Ico name={c.i} size={24} />
              </div>
              <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 19, color: MGR.azulEscuro, margin: 0, lineHeight: 1.3 }}>{c.t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: MGR.cinzaMedio, margin: 0 }}>{c.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 4. SOLUÇÃO MGR — 4 pilares 2x2
// =====================================================================
function CF_Solucao() {
  const pilares = [
    { i: 'chart', t: 'Dimensionamento térmico correto desde o primeiro dia',
      d: 'Cálculo de carga térmica baseado na sua operação real — produto, movimentação, abertura de porta, temperatura externa. Seleção de equipamentos com margem operacional. Memorial técnico documentado.' },
    { i: 'shield', t: 'Isopainel modular — vedação térmica superior à alvenaria',
      d: 'Câmaras positivas e negativas em isopainel de alta performance térmica. Vedação selada, ambiente higienizável, prazo de obra reduzido em comparação com alvenaria convencional.' },
    { i: 'gear', t: 'Refrigeração instalada e comissionada pela equipe MGR',
      d: 'Unidades condensadoras, racks, evaporadores e tubulação executados pelo Especialista de Campo MGR. Comissionamento documentado com testes de performance — não entregamos a câmara antes de operar dentro do projetado.' },
    { i: 'bell', t: 'Quadros e cabeamento da refrigeração pela mesma equipe',
      d: 'Toda a parte elétrica relacionada à refrigeração — quadros de comando, cabeamento dos compressores, conexões dos evaporadores — executada pela equipe MGR. Sem dependência de elétrica de terceiros.' },
  ];
  return (
    <section style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Execução Chave-na-Mão MGR</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 24px', maxWidth: 940 }}>
          Projeto, isopainel, refrigeração e elétrica<br />executados pela <span style={{ color: MGR.acento }}>mesma equipe</span>.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 56px', maxWidth: 820 }}>
          A MGR projeta, dimensiona, constrói e comissiona a câmara fria industrial completa. Sem lacunas de responsabilidade técnica entre fornecedores diferentes. Você fala com uma equipe — do projeto à operação.
        </p>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          {pilares.map((p, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '32px 32px 36px', borderTop: `4px solid ${MGR.laranja}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(232,97,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento }}>
                  <Ico name={p.i} size={22} />
                </div>
                <span style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.acento, letterSpacing: 1.4, fontWeight: 700 }}>PILAR {String(i + 1).padStart(2, '0')}</span>
              </div>
              <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 20, color: MGR.azulEscuro, margin: 0, lineHeight: 1.3, letterSpacing: -0.4 }}>{p.t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
            </div>
          ))}
        </div>
        <div style={{
          background: '#fff', borderLeft: `4px solid ${MGR.azulEscuro}`,
          padding: '24px 28px', borderRadius: '0 8px 8px 0', maxWidth: 920,
        }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.azulEscuro, fontWeight: 700, marginBottom: 8 }}>Transparência de Escopo</div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: MGR.grafite, margin: 0, fontWeight: 500 }}>
            <strong>Escopo MGR:</strong> refrigeração + isopainel + elétrica de refrigeração. Estrutura metálica, alvenaria externa e elétrica geral da planta ficam por conta do cliente ou parceiros estruturais.
          </p>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 5. DOIS CAMINHOS — Turnkey vs Retrofit
// =====================================================================
function CF_Caminhos() {
  const cards = [
    {
      tag: 'Câmara Nova (Greenfield)', titulo: 'Turnkey Completo MGR',
      desc: 'Para nova planta, expansão de área ou primeira câmara fria do empreendimento. Do levantamento técnico inicial à entrega operacional, com Relatório Final de Execução documentado.',
      bullets: [
        'Projeto técnico sob medida',
        'Construção completa em isopainel',
        'Sistema de refrigeração instalado e comissionado',
        'Elétrica de refrigeração inclusa',
        'Comissionamento com testes de performance',
      ],
      href: 'turnkey-completo.html', cta: 'Saber mais sobre Turnkey',
    },
    {
      tag: 'Modernização (Brownfield)', titulo: 'Retrofit Turnkey MGR',
      desc: 'Para câmara fria existente que precisa de modernização, expansão, troca de sistema de refrigeração ou adequação a novo produto/processo. Mesmo padrão técnico do Turnkey, adaptado à estrutura existente.',
      bullets: [
        'Diagnóstico técnico da câmara atual',
        'Projeto de modernização sob medida',
        'Substituição/upgrade de isopainel quando necessário',
        'Troca ou expansão do sistema de refrigeração',
        'Mínimo impacto na operação durante execução',
      ],
      href: 'retrofit-turnkey.html', cta: 'Saber mais sobre Retrofit',
    },
  ];
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 24 }}>● Duas Formas de Executar</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.1, letterSpacing: -1, color: '#fff', margin: '0 0 24px', maxWidth: 880 }}>
          Câmara nova do zero ou<br /><span style={{ color: MGR.laranja }}>modernização da existente</span>.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)', margin: '0 0 56px', maxWidth: 760 }}>
          A MGR executa os dois cenários com a mesma metodologia técnica chave-na-mão. O que muda é o ponto de partida.
        </p>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {cards.map((c, i) => (
            <div key={i} style={{
              background: MGR.azul, borderTop: `4px solid ${MGR.laranja}`,
              padding: '36px 36px 40px', borderRadius: 10,
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 700, marginBottom: 14 }}>{c.tag}</div>
              <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 28, color: '#fff', margin: '0 0 16px', letterSpacing: -0.6, lineHeight: 1.15 }}>{c.titulo}</h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'rgba(255,255,255,0.82)', margin: '0 0 24px' }}>{c.desc}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {c.bullets.map((b, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ flexShrink: 0, marginTop: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(212,121,42,0.25)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                    </span>
                    <span style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.92)', fontWeight: 500, lineHeight: 1.5 }}>{b}</span>
                  </div>
                ))}
              </div>
              <a href={c.href} style={{
                marginTop: 'auto', alignSelf: 'flex-start',
                background: 'transparent', color: '#fff',
                padding: '14px 24px', fontSize: 14, fontWeight: 600,
                borderRadius: 8, border: '1.5px solid rgba(255,255,255,0.5)',
                display: 'inline-flex', alignItems: 'center', gap: 10,
              }}>
                {c.cta}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 6. PROVA SOCIAL — cases (placeholders com fotos reais MGR)
// =====================================================================
function CF_Prova() {
  const cases = [
    {
      img: 'assets/ecoflora-unidade.png',
      cliente: 'Ecoflora', setor: 'Pós-colheita / Floricultura',
      especs: ['Câmara fria de armazenamento', 'Aprox. 220 m²', 'Temperatura controlada de conservação', 'Sistema com unidade condensadora dedicada'],
      cit: '"A equipe MGR entregou a câmara dentro do prazo e operando exatamente como projetado. Sem retrabalho." — placeholder, a confirmar.',
    },
    {
      img: 'assets/tropsabor-galpao.png',
      cliente: 'Tropsabor', setor: 'Indústria alimentícia',
      especs: ['Câmara fria + área de processo', 'Aprox. 480 m²', 'Positiva e negativa integradas', 'Rack de compressores paralelos'],
      cit: '"Projeto técnico documentado desde o início. A obra correu sem surpresas." — placeholder, a confirmar.',
    },
    {
      img: 'assets/sorvetao-fachada.png',
      cliente: 'Sorvetão', setor: 'Indústria de sorvetes / Cold chain',
      especs: ['Câmara fria de congelamento', 'Aprox. 300 m²', 'Negativa profunda', 'Casa de máquinas com rack paralelo'],
      cit: '"Refrigeração e isopainel pela mesma equipe — fez toda a diferença na entrega." — placeholder, a confirmar.',
    },
  ];
  return (
    <section id="projetos" style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Projetos Executados</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.1, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 56px', maxWidth: 880 }}>
          +200 projetos entregues<br />em mais de <span style={{ color: MGR.acento }}>20 anos de campo</span>.
        </h2>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 56 }}>
          {cases.map((c, i) => (
            <div key={i} style={{ background: '#fff', border: `1px solid ${MGR.cinzaClaro}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: MGR.azulEscuro }}>
                <img src={c.img} alt={c.cliente} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{
                  position: 'absolute', top: 12, left: 12, background: MGR.azulEscuro, color: '#fff',
                  padding: '4px 10px', borderRadius: 4, fontFamily: MGR.mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: 1.2, textTransform: 'uppercase',
                }}>Placeholder · Foto MGR</span>
              </div>
              <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
                <div>
                  <h4 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 20, color: MGR.azulEscuro, margin: 0, letterSpacing: -0.4 }}>{c.cliente}</h4>
                  <div style={{ fontSize: 13, color: MGR.cinzaMedio, marginTop: 4, fontWeight: 500 }}>{c.setor}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 14, borderTop: `1px solid ${MGR.cinzaClaro}` }}>
                  {c.especs.map((s, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: MGR.grafite, lineHeight: 1.45 }}>
                      <span style={{ color: MGR.acento, marginTop: 1 }}>•</span>{s}
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 13.5, color: MGR.cinzaMedio, lineHeight: 1.55, fontStyle: 'italic', margin: 0, marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${MGR.cinzaClaro}` }}>
                  {c.cit}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center',
          paddingTop: 28, borderTop: `1px solid ${MGR.cinzaClaro}`,
          fontSize: 14, color: MGR.cinzaMedio, fontWeight: 500,
        }}>
          {['+20 anos de campo', '+200 projetos entregues', 'Equipe técnica própria', 'Atendemos todo o Brasil'].map((it, i, a) => (
            <React.Fragment key={i}>
              <span style={{ fontFamily: MGR.mono, letterSpacing: 0.4 }}>{it}</span>
              {i < a.length - 1 && <span style={{ margin: '0 22px', color: MGR.cinzaClaro }}>·</span>}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 7. PROCESSO — 4 passos
// =====================================================================
function CF_Processo() {
  const passos = [
    { n: '01', t: 'Solicite o orçamento prévio', d: 'Preencha o formulário abaixo com os dados iniciais do projeto. Em até 1 dia útil retornamos com um orçamento prévio remoto, baseado nas informações compartilhadas — sem deslocamento, sem custo.' },
    { n: '02', t: 'Visita Técnica para fechamento', d: 'Após o aceite do orçamento prévio, o Especialista de Campo MGR vai até o local para levantar as necessidades reais — produto, volume, temperatura, área disponível e restrições da estrutura — e refinar o escopo final do projeto.' },
    { n: '03', t: 'Projeto técnico e proposta final', d: 'Entregamos projeto técnico documentado com escopo detalhado, prazo de execução e investimento final. O que está no projeto é o que executamos.' },
    { n: '04', t: 'Execução chave-na-mão e comissionamento', d: 'Construção em isopainel, instalação do sistema de refrigeração, elétrica de refrigeração e testes de performance. Entrega com Relatório Final de Execução.' },
  ];
  return (
    <section style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Como Funciona</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 72px', maxWidth: 920 }}>
          4 passos do primeiro contato<br />à câmara fria <span style={{ color: MGR.acento }}>operando</span>.
        </h2>
        <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 56, position: 'relative' }}>
          <div className="connector" style={{
            position: 'absolute', top: 36, left: '12.5%', right: '12.5%',
            height: 2, background: `repeating-linear-gradient(to right, ${MGR.laranja} 0 8px, transparent 8px 16px)`,
            zIndex: 0,
          }} />
          {passos.map((p, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 18, position: 'relative', zIndex: 1, alignItems: 'flex-start' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: '#fff', color: MGR.laranja,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MGR.mono, fontSize: 22, fontWeight: 700,
                boxShadow: '0 6px 18px rgba(212,121,42,0.25)',
                border: `2px solid ${MGR.laranja}`,
              }}>{p.n}</div>
              <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 18, color: MGR.azulEscuro, margin: 0, lineHeight: 1.3, letterSpacing: -0.3 }}>{p.t}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center' }}>
          <a href="#form" style={{
            background: MGR.acento, color: '#fff',
            padding: '20px 36px', fontSize: 15, fontWeight: 600,
            borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 12,
            boxShadow: '0 8px 24px rgba(232,97,26,0.32)',
          }}>
            Solicitar Orçamento
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
          </a>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 8. FAQ
// =====================================================================
function CF_FAQ() {
  const [open, setOpen] = React.useState(0);
  const faqs = [
    { q: 'Qual o prazo médio de execução de uma câmara fria industrial?', a: 'Depende da área e da complexidade. Câmaras de pequeno e médio porte (até 100 m²) costumam ser entregues entre 30 e 60 dias após aprovação do projeto. Projetos maiores ou com integração à operação existente precisam de cronograma específico — definimos no orçamento.' },
    { q: 'A MGR atende câmara nova e modernização de câmara existente?', a: 'Sim. Para câmara nova, executamos via Turnkey Completo MGR. Para modernização, expansão ou troca de sistema, executamos via Retrofit Turnkey MGR — mesma metodologia adaptada à estrutura existente.' },
    { q: 'Por que isopainel e não alvenaria?', a: 'Isopainel modular tem desempenho térmico superior, prazo de obra muito menor, vedação selada e ambiente 100% higienizável. Para câmara fria industrial, alvenaria não consegue entregar o padrão térmico necessário sem custos adicionais altos.' },
    { q: 'A MGR faz toda a obra ou só a parte de refrigeração?', a: 'A MGR executa o escopo térmico completo — isopainel da câmara, sistema de refrigeração, elétrica da refrigeração e comissionamento. Estrutura metálica externa, alvenaria externa e elétrica geral da planta ficam fora do escopo MGR.' },
    { q: 'Vocês trabalham com qual gás refrigerante?', a: 'HFCs convencionais. Não trabalhamos com amônia (NH₃) nem CO₂ — restrição estratégica e de segurança.' },
    { q: 'O que está incluso no Relatório Final de Execução?', a: 'Memorial técnico, especificação dos equipamentos, registro fotográfico de cada etapa, testes de comissionamento (temperatura, pressão, performance), checklist de entrega assinado e recomendações de operação e manutenção.' },
    { q: 'A MGR atende fora de Indaiatuba?', a: 'Sim. Atendemos projetos em todo o território nacional. A base operacional fica em Indaiatuba/SP, e mobilizamos a equipe técnica própria para qualquer estado do Brasil conforme volume, ticket e logística.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Perguntas Frequentes</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 56px', maxWidth: 800 }}>
          O que todo gestor pergunta antes<br />de contratar uma câmara fria industrial.
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${MGR.cinzaClaro}` }}>
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={i} style={{ borderBottom: `1px solid ${MGR.cinzaClaro}` }}>
                <button onClick={() => setOpen(isOpen ? -1 : i)} style={{
                  width: '100%', textAlign: 'left',
                  padding: '24px 4px', background: 'transparent', border: 'none',
                  cursor: 'pointer', fontFamily: MGR.sans,
                  display: 'flex', alignItems: 'flex-start', gap: 20,
                }}>
                  <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: isOpen ? MGR.acento : MGR.azulEscuro, lineHeight: 1.4, transition: 'color .15s' }}>{f.q}</span>
                  <span style={{
                    flexShrink: 0, marginTop: 2,
                    width: 28, height: 28, borderRadius: '50%',
                    border: `1.5px solid ${isOpen ? MGR.acento : MGR.cinzaMedio}`,
                    color: isOpen ? MGR.acento : MGR.cinzaMedio,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }}><path d="M6 9l6 6 6-6" /></svg>
                  </span>
                </button>
                <div style={{ maxHeight: isOpen ? 400 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
                  <p style={{ fontSize: 15.5, lineHeight: 1.7, color: MGR.cinzaMedio, margin: 0, padding: '0 4px 28px', maxWidth: 800 }}>{f.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 9. FORMULÁRIO
// =====================================================================
function CF_Form() {
  const [state, setState] = React.useState({ nome: '', empresa: '', whatsapp: '', tipo: '', cidade: '' });
  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState(null);
  const [error, setError] = React.useState(null);

  const set = (k) => (e) => {
    let v = e.target.value;
    if (k === 'whatsapp') {
      const d = v.replace(/\D/g, '').slice(0, 11);
      if (d.length <= 2) v = d;
      else if (d.length <= 7) v = `(${d.slice(0, 2)}) ${d.slice(2)}`;
      else v = `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    }
    setState((s) => ({ ...s, [k]: v }));
  };

  const mapTipo = {
    'Câmara fria nova (do zero)': 'turnkey_completo',
    'Modernização / expansão de câmara existente': 'retrofit_turnkey',
    'Substituição do sistema de refrigeração existente': 'retrofit_turnkey',
    'Ainda estou avaliando — preciso de orientação técnica': 'consultiva',
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!state.nome || !state.empresa || !state.whatsapp || !state.tipo || !state.cidade) return;

    setSubmitting(true); setError(null);
    try {
      const payload = {
        nome: state.nome, empresa: state.empresa,
        whatsapp: state.whatsapp, tipo_projeto: state.tipo,
        cidade: state.cidade,
        origem: 'camara-fria-industrial',
        url_origem: window.location.href,
        data_criacao: new Date().toISOString(),
        status: 'novo', atendido: false,
        tipo_servico: mapTipo[state.tipo] || 'consultiva',
      };

      // Hook real Firebase Firestore (mgr-conect2)
      if (window.__mgrSaveLead) {
        await window.__mgrSaveLead(payload);
      } else {
        console.log('[MGR Lead - Câmara Fria Industrial]', payload);
        await new Promise((r) => setTimeout(r, 600));
      }

      // GTM
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'lead_form_submit',
        lead_origem: 'camara-fria-industrial',
        lead_tipo_projeto: state.tipo,
      });

      // Monta WhatsApp
      const msg = `Olá! Acabei de solicitar um Orçamento pelo site MGR.

*Dados do contato:*
• Nome: ${state.nome}
• Empresa: ${state.empresa}
• WhatsApp: ${state.whatsapp}
• Cidade: ${state.cidade}

*Tipo de projeto:*
${state.tipo}

Aguardo retorno para agendar a visita. Obrigado!`;
      const url = `https://wa.me/${CF_WHATS_NUM}?text=${encodeURIComponent(msg)}`;

      setSuccess(url);
      setTimeout(() => { window.open(url, '_blank', 'noopener'); }, 800);
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar. Tente novamente ou ligue: (19) 98307-3630');
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '16px 18px', fontSize: 15,
    fontFamily: MGR.sans, color: MGR.grafite, background: '#fff',
    border: `1.5px solid ${MGR.cinzaClaro}`, borderRadius: 8,
    outline: 'none', transition: 'border-color .15s, box-shadow .15s',
  };
  const labelStyle = {
    display: 'block', fontFamily: MGR.sans, fontSize: 13,
    fontWeight: 600, color: MGR.azulEscuro, marginBottom: 8, letterSpacing: 0.2,
  };

  const reforcos = [
    'Orçamento prévio remoto — sem custo, sem compromisso',
    'Projeto técnico documentado antes da execução',
    'Execução chave-na-mão (isopainel + refrigeração + elétrica)',
    'Especialista de Campo MGR — equipe própria',
    'Atendemos projetos em todo o Brasil',
  ];

  return (
    <section id="form" style={{
      background: `linear-gradient(180deg, ${MGR.azulEscuro} 0%, ${MGR.azul} 100%)`,
      color: '#fff', padding: '120px 56px', fontFamily: MGR.sans,
    }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 24 }}>● Solicitar Orçamento</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(30px, 3.8vw, 48px)', lineHeight: 1.1, letterSpacing: -1.2, color: '#fff', margin: '0 0 20px', maxWidth: 880 }}>
          Pronto para projetar<br /><span style={{ color: MGR.laranja }}>sua câmara fria industrial?</span>
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '0 0 56px', maxWidth: 760 }}>
          Preencha os dados abaixo para receber um orçamento prévio remoto. Após o envio, abriremos o WhatsApp do nosso comercial com seus dados já preenchidos — sem custo, sem compromisso. A Visita Técnica acontece depois, no fechamento do projeto.
        </p>

        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 56, alignItems: 'start' }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: 40,
            color: MGR.grafite, boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }}>
            {!success ? (
              <form onSubmit={submit}>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Nome completo *</label>
                  <input required type="text" placeholder="Seu nome" value={state.nome} onChange={set('nome')} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Empresa *</label>
                  <input required type="text" placeholder="Nome da empresa" value={state.empresa} onChange={set('empresa')} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>WhatsApp *</label>
                  <input required type="tel" placeholder="(19) 99999-9999" value={state.whatsapp} onChange={set('whatsapp')} style={inputStyle} maxLength={16} />
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Tipo de projeto *</label>
                  <select required value={state.tipo} onChange={set('tipo')} style={{
                    ...inputStyle, appearance: 'none', paddingRight: 44,
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3e%3cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 18px center',
                  }}>
                    <option value="" disabled>Selecione…</option>
                    <option value="Câmara fria nova (do zero)">Câmara fria nova (do zero)</option>
                    <option value="Modernização / expansão de câmara existente">Modernização / expansão de câmara existente</option>
                    <option value="Substituição do sistema de refrigeração existente">Substituição do sistema de refrigeração existente</option>
                    <option value="Ainda estou avaliando — preciso de orientação técnica">Ainda estou avaliando — preciso de orientação técnica</option>
                  </select>
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>Cidade do projeto *</label>
                  <input required type="text" placeholder="Cidade — UF" value={state.cidade} onChange={set('cidade')} style={inputStyle} />
                </div>

                {error && (
                  <div style={{ background: '#FEF2F2', border: `1px solid ${MGR.erro}`, color: MGR.erro, padding: 14, borderRadius: 8, fontSize: 13.5, marginBottom: 18 }}>{error}</div>
                )}

                <button type="submit" disabled={submitting} style={{
                  width: '100%', background: submitting ? MGR.cinzaMedio : MGR.acento,
                  color: '#fff', border: 'none', padding: '20px 24px',
                  fontSize: 15.5, fontWeight: 700, borderRadius: 10,
                  cursor: submitting ? 'wait' : 'pointer', fontFamily: MGR.sans,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                  boxShadow: submitting ? 'none' : '0 8px 20px rgba(232,97,26,0.3)',
                  transition: 'all .15s',
                }}>
                  {submitting ? (
                    <>
                      <span style={{ width: 18, height: 18, borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                      Enviando…
                    </>
                  ) : (
                    <>
                      Solicitar Orçamento
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7" /></svg>
                    </>
                  )}
                </button>

                <p style={{ fontSize: 12.5, color: MGR.cinzaMedio, lineHeight: 1.5, margin: '14px 0 0', textAlign: 'center' }}>
                  Após enviar, abriremos o WhatsApp do nosso comercial com seus dados já preenchidos para agilizar o atendimento.
                </p>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: MGR.sucesso, color: '#fff',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                </div>
                <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 24, color: MGR.azulEscuro, margin: '0 0 14px' }}>
                  Recebemos sua solicitação!
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 28px', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
                  Estamos abrindo o WhatsApp do nosso comercial com seus dados para que você confirme o atendimento. Em até 1 dia útil retornamos com o orçamento prévio remoto.
                </p>
                <a href={success} target="_blank" rel="noopener" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 10,
                  background: '#25D366', color: '#fff', padding: '14px 28px',
                  borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: 15,
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                  Abrir WhatsApp do Comercial
                </a>
                <p style={{ fontSize: 12.5, color: MGR.cinzaMedio, marginTop: 18 }}>
                  Caso o WhatsApp não abra automaticamente, clique no botão acima.
                </p>
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 22, color: '#fff', margin: '0 0 24px', letterSpacing: -0.4 }}>
              Por que solicitar agora?
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
              {reforcos.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{
                    flexShrink: 0, marginTop: 2, width: 22, height: 22, borderRadius: '50%',
                    background: 'rgba(212,121,42,0.18)', color: MGR.laranja,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                  </span>
                  <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.92)', fontWeight: 500, lineHeight: 1.5 }}>{r}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.14)' }}>
              {['+20 anos de campo', '+200 projetos', 'Equipe própria'].map((t, i) => (
                <span key={i} style={{
                  fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.2,
                  textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600,
                  border: `1px solid ${MGR.laranja}`, padding: '6px 12px', borderRadius: 999,
                }}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 10. FOOTER MÍNIMO
// =====================================================================
function CF_Footer() {
  return (
    <footer style={{ background: MGR.azulEscuro, color: 'rgba(255,255,255,0.7)', padding: '64px 56px 32px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="grid-footer-min" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 48, marginBottom: 40 }}>
          <div>
            <MGRLogo inverse size={56} />
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', margin: '20px 0 0', maxWidth: 320 }}>
              MGR Soluções e Tecnologia da Refrigeração<br />
              Sede em Indaiatuba/SP — atendemos projetos em todo o Brasil.
            </p>
          </div>
          <div>
            <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 16 }}>Contato</div>
            <a href={CF_TEL} style={{ display: 'block', fontSize: 17, color: '#fff', fontWeight: 600, marginBottom: 6 }}>
              (19) 98307-3630
            </a>
            <a href={`https://wa.me/${CF_WHATS_NUM}`} target="_blank" rel="noopener" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.7)' }}>
              WhatsApp Comercial
            </a>
          </div>
          <div>
            <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 16 }}>Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <a href="#" style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Política de Privacidade</a>
              <a href="MGR Homepage.html" style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>mgrrefrigeracao.com.br</a>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
          © 2026 MGR Soluções e Tecnologia da Refrigeração Ltda · Todos os direitos reservados
        </div>
      </div>
    </footer>
  );
}

// =====================================================================
// PÁGINA
// =====================================================================
function PageCamaraFria() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <CF_Header />
      <CF_Hero />
      <CF_Problema />
      <CF_Solucao />
      <CF_Caminhos />
      <CF_Prova />
      <CF_Processo />
      <CF_FAQ />
      <CF_Form />
      <CF_Footer />
    </div>
  );
}

Object.assign(window, { PageCamaraFria });

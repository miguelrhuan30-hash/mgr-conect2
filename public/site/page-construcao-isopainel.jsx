// MGR · LP Construção Industrial em Isopainel — captura de demanda.
// LP de projeto: sem telefone exibido. WhatsApp abre pós-submit com dados pré-preenchidos.

const CI_WHATS_NUM = '5519983073630';

// =====================================================================
// 1. HEADER (sem menu, sem telefone)
// =====================================================================
function CI_Header() {
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
        <a href="#form" style={{
          background: MGR.acento, color: '#fff',
          padding: '13px 22px', fontSize: 14, fontWeight: 600,
          borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 8,
          boxShadow: '0 4px 12px rgba(232,97,26,0.3)', whiteSpace: 'nowrap',
        }}>
          Solicitar Orçamento
        </a>
      </div>
    </header>
  );
}

// =====================================================================
// 2. HERO
// =====================================================================
function CI_Hero() {
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
              Construção Industrial em Isopainel
            </div>
            <h1 className="h1" style={{
              fontFamily: MGR.sans, fontWeight: 800,
              fontSize: 'clamp(40px, 5.4vw, 60px)', lineHeight: 1.04,
              letterSpacing: -1.6, margin: '0 0 28px',
            }}>
              Sua fábrica em isopainel:<br />mais rápida que alvenaria,<br />com desempenho térmico{' '}
              <span style={{ fontStyle: 'italic', color: MGR.laranja, fontWeight: 800 }}>
                que alvenaria não entrega
              </span>.
            </h1>
            <p style={{
              fontSize: 'clamp(16px, 1.4vw, 19px)', lineHeight: 1.55,
              color: 'rgba(255,255,255,0.82)', margin: '0 0 36px', maxWidth: 600, fontWeight: 400,
            }}>
              Construção integral de plantas industriais, fachadas, telhados térmicos e divisórias em isopainel modular. Para indústria de alimentos, logística cold chain e operações que precisam de prazo curto e ambiente higienizável.
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
              {['+20 anos de campo', '+200 projetos entregues', 'Equipe técnica própria', 'Indaiatuba/SP e região'].map((it, i, a) => (
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
            <img src="assets/tropsabor-galpao.png" alt="Construção em isopainel MGR — Tropsabor"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.55) 100%)' }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
              <div style={{ background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.sucesso, letterSpacing: 1.5, fontWeight: 600 }}>● ENTREGUE EM OPERAÇÃO</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Edificação modular · Isopainel</div>
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
function CI_Problema() {
  const cards = [
    { i: 'clock', t: 'Cada mês de obra atrasa o faturamento',
      d: 'Obra de alvenaria convencional leva o triplo do tempo. A planta nova fica pronta meses depois do planejado. Cada semana parada é folha de pagamento, custo financeiro e cliente esperando.' },
    { i: 'chart', t: 'Parede de alvenaria não isola como deveria',
      d: 'Galpão que esquenta no verão, congela no inverno. Câmaras frias com perda térmica nas paredes. Conta de energia alta para compensar o que a parede não isola. Em indústria de alimentos, é um custo permanente que não se justifica.' },
    { i: 'shield', t: 'Reboco, junta, canto: tudo acumula resíduo',
      d: 'Auditoria sanitária aponta o que sua equipe já sabia: ambiente de alvenaria não é 100% lavável. Fissura, descascamento, mofo nas juntas. Em indústria de alimentos, isso é risco operacional contínuo.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● O Que Todo Empresário Industrial Conhece</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 64px', maxWidth: 940 }}>
          Obra de alvenaria atrasa,<br />suja, e não entrega o desempenho<br /><em style={{ color: MGR.acento, fontStyle: 'italic' }}>térmico que a indústria exige</em>.
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
// 4. SOLUÇÃO MGR — 4 pilares 2x2 + transparência de escopo
// =====================================================================
function CI_Solucao() {
  const pilares = [
    { i: 'clock', t: 'Construção até 3x mais rápida que alvenaria',
      d: 'Painéis modulares montados em sequência rápida — sem cura de concreto, sem reboco, sem pintura. Fábrica pronta em semanas, não meses. Significa início de operação antecipado e retorno do investimento mais rápido.' },
    { i: 'shield', t: 'Isolamento térmico que alvenaria não alcança',
      d: 'Núcleo de poliuretano expandido entre faces metálicas — barreira térmica de alta performance. Câmaras frias mantêm temperatura com menos esforço, galpão térmico mantém ambiente operacional sem custo de energia exagerado.' },
    { i: 'flake', t: 'Superfície lisa, sem juntas, 100% lavável',
      d: 'Painéis com vedação selada nas juntas, faces metálicas que aceitam lavagem agressiva sem deteriorar. Indústria alimentícia, panificação industrial, processamento de alimentos — auditoria sanitária encontra ambiente conforme.' },
    { i: 'gear', t: 'Refrigeração e elétrica pela mesma equipe',
      d: 'Quando o projeto inclui câmara fria, sala limpa ou área refrigerada, a MGR executa o sistema de refrigeração e a elétrica de refrigeração junto com a edificação. Sem lacuna entre construtora e empresa de refrigeração.' },
  ];
  return (
    <section style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Construção Industrial em Isopainel MGR</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 24px', maxWidth: 940 }}>
          Edificação modular em isopainel:<br />prazo curto, desempenho térmico<br />e <span style={{ color: MGR.acento }}>ambiente higienizável</span>.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 56px', maxWidth: 860 }}>
          Substituímos a alvenaria de paredes por painéis modulares térmicos. A estrutura metálica ou as colunas pré-moldadas ficam por conta do cliente ou parceiros estruturais — sobre essa estrutura, a MGR fecha a edificação inteira em isopainel.
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
          padding: '24px 28px', borderRadius: '0 8px 8px 0', maxWidth: 940,
        }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: MGR.azulEscuro, fontWeight: 700, marginBottom: 8 }}>Transparência de Escopo</div>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: MGR.grafite, margin: 0, fontWeight: 500 }}>
            <strong>Escopo MGR:</strong> edificação em isopainel + refrigeração quando aplicável + elétrica de refrigeração. Estrutura metálica, colunas pré-moldadas, fundação, alvenaria externa e elétrica geral da planta ficam por conta do cliente ou parceiros estruturais.
          </p>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 5. APLICAÇÕES — 6 cards 3x2
// =====================================================================
function CI_Aplicacoes() {
  const apps = [
    { i: 'mountain', t: 'Construção integral de fábrica', d: 'Fechamento completo da planta em isopainel — paredes externas, divisórias internas, salas de produção, áreas refrigeradas. Foco em indústria de alimentos. Estrutura metálica/pré-moldada do cliente, MGR fecha tudo em isopainel.' },
    { i: 'flake', t: 'Câmaras frias e congeladas', d: 'Câmaras positivas e negativas para alimentos perecíveis e congelados. Vedação selada, refrigeração integrada quando incluída no escopo.' },
    { i: 'shield', t: 'Salas limpas e de produção', d: 'Envoltório térmico para salas de manipulação, embalagem, fermentação. Isopainel branco ou inox conforme padrão de higiene exigido.' },
    { i: 'doc', t: 'Fachadas industriais', d: 'Fechamento da fachada do galpão em isopainel — térmico, higienizável, com prazo de obra muito menor que vedação convencional.' },
    { i: 'chart', t: 'Telhados térmicos', d: 'Telhas térmicas com face inferior lisa (imitando laje) e desenho de telha por cima. Isolamento térmico do telhado, acabamento profissional, manutenção mínima.' },
    { i: 'gear', t: 'Divisórias e fechamento de galpões', d: 'Divisórias internas de barracões logísticos. Fechamento de galpões pré-moldados. Compartimentação térmica de áreas distintas dentro da mesma planta.' },
  ];
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 24 }}>● O Que Executamos em Isopainel</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.1, letterSpacing: -1, color: '#fff', margin: '0 0 56px', maxWidth: 920 }}>
          Do escopo parcial à<br /><span style={{ color: MGR.laranja }}>construção integral da fábrica</span>.
        </h2>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {apps.map((a, i) => (
            <div key={i} style={{
              background: MGR.azul, borderTop: `3px solid ${MGR.laranja}`,
              padding: '32px 28px', borderRadius: 10,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(212,121,42,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.laranja }}>
                <Ico name={a.i} size={22} />
              </div>
              <h3 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 19, color: '#fff', margin: 0, lineHeight: 1.3, letterSpacing: -0.3 }}>{a.t}</h3>
              <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.78)', margin: 0 }}>{a.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 6. PROVA SOCIAL — 3 cases reais (Tropsabor, Sorvetão, Ecoflora)
// =====================================================================
function CI_Prova() {
  const cases = [
    {
      img: 'assets/tropsabor-fachada.png',
      cliente: 'Tropsabor', setor: 'Indústria alimentícia',
      especs: [
        ['Tipo', 'Construção em isopainel'],
        ['Escopo', 'Fachada, divisórias internas e área de produção'],
        ['Material', 'Isopainel modular'],
        ['Refrigeração', 'Sistema integrado executado pela MGR'],
      ],
      cit: '"[depoimento do gestor da Tropsabor a coletar]"',
    },
    {
      img: 'assets/sorvetao-fachada.png',
      cliente: 'Sorvetão', setor: 'Indústria de sorvetes',
      especs: [
        ['Tipo', 'Fachada e casa de máquinas em isopainel'],
        ['Escopo', 'Fechamento da fachada principal e área técnica'],
        ['Material', 'Isopainel branco'],
        ['Refrigeração', 'Sistema integrado'],
      ],
      cit: '"[depoimento do gestor da Sorvetão a coletar]"',
    },
    {
      img: 'assets/ecoflora-unidade.png',
      cliente: 'Ecoflora', setor: 'Indústria agro/alimentícia',
      especs: [
        ['Tipo', 'Edificação modular completa'],
        ['Escopo', 'Estrutura, montagem e unidade de operação'],
        ['Material', 'Isopainel modular'],
        ['Refrigeração', 'Sistema integrado'],
      ],
      cit: '"[depoimento do gestor da Ecoflora a coletar]"',
    },
  ];
  return (
    <section id="projetos" style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Projetos Executados</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.1, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 56px', maxWidth: 880 }}>
          +200 obras entregues<br />em mais de <span style={{ color: MGR.acento }}>20 anos de campo</span>.
        </h2>
        <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 56 }}>
          {cases.map((c, i) => (
            <div key={i} style={{ background: '#fff', border: `1px solid ${MGR.cinzaClaro}`, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 4px 14px rgba(13,59,94,0.06)' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: MGR.azulEscuro }}>
                <img src={c.img} alt={c.cliente} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <span style={{
                  position: 'absolute', top: 12, left: 12, background: MGR.azulEscuro, color: '#fff',
                  padding: '4px 10px', borderRadius: 4, fontFamily: MGR.mono, fontSize: 10, fontWeight: 700,
                  letterSpacing: 1.2, textTransform: 'uppercase',
                }}>● Foto Real MGR</span>
              </div>
              <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
                <div>
                  <h4 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 20, color: MGR.azulEscuro, margin: 0, letterSpacing: -0.4 }}>{c.cliente}</h4>
                  <div style={{ fontSize: 12, color: MGR.acento, marginTop: 4, fontWeight: 600, fontFamily: MGR.mono, letterSpacing: 1, textTransform: 'uppercase' }}>{c.setor}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 14, borderTop: `1px solid ${MGR.cinzaClaro}` }}>
                  {c.especs.map((s, j) => (
                    <div key={j} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, fontSize: 13, lineHeight: 1.5 }}>
                      <span style={{ color: MGR.cinzaMedio, fontFamily: MGR.mono, fontSize: 10.5, letterSpacing: 0.8, textTransform: 'uppercase', paddingTop: 2 }}>{s[0]}</span>
                      <span style={{ color: MGR.grafite, fontWeight: 500 }}>{s[1]}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 13, color: MGR.cinzaMedio, lineHeight: 1.55, fontStyle: 'italic', margin: 0, marginTop: 'auto', paddingTop: 14, borderTop: `1px solid ${MGR.cinzaClaro}` }}>
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
          {['+20 anos de campo', '+200 projetos entregues', 'Equipe técnica própria', 'Atendemos todo SP'].map((it, i, a) => (
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
function CI_Processo() {
  const passos = [
    { n: '01', t: 'Solicite seu orçamento', d: 'Preencha o formulário abaixo. Em até 1 dia útil entramos em contato para entender seu projeto.' },
    { n: '02', t: 'Reunião de definição', d: 'Agendamos reunião remota (videochamada) ou presencial na sede MGR em Indaiatuba para alinhar o escopo (fachada, telhado, divisória, construção integral), o tipo de operação industrial e o cronograma. Sem deslocamento desnecessário da nossa equipe — sem custo para você nesta fase.' },
    { n: '03', t: 'Proposta técnica e orçamento', d: 'Entregamos proposta documentada com escopo detalhado, especificação dos painéis, prazo de execução e investimento. Sem surpresas: o que está na proposta é o que executamos.' },
    { n: '04', t: 'Visita de Valor e execução chave-na-mão', d: 'Após o aceite da proposta, fazemos a Visita de Valor presencial no seu local para levantamento técnico final e ajustes de escopo se necessário. Em seguida, iniciamos a execução em isopainel — incluindo refrigeração e elétrica de refrigeração quando aplicável — e entregamos com Relatório Final de Execução.' },
  ];
  return (
    <section style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Como Funciona</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 72px', maxWidth: 920 }}>
          4 passos do primeiro contato<br />à <span style={{ color: MGR.acento }}>fábrica em operação</span>.
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
              <p style={{ fontSize: 14, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
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
function CI_FAQ() {
  const [open, setOpen] = React.useState(0);
  const faqs = [
    { q: 'Como funciona o atendimento da MGR? Vocês vêm ao meu local logo no início?',
      a: 'A primeira etapa é definir o projeto remotamente — em videochamada ou em reunião presencial na nossa sede em Indaiatuba. Com base nessa conversa, geramos a proposta técnica e o orçamento. A Visita de Valor presencial no seu local acontece após o aceite da proposta, para levantamento técnico final e ajustes antes da execução. Esse fluxo evita custos desnecessários no início e garante que, quando formos ao seu local, é para executar — não para vender.' },
    { q: 'A MGR faz a estrutura metálica ou colunas pré-moldadas da fábrica?',
      a: 'Não. A MGR executa a edificação em isopainel — paredes, divisórias, fachada, telhado térmico. Estrutura metálica, colunas pré-moldadas, fundação e alvenaria externa ficam por conta do cliente ou parceiros estruturais. Sobre a estrutura existente ou pré-moldada, a MGR fecha a edificação inteira em isopainel.' },
    { q: 'Qual o prazo de execução de uma obra em isopainel?',
      a: 'Depende muito do escopo. Fachadas e divisórias podem ser entregues em poucas semanas. Construção integral de fábrica pode levar de 1 a 4 meses dependendo do tamanho da planta — definimos o cronograma exato no orçamento. Em qualquer cenário, é significativamente mais rápido que alvenaria convencional.' },
    { q: 'Por que isopainel é melhor que alvenaria para indústria de alimentos?',
      a: 'Três motivos principais: prazo de obra muito menor, desempenho térmico superior (núcleo isolante de poliuretano) e superfície 100% lavável (sem juntas, sem reboco que descasca, aceita higienização agressiva). Para indústria de alimentos, esses três pontos justificam economicamente a escolha do isopainel.' },
    { q: 'Qual a diferença entre Turnkey Completo e Retrofit Turnkey?',
      a: 'Turnkey Completo MGR é para construção nova — fábrica nova, expansão de área, novo galpão. Retrofit Turnkey MGR é para modernização ou ampliação de planta existente — substituição de fachada antiga, fechamento de área aberta, troca de divisórias. A metodologia técnica é a mesma, o que muda é o ponto de partida.' },
    { q: 'A MGR atende construção em isopainel para qual setor?',
      a: 'Foco principal em indústria de alimentos (panificação, frigoríficos, processamento, congelados, lácteos), logística cold chain e varejo industrial. Atendemos também segmentos adjacentes como cosméticos e farmacêutica leve. Não atendemos: residencial, comércio convencional sem requisito térmico, ambientes hospitalares.' },
    { q: 'A MGR também faz a refrigeração da câmara/sala dentro da fábrica?',
      a: 'Sim. Quando o projeto inclui câmara fria, sala limpa ou área refrigerada, a MGR executa o sistema de refrigeração e a elétrica de refrigeração integrados à obra de isopainel. Mesma equipe, mesmo padrão técnico, sem lacuna entre construtora e empresa de refrigeração.' },
    { q: 'A MGR atende fora de Indaiatuba?',
      a: 'Sim. Atendemos todo o estado de São Paulo e regiões próximas. Para projetos fora de SP, avaliamos caso a caso conforme volume, ticket e logística. A reunião de definição do projeto pode ser remota — sem deslocamento.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Perguntas Frequentes</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 56px', maxWidth: 820 }}>
          O que todo empresário industrial pergunta<br />antes de fechar uma obra em isopainel.
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
                <div style={{ maxHeight: isOpen ? 600 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
                  <p style={{ fontSize: 15.5, lineHeight: 1.7, color: MGR.cinzaMedio, margin: 0, padding: '0 4px 28px', maxWidth: 820 }}>{f.a}</p>
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
function CI_Form() {
  const [state, setState] = React.useState({
    nome: '', empresa: '', whatsapp: '', setor: '', escopo: '', cidade: '', preferencia: '',
  });
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
    'Construção integral de fábrica nova': 'turnkey_completo',
    'Expansão / modernização de planta existente': 'retrofit_turnkey',
    'Câmaras frias e congeladas': 'turnkey_completo',
    'Sala limpa ou sala de produção': 'turnkey_completo',
    'Fachada industrial em isopainel': 'turnkey_completo',
    'Telhado térmico em isopainel': 'turnkey_completo',
    'Divisórias internas / fechamento de galpão': 'turnkey_completo',
    'Ainda estou avaliando — preciso de orientação': 'consultiva',
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!state.nome || !state.empresa || !state.whatsapp || !state.setor || !state.escopo || !state.cidade || !state.preferencia) return;

    setSubmitting(true); setError(null);
    try {
      const payload = {
        nome: state.nome, empresa: state.empresa,
        whatsapp: state.whatsapp,
        setor: state.setor,
        escopo: state.escopo,
        cidade: state.cidade,
        preferencia_reuniao: state.preferencia,
        origem: 'construcao-isopainel',
        url_origem: window.location.href,
        data_criacao: new Date().toISOString(),
        status: 'novo', atendido: false,
        tipo_servico: mapTipo[state.escopo] || 'consultiva',
      };

      if (window.__mgrSaveLead) {
        await window.__mgrSaveLead(payload);
      } else {
        console.log('[MGR Lead - Construção Isopainel]', payload);
        await new Promise((r) => setTimeout(r, 600));
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'lead_form_submit',
        lead_origem: 'construcao-isopainel',
        lead_setor: state.setor,
        lead_escopo: state.escopo,
        lead_preferencia_reuniao: state.preferencia,
      });

      const msg = `Olá! Acabei de solicitar um orçamento pelo site MGR.

*Dados do contato:*
• Nome: ${state.nome}
• Empresa: ${state.empresa}
• WhatsApp: ${state.whatsapp}
• Cidade: ${state.cidade}

*Setor:*
${state.setor}

*Escopo da obra (Construção em Isopainel):*
${state.escopo}

*Preferência para reunião de definição:*
${state.preferencia}

Aguardo retorno para agendar a reunião. Obrigado!`;
      const url = `https://wa.me/${CI_WHATS_NUM}?text=${encodeURIComponent(msg)}`;

      setSuccess(url);
      setTimeout(() => { window.open(url, '_blank', 'noopener'); }, 800);
    } catch (err) {
      console.error(err);
      setError('Erro ao enviar. Tente novamente em instantes.');
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
  const selectArrow = {
    appearance: 'none', paddingRight: 44,
    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3e%3cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e")`,
    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 18px center',
  };

  const reforcos = [
    'Definição do projeto sem custo — remota ou na sede MGR',
    'Proposta técnica documentada antes de qualquer execução',
    'Construção até 3x mais rápida que alvenaria',
    'Refrigeração integrada quando o projeto inclui',
    'Visita de Valor presencial após o aceite — focada em execução',
    'Atendemos todo o estado de São Paulo',
  ];

  return (
    <section id="form" style={{
      background: `linear-gradient(180deg, ${MGR.azulEscuro} 0%, ${MGR.azul} 100%)`,
      color: '#fff', padding: '120px 56px', fontFamily: MGR.sans,
    }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 24 }}>● Solicitar Orçamento</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(30px, 3.8vw, 48px)', lineHeight: 1.1, letterSpacing: -1.2, color: '#fff', margin: '0 0 20px', maxWidth: 900 }}>
          Pronto para construir<br /><span style={{ color: MGR.laranja }}>sua planta industrial em isopainel?</span>
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '0 0 56px', maxWidth: 800 }}>
          Preencha os dados abaixo. Após o envio, abriremos o WhatsApp do nosso comercial com seus dados já preenchidos. Definimos seu projeto em reunião remota ou na nossa sede em Indaiatuba — você escolhe.
        </p>

        <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 56, alignItems: 'start' }}>
          <div style={{
            background: '#fff', borderRadius: 14, padding: 40,
            color: MGR.grafite, boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
          }}>
            {!success ? (
              <form onSubmit={submit} id="form-construcao-isopainel">
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
                  <label style={labelStyle}>Setor da indústria *</label>
                  <select required value={state.setor} onChange={set('setor')} style={{ ...inputStyle, ...selectArrow }}>
                    <option value="" disabled>Selecione…</option>
                    <option value="Indústria alimentícia">Indústria alimentícia</option>
                    <option value="Panificação industrial">Panificação industrial</option>
                    <option value="Frigorífico / processamento">Frigorífico / processamento</option>
                    <option value="Logística cold chain">Logística cold chain</option>
                    <option value="Cosméticos">Cosméticos</option>
                    <option value="Farmacêutica leve">Farmacêutica leve</option>
                    <option value="Outro setor industrial">Outro setor industrial</option>
                  </select>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Escopo da obra *</label>
                  <select required value={state.escopo} onChange={set('escopo')} style={{ ...inputStyle, ...selectArrow }}>
                    <option value="" disabled>Selecione…</option>
                    <option value="Construção integral de fábrica nova">Construção integral de fábrica nova</option>
                    <option value="Expansão / modernização de planta existente">Expansão / modernização de planta existente</option>
                    <option value="Câmaras frias e congeladas">Câmaras frias e congeladas</option>
                    <option value="Sala limpa ou sala de produção">Sala limpa ou sala de produção</option>
                    <option value="Fachada industrial em isopainel">Fachada industrial em isopainel</option>
                    <option value="Telhado térmico em isopainel">Telhado térmico em isopainel</option>
                    <option value="Divisórias internas / fechamento de galpão">Divisórias internas / fechamento de galpão</option>
                    <option value="Ainda estou avaliando — preciso de orientação">Ainda estou avaliando — preciso de orientação</option>
                  </select>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Cidade do projeto *</label>
                  <input required type="text" placeholder="Cidade — UF" value={state.cidade} onChange={set('cidade')} style={inputStyle} />
                </div>
                <div style={{ marginBottom: 28 }}>
                  <label style={labelStyle}>Preferência para reunião de definição *</label>
                  <select required value={state.preferencia} onChange={set('preferencia')} style={{ ...inputStyle, ...selectArrow }}>
                    <option value="" disabled>Selecione…</option>
                    <option value="Reunião remota (videochamada)">Reunião remota (videochamada)</option>
                    <option value="Reunião presencial na sede MGR em Indaiatuba">Reunião presencial na sede MGR em Indaiatuba</option>
                    <option value="Sem preferência — comercial decide">Sem preferência — comercial decide</option>
                  </select>
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

                <p style={{ fontSize: 12.5, color: MGR.cinzaMedio, lineHeight: 1.55, margin: '14px 0 0', textAlign: 'center' }}>
                  Após enviar, abriremos o WhatsApp do nosso comercial com seus dados preenchidos. A primeira reunião acontece remotamente ou na nossa sede — sem deslocamento da nossa equipe ao seu local nesta fase.
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
                <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 28px', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
                  Estamos abrindo o WhatsApp do nosso comercial com seus dados para que você confirme o atendimento. Em até 1 dia útil agendamos a reunião de definição do seu projeto — remota ou na nossa sede em Indaiatuba, conforme sua preferência.
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
// 10. FOOTER MÍNIMO (sem telefone)
// =====================================================================
function CI_Footer() {
  return (
    <footer style={{ background: MGR.azulEscuro, color: 'rgba(255,255,255,0.7)', padding: '64px 56px 32px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div className="grid-footer-min" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 48, marginBottom: 40, alignItems: 'start' }}>
          <div>
            <MGRLogo inverse size={56} />
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.6)', margin: '20px 0 0', maxWidth: 420 }}>
              MGR Soluções e Tecnologia da Refrigeração<br />
              Indaiatuba/SP — atendemos todo o estado de São Paulo.
            </p>
          </div>
          <div>
            <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', fontWeight: 600, marginBottom: 14 }}>Links</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <a href="MGR Homepage.html" style={{ color: 'rgba(255,255,255,0.85)' }}>mgrrefrigeracao.com.br</a>
              <a href="#" style={{ color: 'rgba(255,255,255,0.6)' }}>Política de Privacidade</a>
            </div>
          </div>
        </div>
        <div style={{
          paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12,
          fontSize: 12, color: 'rgba(255,255,255,0.45)',
        }}>
          <span>© 2026 MGR Soluções e Tecnologia da Refrigeração</span>
          <span style={{ fontFamily: MGR.mono, letterSpacing: 0.4 }}>Construção Industrial em Isopainel · Indaiatuba/SP</span>
        </div>
      </div>
    </footer>
  );
}

// =====================================================================
// PÁGINA
// =====================================================================
function PageConstrucaoIsopainel() {
  return (
    <>
      <CI_Header />
      <CI_Hero />
      <CI_Problema />
      <CI_Solucao />
      <CI_Aplicacoes />
      <CI_Prova />
      <CI_Processo />
      <CI_FAQ />
      <CI_Form />
      <CI_Footer />
    </>
  );
}

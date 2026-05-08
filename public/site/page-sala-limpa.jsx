// MGR · LP Sala Limpa em Isopainel — captura de demanda.
// LP de projeto: sem telefone exibido. WhatsApp abre pós-submit com dados pré-preenchidos.

const SL_WHATS_NUM = '5519983073630';

// =====================================================================
// 1. HEADER (sem menu, sem telefone)
// =====================================================================
function SL_Header() {
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
function SL_Hero() {
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
              Sala Limpa em Isopainel
            </div>
            <h1 className="h1" style={{
              fontFamily: MGR.sans, fontWeight: 800,
              fontSize: 'clamp(40px, 5.4vw, 60px)', lineHeight: 1.04,
              letterSpacing: -1.6, margin: '0 0 28px',
            }}>
              Sala limpa industrial:<br />envelope térmico{' '}
              <span style={{ fontStyle: 'italic', color: MGR.laranja, fontWeight: 800 }}>
                vedado, higienizável e operando
              </span>.
            </h1>
            <p style={{
              fontSize: 'clamp(16px, 1.4vw, 19px)', lineHeight: 1.55,
              color: 'rgba(255,255,255,0.82)', margin: '0 0 36px', maxWidth: 580, fontWeight: 400,
            }}>
              Construção do envoltório térmico em isopainel branco ou inox, com refrigeração e elétrica integradas pela mesma equipe MGR. Para indústria alimentícia, panificação industrial, pescados, cosméticos e farmacêutica leve.
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
            <img src="assets/croassant-camara-interior.png" alt="Sala limpa em isopainel MGR — Croassant e Cia"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.55) 100%)' }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
              <div style={{ background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.sucesso, letterSpacing: 1.5, fontWeight: 600 }}>● ENTREGUE EM OPERAÇÃO</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Sala limpa · Isopainel modular</div>
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
function SL_Problema() {
  const cards = [
    { i: 'shield', t: 'Junções mal feitas e o ambiente "respira" sujeira',
      d: 'Sala limpa montada com painéis genéricos e juntas sem vedação técnica. Poeira entra, ar contaminado circula, temperatura escapa. O ambiente atende a aparência mas não a função.' },
    { i: 'chart', t: 'Quando o frio é projetado depois da obra',
      d: 'Sala limpa construída por uma empresa, refrigeração instalada por outra, sem dimensionamento integrado. A refrigeração luta contra um envelope que não foi pensado para ela. Resultado: temperatura instável, consumo alto, equipamento estressado.' },
    { i: 'gear', t: 'Material que não aguenta a rotina de limpeza',
      d: 'Painéis de baixa qualidade que descascam, juntas de silicone que mofam, cantos que acumulam resíduo. A operação tenta higienizar todos os dias e a sala vai se deteriorando — auditoria sanitária expõe o que era invisível.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● O Que a Maioria dos Projetos de Sala Limpa Erra</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 64px', maxWidth: 920 }}>
          Sala limpa que não veda,<br />não controla temperatura<br />e <em style={{ color: MGR.acento, fontStyle: 'italic' }}>não dá para higienizar</em>.
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
function SL_Solucao() {
  const pilares = [
    { i: 'shield', t: 'Isopainel branco ou inox sob medida',
      d: 'Painéis brancos para a maioria das aplicações alimentícias e de processo. Painéis em inox quando o padrão de limpeza exige superfície metálica e resistência química. Vedação selada nas juntas, ambiente 100% lavável.' },
    { i: 'gear', t: 'Refrigeração dimensionada para o ambiente',
      d: 'Cálculo térmico baseado na carga real da sala (volume, equipamentos internos, abertura de porta, temperatura externa). Sistema instalado e comissionado pela mesma equipe que construiu o envoltório.' },
    { i: 'mountain', t: 'Integração com sala de produção',
      d: 'Quando o projeto pede integração com a sala de produção, executamos o conjunto inteiro em isopainel — sala limpa + área produtiva, com a mesma metodologia construtiva. Mais agilidade, mesmo padrão térmico, mesma higienização.' },
    { i: 'bell', t: 'Elétrica de refrigeração inclusa',
      d: 'Quadros, cabeamento e conexões da refrigeração executados pela equipe MGR. Sem dependência de elétrica de terceiros para fechar a entrega operacional.' },
  ];
  return (
    <section style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Sala Limpa em Isopainel MGR</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 24px', maxWidth: 940 }}>
          Envoltório térmico vedado,<br />higienizável, com <span style={{ color: MGR.acento }}>refrigeração integrada</span>.
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 56px', maxWidth: 820 }}>
          Construímos a sala limpa industrial inteira em isopainel modular — branco para alimentos e processos, inox quando o padrão de higiene exige superfície metálica. Refrigeração e elétrica de refrigeração executadas pela mesma equipe MGR. Sem lacuna entre fornecedores.
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
            <strong>Escopo MGR:</strong> envoltório térmico em isopainel + refrigeração + elétrica de refrigeração. Sistemas de filtragem absoluta de particulado (HEPA), classe ISO de limpeza certificada e validação farmacêutica ficam por conta de especialista de particulado parceiro do cliente.
          </p>
        </div>
      </div>
    </section>
  );
}

// =====================================================================
// 5. APLICAÇÕES — 6 cards 3x2
// =====================================================================
function SL_Aplicacoes() {
  const apps = [
    { i: 'flake', t: 'Indústria alimentícia', d: 'Salas de manipulação, processamento e embalagem para alimentos perecíveis e congelados. Padrão higiênico exigido por SIF, MAPA e auditorias de cliente.' },
    { i: 'mountain', t: 'Panificação industrial', d: 'Salas de produção, fermentação controlada, modelagem e embalagem em ambiente higienizado para grandes panificadoras e congeladoras.' },
    { i: 'shield', t: 'Processamento de pescados', d: 'Salas de filetagem, embalagem e congelamento para indústrias de pescados — ambiente lavável, vedado e com temperatura controlada.' },
    { i: 'clock', t: 'Cosméticos', d: 'Salas de envase, manipulação e embalagem para indústria cosmética que exige ambiente limpo e temperatura estável.' },
    { i: 'doc', t: 'Farmacêutica leve', d: 'Envoltório térmico para áreas de embalagem, armazenamento e manipulação leve. Validação farmacêutica e classe ISO ficam com especialista parceiro do cliente.' },
    { i: 'gear', t: 'Salas de produção integradas', d: 'Quando a sala limpa precisa ser parte de uma sala de produção maior, executamos o conjunto inteiro em isopainel — mais ágil, mesmo padrão de higiene.' },
  ];
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.laranja, fontWeight: 600, marginBottom: 24 }}>● Onde Aplicamos</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.1, letterSpacing: -1, color: '#fff', margin: '0 0 56px', maxWidth: 920 }}>
          Onde a Sala Limpa em Isopainel MGR<br />faz a <span style={{ color: MGR.laranja }}>diferença na operação</span>.
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
// 6. PROVA SOCIAL — 2 cases reais
// =====================================================================
function SL_Prova() {
  const cases = [
    {
      img: 'assets/indaia-pescados-vestiario.png',
      cliente: 'Indaiá Pescados', setor: 'Processamento de pescados',
      especs: [
        ['Tipo', 'Sala de triagem e higienização de funcionários'],
        ['Escopo', 'Fechamento em isopainel acoplado à parede de alvenaria existente, aproveitando o encanamento de água já instalado'],
        ['Função', 'Separação da sala dos demais ambientes e triagem dos funcionários antes da entrada na produção'],
        ['Material', 'Isopainel branco com vedação selada e porta industrial'],
      ],
      cit: '"[depoimento do gestor da Indaiá Pescados a coletar]"',
    },
    {
      img: 'assets/croassant-camara-interior.png',
      cliente: 'Croassant e Cia', setor: 'Panificação industrial',
      especs: [
        ['Tipo', 'Sala limpa de grande porte'],
        ['Aplicação', 'Produção e embalagem de produtos panificados'],
        ['Material', 'Isopainel modular para grandes vãos'],
        ['Refrigeração', 'Sistema integrado executado pela MGR'],
      ],
      cit: '"[depoimento do gestor da Croassant e Cia a coletar]"',
    },
  ];
  return (
    <section id="projetos" style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Projetos Executados</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.1, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 56px', maxWidth: 880 }}>
          Salas limpas em operação<br />em indústrias que <span style={{ color: MGR.acento }}>não podem parar</span>.
        </h2>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 28, marginBottom: 56 }}>
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
              <div style={{ padding: '28px 28px 32px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
                <div>
                  <h4 style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 22, color: MGR.azulEscuro, margin: 0, letterSpacing: -0.4 }}>{c.cliente}</h4>
                  <div style={{ fontSize: 13, color: MGR.acento, marginTop: 4, fontWeight: 600, fontFamily: MGR.mono, letterSpacing: 1, textTransform: 'uppercase' }}>{c.setor}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: `1px solid ${MGR.cinzaClaro}` }}>
                  {c.especs.map((s, j) => (
                    <div key={j} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, fontSize: 13.5, lineHeight: 1.5 }}>
                      <span style={{ color: MGR.cinzaMedio, fontFamily: MGR.mono, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', paddingTop: 2 }}>{s[0]}</span>
                      <span style={{ color: MGR.grafite, fontWeight: 500 }}>{s[1]}</span>
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: 14, color: MGR.cinzaMedio, lineHeight: 1.55, fontStyle: 'italic', margin: 0, marginTop: 'auto', paddingTop: 18, borderTop: `1px solid ${MGR.cinzaClaro}` }}>
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
function SL_Processo() {
  const passos = [
    { n: '01', t: 'Solicite seu orçamento', d: 'Preencha o formulário abaixo. Em até 1 dia útil entramos em contato para entender seu projeto.' },
    { n: '02', t: 'Reunião de definição', d: 'Agendamos reunião remota (videochamada) ou presencial na sede MGR em Indaiatuba para alinhar requisitos, setor de atuação, padrão de higiene exigido e cronograma do seu projeto. Sem deslocamento desnecessário da nossa equipe — sem custo para você.' },
    { n: '03', t: 'Proposta técnica e orçamento', d: 'Entregamos proposta documentada com escolha entre isopainel branco ou inox, dimensionamento da refrigeração, prazo de execução e investimento. Sem surpresas: o que está na proposta é o que executamos.' },
    { n: '04', t: 'Visita de Valor e execução chave-na-mão', d: 'Após o aceite da proposta, fazemos a Visita de Valor presencial no seu local para levantamento técnico final e ajustes de escopo se necessário. Em seguida, iniciamos a execução — envoltório em isopainel, refrigeração, elétrica de refrigeração — e entregamos com Relatório Final de Execução.' },
  ];
  return (
    <section style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Como Funciona</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 72px', maxWidth: 920 }}>
          4 passos do primeiro contato<br />à <span style={{ color: MGR.acento }}>sala limpa operando</span>.
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
function SL_FAQ() {
  const [open, setOpen] = React.useState(0);
  const faqs = [
    { q: 'Como funciona o atendimento da MGR? Vocês vêm ao meu local logo no início?',
      a: 'A primeira etapa é definir o projeto remotamente — em videochamada ou em reunião presencial na nossa sede em Indaiatuba. Com base nessa conversa, geramos a proposta técnica e o orçamento. A Visita de Valor presencial no seu local acontece após o aceite da proposta, para levantamento técnico final e ajustes antes da execução. Esse fluxo evita custos desnecessários no início e garante que, quando formos ao seu local, é para executar — não para vender.' },
    { q: 'Qual o prazo de execução de uma sala limpa em isopainel?',
      a: 'Salas de pequeno porte costumam ser entregues em 30 a 45 dias após aprovação do projeto. Salas de grande porte ou integradas a sala de produção precisam de cronograma específico — entregamos no orçamento. O prazo do isopainel é significativamente menor do que o de alvenaria convencional.' },
    { q: 'A MGR entrega sala limpa com certificação ISO de classe de limpeza?',
      a: 'Não. A MGR entrega o envoltório térmico em isopainel, com refrigeração e elétrica de refrigeração integradas. A certificação ISO de classe de limpeza (controle de particulado), sistemas HEPA de filtragem absoluta e validação farmacêutica formal são executados por especialista de particulado parceiro do cliente — somos transparentes sobre esse limite de escopo.' },
    { q: 'Quando usar isopainel branco e quando usar inox?',
      a: 'Isopainel branco atende a maioria das aplicações alimentícias, panificação industrial, processamento e embalagem — vedação selada, ambiente 100% lavável, ótimo custo-benefício. Isopainel inox é indicado quando o padrão de limpeza exige superfície metálica resistente a químicos agressivos ou quando o cliente solicita por regra interna de qualidade. Definimos no projeto técnico.' },
    { q: 'A MGR atende sala limpa nova e modernização da existente?',
      a: 'Sim. Para sala limpa nova, executamos via Turnkey Completo MGR. Para modernização, expansão ou troca de envoltório, executamos via Retrofit Turnkey MGR — adaptado à estrutura existente.' },
    { q: 'Quais setores a MGR atende em sala limpa?',
      a: 'Indústria alimentícia, panificação industrial, processamento de pescados, cosméticos e farmacêutica leve. Não atendemos: ambientes hospitalares de controle de bactérias, salas de cirurgia, isolamento biológico — esses exigem especialistas dedicados.' },
    { q: 'A sala limpa pode ser integrada à sala de produção?',
      a: 'Sim — e essa é uma das maiores vantagens da construção em isopainel. Quando o projeto pede integração com a sala de produção, executamos o conjunto inteiro em isopainel modular, mantendo o mesmo padrão térmico e higiênico em toda a área. Mais ágil que dividir em duas obras separadas.' },
    { q: 'A MGR atende fora de Indaiatuba?',
      a: 'Sim. Atendemos todo o estado de São Paulo e regiões próximas. Para projetos fora de SP, avaliamos caso a caso conforme volume, ticket e logística. A reunião de definição do projeto pode ser remota — sem deslocamento.' },
  ];
  return (
    <section style={{ background: '#fff', padding: '120px 56px', fontFamily: MGR.sans }} className="pad">
      <div style={{ maxWidth: 920, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: MGR.acento, fontWeight: 600, marginBottom: 24 }}>● Perguntas Frequentes</div>
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(28px, 3.6vw, 44px)', lineHeight: 1.15, letterSpacing: -1, color: MGR.azulEscuro, margin: '0 0 56px', maxWidth: 800 }}>
          O que todo gestor pergunta antes<br />de contratar uma sala limpa em isopainel.
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
                <div style={{ maxHeight: isOpen ? 500 : 0, overflow: 'hidden', transition: 'max-height .3s ease' }}>
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
function SL_Form() {
  const [state, setState] = React.useState({
    nome: '', empresa: '', whatsapp: '', setor: '', tipo: '', cidade: '', preferencia: '',
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
    'Sala limpa nova (do zero)': 'turnkey_completo',
    'Modernização / expansão de sala existente': 'retrofit_turnkey',
    'Sala limpa integrada à sala de produção': 'turnkey_completo',
    'Ainda estou avaliando — preciso de orientação técnica': 'consultiva',
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!state.nome || !state.empresa || !state.whatsapp || !state.setor || !state.tipo || !state.cidade || !state.preferencia) return;

    setSubmitting(true); setError(null);
    try {
      const payload = {
        nome: state.nome, empresa: state.empresa,
        whatsapp: state.whatsapp,
        setor: state.setor,
        tipo_projeto: state.tipo,
        cidade: state.cidade,
        preferencia_reuniao: state.preferencia,
        origem: 'sala-limpa-industrial',
        url_origem: window.location.href,
        data_criacao: new Date().toISOString(),
        status: 'novo', atendido: false,
        tipo_servico: mapTipo[state.tipo] || 'consultiva',
      };

      if (window.__mgrSaveLead) {
        await window.__mgrSaveLead(payload);
      } else {
        console.log('[MGR Lead - Sala Limpa Industrial]', payload);
        await new Promise((r) => setTimeout(r, 600));
      }

      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'lead_form_submit',
        lead_origem: 'sala-limpa-industrial',
        lead_setor: state.setor,
        lead_tipo_projeto: state.tipo,
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

*Tipo de projeto (Sala Limpa em Isopainel):*
${state.tipo}

*Preferência para reunião de definição:*
${state.preferencia}

Aguardo retorno para agendar a reunião. Obrigado!`;
      const url = `https://wa.me/${SL_WHATS_NUM}?text=${encodeURIComponent(msg)}`;

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
    'Execução chave-na-mão (isopainel + refrigeração + elétrica)',
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
        <h2 className="h2" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 'clamp(30px, 3.8vw, 48px)', lineHeight: 1.1, letterSpacing: -1.2, color: '#fff', margin: '0 0 20px', maxWidth: 880 }}>
          Pronto para projetar<br /><span style={{ color: MGR.laranja }}>sua sala limpa em isopainel?</span>
        </h2>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '0 0 56px', maxWidth: 760 }}>
          Preencha os dados abaixo. Após o envio, abriremos o WhatsApp do nosso comercial com seus dados já preenchidos. Definimos seu projeto em reunião remota ou na nossa sede em Indaiatuba — você escolhe.
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
                  <label style={labelStyle}>Setor da indústria *</label>
                  <select required value={state.setor} onChange={set('setor')} style={{ ...inputStyle, ...selectArrow }}>
                    <option value="" disabled>Selecione…</option>
                    <option value="Indústria alimentícia">Indústria alimentícia</option>
                    <option value="Panificação industrial">Panificação industrial</option>
                    <option value="Processamento de pescados">Processamento de pescados</option>
                    <option value="Cosméticos">Cosméticos</option>
                    <option value="Farmacêutica leve">Farmacêutica leve</option>
                    <option value="Outro setor industrial">Outro setor industrial</option>
                  </select>
                </div>
                <div style={{ marginBottom: 22 }}>
                  <label style={labelStyle}>Tipo de projeto *</label>
                  <select required value={state.tipo} onChange={set('tipo')} style={{ ...inputStyle, ...selectArrow }}>
                    <option value="" disabled>Selecione…</option>
                    <option value="Sala limpa nova (do zero)">Sala limpa nova (do zero)</option>
                    <option value="Modernização / expansão de sala existente">Modernização / expansão de sala existente</option>
                    <option value="Sala limpa integrada à sala de produção">Sala limpa integrada à sala de produção</option>
                    <option value="Ainda estou avaliando — preciso de orientação técnica">Ainda estou avaliando — preciso de orientação técnica</option>
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
function SL_Footer() {
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
function PageSalaLimpa() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <SL_Header />
      <SL_Hero />
      <SL_Problema />
      <SL_Solucao />
      <SL_Aplicacoes />
      <SL_Prova />
      <SL_Processo />
      <SL_FAQ />
      <SL_Form />
      <SL_Footer />
    </div>
  );
}

Object.assign(window, { PageSalaLimpa });

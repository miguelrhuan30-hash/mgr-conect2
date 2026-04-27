// MGR · Turnkey Completo — Projeto, Execução e Entrega Chave-na-Mão
// Acessada pelo card 01 (Saber mais) da home.

const WHATS_T = 'https://wa.me/5519983073630';

function T_Nav() {
  return <MGRHeader active="ciclo" />;
}

function T_Crumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <a href="index.html#ciclo" style={{ color: 'rgba(255,255,255,0.7)' }}>Ciclo de Vida</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Turnkey Completo</span>
    </div>
  );
}

function T_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <T_Nav />
      <T_Crumb />
      <div className="pad" style={{ padding: '64px 56px 88px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="01" label="Projeto do zero · Chave-na-mão" color={MGR.laranja} />
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 72, lineHeight: 0.98, letterSpacing: -2.2, color: '#fff', margin: 0 }}>
              Sua refrigeração, do projeto à operação — <span style={{ color: MGR.laranja }}>com um único responsável.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 600 }}>
              Visita de Valor desde a concepção. Dimensionamento, estratégia, compra, execução e comissionamento. Entregamos chave-na-mão para sua equipe operar — sem terceirização do que importa.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={WHATS_T} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                Quero uma Visita de Valor <Ico name="arrow" size={16} />
              </a>
              <a href="#metades" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
                Como funciona
              </a>
            </div>
          </div>
          <div className="hero-img" style={{ position: 'relative', minHeight: 460, borderRadius: 8, overflow: 'hidden', background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <img src="assets/tropsabor-obra-paineis.png" alt="Obra MGR em andamento — montagem de painéis isotérmicos"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, filter: 'brightness(0.88)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.55) 100%)' }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
              <div style={{ background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.sucesso, letterSpacing: 1.5, fontWeight: 600 }}>● OBRA EM EXECUÇÃO</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Equipe MGR · Montagem mecânica</div>
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

function T_Dores() {
  const dores = [
    { i: 'gear', t: 'Equipamento errado, sem dimensionamento', d: 'Sem cálculo técnico, vira ativo subdimensionado (não dá conta) ou superfaturado (dinheiro jogado fora). Em refrigeração, errar de qualquer lado custa caro.' },
    { i: 'shield', t: 'Múltiplos fornecedores, ninguém responsável', d: 'Projetista, instalador e mantenedor diferentes. Quando algo falha, cada um culpa o outro — e quem perde é a operação.' },
    { i: 'check', t: 'Comissionamento informal', d: 'Entrega "ligado e funcionando" sem teste de carga térmica real. Você só descobre o problema quando a câmara não bate temperatura no pico de produção.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 64 }}>
        <SectionTag num="02" label="Por que isso importa" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          O que dá errado quando o projeto é feito em pedaços.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {dores.map((d, i) => (
          <div key={i} style={{ background: '#fff', border: `1px solid ${MGR.cinzaClaro}`, padding: '32px 32px 36px', borderRadius: 6 }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(232,97,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento, marginBottom: 24 }}>
              <Ico name={d.i} size={22} />
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 600, color: MGR.grafite, margin: '0 0 12px', letterSpacing: -0.4 }}>{d.t}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{d.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 03 — DUAS METADES
function T_Metades() {
  const fases = [
    {
      tag: 'FASE A',
      t: 'Concepção e Projeto',
      bullets: ['Visita de Valor inicial', 'Dimensionamento térmico', 'Estratégia de execução', 'Cotação assistida', 'Proposta consolidada'],
      icon: 'doc',
    },
    {
      tag: 'FASE B',
      t: 'Execução e Entrega',
      bullets: ['Mobilização', 'Montagem mecânica e elétrica', 'Testes técnicos', 'Comissionamento documentado', 'Treinamento + entrega operacional'],
      icon: 'gear',
    },
  ];
  return (
    <section id="metades" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans, position: 'relative' }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="03" label="As duas metades do Turnkey MGR" color={MGR.acento} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Uma única empresa. <span style={{ color: MGR.acento }}>Um único responsável.</span>
        </h2>
      </div>

      <div className="metades-wrap" style={{ position: 'relative' }}>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, position: 'relative' }}>
          {fases.map((f, i) => (
            <div key={i} style={{ background: '#fff', padding: '44px 40px 48px', borderRadius: 8, borderTop: `4px solid ${i === 0 ? MGR.azul : MGR.acento}`, boxShadow: '0 12px 32px rgba(13,59,94,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <span style={{ fontFamily: MGR.mono, fontSize: 11, color: i === 0 ? MGR.azul : MGR.acento, letterSpacing: 1.5, fontWeight: 600 }}>{f.tag}</span>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: i === 0 ? MGR.azulClaro : 'rgba(232,97,26,0.1)', color: i === 0 ? MGR.azul : MGR.acento, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ico name={f.icon} size={18} />
                </div>
              </div>
              <h3 style={{ fontSize: 28, fontWeight: 700, color: MGR.grafite, margin: '0 0 24px', letterSpacing: -0.7 }}>{f.t}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {f.bullets.map((b, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: j < f.bullets.length - 1 ? `1px solid ${MGR.cinzaClaro}` : 'none' }}>
                    <span style={{ fontFamily: MGR.mono, fontSize: 11, color: i === 0 ? MGR.azul : MGR.acento, fontWeight: 600, minWidth: 20 }}>0{j + 1}</span>
                    <span style={{ fontSize: 14.5, color: MGR.grafite, fontWeight: 500 }}>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="metades-link" style={{ textAlign: 'center', marginTop: 32 }}>
          <span style={{ display: 'inline-block', background: MGR.azulEscuro, color: '#fff', padding: '14px 28px', borderRadius: 999, fontFamily: MGR.sans, fontSize: 14, fontWeight: 500, letterSpacing: 0.2 }}>
            Do briefing à operação — <span style={{ color: MGR.laranja, fontWeight: 600 }}>uma única empresa</span>, um único responsável.
          </span>
        </div>
      </div>
    </section>
  );
}

// 04 — FASE 1
function T_Fase1() {
  const items = [
    'Visita de Valor inicial — análise da operação, processo e ambiente',
    'Dimensionamento térmico real (carga, infiltração, processo)',
    'Estratégia de execução adaptada à sua planta',
    'Auxílio na seleção e cotação de equipamentos',
    'Orçamento consolidado de compra + execução',
    'Memorial descritivo do dimensionamento',
    'Proposta técnico-comercial detalhada',
    'Cronograma físico-financeiro',
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="04" label="Fase 1" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
            Concepção e <span style={{ color: MGR.azul }}>Projeto.</span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 20 }}>
            Antes de qualquer compra ou intervenção. Tempo técnico investido para entender e fundamentar o projeto.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: MGR.cinzaClaro, padding: '18px 20px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: MGR.azul, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Ico name="check" size={14} />
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: MGR.grafite, fontWeight: 500 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 05 — FASE 2
function T_Fase2() {
  const items = [
    'Montagem mecânica completa (linhas, equipamentos, estrutura)',
    'Instalação elétrica e de comando',
    'Vácuo, carga de gás e teste de estanqueidade',
    'Comissionamento com teste de carga térmica real',
    'Start-up assistido com a operação do parceiro',
    'Treinamento da equipe operacional',
    'Laudo Técnico MGR ao final da obra',
    'Checklist de comissionamento assinado',
    'Plano de continuidade durante a obra (quando aplicável)',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="05" label="Fase 2" color={MGR.acento} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
            Execução e <span style={{ color: MGR.acento }}>Comissionamento.</span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 20 }}>
            Equipe própria em campo. Cada teste documentado. Entrega só com sistema rodando e equipe treinada.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: '#fff', padding: '18px 20px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14, border: `1px solid ${MGR.cinzaClaro}` }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: MGR.acento, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <Ico name="check" size={14} />
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: MGR.grafite, fontWeight: 500 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 06 — TIMELINE 7 ETAPAS
function T_Como() {
  const etapas = [
    { n: '01', t: 'Visita de Valor', d: 'Entender a operação no chão, antes do orçamento.', i: 'doc' },
    { n: '02', t: 'Dimensionamento + estratégia', d: 'Proposta técnica fundamentada, não chute.', i: 'chart' },
    { n: '03', t: 'Cotação e compra assistida', d: 'Comparação técnica, não só preço.', i: 'gear' },
    { n: '04', t: 'Mobilização', d: 'Equipe própria, EPIs, ferramental, logística.', i: 'shield' },
    { n: '05', t: 'Execução faseada', d: 'Cronograma com marcos visíveis e auditáveis.', i: 'clock' },
    { n: '06', t: 'Testes e comissionamento', d: 'Vácuo, estanqueidade, carga térmica, performance.', i: 'bell' },
    { n: '07', t: 'Entrega operacional', d: 'Sistema rodando, equipe treinada, documentação completa.', i: 'check' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="06" label="Como trabalhamos" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Sete etapas. Da Visita de Valor à entrega operacional.
        </h2>
      </div>
      <div className="timeline-7" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, position: 'relative' }}>
        {etapas.map((e, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div style={{ background: MGR.cinzaClaro, padding: '24px 18px 26px', borderRadius: 6, height: '100%', borderTop: `3px solid ${i < 3 ? MGR.azul : MGR.acento}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span style={{ fontFamily: MGR.mono, fontSize: 12, fontWeight: 600, color: i < 3 ? MGR.azul : MGR.acento, letterSpacing: 1.2 }}>{e.n}</span>
                <div style={{ width: 28, height: 28, borderRadius: 6, background: '#fff', color: i < 3 ? MGR.azul : MGR.acento, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ico name={e.i} size={14} />
                </div>
              </div>
              <h4 style={{ fontSize: 14.5, fontWeight: 600, color: MGR.grafite, margin: '0 0 8px', letterSpacing: -0.2, lineHeight: 1.25 }}>{e.t}</h4>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: MGR.cinzaMedio, margin: 0 }}>{e.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// 07 — RASTREABILIDADE
function T_Rastreio() {
  const items = [
    'O.S. estruturada para cada intervenção',
    'Relatório Final de Execução ao término de cada serviço',
    'Observações técnicas registradas pelo técnico no campo',
    'Histórico fotográfico antes / durante / depois',
    'Arquivo permanente — você consulta o histórico do seu sistema sempre',
  ];
  return (
    <section className="pad" style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTag num="07" label="Rastreabilidade MGR" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05, maxWidth: 820 }}>
          Você sabe tudo o que aconteceu na sua obra.
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '20px 0 40px', maxWidth: 720 }}>
          Cada intervenção documentada. Cada teste registrado. O arquivo fica com você — não com o instalador que pode sumir amanhã.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: '#fff', padding: '20px 22px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14, borderLeft: `3px solid ${MGR.azul}` }}>
              <Ico name="check" size={18} color={MGR.acento} />
              <span style={{ fontSize: 14, color: MGR.grafite, fontWeight: 500, lineHeight: 1.45 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 08 — DELIVERABLES
function T_Deliverables() {
  const items = [
    'Memorial descritivo do dimensionamento',
    'Proposta técnico-comercial detalhada',
    'Lista de materiais e equipamentos especificados',
    'Cronograma físico-financeiro',
    'Laudo Técnico MGR',
    'Checklist de comissionamento assinado',
    'Relatório Final de Execução',
    'Plantas as-built atualizadas',
    'Manual operacional do sistema',
    'Lista de peças críticas + estoque mínimo recomendado',
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="08" label="Deliverables" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.1 }}>
            O que entregamos documentado.
          </h2>
        </div>
        <div style={{ background: MGR.cinzaClaro, borderRadius: 8, padding: '28px 32px', borderLeft: `4px solid ${MGR.azul}` }}>
          {items.map((t, i) => (
            <div key={i} style={{ padding: '14px 0', borderBottom: i < items.length - 1 ? `1px solid #e0e6ec` : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: MGR.mono, fontSize: 12, color: MGR.azul, fontWeight: 600, letterSpacing: 1, minWidth: 28 }}>{String(i + 1).padStart(2, '0')}</span>
              <Ico name="check" size={16} color={MGR.acento} />
              <span style={{ fontSize: 15, color: MGR.grafite, fontWeight: 500 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 09 — DIFERENCIAL 4 PILARES
function T_Diferencial() {
  const pilares = [
    { i: 'shield', t: 'Único responsável do início ao fim', d: 'Você não fica negociando entre 3 fornecedores. Uma empresa, um contrato, uma responsabilidade.' },
    { i: 'gear', t: 'Especialistas de Campo próprios', d: 'Não terceirizamos serviço crítico. Quem dimensiona é quem executa, é quem entrega.' },
    { i: 'doc', t: 'Visita de Valor antes da venda', d: 'Investimos tempo técnico antes do contrato. Diagnóstico fundamentado, não suposição comercial.' },
    { i: 'check', t: 'Documentação por foto', d: 'Antes / durante / depois de cada etapa. Histórico permanente, auditoria interna possível.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 64 }}>
        <SectionTag num="09" label="Diferencial MGR" color={MGR.laranja} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: '#fff', margin: 0, lineHeight: 1.02 }}>
          Quatro pilares. <span style={{ color: MGR.laranja }}>Zero handoffs.</span>
        </h2>
      </div>
      <div className="grid-2-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
        {pilares.map((p, i) => (
          <div key={i} style={{ background: MGR.azulEscuro, padding: '36px 36px 40px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(212,121,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.laranja, marginBottom: 24 }}>
              <Ico name={p.i} size={24} />
            </div>
            <h4 style={{ fontSize: 22, fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: -0.4 }}>{p.t}</h4>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// 10 — PARA QUEM
function T_ParaQuem() {
  const tags = [
    'Empresas abrindo nova operação',
    'Indústrias alimentícias',
    'Centros de distribuição',
    'Food service em escala',
    'Quem quer um único interlocutor técnico',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '100px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920 }}>
        <SectionTag num="10" label="Para quem serve" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: '0 0 32px', lineHeight: 1.1 }}>
          Operações que querem um parceiro, não um catálogo.
        </h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {tags.map((t, i) => (
            <div key={i} style={{ background: '#fff', border: `1px solid ${MGR.cinzaClaro}`, padding: '14px 22px', borderRadius: 999, fontSize: 14, color: MGR.grafite, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: MGR.acento }} />
              {t}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 11 — NÚMEROS / CASE
function T_Numeros() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, alignItems: 'center' }}>
        <div>
          <SectionTag num="11" label="Números MGR" color={MGR.azul} />
          <div style={{ fontFamily: MGR.mono, fontSize: 14, color: MGR.cinzaMedio, marginBottom: 8, letterSpacing: 1 }}>PROJETOS ENTREGUES</div>
          <div style={{ fontSize: 140, fontWeight: 700, color: MGR.azulEscuro, lineHeight: 1, letterSpacing: -6, fontFamily: MGR.sans }}>
            +200
          </div>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 24, maxWidth: 480 }}>
            Mais de duas décadas em campo. Cada projeto, um aprendizado consolidado para o próximo parceiro.
          </p>
        </div>
        <div style={{ background: MGR.cinzaClaro, borderRadius: 8, padding: '40px 36px', borderLeft: `4px solid ${MGR.acento}` }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.acento, fontWeight: 600, letterSpacing: 1.5, marginBottom: 16 }}>● MINI-CASE · A CONFIRMAR AUTORIZAÇÃO</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: MGR.grafite, lineHeight: 1.3, marginBottom: 16, letterSpacing: -0.3 }}>
            Case [parceiro] — fábrica completa, 100% áreas refrigeradas em isopainéis, casa de máquinas com rack paralelo.
          </div>
          <div style={{ fontSize: 13, color: MGR.cinzaMedio, lineHeight: 1.55 }}>
            Conteúdo detalhado pendente de autorização do parceiro. Em breve aqui.
          </div>
        </div>
      </div>
    </section>
  );
}

// 12 — FAQ
function T_FAQ() {
  const faqs = [
    { q: 'Vocês emitem ART?', a: 'Não emitimos ART. Entregamos Laudo Técnico MGR. Para projetos que exijam responsável CREA, indicamos parceiro habilitado.' },
    { q: 'Atendem fora de Indaiatuba?', a: 'Sim, SP e região.' },
    { q: 'O que entra no turnkey?', a: 'Tudo do dimensionamento à entrega operacional — Visita de Valor, projeto, cotação assistida, montagem, comissionamento e treinamento.' },
    { q: 'Quais refrigerantes?', a: 'HFCs e CO₂. Não trabalhamos com NH₃.' },
    { q: 'Garantia da execução?', a: '12 meses contratual.' },
    { q: 'Posso acessar o histórico de O.S. depois?', a: 'Sim, arquivo permanente MGR.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="12" label="Perguntas frequentes" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          O que perguntam antes de assinar.
        </h2>
      </div>
      <div style={{ maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {faqs.map((f, i) => (
          <details key={i} style={{ background: MGR.cinzaClaro, borderRadius: 6, border: `1px solid ${MGR.cinzaClaro}` }}>
            <summary style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: MGR.grafite }}>{f.q}</span>
              <span className="faq-icon" style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', color: MGR.azul, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 300, flexShrink: 0 }}>+</span>
            </summary>
            <div style={{ padding: '0 28px 24px', fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio }}>{f.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function T_CTA() {
  return (
    <section className="pad" style={{ background: MGR.azul, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 72, alignItems: 'center' }}>
        <div>
          <SectionTag num="·" label="Comece com quem entrega" color={MGR.laranja} />
          <h2 className="h1" style={{ fontSize: 60, fontWeight: 700, letterSpacing: -1.8, color: '#fff', margin: '0 0 32px', lineHeight: 1 }}>
            Comece com quem entrega. <br />
            <span style={{ color: MGR.laranja }}>Agende sua Visita de Valor.</span>
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <a href={WHATS_T} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              WhatsApp · (19) 98307-3630 <Ico name="arrow" size={16} />
            </a>
            <a href="tel:+5519983073630" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
              Ligar agora
            </a>
          </div>
          <a href="/ciclo-de-vida/retrofit-turnkey" style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.4)', paddingBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Já tem uma operação rodando? Conheça o Retrofit Turnkey MGR <Ico name="arrow" size={14} />
          </a>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 32 }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600, marginBottom: 18 }}>● CONTATO DIRETO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>WhatsApp Comercial</div>
              <a href={WHATS_T} target="_blank" rel="noopener" style={{ fontSize: 17, color: '#fff', fontWeight: 600 }}>(19) 98307-3630</a>
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

function T_Footer() {
  return <MGRFooter />;
}

function T_FooterDead() {
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
          ['Ciclo de Vida', [['Turnkey Completo', 'turnkey-completo.html'], ['Anti-Downtime', 'anti-downtime.html'], ['Corretiva sob demanda', 'manutencao-corretiva.html'], ['Soluções MGR', 'solucoes-mgr.html']]],
          ['Empresa', [['Sobre', 'sobre.html'], ['Parceiros', '#'], ['Trabalhe conosco', 'trabalhe-conosco.html'], ['Blog', '#']]],
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

function T_FloatBack() {
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

function PageTurnkey() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <T_Hero />
      <T_Dores />
      <T_Metades />
      <T_Fase1 />
      <T_Fase2 />
      <T_Como />
      <T_Rastreio />
      <T_Deliverables />
      <T_Diferencial />
      <T_ParaQuem />
      <T_Numeros />
      <T_FAQ />
      <T_CTA />
      <T_Footer />
      <T_FloatBack />
    </div>
  );
}

Object.assign(window, { PageTurnkey });

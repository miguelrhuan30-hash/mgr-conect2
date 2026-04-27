// MGR · Anti-Downtime · Contratos de Manutenção 24/7
// Acessada pelo card 03 (Saber mais) da home.

const WHATS_AD = 'https://wa.me/5519983073630';

function AD_Nav() {
  return <MGRHeader active="ciclo" />;
}

function AD_Crumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <a href="index.html#ciclo" style={{ color: 'rgba(255,255,255,0.7)' }}>Ciclo de Vida</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Anti-Downtime · Contratos 24/7</span>
    </div>
  );
}

function AD_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <AD_Nav />
      <AD_Crumb />
      <svg style={{ position: 'absolute', top: 60, right: -100, opacity: 0.08 }} width="700" height="400" viewBox="0 0 700 400">
        <path d="M 20 380 Q 350 -20 680 380" fill="none" stroke={MGR.laranja} strokeWidth="2" />
      </svg>
      <div className="pad" style={{ padding: '64px 56px 88px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="03" label="Contrato de continuidade" color={MGR.laranja} />
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 76, lineHeight: 0.98, letterSpacing: -2.2, color: '#fff', margin: 0 }}>
              Anti-Downtime: <br />
              <span style={{ color: MGR.laranja }}>sua produção nunca para.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 600 }}>
              Contratos de manutenção <strong style={{ color: '#fff' }}>24/7 com SLA contratual</strong> e níveis de prioridade <strong style={{ color: '#fff' }}>P1, P2, P3 e P4</strong>. Você liga, a gente atende — no prazo combinado, com penalidade financeira se falharmos.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={WHATS_AD} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                Quero blindar minha operação <Ico name="arrow" size={16} />
              </a>
              <a href="#sla" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
                Ver níveis de SLA
              </a>
            </div>
          </div>
          <div className="hero-img" style={{ position: 'relative', minHeight: 460, borderRadius: 8, overflow: 'hidden', background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <img src="assets/sorvetao-casa-maquinas.png" alt="Casa de máquinas MGR em operação contínua"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, filter: 'brightness(0.85)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.55) 100%)' }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
              <div style={{ background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.sucesso, letterSpacing: 1.5, fontWeight: 600 }}>● OPERAÇÃO 24/7</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Uptime contratual · SLA P1–P4</div>
              </div>
              <div style={{ background: MGR.laranja, color: '#fff', padding: '10px 14px', borderRadius: 6, fontFamily: MGR.mono, fontSize: 11, fontWeight: 600, letterSpacing: 1.2 }}>
                P1 · 2H
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AD_Dores() {
  const dores = [
    { i: 'clock', t: 'Manutenção corretiva por chamado', d: 'Você só descobre o problema quando ele já é prejuízo. Sem rotina técnica, falhas acumulam até quebrar tudo de uma vez.' },
    { i: 'shield', t: 'Sem SLA contratual', d: 'Fornecedor "atende quando puder". Sua câmara para por horas, e você não tem como cobrar. Sem prazo, sem responsabilização.' },
    { i: 'gear', t: 'Sem priorização', d: 'Uma falha grave fica esperando junto com um ajuste cosmético. Quem grita mais é atendido primeiro — não quem mais perde.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 64 }}>
        <SectionTag num="02" label="Por que isso importa" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Operação crítica não combina com manutenção reativa.
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

function AD_Entregamos() {
  const items = [
    'Plano de Manutenção MGR — cronograma técnico documentado',
    'Visitas preventivas planejadas (mensal, bimestral ou trimestral)',
    'Atendimento corretivo 24/7 com SLA contratual',
    'Sistema de prioridades P1–P4',
    'Penalidade financeira contratual em caso de descumprimento de SLA',
    'Relatório de Saúde após cada visita',
    'Indicadores preditivos proprietários (consumo, ciclos, eficiência)',
    'Alerta proativo de risco de falha',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="03" label="O que entregamos" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
            Continuidade operacional, escrita em contrato.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: '#fff', padding: '20px 22px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14, border: `1px solid ${MGR.cinzaClaro}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: MGR.acento, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Ico name="check" size={16} />
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, color: MGR.grafite, fontWeight: 500 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 04 — TABELA SLA (bloco principal)
function AD_SLA() {
  const niveis = [
    { p: 'P1', cor: '#DC2626', titulo: 'CRÍTICO', def: 'Sistema parado, risco de perda de carga', sla: '2 horas', icon: 'shield' },
    { p: 'P2', cor: '#E8611A', titulo: 'URGENTE', def: 'Funcionamento comprometido, sem parada total', sla: '4 horas', icon: 'bell' },
    { p: 'P3', cor: '#1B5E8A', titulo: 'IMPORTANTE', def: 'Anomalia que não afeta operação imediata', sla: '24 horas', icon: 'clock' },
    { p: 'P4', cor: '#6B7280', titulo: 'PROGRAMADO', def: 'Ajuste, melhoria ou item de manutenção planejada', sla: 'Janela acordada', icon: 'doc' },
  ];
  return (
    <section id="sla" className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 980, marginBottom: 56 }}>
        <SectionTag num="04" label="Níveis de prioridade" color={MGR.acento} />
        <h2 className="h2" style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1.5, color: MGR.grafite, margin: 0, lineHeight: 1 }}>
          Quatro níveis. Quatro prazos. <span style={{ color: MGR.acento }}>Zero ambiguidade.</span>
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 24, maxWidth: 760 }}>
          Cada chamado entra com classificação técnica imediata. O SLA conta a partir do registro — e é cobrado no contrato.
        </p>
      </div>

      <div className="sla-table" style={{ background: MGR.azulEscuro, borderRadius: 8, overflow: 'hidden', boxShadow: '0 20px 60px rgba(13,59,94,0.18)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 220px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ padding: '20px 24px', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, fontWeight: 600 }}>NÍVEL</div>
          <div style={{ padding: '20px 24px', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, fontWeight: 600 }}>DEFINIÇÃO</div>
          <div style={{ padding: '20px 24px', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.5, fontWeight: 600, textAlign: 'right' }}>SLA</div>
        </div>
        {niveis.map((n, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 220px', borderBottom: i < niveis.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none', alignItems: 'center' }}>
            <div style={{ padding: '28px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: n.cor, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Ico name={n.icon} size={18} />
              </div>
              <div>
                <div style={{ fontFamily: MGR.mono, fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: 0 }}>{n.p}</div>
                <div style={{ fontSize: 10, color: n.cor, fontWeight: 600, letterSpacing: 1.2 }}>{n.titulo}</div>
              </div>
            </div>
            <div style={{ padding: '28px 24px', fontSize: 15, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>{n.def}</div>
            <div style={{ padding: '28px 24px', textAlign: 'right' }}>
              <span style={{ fontFamily: MGR.mono, fontSize: 22, fontWeight: 600, color: MGR.laranja, letterSpacing: -0.3 }}>{n.sla}</span>
            </div>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 20, fontSize: 13, color: MGR.cinzaMedio, fontStyle: 'italic' }}>
        SLA medido a partir do registro do chamado. Penalidade financeira contratual em caso de descumprimento.
      </p>
    </section>
  );
}

function AD_Como() {
  const etapas = [
    { n: '01', t: 'Diagnóstico inicial', d: 'Visita técnica para mapear equipamentos, criticidade e histórico de falhas.', i: 'doc' },
    { n: '02', t: 'Estruturação do contrato', d: 'Plano de Manutenção MGR, escopo, periodicidade e SLA dimensionados ao seu negócio.', i: 'gear' },
    { n: '03', t: 'Operação contínua', d: 'Visitas preventivas no calendário e atendimento corretivo 24/7 sob SLA.', i: 'shield' },
    { n: '04', t: 'Relatórios e melhorias', d: 'Relatório de Saúde após cada visita e indicadores preditivos para antecipar falhas.', i: 'chart' },
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 56 }}>
        <SectionTag num="05" label="Como trabalhamos" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Quatro etapas, do diagnóstico à melhoria contínua.
        </h2>
      </div>
      <div className="timeline" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, position: 'relative' }}>
        {etapas.map((e, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div style={{ background: '#fff', padding: '32px 28px', borderRadius: 6, height: '100%', borderTop: `3px solid ${MGR.azul}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontFamily: MGR.mono, fontSize: 14, fontWeight: 600, color: MGR.azul, letterSpacing: 1.5 }}>{e.n}</span>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: MGR.azulClaro, color: MGR.azul, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Ico name={e.i} size={18} />
                </div>
              </div>
              <h4 style={{ fontSize: 19, fontWeight: 600, color: MGR.grafite, margin: '0 0 10px', letterSpacing: -0.4 }}>{e.t}</h4>
              <p style={{ fontSize: 13, lineHeight: 1.55, color: MGR.cinzaMedio, margin: 0 }}>{e.d}</p>
            </div>
            {i < etapas.length - 1 && (
              <div className="timeline-arrow" style={{ position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)', color: MGR.acento, zIndex: 1 }}>
                <Ico name="arrow" size={20} />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function AD_Deliverables() {
  const items = [
    'Contrato com escopo claro e SLA mensurável',
    'Plano de Manutenção MGR documentado',
    'Relatório de Saúde após cada Visita de Valor',
    'Checklist técnico assinado',
    'Histórico fotográfico permanente',
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80 }}>
        <div>
          <SectionTag num="06" label="Deliverables" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.1 }}>
            O que fica documentado.
          </h2>
        </div>
        <div style={{ background: MGR.azulClaro, borderRadius: 8, padding: '28px 32px', borderLeft: `4px solid ${MGR.azul}` }}>
          {items.map((t, i) => (
            <div key={i} style={{ padding: '16px 0', borderBottom: i < items.length - 1 ? `1px solid rgba(27,94,138,0.15)` : 'none', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: MGR.mono, fontSize: 12, color: MGR.azul, fontWeight: 600, letterSpacing: 1, minWidth: 28 }}>0{i + 1}</span>
              <Ico name="check" size={16} color={MGR.acento} />
              <span style={{ fontSize: 15, color: MGR.grafite, fontWeight: 500 }}>{t}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AD_Diferencial() {
  const pilares = [
    { i: 'shield', t: 'SLA com penalidade financeira', d: 'Zero Downtime contratual real. Se falharmos no prazo, você é compensado em contrato — não em desculpa.' },
    { i: 'chart', t: '4 níveis de prioridade', d: 'Você não compete com chamado de outro parceiro. P1 entra na frente — sempre, sem exceção.' },
    { i: 'gear', t: 'Mesmo time que projetou e instalou', d: 'Quem mantém conhece o sistema. Sem repassar histórico, sem aprender no seu prejuízo.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 64 }}>
        <SectionTag num="07" label="Diferencial MGR" color={MGR.laranja} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: '#fff', margin: 0, lineHeight: 1.02 }}>
          Outros prometem. <span style={{ color: MGR.laranja }}>A MGR contrata.</span>
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
        {pilares.map((p, i) => (
          <div key={i} style={{ background: MGR.azulEscuro, padding: '36px 32px 40px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(212,121,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.laranja, marginBottom: 24 }}>
              <Ico name={p.i} size={24} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: -0.4 }}>{p.t}</h4>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function AD_ParaQuem() {
  const tags = [
    'Câmaras frias industriais',
    'Túneis de congelamento',
    'Centros de distribuição',
    'Supermercados',
    'Food service em escala',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '100px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920 }}>
        <SectionTag num="08" label="Para quem serve" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: '0 0 32px', lineHeight: 1.1 }}>
          Operações que não admitem improviso.
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

function AD_FAQ() {
  const faqs = [
    { q: 'Vale a pena para uma única câmara?', a: 'Sim, valor proporcional. O contrato é dimensionado ao porte da operação — uma câmara crítica pode justificar contrato dedicado.' },
    { q: 'E se vocês não cumprirem o SLA?', a: 'Penalidade financeira contratual. Está no contrato, é mensurada e cobrada — sem necessidade de processo ou negociação.' },
    { q: 'Posso suspender o contrato?', a: 'Conforme cláusula contratual, sim. Definimos juntos as condições de saída antes da assinatura.' },
    { q: 'Não sou parceiro, posso só pedir avulso?', a: <>Sim — ver <a href="manutencao-corretiva.html" style={{ color: MGR.acento, fontWeight: 600 }}>Manutenção Corretiva Sob Demanda</a>.</> },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="09" label="Perguntas frequentes" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          O que perguntam antes de fechar contrato.
        </h2>
      </div>
      <div style={{ maxWidth: 920, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {faqs.map((f, i) => (
          <details key={i} style={{ background: MGR.cinzaClaro, borderRadius: 6, border: `1px solid ${MGR.cinzaClaro}` }}>
            <summary style={{ padding: '22px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
              <span style={{ fontSize: 17, fontWeight: 600, color: MGR.grafite }}>{f.q}</span>
              <span className="faq-icon" style={{ width: 28, height: 28, borderRadius: '50%', background: '#fff', color: MGR.azul, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 300, flexShrink: 0 }}>+</span>
            </summary>
            <div style={{ padding: '0 28px 24px', fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio }}>
              {f.a}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function AD_CTA() {
  return (
    <section className="pad" style={{ background: MGR.azul, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 72, alignItems: 'center' }}>
        <div>
          <SectionTag num="10" label="Contratar continuidade" color={MGR.laranja} />
          <h2 className="h1" style={{ fontSize: 60, fontWeight: 700, letterSpacing: -1.8, color: '#fff', margin: '0 0 32px', lineHeight: 1 }}>
            Refrigeração crítica não admite improviso. <br />
            <span style={{ color: MGR.laranja }}>Contrate continuidade.</span>
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={WHATS_AD} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              WhatsApp · (19) 98307-3630 <Ico name="arrow" size={16} />
            </a>
            <a href="tel:+5519983073630" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
              Ligar agora
            </a>
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 32 }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600, marginBottom: 18, textTransform: 'uppercase' }}>● Contato direto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(212,121,42,0.18)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="bell" size={18} /></div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>WhatsApp Comercial</div>
                <a href={WHATS_AD} target="_blank" rel="noopener" style={{ fontSize: 17, color: '#fff', fontWeight: 600 }}>(19) 98307-3630</a>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(212,121,42,0.18)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="doc" size={18} /></div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>E-mail</div>
                <a href="mailto:administrativo.mgr@gmail.com" style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>administrativo.mgr@gmail.com</a>
              </div>
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

function AD_Footer() {
  return <MGRFooter />;
}

function AD_FooterDead() {
  return (
    <footer style={{ background: MGR.preto, color: 'rgba(255,255,255,0.7)', padding: '56px 56px 32px', fontFamily: MGR.sans, fontSize: 13, display: 'none' }}>
      <div className="pad grid-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 56, marginBottom: 48 }}>
        <div>
          <MGRLogo inverse size={256} />
          <p style={{ marginTop: 20, lineHeight: 1.6, maxWidth: 320, color: 'rgba(255,255,255,0.55)' }}>
            MGR Soluções e Tecnologia da Refrigeração.<br />Do projeto à operação contínua.
          </p>
        </div>
        {[
          ['Serviços', [['Câmaras frias', '#'], ['Túneis de congelamento', '#'], ['Chillers', '#'], ['Anti-Downtime', 'anti-downtime.html'], ['Corretiva sob demanda', 'manutencao-corretiva.html']]],
          ['Empresa', [['Sobre', 'sobre.html'], ['Parceiros', '#'], ['Trabalhe conosco', 'trabalhe-conosco.html'], ['Blog', '#']]],
          ['Contato', ['Indaiatuba · SP', '(19) 98307-3630', 'administrativo.mgr@gmail.com', 'WhatsApp']],
        ].map(([t, items], i) => (
          <div key={i}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 16, fontSize: 13 }}>{t}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'rgba(255,255,255,0.55)' }}>
              {items.map((x, j) => Array.isArray(x) ? <a key={j} href={x[1]}>{x[0]}</a> : <a key={j}>{x}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div className="pad" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        <div>© 2026 MGR Soluções e Tecnologia da Refrigeração Ltda</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a>Política de Privacidade</a>
          <a>Termos</a>
        </div>
      </div>
    </footer>
  );
}

function AD_FloatBack() {
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

function PageAntiDowntime() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <AD_Hero />
      <AD_Dores />
      <AD_Entregamos />
      <AD_SLA />
      <AD_Como />
      <AD_Deliverables />
      <AD_Diferencial />
      <AD_ParaQuem />
      <AD_FAQ />
      <AD_CTA />
      <AD_Footer />
      <AD_FloatBack />
    </div>
  );
}

Object.assign(window, { PageAntiDowntime });

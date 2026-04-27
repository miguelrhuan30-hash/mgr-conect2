// MGR · Manutenção Corretiva Sob Demanda — página interna do Ciclo de Vida
// Acessada pelo card 04 (Saber mais) da home.

const WHATS = 'https://wa.me/5519983073630';

function CR_Nav() {
  return <MGRHeader active="ciclo" />;
}

function Breadcrumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <a href="index.html#ciclo" style={{ color: 'rgba(255,255,255,0.7)' }}>Ciclo de Vida</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Manutenção Corretiva Sob Demanda</span>
    </div>
  );
}

function CR_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <CR_Nav />
      <Breadcrumb />
      <svg style={{ position: 'absolute', top: 60, right: -100, opacity: 0.08 }} width="700" height="400" viewBox="0 0 700 400">
        <path d="M 20 380 Q 350 -20 680 380" fill="none" stroke={MGR.laranja} strokeWidth="2" />
      </svg>

      <div className="pad" style={{ padding: '64px 56px 88px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="04" label="Atendimento por chamado" color={MGR.laranja} />

        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 72, lineHeight: 1.0, letterSpacing: -2, color: '#fff', margin: 0 }}>
              Quebrou agora? <br />
              <span style={{ color: MGR.laranja }}>A gente atende</span> — mesmo sem contrato.
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 560 }}>
              Atendimento corretivo sob demanda para empresas que ainda não têm contrato de manutenção MGR. Você liga, a gente vai, resolve e documenta.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={WHATS} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', border: 'none', padding: '20px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                Solicitar atendimento agora <Ico name="arrow" size={16} />
              </a>
              <a href="tel:+5519983073630" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '20px 28px', fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <Ico name="bell" size={16} /> (19) 98307-3630
              </a>
            </div>
          </div>
          <div className="hero-img" style={{ position: 'relative', minHeight: 460, borderRadius: 8, overflow: 'hidden', background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <img src="assets/croissant-casa-maquinas.png" alt="Especialista de Campo MGR em atendimento"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
              <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600 }}>● EM CAMPO</div>
              <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Especialista MGR · Indaiatuba/SP</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// 02 — POR QUE ISSO IMPORTA
function CR_Dores() {
  const dores = [
    { i: 'clock', t: 'Pane fora do horário comercial', d: 'Fornecedor habitual não atende. A carga começa a esquentar e cada hora vira prejuízo direto na operação.' },
    { i: 'shield', t: 'Fornecedor sumiu ou faliu', d: 'Você não tem para quem ligar. Histórico técnico perdido, equipamento órfão, ninguém quer assumir o problema.' },
    { i: 'gear', t: 'Diagnóstico mal feito', d: 'Técnico vem, troca a peça errada e o problema volta em uma semana. Você paga duas vezes pela mesma falha.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 64 }}>
        <SectionTag num="02" label="Por que isso importa" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Refrigeração não espera o horário comercial. <span style={{ color: MGR.cinzaMedio }}>Quando para, para tudo.</span>
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

// 03 — O QUE ENTREGAMOS
function CR_Entregamos() {
  const items = [
    'Atendimento corretivo sem necessidade de contrato prévio',
    'Diagnóstico técnico com laudo',
    'Reparo com peças originais ou equivalentes técnicas validadas',
    'Orçamento transparente antes da intervenção',
    'Relatório Final de Execução com fotos',
    'Recomendações de manutenção preventiva pós-atendimento',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="03" label="O que entregamos" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
            Você sai do atendimento com o problema resolvido — e documentado.
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: '#fff', padding: '20px 22px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14, border: `1px solid ${MGR.cinzaClaro}` }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: MGR.acento, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Ico name="check" size={16} />
              </div>
              <div style={{ fontSize: 15, lineHeight: 1.45, color: MGR.grafite, fontWeight: 500 }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 04 — COMO FUNCIONA (timeline)
function CR_Como() {
  const etapas = [
    { n: '01', t: 'Você liga', d: 'WhatsApp ou telefone direto. Atendimento humano, sem URA.', i: 'bell' },
    { n: '02', t: 'Triagem técnica', d: 'Especialista MGR avalia o problema, urgência e equipamento.', i: 'doc' },
    { n: '03', t: 'Atendimento em campo', d: 'Diagnóstico in loco, orçamento aprovado e execução do reparo.', i: 'gear' },
    { n: '04', t: 'Entrega documentada', d: 'Relatório Final com fotos, peças trocadas e recomendações.', i: 'check' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 56 }}>
        <SectionTag num="04" label="Como funciona" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Quatro etapas, do telefone ao relatório.
        </h2>
      </div>
      <div className="timeline" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, position: 'relative' }}>
        {etapas.map((e, i) => (
          <div key={i} style={{ position: 'relative' }}>
            <div style={{ background: MGR.azulClaro, padding: '32px 28px 32px', borderRadius: 6, height: '100%', borderTop: `3px solid ${MGR.azul}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontFamily: MGR.mono, fontSize: 14, fontWeight: 600, color: MGR.azul, letterSpacing: 1.5 }}>{e.n}</span>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: '#fff', color: MGR.azul, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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

// 05 — DIFERENCIAL MGR
function CR_Diferencial() {
  const pilares = [
    { i: 'gear', t: 'Atendemos sem contrato', d: 'Você não precisa ser parceiro recorrente. Um chamado é suficiente para acionar a equipe.' },
    { i: 'shield', t: 'Mesma qualidade técnica', d: 'Especialista de Campo MGR — não terceirizado. O mesmo padrão de quem trabalha em contratos preditivos.' },
    { i: 'doc', t: 'Documentação completa', d: 'Você sai do atendimento com laudo técnico, Relatório Final e recomendações para a próxima manutenção.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 64 }}>
        <SectionTag num="05" label="Diferencial MGR" color={MGR.laranja} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: '#fff', margin: 0, lineHeight: 1.02 }}>
          Sob demanda, mas <span style={{ color: MGR.laranja }}>com padrão MGR</span>.
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

// 06 — AVISO IMPORTANTE
function CR_Aviso() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '80px 56px', fontFamily: MGR.sans }}>
      <div style={{ background: MGR.azulClaro, borderLeft: `4px solid ${MGR.azul}`, padding: '32px 36px', borderRadius: 4, display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 24, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.azul }}>
          <Ico name="bell" size={26} />
        </div>
        <div>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.azul, letterSpacing: 1.5, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>Aviso importante</div>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: MGR.grafite, margin: 0 }}>
            Atendimentos sob demanda <strong>não têm SLA contratual</strong> — priorizamos chamados conforme disponibilidade da equipe e localização. Para garantia de SLA com prioridade P1–P4, considere o contrato Anti-Downtime.
          </p>
        </div>
        <a href="index.html#ciclo" style={{ background: MGR.azul, color: '#fff', padding: '14px 22px', fontSize: 13, fontWeight: 600, borderRadius: 8, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Conhecer Anti-Downtime <Ico name="arrow" size={14} />
        </a>
      </div>
    </section>
  );
}

// 07 — PARA QUEM SERVE
function CR_ParaQuem() {
  const tags = [
    'Empresas sem contrato de manutenção',
    'Quem foi abandonado pelo fornecedor anterior',
    'Operações que querem testar a MGR antes de fechar contrato',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '100px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920 }}>
        <SectionTag num="07" label="Para quem serve" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: '0 0 32px', lineHeight: 1.1 }}>
          Pensado para três cenários muito comuns.
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

// 08 — FAQ
function CR_FAQ() {
  const faqs = [
    { q: 'Atendem 24/7 sem contrato?', a: 'Conforme disponibilidade. Prioridade vai para parceiros em contrato.' },
    { q: 'Cobram visita técnica?', a: 'Sim, valor informado na triagem antes do deslocamento.' },
    { q: 'Posso virar parceiro contratual depois?', a: 'Sim, e aproveitamos o histórico do atendimento.' },
    { q: 'Atendem qualquer marca de equipamento?', a: 'Sim, principais marcas industriais e comerciais.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="08" label="Perguntas frequentes" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          O que perguntam antes de ligar.
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

// 09 — CTA FINAL + CONTATO
function CR_CTA() {
  return (
    <section className="pad" style={{ background: MGR.azul, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 72, alignItems: 'center' }}>
        <div>
          <SectionTag num="09" label="Acionar agora" color={MGR.laranja} />
          <h2 className="h1" style={{ fontSize: 64, fontWeight: 700, letterSpacing: -1.8, color: '#fff', margin: '0 0 32px', lineHeight: 0.98 }}>
            Sua câmara parou. <br />
            <span style={{ color: MGR.laranja }}>A MGR atende.</span> Ligue agora.
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <a href={WHATS} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', border: 'none', padding: '20px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              WhatsApp · (19) 98307-3630 <Ico name="arrow" size={16} />
            </a>
            <a href="tel:+5519983073630" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '20px 28px', fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }}>
              Ligar agora
            </a>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 32 }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600, marginBottom: 18, textTransform: 'uppercase' }}>● Contato direto</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(212,121,42,0.18)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico name="bell" size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>WhatsApp Comercial</div>
                <a href={WHATS} target="_blank" rel="noopener" style={{ fontSize: 17, color: '#fff', fontWeight: 600 }}>(19) 98307-3630</a>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(212,121,42,0.18)', color: MGR.laranja, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico name="doc" size={18} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>E-mail</div>
                <a href="mailto:administrativo.mgr@gmail.com" style={{ fontSize: 16, color: '#fff', fontWeight: 600 }}>administrativo.mgr@gmail.com</a>
              </div>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 18, fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              MGR Soluções e Tecnologia da Refrigeração Ltda<br />
              Indaiatuba/SP
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CR_Footer() {
  return <MGRFooter />;
}

function CR_FooterUnused() {
  return (
    <footer style={{ display: 'none' }}></footer>
  );
}

function CR_FooterDead() {
  return (
    <footer style={{ background: MGR.preto, color: 'rgba(255,255,255,0.7)', padding: '56px 56px 32px', fontFamily: MGR.sans, fontSize: 13 }}>
      <div className="pad grid-4" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 56, marginBottom: 48 }}>
        <div>
          <MGRLogo inverse size={256} />
          <p style={{ marginTop: 20, lineHeight: 1.6, maxWidth: 320, color: 'rgba(255,255,255,0.55)' }}>
            MGR Soluções e Tecnologia da Refrigeração.<br />
            Do projeto à operação contínua.
          </p>
        </div>
        {[
          ['Serviços', ['Câmaras frias', 'Túneis de congelamento', 'Chillers', 'Manutenção preditiva', 'Corretiva sob demanda']],
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

// Botão flutuante "Voltar ao Ciclo de Vida MGR"
function FloatBack() {
  return (
    <a href="index.html#ciclo" className="float-back" style={{
      position: 'fixed', left: 24, bottom: 24, zIndex: 30,
      background: MGR.azulEscuro, color: '#fff', padding: '14px 22px',
      borderRadius: 999, fontSize: 13, fontWeight: 600,
      display: 'inline-flex', alignItems: 'center', gap: 10,
      boxShadow: '0 12px 32px rgba(13,59,94,0.35)',
      fontFamily: MGR.sans,
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><Ico name="arrow" size={14} /></span>
      Voltar ao Ciclo de Vida MGR
    </a>
  );
}

function PageCorretiva() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <CR_Hero />
      <CR_Dores />
      <CR_Entregamos />
      <CR_Como />
      <CR_Diferencial />
      <CR_Aviso />
      <CR_ParaQuem />
      <CR_FAQ />
      <CR_CTA />
      <CR_Footer />
      <FloatBack />
    </div>
  );
}

Object.assign(window, { PageCorretiva });

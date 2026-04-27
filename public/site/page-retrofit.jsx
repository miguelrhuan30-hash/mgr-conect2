// MGR · Retrofit Turnkey — Modernização e Expansão
// Acessada pelo card 02 (Saber mais) da home.

const WHATS_R = 'https://wa.me/5519983073630';

function R_Nav() {
  return <MGRHeader active="ciclo" />;
}

function R_Crumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <a href="index.html#ciclo" style={{ color: 'rgba(255,255,255,0.7)' }}>Ciclo de Vida</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Retrofit Turnkey</span>
    </div>
  );
}

function R_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <R_Nav />
      <R_Crumb />
      <div className="pad" style={{ padding: '64px 56px 88px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="02" label="Modernização e expansão" color={MGR.laranja} />
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 72, lineHeight: 0.98, letterSpacing: -2.2, color: '#fff', margin: 0 }}>
              Sua operação cresceu. <br />
              <span style={{ color: MGR.laranja }}>Sua refrigeração precisa acompanhar.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 600 }}>
              Retrofit, ampliação, mudança de endereço — quando sua planta evolui, a MGR entra como parceira-chave do planejamento à entrega. Mesma metodologia turnkey, adaptada à operação que já existe.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={WHATS_R} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                Quero planejar meu retrofit <Ico name="arrow" size={16} />
              </a>
              <a href="#metades" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
                Como funciona
              </a>
            </div>
          </div>
          <div className="hero-img" style={{ position: 'relative', minHeight: 460, borderRadius: 8, overflow: 'hidden', background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <img src="assets/ecoflora-montagem.png" alt="Obra de retrofit MGR — modernização de sistema em planta ativa"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, filter: 'brightness(0.88)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.55) 100%)' }} />
            <div style={{ position: 'absolute', left: 20, bottom: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 12 }}>
              <div style={{ background: 'rgba(13,59,94,0.92)', border: '1px solid rgba(255,255,255,0.12)', padding: '12px 16px', borderRadius: 6 }}>
                <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.sucesso, letterSpacing: 1.5, fontWeight: 600 }}>● PLANTA ATIVA</div>
                <div style={{ fontSize: 13, color: '#fff', marginTop: 4, fontWeight: 500 }}>Retrofit faseado · Continuidade preservada</div>
              </div>
              <div style={{ background: MGR.laranja, color: '#fff', padding: '10px 14px', borderRadius: 6, fontFamily: MGR.mono, fontSize: 11, fontWeight: 600, letterSpacing: 1.2 }}>
                NÃO PARA
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function R_Tipos() {
  const tipos = [
    { i: 'gear', t: 'Modernização', d: 'Substituir sistema legado, ganhar eficiência energética, atualizar tecnologia ao padrão atual.' },
    { i: 'chart', t: 'Expansão de capacidade', d: 'Sua operação cresceu — sua refrigeração precisa escalar junto, sem refazer tudo do zero.' },
    { i: 'shield', t: 'Mudança de endereço', d: 'Desmontagem, transporte, remontagem e re-comissionamento na nova planta. Logística técnica.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 64 }}>
        <SectionTag num="02" label="Tipos de retrofit" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Para que tipo de projeto esta página serve.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {tipos.map((d, i) => (
          <div key={i} style={{ background: MGR.cinzaClaro, border: `1px solid ${MGR.cinzaClaro}`, padding: '32px 32px 36px', borderRadius: 6, borderTop: `3px solid ${MGR.acento}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento, marginBottom: 24 }}>
              <Ico name={d.i} size={22} />
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: MGR.grafite, margin: '0 0 12px', letterSpacing: -0.4 }}>{d.t}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{d.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function R_PorQue() {
  const dores = [
    { i: 'clock', t: 'Você não pode parar a produção', d: 'Retrofit em planta ativa exige plano de continuidade. Sem isso, modernizar vira parar — e parar custa mais do que o retrofit.' },
    { i: 'doc', t: 'O sistema atual tem histórico', d: 'Modernizar sem entender o legado é trocar problema de lugar. Diagnóstico antes de proposta — sempre.' },
    { i: 'gear', t: 'Cada equipamento tem vida útil diferente', d: 'Substituir tudo é caro. Substituir o que não precisa é desperdício. Análise honesta separa o necessário do supérfluo.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 64 }}>
        <SectionTag num="03" label="Por que retrofit é diferente" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Operação que já existe pede metodologia diferente.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {dores.map((d, i) => (
          <div key={i} style={{ background: '#fff', padding: '32px 32px 36px', borderRadius: 6 }}>
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

function R_Metades() {
  const fases = [
    { tag: 'FASE A', t: 'Diagnóstico e Plano', bullets: ['Visita de Valor de retrofit', 'Diagnóstico do sistema atual', 'Análise técnico-econômica', 'Estratégia de modernização', 'Cronograma de continuidade'], icon: 'doc' },
    { tag: 'FASE B', t: 'Execução e Re-Entrega', bullets: ['Desmontagem segura', 'Reaproveitamento técnico', 'Substituição faseada', 'Re-comissionamento', 'Entrega na nova configuração'], icon: 'gear' },
  ];
  return (
    <section id="metades" className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="04" label="As duas metades do Retrofit Turnkey" color={MGR.acento} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Sua operação não para. <span style={{ color: MGR.acento }}>Sua refrigeração evolui.</span>
        </h2>
      </div>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {fases.map((f, i) => (
          <div key={i} style={{ background: MGR.cinzaClaro, padding: '44px 40px 48px', borderRadius: 8, borderTop: `4px solid ${i === 0 ? MGR.azul : MGR.acento}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <span style={{ fontFamily: MGR.mono, fontSize: 11, color: i === 0 ? MGR.azul : MGR.acento, letterSpacing: 1.5, fontWeight: 600 }}>{f.tag}</span>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff', color: i === 0 ? MGR.azul : MGR.acento, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Ico name={f.icon} size={18} />
              </div>
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 700, color: MGR.grafite, margin: '0 0 24px', letterSpacing: -0.7 }}>{f.t}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {f.bullets.map((b, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: j < f.bullets.length - 1 ? `1px solid #e0e6ec` : 'none' }}>
                  <span style={{ fontFamily: MGR.mono, fontSize: 11, color: i === 0 ? MGR.azul : MGR.acento, fontWeight: 600, minWidth: 20 }}>0{j + 1}</span>
                  <span style={{ fontSize: 14.5, color: MGR.grafite, fontWeight: 500 }}>{b}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function R_Fase1() {
  const items = [
    'Visita de Valor de retrofit — análise do sistema atual e do gap',
    'Diagnóstico técnico do equipamento legado (vida útil, eficiência, riscos)',
    'Análise do que pode ser reaproveitado vs. o que precisa ser substituído',
    'Estratégia de modernização adaptada ao seu ciclo operacional',
    'Plano de continuidade da produção durante a obra',
    'Cronograma faseado com marcos de transição',
    'Orçamento consolidado de compra + execução do retrofit',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="05" label="Fase 1" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
            Diagnóstico e <span style={{ color: MGR.azul }}>Planejamento.</span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 20 }}>
            Entender o legado antes de modernizar. Análise honesta separa o necessário do supérfluo.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: '#fff', padding: '18px 20px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
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

function R_Fase2() {
  const items = [
    'Desmontagem segura do que será substituído',
    'Reaproveitamento técnico do que faz sentido manter',
    'Montagem dos novos equipamentos',
    'Adequação elétrica e de comando à nova configuração',
    'Vácuo, carga de gás, teste de estanqueidade',
    'Re-comissionamento com teste de carga térmica real',
    'Treinamento da equipe operacional na nova configuração',
    'Laudo Técnico MGR do retrofit',
    'Checklist de comissionamento assinado',
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="06" label="Fase 2" color={MGR.acento} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
            Execução e <span style={{ color: MGR.acento }}>Re-Entrega.</span>
          </h2>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 20 }}>
            Equipe própria. Cada etapa documentada. Re-comissionamento com teste real de carga.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {items.map((t, i) => (
            <div key={i} style={{ background: MGR.cinzaClaro, padding: '18px 20px', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 14 }}>
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

function R_Continuidade() {
  const items = [
    'Cronograma faseado por zona / linha de produção',
    'Trabalho em janelas operacionais (noturno, fim de semana, paradas programadas)',
    'Manutenção do sistema legado em paralelo até a transição',
    'Equipe própria mobilizada — sem dependência de terceiros que furam prazo',
  ];
  return (
    <section className="pad" style={{ background: MGR.azulClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionTag num="07" label="Plano de continuidade" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05, maxWidth: 820 }}>
          Retrofit em planta ativa, sem parar sua produção.
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '20px 0 40px', maxWidth: 720 }}>
          Modernizar não pode custar a operação. Trabalhamos no seu calendário, não no nosso.
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

function R_Rastreio() {
  const items = [
    'O.S. estruturada para cada etapa do retrofit',
    'Relatório Final de Execução do retrofit completo',
    'Observações técnicas registradas pelo técnico no campo',
    'Histórico fotográfico antes / durante / depois',
    'Documentação as-built da nova configuração',
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="08" label="Rastreabilidade MGR" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.1 }}>
            Você sabe tudo o que aconteceu no retrofit.
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

function R_Deliverables() {
  const items = [
    'Diagnóstico técnico do sistema atual',
    'Análise técnico-econômica do retrofit',
    'Plano de continuidade detalhado',
    'Cronograma faseado',
    'Laudo Técnico MGR do retrofit',
    'Checklist de comissionamento assinado',
    'Relatório Final de Execução',
    'Plantas as-built da nova configuração',
    'Manual operacional atualizado',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="09" label="Deliverables" color={MGR.azul} />
          <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: 0, lineHeight: 1.1 }}>
            O que entregamos documentado.
          </h2>
        </div>
        <div style={{ background: '#fff', borderRadius: 8, padding: '28px 32px', borderLeft: `4px solid ${MGR.azul}` }}>
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

function R_Diferencial() {
  const pilares = [
    { i: 'shield', t: 'Plano de continuidade real', d: 'Sua produção não para, mesmo durante a obra. Janela operacional respeitada.' },
    { i: 'gear', t: 'Análise honesta do legado', d: 'Só substituímos o que faz sentido substituir. Reaproveitamento técnico onde cabe.' },
    { i: 'check', t: 'Mesmo time do projeto à entrega', d: 'Quem planeja é quem executa. Sem handoff, sem aprender no seu prejuízo.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 64 }}>
        <SectionTag num="10" label="Diferencial MGR no retrofit" color={MGR.laranja} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: '#fff', margin: 0, lineHeight: 1.02 }}>
          Três pilares. <span style={{ color: MGR.laranja }}>Operação evolui sem parar.</span>
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

function R_ParaQuem() {
  const tags = [
    'Empresas que estão crescendo',
    'Operações mudando de endereço',
    'Plantas com sistema legado próximo do fim de vida útil',
    'Quem quer ganhar eficiência energética sem trocar tudo',
    'Frigoríficos · indústrias alimentícias · CDs · food service',
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '100px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920 }}>
        <SectionTag num="11" label="Para quem serve" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1.2, color: MGR.grafite, margin: '0 0 32px', lineHeight: 1.1 }}>
          Operações em evolução.
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

function R_FAQ() {
  const faqs = [
    { q: 'Operam dentro de planta ativa?', a: 'Sim, com plano de continuidade detalhado.' },
    { q: 'Reaproveitam equipamento atual?', a: 'Quando técnica e economicamente viável, sim.' },
    { q: 'Quanto tempo dura um retrofit?', a: 'Depende do escopo — vai de 30 dias a 6 meses, faseado.' },
    { q: 'Trabalham finais de semana / madrugada?', a: 'Sim, quando a janela operacional exige.' },
    { q: 'Vocês emitem ART?', a: 'Não emitimos ART. Entregamos Laudo Técnico MGR. Para projetos que exijam responsável CREA, indicamos parceiro habilitado.' },
    { q: 'Atendem mudança de endereço?', a: 'Sim — desmontagem, transporte, remontagem e re-comissionamento.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="12" label="Perguntas frequentes" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          O que perguntam antes de começar.
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

function R_CTA() {
  return (
    <section className="pad" style={{ background: MGR.azul, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 72, alignItems: 'center' }}>
        <div>
          <SectionTag num="·" label="Vamos planejar" color={MGR.laranja} />
          <h2 className="h1" style={{ fontSize: 56, fontWeight: 700, letterSpacing: -1.7, color: '#fff', margin: '0 0 32px', lineHeight: 1 }}>
            Sua operação evoluiu. Sua refrigeração também merece. <span style={{ color: MGR.laranja }}>Vamos planejar o retrofit.</span>
          </h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
            <a href={WHATS_R} target="_blank" rel="noopener" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              WhatsApp · (19) 98307-3630 <Ico name="arrow" size={16} />
            </a>
            <a href="tel:+5519983073630" style={{ background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '20px 28px', fontSize: 14, fontWeight: 500, borderRadius: 8 }}>
              Ligar agora
            </a>
          </div>
          <a href="turnkey-completo.html" style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', borderBottom: '1px solid rgba(255,255,255,0.4)', paddingBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Operação nova, do zero? Conheça o Turnkey Completo MGR <Ico name="arrow" size={14} />
          </a>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: 32 }}>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600, marginBottom: 18 }}>● CONTATO DIRETO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.5 }}>WhatsApp Comercial</div>
              <a href={WHATS_R} target="_blank" rel="noopener" style={{ fontSize: 17, color: '#fff', fontWeight: 600 }}>(19) 98307-3630</a>
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

function R_Footer() {
  return <MGRFooter />;
}

function R_FooterDead() {
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
          ['Ciclo de Vida', [['Turnkey Completo', 'turnkey-completo.html'], ['Retrofit Turnkey', 'retrofit-turnkey.html'], ['Anti-Downtime', 'anti-downtime.html'], ['Corretiva sob demanda', 'manutencao-corretiva.html'], ['Soluções MGR', 'solucoes-mgr.html']]],
          ['Empresa', [['Sobre', 'sobre.html'], ['Trabalhe conosco', 'trabalhe-conosco.html'], ['Blog', '#']]],
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

function R_FloatBack() {
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

function PageRetrofit() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <R_Hero />
      <R_Tipos />
      <R_PorQue />
      <R_Metades />
      <R_Fase1 />
      <R_Fase2 />
      <R_Continuidade />
      <R_Rastreio />
      <R_Deliverables />
      <R_Diferencial />
      <R_ParaQuem />
      <R_FAQ />
      <R_CTA />
      <R_Footer />
      <R_FloatBack />
    </div>
  );
}

Object.assign(window, { PageRetrofit });

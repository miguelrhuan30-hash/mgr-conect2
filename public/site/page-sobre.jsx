// MGR · Sobre — Página institucional
const WHATS_S = 'https://wa.me/5519983073630';

function S_Nav() {
  return <MGRHeader active="sobre" />;
}

function S_Crumb() {
  return (
    <div className="pad" style={{ padding: '24px 56px 0', fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: 1.2, textTransform: 'uppercase' }}>
      <a href="index.html" style={{ color: 'rgba(255,255,255,0.7)' }}>Home</a>
      <span style={{ margin: '0 10px', color: 'rgba(255,255,255,0.3)' }}>›</span>
      <span style={{ color: MGR.laranja }}>Sobre</span>
    </div>
  );
}

function S_Hero() {
  return (
    <section style={{ background: MGR.azulEscuro, color: '#fff', position: 'relative', overflow: 'hidden' }}>
      <S_Nav />
      <S_Crumb />
      <div className="pad" style={{ padding: '80px 56px 96px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="MGR" label="Institucional" color={MGR.laranja} />
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 56, alignItems: 'center' }}>
          <div>
            <h1 className="h1" style={{ fontFamily: MGR.sans, fontWeight: 700, fontSize: 76, lineHeight: 0.98, letterSpacing: -2.4, color: '#fff', margin: 0 }}>
              +20 anos garantindo que <span style={{ color: MGR.laranja }}>nenhum negócio pare por falha de refrigeração.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: '32px 0 40px', maxWidth: 620 }}>
              Somos uma empresa de soluções e tecnologia da refrigeração, sediada em Indaiatuba/SP. Projetamos, executamos, mantemos e evoluímos sistemas críticos de frio para indústrias alimentícias, logística refrigerada e food service.
            </p>
            <a href="#parceiros" style={{ background: MGR.acento, color: '#fff', padding: '20px 32px', fontSize: 15, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              Conheça nosso trabalho <Ico name="arrow" size={16} />
            </a>
          </div>
          <div style={{ position: 'relative', minHeight: 420, borderRadius: 8, overflow: 'hidden', background: '#0a1a2a', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
            <img src="assets/equipe-mgr.png" alt="Equipe MGR em obra" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, filter: 'brightness(0.55)' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0.3) 0%, rgba(13,59,94,0.7) 100%)' }} />
            <div style={{ position: 'absolute', left: 24, bottom: 24, right: 24, fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 }}>
              <span style={{ color: MGR.laranja }}>●</span> EQUIPE MGR · INDAIATUBA/SP
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function S_Manifesto() {
  return (
    <section id="manifesto" className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 1100 }}>
        <SectionTag num="01" label="Manifesto MGR" color={MGR.azul} />
        <p className="h-edit" style={{ fontSize: 44, lineHeight: 1.2, color: MGR.grafite, letterSpacing: -1, fontWeight: 400, margin: 0 }}>
          Refrigeração industrial é o sistema nervoso invisível de toda operação. <span style={{ color: MGR.cinzaMedio }}>Quando funciona, ninguém percebe. Quando falha, tudo para — produção, estoque, faturamento.</span>
          <br /><br />
          A MGR existe para garantir que isso nunca aconteça.
          <br /><br />
          <span style={{ color: MGR.cinzaMedio }}>Não somos apenas técnicos que consertam equipamentos. Somos parceiros de operação que projetam, constroem, mantêm e monitoram com uma única obsessão:</span> <span style={{ color: MGR.acento, fontWeight: 600 }}>que o seu negócio funcione, sempre.</span>
        </p>
      </div>
    </section>
  );
}

function S_Historia() {
  const marcos = [
    { y: '+20 anos', t: 'Início', d: 'Expertise de campo em refrigeração industrial.' },
    { y: '[a confirmar]', t: 'G-tec Manutenção', d: 'Separação empresarial dá origem à G-tec Manutenção.' },
    { y: '[a confirmar]', t: 'Fusão', d: 'G-tec + MGR formam a MGR Soluções e Tecnologia da Refrigeração.' },
    { y: '[a confirmar]', t: 'Expansão técnica', d: 'Escopo se amplia para túneis e sistemas industriais complexos.' },
    { y: '[a confirmar]', t: 'Edificações', d: 'Edificações em isopainel oficializadas no escopo.' },
    { y: '2026', t: 'Nova fase', d: 'Hardware proprietário (PCM) e roadmap tecnológico em desenvolvimento.' },
  ];
  return (
    <section id="historia" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="02" label="Nossa história" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          De refrigeração a soluções e <span style={{ color: MGR.azul }}>tecnologia da refrigeração.</span>
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: MGR.cinzaMedio, marginTop: 24 }}>
          A MGR Soluções e Tecnologia da Refrigeração nasceu da fusão entre a <strong style={{ color: MGR.grafite }}>G-tec Manutenção</strong> e a MGR original — unindo mais de 20 anos de experiência de campo em refrigeração industrial em uma única empresa de soluções completas.
        </p>
      </div>
      <div className="timeline" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, position: 'relative' }}>
        <div className="timeline-line" style={{ position: 'absolute', top: 18, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #1B5E8A, #D4792A)' }} />
        {marcos.map((m, i) => (
          <div key={i} className="timeline-item" style={{ position: 'relative', paddingTop: 48, paddingRight: 16 }}>
            <div style={{ position: 'absolute', top: 12, left: 0, width: 14, height: 14, borderRadius: '50%', background: i === marcos.length - 1 ? MGR.acento : MGR.azul, border: '3px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.06)' }} />
            <div style={{ fontFamily: MGR.mono, fontSize: 11, color: i === marcos.length - 1 ? MGR.acento : MGR.azul, letterSpacing: 1, fontWeight: 600, marginBottom: 8 }}>{m.y}</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: MGR.grafite, marginBottom: 6 }}>{m.t}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: MGR.cinzaMedio }}>{m.d}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function S_Proposito() {
  const itens = [
    { i: 'shield', tag: 'Propósito', t: 'Garantir que nenhum negócio pare por falha de refrigeração.', color: MGR.azul },
    { i: 'arrow', tag: 'Missão', t: 'Oferecer soluções completas em refrigeração industrial — do projeto à operação contínua — com excelência técnica, tecnologia própria e gestão inteligente, garantindo a continuidade e a eficiência da operação de nossos parceiros.', color: MGR.azul },
    { i: 'chart', tag: 'Visão', t: 'Ser a empresa que todo gestor industrial brasileiro procura primeiro quando refrigeração é crítica para seu negócio.', color: MGR.acento },
  ];
  return (
    <section id="proposito" className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="03" label="Propósito · Missão · Visão" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Por que existimos. Para onde vamos.
        </h2>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
        {itens.map((d, i) => (
          <div key={i} style={{ background: MGR.cinzaClaro, padding: '36px 32px 40px', borderRadius: 6, borderTop: `3px solid ${d.color}` }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: d.color, marginBottom: 24 }}>
              <Ico name={d.i} size={22} />
            </div>
            <div style={{ fontFamily: MGR.mono, fontSize: 11, color: d.color, letterSpacing: 1.5, fontWeight: 600, marginBottom: 12 }}>{d.tag.toUpperCase()}</div>
            <p style={{ fontSize: 17, lineHeight: 1.5, color: MGR.grafite, margin: 0, fontWeight: 500 }}>{d.t}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function S_Valores() {
  const v = [
    { i: 'check', t: 'Precisão Técnica', d: 'Memorial de cálculo documentado e auditável. Não existe improviso.' },
    { i: 'gear', t: 'Inovação com Propósito', d: 'Só adotamos tecnologia que resolve problema real do parceiro, nunca modismo.' },
    { i: 'doc', t: 'Transparência Radical', d: 'O parceiro acompanha cada O.S., cada intervenção, cada resultado.' },
    { i: 'shield', t: 'Zero Downtime', d: 'SLA contratual nos penaliza se o parceiro parar. Compromisso que dói no bolso.' },
  ];
  return (
    <section id="valores" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="04" label="Nossos valores" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Quatro pilares. Uma cultura técnica.
        </h2>
      </div>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: '#e6ebf1' }}>
        {v.map((p, i) => (
          <div key={i} style={{ background: '#fff', padding: '40px 36px 44px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: 'rgba(232,97,26,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.acento }}>
                <Ico name={p.i} size={20} />
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 600, color: MGR.grafite, margin: 0, letterSpacing: -0.4 }}>{p.t}</h3>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function S_Posicionamento() {
  return (
    <section id="posicionamento" className="pad" style={{ background: MGR.azulClaro, padding: '140px 56px', fontFamily: MGR.sans, textAlign: 'center' }}>
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.azul, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600, marginBottom: 24 }}>
          ● O que nos torna únicos
        </div>
        <p className="h-edit" style={{ fontSize: 36, lineHeight: 1.3, color: MGR.grafite, letterSpacing: -0.8, fontWeight: 400, margin: '0 0 64px' }}>
          A MGR é a única empresa de refrigeração industrial que acompanha seu sistema do projeto à operação contínua com tecnologia própria de gestão — porque acreditamos que refrigeração não é serviço avulso, é <span style={{ color: MGR.grafite, fontWeight: 600 }}>parceria de ciclo de vida.</span>
        </p>
        <div style={{ fontFamily: MGR.sans, fontWeight: 800, fontSize: 'clamp(56px, 11vw, 168px)', color: MGR.acento, letterSpacing: '-0.04em', lineHeight: 0.95, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'clip' }}>
          CONTINUIDADE
        </div>
      </div>
    </section>
  );
}

function S_Numeros() {
  const k = [
    { n: '+20', u: 'anos', l: 'de experiência em refrigeração' },
    { n: '+200', u: '', l: 'projetos entregues' },
    { n: '24/7', u: '', l: 'atendimento emergencial' },
    { n: '2h', u: 'P1', l: 'resposta crítica contratual' },
  ];
  return (
    <section id="numeros" className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="05" label="Números que nos definem" color={MGR.laranja} />
        <h2 className="h2" style={{ fontSize: 44, fontWeight: 600, letterSpacing: -1.3, color: '#fff', margin: 0, lineHeight: 1.05 }}>
          Dado é o melhor argumento.
        </h2>
      </div>
      <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
        {k.map((d, i) => (
          <div key={i} style={{ background: MGR.azulEscuro, padding: '40px 32px 44px' }}>
            <div style={{ fontFamily: MGR.mono, fontSize: 'clamp(40px, 5vw, 64px)', color: MGR.laranja, fontWeight: 600, letterSpacing: -1, lineHeight: 1 }}>
              {d.n}{d.u && <span style={{ fontSize: '0.5em', color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>{d.u}</span>}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 16, fontWeight: 500 }}>{d.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function S_Time() {
  return (
    <section id="time" className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="06" label="Nosso time" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Quem está por trás da MGR.
        </h2>
      </div>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.7fr', gap: 32, alignItems: 'stretch' }}>
        <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: MGR.azulEscuro, minHeight: 420 }}>
          <img src="assets/equipe-mgr.png" alt="Time MGR" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, filter: 'brightness(0.85)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(13,59,94,0) 30%, rgba(13,59,94,0.85) 100%)' }} />
          <div style={{ position: 'absolute', left: 28, right: 28, bottom: 28, color: '#fff' }}>
            <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.laranja, letterSpacing: 1.5, fontWeight: 600, marginBottom: 12 }}>● TIME MGR</div>
            <p style={{ fontSize: 17, lineHeight: 1.5, fontWeight: 500, margin: 0, maxWidth: 560 }}>
              Mais do que um time, somos uma cultura técnica brasileira com orgulho — meritocracia, melhoria contínua e fazer certo da primeira vez. Nosso time combina <strong>Especialistas de Campo veteranos</strong>, gestão técnica estruturada e inteligência operacional para garantir continuidade aos nossos parceiros.
            </p>
          </div>
        </div>
        <div style={{ background: MGR.cinzaClaro, padding: '32px 32px 36px', borderRadius: 8, borderTop: `3px solid ${MGR.acento}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ width: '100%', aspectRatio: '1', background: MGR.azul, borderRadius: 6, position: 'relative', overflow: 'hidden', marginBottom: 20 }}>
            <img src="assets/fundadores-mgr.png" alt="Guilherme — Sócio e COO" style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'right center', position: 'absolute', inset: 0 }} />
          </div>
          <div style={{ fontFamily: MGR.mono, fontSize: 10, color: MGR.acento, letterSpacing: 1.5, fontWeight: 600, marginBottom: 8 }}>SÓCIO · COO</div>
          <h3 style={{ fontSize: 24, fontWeight: 600, color: MGR.grafite, margin: '0 0 12px', letterSpacing: -0.4 }}>Guilherme</h3>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: MGR.cinzaMedio, margin: 0 }}>
            Veio da G-tec Manutenção e, com a fusão que originou a MGR Soluções e Tecnologia da Refrigeração, entrou como sócio da nova empresa. Lidera a operação técnica e de equipes, trazendo a experiência de duas trajetórias unidas em uma única casa.
          </p>
        </div>
      </div>
    </section>
  );
}

function S_Parceiros() {
  const logos = [
    'Neves Salgados', 'Sorvetão / Croaçã', 'L&L Products',
    'Indaia Pescados', 'Adega do Magrão', 'Girofrezzer (Honor)',
    'The Cleavers', 'Pesqueiro Santa Tereza', 'Diso Distribuidora',
    'Ceasa — Tropi Sabor',
  ];
  const tags = ['Indústria alimentícia', 'Sorveteria/food service', 'Pescados', 'Distribuição de bebidas', 'Logística refrigerada', 'Hortifruti', 'Atacado'];
  return (
    <section id="parceiros" className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="07" label="Parceiros" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: 0, lineHeight: 1.05 }}>
          Quem conta com a continuidade MGR.
        </h2>
      </div>
      <div className="grid-5" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, background: '#e6ebf1', marginBottom: 32 }}>
        {logos.map((l, i) => (
          <div key={i} style={{ background: '#fff', padding: '36px 24px', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: MGR.azul, letterSpacing: -0.2, lineHeight: 1.3 }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 64 }}>
        {tags.map((t, i) => (
          <span key={i} style={{ background: '#fff', border: '1px solid #e0e6ec', padding: '8px 16px', borderRadius: 999, fontSize: 12, color: MGR.cinzaMedio, fontWeight: 500 }}>
            {t}
          </span>
        ))}
      </div>
      <div style={{ background: MGR.azulClaro, padding: '56px 64px', borderLeft: `4px solid ${MGR.azul}`, borderRadius: 4 }}>
        <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, alignItems: 'center' }}>
          <MGRPhoto label="Gestor parceiro" tone="claro" aspect="1/1" />
          <div>
            <div style={{ fontSize: 11, color: MGR.azul, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 16 }}>Depoimento</div>
            <p style={{ fontSize: 24, lineHeight: 1.4, color: MGR.grafite, margin: '0 0 24px', letterSpacing: -0.3, fontWeight: 500 }}>
              "A câmara fria projetada pela MGR reduziu nosso consumo energético em <span style={{ color: MGR.acento }}>28%</span> e não tivemos uma única parada em 2 anos."
            </p>
            <div style={{ fontSize: 14, color: MGR.cinzaMedio }}>
              <strong style={{ color: MGR.grafite }}>[Nome do gestor]</strong> · Gerente Industrial · [Empresa parceira]
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function S_TechParceiros() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '100px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 48 }}>
        <SectionTag num="08" label="Parceiros técnicos de tecnologia" color={MGR.azul} />
        <h2 className="h2" style={{ fontSize: 36, fontWeight: 600, letterSpacing: -1, color: MGR.grafite, margin: 0, lineHeight: 1.1 }}>
          Quem nos ajuda a construir tecnologia própria.
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: MGR.cinzaMedio, marginTop: 20, maxWidth: 720 }}>
          A MGR trabalha com parceiros técnicos especializados para manter excelência em tecnologia própria, sem depender de terceirização operacional.
        </p>
      </div>
      <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {[
          { t: 'Antigravity', d: 'Desenvolvimento de produto digital — React/TypeScript/Cloud.' },
          { t: 'Studio', d: 'Design de interfaces e experiência.' },
        ].map((p, i) => (
          <div key={i} style={{ background: MGR.cinzaClaro, padding: '32px 32px 36px', borderRadius: 6, borderLeft: `3px solid ${MGR.azul}` }}>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: MGR.grafite, margin: '0 0 10px', letterSpacing: -0.4 }}>{p.t}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: MGR.cinzaMedio, margin: 0 }}>{p.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function S_Futuro() {
  const cards = [
    { tag: 'DISPONÍVEL HOJE', color: MGR.azul, t: 'MGR PCM', d: 'Painel de Controle Master.' },
    { tag: 'DISPONÍVEL HOJE', color: MGR.acento, t: 'Hack de Refrigeração MGR', d: 'Padronização técnica autoral.' },
    { tag: 'EM DESENVOLVIMENTO', color: MGR.cinzaMedio, t: 'MGR Connect + Controlador 2.0', d: 'Acesso antecipado para parceiros piloto.' },
  ];
  return (
    <section id="futuro" className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 920, marginBottom: 56 }}>
        <SectionTag num="09" label="Visão de futuro" color={MGR.laranja} />
        <h2 className="h2" style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: '#fff', margin: 0, lineHeight: 1.05 }}>
          Para onde estamos indo.
        </h2>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: 'rgba(255,255,255,0.7)', marginTop: 24, maxWidth: 760 }}>
          A MGR investe em tecnologia proprietária para ampliar continuidade operacional. Estamos construindo a próxima camada do Ciclo de Vida MGR: gestão integrada, monitoramento em tempo real e controle remoto da sua refrigeração.
        </p>
      </div>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', padding: '28px 28px 32px', borderRadius: 8 }}>
            <div style={{ display: 'inline-block', background: c.tag === 'EM DESENVOLVIMENTO' ? 'rgba(255,255,255,0.08)' : c.color, color: c.tag === 'EM DESENVOLVIMENTO' ? 'rgba(255,255,255,0.7)' : '#fff', fontFamily: MGR.mono, fontSize: 10, padding: '4px 10px', borderRadius: 4, letterSpacing: 1.5, fontWeight: 600, marginBottom: 20 }}>
              {c.tag}
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 600, color: '#fff', margin: '0 0 10px', letterSpacing: -0.4 }}>{c.t}</h3>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.65)', margin: 0 }}>{c.d}</p>
          </div>
        ))}
      </div>
      <a href="solucoes-mgr.html" style={{ fontSize: 15, color: MGR.laranja, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${MGR.laranja}`, paddingBottom: 4 }}>
        Conheça as Soluções MGR <Ico name="arrow" size={14} />
      </a>
    </section>
  );
}

function S_Footer() {
  return <MGRFooter />;
}

function S_FooterOld_unused() {
  return (
    <footer style={{ display: 'none' }}>
      {/* legacy footer kept for ref but not used */}
    </footer>
  );
}

function S_FooterOld_dead() {
  return (
    <footer style={{ background: MGR.preto, color: 'rgba(255,255,255,0.7)', padding: '88px 56px 32px', fontFamily: MGR.sans, fontSize: 13 }}>
      <div className="pad" style={{ maxWidth: 1180, margin: '0 auto 64px' }}>
        <p className="h-edit" style={{ fontFamily: MGR.sans, fontWeight: 600, fontSize: 'clamp(32px, 4.5vw, 56px)', color: MGR.acento, letterSpacing: -1.4, lineHeight: 1.1, margin: 0, maxWidth: 1100 }}>
          Refrigeração crítica não admite improviso. <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 400 }}>Converse com quem trata continuidade como compromisso contratual.</span>
        </p>
      </div>
      <div className="pad grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginBottom: 48, maxWidth: 1180, margin: '0 auto 48px' }}>
        <div>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 18, fontWeight: 600 }}>● IDENTIFICAÇÃO</div>
          <div style={{ fontSize: 15, color: '#fff', fontWeight: 600, marginBottom: 10 }}>MGR Soluções e Tecnologia da Refrigeração Ltda</div>
          <div style={{ lineHeight: 1.7, color: 'rgba(255,255,255,0.6)' }}>
            CNPJ: 38.062.685/0001-73 · IE: 353.426.803.110<br />
            Rua Elza Capanesi Zambonini, 251<br />
            Jardim Casablanca · Indaiatuba/SP · 13.338-212
          </div>
        </div>
        <div>
          <div style={{ fontFamily: MGR.mono, fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 1.5, marginBottom: 18, fontWeight: 600 }}>● CONTATO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <a href="mailto:administrativo.mgr@gmail.com" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
              <Ico name="doc" size={16} color={MGR.laranja} /> administrativo.mgr@gmail.com
            </a>
            <a href={WHATS_S} target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
              <Ico name="arrow" size={16} color={MGR.laranja} /> WhatsApp Comercial: (19) 98307-3630
            </a>
            <a href="https://wa.me/5519971382628" target="_blank" rel="noopener" style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
              <Ico name="arrow" size={16} color={MGR.laranja} /> WhatsApp Administrativo: (19) 97138-2628
            </a>
          </div>
          <a href={WHATS_S} target="_blank" rel="noopener" style={{ marginTop: 24, background: MGR.acento, color: '#fff', padding: '18px 28px', fontSize: 14, fontWeight: 600, borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            Agende uma Visita de Valor <Ico name="arrow" size={16} />
          </a>
        </div>
      </div>
      <div className="pad" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>© 2026 MGR Soluções e Tecnologia da Refrigeração Ltda</div>
        <div><a href="index.html">Voltar para a home</a></div>
      </div>
    </footer>
  );
}

function PageSobre() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <S_Hero />
      <S_Manifesto />
      <S_Historia />
      <S_Proposito />
      <S_Valores />
      <S_Posicionamento />
      <S_Numeros />
      <S_Time />
      <S_Parceiros />
      {/* <S_TechParceiros /> — escondido temporariamente */}
      <S_Futuro />
      <S_Footer />
    </div>
  );
}

Object.assign(window, { PageSobre });

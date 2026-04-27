// Direção A — INSTITUCIONAL TÉCNICO
// Azul dominante #0D3B5E + laranja de ação. Dados em destaque. Pose "engenharia sênior".

function A_Nav() {
  return <MGRHeader active="home" />;
}

function A_Hero() {
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', paddingBottom: 0, position: 'relative', overflow: 'hidden' }}>
      <A_Nav />
      {/* linha decorativa arco */}
      <svg style={{ position: 'absolute', top: 80, right: -100, opacity: 0.08 }} width="700" height="400" viewBox="0 0 700 400">
        <path d="M 20 380 Q 350 -20 680 380" fill="none" stroke={MGR.laranja} strokeWidth="2" />
        <path d="M 60 380 Q 350 40 640 380" fill="none" stroke="#fff" strokeWidth="1" />
      </svg>

      <div style={{ padding: '80px 56px 96px', position: 'relative', fontFamily: MGR.sans }}>
        <SectionTag num="01" label="Continuidade operacional · Engenharia de frio" color={MGR.laranja} />

        <h1 style={{
          fontFamily: MGR.sans, fontWeight: 700, fontSize: 82, lineHeight: 0.98, letterSpacing: -2.2,
          color: '#fff', margin: 0, maxWidth: 1100,
        }}>
          Refrigeração industrial é o sistema nervoso<br />
          <span style={{ color: MGR.laranja }}>invisível</span> da sua operação.
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 64, marginTop: 48, alignItems: 'end' }}>
          <p style={{ fontSize: 19, lineHeight: 1.55, color: 'rgba(255,255,255,0.78)', margin: 0, maxWidth: 620 }}>
            Do projeto à operação contínua, a MGR garante que seu sistema funcione — com SLA contratual, tecnologia própria e equipe que resolve sob pressão.
            <br /><br />
            <span style={{ color: MGR.laranja, fontWeight: 500 }}>Zero Downtime</span> não é slogan. É cláusula.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button style={{ background: MGR.acento, color: '#fff', border: 'none', padding: '18px 28px', fontSize: 14, fontWeight: 600, cursor: 'pointer', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              Solicitar Visita de Valor <Ico name="arrow" size={16} />
            </button>
            <button style={{ background: 'transparent', color: '#fff', border: `1px solid rgba(255,255,255,0.3)`, padding: '18px 28px', fontSize: 14, fontWeight: 500, cursor: 'pointer', borderRadius: 8 }}>
              Conhecer o Ciclo de Vida MGR
            </button>
          </div>
        </div>

        {/* Hero image — foto real da equipe MGR */}
        <div style={{ marginTop: 80, borderRadius: 8, overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}>
          <img
            src="assets/equipe-mgr.png"
            alt="Especialistas de Campo MGR · equipe em Indaiatuba, SP"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>

        {/* Trust strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 40, borderTop: `1px solid rgba(255,255,255,0.1)`, borderBottom: `1px solid rgba(255,255,255,0.1)` }}>
          {[
            ['+20', 'anos em campo'],
            ['+200', 'projetos entregues'],
            ['24/7', 'SLA contratual'],
            ['100%', 'técnicos próprios'],
          ].map(([n, l], i) => (
            <div key={i} style={{ padding: '28px 0', borderLeft: i ? `1px solid rgba(255,255,255,0.08)` : 'none', paddingLeft: i ? 36 : 0 }}>
              <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', letterSpacing: -1.2, lineHeight: 1 }}>{n}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 8, letterSpacing: 0.3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function A_Manifesto() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 1100 }}>
        <SectionTag num="02" label="Manifesto" color={MGR.azul} />
        <p style={{ fontSize: 42, lineHeight: 1.2, color: MGR.grafite, letterSpacing: -0.8, fontWeight: 400, margin: 0 }}>
          Quando funciona, ninguém percebe. <span style={{ color: MGR.cinzaMedio }}>Quando falha, tudo para — produção, estoque, faturamento.</span> A MGR existe para garantir que isso <span style={{ color: MGR.acento, fontWeight: 600 }}>nunca aconteça</span>.
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 40, color: MGR.cinzaMedio, fontSize: 14 }}>
          <span>— Marcos Giovanni, fundador MGR</span>
        </div>
      </div>
    </section>
  );
}

function A_Services() {
  const servs = [
    { code: '01', t: 'Turnkey Completo', sub: 'Projeto, execução e entrega chave-na-mão', d: 'Da Visita de Valor inicial à entrega operacional. Único responsável do dimensionamento ao start-up: estratégia, cotação assistida, montagem mecânica e elétrica, comissionamento documentado e treinamento da equipe.', tags: ['Visita de Valor', 'Dimensionamento', 'Comissionamento', 'Chave-na-mão'], href: 'turnkey-completo.html' },
    { code: '02', t: 'Retrofit Turnkey', sub: 'Modernização e expansão da sua operação', d: 'Mesma metodologia turnkey, aplicada à operação que já existe. Modernização, ampliação ou mudança de endereço — com plano de continuidade para sua produção não parar durante a obra.', tags: ['Retrofit', 'Expansão', 'Mudança de planta', 'Continuidade'], href: 'retrofit-turnkey.html' },
    { code: '03', t: 'Anti-Downtime · Contratos 24/7', sub: 'Contrato de continuidade', d: 'Contratos de manutenção 24/7 com SLA contratual e prioridades P1–P4. Plano de Manutenção MGR documentado, Relatório de Saúde a cada visita e penalidade financeira por descumprimento.', tags: ['SLA contratual', 'P1 em 2h', 'Plano MGR', 'Penalidade'], href: 'anti-downtime.html' },
    { code: '04', t: 'Manutenção Corretiva Sob Demanda', sub: 'Atendimento por chamado', d: 'Quebrou agora? A MGR atende — mesmo sem contrato. Diagnóstico técnico, reparo com peças validadas, orçamento transparente e Relatório Final documentado.', tags: ['Sem contrato', 'Diagnóstico', 'Laudo técnico', 'Peças originais'], href: 'manutencao-corretiva.html' },
    { code: '05', t: 'Soluções MGR', sub: 'Produtos proprietários', d: 'Tecnologia desenvolvida pela MGR para centralizar controle, otimizar consumo e, em breve, conectar sua operação em tempo real. PCM, Hack de Refrigeração e MGR Connect.', tags: ['PCM', 'Hack MGR', 'Connect (em breve)', 'Tecnologia própria'], href: 'solucoes-mgr.html' },
  ];
  return (
    <section className="pad" style={{ background: MGR.cinzaClaro, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 80, marginBottom: 72 }}>
        <div>
          <SectionTag num="03" label="Serviços" color={MGR.azul} />
          <h2 style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1.5, color: MGR.grafite, margin: 0, lineHeight: 1.02 }}>
            O Ciclo de Vida MGR.
          </h2>
        </div>
        <p style={{ fontSize: 17, lineHeight: 1.65, color: MGR.cinzaMedio, margin: 0, maxWidth: 560, alignSelf: 'end' }}>
          Refrigeração não é serviço avulso — é parceria de ciclo de vida. Projetamos, executamos, mantemos e monitoramos com uma única obsessão: que seu negócio funcione, sempre.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2, background: '#e6ebf1' }}>
        {servs.map((s, i) => (
          <div key={i} style={{ background: '#fff', padding: '40px 40px 44px', display: 'flex', flexDirection: 'column', minHeight: 360, gridColumn: i === 4 ? '1 / -1' : 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 8, background: MGR.azulClaro, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.azul }}>
                  <Ico name={['doc', 'gear', 'shield', 'bell', 'chart'][i]} size={22} />
                </div>
                <div>
                  <div style={{ fontFamily: MGR.mono, fontSize: 11, color: MGR.cinzaMedio, letterSpacing: 1.5 }}>MGR · {s.code}</div>
                  <div style={{ fontSize: 12, color: MGR.azul, fontWeight: 500, marginTop: 2 }}>{s.sub}</div>
                </div>
              </div>
            </div>
            <h3 style={{ fontSize: 28, fontWeight: 600, color: MGR.grafite, letterSpacing: -0.6, margin: '0 0 14px', lineHeight: 1.15 }}>{s.t}</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, margin: '0 0 24px' }}>{s.d}</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
              {s.tags.map((t, j) => (
                <Chip key={j} color={MGR.azul} bg={MGR.azulClaro} border={false} size="sm">{t}</Chip>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <a href={s.href || undefined} style={{ fontSize: 13, color: MGR.acento, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, borderTop: `1px solid ${MGR.cinzaClaro}`, paddingTop: 20 }}>
              Saber mais <Ico name="arrow" size={14} />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function A_About() {
  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 80, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ aspectRatio: '4/5', width: '100%', overflow: 'hidden', borderRadius: 4 }}>
            <img
              src="assets/fundadores-mgr.png"
              alt="Fundadores Marcos Giovanni & Guilherme Macri"
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top' }}
            />
          </div>
          <div style={{ position: 'absolute', bottom: -24, left: -24, background: MGR.laranja, color: '#fff', padding: '20px 28px', fontWeight: 600 }}>
            <div style={{ fontSize: 11, letterSpacing: 1.5, opacity: 0.85, textTransform: 'uppercase', marginBottom: 4 }}>Desde</div>
            <div style={{ fontSize: 32, letterSpacing: -1 }}>+10 anos em campo</div>
          </div>
        </div>
        <div>
          <SectionTag num="04" label="Sobre" color={MGR.azul} />
          <h2 style={{ fontSize: 48, fontWeight: 600, letterSpacing: -1.4, color: MGR.grafite, margin: '0 0 32px', lineHeight: 1.05 }}>
            Engenharia brasileira <span style={{ color: MGR.azul }}>de classe mundial.</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: MGR.cinzaMedio, marginBottom: 20 }}>
            Marcos Giovanni passou uma década resolvendo problemas complexos de refrigeração industrial para grandes marcas. Percebeu que o mercado tratava refrigeração como commodity. Ele enxergava diferente.
          </p>
          <p style={{ fontSize: 17, lineHeight: 1.7, color: MGR.cinzaMedio, marginBottom: 40 }}>
            Em 2026, a MGR uniu forças com a GERTEK de Guilherme Macri. Nasceu a <strong style={{ color: MGR.grafite }}>MGR Soluções e Tecnologia da Refrigeração</strong> — a empresa mais completa do mercado, do projeto à operação contínua.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 0, borderTop: `1px solid ${MGR.cinzaClaro}`, borderBottom: `1px solid ${MGR.cinzaClaro}` }}>
            {[
              ['Propósito', 'Garantir que nenhum negócio pare por falha de refrigeração'],
              ['Essência', 'CONTINUIDADE'],
              ['Arquétipo', 'O Sábio + O Herói'],
              ['Sede', 'Indaiatuba · SP'],
            ].map(([k, v], i) => (
              <div key={i} style={{ padding: '20px 0', borderLeft: i % 2 ? `1px solid ${MGR.cinzaClaro}` : 'none', paddingLeft: i % 2 ? 28 : 0 }}>
                <div style={{ fontSize: 11, color: MGR.cinzaMedio, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{k}</div>
                <div style={{ fontSize: 15, color: MGR.grafite, fontWeight: 500 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function A_Why() {
  const items = [
    { i: 'shield', t: 'SLA com penalidade', d: 'Nosso contrato nos penaliza financeiramente se você parar. Compromisso que dói no bolso.' },
    { i: 'chart', t: 'Transparência radical', d: 'Cada OS, cada intervenção, cada chamado documentado com Relatório Final auditável.' },
    { i: 'gear', t: 'Precisão técnica', d: 'Memorial de cálculo documentado e auditável. Não existe improviso.' },
    { i: 'bell', t: 'Alertas preditivos', d: 'Nossos indicadores avisam antes de quebrar. Manutenção preditiva de verdade, não catálogo.' },
    { i: 'clock', t: 'Resposta 24/7', d: 'P1 em 2h, P2 em 4h. Equipe forjada em problemas complexos que outros não resolvem.' },
    { i: 'check', t: 'Ciclo de vida completo', d: 'Projeto → execução → manutenção → monitoramento. Um parceiro, um sistema, zero handoffs.' },
  ];
  return (
    <section className="pad" style={{ background: MGR.azulEscuro, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ maxWidth: 780, marginBottom: 72 }}>
        <SectionTag num="05" label="Por que a MGR" color={MGR.laranja} />
        <h2 style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1.5, color: '#fff', margin: 0, lineHeight: 1.02 }}>
          Seus concorrentes torcem para o equipamento funcionar.<br />
          <span style={{ color: MGR.laranja }}>Você sabe que funciona.</span>
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, background: 'rgba(255,255,255,0.08)' }}>
        {items.map((it, i) => (
          <div key={i} style={{ background: MGR.azulEscuro, padding: '36px 32px 40px' }}>
            <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(212,121,42,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MGR.laranja, marginBottom: 24 }}>
              <Ico name={it.i} size={24} />
            </div>
            <h4 style={{ fontSize: 20, fontWeight: 600, color: '#fff', margin: '0 0 12px', letterSpacing: -0.4 }}>{it.t}</h4>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.65)', margin: 0 }}>{it.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function A_Portfolio() {
  const featured = [
    {
      cat: 'Câmara fria · Estoque de distribuição',
      name: 'Diso Distribuidora',
      year: '2024',
      img: 'assets/diso-camara-nestle.png',
      location: 'São Paulo · SP',
      status: 'Projeto entregue',
      resumo: (
        <>Câmara fria refrigerada para <strong style={{ color: MGR.grafite }}>estoque e distribuição de produtos Nestlé</strong>. Projeto com porta-pallets drive-in de dupla profundidade, evaporadores de alta vazão e isolamento termomecânico dimensionado para giro intenso de SKUs congelados e resfriados.</>
      ),
      specs: [['Porta-pallets', 'Drive-in 2× prof.'], ['Pé-direito', '+9 m úteis'], ['Cliente final', 'Nestlé']],
      tags: ['Câmara fria', 'Distribuição', 'Porta-pallets', 'Evaporadores', 'Logística do frio'],
    },
  ];

  const secundarios = [
    { cat: 'Casa de máquinas · Refrigeração comercial', name: 'Croissant & Cia · Indaiatuba', year: '2023', img: 'assets/croissant-casa-maquinas.png' },
    { cat: 'Câmara fria de congelados · Armazenamento', name: 'Salgados Neves · São Paulo', year: '2024', img: 'assets/salgados-neves-camara.png' },
    { cat: 'Câmaras de pescado', name: 'Indaiá Pescados', year: '2024' },
    { cat: 'Primeira planta industrial', name: 'Brasa Burguer', year: '2023' },
  ];

  const caseStudies = [
    {
      cat: 'Fábrica de sorvetes · Construção completa em isopainéis',
      name: 'Sorvetão Indaiatuba',
      year: '2025',
      location: 'Indaiatuba · SP',
      status: 'Cliente ativo',
      resumo: (
        <>Construção de <strong style={{ color: MGR.grafite }}>100% das áreas de estoque refrigeradas, salas de produção climatizadas e sala limpa</strong>. Fábrica construída internamente, totalmente em isopainéis em todas as salas e divisões de áreas da produção — do envelope térmico à casa de máquinas, com rack de compressores em paralelo e linha frigorífica R-404A.</>
      ),
      specs: [
        ['Escopo', '100% áreas refrig.'],
        ['Envelope', 'Isopainéis'],
        ['Fluido', 'R-404A · Rack 4 comp.'],
        ['Local', 'Indaiatuba · SP'],
      ],
      tags: ['Fábrica completa', 'Estoque refrigerado', 'Salas climatizadas', 'Sala limpa', 'Isopainéis', 'Casa de máquinas', 'Rack paralelo'],
      photos: [
        { src: 'assets/sorvetao-fachada.png', label: 'Atacadão dos Sorvetes · fachada entregue', tag: '01' },
        { src: 'assets/sorvetao-casa-maquinas.png', label: 'Casa de máquinas · rack de compressores', tag: '02' },
      ],
    },
    {
      cat: 'Câmara fria refrigerada · Estoque de frutas e alimentos',
      name: 'TropSabor · CEASA Campinas',
      year: '2024',
      location: 'Campinas · SP',
      status: 'Obra entregue',
      resumo: (
        <>Câmara fria refrigerada para <strong style={{ color: MGR.grafite }}>estoque de frutas e alimentos</strong> em box do CEASA Campinas. Projeto completo: estrutura em painéis isotérmicos, casa de máquinas com rack de compressores Bitzer, tubulação de cobre isolada e start-up integrado à operação existente do box.</>
      ),
      specs: [
        ['Local', 'Box CEASA Campinas'],
        ['Aplicação', 'Frutas + alimentos'],
        ['Escopo', 'Projeto + execução'],
        ['Entrega', 'Janeiro · 2024'],
      ],
      tags: ['Câmara fria', 'Painéis isotérmicos', 'CEASA', 'Boxes refrigerados', 'Obra completa'],
      photos: [
        { src: 'assets/tropsabor-fachada.png', label: 'Fachada do box entregue', tag: '01' },
        { src: 'assets/tropsabor-obra-paineis.png', label: 'Montagem dos painéis isotérmicos', tag: '02' },
        { src: 'assets/tropsabor-interior.png', label: 'Face interna acabada', tag: '03' },
        { src: 'assets/tropsabor-galpao.png', label: 'Galpão preparado para montagem', tag: '04' },
      ],
    },
    {
      cat: 'Câmara fria refrigerada · Condicionamento de flores',
      name: 'Eco Flora Brasil · Unidade Filomena',
      year: '2023',
      location: 'Mogi Mirim · SP',
      status: 'Obra entregue',
      resumo: (
        <>Câmara fria refrigerada para <strong style={{ color: MGR.grafite }}>condicionamento pós-colheita de flores e orquídeas</strong>. Construção em campo sobre estrutura existente da unidade Filomena — painéis isotérmicos montados com empilhadeira, selagem termomecânica e controle fino de temperatura e umidade para preservar produto sensível.</>
      ),
      specs: [
        ['Aplicação', 'Flores + orquídeas'],
        ['Obra', 'Construção em campo'],
        ['Cliente', 'Eco Flora Brasil'],
        ['Unidade', 'Filomena · Mogi Mirim'],
      ],
      tags: ['Câmara fria', 'Pós-colheita', 'Floricultura', 'Painéis isotérmicos', 'Controle de umidade', 'Obra completa'],
      photos: [
        { src: 'assets/ecoflora-montagem.png', label: 'Equipe MGR no topo da câmara em montagem', tag: '01' },
        { src: 'assets/ecoflora-estrutura.png', label: 'Estrutura aberta — painéis em posição', tag: '02' },
        { src: 'assets/ecoflora-flores.png', label: 'Produto final condicionado · orquídeas', tag: '03' },
        { src: 'assets/ecoflora-unidade.png', label: 'Unidade Filomena — fachada externa', tag: '04' },
      ],
    },
  ];

  return (
    <section className="pad" style={{ background: MGR.branco, padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 56 }}>
        <div>
          <SectionTag num="06" label="Parceiros de Operação" color={MGR.azul} />
          <h2 style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1.5, color: MGR.grafite, margin: 0, lineHeight: 1 }}>
            Projetos entregues.
          </h2>
        </div>
        <a style={{ fontSize: 14, color: MGR.acento, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          Todos os parceiros <Ico name="arrow" size={14} />
        </a>
      </div>

      {/* Projetos em destaque — fotos reais */}
      {featured.map((feat, idx) => {
        const reverse = idx % 2 === 1;
        const Photo = (
          <div key="photo" style={{ position: 'relative', background: MGR.azulEscuro, overflow: 'hidden', borderRadius: 4, minHeight: 560 }}>
            <img src={feat.img} alt={`${feat.name} — ${feat.cat}`}
              style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', position: 'absolute', inset: 0 }} />
            <div style={{ position: 'absolute', top: 20, left: 20, background: MGR.laranja, color: '#fff', padding: '8px 14px', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase', fontWeight: 600 }}>
              {idx === 0 ? 'Entrega recente' : 'Projeto entregue'} · {feat.year}
            </div>
          </div>
        );
        const Info = (
          <div key="info" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '16px 8px' }}>
            <Chip color={MGR.azul} bg={MGR.azulClaro} border={false} size="sm">{feat.status}</Chip>
            <h3 style={{ fontSize: 52, fontWeight: 600, color: MGR.grafite, letterSpacing: -1.4, margin: '20px 0 12px', lineHeight: 1 }}>
              {feat.name}
            </h3>
            <div style={{ fontSize: 15, color: MGR.azul, fontWeight: 600, letterSpacing: 0.4, marginBottom: 28 }}>
              {feat.cat}
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: MGR.cinzaMedio, margin: '0 0 32px', maxWidth: 520 }}>
              {feat.resumo}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: `1px solid ${MGR.cinzaClaro}`, borderBottom: `1px solid ${MGR.cinzaClaro}`, marginBottom: 28 }}>
              {feat.specs.map(([k, v], i) => (
                <div key={i} style={{ padding: '18px 0', borderLeft: i ? `1px solid ${MGR.cinzaClaro}` : 'none', paddingLeft: i ? 20 : 0 }}>
                  <div style={{ fontSize: 10, color: MGR.cinzaMedio, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{k}</div>
                  <div style={{ fontSize: 15, color: MGR.grafite, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {feat.tags.map((t, j) => (
                <Chip key={j} color={MGR.azul} bg={MGR.azulClaro} border={false} size="sm">{t}</Chip>
              ))}
            </div>
          </div>
        );
        return (
          <div key={idx} style={{
            display: 'grid',
            gridTemplateColumns: reverse ? '1fr 480px' : '480px 1fr',
            gap: 56, marginBottom: idx === featured.length - 1 ? 72 : 56,
            alignItems: 'stretch',
          }}>
            {reverse ? [Info, Photo] : [Photo, Info]}
          </div>
        );
      })}

      {/* Case studies — mosaicos de obra com múltiplas fotos */}
      {caseStudies.map((cs, csIdx) => (
        <div key={csIdx} style={{ background: MGR.cinzaClaro, padding: '48px 48px 56px', marginBottom: 72, borderRadius: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginBottom: 36, alignItems: 'end' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                <Chip color={MGR.azul} bg="#fff" border={false} size="sm">Case study</Chip>
                <Chip color={MGR.laranja} bg="#fff" border={false} size="sm">{cs.status}</Chip>
              </div>
              <h3 style={{ fontSize: 48, fontWeight: 600, color: MGR.grafite, letterSpacing: -1.2, margin: '0 0 10px', lineHeight: 1 }}>
                {cs.name}
              </h3>
              <div style={{ fontSize: 15, color: MGR.azul, fontWeight: 600, letterSpacing: 0.4 }}>
                {cs.cat}
              </div>
            </div>
            <div>
              <p style={{ fontSize: 16, lineHeight: 1.65, color: MGR.cinzaMedio, margin: '0 0 20px' }}>
                {cs.resumo}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {cs.tags.map((t, j) => (
                  <Chip key={j} color={MGR.azul} bg="#fff" border={false} size="sm">{t}</Chip>
                ))}
              </div>
            </div>
          </div>

          {/* Mosaico adaptativo: 2 fotos = split; 3-4 fotos = L-shape; 5+ = hero + grid */}
          {cs.photos.length === 2 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, height: 460 }}>
              {cs.photos.map((ph, i) => (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                  <img src={ph.src} alt={ph.label}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', left: 16, top: 16, background: i === 0 ? MGR.laranja : 'rgba(13,59,94,0.92)', color: '#fff', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.5, padding: '4px 10px', fontWeight: 600 }}>
                    {ph.tag}
                  </div>
                  <div style={{ position: 'absolute', left: 16, bottom: 16, right: 16, color: '#fff', fontSize: 12, fontWeight: 500, background: 'rgba(0,0,0,0.55)', padding: '6px 10px', borderRadius: 2 }}>
                    {ph.label}
                  </div>
                </div>
              ))}
            </div>
          ) : cs.photos.length >= 5 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr 1fr', gridTemplateRows: '220px 220px', gap: 12 }}>
              <div style={{ gridRow: 'span 2', position: 'relative', overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                <img src={cs.photos[0].src} alt={cs.photos[0].label}
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', left: 16, bottom: 16, right: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ background: MGR.laranja, color: '#fff', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.5, padding: '4px 8px', fontWeight: 600 }}>
                    {cs.photos[0].tag}
                  </span>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 500, background: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: 2 }}>
                    {cs.photos[0].label}
                  </span>
                </div>
              </div>
              {cs.photos.slice(1).map((ph, i) => (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                  <img src={ph.src} alt={ph.label}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(13,59,94,0.88)', color: '#fff', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.5, padding: '3px 8px', fontWeight: 600 }}>
                    {ph.tag}
                  </div>
                  <div style={{ position: 'absolute', left: 10, bottom: 10, right: 10, color: '#fff', fontSize: 11, fontWeight: 500, background: 'rgba(0,0,0,0.55)', padding: '4px 8px', borderRadius: 2 }}>
                    {ph.label}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: '230px 230px', gap: 12 }}>
              <div style={{ gridRow: 'span 2', position: 'relative', overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                <img src={cs.photos[0].src} alt={cs.photos[0].label}
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', left: 16, bottom: 16, right: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ background: MGR.laranja, color: '#fff', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.5, padding: '4px 8px', fontWeight: 600 }}>
                    {cs.photos[0].tag}
                  </span>
                  <span style={{ color: '#fff', fontSize: 12, fontWeight: 500, background: 'rgba(0,0,0,0.55)', padding: '4px 10px', borderRadius: 2 }}>
                    {cs.photos[0].label}
                  </span>
                </div>
              </div>
              <div style={{ gridColumn: 'span 2', position: 'relative', overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                <img src={cs.photos[1].src} alt={cs.photos[1].label}
                  style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                <div style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(13,59,94,0.88)', color: '#fff', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.5, padding: '3px 8px', fontWeight: 600 }}>
                  {cs.photos[1].tag}
                </div>
                <div style={{ position: 'absolute', left: 10, bottom: 10, right: 10, color: '#fff', fontSize: 11, fontWeight: 500, background: 'rgba(0,0,0,0.55)', padding: '4px 8px', borderRadius: 2 }}>
                  {cs.photos[1].label}
                </div>
              </div>
              {cs.photos.slice(2).map((ph, i) => (
                <div key={i} style={{ position: 'relative', overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                  <img src={ph.src} alt={ph.label}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                  <div style={{ position: 'absolute', left: 10, top: 10, background: 'rgba(13,59,94,0.88)', color: '#fff', fontFamily: MGR.mono, fontSize: 10, letterSpacing: 1.5, padding: '3px 8px', fontWeight: 600 }}>
                    {ph.tag}
                  </div>
                  <div style={{ position: 'absolute', left: 10, bottom: 10, right: 10, color: '#fff', fontSize: 11, fontWeight: 500, background: 'rgba(0,0,0,0.55)', padding: '4px 8px', borderRadius: 2 }}>
                    {ph.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* specs row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, marginTop: 32, background: '#fff', borderRadius: 4 }}>
            {cs.specs.map(([k, v], i) => (
              <div key={i} style={{ padding: '20px 24px', borderLeft: i ? `1px solid ${MGR.cinzaClaro}` : 'none' }}>
                <div style={{ fontSize: 10, color: MGR.cinzaMedio, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{k}</div>
                <div style={{ fontSize: 15, color: MGR.grafite, fontWeight: 600 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Projetos secundários */}
      <div style={{ borderTop: `1px solid ${MGR.cinzaClaro}`, paddingTop: 40 }}>
        <div style={{ fontSize: 11, color: MGR.cinzaMedio, letterSpacing: 1.8, textTransform: 'uppercase', fontFamily: MGR.mono, marginBottom: 28 }}>
          ● Mais parceiros de operação
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {secundarios.map((p, i) => (
            <div key={i}>
              {p.img ? (
                <div style={{ position: 'relative', width: '100%', height: 260, overflow: 'hidden', borderRadius: 4, background: MGR.azulEscuro }}>
                  <img src={p.img} alt={p.name}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
                </div>
              ) : (
                <MGRPhoto label={p.name} tone="azul" height={260} />
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginTop: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: MGR.cinzaMedio, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 }}>{p.cat}</div>
                  <div style={{ fontSize: 18, color: MGR.grafite, fontWeight: 600 }}>{p.name}</div>
                </div>
                <div style={{ fontSize: 13, color: MGR.cinzaMedio, fontFamily: MGR.mono }}>{p.year}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Depoimento */}
      <div style={{ marginTop: 80, padding: '56px 64px', background: MGR.azulClaro, borderLeft: `4px solid ${MGR.azul}` }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 48, alignItems: 'center' }}>
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

function A_Connect() {
  return (
    <section className="pad" style={{ background: MGR.preto, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans, position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 72, alignItems: 'center' }}>
        <div>
          <SectionTag num="07" label="Tecnologia própria" color={MGR.laranja} />
          <h2 style={{ fontSize: 52, fontWeight: 600, letterSpacing: -1.5, color: '#fff', margin: '0 0 24px', lineHeight: 1.02 }}>
            MGR Connect.<br />
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>Sua refrigeração, em tempo real.</span>
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'rgba(255,255,255,0.7)', marginBottom: 40 }}>
            Plataforma de gestão proprietária. Cada OS, cada intervenção, cada sensor — acessíveis de qualquer lugar. Alertas preditivos, Relatório de Saúde periódico e histórico de ciclo de vida num só lugar.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            {['Monitoramento 24/7', 'Alertas preditivos', 'Histórico auditável', 'Dashboard em tempo real'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
                <Ico name="check" size={18} color={MGR.laranja} />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Mock de dashboard */}
        <div style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid rgba(255,255,255,0.08)`, display: 'flex', alignItems: 'center', gap: 10, fontFamily: MGR.mono, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
            <span style={{ color: MGR.sucesso }}>●</span> mgrconnect.com.br/dashboard/parceiro-01
          </div>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Câmara Fria 01 · Setor Alimentos</div>
              <Chip color={MGR.sucesso} bg="rgba(22,163,74,0.12)" border={false} size="sm">● Operação normal</Chip>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
              {[['-22°C', 'Temp. atual'], ['2°C', 'Variação'], ['99.8%', 'Uptime 30d']].map(([v, l], i) => (
                <div key={i} style={{ background: '#222', padding: '14px 16px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: 24, fontFamily: MGR.mono, color: MGR.laranja, fontWeight: 600 }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, letterSpacing: 0.3 }}>{l}</div>
                </div>
              ))}
            </div>
            {/* fake graph */}
            <div style={{ background: '#222', borderRadius: 8, padding: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
              <svg width="100%" height="100" viewBox="0 0 400 100" preserveAspectRatio="none">
                <path d="M 0 70 L 40 68 L 80 72 L 120 65 L 160 70 L 200 60 L 240 62 L 280 55 L 320 58 L 360 50 L 400 52" fill="none" stroke={MGR.laranja} strokeWidth="2" />
                <path d="M 0 70 L 40 68 L 80 72 L 120 65 L 160 70 L 200 60 L 240 62 L 280 55 L 320 58 L 360 50 L 400 52 L 400 100 L 0 100 Z" fill={MGR.laranja} opacity="0.1" />
              </svg>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: MGR.mono, marginTop: 8, letterSpacing: 1 }}>TEMP · 30 DIAS</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function A_CTA() {
  const [form, setForm] = React.useState({ nome: '', empresa: '', telefone: '', descricao: '' });
  const [status, setStatus] = React.useState('idle'); // idle | loading | success | error
  const [errMsg, setErrMsg] = React.useState('');

  const set = (k) => (e) => setForm((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErrMsg('');
    if (form.nome.trim().length < 3) { setErrMsg('Informe seu nome completo.'); return; }
    const telDigits = form.telefone.replace(/\D/g, '');
    if (telDigits.length < 8) { setErrMsg('Informe um telefone válido.'); return; }
    setStatus('loading');
    try {
      await window.mgrDb.collection('project_leads').add({
        nomeContato: form.nome.trim(),
        telefone: form.telefone.trim(),
        empresa: form.empresa.trim() || null,
        descricao: form.descricao.trim() || null,
        tipoProjetoSlug: 'nao_definido',
        origem: 'site_home',
        status: 'novo',
        criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
        userAgent: navigator.userAgent.slice(0, 200),
      });
      setStatus('success');
      setForm({ nome: '', empresa: '', telefone: '', descricao: '' });
    } catch (err) {
      console.error('Lead create failed:', err);
      setStatus('error');
      setErrMsg('Não foi possível enviar agora. Tente o WhatsApp abaixo.');
    }
  };

  return (
    <section className="pad" style={{ background: MGR.azul, color: '#fff', padding: '120px 56px', fontFamily: MGR.sans }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <SectionTag num="08" label="Solicitar Visita de Valor" color={MGR.laranja} />
          <h2 style={{ fontSize: 56, fontWeight: 600, letterSpacing: -1.6, color: '#fff', margin: '0 0 24px', lineHeight: 1.02 }}>
            Comece pelo diagnóstico da sua operação.
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'rgba(255,255,255,0.78)', marginBottom: 40, maxWidth: 520 }}>
            Nosso Especialista de Campo vai até você para uma <strong>Visita de Valor</strong> — sem custo, sem compromisso. Retornamos em até 2 horas úteis.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Ico name="check" size={16} color={MGR.laranja} /><span style={{ color: 'rgba(255,255,255,0.85)' }}>Diagnóstico técnico in loco</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Ico name="check" size={16} color={MGR.laranja} /><span style={{ color: 'rgba(255,255,255,0.85)' }}>Proposta com memorial de cálculo</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><Ico name="check" size={16} color={MGR.laranja} /><span style={{ color: 'rgba(255,255,255,0.85)' }}>Retorno em 2h úteis</span></div>
          </div>
        </div>

        {status === 'success' ? (
          <div style={{ background: '#fff', padding: 40, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', color: MGR.grafite, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', color: MGR.sucesso, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Ico name="check" size={28} />
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 600, color: MGR.grafite, margin: '0 0 12px' }}>Recebemos seu pedido!</h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: MGR.cinzaMedio, margin: 0 }}>
              Nosso Especialista de Campo retorna em até 2 horas úteis para agendar sua Visita de Valor.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} style={{ background: '#fff', padding: 40, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', color: MGR.grafite }}>
            <div style={{ fontSize: 13, color: MGR.cinzaMedio, marginBottom: 24, letterSpacing: 0.3 }}>Preencha 4 campos · Retorno em 2h úteis</div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: MGR.cinzaMedio, fontWeight: 500, display: 'block', marginBottom: 6, letterSpacing: 0.3 }}>Nome completo</label>
              <input value={form.nome} onChange={set('nome')} required minLength={3} placeholder="Ex.: João Silva" style={{ width: '100%', background: MGR.cinzaClaro, border: `1px solid ${MGR.cinzaClaro}`, padding: '14px 16px', fontSize: 14, borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: MGR.cinzaMedio, fontWeight: 500, display: 'block', marginBottom: 6, letterSpacing: 0.3 }}>Empresa</label>
              <input value={form.empresa} onChange={set('empresa')} placeholder="Razão social" style={{ width: '100%', background: MGR.cinzaClaro, border: `1px solid ${MGR.cinzaClaro}`, padding: '14px 16px', fontSize: 14, borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: MGR.cinzaMedio, fontWeight: 500, display: 'block', marginBottom: 6, letterSpacing: 0.3 }}>Telefone / WhatsApp</label>
              <input value={form.telefone} onChange={set('telefone')} required placeholder="(11) 00000-0000" style={{ width: '100%', background: MGR.cinzaClaro, border: `1px solid ${MGR.cinzaClaro}`, padding: '14px 16px', fontSize: 14, borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 12, color: MGR.cinzaMedio, fontWeight: 500, display: 'block', marginBottom: 6, letterSpacing: 0.3 }}>Descrição breve (opcional)</label>
              <textarea value={form.descricao} onChange={set('descricao')} placeholder="Tipo de operação, equipamentos, urgência..." style={{ width: '100%', background: MGR.cinzaClaro, border: `1px solid ${MGR.cinzaClaro}`, padding: '14px 16px', fontSize: 14, borderRadius: 8, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', minHeight: 80, resize: 'vertical' }} />
            </div>
            {errMsg && (
              <div style={{ background: 'rgba(220,38,38,0.08)', color: '#B91C1C', padding: '12px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{errMsg}</div>
            )}
            <button type="submit" disabled={status === 'loading'} style={{ width: '100%', background: status === 'loading' ? MGR.cinzaMedio : MGR.acento, color: '#fff', border: 'none', padding: '18px', fontSize: 15, fontWeight: 600, cursor: status === 'loading' ? 'wait' : 'pointer', fontFamily: 'inherit', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {status === 'loading' ? 'Enviando...' : <>Solicitar Visita de Valor <Ico name="arrow" size={16} /></>}
            </button>
            <div style={{ fontSize: 12, color: MGR.cinzaMedio, textAlign: 'center', marginTop: 14 }}>
              🔒 Seus dados estão protegidos · Sem custo, sem compromisso
            </div>
            <div style={{ borderTop: `1px solid ${MGR.cinzaClaro}`, marginTop: 24, paddingTop: 20, textAlign: 'center', fontSize: 13, color: MGR.cinzaMedio }}>
              Prefere WhatsApp? <a href={MGR_WHATS} target="_blank" rel="noopener" style={{ color: '#25D366', fontWeight: 600 }}>Fale agora →</a>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

function A_Footer() {
  return <MGRFooter />;
}

function A_FooterDead() {
  return (
    <footer style={{ display: 'none' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 56, marginBottom: 48 }}>
        <div>
          <MGRLogo inverse size={256} />
          <p style={{ marginTop: 20, lineHeight: 1.6, maxWidth: 320, color: 'rgba(255,255,255,0.55)' }}>
            MGR Soluções e Tecnologia da Refrigeração.<br />
            Do projeto à operação contínua.
          </p>
        </div>
        {[
          ['Serviços', [['Câmaras frias', '#'], ['Túneis de congelamento', '#'], ['Chillers', '#'], ['Anti-Downtime · Contratos 24/7', 'anti-downtime.html'], ['Corretiva sob demanda', 'manutencao-corretiva.html']]],
          ['Empresa', [['Sobre', 'sobre.html'], ['Parceiros', '#'], ['Trabalhe conosco', 'trabalhe-conosco.html'], ['Blog', '#']]],
          ['Contato', ['Indaiatuba · SP', '(19) [tel]', 'contato@mgr.com.br', 'WhatsApp']],
        ].map(([t, items], i) => (
          <div key={i}>
            <div style={{ fontWeight: 600, color: '#fff', marginBottom: 16, fontSize: 13 }}>{t}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'rgba(255,255,255,0.55)' }}>
              {items.map((x, j) => Array.isArray(x) ? <a key={j} href={x[1]}>{x[0]}</a> : <a key={j}>{x}</a>)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
        <div>© 2026 MGR Soluções e Tecnologia da Refrigeração Ltda · CNPJ [inserir]</div>
        <div style={{ display: 'flex', gap: 24 }}>
          <a>Política de Privacidade</a>
          <a>Termos</a>
        </div>
      </div>
    </footer>
  );
}

function DirectionA() {
  return (
    <div style={{ background: '#fff', color: MGR.grafite }}>
      <A_Hero />
      <A_Manifesto />
      <A_Services />
      <A_About />
      <A_Why />
      <A_Portfolio />
      <A_CTA />
      <A_Footer />
    </div>
  );
}

Object.assign(window, { DirectionA });

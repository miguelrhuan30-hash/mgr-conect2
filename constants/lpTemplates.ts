import { LPTemplate, MultiLPSection } from '../types';

const BASE_CONTACT = {
  phone: '(41) 3333-0000',
  whatsapp: '5541999990000',
  email: 'contato@mgrsolutions.com.br',
};

const BASE_FOOTER = {
  address: 'Curitiba – PR | Região Sul do Brasil',
  phone: BASE_CONTACT.phone,
  email: BASE_CONTACT.email,
  instagram: 'https://instagram.com/mgrsolutions',
  copyright: `© ${new Date().getFullYear()} MGR Soluções em Refrigeração Industrial. Todos os direitos reservados.`,
};

const BASE_DIFFERENTIALS = {
  title: 'Por que a MGR?',
  items: [
    { icon: 'ShieldCheck', title: '10 anos de mercado', description: 'Experiência comprovada em refrigeração industrial no Sul do Brasil.' },
    { icon: 'Clock', title: 'Atendimento ágil', description: 'Equipe técnica pronta para emergências 24h.' },
    { icon: 'Award', title: 'Garantia de serviço', description: 'Todos os serviços com garantia e laudo técnico.' },
    { icon: 'Users', title: 'Equipe certificada', description: 'Técnicos treinados e certificados pelos fabricantes.' },
  ],
};

const BASE_BRIDGE = {
  stats: [
    { value: '+500', label: 'Clientes atendidos' },
    { value: '10 anos', label: 'No mercado' },
    { value: '+1.200', label: 'Projetos entregues' },
    { value: '24h', label: 'Suporte disponível' },
  ],
};

function makeContent(overrides: Partial<MultiLPSection>): MultiLPSection {
  return {
    header: {
      tagline: 'MGR Soluções em Refrigeração Industrial',
      phone: BASE_CONTACT.phone,
      whatsapp: BASE_CONTACT.whatsapp,
      ...overrides.header,
    },
    hero: {
      title: 'Título da LP',
      subtitle: 'Subtítulo da landing page',
      backgroundImageUrl: '',
      ctaText: 'Fale com um especialista',
      ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      ...overrides.hero,
    },
    problem: {
      title: 'Você enfrenta esses desafios?',
      items: [],
      ...overrides.problem,
    },
    solution: {
      title: 'Nossa solução',
      subtitle: 'Como a MGR resolve o seu problema',
      items: [],
      ...overrides.solution,
    },
    socialProof: {
      title: 'Empresas que confiam na MGR',
      items: [],
      ...overrides.socialProof,
    },
    differentials: BASE_DIFFERENTIALS,
    bridge: {
      title: 'A MGR é a parceira certa para o seu negócio',
      description: 'Com mais de 10 anos de atuação na refrigeração industrial, entregamos projetos robustos, seguros e com garantia de funcionamento.',
      ...BASE_BRIDGE,
      ...overrides.bridge,
    },
    cta: {
      title: 'Pronto para começar?',
      description: 'Fale com um especialista e receba um orçamento sem compromisso.',
      buttonText: 'Solicitar orçamento grátis',
      buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      ...BASE_CONTACT,
      ...overrides.cta,
    },
    footer: {
      ...BASE_FOOTER,
      ...overrides.footer,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 TEMPLATES DE ESPECIALIDADE MGR
// ─────────────────────────────────────────────────────────────────────────────

export const LP_TEMPLATES: LPTemplate[] = [
  {
    id: 'camaras-frias',
    name: 'Câmaras Frias',
    description: 'Landing page para venda e instalação de câmaras frias industriais.',
    icon: 'Snowflake',
    primaryColor: '#1B5E8A',
    accentColor: '#D4792A',
    content: makeContent({
      hero: {
        title: 'Câmaras Frias Industriais sob Medida',
        subtitle: 'Projete, instale e mantenha câmaras frias de alta performance com quem entende de refrigeração industrial há mais de 10 anos.',
        backgroundImageUrl: '',
        badgeText: 'Especialistas em Câmaras Frias',
        ctaText: 'Solicitar orçamento grátis',
        ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      },
      problem: {
        title: 'Sua operação sofre com esses problemas?',
        items: [
          { icon: 'ThermometerSnowflake', title: 'Temperatura instável', description: 'Câmara não mantém a temperatura adequada, comprometendo produtos.' },
          { icon: 'Zap', title: 'Alto consumo de energia', description: 'Gastos excessivos com eletricidade por equipamento desregulado.' },
          { icon: 'AlertTriangle', title: 'Paradas inesperadas', description: 'Falhas sem aviso causando perda de estoque e prejuízo operacional.' },
          { icon: 'Wrench', title: 'Manutenção cara e demorada', description: 'Falta de parceiro técnico qualificado e ágil na região.' },
        ],
      },
      solution: {
        title: 'Câmaras Frias MGR',
        subtitle: 'Soluções completas: projeto, instalação, manutenção e monitoramento remoto.',
        items: [
          { icon: 'LayoutDashboard', title: 'Projeto personalizado', description: 'Câmaras dimensionadas para o seu produto e volume de armazenagem.' },
          { icon: 'Wrench', title: 'Instalação técnica', description: 'Equipe certificada, instalação limpa com comissionamento completo.' },
          { icon: 'Activity', title: 'Manutenção preventiva', description: 'Planos de manutenção que evitam paradas e prolongam a vida útil.' },
          { icon: 'Wifi', title: 'Monitoramento remoto', description: 'Alertas em tempo real via app quando a temperatura sair da faixa.' },
        ],
      },
      socialProof: {
        title: 'Quem confia nas câmaras MGR',
        items: [
          { name: 'Frigorífico Sul', testimonial: '"A MGR entregou nossa câmara no prazo e dentro do orçamento. Zero problemas no primeiro ano."' },
          { name: 'Distribuidora Polar', testimonial: '"Monitoramento remoto salvou nosso estoque numa madrugada. Atendimento exemplar."' },
          { name: 'Laticínios Serra Verde', testimonial: '"Câmara funcionando há 3 anos sem paradas. Recomendo sem hesitar."' },
        ],
      },
      bridge: {
        title: 'MGR: referência em câmaras frias no Sul do Brasil',
        description: 'Projetamos e instalamos câmaras frigoríficas para alimentos, farmacêuticos, flores e qualquer produto que exija controle de temperatura preciso.',
        stats: BASE_BRIDGE.stats,
      },
      cta: {
        title: 'Monte sua câmara fria ideal',
        description: 'Técnicos especializados prontos para visitar e cotar sem compromisso.',
        buttonText: 'Quero um orçamento agora',
        buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
        ...BASE_CONTACT,
      },
    }),
  },

  {
    id: 'manutencao-refrigeracao',
    name: 'Manutenção Industrial',
    description: 'LP focada em contratos de manutenção preventiva e corretiva de refrigeração.',
    icon: 'Wrench',
    primaryColor: '#1B5E8A',
    accentColor: '#D4792A',
    content: makeContent({
      hero: {
        title: 'Manutenção de Refrigeração Industrial que Não Te Deixa na Mão',
        subtitle: 'Contratos de manutenção preventiva e corretiva com atendimento emergencial 24h para sua planta.',
        backgroundImageUrl: '',
        badgeText: 'Atendimento 24h',
        ctaText: 'Falar com um técnico',
        ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      },
      problem: {
        title: 'A falta de manutenção custa caro',
        items: [
          { icon: 'AlertTriangle', title: 'Paradas inesperadas', description: 'Equipamento para sem aviso causando perdas de produção.' },
          { icon: 'TrendingUp', title: 'Energia cara', description: 'Sistema sujo e desregulado consome até 40% mais energia.' },
          { icon: 'Clock', title: 'Espera longa por técnico', description: 'Fornecedor sem capacidade de atendimento rápido na sua região.' },
          { icon: 'Package', title: 'Perda de produto', description: 'Falha de temperatura compromete estoque de alto valor agregado.' },
        ],
      },
      solution: {
        title: 'Planos de Manutenção MGR',
        subtitle: 'Preventiva, corretiva e preditiva — tudo em um único contrato.',
        items: [
          { icon: 'Calendar', title: 'Visitas programadas', description: 'Cronograma de manutenção preventiva mensal, bimestral ou trimestral.' },
          { icon: 'Zap', title: 'Corretiva expressa', description: 'Técnico no local em até 4h para emergências no contrato.' },
          { icon: 'BarChart2', title: 'Relatórios técnicos', description: 'Laudo detalhado após cada intervenção para seu arquivo e seguro.' },
          { icon: 'ShieldCheck', title: 'Garantia no serviço', description: 'Todo serviço com garantia. Problema voltou? A gente resolve.' },
        ],
      },
      socialProof: {
        title: 'Indústrias que confiam na MGR',
        items: [
          { name: 'Supermercados Nordeste', testimonial: '"Contrato há 4 anos. Zero paradas de emergência desde que fechamos com a MGR."' },
          { name: 'Laticínios Aurora', testimonial: '"Relatórios técnicos detalhados nos ajudam a planejar o CAPEX de refrigeração."' },
          { name: 'Processadora FreshFood', testimonial: '"Atendimento em menos de 2h numa sexta à noite. Isso é parceria de verdade."' },
        ],
      },
      bridge: {
        title: 'Prevenção é mais barata que conserto',
        description: 'Um contrato de manutenção MGR custa menos do que uma única parada de emergência com perda de produto.',
        stats: BASE_BRIDGE.stats,
      },
      cta: {
        title: 'Proteja sua operação hoje',
        description: 'Consulte nossos planos de manutenção e encontre o ideal para o seu porte.',
        buttonText: 'Ver planos de manutenção',
        buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
        ...BASE_CONTACT,
      },
    }),
  },

  {
    id: 'tuneis-congelamento',
    name: 'Túneis de Congelamento',
    description: 'LP para projetos e instalação de túneis de congelamento industrial.',
    icon: 'Wind',
    primaryColor: '#1B5E8A',
    accentColor: '#D4792A',
    content: makeContent({
      hero: {
        title: 'Túneis de Congelamento de Alta Performance',
        subtitle: 'Projetos customizados de túneis contínuos e estacionários para indústrias alimentícias, frigoríficos e processadores.',
        backgroundImageUrl: '',
        badgeText: 'Congelamento Rápido e Eficiente',
        ctaText: 'Solicitar projeto técnico',
        ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      },
      problem: {
        title: 'Desafios do congelamento industrial',
        items: [
          { icon: 'Timer', title: 'Processo lento', description: 'Túnel subdimensionado gera gargalo na linha de produção.' },
          { icon: 'Snowflake', title: 'Qualidade comprometida', description: 'Congelamento inadequado afeta textura, cor e valor nutricional.' },
          { icon: 'Zap', title: 'Energia fora de controle', description: 'Equipamento desenhado errado consome energia de forma desnecessária.' },
          { icon: 'Scale', title: 'Capacidade insuficiente', description: 'Operação cresce, túnel não acompanha — tempo de entrega aumenta.' },
        ],
      },
      solution: {
        title: 'Túneis MGR: velocidade e eficiência',
        subtitle: 'Do projeto à operação, entregamos túneis que aumentam sua capacidade produtiva.',
        items: [
          { icon: 'LayoutDashboard', title: 'Dimensionamento técnico', description: 'Estudo de carga térmica e layout integrado à sua linha de produção.' },
          { icon: 'Wind', title: 'Túnel contínuo ou estacionário', description: 'Solução adequada à sua capacidade, produto e espaço físico.' },
          { icon: 'Cpu', title: 'Controle automatizado', description: 'CLP e supervisório para controle preciso de temperatura e tempo.' },
          { icon: 'Leaf', title: 'Fluidos ecológicos', description: 'Projetos com fluidos refrigerantes de baixo impacto ambiental.' },
        ],
      },
      socialProof: {
        title: 'Clientes que aumentaram produção com MGR',
        items: [
          { name: 'Frigorífico Norte Paranaense', testimonial: '"Aumentamos a capacidade de congelamento em 60% com o túnel MGR. Entrega impecável."' },
          { name: 'Processadora Sabor Sul', testimonial: '"Projeto entregue dentro do prazo e com suporte técnico no comissionamento."' },
          { name: 'Exportadora Mar Aberto', testimonial: '"Qualidade certificada para exportação. O túnel MGR foi fundamental."' },
        ],
      },
      bridge: {
        title: 'Tecnologia de ponta, parceria de longo prazo',
        description: 'Cada túnel MGR é projetado para durar décadas com mínima intervenção e máxima eficiência energética.',
        stats: BASE_BRIDGE.stats,
      },
      cta: {
        title: 'Seu próximo túnel começa com uma conversa',
        description: 'Nossa equipe de engenharia visita sua planta, avalia a operação e propõe a melhor solução.',
        buttonText: 'Agendar visita técnica',
        buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
        ...BASE_CONTACT,
      },
    }),
  },

  {
    id: 'projetos-sob-medida',
    name: 'Projetos Sob Medida',
    description: 'LP para projetos industriais customizados de refrigeração.',
    icon: 'Ruler',
    primaryColor: '#1B5E8A',
    accentColor: '#D4792A',
    content: makeContent({
      hero: {
        title: 'Projetos de Refrigeração Industrial do Jeito que Você Precisa',
        subtitle: 'Engenharia personalizada para indústrias que não se encaixam em soluções prontas — câmaras, processos e sistemas completos.',
        backgroundImageUrl: '',
        badgeText: 'Engenharia Personalizada',
        ctaText: 'Falar com engenheiro',
        ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      },
      problem: {
        title: 'Quando a solução padrão não funciona',
        items: [
          { icon: 'AlertCircle', title: 'Layout diferente', description: 'Espaço físico não se adapta às câmaras e sistemas pré-fabricados.' },
          { icon: 'Package', title: 'Produto especial', description: 'Temperatura, umidade ou atmosfera controlada com requisitos únicos.' },
          { icon: 'TrendingUp', title: 'Expansão de planta', description: 'Precisa integrar refrigeração nova ao sistema existente sem parar.' },
          { icon: 'FileText', title: 'Exigência de certificação', description: 'Projeto documentado para auditoria, licenças ou seguro industrial.' },
        ],
      },
      solution: {
        title: 'Metodologia de projetos MGR',
        subtitle: 'Levantamento, engenharia, execução e comissionamento — tudo documentado.',
        items: [
          { icon: 'Search', title: 'Diagnóstico in loco', description: 'Visita técnica para entender o processo, o produto e os requisitos.' },
          { icon: 'FileText', title: 'Memorial descritivo', description: 'Projeto executivo completo com ART e especificação de equipamentos.' },
          { icon: 'Wrench', title: 'Execução própria', description: 'Nossa equipe instala e comissiona, garantindo fidelidade ao projeto.' },
          { icon: 'CheckCircle2', title: 'Entrega documentada', description: 'Manual de operação, AS-BUILT e startup presencial.' },
        ],
      },
      socialProof: {
        title: 'Projetos entregues com excelência',
        items: [
          { name: 'Indústria Farmacêutica Curitibana', testimonial: '"Câmara a -40°C para insumos farmacêuticos. Projeto único no Sul. MGR entregou."' },
          { name: 'Floricultura Exportadora', testimonial: '"Sistema de atmofosfera controlada para exportação. Documentação completa."' },
          { name: 'Cervejaria Artesanal Premium', testimonial: '"Câmara de fermentação a 4°C integrada à linha de produção existente."' },
        ],
      },
      bridge: {
        title: 'Complexidade é nossa especialidade',
        description: 'Os projetos mais difíceis são os que a MGR mais gosta de resolver. Cada desafio vira referência para o próximo cliente.',
        stats: BASE_BRIDGE.stats,
      },
      cta: {
        title: 'Vamos projetar juntos?',
        description: 'Envie seus requisitos e nossa equipe de engenharia entra em contato em até 24h.',
        buttonText: 'Enviar requisitos do projeto',
        buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
        ...BASE_CONTACT,
      },
    }),
  },

  {
    id: 'chillers-industriais',
    name: 'Chillers Industriais',
    description: 'LP para venda, instalação e manutenção de chillers industriais.',
    icon: 'Droplets',
    primaryColor: '#1B5E8A',
    accentColor: '#D4792A',
    content: makeContent({
      hero: {
        title: 'Chillers Industriais com Eficiência e Garantia',
        subtitle: 'Soluções de resfriamento de água para processos industriais, injeção plástica, HVAC e muito mais.',
        backgroundImageUrl: '',
        badgeText: 'Resfriamento de Processo',
        ctaText: 'Especificar meu chiller',
        ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      },
      problem: {
        title: 'Problemas com resfriamento de processo?',
        items: [
          { icon: 'Thermometer', title: 'Processo superaquecendo', description: 'Temperatura fora de controle reduz qualidade e aumenta refugo.' },
          { icon: 'Droplets', title: 'Torre de resfriamento limitada', description: 'Torre não tem capacidade para o crescimento da operação.' },
          { icon: 'Zap', title: 'Energia elétrica cara', description: 'Chiller antigo e ineficiente elevando a conta de energia todo mês.' },
          { icon: 'Settings', title: 'Manutenção frequente', description: 'Equipamento dando problema constantemente, travando a produção.' },
        ],
      },
      solution: {
        title: 'Chillers MGR para cada processo',
        subtitle: 'Selecionamos, instalamos e mantemos o chiller ideal para sua aplicação.',
        items: [
          { icon: 'Cpu', title: 'Seleção técnica', description: 'Sizing correto evita super ou subdimensionamento e otimiza energia.' },
          { icon: 'Wrench', title: 'Instalação completa', description: 'Instalação da unidade, piping, instrumentação e partida supervisionada.' },
          { icon: 'Activity', title: 'Manutenção contratada', description: 'Programa preventivo para máxima disponibilidade do equipamento.' },
          { icon: 'BarChart2', title: 'Retrofit e modernização', description: 'Atualização de chillers antigos para maior eficiência (COP).' },
        ],
      },
      socialProof: {
        title: 'Processos que rodam frios com MGR',
        items: [
          { name: 'Indústria Plástica Paranaense', testimonial: '"Chiller de 150 TR instalado em 2022. Economia de 35% na energia de processo."' },
          { name: 'Metalúrgica Sul Mineira', testimonial: '"MGR especificou e instalou. Processo rodando em temperatura ideal desde o primeiro dia."' },
          { name: 'Cervejaria Regional', testimonial: '"Chiller de propileno para resfriamento do mosto. Projeto limpo e eficiente."' },
        ],
      },
      bridge: {
        title: 'O chiller certo reduz custo e aumenta qualidade',
        description: 'Equipamento bem selecionado e instalado com precisão garante processo estável, menor consumo e maior vida útil.',
        stats: BASE_BRIDGE.stats,
      },
      cta: {
        title: 'Qual é a sua capacidade de resfriamento?',
        description: 'Informe o processo e nossa equipe especifica o chiller ideal com pay-back de energia.',
        buttonText: 'Especificar agora',
        buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
        ...BASE_CONTACT,
      },
    }),
  },

  {
    id: 'mgr-connect-erp',
    name: 'MGR Connect (ERP)',
    description: 'LP para apresentar o sistema MGR Conect 2 para potenciais clientes.',
    icon: 'LayoutDashboard',
    primaryColor: '#0284c7',
    accentColor: '#f59e0b',
    content: makeContent({
      header: {
        tagline: 'MGR Conect 2 — ERP para Refrigeração Industrial',
        phone: BASE_CONTACT.phone,
        whatsapp: BASE_CONTACT.whatsapp,
      },
      hero: {
        title: 'Gerencie sua Empresa de Refrigeração em um Único Sistema',
        subtitle: 'O MGR Conect 2 é o ERP feito para empresas de refrigeração industrial: ordens de serviço, equipe técnica, financeiro e muito mais.',
        backgroundImageUrl: '',
        badgeText: 'Feito para Refrigeração Industrial',
        ctaText: 'Quero uma demonstração',
        ctaLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
      },
      problem: {
        title: 'Esses problemas te custam dinheiro todo dia',
        items: [
          { icon: 'FileX', title: 'OS no papel ou planilha', description: 'Ordens de serviço perdidas, atrasos e falta de rastreabilidade.' },
          { icon: 'MapPin', title: 'Técnico sem rota', description: 'Sem visibilidade em tempo real de onde a equipe está e o que está fazendo.' },
          { icon: 'Clock', title: 'Ponto manual', description: 'Registro de ponto inconsistente, horas extras sem controle.' },
          { icon: 'BarChart2', title: 'Sem dados gerenciais', description: 'Não sabe quais clientes ou serviços são mais lucrativos.' },
        ],
      },
      solution: {
        title: 'MGR Conect 2: tudo integrado',
        subtitle: 'Módulos completos para cada área da sua empresa de refrigeração.',
        items: [
          { icon: 'ClipboardList', title: 'Ordens de Serviço', description: 'Crie, distribua e acompanhe OS com checklist, fotos e assinatura digital.' },
          { icon: 'Users', title: 'Gestão de Equipe', description: 'Ponto biométrico, agenda, ranking de desempenho e comunicados.' },
          { icon: 'DollarSign', title: 'Financeiro', description: 'Orçamentos, faturamento e controle de estoque integrados.' },
          { icon: 'BarChart2', title: 'BI e Inteligência', description: 'Dashboards em tempo real e IA para insights estratégicos.' },
        ],
      },
      socialProof: {
        title: 'Empresas que já transformaram a gestão',
        items: [
          { name: 'TechFrio Serviços', testimonial: '"Reduzimos o tempo de abertura de OS de 15 minutos para menos de 1 minuto."' },
          { name: 'Polar Service', testimonial: '"Controle de ponto biométrico eliminou horas extras não autorizadas."' },
          { name: 'ColdTech Refrigeração', testimonial: '"BI do MGR Conect 2 me mostrou que 20% dos clientes geravam 80% do faturamento."' },
        ],
      },
      bridge: {
        title: 'Tecnologia criada por quem entende o setor',
        description: 'O MGR Conect 2 nasceu dentro de uma empresa de refrigeração. Cada funcionalidade foi desenhada para a realidade do seu dia a dia.',
        stats: [
          { value: '+50', label: 'Módulos integrados' },
          { value: '100%', label: 'Na nuvem' },
          { value: 'iOS/Android', label: 'App do técnico' },
          { value: 'LGPD', label: 'Conformidade total' },
        ],
      },
      cta: {
        title: 'Transforme sua operação hoje',
        description: 'Agende uma demonstração gratuita e veja o MGR Conect 2 em ação.',
        buttonText: 'Agendar demonstração grátis',
        buttonLink: `https://wa.me/${BASE_CONTACT.whatsapp}`,
        ...BASE_CONTACT,
      },
      footer: {
        ...BASE_FOOTER,
        copyright: `© ${new Date().getFullYear()} MGR Soluções em Refrigeração Industrial — MGR Conect 2. Todos os direitos reservados.`,
      },
    }),
  },
];

export const LP_TEMPLATE_MAP: Record<string, LPTemplate> = Object.fromEntries(
  LP_TEMPLATES.map((t) => [t.id, t])
);

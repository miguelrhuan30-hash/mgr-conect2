import { Timestamp } from 'firebase/firestore';

export { Timestamp };

// --- CAMPAIGN CONFIG ---
export interface CampaignConfig {
  name?: string;
  prizeValue: number;
  startDate: Timestamp;
  endDate: Timestamp;
  active: boolean;
}


// --- ACCESS CONTROL & PERMISSIONS ---
export type UserRole = 'admin' | 'gestor' | 'manager' | 'employee' | 'technician' | 'tecnico' | 'pending' | 'developer' | 'intel_viewer' | 'intel_analyst' | 'intel_admin';

export interface PermissionSet {
  // ── Administrative ─────────────────────────────────────────────────────────
  canManageUsers: boolean;       // Create, edit, delete users, change sectors
  canManageSettings: boolean;    // CMS, Landing Page, System Configs
  canManageSectors: boolean;     // Create/Edit Sectors (Roles)
  canViewLogs?: boolean;

  // ── HR & Time Tracking ────────────────────────────────────────────────────
  canRegisterAttendance: boolean;       // Clock in/out
  canViewAttendanceReports: boolean;    // View team reports
  canManageAttendance: boolean;         // Edit entries, close shifts manually
  requiresTimeClock: boolean;           // Block system until check-in

  // ── Ordens de Serviço — module access ─────────────────────────────────────
  canViewTasks: boolean;          // Módulo Tarefas (lista)
  canCreateTasks: boolean;        // Criar nova O.S.
  canEditTasks: boolean;          // Editar O.S. existente
  canDeleteTasks: boolean;        // Excluir O.S.
  canManageProjects: boolean;     // Pipeline + Projetos
  canViewSchedule: boolean;       // Agenda/Gantt (acesso geral)
  canViewFullSchedule: boolean;   // Agenda completa (gerencial)
  canViewMySchedule: boolean;     // Minha agenda (pessoal)
  canViewFinancials: boolean;     // Faturamento & dados financeiros

  // ── Commercial ────────────────────────────────────────────────────────────
  canManageClients: boolean;      // Módulo Clientes + Ativos

  // ── Inventory ─────────────────────────────────────────────────────────────
  canViewInventory: boolean;
  canManageInventory: boolean;

  // ── Ranking & Gamification ────────────────────────────────────────────────
  canViewRanking?: boolean;       // Módulo Ranking da Equipe

  // ── BI / Intelligence ─────────────────────────────────────────────────────
  canViewBI?: boolean;            // BI Dashboard
  canViewIntel?: boolean;         // Inteligência MGR — hub analítico

  // ── Vehicles ──────────────────────────────────────────────────────────────
  canViewVehicles?: boolean;      // Controle de Veículos

  // ── Lunch Management ───────────────────────────────────────────────────────
  canManageLunch?: boolean;       // Gestão de Almoços (cardápio + relatórios)

  // ── People Analytics / Surveys ─────────────────────────────────────────────
  canManageSurveys?: boolean;     // Criar/publicar/ver dashboard de pesquisas
}

export interface Sector {
  id: string;
  name: string; // e.g., "Administrativo", "Técnico de Campo"
  description?: string;
  defaultPermissions: PermissionSet;
  createdAt?: Timestamp;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole; // Legacy role for backward compatibility
  xp: number;
  level: number;
  
  photoURL?: string; // Facial Biometrics Base (Google Auth / System default)
  avatar?: string | null; // Identidade Visual do Colaborador (Custom Upload)
  biometrics?: string; // JSON stringified Float32Array of face descriptor
  
  createdAt: Timestamp;
  
  // New Access Control Fields
  sectorId?: string;
  sectorName?: string; // Denormalized for easier display
  permissions?: Partial<PermissionSet>; // Individual overrides (takes precedence over sector defaults)

  // New HR Fields
  scheduleType?: 'FIXED' | 'FLEXIBLE';
  workSchedule?: {
    // Legacy mapping (fallback)
    startTime?: string;
    lunchDuration?: number;
    endTime?: string;
    // New flexible mapping
    monday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
    tuesday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
    wednesday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
    thursday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
    friday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
    saturday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
    sunday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string };
  };
  allowedLocationIds?: string[]; // IDs of WorkLocations
  
  // Financial Rules
  hourlyRate?: number;
  overtimeRules?: {
    rate50?: number;
    rate100?: number;
  };
  
  // Gamification & Campaign
  accumulatedPrize?: number;
  currentPoints?: number;

  // Sprint 44B — Gamification OS
  xpTotal?: number;           // XP acumulado total
  xpMes?: number;             // XP acumulado no mês corrente
  streakOS?: number;          // Sequência de O.S. no prazo
  lastOSAt?: Timestamp | null; // Data da última O.S. concluída

  // Time Bank (Banco de Horas)
  timeBankBalance?: number; // in minutes (positive = credit)

  // Sprint 48 — Nome completo
  nomeCompleto?: string; // Nome completo do colaborador (auto-preenchido do email se vazio)
}

export interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  active: boolean;
}

export interface Partner {
  id: string;
  name: string;
  logoUrl: string;
}

// --- LANDING PAGE CMS ---
export interface LandingPageContent {
  hero: {
    title: string;
    subtitle: string;
    backgroundImageUrl: string;
    ctaText: string;
    ctaLink: string;
  };
  stats: {
    value: string;
    label: string;
  }[];
  services: {
    title: string;
    items: { 
      title: string; 
      description: string; 
      icon: string; 
    }[];
  };
  clients: {
    title: string;
    description: string;
    partners: Partner[]; 
  };
  about: {
    title: string;
    description: string;
    imageUrl: string;
  };
  contact: {
    address: string;
    phone: string;
    email: string;
    whatsapp: string;
    instagram?: string;
  };
  features: {
    whatsappFloat: boolean;
    contactForm: boolean;
  };
}

// --- BANCO DE HORAS ---
export interface TimeBankEntry {
  id: string;
  userId: string;
  type: 'credit' | 'debit';   // credit = horas enviadas; debit = compensação usada
  minutes: number;
  reason: string;
  referenceMonth?: string;    // YYYY-MM
  createdBy: string;          // UID do gestor
  createdAt: Timestamp;
}

// --- INTELLIGENCE MODULE ---
export type IntelTipo = 'acao' | 'fraqueza' | 'oportunidade' | 'processo' | 'meta' | 'alerta';
export type IntelDestino = 'eisenhower' | 'ishikawa' | 'canvas' | 'bpmn' | 'roadmap';
export type IntelArea = 'comercial' | 'financeiro' | 'operacional' | 'rh' | 'processos' | 'geral';
export type IntelSentimento = 'alerta' | 'oportunidade' | 'neutra';
export type IntelUrgencia = 'critica' | 'alta' | 'media' | 'baixa';

// Sprint 25 — item extraído de uma nota multi-ferramenta
export interface AcaoHub {
  ferramenta: IntelDestino;
  campo_especifico: 'proposta_valor' | 'causa_raiz' | 'tarefa' | 'processo' | 'etapa' | 'fraqueza' | 'oportunidade';
  conteudo: string;    // texto extraído literal da nota (max 120 chars)
  urgencia: IntelUrgencia;
  contexto?: string;   // explicação do motivo do roteamento
  applied?: boolean;   // true quando já foi gravado no Firestore
  hub_doc_id?: string; // ID do documento criado
}

export interface IntelAnalysis {
  // Campos principais obrigatórios (Sprint 21)
  tipo: IntelTipo;
  destino: IntelDestino;
  area: IntelArea;
  urgencia: IntelUrgencia;
  sentimento: IntelSentimento;
  resumo: string;         // até 80 chars
  acao_sugerida: string;  // até 90 chars
  tags: string[];         // até 3 tags

  // Payloads de destino — todos preenchidos pelo Gemini
  eisenhower: {
    quadrante: 'do' | 'plan' | 'dele' | 'elim';
    titulo: string;
    responsavel: string;
    prazo: string;
  };
  ishikawa: {
    categoria: 'Pessoas' | 'Processos' | 'Comunicação' | 'Ferramentas' | 'Gestão' | 'Cultura';
    causa: string;
  };
  canvas: {
    celula: 'parceiros' | 'atividades' | 'recursos' | 'proposta' | 'relacionamento' | 'canais' | 'clientes' | 'custos' | 'receitas';
    conteudo: string;
  };
  bpmn: {
    processo: 'atendimento-comercial' | 'execucao-projetos' | 'compra-materiais' | 'manutencao-preventiva' | 'handoff-comercial' | 'novo';
    task: string;
    novo_processo?: string;
  };
  roadmap: {
    fase: 1 | 2 | 3;
    titulo: string;
    responsavel: string;
    prazo: string;
  };

  // Sprint 25 — Multi-ferramenta: array de todos os itens encontrados na nota
  acoes_hub?: AcaoHub[];
}

export interface IntelNote {
  id: string;
  userId: string;          // UID de quem criou
  createdBy: string;       // Nome do autor
  text: string;
  analysis?: IntelAnalysis;
  applied?: boolean;
  // Rich sync map: destino → ID do doc criado no Hub
  hub_sync?: Partial<Record<IntelDestino, string>>;
  status?: 'pendente' | 'classificada' | 'aplicada';
  type?: 'insight' | 'alert' | 'metric';
  createdAt: Timestamp;
}

// --- HR & TIME TRACKING ---
export interface TimeEntry {
  id: string;
  userId: string;
  type: 'entry' | 'lunch_start' | 'lunch_end' | 'exit';
  timestamp: Timestamp;
  locationId?: string | null; // Where they clocked in
  locationName?: string | null;
  location?: {
    lat: number;
    lng: number;
  };
  coordinates?: {
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null;
  mapsUrl?: string | null;
  locationVerified?: boolean;
  
  photoEvidenceUrl?: string; // Legacy/System use
  photoUrl?: string; // Identidade Visual do Registro (Foto do Ponto)
  
  isOnTime?: boolean;
  userAgent?: string;
  
  // Audit & Manual Adjustment Fields
  isManual?: boolean;        // True if added by manager
  forcedClose?: boolean;     // True if system/manager closed a forgotten shift
  editedBy?: string;         // UID of the manager who edited
  editedByNome?: string;     // Nome do gestor que editou (Sprint P2)
  editReason?: string;       // "Esquecimento", "Doença", etc.
  editTimestamp?: Timestamp; // When the edit happened
  biometricVerified?: boolean; // True if face recognition was successful

  // Soft Delete (Sprint P2) — preserva auditoria sem perder histórico
  excluido?: boolean;        // true = registro excluído pelo admin
  excluidoPor?: string;      // UID do admin que excluiu
  excluidoPorNome?: string;  // Nome do admin que excluiu
  excluidoEm?: Timestamp;    // Quando foi excluído
}


// --- TASKS & SERVICE ORDERS (O.S.) ---
export type PriorityLevel = 'low' | 'medium' | 'high' | 'critical';
export type EvidenceType = 'NONE' | 'PHOTO' | 'TEXT' | 'BOTH';

export interface ChecklistItem {
  id: string;
  text: string; 
  completed: boolean;
  description?: string;
  evidenceRequired?: EvidenceType;
  evidenceData?: {
    text?: string;
    photoUrl?: string;
  };
}

export interface Task {
  id: string;
  code?: string; // OS-YYYY-NNN
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'cancelled';
  priority: PriorityLevel;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  assignedTo?: string;
  assigneeName?: string;
  assignedUsers?: string[];
  assignedUserNames?: string[];
  startDate?: Timestamp;
  endDate?: Timestamp;
  progress?: number;
  tools?: string[];
  checklist: ChecklistItem[];
  evidenceUrl?: string;
  createdAt: Timestamp;

  // Sprint 30-34 WorkOrder extensions
  workflowStatus?: WorkflowStatus;
  parentOSId?: string;              // Sub-OS: filho de outra O.S.
  assetId?: string;                 // Equipámento specífico do cliente
  geofencing?: {
    lat: number;
    lng: number;
    radius: number;                 // metros (padrão 100)
    validated: boolean;             // true quando técnico fez check-in dentro do raio
  };
  scheduling?: {
    equipeId?: string;
    dataPrevista?: Timestamp;
    tempoEstimado?: number;         // minutos
  };
  execution?: {
    checkIn?: Timestamp;
    checkOut?: Timestamp;
    actualStartTime?: Timestamp;
    actualEndTime?: Timestamp;
    adversidades?: string;
    evidencias?: string[];          // URLs de fotos Antes/Depois
  };
  financial?: {
    metodoPagamento?: string;
    previsaoPagamento?: Timestamp;
    statusPagamento?: 'pendente' | 'confirmado' | 'cancelado';
    valor?: number;
  };
  // Intel integration
  origin?: 'intel_module' | 'manual';
  intelNoteId?: string;
  eisenhowerQuadrante?: 'do' | 'plan' | 'dele' | 'elim';
  tags?: string[];
  notes?: string;
  // Sprint 31/34 — auditoria de fases para SLA
  statusHistory?: { status: WorkflowStatus; changedAt: Timestamp; changedBy?: string }[];

  // ─── Sprint 38-45: Módulo O.S. Completo ─────────────────────────────────
  // Sprint 38 — auditoria de edições
  edicoes?: OSEdicao[];
  // Sprint 39 — fotos por tarefa (estrutura de tarefas expandida)
  tarefasOS?: OSItemTarefa[];
  // Sprint 40 — check-in / check-out geoloc
  checkinOS?: OSCheckin;
  checkoutOS?: OSCheckout;
  // Sprint 41 — O.S. como ponto
  ponto?: OSPontoConfig;
  // Sprint 42 — digitalização documento físico
  documentoFisico?: OSDocumentoFisico;
  atualizacoesViaFoto?: OSAtualizacaoViaFoto[];
  // Sprint 43 — tipo de serviço e ferramentas
  tipoServico?: string;
  ferramentasUtilizadas?: string[];
  // Sprint 44 — ativo e questionário
  ativoId?: string | null;
  ativoNome?: string | null;
  finalizacaoRespostas?: OSFinalizacaoResposta[];
  statusOS?: OSStatusFinal;
  // Sprint 45 — observações
  observacoes?: OSObservacao[];

  // ─── Sprint 47: Unificação O.S. ──────────────────────────────────────────
  // Arquivamento
  archived?: boolean;
  archivedAt?: Timestamp;
  archivedBy?: string;
  // Reagendamento
  reagendamentoMotivo?: string;     // motivo que levou ao reagendamento
  reagendamentoDe?: string;         // ID da O.S. original (nesta é a nova)
  reagendamentoPara?: string;       // ID da nova O.S. criada (nesta é a original)
  // Orçamento vinculado
  orcamentoId?: string;
}

export interface ClientContact {
  id: string;
  nome: string;
  cargo: 'decisor' | 'financeiro' | 'operacional' | 'outro';
  phone?: string;
  email?: string;
  whatsapp?: string;
}

export interface Client {
  id: string;
  name: string;
  // Legacy
  contactName?: string;
  phone?: string;
  address?: string;
  document?: string;            // CNPJ ou CPF
  createdAt: Timestamp;
  // Sprint 30 additions
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
  email?: string;
  whatsapp?: string;
  website?: string;
  segment?: string;             // ex: Supermercado, Indústria
  geo?: {
    lat: number;
    lng: number;
    formattedAddress?: string;
  };
  // Sprint 40 — geolocalização para check-in de O.S.
  geolocalizacao?: {
    latitude: number;
    longitude: number;
    raioMetros: number;          // default 200
    enderecoReferencia?: string;
  };
  contacts?: ClientContact[];   // múltiplos contactos por papél
  createdBy?: string;
  updatedAt?: Timestamp;
}

export interface ClientAsset {
  id: string;
  clientId: string;
  nome: string;                 // ex: "Câmara Fria Walk-in #1"
  tipo: string;                 // ex: "Câmara Fria" | "Split" | "Chiller"
  fotos?: string[];             // URLs de fotos/plaquetas
  especificacoes?: {
    marca?: string;
    modelo?: string;
    capacidadeBTU?: number;
    potenciaKW?: number;
    refrigerante?: string;
    anoFabricacao?: number;
    numeroSerie?: string;
    [key: string]: any;
  };
  dataInstalacao?: Timestamp;
  historicoOS?: string[];       // array de Task IDs
  status?: 'ativo' | 'inativo' | 'manutencao';
  localizacao?: string;         // ex: "Sala B2, 2º andar"
  createdAt: Timestamp;
}

export interface Project {
  id: string;
  name: string;
  clientId: string;
  status: 'active' | 'completed';
}

// ─── Sprint 47: Projeto Completo ─────────────────────────────────────────────
export type ProjectStatus = 'planejamento' | 'em_andamento' | 'concluido' | 'cancelado';

export interface ProjectFull {
  id: string;
  nome: string;
  descricao?: string;
  clientId: string;
  clientName: string;
  status: ProjectStatus;
  dataInicio?: Timestamp;
  dataPrevista?: Timestamp;
  osIds: string[];                  // IDs de todas as O.S. vinculadas
  totalOSPrevistas?: number;
  totalOSConcluidas?: number;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  nome: string;
  tipo: 'pdf' | 'imagem' | 'outro';
  url: string;                      // URL Firebase Storage
  tamanhoBytes?: number;
  uploadPor: string;
  uploadPorNome: string;
  uploadEm: Timestamp;
}

// ─── Sprint 47: Orçamento ────────────────────────────────────────────────────
export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado';

export interface OrcamentoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;               // quantidade * valorUnitario
}

export interface Orcamento {
  id: string;
  taskId?: string;                  // O.S. vinculada (opcional)
  taskCode?: string;
  clientId: string;
  clientName: string;
  titulo: string;
  descricao?: string;
  itens: OrcamentoItem[];
  valorTotal: number;
  status: OrcamentoStatus;
  validoAte?: Timestamp;
  observacoes?: string;
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: Timestamp;
  atualizadoEm?: Timestamp;
  aprovadoPor?: string;
  aprovadoPorNome?: string;
  aprovadoEm?: Timestamp;
  rejeitadoPor?: string;
  rejeitadoMotivo?: string;
  rejeitadoEm?: Timestamp;
}

// Motivos pré-definidos para reagendamento de O.S.
export const REAGENDAMENTO_MOTIVOS = [
  'Falta de ferramentas',
  'Problema diferente do inicial',
  'Falta de peças para manutenção',
  'Falta de tempo total para execução da tarefa',
  'Adversidades do cliente impossibilitou execução da O.S.',
  'Outro',
] as const;

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  tools: string[];
  checklist: {
    id: string;
    title: string;
    description?: string;
    evidenceRequired: EvidenceType;
  }[];
  createdAt?: Timestamp;
}

// --- BPMN / PROCESS DOCUMENTATION (Sprint 26) ---
export type BpmnProcessoId =
  | 'atendimento-comercial'
  | 'execucao-projetos'
  | 'compra-materiais'
  | 'manutencao-preventiva'
  | 'handoff-comercial'
  | 'custom';

export interface ManualStep {
  id: string;
  processoId: BpmnProcessoId | string;   // FK for the process
  ordem: number;                         // step order (1-based)
  titulo: string;                        // e.g. "Verificar pressu00e3o da viu00e1lvula"
  descricao?: string;                    // optional detail
  tipo: 'procedure' | 'requirement' | 'warning' | 'note';
  // Audit
  origin: 'manual' | 'intel_module';    // who added this step
  intelNoteId?: string;                  // set when origin = intel_module
  createdBy: string;                     // uid
  createdByName: string;
  createdAt: Timestamp;
}

export interface ProcessRequirement {
  id: string;
  processoId: BpmnProcessoId | string;
  titulo: string;                        // e.g. "Equipe deve ter NR-10"
  categoria: 'tecnico' | 'seguranca' | 'equipamento' | 'normativa' | 'outro';
  obrigatorio: boolean;
  // Audit
  origin: 'manual' | 'intel_module';
  intelNoteId?: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
}

export interface BpmnProcess {
  id: string;
  processoId: BpmnProcessoId | string;  // slug
  nome: string;                          // display name
  descricao?: string;
  area: 'comercial' | 'operacional' | 'financeiro' | 'rh' | 'geral';
  steps: ManualStep[];                   // ordered list
  requisitos: ProcessRequirement[];      // requirements list
  // SOP generation
  sop?: string;                          // last generated SOP (markdown)
  sopGeneratedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// --- SPRINT 30-34: WORKFLOW & FINANCIAL TYPES ---

export enum WorkflowStatus {
  TRIAGEM                 = 'TRIAGEM',
  PRE_ORCAMENTO          = 'PRE_ORCAMENTO',
  VISITA_TECNICA         = 'VISITA_TECNICA',
  ORCAMENTO_FINAL        = 'ORCAMENTO_FINAL',
  AGUARDANDO_APROVACAO   = 'AGUARDANDO_APROVACAO',
  AGENDADO               = 'AGENDADO',
  EM_EXECUCAO            = 'EM_EXECUCAO',
  AGUARDANDO_FATURAMENTO = 'AGUARDANDO_FATURAMENTO',
  AGUARDANDO_PAGAMENTO   = 'AGUARDANDO_PAGAMENTO',
  CONCLUIDO              = 'CONCLUIDO',
}

export const WORKFLOW_ORDER: WorkflowStatus[] = [
  WorkflowStatus.TRIAGEM,
  WorkflowStatus.PRE_ORCAMENTO,
  WorkflowStatus.VISITA_TECNICA,
  WorkflowStatus.ORCAMENTO_FINAL,
  WorkflowStatus.AGUARDANDO_APROVACAO,
  WorkflowStatus.AGENDADO,
  WorkflowStatus.EM_EXECUCAO,
  WorkflowStatus.AGUARDANDO_FATURAMENTO,
  WorkflowStatus.AGUARDANDO_PAGAMENTO,
  WorkflowStatus.CONCLUIDO,
];

export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.TRIAGEM]:                 'Triagem',
  [WorkflowStatus.PRE_ORCAMENTO]:           'Pré-Orçamento',
  [WorkflowStatus.VISITA_TECNICA]:          'Visita Técnica',
  [WorkflowStatus.ORCAMENTO_FINAL]:         'Orçamento Final',
  [WorkflowStatus.AGUARDANDO_APROVACAO]:    'Aguardando Aprovação',
  [WorkflowStatus.AGENDADO]:                'Agendado',
  [WorkflowStatus.EM_EXECUCAO]:             'Em Execução',
  [WorkflowStatus.AGUARDANDO_FATURAMENTO]:  'Aguardando Faturamento',
  [WorkflowStatus.AGUARDANDO_PAGAMENTO]:    'Aguardando Pagamento',
  [WorkflowStatus.CONCLUIDO]:               'Concluído',
};

export const WORKFLOW_COLORS: Record<WorkflowStatus, string> = {
  [WorkflowStatus.TRIAGEM]:                 'bg-gray-50 border-gray-200 text-gray-700',
  [WorkflowStatus.PRE_ORCAMENTO]:           'bg-blue-50 border-blue-200 text-blue-700',
  [WorkflowStatus.VISITA_TECNICA]:          'bg-indigo-50 border-indigo-200 text-indigo-700',
  [WorkflowStatus.ORCAMENTO_FINAL]:         'bg-purple-50 border-purple-200 text-purple-700',
  [WorkflowStatus.AGUARDANDO_APROVACAO]:    'bg-amber-50 border-amber-200 text-amber-700',
  [WorkflowStatus.AGENDADO]:                'bg-sky-50 border-sky-200 text-sky-700',
  [WorkflowStatus.EM_EXECUCAO]:             'bg-orange-50 border-orange-200 text-orange-700',
  [WorkflowStatus.AGUARDANDO_FATURAMENTO]:  'bg-pink-50 border-pink-200 text-pink-700',
  [WorkflowStatus.AGUARDANDO_PAGAMENTO]:    'bg-red-50 border-red-200 text-red-700',
  [WorkflowStatus.CONCLUIDO]:               'bg-emerald-50 border-emerald-200 text-emerald-700',
};

// Receivable — created when O.S. moves to AGUARDANDO_FATURAMENTO
export interface Receivable {
  id: string;
  taskId: string;
  taskCode?: string;
  clientId: string;
  clientName: string;
  assigneeName?: string;
  valor?: number;
  metodoPagamento?: string;
  previsaoPagamento?: Timestamp;
  status: 'pendente' | 'confirmado' | 'cancelado';
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  createdAt: Timestamp;
  createdBy: string;
  notes?: string;
  observacoes?: string;
}

// ─── Sprint Analytics ────────────────────────────────────────────────────────
export type ClientStatus = 'novo' | 'ativo' | 'inativo' | 'reativado';
// MetaField, MgrEvent, EventType, EventArea — importar de '../utils/mgr-analytics'

// VehicleCheck — abertura de veículo após check-in
export interface VehicleCheck {
  id: string;
  userId: string;
  userName: string;
  userSector?: string;
  placa: string;           // AAA-0000 ou AAA0A00 (Mercosul)
  kmInicial: number;
  timestamp: Timestamp;
  fotos: Record<string, string>; // dinâmico — slots configurad pelo admin
  timeEntryId?: string;    // vínculo com time_entry do ponto
}

// ─── Sprint 38-45: Tipos auxiliares da O.S. ─────────────────────────────────

export interface OSEdicao {
  campo: string;
  valorAnterior?: any;
  valorNovo?: any;
  editadoPor: string;           // uid
  editadoPorNome: string;
  editadoEm: Timestamp;
  viaDados: 'sistema' | 'foto_digitalizada';
}

export interface OSFotoSlot {
  key: string;
  label: string;
  descricao: string;
  required: boolean;
  order: number;
  active: boolean;
}

export interface OSFotoRegistro {
  url: string;
  uploadEm: Timestamp;
  uploadPor: string;
  descricaoGestor: string;
  comentarioTecnico?: string;
}

export interface OSItemTarefa {
  id: string;
  descricao: string;
  status: 'pendente' | 'em_andamento' | 'concluida';
  iniciadaEm?: Timestamp | null;
  concluidaEm?: Timestamp | null;
  tempoDuracaoMinutos?: number;
  executorId?: string;
  fotos?: Record<string, OSFotoRegistro>;
  // Sprint 46 — configuração de slots de fotos por tarefa
  fotoSlots?: FotoSlotConfig[];      // slots configurados pelo gestor
  fotosEvidencia?: FotoEvidencia[];  // fotos tiradas pelo técnico
}

export interface OSCheckin {
  feito: boolean;
  timestamp?: Timestamp;
  gpsCoords?: { lat: number; lng: number; accuracy?: number | null };
  distanciaMetros?: number;
  userId?: string;
  manual?: boolean;             // bypass admin/gestor
}

export interface OSCheckout {
  feito: boolean;
  timestamp?: Timestamp;
  gpsCoords?: { lat: number; lng: number; accuracy?: number | null };
  userId?: string;
}

export interface OSPontoConfig {
  permiteEntrada: boolean;
  permiteSaida: boolean;
  raioMetros?: number;
}

export interface OSDocumentoFisico {
  fotoUrl: string;
  uploadEm: Timestamp;
  uploadPor: string;
  analisadoPorIA: boolean;
  analiseResultado?: string | null;
  temAssinatura?: boolean;
}

export interface OSAtualizacaoViaFoto {
  campo: string;
  valorIdentificado: string;
  confianca: 'alta' | 'media' | 'baixa';
  aplicadoNaOS: boolean;
  revisadoPorGestor: boolean;
  timestamp: Timestamp;
}

export interface OSObservacao {
  id: string;
  texto: string;
  autorId: string;
  autorNome: string;
  autorRole: string;
  criadaEm: Timestamp;
  editada?: boolean;
  editadaEm?: Timestamp | null;
}

export interface OSFinalizacaoResposta {
  perguntaId: string;
  perguntaTexto: string;
  resposta: string | boolean;
  timestamp: Timestamp;
}

export type OSStatusFinal =
  | 'concluida'
  | 'reagendar'
  | 'pendente_administrativo'
  | 'em_revisao_tecnica'
  | 'concluida_nova_os_sugerida';

export interface OSKpiEntry {
  descricaoTarefa: string;
  tipoServico?: string;
  tempoDuracaoMinutos: number;
  osId: string;
  tecnicoId: string;
  data: Timestamp;
}

// --- COLLECTIONS ---
export enum CollectionName {
  TASKS = 'tasks',
  USERS = 'users',
  SECTORS = 'sectors',
  TIME_ENTRIES = 'time_entries',
  PROJECTS = 'projects',
  WORK_LOCATIONS = 'work_locations',
  CLIENTS = 'clients',
  TASK_TEMPLATES = 'task_templates',
  SYSTEM_SETTINGS = 'system_settings',
  CONTACT_MESSAGES = 'contact_messages',
  SYSTEM_LOGS = 'system_logs',
  TIME_BANK = 'time_bank',
  NOTAS_INTEL = 'notas_intel',
  INTEL_CONFIG = 'intel_config',
  EISENHOWER = 'hub_eisenhower',
  ISHIKAWA = 'hub_ishikawa',
  CANVAS = 'hub_canvas',
  ROADMAP = 'hub_roadmap',
  PROCESSOS = 'hub_processos',
  MANUAL_STEPS = 'hub_manual_steps',
  REQUIREMENTS = 'hub_requirements',
  // Sprint 30-34
  ASSETS = 'client_assets',
  RECEIVABLES = 'receivables',
  // Sprint Veículos
  VEHICLE_CHECKS = 'vehicle_checks',
  // Sprint Analytics
  MGR_EVENTS = 'mgr_events',
  // Sprint 38-45 — Módulo O.S. Completo
  OS_TASK_PHOTO_CONFIG = 'os_task_photo_config',
  SERVICE_TYPES = 'service_types',
  TOOLS_CATALOG = 'tools_catalog',
  TASK_KPIS = 'task_kpis',
  ORDENS_SERVICO = 'tasks',     // alias (O.S. usa a mesma coleção 'tasks')
  // Sprint 46A — Suporte Primário
  OS_SUPORTE_MSGS = 'os_suporte_msgs',
  // Sprint 46 — Fotos anotadas
  OS_FOTO_SLOTS = 'os_foto_slots',
  // Sprint 47 — Projetos & Orçamentos
  OS_PROJECTS = 'os_projects',
  PROJECT_DOCS = 'project_documents',
  OS_ORCAMENTOS = 'os_orcamentos',
  // Sprint 48 — RH: Documentos & Ocorrências
  EMPLOYEE_DOCS = 'employee_docs',
  EMPLOYEE_OCCURRENCES = 'employee_occurrences',
  // Sprint 49 — Módulo Meu Almoço
  LUNCH_MENUS = 'lunch_menus',
  LUNCH_CHOICES = 'lunch_choices',
  LUNCH_LOCATIONS = 'lunch_locations',
  LUNCH_CONFIG = 'lunch_config',
  // Sprint 50 — Módulo People Analytics
  SURVEYS = 'surveys',
  SURVEY_RESPONSES = 'survey_responses',
  SURVEY_PARTICIPATION = 'survey_participation',
  SURVEY_TEMPLATES = 'survey_templates',
}

// ─── Sprint 46A: Suporte Primário — Chat in-OS ──────────────────────────────
export interface OSSuporteMsg {
  id: string;
  osId: string;
  osCode?: string;
  tipoServico?: string;
  texto: string;
  autorId: string;
  autorNome: string;
  autorRole: 'technician' | 'manager' | 'admin' | 'ia';
  criadaEm: Timestamp;
  leitoPorGestor: boolean;
  leitoPorTecnico: boolean;
  isIASugestao?: boolean;
  solicitouHumano?: boolean;
  fotosURLs?: string[];
  audioURL?: string;
}

// ─── Sprint 46: Fotos de Evidência por Tarefa com Anotações ─────────────────

/** Slot de foto configurado pelo Gestor ao criar/editar a tarefa */
export interface FotoSlotConfig {
  id: string;
  titulo: string;        // ex: "Foto Antes", "Painel elétrico aberto"
  instrucao: string;     // instrução para o técnico
  obrigatoria: boolean;
  ordem: number;
}

/** Anotação individual (círculo ou seta) adicionada pelo técnico */
export interface FotoAnotacao {
  id: string;
  tipo: 'circulo' | 'seta';
  x: number;             // posição % da largura da imagem [0-100]
  y: number;             // posição % da altura da imagem [0-100]
  raio?: number;         // para círculo — % da largura [0-100]
  dx?: number;           // vetor seta X — % da largura
  dy?: number;           // vetor seta Y — % da altura
  cor: string;           // cor hex, ex: '#22c55e'
  descricao: string;     // legenda do técnico
}

/** Foto de evidência salva pelo técnico com anotações */
export interface FotoEvidencia {
  id: string;
  slotId: string;                // referência ao FotoSlotConfig.id
  slotTitulo: string;            // título do slot (desnormalizado)
  url: string;                   // URL da imagem no Storage
  descricaoGeral?: string;       // descrição geral do técnico
  anotacoes: FotoAnotacao[];     // círculos e setas
  tiradaPor: string;             // uid do técnico
  tiradaEm: Timestamp;
}

// ─── Sprint 48: Documentos e Ocorrências de Funcionário ──────────────────────

export type OccurrenceType =
  | 'falta_justificada'
  | 'falta_injustificada'
  | 'atestado'
  | 'suspensao'
  | 'folga'
  | 'ferias'
  | 'outro';

export const OCCURRENCE_LABELS: Record<OccurrenceType, string> = {
  falta_justificada: 'Falta Justificada',
  falta_injustificada: 'Falta Injustificada',
  atestado: 'Atestado',
  suspensao: 'Suspensão',
  folga: 'Folga',
  ferias: 'Férias',
  outro: 'Outro',
};

export const OCCURRENCE_COLORS: Record<OccurrenceType, string> = {
  falta_justificada: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  falta_injustificada: 'bg-red-100 text-red-700 border-red-200',
  atestado: 'bg-orange-100 text-orange-700 border-orange-200',
  suspensao: 'bg-purple-100 text-purple-700 border-purple-200',
  folga: 'bg-green-100 text-green-700 border-green-200',
  ferias: 'bg-blue-100 text-blue-700 border-blue-200',
  outro: 'bg-gray-100 text-gray-600 border-gray-200',
};

export interface EmployeeDocument {
  id: string;
  userId: string;
  nome: string;
  tipo: 'documento' | 'atestado' | 'contrato' | 'outro';
  pasta: string;             // "Documentos", "Atestados", "Contratos"
  subpasta?: string;         // "RG", "CNH"
  url: string;
  tamanhoBytes: number;
  uploadPor: string;
  uploadEm: Timestamp;
}

export interface EmployeeOccurrence {
  id: string;
  userId: string;
  data: string;              // "2026-03-19" (ISO date)
  tipo: OccurrenceType;
  descricao?: string;
  arquivoUrl?: string;       // URL do atestado/imagem
  arquivoNome?: string;
  criadoPor: string;
  criadoEm: Timestamp;
  atualizadoEm?: Timestamp;
}

// ─── Sprint 49: Módulo Meu Almoço ───────────────────────────────────────────

export interface LunchConfig {
  id: string;
  sedeNome: string;            // "Sede MGR"
  sedeEndereco: string;        // "Rua Exemplo, 123, Centro, Cidade"
  horarioLimite?: string;      // "10:00" — horário limite para informar localização
  atualizadoPor?: string;
  atualizadoEm?: Timestamp;
}

export interface LunchDish {
  id: string;
  nome: string;                // "Frango Grelhado com Legumes"
  descricao?: string;          // "Acompanha arroz e salada"
  ordem: number;
  categoria: 'mistura' | 'guarnicao'; // 'mistura' = proteína principal; 'guarnicao' = acompanhamento
}

export interface LunchMenu {
  id: string;
  weekStart: string;           // "2026-03-23" (segunda-feira ISO)
  weekEnd: string;             // "2026-03-27" (sexta-feira ISO)
  status: 'rascunho' | 'ativo' | 'encerrado';
  pratos: LunchDish[];
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: Timestamp;
  atualizadoEm?: Timestamp;
}

/** Seleção diária de misturas e guarnições (até 2 de cada) */
export type MarmitaSize = 'pequena' | 'media' | 'grande';

export interface LunchDayChoice {
  misturas: { id: string; nome: string }[];    // até 2 misturas
  guarnicoes: { id: string; nome: string }[];  // até 2 guarnições
  tamanho?: MarmitaSize;                       // tamanho da marmita
}

export interface LunchChoice {
  id: string;
  menuId: string;              // FK → lunch_menus
  userId: string;
  userName: string;
  userSector?: string;
  escolhas: {
    segunda?: LunchDayChoice | null;
    terca?: LunchDayChoice | null;
    quarta?: LunchDayChoice | null;
    quinta?: LunchDayChoice | null;
    sexta?: LunchDayChoice | null;
  };
  enviadoEm: Timestamp;
}

export type LunchLocationType = 'sede' | 'campo' | 'fora_cidade';

export interface LunchLocation {
  id: string;
  userId: string;
  userName: string;
  data: string;                // "2026-03-24" (ISO date)
  tipo: LunchLocationType;
  endereco?: string;
  clienteNome?: string;
  coordenadas?: {
    lat: number;
    lng: number;
  };
  informadoEm: Timestamp;
  menuId: string;              // FK → lunch_menus
}


// ─────────────────────────────────────────────────────────────────────────────
// Sprint 50 — Módulo People Analytics / Pesquisas Internas
// ─────────────────────────────────────────────────────────────────────────────

export type SurveyQuestionType =
  | 'escala_0_10'         // Slider 0–10 → média numérica
  | 'multipla_ordenada'   // Opções pior→melhor → % favorável
  | 'multipla_categorica' // Opções sem ordem → distribuição %
  | 'satisfacao'          // Muito Insatisfeito→Muito Satisfeito → % satisfeito
  | 'dificuldade_1_5'     // 1 Muito Difícil’5 Muito Fácil → Índice Fricção
  | 'campo_livre'         // Caixa de texto livre → Mural qualitativo
  | 'enps';               // Escala 0–10 com motor Detrator/Neutro/Promotor

export type SurveyKpiType =
  | 'media_numerica'
  | 'percentual_favoravel'
  | 'distribuicao_categorica'
  | 'taxa_satisfacao'
  | 'indice_friccao'
  | 'mural_qualitativo'
  | 'enps_score'
  | 'delta_melhoria_antes'
  | 'delta_melhoria_depois';

export type SurveyType = 'pulso' | 'transicao' | 'inovacao';
export type SurveyStatus = 'rascunho' | 'ativo' | 'encerrado';

export interface SurveyQuestion {
  id: string;
  texto: string;
  tipo: SurveyQuestionType;
  kpiTipo: SurveyKpiType;
  opcoes?: string[];          // Para multipla_ordenada / multipla_categorica / satisfacao / dificuldade_1_5
  obrigatorio: boolean;
  ordem: number;
  permitirOutro?: boolean;    // Mostrar campo 'Outro (descreva)'
}

export interface Survey {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: SurveyType;
  status: SurveyStatus;
  perguntas: SurveyQuestion[];
  criadoPor: string;          // userId do admin
  criadoEm: Timestamp;
  encerradoEm?: Timestamp;
  totalRespostas?: number;    // calculado
  templateId?: string;        // FK → survey_templates (se criada a partir de modelo)
  edicao?: number;            // edição/rodada contínua (1, 2, 3...)
}

/** Uma única resposta anônima (sem userId) */
export interface SurveyResponse {
  id: string;
  surveyId: string;
  respostas: Record<string, string | number | string[]>; // questionId → valor
  respondidoEm: Timestamp;
  // userId intencionalmente AUSENTE — anonimato absoluto
}

/** Flag de participação — só registra SE já respondeu, sem vincular ao conteúdo */
export interface SurveyParticipation {
  id: string;
  userId: string;
  surveyId: string;
  respondeuEm: Timestamp;
}

/** Modelo de Pesquisa reutilizável — define a estrutura padrão de perguntas */
export interface SurveyTemplate {
  id: string;
  nome: string;                 // Ex: 'Pesquisa de Transição'
  descricao: string;
  tipo: SurveyType;
  perguntas: SurveyQuestion[];  // perguntas padrão do modelo
  criadoPor: string;
  criadoEm: Timestamp;
  builtIn?: boolean;            // true = modelo pré-cadastrado pelo sistema
}

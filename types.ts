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
export type UserRole = 'admin' | 'manager' | 'employee' | 'technician' | 'pending' | 'developer' | 'intel_viewer' | 'intel_analyst' | 'intel_admin';

export interface PermissionSet {
  // Administrative
  canManageUsers: boolean;      // Create, edit, delete users, change sectors
  canManageSettings: boolean;   // CMS, Landing Page, System Configs
  canManageSectors: boolean;    // Create/Edit Sectors (Roles)
  canViewLogs?: boolean;

  // Operational (Tasks/OS)
  canViewTasks: boolean;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  canViewSchedule: boolean;     // Legacy: View Gantt Chart/Schedule (General Access)
  canViewFullSchedule: boolean; // NEW: View ALL schedules
  canViewMySchedule: boolean;   // NEW: View ONLY own schedule

  // Commercial
  canManageClients: boolean;
  canManageProjects: boolean;

  // Inventory
  canViewInventory: boolean;
  canManageInventory: boolean;

  // HR & Time Tracking
  canRegisterAttendance: boolean;       // Clock in/out
  canViewAttendanceReports: boolean;    // View team reports
  canManageAttendance: boolean;         // Edit entries, close shifts manually
  requiresTimeClock: boolean;           // If true, system access is blocked until user clocks in

  // Financial
  canViewFinancials?: boolean;
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

  // Time Bank (Banco de Horas)
  timeBankBalance?: number; // in minutes (positive = credit)
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
  editReason?: string;       // "Esquecimento", "Doença", etc.
  editTimestamp?: Timestamp; // When the edit happened
  biometricVerified?: boolean; // True if face recognition was successful
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
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
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
  valor?: number;
  metodoPagamento?: string;
  previsaoPagamento?: Timestamp;
  status: 'pendente' | 'confirmado' | 'cancelado';
  confirmedAt?: Timestamp;
  confirmedBy?: string;
  createdAt: Timestamp;
  createdBy: string;
  notes?: string;
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
}

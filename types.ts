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
    dailyWorkMinutes?: number;   // Horas líquidas esperadas (ex: 540 = 9h). Sobrepõe cálculo de start/end/lunch.
    // New flexible mapping
    monday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
    tuesday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
    wednesday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
    thursday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
    friday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
    saturday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
    sunday?: { active: boolean; startTime: string; lunchDuration: number; endTime: string; dailyWorkMinutes?: number };
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
  clientId?: string;    // ID do cliente vinculado
  clientName?: string;  // Nome do cliente vinculado (denormalized)
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

// ─── Sprint Emergencial: Diagnóstico de Erro Estruturado ─────────────────────
// Equivalente ao que aparece no console/DevTools do navegador
export interface ErrorDetail {
  name: string;           // ex: 'NotAllowedError', 'GeolocationPositionError'
  message: string;        // mensagem human-readable do erro
  code?: number;          // GPS: 1=PERMISSION_DENIED 2=POSITION_UNAVAILABLE 3=TIMEOUT
  stack?: string;         // primeiras 300 chars do stack trace
  deviceContext?: {
    connection?: string;  // 'wifi' | '4g' | '3g' | '2g' | 'slow-2g'
    screenW?: number;     // resolução horizontal da tela
    screenH?: number;     // resolução vertical da tela
    platform?: string;    // 'iPhone', 'Linux armv8l', 'Win32', etc.
  };
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

  // ─── Sprint Emergencial — Registro Resiliente ───────────────────────────────
  // Qualidade geral do registro
  registrationQuality?: 'ok' | 'partial' | 'emergency';
  // 'ok'        → foto + GPS funcionaram normalmente
  // 'partial'   → um dos dois falhou (mas o outro OK)
  // 'emergency' → ambos falharam; só horário garantido (revisão manual necessária)

  // Diagnóstico de câmera
  photoStatus?: 'ok' | 'unavailable' | 'camera_error';
  photoErrorDetail?: ErrorDetail | null; // objeto estruturado com name/code/stack/device

  // Diagnóstico de GPS
  gpsStatus?: 'ok' | 'best_effort' | 'unavailable';
  gpsErrorDetail?: ErrorDetail | null;   // objeto estruturado com name/code/stack/device
  gpsBestEffortCoords?: {                // coords do fallback (quando gpsStatus = 'best_effort')
    lat: number;
    lng: number;
    accuracy: number;
    ageMs: number;                       // ms desde quando foi capturada
  } | null;

  // Diagnóstico de perímetro
  perimeterStatus?: 'verified' | 'skipped_gps_fail' | 'skipped_admin' | 'outside_warning';
  // 'verified'        → dentro do perímetro autorizado
  // 'skipped_gps_fail'→ GPS falhou, perímetro não verificado (não bloqueante)
  // 'skipped_admin'   → admin global, sem restrição de perímetro
  // 'outside_warning' → fora do perímetro mas registro liberado (modo emergencial)

  // Status de pós-processamento biométrico
  processingStatus?: 'pending' | 'done' | 'failed' | 'skipped_no_photo';
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

  // Sprint 51 — PDF Upload + Link Público
  pdfUrl?: string;                  // URL pública do PDF no Firebase Storage
  pdfNome?: string;                 // Nome original do arquivo PDF
  pdfTamanhoBytes?: number;         // Tamanho do arquivo em bytes
  pdfUploadEm?: Timestamp;          // Data do upload
  linkPublicoAtivo?: boolean;       // Se o link público está habilitado
  linkPublicoViews?: number;        // Contador de visualizações via link público
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
// ═══════════════════════════════════════════════════
// SISTEMA DINÂMICO DE COLEÇÕES — Staging / Produção
// ═══════════════════════════════════════════════════
// Em produção (VITE_APP_ENV=production ou vazio): nomes normais (ex: "users")
// Em staging  (VITE_APP_ENV=staging): prefixo automático (ex: "dev_users")
// NENHUM componente precisa ser alterado — o prefixo é injetado aqui!

const _ENV_PREFIX = (import.meta.env.VITE_APP_ENV === 'staging') ? 'dev_' : '';

function _col(name: string): string {
  return `${_ENV_PREFIX}${name}`;
}

// Nomes-base das coleções (sem prefixo)
const _BASE_COLLECTIONS = {
  TASKS: 'tasks',
  USERS: 'users',
  SECTORS: 'sectors',
  TIME_ENTRIES: 'time_entries',
  PROJECTS: 'projects',
  WORK_LOCATIONS: 'work_locations',
  CLIENTS: 'clients',
  TASK_TEMPLATES: 'task_templates',
  SYSTEM_SETTINGS: 'system_settings',
  CONTACT_MESSAGES: 'contact_messages',
  SYSTEM_LOGS: 'system_logs',
  TIME_BANK: 'time_bank',
  NOTAS_INTEL: 'notas_intel',
  INTEL_CONFIG: 'intel_config',
  EISENHOWER: 'hub_eisenhower',
  ISHIKAWA: 'hub_ishikawa',
  CANVAS: 'hub_canvas',
  ROADMAP: 'hub_roadmap',
  PROCESSOS: 'hub_processos',
  MANUAL_STEPS: 'hub_manual_steps',
  REQUIREMENTS: 'hub_requirements',
  // Sprint 30-34
  ASSETS: 'client_assets',
  RECEIVABLES: 'receivables',
  // Sprint Veículos
  VEHICLE_CHECKS: 'vehicle_checks',
  // Sprint Analytics
  MGR_EVENTS: 'mgr_events',
  // Sprint 38-45 — Módulo O.S. Completo
  OS_TASK_PHOTO_CONFIG: 'os_task_photo_config',
  SERVICE_TYPES: 'service_types',
  TOOLS_CATALOG: 'tools_catalog',
  TASK_KPIS: 'task_kpis',
  ORDENS_SERVICO: 'tasks',     // alias (O.S. usa a mesma coleção 'tasks')
  // Sprint 46A — Suporte Primário
  OS_SUPORTE_MSGS: 'os_suporte_msgs',
  // Sprint 46 — Fotos anotadas
  OS_FOTO_SLOTS: 'os_foto_slots',
  // Sprint 47 — Projetos & Orçamentos
  OS_PROJECTS: 'os_projects',
  PROJECT_DOCS: 'project_documents',
  OS_ORCAMENTOS: 'os_orcamentos',
  // Sprint 48 — RH: Documentos & Ocorrências
  EMPLOYEE_DOCS: 'employee_docs',
  EMPLOYEE_OCCURRENCES: 'employee_occurrences',
  // Sprint 49 — Módulo Meu Almoço
  LUNCH_MENUS: 'lunch_menus',
  LUNCH_CHOICES: 'lunch_choices',
  LUNCH_LOCATIONS: 'lunch_locations',
  LUNCH_CONFIG: 'lunch_config',
  // Sprint 50 — Módulo People Analytics
  SURVEYS: 'surveys',
  SURVEY_RESPONSES: 'survey_responses',
  SURVEY_PARTICIPATION: 'survey_participation',
  SURVEY_TEMPLATES: 'survey_templates',
  // Sprint 51 — Apresentações Interativas
  PRESENTATIONS: 'presentations',
  PRESENTATION_VIEWS: 'presentationViews', // ORC-08
  // Sprint Projetos v2 — Ciclo de Vida Completo
  PROJECTS_V2: 'projects_v2',
  PROJECT_LEADS: 'project_leads',
  PROJECT_COTACOES: 'project_cotacoes',
  PROJECT_CONTRATOS: 'project_contratos',
  PROJECT_FATURAMENTOS: 'project_faturamentos',
  // Sprint Gantt Completo — WBS, Baselines, Adversidades
  GANTT_TASKS: 'gantt_tasks',
  GANTT_BASELINES: 'gantt_baselines',
  // Sprint Propostas PDF
  PROPOSTAS_PDF: 'propostas_pdf',
  // Sprint OpsBI — Hub Melhorias
  HUB_IMPROVEMENTS: 'hub_improvements',
  // Sprint Veículos — Config
  VEHICLE_CHECK_CONFIG: 'vehicle_check_config',
  // Sprint Projetos v2 — Atividades
  PROJECT_ACTIVITIES: 'project_activities',
  // Sprint Projetos v2 — Adendos (subcoleção simulada via coleção raiz)
  PROJECT_ADENDOS: 'project_adendos',
} as const;

// Tipo que preserva as chaves do enum original
type CollectionNameType = { readonly [K in keyof typeof _BASE_COLLECTIONS]: string };

// Objeto final com prefixo aplicado dinamicamente
const _prefixedCollections = Object.fromEntries(
  Object.entries(_BASE_COLLECTIONS).map(([key, value]) => [key, _col(value)])
) as CollectionNameType;

export const CollectionName: CollectionNameType = Object.freeze(_prefixedCollections);

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
  dataReferencia?: string;   // "YYYY-MM-DD" — dia ao qual o documento se refere na folha de ponto
}

export interface EmployeeOccurrence {
  id: string;
  userId: string;
  data: string;              // "2026-03-19" (ISO date)
  tipo: OccurrenceType;
  descricao?: string;
  arquivoUrl?: string;       // URL do atestado/imagem
  arquivoNome?: string;
  horaInicio?: string;       // "08:00" — para atestado parcial
  horaFim?: string;          // "12:00" — para atestado parcial
  diaCompleto?: boolean;     // true = abona o dia inteiro (default true p/ atestado sem horário)
  minutosAbonados?: number;  // minutos justificados (calculado ao salvar)
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

export type LunchMenuMode = 'semanal' | 'diario' | 'fixo';

export interface LunchMenu {
  id: string;
  modo?: LunchMenuMode;         // 'semanal' | 'diario' | 'fixo' — default "semanal" para retrocompatibilidade
  weekStart: string;            // "2026-03-23" — usado no modo "semanal"
  weekEnd: string;              // "2026-03-27" — usado no modo "semanal"
  dataUnica?: string;           // "2026-03-24" — usado apenas no modo "diario"
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

// ─── Sprint 51 — Apresentações Interativas ────────────────────────────────────

export type SlideType = 'cover' | 'overview' | 'deliverables' | 'timeline' | 'investment' | 'closing';
export type PresentationStatus = 'ativa' | 'rascunho' | 'arquivada';
export type PresentationTema = 'dark-navy' | 'dark-slate' | 'dark-teal' | 'mgr-classic';

// ── Slide: Cover ──
export interface CoverData {
  titulo: string;
  subtitulo?: string;
  clienteNome: string;
  dataValidade?: string;
  usarLogoMGR?: boolean;
  logoClienteUrl?: string | null; // ORC-09
}

// ── Slide: Overview ──
export interface OverviewData {
  descricao?: string;
  localizacao?: string;
  temperatura?: string;
  finalidade?: string;
  metragem?: string;
}

// ── Slide: Deliverables ──
export interface DeliverableItem {
  id: string;
  categoria: string;
  descricao: string;
}
export interface DeliverablesData {
  items: DeliverableItem[];
}

// ── Slide: Timeline ──
export interface TimelineFase {
  id: string;
  nome: string;
  prazo: string;
  descricao?: string;
}
export interface TimelineData {
  fases: TimelineFase[];
  totalDias?: string;
}

// ── Slide: Investment ──
export interface InvestmentBreakdownItem {
  id: string;
  label: string;
  valor: string;
}
export interface InvestmentParcela {
  id: string;
  percentual: string;
  label: string;
  valor: string;
}
export interface InvestmentData {
  valorTotal: string;
  breakdown?: InvestmentBreakdownItem[];
  parcelas: InvestmentParcela[];
  observacoes?: string;
}

// ── Slide: Closing ──
export interface ClosingData {
  textoCTA?: string;
  textoFechamento?: string;
  exibirContato?: boolean;
}

// ── Discriminated union ──
export type SlideData =
  | { type: 'cover';        order: number; visible: boolean; data: CoverData }
  | { type: 'overview';     order: number; visible: boolean; data: OverviewData }
  | { type: 'deliverables'; order: number; visible: boolean; data: DeliverablesData }
  | { type: 'timeline';     order: number; visible: boolean; data: TimelineData }
  | { type: 'investment';   order: number; visible: boolean; data: InvestmentData }
  | { type: 'closing';      order: number; visible: boolean; data: ClosingData };

// ── Root document ──
export interface Presentation {
  id: string;
  slug: string;
  orcamentoId?: string | null;
  clienteNome: string;
  projetoTitulo: string;
  responsavel?: string;
  responsavelEmail?: string;
  responsavelTelefone?: string;
  pdfUrl?: string | null;
  pdfStoragePath?: string | null;
  logoClienteUrl?: string | null;     // ORC-09
  logoClienteStoragePath?: string | null; // ORC-09
  status: PresentationStatus;
  tema: PresentationTema;
  slides: SlideData[];
  slideAutoplay?: boolean;
  slideDelayMs?: number;
  linkPublicoViews?: number;          // ORC-08
  linkPublicoLastAccess?: any;        // ORC-08 (Firestore Timestamp)
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
}

// ── ORC-08: Vista de apresentação (analytics) ──
export interface PresentationView {
  presentationId: string;
  slug: string;
  viewedAt: any; // Timestamp
  userAgent: string;
  device: 'mobile' | 'tablet' | 'desktop';
}

// ─────────────────────────────────────────────────────────────────────────────
// Sprint Projetos v2 — Módulo de Projetos: Ciclo de Vida Completo
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Gantt Completo — WBS, Adversidades, Baselines, KPIs
// ─────────────────────────────────────────────────────────────────────────────

export type GanttPartyV2 = 'mgr' | 'cliente' | 'terceiro';
export type GanttTaskStatus = 'nao_iniciada' | 'em_andamento' | 'concluida' | 'bloqueada' | 'cancelada';

/** Responsável alocado a uma tarefa do Gantt */
export interface GanttResponsavel {
  userId: string;
  userName: string;
  equipeId?: string;
  equipeName?: string;
}

/** Dependência entre tarefas (Finish-to-Start ou outras) */
export type GanttDependenciaTipo = 'FS' | 'SS' | 'FF' | 'SF'; // Finish-Start, Start-Start, Finish-Finish, Start-Finish

export interface GanttDependencia {
  taskId: string;        // ID da tarefa predecessora
  tipo: GanttDependenciaTipo;
  lagDias?: number;      // lag positivo = esperar N dias após conclusão
}

/** Adversidade registrada em uma tarefa do Gantt */
export interface GanttAdversidade {
  id: string;
  taskId: string;
  descricao: string;
  responsavel: GanttPartyV2;  // quem causou o atraso
  diasImpacto: number;         // impacto direto em dias
  evidenciaUrl?: string;       // foto obrigatória de evidência
  registradoPor: string;       // uid
  registradoPorNome: string;
  registradoEm: Timestamp;
  aplicadoCascata: boolean;    // se o impacto foi propagado nas dependências
}

/** Tarefa WBS do Gantt (pode ter subtarefas aninhadas) */
export interface GanttTask {
  id: string;
  projectId: string;

  // Hierarquia WBS
  parentId?: string | null;    // null = tarefa raiz
  wbsCode?: string;            // ex: "1.2.3"
  nivel: number;               // 0 = raiz, 1 = subtarefa, 2 = sub-subtarefa
  ordem: number;               // posição dentro do pai

  // Identificação
  label: string;
  descricao?: string;
  party: GanttPartyV2;

  // Status
  status: GanttTaskStatus;
  progresso: number;           // 0-100 %

  // Datas Previstas (baseline original)
  dataInicioPrevista?: Timestamp | null;
  dataFimPrevista?: Timestamp | null;
  duracaoDias?: number;        // calculada ou manual

  // Datas Reais
  dataInicioReal?: Timestamp | null;
  dataFimReal?: Timestamp | null;

  // Caminho Crítico
  isCritico: boolean;          // true = está no caminho crítico
  folga?: number;             // dias de folga total (slack)
  earlyStart?: number;        // dia do projeto (CPM calculation)
  earlyFinish?: number;
  lateStart?: number;
  lateFinish?: number;

  // Dependências
  dependencias?: GanttDependencia[];

  // Responsáveis
  responsaveis?: GanttResponsavel[];

  // Custo estimado
  custoEstimado?: number;

  // Adversidades registradas nesta tarefa
  adversidades?: GanttAdversidade[];

  // Observação
  observacao?: string;

  // Metadados
  criadoPor: string;
  criadoEm: Timestamp;
  atualizadoEm?: Timestamp;
}

/** Snapshot do cronograma para versionamento (baseline) */
export interface GanttBaseline {
  id: string;
  projectId: string;
  nome: string;                // ex: "Baseline Original", "Revisão 1"
  descricao?: string;
  tasks: Pick<GanttTask, 'id' | 'label' | 'dataInicioPrevista' | 'dataFimPrevista' | 'duracaoDias' | 'isCritico'>[];
  totalDias: number;
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: Timestamp;
}

/** KPIs calculados do Gantt do projeto */
export interface GanttKPI {
  totalTarefas: number;
  tarefasConcluidas: number;
  tarefasAtrasadas: number;
  tarefasBloqueadas: number;
  tarefasCriticas: number;     // no caminho crítico

  // Schedule Performance Index
  spi: number;                 // SPI = EV / PV (1.0 = no prazo, <1 = atrasado)
  ev: number;                  // Earned Value (% previsto de tarefas concluídas)
  pv: number;                  // Planned Value (% planejado concluído até hoje)

  // Desvio
  desvioTotalDias: number;     // desvio da data fim real vs prevista (baseado em tarefas atrasadas)

  // Distribuição de responsabilidade por atrasos
  atrasoPorParty: {
    mgr: number;          // dias de atraso causados pela MGR
    cliente: number;      // dias de atraso causados pelo cliente
    terceiro: number;     // dias de atraso causados por terceiros
  };

  // Adversidades
  totalAdversidades: number;
  adversidadesAtivas: number;  // que ainda impactam o cronograma
}

// ── Fase do Projeto (máquina de estados — 16 estados) ──
export type ProjectPhase =
  | 'lead_capturado'
  | 'em_levantamento'
  | 'em_cotacao'
  | 'cotacao_recebida'
  | 'proposta_enviada'
  | 'contrato_enviado'
  | 'contrato_assinado'
  | 'em_planejamento'
  | 'cronograma_aprovado'
  | 'os_distribuidas'
  | 'em_execucao'
  | 'relatorio_enviado'
  | 'em_faturamento'
  | 'aguardando_recebimento'
  | 'concluido'
  | 'nao_aprovado';

export const PROJECT_PHASE_LABELS: Record<ProjectPhase, string> = {
  lead_capturado: 'Lead Capturado',
  em_levantamento: 'Em Levantamento',
  em_cotacao: 'Em Cotação',
  cotacao_recebida: 'Cotação Recebida',
  proposta_enviada: 'Proposta Enviada',
  contrato_enviado: 'Contrato Enviado',
  contrato_assinado: 'Contrato Assinado',
  em_planejamento: 'Em Planejamento',
  cronograma_aprovado: 'Cronograma Aprovado',
  os_distribuidas: 'O.S. Distribuídas',
  em_execucao: 'Em Execução',
  relatorio_enviado: 'Relatório Enviado',
  em_faturamento: 'Em Faturamento',
  aguardando_recebimento: 'Aguardando Recebimento',
  concluido: 'Concluído',
  nao_aprovado: 'Não Aprovado',
};

export const PROJECT_PHASE_COLORS: Record<ProjectPhase, string> = {
  lead_capturado: 'bg-violet-100 text-violet-700 border-violet-200',
  em_levantamento: 'bg-blue-100 text-blue-700 border-blue-200',
  em_cotacao: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  cotacao_recebida: 'bg-teal-100 text-teal-700 border-teal-200',
  proposta_enviada: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  contrato_enviado: 'bg-amber-100 text-amber-700 border-amber-200',
  contrato_assinado: 'bg-lime-100 text-lime-700 border-lime-200',
  em_planejamento: 'bg-sky-100 text-sky-700 border-sky-200',
  cronograma_aprovado: 'bg-blue-100 text-blue-700 border-blue-200',
  os_distribuidas: 'bg-orange-100 text-orange-700 border-orange-200',
  em_execucao: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  relatorio_enviado: 'bg-pink-100 text-pink-700 border-pink-200',
  em_faturamento: 'bg-rose-100 text-rose-700 border-rose-200',
  aguardando_recebimento: 'bg-red-100 text-red-700 border-red-200',
  concluido: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  nao_aprovado: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const PROJECT_PHASE_ORDER: ProjectPhase[] = [
  'lead_capturado',
  'em_levantamento',
  'em_cotacao',
  'cotacao_recebida',
  'proposta_enviada',
  'contrato_enviado',
  'contrato_assinado',
  'em_planejamento',
  'cronograma_aprovado',
  'os_distribuidas',
  'em_execucao',
  'relatorio_enviado',
  'em_faturamento',
  'aguardando_recebimento',
  'concluido',
];

// ── Tipos de projeto predefinidos ──
export const PROJECT_TYPES = [
  { slug: 'camara_fria', label: 'Câmara Fria' },
  { slug: 'split_industrial', label: 'Split Industrial' },
  { slug: 'chiller', label: 'Chiller' },
  { slug: 'refrigeracao_comercial', label: 'Refrigeração Comercial' },
  { slug: 'manutencao_preventiva', label: 'Manutenção Preventiva' },
  { slug: 'retrofit', label: 'Retrofit' },
  { slug: 'instalacao_nova', label: 'Instalação Nova' },
  { slug: 'outro', label: 'Outro' },
] as const;

// ── Motivos de não fechamento ──
export const NAO_APROVADO_MOTIVOS = [
  { id: 'preco_alto', label: 'Preço alto' },
  { id: 'sem_orcamento', label: 'Cliente sem orçamento' },
  { id: 'projeto_adiado', label: 'Projeto adiado' },
  { id: 'escolheu_concorrente', label: 'Escolheu concorrente' },
  { id: 'mudou_ideia', label: 'Mudou de ideia' },
  { id: 'sem_retorno', label: 'Sem retorno do cliente' },
  { id: 'outro', label: 'Outro' },
] as const;

// ── Transições permitidas (máquina de estados) ──
export const PROJECT_TRANSITIONS: Record<ProjectPhase, ProjectPhase[]> = {
  lead_capturado:         ['em_levantamento', 'nao_aprovado'],
  em_levantamento:        ['em_cotacao', 'nao_aprovado'],
  em_cotacao:             ['cotacao_recebida', 'nao_aprovado'],
  cotacao_recebida:       ['proposta_enviada', 'em_cotacao', 'nao_aprovado'],
  proposta_enviada:       ['contrato_enviado', 'nao_aprovado'],
  contrato_enviado:       ['contrato_assinado', 'nao_aprovado'],
  contrato_assinado:      ['em_planejamento'],
  em_planejamento:        ['cronograma_aprovado'],
  cronograma_aprovado:    ['os_distribuidas'],
  os_distribuidas:        ['em_execucao'],
  em_execucao:            ['relatorio_enviado'],
  relatorio_enviado:      ['em_faturamento'],
  em_faturamento:         ['aguardando_recebimento'],
  aguardando_recebimento: ['concluido'],
  concluido:              [],
  nao_aprovado:           ['lead_capturado', 'em_levantamento'],
};

// ── Sub-interfaces do ProjectV2 ──

export interface ProjectV2PhaseEntry {
  fase: ProjectPhase;
  alteradoEm: Timestamp;
  alteradoPor: string;
  alteradoPorNome?: string;
  observacao?: string;
}

export interface ProjectV2LeadData {
  origem: 'formulario_site' | 'indicacao' | 'anuncio' | 'manual';
  nomeContato: string;
  telefone: string;
  email?: string;
  empresa?: string;
  tipoProjetoPedido: string;
  medidasAproximadas?: string;
  finalidade?: string;
  localizacao?: string;
  observacoes?: string;
  recebidoEm: Timestamp;
  contatoRealizadoEm?: Timestamp;
  contatoRealizadoPor?: string;
  contatoRealizadoPorNome?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface ProjectV2Prancheta {
  dimensoes?: string;
  tipoEquipamento?: string;
  capacidadeBTU?: number;
  voltagem?: string;
  tipoGas?: string;
  isolamento?: string;
  estruturaExistente?: string;
  temperaturaAlvo?: string;
  finalidade?: string;
  localizacao?: string;
  metragem?: string;
  observacoesTecnicas?: string;
  fotosLevantamento?: string[];
  croquis?: string[];
  preenchidoPor?: string;
  preenchidoPorNome?: string;
  preenchidoEm?: Timestamp;
  camposCustom?: Record<string, string>;
}

export interface ProjectV2NaoAprovado {
  motivoId: string;
  motivoTexto: string;
  detalhes?: string;
  faseParou: ProjectPhase;
  arquivadoEm: Timestamp;
  arquivadoPor: string;
  arquivadoPorNome?: string;
  tentativasReabertura?: {
    data: Timestamp;
    por: string;
    porNome: string;
    novaAbordagem: string;
    resultado?: 'convertido' | 'mantido_nao_aprovado';
    descontoOferecido?: string;
    novoValor?: number;
  }[];
}

export interface ProjectV2PropostaVersao {
  versao: number;
  apresentacaoId: string;
  slug?: string;
  criadaEm: Timestamp;
}

// ── Interface principal: Projeto V2 ──
export interface ProjectV2 {
  id: string;
  nome: string;
  descricao?: string;
  clientId: string;
  clientName: string;
  tipoProjetoSlug: string;
  fase: ProjectPhase;
  faseHistorico: ProjectV2PhaseEntry[];

  // F0 — Lead
  leadData?: ProjectV2LeadData;
  leadId?: string;

  // F1 — Prancheta
  prancheta?: ProjectV2Prancheta;

  // F2 — Cotação
  cotacaoIds?: string[];
  cotacaoVencedoraId?: string;
  relatorioNecessidadesUrl?: string;

  // F3 — Apresentação
  apresentacaoId?: string;
  propostaVersoes?: ProjectV2PropostaVersao[];

  // F4 — Contrato
  contratoId?: string;

  // F5+F6 — Gantt + O.S.
  osIds: string[];
  totalOSPrevistas?: number;
  totalOSConcluidas?: number;

  // F8 — Relatório
  relatorioFinalUrl?: string;
  relatorioEnviadoEm?: Timestamp;

  // F9 — Faturamento
  faturamentoId?: string;
  valorContrato?: number;
  valorRecebido?: number;

  // F11 — Não Aprovado
  naoAprovadoData?: ProjectV2NaoAprovado;

  // Metadados
  createdBy: string;
  createdByNome?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

// ── Lead de Projeto (captação via site/anúncios) ──
export type LeadStatus = 'novo' | 'contatado' | 'convertido' | 'descartado';

export interface ProjectLead {
  id: string;
  nomeContato: string;
  empresa?: string;
  telefone: string;
  email?: string;
  tipoProjetoSlug: string;
  tipoProjetoTexto?: string;
  medidasAproximadas?: string;
  finalidade?: string;
  localizacao?: string;
  observacoes?: string;
  origem: 'formulario_site' | 'anuncio_google' | 'anuncio_meta' | 'indicacao';
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  status: LeadStatus;
  projectId?: string;
  contatadoEm?: Timestamp;
  contatadoPor?: string;
  contatadoPorNome?: string;
  motivoDescarte?: string;
  criadoEm: Timestamp;
  userAgent?: string;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: 'Novo',
  contatado: 'Contatado',
  convertido: 'Convertido',
  descartado: 'Descartado',
};

export const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  novo: 'bg-violet-100 text-violet-700 border-violet-200',
  contatado: 'bg-blue-100 text-blue-700 border-blue-200',
  convertido: 'bg-green-100 text-green-700 border-green-200',
  descartado: 'bg-gray-100 text-gray-500 border-gray-200',
};

// ── Cotação de Projeto ──
export interface CotacaoItem {
  id: string;
  descricao: string;
  quantidade: number;
  unidade?: string;
  valorUnitario: number;
  valorTotal: number;
  prazoEntrega?: string;
}

export interface ProjectCotacao {
  id: string;
  projectId: string;
  fornecedor: string;
  fornecedorContato?: string;
  fornecedorEmail?: string;
  fornecedorTelefone?: string;
  itens: CotacaoItem[];
  valorTotal: number;
  condicoesPagamento?: string;
  prazoEntregaGeral?: string;
  validadeAte?: Timestamp;
  documentoUrl?: string;
  documentoNome?: string;
  selecionada: boolean;
  observacoes?: string;
  criadoEm: Timestamp;
  criadoPor: string;
  criadoPorNome: string;
}

// ── Contrato de Projeto ──
export type ContratoStatus = 'rascunho' | 'enviado' | 'visualizado' | 'assinado' | 'recusado';

export const CONTRATO_STATUS_LABELS: Record<ContratoStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  visualizado: 'Visualizado',
  assinado: 'Assinado',
  recusado: 'Recusado',
};

export interface ProjectContrato {
  id: string;
  projectId: string;
  clientId: string;
  clientName: string;
  titulo: string;
  conteudoHtml?: string;
  variaveis?: Record<string, string>;
  status: ContratoStatus;
  assinaturaServico?: 'autentique' | 'clicksign' | 'manual';
  assinaturaExternaId?: string;
  assinaturaUrl?: string;
  assinadoEm?: Timestamp;
  documentoPdfUrl?: string;
  documentoAssinadoUrl?: string;
  enviadoEm?: Timestamp;
  visualizadoEm?: Timestamp;
  recusadoMotivo?: string;
  criadoEm: Timestamp;
  criadoPor: string;
  criadoPorNome: string;
  atualizadoEm?: Timestamp;
}

// ── Faturamento de Projeto ──
export type ParcelaStatus = 'pendente' | 'pago' | 'atrasado';

export interface FaturamentoParcela {
  id: string;
  numero: number;
  descricao?: string;
  valor: number;
  dataVencimento: Timestamp;
  dataPagamento?: Timestamp;
  status: ParcelaStatus;
  comprovanteUrl?: string;
  observacoes?: string;
}

export interface ProjectFaturamento {
  id: string;
  projectId: string;
  projectNome: string;
  clientId: string;
  clientName: string;
  valorTotal: number;
  parcelas: FaturamentoParcela[];
  totalPago: number;
  totalPendente: number;
  totalAtrasado: number;
  criadoEm: Timestamp;
  criadoPor: string;
  criadoPorNome: string;
  atualizadoEm?: Timestamp;
}

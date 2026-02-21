
import { Timestamp } from 'firebase/firestore';

export { Timestamp };

// --- ACCESS CONTROL & PERMISSIONS ---
export type UserRole = 'admin' | 'manager' | 'employee' | 'technician' | 'pending' | 'developer';

export interface PermissionSet {
  // Administrative
  canManageUsers: boolean;      // Create, edit, delete users, change sectors
  canManageSettings: boolean;   // CMS, Landing Page, System Configs
  canManageSectors: boolean;    // Create/Edit Sectors (Roles)

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

  // Financial (Future Proofing)
  canViewFinancial: boolean;
  canManageFinancial: boolean;
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
  workSchedule?: {
    startTime: string; // "08:00"
    lunchDuration: number; // minutes, e.g., 60
    endTime: string; // "17:00"
  };
  allowedLocationIds?: string[]; // IDs of WorkLocations
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

// --- HR & TIME TRACKING ---
export interface TimeEntry {
  id: string;
  userId: string;
  type: 'entry' | 'lunch_start' | 'lunch_end' | 'exit';
  timestamp: Timestamp;
  locationId?: string; // Where they clocked in
  location?: {
    lat: number;
    lng: number;
  };
  
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
  assignedTo?: string; // Legacy: Primary assignee
  assigneeName?: string;
  assignedUsers?: string[]; // NEW: Multiple assignees
  assignedUserNames?: string[]; // NEW: Names for display
  startDate?: Timestamp;
  endDate?: Timestamp;
  progress?: number; // 0-100
  tools?: string[];
  checklist: ChecklistItem[];
  evidenceUrl?: string; 
  createdAt: Timestamp;
}

export interface Client {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  address?: string;
  document?: string;
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

// --- COLLECTIONS ---
export enum CollectionName {
  TASKS = 'tasks',
  USERS = 'users',
  SECTORS = 'sectors', // New collection for Role Templates
  TIME_ENTRIES = 'time_entries',
  PROJECTS = 'projects',
  WORK_LOCATIONS = 'work_locations',
  CLIENTS = 'clients',
  TASK_TEMPLATES = 'task_templates',
  SYSTEM_SETTINGS = 'system_settings',
  CONTACT_MESSAGES = 'contact_messages',
}

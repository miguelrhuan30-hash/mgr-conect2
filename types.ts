import { Timestamp } from 'firebase/firestore';

// --- ACCESS CONTROL ---
export type UserRole = 'admin' | 'manager' | 'employee' | 'technician' | 'pending' | 'developer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  xp: number;
  level: number;
  photoURL?: string; // Facial Biometrics Base
  createdAt: Timestamp;
  
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
  photoEvidenceUrl?: string; // Optional if manual
  isOnTime?: boolean;
  userAgent?: string;
  
  // Audit & Manual Adjustment Fields
  isManual?: boolean;        // True if added by manager
  forcedClose?: boolean;     // True if system/manager closed a forgotten shift
  editedBy?: string;         // UID of the manager who edited
  editReason?: string;       // "Esquecimento", "Doença", etc.
  editTimestamp?: Timestamp; // When the edit happened
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
  startDate?: Timestamp;
  endDate?: Timestamp;
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
  TIME_ENTRIES = 'time_entries',
  PROJECTS = 'projects',
  CLIENTS = 'clients',
  INVENTORY_REQUESTS = 'inventory_requests',
  TASK_TEMPLATES = 'task_templates',
  SYSTEM_SETTINGS = 'system_settings',
  CONTACT_MESSAGES = 'contact_messages',
  WORK_LOCATIONS = 'work_locations'
}
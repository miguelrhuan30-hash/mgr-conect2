/**
 * components/Users.tsx — Sprint Academy
 * Módulo Equipe & RH: Lista de colaboradores + Painel unificado de edição com 8 abas.
 * Novas abas: Conhecimento (certificações NR com badges) + Vistorias (supervisão de campo)
 */
import React, { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs,
  addDoc, deleteDoc, serverTimestamp, QuerySnapshot, DocumentData, Timestamp,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, storage, functions } from '../firebase';
import {
  CollectionName, UserProfile, UserRole, WorkLocation, Sector, PermissionSet,
  EmployeeDocument, EmployeeOccurrence, OccurrenceType, OCCURRENCE_LABELS, OCCURRENCE_COLORS,
  ColaboradorCertificacao, CertificacaoStatus, VistoriaSupervisao, VistoriaItem,
  PasswordResetRequest,
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import {
  Users as UsersIcon, ShieldCheck, Loader2, Camera, MapPin, Clock,
  Settings, FileText, Briefcase, Package, DollarSign, X, Save, Shield,
  AlertTriangle, Search, ChevronRight, FolderOpen, Upload, Trash2,
  Plus, User, Calendar, AlertCircle, Eye, Image, ChevronDown, ChevronUp,
  Trophy, Brain, Kanban, Wrench, Receipt, BarChart3, Car, Target,
  CheckSquare, CalendarDays, Award, ClipboardCheck, CheckCircle, XCircle,
  MinusCircle, BadgeCheck, ShieldAlert, KeyRound, Bell, EyeOff,
  UserPlus, Archive, RotateCcw, UserX,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const INITIAL_PERMISSIONS: PermissionSet = {
  canManageUsers: false, canManageSettings: false, canManageSectors: false, canViewLogs: false,
  canRegisterAttendance: true, canViewAttendanceReports: false, canManageAttendance: false, requiresTimeClock: false,
  canViewTasks: true, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false,
  canManageProjects: false, canManageChamados: false, canViewSchedule: false, canViewFullSchedule: false, canViewMySchedule: true,
  canViewFinancials: false, canManageClients: false,
  canViewInventory: false, canManageInventory: false,
  canViewRanking: true, canViewBI: false, canViewIntel: false, canViewVehicles: false,
  canResetUserPasswords: false,
};

// ─── NR Catalog — badges colors ─────────────────────────────────────────────
const NR_CATALOG: { value: string; label: string; color: string; bg: string; border: string }[] = [
  { value: 'NR-6',  label: 'NR-6 — EPI',                      color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-300' },
  { value: 'NR-7',  label: 'NR-7 — PCMSO',                    color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-300' },
  { value: 'NR-9',  label: 'NR-9 — PPRA / PGR',               color: 'text-green-700',   bg: 'bg-green-50',   border: 'border-green-300' },
  { value: 'NR-10', label: 'NR-10 — Elétrica',                 color: 'text-yellow-700',  bg: 'bg-yellow-50',  border: 'border-yellow-300' },
  { value: 'NR-11', label: 'NR-11 — Movimentação de Cargas',   color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-300' },
  { value: 'NR-12', label: 'NR-12 — Máquinas e Equipamentos',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-300' },
  { value: 'NR-18', label: 'NR-18 — Construção Civil',         color: 'text-stone-700',   bg: 'bg-stone-50',   border: 'border-stone-300' },
  { value: 'NR-33', label: 'NR-33 — Espaços Confinados',       color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-300' },
  { value: 'NR-35', label: 'NR-35 — Trabalho em Altura',       color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-300' },
  { value: 'OUTRO', label: 'Outra certificação',               color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-300' },
];

const getNrStyle = (tipo: string) =>
  NR_CATALOG.find(n => n.value === tipo) ?? { color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-300' };

// ─── Vistoria categories ──────────────────────────────────────────────────────
const VISTORIA_CATEGORIAS = ['EPI', 'Ferramentas', 'Documentação', 'Segurança', 'Uniforme', 'Comportamento'];

const VISTORIA_ITENS_PADRAO: Record<string, string[]> = {
  'EPI':          ['Capacete', 'Botina de Segurança', 'Luva de Proteção', 'Óculos de Proteção', 'Protetor Auricular'],
  'Ferramentas':  ['Ferramentas em bom estado', 'Maleta organizada', 'Equipamentos calibrados'],
  'Documentação': ['Crachá MGR', 'Ordem de Serviço impressa', 'Checklist de campo'],
  'Segurança':    ['Conhecimento do PPRA', 'Bloqueio de energia (LOTO)', 'Sinalização do local'],
  'Uniforme':     ['Camisa MGR', 'Calça adequada', 'Apresentação pessoal'],
  'Comportamento':['Pontualidade', 'Comunicação com cliente', 'Organização do local após serviço'],
};

function calcCertStatus(cert: Partial<ColaboradorCertificacao>): CertificacaoStatus {
  if (!cert.dataValidade) return 'valida';
  const dias = differenceInDays((cert.dataValidade as Timestamp).toDate(), new Date());
  if (dias < 0) return 'vencida';
  if (dias <= 30) return 'vencendo';
  return 'valida';
}

const MiniToggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button type="button" onClick={onChange}
    className={`relative inline-flex flex-shrink-0 h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors ${on ? 'bg-brand-600' : 'bg-gray-200'}`}>
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

interface UA { key: keyof PermissionSet; label: string; desc?: string }
interface UM { id: string; label: string; color: string; txtColor: string; actions: UA[] }
const USER_MODULES: UM[] = [
  { id: 'os', label: 'Ordens de Serviço', color: 'bg-orange-50', txtColor: 'text-orange-700',
    actions: [
      { key: 'canViewTasks', label: 'Visualizar Tarefas' }, { key: 'canManageProjects', label: 'Pipeline / Kanban' },
      { key: 'canManageChamados', label: 'Chamados de Clientes (SLA)', desc: 'Ver e converter em O.S. os chamados abertos por clientes no Portal' },
      { key: 'canViewMySchedule', label: 'Minha Agenda' }, { key: 'canViewFullSchedule', label: 'Agenda Completa' },
      { key: 'canViewSchedule', label: 'Agenda / Gantt' }, { key: 'canCreateTasks', label: 'Criar Nova O.S.' },
      { key: 'canEditTasks', label: 'Editar O.S.' },
      { key: 'canDeleteTasks', label: '🗑 Excluir O.S.', desc: 'Atenção: exclusão permanente e irreversível. Libere apenas para gestores.' },
      { key: 'canViewFinancials', label: 'Faturamento & Financeiro' },
    ] },
  { id: 'hr', label: 'RH & Ponto', color: 'bg-blue-50', txtColor: 'text-blue-700',
    actions: [
      { key: 'canRegisterAttendance', label: 'Registrar Ponto' }, { key: 'canViewAttendanceReports', label: 'Espelho de Ponto' },
      { key: 'canManageAttendance', label: 'Corrigir / Gerenciar Ponto' },
      { key: 'requiresTimeClock', label: 'Exigir Ponto para Acesso', desc: 'Bloqueia entrada até bater ponto' },
    ] },
  { id: 'clients', label: 'Clientes & Ativos', color: 'bg-purple-50', txtColor: 'text-purple-700',
    actions: [{ key: 'canManageClients', label: 'Gerenciar Clientes & Ativos' }] },
  { id: 'inventory', label: 'Almoxarifado', color: 'bg-emerald-50', txtColor: 'text-emerald-700',
    actions: [{ key: 'canViewInventory', label: 'Visualizar Estoque' }, { key: 'canManageInventory', label: 'Movimentar Estoque' }] },
  { id: 'ranking', label: 'Ranking & Gamificação', color: 'bg-yellow-50', txtColor: 'text-yellow-700',
    actions: [{ key: 'canViewRanking', label: 'Visualizar Ranking' }] },
  { id: 'vehicles', label: 'Controle de Veículos', color: 'bg-cyan-50', txtColor: 'text-cyan-700',
    actions: [{ key: 'canViewVehicles', label: 'Acessar Veículos' }] },
  { id: 'intel', label: 'Inteligência de Negócios', color: 'bg-indigo-50', txtColor: 'text-indigo-700',
    actions: [
      { key: 'canViewBI',    label: 'BI / Dashboard' },
      { key: 'canViewIntel', label: 'Inteligência MGR 🧠', desc: 'Acesso ao hub de análise estratégica' },
    ] },
  { id: 'feed', label: 'Feed de Atividades', color: 'bg-teal-50', txtColor: 'text-teal-700',
    actions: [
      { key: 'canViewFeed', label: 'Ver Feed da Equipe', desc: 'Exibe a aba Feed no app campo com todas as atividades da equipe em tempo real' },
    ] },
  { id: 'admin', label: 'Administração', color: 'bg-red-50', txtColor: 'text-red-700',
    actions: [
      { key: 'canManageUsers', label: 'Gerenciar Usuários' }, { key: 'canManageSectors', label: 'Gerenciar Cargos & Acessos' },
      { key: 'canManageSettings', label: 'Configurações do Sistema' }, { key: 'canViewLogs', label: 'Log do Sistema' },
      { key: 'canResetUserPasswords', label: 'Redefinir Senha de Colaboradores', desc: 'Define senha temporária para acesso de colaboradores que esqueceram a senha' },
    ] },
];
const modEnabled = (mod: UM, p: PermissionSet) => mod.actions.some(a => !!p[a.key]);

const nameFromEmail = (email: string): string => {
  const local = email.split('@')[0] || '';
  return local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

type TabKey = 'dados' | 'jornada' | 'financeiro' | 'permissoes' | 'arquivos' | 'ocorrencias' | 'conhecimento' | 'vistorias' | 'senha';

/* ═══════════════════════════════════════════════════════════════════════════
   EMPLOYEE DETAIL PANEL
   ═══════════════════════════════════════════════════════════════════════════ */
const EmployeeDetailPanel: React.FC<{
  user: UserProfile;
  locations: WorkLocation[];
  sectors: Sector[];
  documents: EmployeeDocument[];
  occurrences: EmployeeOccurrence[];
  certifications: ColaboradorCertificacao[];
  vistorias: VistoriaSupervisao[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ user, locations, sectors, documents, occurrences, certifications, vistorias, onClose, onSaved }) => {
  const { currentUser, userProfile: myProfile } = useAuth();
  const [tab, setTab] = useState<TabKey>('dados');
  const [saving, setSaving] = useState(false);

  // ── Redefinição de senha ──
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [confirmTempPassword, setConfirmTempPassword] = useState('');
  const [showTempPwd, setShowTempPwd] = useState(false);
  const [resetPwdLoading, setResetPwdLoading] = useState(false);
  const [resetPwdError, setResetPwdError] = useState('');
  const [resetPwdSuccess, setResetPwdSuccess] = useState(false);

  // ── Dados Pessoais ──
  const [nomeCompleto, setNomeCompleto] = useState(user.nomeCompleto || user.displayName || nameFromEmail(user.email));
  const [cargo, setCargo] = useState((user as any).cargo || '');
  const [cpf, setCpf] = useState((user as any).cpf || '');
  const [phone, setPhone] = useState((user as any).phone || '');
  const [pix, setPix] = useState((user as any).pixKey || '');
  const [banco, setBanco] = useState((user as any).banco || '');
  const [conta, setConta] = useState((user as any).conta || '');
  const [agencia, setAgencia] = useState((user as any).agencia || '');

  // ── Qualificação Civil / Admissão ──
  const [dataAdmissao, setDataAdmissao] = useState(user.dataAdmissao?.toDate?.().toISOString().slice(0, 10) || '');
  const [nacionalidade, setNacionalidade] = useState(user.nacionalidade || 'Brasileiro(a)');
  const [estadoCivil, setEstadoCivil] = useState(user.estadoCivil || '');
  const [profissao, setProfissao] = useState(user.profissao || '');
  const [rg, setRg] = useState(user.rg || '');
  const [ctps, setCtps] = useState(user.ctps || '');
  const [endereco, setEndereco] = useState(user.endereco || '');

  // ── Jornada ──
  const [scheduleType, setScheduleType] = useState<'FIXED'|'FLEXIBLE'>(user.scheduleType || 'FIXED');
  const [schedule, setSchedule] = useState({ start: user.workSchedule?.startTime || '08:00', lunch: user.workSchedule?.lunchDuration || 60, end: user.workSchedule?.endTime || '17:00', dailyWorkMinutes: user.workSchedule?.dailyWorkMinutes || 0 });
  const defaultDay = (s: string, l: number, e: string) => ({ active: true, startTime: s, lunchDuration: l, endTime: e });
  const [flexSchedule, setFlexSchedule] = useState<any>(() => {
    const ws = user.workSchedule;
    if (ws?.monday) return { monday: ws.monday, tuesday: ws.tuesday, wednesday: ws.wednesday, thursday: ws.thursday, friday: ws.friday, saturday: ws.saturday, sunday: ws.sunday };
    const d = defaultDay(schedule.start, schedule.lunch, schedule.end);
    return { monday: d, tuesday: d, wednesday: d, thursday: d, friday: d, saturday: { ...d, active: false }, sunday: { ...d, active: false, lunchDuration: 0 } };
  });
  const [editLocations, setEditLocations] = useState<string[]>(user.allowedLocationIds || []);

  // ── Financeiro ──
  const [hourlyRate, setHourlyRate] = useState(user.hourlyRate || 0);
  const [rate50, setRate50] = useState(user.overtimeRules?.rate50 || 1.5);
  const [rate100, setRate100] = useState(user.overtimeRules?.rate100 || 2.0);
  const [timeBankBalance, setTimeBankBalance] = useState(user.timeBankBalance ?? 0);

  // ── Permissões ──
  const [sectorId, setSectorId] = useState(user.sectorId || '');
  const [permissions, setPermissions] = useState<PermissionSet>({ ...INITIAL_PERMISSIONS, ...(user.permissions || {}) });

  // ── Ocorrências ──
  const [occDate, setOccDate] = useState(new Date().toISOString().slice(0, 10));
  const [occType, setOccType] = useState<OccurrenceType>('falta_injustificada');
  const [occDesc, setOccDesc] = useState('');
  const [occFile, setOccFile] = useState<File | null>(null);
  const [addingOcc, setAddingOcc] = useState(false);

  // ── Arquivos ──
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPasta, setUploadPasta] = useState('Documentos');
  const [uploadSubpasta, setUploadSubpasta] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState('');

  // ── Certificações ──
  const [certTipo, setCertTipo] = useState('NR-10');
  const [certNomeCustom, setCertNomeCustom] = useState('');
  const [certDataObtencao, setCertDataObtencao] = useState(new Date().toISOString().slice(0, 10));
  const [certDataValidade, setCertDataValidade] = useState('');
  const [certEmitidoPor, setCertEmitidoPor] = useState('');
  const [certFile, setCertFile] = useState<File | null>(null);
  const [addingCert, setAddingCert] = useState(false);

  // ── Vistorias ──
  const [showVistoriaForm, setShowVistoriaForm] = useState(false);
  const [vistoriaData, setVistoriaData] = useState(new Date().toISOString().slice(0, 10));
  const [vistoriaLocal, setVistoriaLocal] = useState('');
  const [vistoriaObs, setVistoriaObs] = useState('');
  const [vistoriaItens, setVistoriaItens] = useState<VistoriaItem[]>(() =>
    Object.entries(VISTORIA_ITENS_PADRAO).flatMap(([cat, itens]) =>
      itens.map((item, i) => ({ id: `${cat}-${i}`, categoria: cat, item, status: 'conforme' as const, observacao: '' }))
    )
  );
  const [addingVistoria, setAddingVistoria] = useState(false);

  const userDocs = documents.filter(d => d.userId === user.uid);
  const userOccs = occurrences.filter(o => o.userId === user.uid).sort((a, b) => b.data.localeCompare(a.data));
  const userCerts = certifications.filter(c => c.colaboradorId === user.uid).sort((a, b) => b.registradoEm?.toMillis?.() - a.registradoEm?.toMillis?.());
  const userVistorias = vistorias.filter(v => v.colaboradorId === user.uid).sort((a, b) => b.dataVistoria?.toMillis?.() - a.dataVistoria?.toMillis?.());

  const folders = useMemo(() => {
    const set = new Set(['Documentos', 'Atestados', 'Contratos']);
    userDocs.forEach(d => set.add(d.pasta));
    return Array.from(set).sort();
  }, [userDocs]);

  const handleSectorChange = (sid: string) => {
    setSectorId(sid);
    const sector = sectors.find(s => s.id === sid);
    if (sector) setPermissions({ ...INITIAL_PERMISSIONS, ...sector.defaultPermissions });
  };

  const saveAll = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const ws = scheduleType === 'FIXED'
        ? { startTime: schedule.start, lunchDuration: schedule.lunch, endTime: schedule.end, dailyWorkMinutes: schedule.dailyWorkMinutes || null }
        : { ...flexSchedule, startTime: schedule.start, lunchDuration: schedule.lunch, endTime: schedule.end, dailyWorkMinutes: schedule.dailyWorkMinutes || null };
      const sectorName = sectors.find(s => s.id === sectorId)?.name || '';
      await updateDoc(doc(db, CollectionName.USERS, user.uid), {
        nomeCompleto, cargo: cargo || null, cpf: cpf || null, phone: phone || null,
        pixKey: pix || null, banco: banco || null, conta: conta || null, agencia: agencia || null,
        dataAdmissao: dataAdmissao ? Timestamp.fromDate(new Date(dataAdmissao + 'T12:00:00')) : null,
        nacionalidade: nacionalidade || null, estadoCivil: estadoCivil || null,
        profissao: profissao || null, rg: rg || null, ctps: ctps || null, endereco: endereco || null,
        scheduleType, workSchedule: ws, allowedLocationIds: editLocations,
        hourlyRate, overtimeRules: { rate50, rate100 }, timeBankBalance,
        sectorId, sectorName, permissions, hasCustomPermissions: true,
      });
      onSaved();
    } catch (e) { console.error(e); alert('Erro ao salvar.'); }
    finally { setSaving(false); }
  };

  const handleResetPassword = async () => {
    setResetPwdError('');
    setResetPwdSuccess(false);
    if (tempPassword.length < 8) {
      setResetPwdError('A senha temporária deve ter pelo menos 8 caracteres.');
      return;
    }
    if (tempPassword !== confirmTempPassword) {
      setResetPwdError('As senhas não coincidem.');
      return;
    }
    setResetPwdLoading(true);
    try {
      const resetFn = httpsCallable(functions, 'adminResetUserPassword');
      await resetFn({ targetUid: user.uid, newPassword: tempPassword });
      setResetPwdSuccess(true);
      setTempPassword('');
      setConfirmTempPassword('');
    } catch (err: any) {
      const msg = err?.message || 'Erro ao redefinir senha.';
      setResetPwdError(msg.replace('FirebaseError: ', '').replace('functions/', ''));
    } finally {
      setResetPwdLoading(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    try {
      const compressed = await compressImage(file, 600, 0.8);
      const storageRef = ref(storage, `users/${user.uid}/profile_${Date.now()}.jpg`);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, CollectionName.USERS, user.uid), { photoURL: url });
    } catch { alert('Erro no upload.'); }
  };

  // ── Document upload ──
  const handleDocUpload = async () => {
    if (!uploadFile || !currentUser) return;
    setUploading(true);
    try {
      const ext = uploadFile.name.split('.').pop()?.toLowerCase() || '';
      const tipo = ext === 'pdf' ? 'documento' : ['jpg','jpeg','png','webp'].includes(ext) ? 'documento' : 'outro';
      const storageRef = ref(storage, `employees/${user.uid}/docs/${Date.now()}_${uploadFile.name}`);
      await uploadBytes(storageRef, uploadFile);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, CollectionName.EMPLOYEE_DOCS), {
        userId: user.uid, nome: uploadFile.name, tipo,
        pasta: uploadPasta, subpasta: uploadSubpasta || null,
        url, tamanhoBytes: uploadFile.size, uploadPor: currentUser.uid, uploadEm: serverTimestamp(),
      });
      setUploadFile(null); setUploadSubpasta('');
    } catch (e) { console.error(e); alert('Erro no upload.'); }
    finally { setUploading(false); }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Excluir este documento?')) return;
    await deleteDoc(doc(db, CollectionName.EMPLOYEE_DOCS, docId));
  };

  // ── Occurrence ──
  const handleAddOccurrence = async () => {
    if (!currentUser || !occDate) return;
    setAddingOcc(true);
    try {
      let arquivoUrl: string | undefined;
      let arquivoNome: string | undefined;
      if (occFile && occType === 'atestado') {
        const storageRef = ref(storage, `employees/${user.uid}/atestados/${Date.now()}_${occFile.name}`);
        await uploadBytes(storageRef, occFile);
        arquivoUrl = await getDownloadURL(storageRef);
        arquivoNome = occFile.name;
        await addDoc(collection(db, CollectionName.EMPLOYEE_DOCS), {
          userId: user.uid, nome: occFile.name, tipo: 'atestado' as const,
          pasta: 'Atestados', url: arquivoUrl, tamanhoBytes: occFile.size,
          uploadPor: currentUser.uid, uploadEm: serverTimestamp(),
        });
      }
      await addDoc(collection(db, CollectionName.EMPLOYEE_OCCURRENCES), {
        userId: user.uid, data: occDate, tipo: occType,
        descricao: occDesc || null, arquivoUrl, arquivoNome,
        criadoPor: currentUser.uid, criadoEm: serverTimestamp(),
      });
      setOccDesc(''); setOccFile(null);
    } catch (e) { console.error(e); alert('Erro ao registrar ocorrência.'); }
    finally { setAddingOcc(false); }
  };

  const handleDeleteOccurrence = async (ocId: string, label: string) => {
    if (!window.confirm(`Excluir ocorrência "${label}"?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await deleteDoc(doc(db, CollectionName.EMPLOYEE_OCCURRENCES, ocId));
    } catch (e) { console.error(e); alert('Erro ao excluir ocorrência.'); }
  };

  // ── Certificações ──
  const handleAddCertificacao = async () => {
    if (!currentUser || !certDataObtencao) return;
    setAddingCert(true);
    try {
      let documentoUrl: string | undefined;
      let documentoNome: string | undefined;
      if (certFile) {
        const storageRef = ref(storage, `employees/${user.uid}/certificacoes/${Date.now()}_${certFile.name}`);
        await uploadBytes(storageRef, certFile);
        documentoUrl = await getDownloadURL(storageRef);
        documentoNome = certFile.name;
      }
      const nrInfo = NR_CATALOG.find(n => n.value === certTipo);
      const nomeReal = certTipo === 'OUTRO' ? certNomeCustom : (nrInfo?.label ?? certTipo);
      const dataObtTs = Timestamp.fromDate(new Date(certDataObtencao + 'T12:00:00'));
      const dataValTs = certDataValidade ? Timestamp.fromDate(new Date(certDataValidade + 'T12:00:00')) : null;
      const diasRestantes = dataValTs ? differenceInDays(dataValTs.toDate(), new Date()) : null;
      const status: CertificacaoStatus = !dataValTs ? 'valida' : diasRestantes! < 0 ? 'vencida' : diasRestantes! <= 30 ? 'vencendo' : 'valida';

      await addDoc(collection(db, CollectionName.EMPLOYEE_CERTIFICATIONS), {
        colaboradorId: user.uid,
        tipo: certTipo,
        nome: nomeReal,
        dataObtencao: dataObtTs,
        dataValidade: dataValTs,
        documentoUrl: documentoUrl || null,
        documentoNome: documentoNome || null,
        emitidoPor: certEmitidoPor || null,
        registradoPor: currentUser.uid,
        registradoPorNome: myProfile?.nomeCompleto || myProfile?.displayName || '',
        registradoEm: serverTimestamp(),
        status,
      });
      setCertNomeCustom(''); setCertDataValidade(''); setCertEmitidoPor(''); setCertFile(null);
    } catch (e) { console.error(e); alert('Erro ao registrar certificação.'); }
    finally { setAddingCert(false); }
  };

  const handleDeleteCertificacao = async (certId: string, nome: string) => {
    if (!window.confirm(`Excluir a certificação "${nome}"?`)) return;
    await deleteDoc(doc(db, CollectionName.EMPLOYEE_CERTIFICATIONS, certId));
  };

  // ── Vistorias ──
  const toggleItemStatus = (id: string) => {
    setVistoriaItens(prev => prev.map(it => {
      if (it.id !== id) return it;
      const order: VistoriaItem['status'][] = ['conforme', 'nao_conforme', 'nao_aplicavel'];
      const next = order[(order.indexOf(it.status) + 1) % 3];
      return { ...it, status: next };
    }));
  };

  const handleAddVistoria = async () => {
    if (!currentUser || !vistoriaData) return;
    setAddingVistoria(true);
    try {
      const itensUsados = vistoriaItens.filter(it => it.status !== 'nao_aplicavel');
      const conformes = itensUsados.filter(it => it.status === 'conforme').length;
      const total = itensUsados.length;
      await addDoc(collection(db, CollectionName.SUPERVISION_VISTORIAS), {
        colaboradorId: user.uid,
        colaboradorNome: nomeCompleto,
        dataVistoria: Timestamp.fromDate(new Date(vistoriaData + 'T12:00:00')),
        realizadaPor: currentUser.uid,
        realizadaPorNome: myProfile?.nomeCompleto || myProfile?.displayName || '',
        localDescricao: vistoriaLocal || null,
        osId: null,
        osNumero: null,
        itensVerificados: vistoriaItens,
        observacoesGerais: vistoriaObs || null,
        totalItens: total,
        itensConformes: conformes,
        percentualConformidade: total > 0 ? Math.round((conformes / total) * 100) : 0,
        criadoEm: serverTimestamp(),
      });
      setShowVistoriaForm(false);
      setVistoriaLocal(''); setVistoriaObs('');
      setVistoriaItens(
        Object.entries(VISTORIA_ITENS_PADRAO).flatMap(([cat, itens]) =>
          itens.map((item, i) => ({ id: `${cat}-${i}`, categoria: cat, item, status: 'conforme' as const, observacao: '' }))
        )
      );
    } catch (e) { console.error(e); alert('Erro ao registrar vistoria.'); }
    finally { setAddingVistoria(false); }
  };

  const handleDeleteVistoria = async (vid: string) => {
    if (!window.confirm('Excluir esta vistoria?')) return;
    await deleteDoc(doc(db, CollectionName.SUPERVISION_VISTORIAS, vid));
  };

  const canResetPwd = myProfile?.role === 'admin' || !!myProfile?.permissions?.canResetUserPasswords;

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'dados',         label: 'Dados',         icon: <User size={14} /> },
    { key: 'jornada',       label: 'Jornada',        icon: <Clock size={14} /> },
    { key: 'financeiro',    label: 'Financeiro',     icon: <DollarSign size={14} /> },
    { key: 'permissoes',    label: 'Permissões',     icon: <Shield size={14} /> },
    { key: 'arquivos',      label: 'Arquivos',       icon: <FolderOpen size={14} /> },
    { key: 'ocorrencias',   label: 'Ocorrências',    icon: <AlertCircle size={14} /> },
    { key: 'conhecimento',  label: 'Academy',        icon: <Award size={14} /> },
    { key: 'vistorias',     label: 'Vistorias',      icon: <ClipboardCheck size={14} /> },
    ...(canResetPwd ? [{ key: 'senha' as TabKey, label: 'Senha', icon: <KeyRound size={14} /> }] : []),
  ];

  const avatarUrl = user.photoURL || (user as any).avatar;
  const initial = (nomeCompleto || 'U').charAt(0).toUpperCase();

  // Contadores para badges na lista de tabs
  const certVencendo = userCerts.filter(c => c.status === 'vencendo').length;
  const certVencidas = userCerts.filter(c => c.status === 'vencida').length;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl h-full overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-4 bg-gray-50 flex-shrink-0">
          <div className="relative group">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-14 h-14 rounded-full object-cover border-2 border-brand-200" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl border-2 border-brand-200">{initial}</div>
            )}
            <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera size={18} className="text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={e => e.target.files && handlePhotoUpload(e.target.files[0])} />
            </label>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">{nomeCompleto}</h2>
            <p className="text-xs text-gray-500">{user.email}</p>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-[10px] text-gray-400">{(user as any).cargo || user.sectorName || 'Sem cargo definido'}</p>
              {userCerts.length > 0 && (
                <span className="text-[9px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-full font-bold">
                  {userCerts.length} cert.
                </span>
              )}
              {certVencendo > 0 && (
                <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                  ⚠ {certVencendo} venc.
                </span>
              )}
              {certVencidas > 0 && (
                <span className="text-[9px] bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full font-bold">
                  ✕ {certVencidas} vencida{certVencidas > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-200 text-gray-400"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-2 bg-white flex-shrink-0 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>{t.icon} {t.label}</button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* ── TAB: Dados Pessoais ── */}
          {tab === 'dados' && (
            <div className="space-y-3">
              <div><label className="text-xs font-bold text-gray-600 block mb-1">Nome Completo *</label>
                <input value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              <div><label className="text-xs font-bold text-gray-600 block mb-1">Email (somente leitura)</label>
                <input value={user.email} disabled className="w-full border border-gray-100 rounded-xl px-3 py-2 text-sm bg-gray-50 text-gray-500" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Cargo / Função</label>
                  <input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico de Campo" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Telefone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="text-xs font-bold text-gray-600 block mb-1">CPF</label>
                <input value={cpf} onChange={e => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>

              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-100">Qualificação Civil &amp; Admissão</h4>
              <p className="text-[10px] text-gray-400 -mt-2">Usados em contratos, declarações e demais documentos formais.</p>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Data de Admissão</label>
                  <input type="date" value={dataAdmissao} onChange={e => setDataAdmissao(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Nacionalidade</label>
                  <input value={nacionalidade} onChange={e => setNacionalidade(e.target.value)} placeholder="Brasileiro(a)" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Estado Civil</label>
                  <select value={estadoCivil} onChange={e => setEstadoCivil(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                    <option value="">Selecione...</option>
                    <option value="Solteiro(a)">Solteiro(a)</option>
                    <option value="Casado(a)">Casado(a)</option>
                    <option value="Divorciado(a)">Divorciado(a)</option>
                    <option value="Viúvo(a)">Viúvo(a)</option>
                    <option value="União Estável">União Estável</option>
                  </select></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Profissão</label>
                  <input value={profissao} onChange={e => setProfissao(e.target.value)} placeholder="Ex: Montador" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">RG</label>
                  <input value={rg} onChange={e => setRg(e.target.value)} placeholder="00.000.000-0" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">CTPS</label>
                  <input value={ctps} onChange={e => setCtps(e.target.value)} placeholder="Nº / Série" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="text-xs font-bold text-gray-600 block mb-1">Endereço Completo</label>
                <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, CEP" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>

              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide pt-2 border-t border-gray-100">Dados Bancários</h4>
              <div><label className="text-xs font-bold text-gray-600 block mb-1">Chave PIX</label>
                <input value={pix} onChange={e => setPix(e.target.value)} placeholder="CPF, e-mail ou telefone" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Banco</label>
                  <input value={banco} onChange={e => setBanco(e.target.value)} placeholder="Nubank..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Agência</label>
                  <input value={agencia} onChange={e => setAgencia(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Conta</label>
                  <input value={conta} onChange={e => setConta(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              </div>
            </div>
          )}

          {/* ── TAB: Jornada & Locais ── */}
          {tab === 'jornada' && (
            <div className="space-y-4">
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button onClick={() => setScheduleType('FIXED')} className={`flex-1 text-xs py-2 rounded-lg font-bold ${scheduleType === 'FIXED' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>Jornada Fixa</button>
                <button onClick={() => setScheduleType('FLEXIBLE')} className={`flex-1 text-xs py-2 rounded-lg font-bold ${scheduleType === 'FLEXIBLE' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>Escala Flexível</button>
              </div>
              {scheduleType === 'FIXED' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-bold text-gray-600 block mb-1">Entrada</label>
                      <input type="time" value={schedule.start} onChange={e => setSchedule({...schedule, start: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                    <div><label className="text-xs font-bold text-gray-600 block mb-1">Saída</label>
                      <input type="time" value={schedule.end} onChange={e => setSchedule({...schedule, end: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                  </div>
                  <div><label className="text-xs font-bold text-gray-600 block mb-1">Almoço (minutos)</label>
                    <input type="number" value={schedule.lunch} onChange={e => setSchedule({...schedule, lunch: parseInt(e.target.value)})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                  <div><label className="text-xs font-bold text-gray-600 block mb-1">Horas por Turno (minutos)</label>
                    <input type="number" value={schedule.dailyWorkMinutes || ''} onChange={e => setSchedule({...schedule, dailyWorkMinutes: parseInt(e.target.value) || 0})} placeholder="Ex: 540 = 9h" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                    <p className="text-[10px] text-gray-400 mt-0.5">Se preenchido, define as horas líquidas esperadas. 480=8h, 540=9h.</p></div>
                </div>
              ) : (
                <div className="space-y-2">
                  {(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'] as const).map(day => {
                    const names: Record<string,string> = { monday:'Seg', tuesday:'Ter', wednesday:'Qua', thursday:'Qui', friday:'Sex', saturday:'Sáb', sunday:'Dom' };
                    const d = flexSchedule[day] || { active: false, startTime: '08:00', lunchDuration: 60, endTime: '17:00' };
                    return (
                      <div key={day} className={`flex items-center gap-2 p-2 rounded-xl border ${d.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-50'}`}>
                        <label className="flex items-center gap-2 w-12">
                          <input type="checkbox" checked={d.active} onChange={e => setFlexSchedule({...flexSchedule, [day]: {...d, active: e.target.checked}})} className="rounded border-gray-300 text-brand-600 w-3.5 h-3.5" />
                          <span className="text-xs font-bold">{names[day]}</span>
                        </label>
                        <input disabled={!d.active} type="time" value={d.startTime} onChange={e => setFlexSchedule({...flexSchedule, [day]: {...d, startTime: e.target.value}})} className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-20" />
                        <span className="text-[10px] text-gray-400">—</span>
                        <input disabled={!d.active} type="time" value={d.endTime} onChange={e => setFlexSchedule({...flexSchedule, [day]: {...d, endTime: e.target.value}})} className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-20" />
                        <input disabled={!d.active} type="number" title="Almoço (min)" value={d.lunchDuration} onChange={e => setFlexSchedule({...flexSchedule, [day]: {...d, lunchDuration: parseInt(e.target.value)}})} className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-14 text-center" />
                        <input disabled={!d.active} type="number" title="Horas líquidas (min)" placeholder="min" value={d.dailyWorkMinutes || ''} onChange={e => setFlexSchedule({...flexSchedule, [day]: {...d, dailyWorkMinutes: parseInt(e.target.value) || 0}})} className="text-xs border border-gray-200 rounded-lg px-2 py-1 w-14 text-center" />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="pt-4 border-t border-gray-100">
                <label className="text-xs font-bold text-gray-600 block mb-2"><MapPin size={12} className="inline mr-1" />Locais Permitidos</label>
                <div className="flex flex-wrap gap-1.5">
                  {locations.map(loc => (
                    <button key={loc.id} onClick={() => setEditLocations(prev => prev.includes(loc.id) ? prev.filter(x => x !== loc.id) : [...prev, loc.id])}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium ${editLocations.includes(loc.id) ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-gray-200 text-gray-500'}`}>{loc.name}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Financeiro ── */}
          {tab === 'financeiro' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Valor Hora (R$)</label>
                  <input type="number" step="0.01" min="0" value={hourlyRate} onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Extra 50%</label>
                  <input type="number" step="0.1" min="1" value={rate50} onChange={e => setRate50(parseFloat(e.target.value) || 1.5)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
                <div><label className="text-xs font-bold text-gray-600 block mb-1">Extra 100%</label>
                  <input type="number" step="0.1" min="1" value={rate100} onChange={e => setRate100(parseFloat(e.target.value) || 2.0)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" /></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase">Saldos</h4>
                {typeof user.accumulatedPrize === 'number' && (
                  <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Saldo Bônus</span>
                    <span className="text-sm font-extrabold text-emerald-700">R$ {user.accumulatedPrize.toFixed(2)}</span></div>
                )}
                <div className="flex items-center justify-between"><span className="text-sm text-gray-600">Banco de Horas</span>
                  <div className="flex items-center gap-2">
                    <input type="number" value={timeBankBalance} onChange={e => setTimeBankBalance(parseInt(e.target.value) || 0)} className="w-20 text-xs border border-gray-200 rounded-lg px-2 py-1 text-right" />
                    <span className="text-[10px] text-gray-400">min</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Permissões ── */}
          {tab === 'permissoes' && (
            <div className="space-y-4">
              <div><label className="text-xs font-bold text-gray-600 block mb-1">Setor / Cargo</label>
                <select value={sectorId} onChange={e => handleSectorChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">Selecione um setor...</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>
              <div className="space-y-2">
                {USER_MODULES.map(mod => {
                  const enabled = modEnabled(mod, permissions);
                  return (
                    <details key={mod.id} className={`rounded-xl border overflow-hidden ${enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                      <summary className={`${mod.color} px-3 py-2.5 flex items-center gap-2 cursor-pointer list-none`}>
                        <span className={`text-xs font-bold flex-1 ${mod.txtColor}`}>{mod.label}</span>
                        <span className="text-[10px] text-gray-400">{mod.actions.filter(a => !!permissions[a.key]).length}/{mod.actions.length}</span>
                        <MiniToggle on={enabled} onChange={() => {
                          if (enabled) mod.actions.forEach(a => { if (permissions[a.key]) setPermissions(p => ({...p, [a.key]: false})); });
                          else mod.actions.forEach(a => { if (!permissions[a.key]) setPermissions(p => ({...p, [a.key]: true})); });
                        }} />
                      </summary>
                      <div className="bg-white divide-y divide-gray-50">
                        {mod.actions.map(a => {
                          const isDanger = a.key === 'canDeleteTasks';
                          return (
                          <div key={a.key} className={`px-3 py-2 flex items-center gap-2 ${isDanger ? 'bg-red-50 border-l-4 border-red-400' : ''}`}>
                            <div className="flex-1">
                              <p className={`text-xs font-medium ${isDanger ? 'text-red-700' : 'text-gray-700'}`}>{a.label}</p>
                              {a.desc && <p className={`text-[9px] ${isDanger ? 'text-red-500' : 'text-gray-400'}`}>{a.desc}</p>}
                            </div>
                            <MiniToggle on={!!permissions[a.key]} onChange={() => setPermissions(p => ({...p, [a.key]: !p[a.key]}))} />
                          </div>
                          );
                        })}
                      </div>
                    </details>
                  );
                })}
              </div>

            </div>
          )}

          {/* ── TAB: Arquivos ── */}
          {tab === 'arquivos' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><Upload size={12} /> Upload de Documento</h4>
                <div className="grid grid-cols-2 gap-2">
                  <select value={uploadPasta} onChange={e => setUploadPasta(e.target.value)} className="text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <input value={uploadSubpasta} onChange={e => setUploadSubpasta(e.target.value)} placeholder="Subpasta (opcional)" className="text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-xl cursor-pointer text-xs text-gray-500 hover:bg-white">
                    <FileText size={14} /> {uploadFile ? uploadFile.name : 'Selecionar arquivo...'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={e => setUploadFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                  <button onClick={handleDocUpload} disabled={!uploadFile || uploading}
                    className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center gap-1">
                    {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Enviar
                  </button>
                </div>
                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  <input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="Nova pasta..." className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                  <button onClick={() => { if (newFolder.trim()) { setUploadPasta(newFolder.trim()); setNewFolder(''); } }}
                    className="px-3 py-1.5 text-xs font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-lg"><Plus size={10} className="inline" /> Criar</button>
                </div>
              </div>
              {folders.map(folder => {
                const docsInFolder = userDocs.filter(d => d.pasta === folder);
                if (docsInFolder.length === 0) return null;
                return (
                  <div key={folder}>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-2">
                      <FolderOpen size={12} /> {folder} ({docsInFolder.length})
                    </h4>
                    <div className="space-y-1">
                      {docsInFolder.map(d => (
                        <div key={d.id} className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 px-3 py-2">
                          {d.nome.endsWith('.pdf') ? <FileText size={14} className="text-red-500" /> : <Image size={14} className="text-blue-500" />}
                          <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 text-xs text-gray-700 truncate hover:text-brand-600 font-medium">{d.nome}</a>
                          {d.subpasta && <span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{d.subpasta}</span>}
                          <button onClick={() => handleDeleteDoc(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {userDocs.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhum documento cadastrado.</p>}
            </div>
          )}

          {/* ── TAB: Ocorrências ── */}
          {tab === 'ocorrencias' && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1"><AlertCircle size={12} /> Registrar Ocorrência</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-[10px] font-bold text-gray-500 block mb-0.5">Data</label>
                    <input type="date" value={occDate} onChange={e => setOccDate(e.target.value)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5" /></div>
                  <div><label className="text-[10px] font-bold text-gray-500 block mb-0.5">Tipo</label>
                    <select value={occType} onChange={e => setOccType(e.target.value as OccurrenceType)} className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5">
                      {(Object.keys(OCCURRENCE_LABELS) as OccurrenceType[]).map(k => <option key={k} value={k}>{OCCURRENCE_LABELS[k]}</option>)}
                    </select></div>
                </div>
                <div><label className="text-[10px] font-bold text-gray-500 block mb-0.5">Descrição (opcional)</label>
                  <input value={occDesc} onChange={e => setOccDesc(e.target.value)} placeholder="Detalhes da ocorrência..." className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5" /></div>
                {occType === 'atestado' && (
                  <div><label className="text-[10px] font-bold text-gray-500 block mb-0.5">Upload do Atestado *</label>
                    <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-orange-300 rounded-xl cursor-pointer text-xs text-orange-600 bg-orange-50 hover:bg-orange-100">
                      <Upload size={14} /> {occFile ? occFile.name : 'Selecionar imagem do atestado...'}
                      <input type="file" accept="image/*,.pdf" onChange={e => setOccFile(e.target.files?.[0] || null)} className="hidden" />
                    </label></div>
                )}
                <button onClick={handleAddOccurrence} disabled={addingOcc || !occDate || (occType === 'atestado' && !occFile)}
                  className="w-full py-2 bg-brand-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                  {addingOcc ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Registrar Ocorrência
                </button>
              </div>
              <div className="space-y-1.5">
                {userOccs.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhuma ocorrência registrada.</p>}
                {userOccs.map(occ => (
                  <div key={occ.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                    <span className="text-xs font-bold text-gray-500 w-20 flex-shrink-0">{occ.data.split('-').reverse().join('/')}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${OCCURRENCE_COLORS[occ.tipo]}`}>{OCCURRENCE_LABELS[occ.tipo]}</span>
                    {occ.descricao && <span className="text-xs text-gray-500 truncate flex-1">{occ.descricao}</span>}
                    {!occ.descricao && <span className="flex-1" />}
                    {occ.arquivoUrl && <a href={occ.arquivoUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-800 flex-shrink-0"><Eye size={12} /></a>}
                    <button onClick={() => handleDeleteOccurrence(occ.id, `${OCCURRENCE_LABELS[occ.tipo]}${occ.descricao ? ': ' + occ.descricao : ''}`)}
                      className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB: CONHECIMENTO / ACADEMY — Certificações NR + Badges
              ══════════════════════════════════════════════════════════ */}
          {tab === 'conhecimento' && (
            <div className="space-y-5">

              {/* Badges ativos */}
              {userCerts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <BadgeCheck size={13} className="text-violet-500" /> Certificações Ativas
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {userCerts.map(cert => {
                      const style = getNrStyle(cert.tipo);
                      const isVencendo = cert.status === 'vencendo';
                      const isVencida = cert.status === 'vencida';
                      return (
                        <div key={cert.id}
                          className={`relative group flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border-2 min-w-[80px] text-center transition-all
                            ${isVencida ? 'bg-red-50 border-red-300 opacity-60' : isVencendo ? 'bg-amber-50 border-amber-300 animate-pulse' : `${style.bg} ${style.border}`}`}>
                          <Award size={22} className={isVencida ? 'text-red-400' : isVencendo ? 'text-amber-500' : style.color} />
                          <span className={`text-[10px] font-extrabold ${isVencida ? 'text-red-600' : isVencendo ? 'text-amber-700' : style.color}`}>
                            {cert.tipo}
                          </span>
                          {cert.dataValidade && (
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                              isVencida ? 'bg-red-100 text-red-700' : isVencendo ? 'bg-amber-100 text-amber-700' : 'bg-white/80 text-gray-500'
                            }`}>
                              {isVencida ? 'VENCIDA' : isVencendo ? 'VENCENDO' : format((cert.dataValidade as Timestamp).toDate(), 'MM/yyyy')}
                            </span>
                          )}
                          {/* Hover: delete */}
                          <button onClick={() => handleDeleteCertificacao(cert.id, cert.nome)}
                            className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={9} />
                          </button>
                          {/* Hover: link para documento */}
                          {cert.documentoUrl && (
                            <a href={cert.documentoUrl} target="_blank" rel="noreferrer"
                              className="absolute -bottom-1.5 -right-1.5 bg-brand-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Eye size={9} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista detalhada */}
              {userCerts.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Detalhes</h4>
                  {userCerts.map(cert => {
                    const style = getNrStyle(cert.tipo);
                    const isVencendo = cert.status === 'vencendo';
                    const isVencida = cert.status === 'vencida';
                    return (
                      <div key={cert.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                        isVencida ? 'bg-red-50 border-red-200' : isVencendo ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100'
                      }`}>
                        <Award size={16} className={isVencida ? 'text-red-400' : isVencendo ? 'text-amber-500' : style.color} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800 truncate">{cert.nome}</p>
                          <p className="text-[10px] text-gray-400">
                            Obtida: {format((cert.dataObtencao as Timestamp).toDate(), 'dd/MM/yyyy')}
                            {cert.dataValidade && ` · Validade: ${format((cert.dataValidade as Timestamp).toDate(), 'dd/MM/yyyy')}`}
                            {cert.emitidoPor && ` · ${cert.emitidoPor}`}
                          </p>
                        </div>
                        {isVencida && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full">VENCIDA</span>}
                        {isVencendo && <span className="text-[9px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full animate-pulse">VENCENDO</span>}
                        {cert.documentoUrl && <a href={cert.documentoUrl} target="_blank" rel="noreferrer" className="text-brand-500 hover:text-brand-700"><Eye size={12} /></a>}
                        <button onClick={() => handleDeleteCertificacao(cert.id, cert.nome)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Formulário de registro */}
              <div className="bg-violet-50 rounded-xl border border-violet-200 p-4 space-y-3">
                <h4 className="text-xs font-bold text-violet-700 uppercase flex items-center gap-1.5">
                  <Plus size={12} /> Registrar Nova Certificação
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Certificação *</label>
                    <select value={certTipo} onChange={e => setCertTipo(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                      {NR_CATALOG.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Data de Obtenção *</label>
                    <input type="date" value={certDataObtencao} onChange={e => setCertDataObtencao(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
                  </div>
                </div>

                {certTipo === 'OUTRO' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Nome da certificação *</label>
                    <input value={certNomeCustom} onChange={e => setCertNomeCustom(e.target.value)}
                      placeholder="Ex: Curso de Refrigeração Industrial" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Validade (opcional)</label>
                    <input type="date" value={certDataValidade} onChange={e => setCertDataValidade(e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
                    <p className="text-[9px] text-gray-400 mt-0.5">Deixe em branco se não houver validade</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Instituição Emissora</label>
                    <input value={certEmitidoPor} onChange={e => setCertEmitidoPor(e.target.value)}
                      placeholder="Ex: SENAI, empresa..." className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Certificado (opcional)</label>
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-violet-300 rounded-xl cursor-pointer text-xs text-violet-600 bg-white hover:bg-violet-50">
                    <Upload size={13} /> {certFile ? certFile.name : 'Anexar PDF ou imagem do certificado...'}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files?.[0] || null)} className="hidden" />
                  </label>
                </div>

                <button onClick={handleAddCertificacao}
                  disabled={addingCert || !certDataObtencao || (certTipo === 'OUTRO' && !certNomeCustom)}
                  className="w-full py-2 bg-violet-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-violet-700">
                  {addingCert ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />} Registrar Certificação
                </button>
              </div>

              {userCerts.length === 0 && !addingCert && (
                <p className="text-xs text-gray-400 text-center py-4">Nenhuma certificação registrada. Use o formulário acima para adicionar.</p>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB: VISTORIAS DE SUPERVISÃO
              ══════════════════════════════════════════════════════════ */}
          {tab === 'vistorias' && (
            <div className="space-y-4">

              {/* Botão abrir formulário */}
              {!showVistoriaForm && (
                <button onClick={() => setShowVistoriaForm(true)}
                  className="w-full py-2.5 border-2 border-dashed border-brand-300 text-brand-700 rounded-xl text-xs font-bold hover:bg-brand-50 flex items-center justify-center gap-2">
                  <Plus size={14} /> Nova Vistoria de Supervisão
                </button>
              )}

              {/* Formulário de nova vistoria */}
              {showVistoriaForm && (
                <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-blue-700 uppercase flex items-center gap-1.5">
                      <ClipboardCheck size={13} /> Nova Vistoria de Supervisão
                    </h4>
                    <button onClick={() => setShowVistoriaForm(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Data da Vistoria *</label>
                      <input type="date" value={vistoriaData} onChange={e => setVistoriaData(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Local / Cliente</label>
                      <input value={vistoriaLocal} onChange={e => setVistoriaLocal(e.target.value)}
                        placeholder="Ex: Indaiá Pescados" className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white" />
                    </div>
                  </div>

                  {/* Checklist de itens por categoria */}
                  {VISTORIA_CATEGORIAS.map(cat => {
                    const itensCat = vistoriaItens.filter(it => it.categoria === cat);
                    return (
                      <div key={cat}>
                        <h5 className="text-[10px] font-bold text-gray-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                          <ChevronRight size={10} /> {cat}
                        </h5>
                        <div className="space-y-1">
                          {itensCat.map(it => (
                            <div key={it.id} className="flex items-center gap-2 bg-white rounded-lg border border-gray-100 px-2.5 py-1.5">
                              <button onClick={() => toggleItemStatus(it.id)}
                                className={`flex-shrink-0 rounded-full p-0.5 transition-colors ${
                                  it.status === 'conforme' ? 'text-emerald-600 hover:text-emerald-700' :
                                  it.status === 'nao_conforme' ? 'text-red-600 hover:text-red-700' :
                                  'text-gray-300 hover:text-gray-400'
                                }`}>
                                {it.status === 'conforme' && <CheckCircle size={16} />}
                                {it.status === 'nao_conforme' && <XCircle size={16} />}
                                {it.status === 'nao_aplicavel' && <MinusCircle size={16} />}
                              </button>
                              <span className={`text-xs flex-1 ${it.status === 'nao_aplicavel' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {it.item}
                              </span>
                              {it.status === 'nao_conforme' && (
                                <input
                                  value={it.observacao || ''}
                                  onChange={e => setVistoriaItens(prev => prev.map(x => x.id === it.id ? {...x, observacao: e.target.value} : x))}
                                  placeholder="Detalhe..."
                                  className="text-[10px] border border-red-200 rounded px-1.5 py-0.5 w-28 bg-red-50"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Resumo em tempo real */}
                  <div className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-3 py-2">
                    {(() => {
                      const usados = vistoriaItens.filter(it => it.status !== 'nao_aplicavel');
                      const conf = usados.filter(it => it.status === 'conforme').length;
                      const nconf = usados.filter(it => it.status === 'nao_conforme').length;
                      const pct = usados.length > 0 ? Math.round((conf / usados.length) * 100) : 0;
                      return (
                        <>
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-2 rounded-full transition-all ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`text-xs font-extrabold ${pct >= 80 ? 'text-emerald-700' : pct >= 50 ? 'text-amber-700' : 'text-red-700'}`}>{pct}%</span>
                          <span className="text-[10px] text-gray-400">{conf} conf. · {nconf} NC</span>
                        </>
                      );
                    })()}
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-gray-500 block mb-0.5">Observações gerais</label>
                    <textarea value={vistoriaObs} onChange={e => setVistoriaObs(e.target.value)}
                      placeholder="Observações adicionais da vistoria..." rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white resize-none" />
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setShowVistoriaForm(false)}
                      className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50">
                      Cancelar
                    </button>
                    <button onClick={handleAddVistoria} disabled={addingVistoria || !vistoriaData}
                      className="flex-1 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-brand-700">
                      {addingVistoria ? <Loader2 size={12} className="animate-spin" /> : <ClipboardCheck size={12} />} Salvar Vistoria
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de vistorias anteriores */}
              <div className="space-y-3">
                {userVistorias.length === 0 && !showVistoriaForm && (
                  <p className="text-xs text-gray-400 text-center py-8">Nenhuma vistoria registrada para este colaborador.</p>
                )}
                {userVistorias.map(v => {
                  const pct = v.percentualConformidade;
                  const naoConformes = v.itensVerificados.filter(it => it.status === 'nao_conforme');
                  return (
                    <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      {/* Header da vistoria */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-extrabold flex-shrink-0 ${
                          pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {pct}%
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-gray-800">
                            {format((v.dataVistoria as Timestamp).toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {v.localDescricao && `${v.localDescricao} · `}
                            por {v.realizadaPorNome} · {v.itensConformes}/{v.totalItens} conformes
                          </p>
                        </div>
                        <button onClick={() => handleDeleteVistoria(v.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0"><Trash2 size={13} /></button>
                      </div>

                      {/* Barra de conformidade */}
                      <div className="px-4 py-2">
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-1.5 rounded-full ${pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>

                      {/* Itens Não Conformes */}
                      {naoConformes.length > 0 && (
                        <div className="px-4 pb-3 space-y-1">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide">Não conformidades:</p>
                          {naoConformes.map(it => (
                            <div key={it.id} className="flex items-start gap-1.5">
                              <XCircle size={10} className="text-red-500 mt-0.5 flex-shrink-0" />
                              <span className="text-[10px] text-red-700">
                                <strong>{it.categoria}:</strong> {it.item}
                                {it.observacao && ` — ${it.observacao}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Observações gerais */}
                      {v.observacoesGerais && (
                        <div className="px-4 pb-3">
                          <p className="text-[10px] text-gray-500 italic">{v.observacoesGerais}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              TAB: SENHA — Redefinir senha de colaborador
              ══════════════════════════════════════════════════════════ */}
          {tab === 'senha' && canResetPwd && (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <KeyRound size={15} className="text-orange-600" />
                  <h3 className="text-sm font-bold text-orange-800">Redefinir Senha Temporária</h3>
                </div>
                <p className="text-xs text-orange-700">
                  Define uma senha temporária para que <strong>{user.nomeCompleto || user.displayName}</strong> possa fazer login.
                  Comunique a senha por outro canal (WhatsApp, pessoalmente, etc.).
                </p>
              </div>

              {resetPwdSuccess ? (
                <div className="flex items-center gap-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-4">
                  <CheckCircle size={20} className="flex-shrink-0" />
                  <div>
                    <p className="font-bold">Senha temporária definida com sucesso!</p>
                    <p className="text-xs text-green-600 mt-0.5">
                      Informe a senha ao colaborador. Ele precisará alterá-la no próximo acesso.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Nova senha temporária <span className="font-normal text-gray-400">(mín. 8 caracteres)</span></label>
                    <div className="relative">
                      <input
                        type={showTempPwd ? 'text' : 'password'}
                        value={tempPassword}
                        onChange={e => setTempPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pr-10 p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                      <button type="button" onClick={() => setShowTempPwd(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showTempPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">Confirmar senha temporária</label>
                    <input
                      type={showTempPwd ? 'text' : 'password'}
                      value={confirmTempPassword}
                      onChange={e => setConfirmTempPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full p-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>

                  {resetPwdError && (
                    <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                      <AlertTriangle size={13} className="flex-shrink-0" /> {resetPwdError}
                    </div>
                  )}

                  <button
                    onClick={handleResetPassword}
                    disabled={resetPwdLoading || !tempPassword || !confirmTempPassword}
                    className="w-full py-3 bg-orange-600 text-white rounded-xl text-sm font-bold hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                  >
                    {resetPwdLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    {resetPwdLoading ? 'Redefinindo...' : 'Definir Senha Temporária'}
                  </button>

                  <p className="text-[10px] text-gray-400 text-center">
                    A senha é alterada imediatamente via Firebase Admin. O colaborador será solicitado a trocar no próximo acesso.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer — only show Save for tabs that have persistent state */}
        {['dados','jornada','financeiro','permissoes'].includes(tab) && (
          <div className="px-5 py-3 border-t border-gray-200 bg-white flex justify-end gap-2 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Fechar</button>
            <button onClick={saveAll} disabled={saving}
              className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Tudo
            </button>
          </div>
        )}
        {!['dados','jornada','financeiro','permissoes'].includes(tab) && (
          <div className="px-5 py-3 border-t border-gray-200 bg-white flex justify-end flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MODAL: NOVO COLABORADOR — Admin cria conta diretamente (sem autocadastro)
   ═══════════════════════════════════════════════════════════════════════════ */
const NewEmployeeModal: React.FC<{
  sectors: Sector[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ sectors, onClose, onCreated }) => {
  const [nomeCompleto, setNomeCompleto] = useState('');
  const [email, setEmail] = useState('');
  const [cargo, setCargo] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [confirmTempPassword, setConfirmTempPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleCreate = async () => {
    setError('');
    if (!nomeCompleto.trim()) { setError('Informe o nome completo.'); return; }
    if (!email.trim() || !email.includes('@')) { setError('Informe um e-mail válido.'); return; }
    if (tempPassword.length < 8) { setError('A senha temporária deve ter pelo menos 8 caracteres.'); return; }
    if (tempPassword !== confirmTempPassword) { setError('As senhas não coincidem.'); return; }

    setCreating(true);
    try {
      const sector = sectors.find(s => s.id === sectorId);
      const createFn = httpsCallable(functions, 'adminCreateUser');
      await createFn({
        email: email.trim(),
        password: tempPassword,
        nomeCompleto: nomeCompleto.trim(),
        cargo: cargo.trim() || null,
        sectorId: sectorId || null,
        sectorName: sector?.name || null,
        permissions: sector?.defaultPermissions || null,
      });
      setSuccess(true);
      setTimeout(() => onCreated(), 1200);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao criar colaborador.';
      setError(msg.replace('FirebaseError: ', '').replace('functions/', ''));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2"><UserPlus size={18} className="text-brand-600" /> Novo Colaborador</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400"><X size={18} /></button>
        </div>

        {success ? (
          <div className="p-6 flex flex-col items-center gap-2 text-center">
            <CheckCircle size={32} className="text-emerald-500" />
            <p className="text-sm font-bold text-gray-800">Colaborador criado com sucesso!</p>
            <p className="text-xs text-gray-500">A conta já está ativa. Informe a senha temporária por outro canal.</p>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Nome Completo *</label>
              <input value={nomeCompleto} onChange={e => setNomeCompleto(e.target.value)} placeholder="Ex: João da Silva"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">E-mail *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="colaborador@mgr.com"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Cargo / Função</label>
                <input value={cargo} onChange={e => setCargo(e.target.value)} placeholder="Ex: Técnico de Campo"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Setor</label>
                <select value={sectorId} onChange={e => setSectorId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                  <option value="">Selecione...</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-100">
              <label className="text-xs font-bold text-gray-600 block mb-1">Senha temporária * <span className="font-normal text-gray-400">(mín. 8 caracteres)</span></label>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={tempPassword} onChange={e => setTempPassword(e.target.value)}
                  placeholder="••••••••" className="w-full pr-10 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Confirmar senha</label>
              <input type={showPwd ? 'text' : 'password'} value={confirmTempPassword} onChange={e => setConfirmTempPassword(e.target.value)}
                placeholder="••••••••" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertTriangle size={13} className="flex-shrink-0" /> {error}
              </div>
            )}

            <p className="text-[10px] text-gray-400">
              O colaborador poderá acessar imediatamente com o e-mail e a senha temporária. Ele será solicitado a trocar a senha no primeiro acesso.
            </p>
          </div>
        )}

        {!success && (
          <div className="px-5 py-3 border-t border-gray-200 bg-white flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button onClick={handleCreate} disabled={creating}
              className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />} Criar Colaborador
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN USERS COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
const Users: React.FC = () => {
  const { userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [occurrences, setOccurrences] = useState<EmployeeOccurrence[]>([]);
  const [certifications, setCertifications] = useState<ColaboradorCertificacao[]>([]);
  const [vistorias, setVistorias] = useState<VistoriaSupervisao[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [pendingResets, setPendingResets] = useState<PasswordResetRequest[]>([]);
  const [resolvingReset, setResolvingReset] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamTab, setTeamTab] = useState<'ativos' | 'arquivados'>('ativos');
  const [togglingActive, setTogglingActive] = useState<string | null>(null);

  const isAdmin = userProfile?.role === 'admin';
  const canResetPasswords = isAdmin || !!userProfile?.permissions?.canResetUserPasswords;
  const masterEmail = (import.meta.env.VITE_MASTER_EMAIL || '').toLowerCase();

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    const unsub1 = onSnapshot(query(collection(db, CollectionName.USERS), orderBy('displayName', 'asc')), (snap: QuerySnapshot<DocumentData>) => {
      // Usuários com role 'cliente' (acesso ao Portal do Cliente) têm cadastro,
      // edição e natureza completamente diferentes dos colaboradores internos —
      // são geridos em Gestão de Clientes → aba Usuários (ClientPortalUsers.tsx),
      // não aqui. Exclui pra não misturar as duas listas nem abrir o painel de
      // colaborador (EmployeeDetailPanel) num registro de cliente.
      const colaboradores = snap.docs
        .map(d => ({ ...(d.data() as any), uid: d.id } as UserProfile))
        .filter(u => u.role !== 'cliente');
      setUsers(colaboradores);
      setLoading(false);
    });
    getDocs(collection(db, CollectionName.WORK_LOCATIONS)).then(snap => setLocations(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as WorkLocation)))).catch(() => {});
    getDocs(query(collection(db, CollectionName.SECTORS), orderBy('name'))).then(snap => setSectors(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Sector)))).catch(() => {});
    const unsub2 = onSnapshot(collection(db, CollectionName.EMPLOYEE_DOCS), snap => setDocuments(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as EmployeeDocument))));
    const unsub3 = onSnapshot(collection(db, CollectionName.EMPLOYEE_OCCURRENCES), snap => setOccurrences(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as EmployeeOccurrence))));
    const unsub4 = onSnapshot(collection(db, CollectionName.EMPLOYEE_CERTIFICATIONS), snap => setCertifications(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as ColaboradorCertificacao))));
    const unsub5 = onSnapshot(collection(db, CollectionName.SUPERVISION_VISTORIAS), snap => setVistorias(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as VistoriaSupervisao))));
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  }, [isAdmin]);

  // Deep-link vindo de "Gestão Geral de Usuários" (/app/usuarios-geral) — abre
  // direto o painel do colaborador indicado, uma única vez por navegação.
  useEffect(() => {
    const openUid = (location.state as any)?.openUid;
    if (!openUid || users.length === 0) return;
    const target = users.find(u => u.uid === openUid);
    if (target) setSelectedUser(target);
    navigate(location.pathname, { replace: true, state: {} });
  }, [users, location.state]);

  // Pedidos de redefinição de senha pendentes
  useEffect(() => {
    if (!canResetPasswords) return;
    const q = query(
      collection(db, CollectionName.PASSWORD_RESET_REQUESTS),
      where('status', '==', 'pending'),
      orderBy('requestedAt', 'desc')
    );
    return onSnapshot(q, snap => {
      setPendingResets(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as PasswordResetRequest)));
    });
  }, [canResetPasswords]);

  const handleResolveRequest = async (requestId: string, userUid?: string) => {
    setResolvingReset(requestId);
    try {
      await updateDoc(doc(db, CollectionName.PASSWORD_RESET_REQUESTS, requestId), {
        status: 'resolved',
        resolvedAt: serverTimestamp(),
        resolvedBy: userProfile?.uid,
        resolvedByName: userProfile?.displayName || userProfile?.nomeCompleto,
      });
      // Se encontrou o usuário, abre o painel dele
      if (userUid) {
        const targetUser = users.find(u => u.uid === userUid);
        if (targetUser) setSelectedUser(targetUser);
      }
    } catch (e) { console.error(e); }
    finally { setResolvingReset(null); }
  };

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    await updateDoc(doc(db, CollectionName.USERS, uid), { role: newRole });
  };

  const handleToggleActive = async (u: UserProfile, ativo: boolean) => {
    const label = ativo ? 'reativar' : 'desativar';
    const confirmMsg = ativo
      ? `Reativar ${u.nomeCompleto || u.displayName}? O colaborador volta a ter acesso ao sistema.`
      : `Desativar ${u.nomeCompleto || u.displayName}?\n\nEle perde o acesso ao sistema e some das novas atividades, mas todo o histórico (documentos, ocorrências, O.S., ponto) é mantido e o colaborador vai para "Equipe Arquivada".`;
    if (!window.confirm(confirmMsg)) return;
    setTogglingActive(u.uid);
    try {
      const fn = httpsCallable(functions, 'adminSetUserActive');
      await fn({ targetUid: u.uid, ativo });
    } catch (e: any) {
      alert(e?.message?.replace('FirebaseError: ', '').replace('functions/', '') || `Erro ao ${label} colaborador.`);
    } finally {
      setTogglingActive(null);
    }
  };

  const activeCount = users.filter(u => u.ativo !== false).length;
  const archivedCount = users.filter(u => u.ativo === false).length;

  const filteredUsers = users.filter(u => {
    const name = (u.nomeCompleto || u.displayName || '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchesTab = teamTab === 'ativos' ? u.ativo !== false : u.ativo === false;
    return matchesSearch && matchesTab;
  });

  if (!isAdmin) return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
      <p className="text-gray-500">Apenas administradores podem gerenciar usuários.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><UsersIcon className="w-6 h-6 text-brand-600" /> Gestão de Equipe & RH</h1>
          <p className="text-sm text-gray-500">Gerencie colaboradores, jornadas, permissões e documentos</p>
        </div>
        <button onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 shadow-sm flex-shrink-0">
          <UserPlus size={16} /> Novo Colaborador
        </button>
      </div>

      {/* Tabs: Ativos / Arquivados */}
      <div className="flex bg-gray-100 rounded-xl p-1 max-w-sm">
        <button onClick={() => setTeamTab('ativos')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-bold ${teamTab === 'ativos' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
          Ativos <span className="text-[10px] opacity-70">({activeCount})</span>
        </button>
        <button onClick={() => setTeamTab('arquivados')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs py-2 rounded-lg font-bold ${teamTab === 'arquivados' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
          <Archive size={12} /> Arquivados <span className="text-[10px] opacity-70">({archivedCount})</span>
        </button>
      </div>

      {/* ── Banner: pedidos de redefinição de senha pendentes ── */}
      {canResetPasswords && pendingResets.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-orange-600 animate-pulse" />
            <h3 className="text-sm font-bold text-orange-800">
              {pendingResets.length} pedido{pendingResets.length > 1 ? 's' : ''} de acesso temporário
            </h3>
          </div>
          <div className="space-y-2">
            {pendingResets.map(req => (
              <div key={req.id} className="bg-white rounded-xl border border-orange-100 px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <KeyRound size={14} className="text-orange-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">
                    {req.displayName || req.email}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{req.email}</p>
                  <p className="text-[10px] text-orange-600 mt-0.5">
                    Solicitou acesso temporário
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {req.uid && (
                    <button
                      onClick={() => handleResolveRequest(req.id!, req.uid)}
                      disabled={resolvingReset === req.id}
                      className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      {resolvingReset === req.id ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />}
                      Atender
                    </button>
                  )}
                  <button
                    onClick={() => handleResolveRequest(req.id!)}
                    disabled={resolvingReset === req.id}
                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg font-bold hover:bg-gray-200 disabled:opacity-50"
                    title="Marcar como resolvido sem abrir perfil"
                  >
                    Dispensar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Buscar colaborador..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl" />
        </div>
        <span className="text-xs text-gray-500 font-bold">{filteredUsers.length} colaboradores</span>
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-400">
          {teamTab === 'arquivados' ? 'Nenhum colaborador arquivado.' : 'Nenhum colaborador encontrado.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(user => {
            const name = user.nomeCompleto || user.displayName || nameFromEmail(user.email);
            const avatarUrl = user.photoURL || (user as any).avatar;
            const initial = name.charAt(0).toUpperCase();
            const userOccs = occurrences.filter(o => o.userId === user.uid);
            const userDocs = documents.filter(d => d.userId === user.uid);
            const userCerts = certifications.filter(c => c.colaboradorId === user.uid);
            const certVencendo = userCerts.filter(c => c.status === 'vencendo' || c.status === 'vencida').length;
            const isArchived = user.ativo === false;
            const isMaster = user.email?.toLowerCase() === masterEmail;
            const isSelf = user.uid === userProfile?.uid;
            return (
              <div key={user.uid} className={`bg-white rounded-2xl border p-4 flex items-center gap-4 transition-all ${
                isArchived ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:shadow-sm hover:border-brand-200'
              }`}>
                {/* Avatar */}
                <div className="flex-shrink-0 relative">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className={`w-12 h-12 rounded-full object-cover border border-gray-200 ${isArchived ? 'grayscale' : ''}`} />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${isArchived ? 'bg-gray-100 text-gray-500' : 'bg-brand-100 text-brand-700'}`}>{initial}</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate flex items-center gap-1.5">
                    {name}
                    {isArchived && <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1"><Archive size={9} /> Arquivado</span>}
                  </h3>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {user.sectorName && <span className="text-[9px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-bold">{user.sectorName}</span>}
                    {(user as any).cargo && <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{(user as any).cargo}</span>}
                    {userDocs.length > 0 && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{userDocs.length} docs</span>}
                    {userOccs.length > 0 && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{userOccs.length} ocorr.</span>}
                    {userCerts.length > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${certVencendo > 0 ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>
                        {certVencendo > 0 ? `⚠ ${certVencendo} cert. venc.` : `${userCerts.length} cert.`}
                      </span>
                    )}
                    {isArchived && user.desligadoEm && (
                      <span className="text-[9px] text-gray-400">
                        desligado em {(user.desligadoEm as Timestamp).toDate?.().toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role select */}
                <select value={user.role} onChange={e => handleRoleChange(user.uid, e.target.value as UserRole)}
                  disabled={isMaster || isArchived}
                  className="text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-gray-700 cursor-pointer disabled:opacity-50">
                  <option value="pending">Pendente</option>
                  <option value="employee">Colaborador</option>
                  <option value="technician">Técnico</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>

                {/* Ativar/Desativar */}
                {!isMaster && !isSelf && (
                  <button
                    onClick={() => handleToggleActive(user, isArchived)}
                    disabled={togglingActive === user.uid}
                    title={isArchived ? 'Reativar colaborador' : 'Desativar colaborador'}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shadow-sm disabled:opacity-50 ${
                      isArchived ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                    }`}>
                    {togglingActive === user.uid ? <Loader2 size={13} className="animate-spin" /> : isArchived ? <RotateCcw size={13} /> : <UserX size={13} />}
                    {isArchived ? 'Reativar' : 'Desativar'}
                  </button>
                )}

                {/* Edit button */}
                <button onClick={() => setSelectedUser(user)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 shadow-sm">
                  <Settings size={13} /> Editar
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Panel */}
      {selectedUser && (
        <EmployeeDetailPanel
          user={selectedUser} locations={locations} sectors={sectors}
          documents={documents} occurrences={occurrences}
          certifications={certifications} vistorias={vistorias}
          onClose={() => setSelectedUser(null)}
          onSaved={() => setSelectedUser(null)} />
      )}

      {/* Modal: Novo Colaborador */}
      {showCreateModal && (
        <NewEmployeeModal
          sectors={sectors}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

export default Users;

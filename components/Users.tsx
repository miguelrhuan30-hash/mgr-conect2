/**
 * components/Users.tsx — Sprint 48
 * Módulo Equipe & RH: Lista de colaboradores + Painel unificado de edição com 6 abas.
 */
import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, addDoc, deleteDoc, serverTimestamp, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
  CollectionName, UserProfile, UserRole, WorkLocation, Sector, PermissionSet,
  EmployeeDocument, EmployeeOccurrence, OccurrenceType, OCCURRENCE_LABELS, OCCURRENCE_COLORS
} from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import {
  Users as UsersIcon, ShieldCheck, Loader2, Camera, MapPin, Clock,
  Settings, FileText, Briefcase, Package, DollarSign, X, Save, Shield,
  AlertTriangle, Search, ChevronRight, FolderOpen, Upload, Trash2,
  Plus, User, Calendar, AlertCircle, Eye, Image, ChevronDown, ChevronUp,
  Trophy, Brain, Kanban, Wrench, Receipt, BarChart3, Car, Target,
  CheckSquare, CalendarDays,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const INITIAL_PERMISSIONS: PermissionSet = {
  canManageUsers: false, canManageSettings: false, canManageSectors: false, canViewLogs: false,
  canRegisterAttendance: true, canViewAttendanceReports: false, canManageAttendance: false, requiresTimeClock: false,
  canViewTasks: true, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false,
  canManageProjects: false, canViewSchedule: false, canViewFullSchedule: false, canViewMySchedule: true,
  canViewFinancials: false, canManageClients: false,
  canViewInventory: false, canManageInventory: false,
  canViewRanking: true, canViewBI: false, canViewVehicles: false,
};

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
      { key: 'canViewMySchedule', label: 'Minha Agenda' }, { key: 'canViewFullSchedule', label: 'Agenda Completa' },
      { key: 'canViewSchedule', label: 'Agenda / Gantt' }, { key: 'canCreateTasks', label: 'Criar Nova O.S.' },
      { key: 'canEditTasks', label: 'Editar O.S.' }, { key: 'canDeleteTasks', label: 'Excluir O.S.' },
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
  { id: 'bi', label: 'BI & Inteligência', color: 'bg-indigo-50', txtColor: 'text-indigo-700',
    actions: [{ key: 'canViewBI', label: 'BI Dashboard' }] },
  { id: 'admin', label: 'Administração', color: 'bg-red-50', txtColor: 'text-red-700',
    actions: [
      { key: 'canManageUsers', label: 'Gerenciar Usuários' }, { key: 'canManageSectors', label: 'Gerenciar Cargos & Acessos' },
      { key: 'canManageSettings', label: 'Configurações do Sistema' }, { key: 'canViewLogs', label: 'Log do Sistema' },
    ] },
];
const modEnabled = (mod: UM, p: PermissionSet) => mod.actions.some(a => !!p[a.key]);

/** Auto-preenche nomeCompleto a partir do email */
const nameFromEmail = (email: string): string => {
  const local = email.split('@')[0] || '';
  return local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

type TabKey = 'dados' | 'jornada' | 'financeiro' | 'permissoes' | 'arquivos' | 'ocorrencias';

/* ═══════════════════════════════════════════════════════════════════════════
   EMPLOYEE DETAIL PANEL — unified editing panel with 6 tabs
   ═══════════════════════════════════════════════════════════════════════════ */
const EmployeeDetailPanel: React.FC<{
  user: UserProfile;
  locations: WorkLocation[];
  sectors: Sector[];
  documents: EmployeeDocument[];
  occurrences: EmployeeOccurrence[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ user, locations, sectors, documents, occurrences, onClose, onSaved }) => {
  const { currentUser, userProfile: myProfile } = useAuth();
  const [tab, setTab] = useState<TabKey>('dados');
  const [saving, setSaving] = useState(false);

  // ── Dados Pessoais ──
  const [nomeCompleto, setNomeCompleto] = useState(user.nomeCompleto || user.displayName || nameFromEmail(user.email));
  const [cargo, setCargo] = useState((user as any).cargo || '');
  const [cpf, setCpf] = useState((user as any).cpf || '');
  const [phone, setPhone] = useState((user as any).phone || '');
  const [pix, setPix] = useState((user as any).pixKey || '');
  const [banco, setBanco] = useState((user as any).banco || '');
  const [conta, setConta] = useState((user as any).conta || '');
  const [agencia, setAgencia] = useState((user as any).agencia || '');

  // ── Jornada ──
  const [scheduleType, setScheduleType] = useState<'FIXED'|'FLEXIBLE'>(user.scheduleType || 'FIXED');
  const [schedule, setSchedule] = useState({ start: user.workSchedule?.startTime || '08:00', lunch: user.workSchedule?.lunchDuration || 60, end: user.workSchedule?.endTime || '17:00' });
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

  // ── Ocorrências (new) ──
  const [occDate, setOccDate] = useState(new Date().toISOString().slice(0, 10));
  const [occType, setOccType] = useState<OccurrenceType>('falta_injustificada');
  const [occDesc, setOccDesc] = useState('');
  const [occFile, setOccFile] = useState<File | null>(null);
  const [addingOcc, setAddingOcc] = useState(false);

  // ── Arquivos (new) ──
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPasta, setUploadPasta] = useState('Documentos');
  const [uploadSubpasta, setUploadSubpasta] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newFolder, setNewFolder] = useState('');

  const userDocs = documents.filter(d => d.userId === user.uid);
  const userOccs = occurrences.filter(o => o.userId === user.uid).sort((a, b) => b.data.localeCompare(a.data));
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
        ? { startTime: schedule.start, lunchDuration: schedule.lunch, endTime: schedule.end }
        : { ...flexSchedule, startTime: schedule.start, lunchDuration: schedule.lunch, endTime: schedule.end };
      const sectorName = sectors.find(s => s.id === sectorId)?.name || '';
      await updateDoc(doc(db, CollectionName.USERS, user.uid), {
        nomeCompleto, cargo: cargo || null, cpf: cpf || null, phone: phone || null,
        pixKey: pix || null, banco: banco || null, conta: conta || null, agencia: agencia || null,
        scheduleType, workSchedule: ws, allowedLocationIds: editLocations,
        hourlyRate, overtimeRules: { rate50, rate100 }, timeBankBalance,
        sectorId, sectorName, permissions, hasCustomPermissions: true,
      });
      onSaved();
    } catch (e) { console.error(e); alert('Erro ao salvar.'); }
    finally { setSaving(false); }
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
        // Also save in EMPLOYEE_DOCS under "Atestados" folder
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

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'dados', label: 'Dados', icon: <User size={14} /> },
    { key: 'jornada', label: 'Jornada', icon: <Clock size={14} /> },
    { key: 'financeiro', label: 'Financeiro', icon: <DollarSign size={14} /> },
    { key: 'permissoes', label: 'Permissões', icon: <Shield size={14} /> },
    { key: 'arquivos', label: 'Arquivos', icon: <FolderOpen size={14} /> },
    { key: 'ocorrencias', label: 'Ocorrências', icon: <AlertCircle size={14} /> },
  ];

  const avatarUrl = user.photoURL || (user as any).avatar;
  const initial = (nomeCompleto || 'U').charAt(0).toUpperCase();

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
            <p className="text-[10px] text-gray-400">{(user as any).cargo || user.sectorName || 'Sem cargo definido'}</p>
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
                        {mod.actions.map(a => (
                          <div key={a.key} className="px-3 py-2 flex items-center gap-2">
                            <div className="flex-1"><p className="text-xs text-gray-700">{a.label}</p>
                              {a.desc && <p className="text-[9px] text-gray-400">{a.desc}</p>}</div>
                            <MiniToggle on={!!permissions[a.key]} onChange={() => setPermissions(p => ({...p, [a.key]: !p[a.key]}))} />
                          </div>
                        ))}
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
              {/* Upload */}
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
                {/* Create folder */}
                <div className="flex gap-2 pt-2 border-t border-gray-200">
                  <input value={newFolder} onChange={e => setNewFolder(e.target.value)} placeholder="Nova pasta..." className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5" />
                  <button onClick={() => { if (newFolder.trim()) { setUploadPasta(newFolder.trim()); setNewFolder(''); } }}
                    className="px-3 py-1.5 text-xs font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-lg"><Plus size={10} className="inline" /> Criar</button>
                </div>
              </div>

              {/* File listing by folder */}
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
              {/* New occurrence form */}
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

              {/* Occurrence list */}
              <div className="space-y-1.5">
                {userOccs.length === 0 && <p className="text-xs text-gray-400 text-center py-8">Nenhuma ocorrência registrada.</p>}
                {userOccs.map(occ => (
                  <div key={occ.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 px-3 py-2.5">
                    <span className="text-xs font-bold text-gray-500 w-20">{occ.data.split('-').reverse().join('/')}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${OCCURRENCE_COLORS[occ.tipo]}`}>{OCCURRENCE_LABELS[occ.tipo]}</span>
                    {occ.descricao && <span className="text-xs text-gray-500 truncate flex-1">{occ.descricao}</span>}
                    {occ.arquivoUrl && <a href={occ.arquivoUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-800"><Eye size={12} /></a>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-white flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Fechar</button>
          <button onClick={saveAll} disabled={saving}
            className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Tudo
          </button>
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN USERS COMPONENT — List + Detail Panel
   ═══════════════════════════════════════════════════════════════════════════ */
const Users: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [documents, setDocuments] = useState<EmployeeDocument[]>([]);
  const [occurrences, setOccurrences] = useState<EmployeeOccurrence[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    const unsub1 = onSnapshot(query(collection(db, CollectionName.USERS), orderBy('displayName', 'asc')), (snap: QuerySnapshot<DocumentData>) => {
      setUsers(snap.docs.map(d => ({ ...(d.data() as any), uid: d.id } as UserProfile)));
      setLoading(false);
    });
    getDocs(collection(db, CollectionName.WORK_LOCATIONS)).then(snap => setLocations(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as WorkLocation)))).catch(() => {});
    getDocs(query(collection(db, CollectionName.SECTORS), orderBy('name'))).then(snap => setSectors(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Sector)))).catch(() => {});
    const unsub2 = onSnapshot(collection(db, CollectionName.EMPLOYEE_DOCS), snap => setDocuments(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as EmployeeDocument))));
    const unsub3 = onSnapshot(collection(db, CollectionName.EMPLOYEE_OCCURRENCES), snap => setOccurrences(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as EmployeeOccurrence))));
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [isAdmin]);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    await updateDoc(doc(db, CollectionName.USERS, uid), { role: newRole });
  };

  const filteredUsers = users.filter(u => {
    const name = (u.nomeCompleto || u.displayName || '').toLowerCase();
    return name.includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
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
      </div>

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
      ) : (
        <div className="space-y-2">
          {filteredUsers.map(user => {
            const name = user.nomeCompleto || user.displayName || nameFromEmail(user.email);
            const avatarUrl = user.photoURL || (user as any).avatar;
            const initial = name.charAt(0).toUpperCase();
            const userOccs = occurrences.filter(o => o.userId === user.uid);
            const userDocs = documents.filter(d => d.userId === user.uid);
            return (
              <div key={user.uid} className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-4 hover:shadow-sm hover:border-brand-200 transition-all">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-lg">{initial}</div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-gray-900 truncate">{name}</h3>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {user.sectorName && <span className="text-[9px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded-full font-bold">{user.sectorName}</span>}
                    {(user as any).cargo && <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{(user as any).cargo}</span>}
                    {userDocs.length > 0 && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{userDocs.length} docs</span>}
                    {userOccs.length > 0 && <span className="text-[9px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded-full">{userOccs.length} ocorr.</span>}
                  </div>
                </div>

                {/* Role select */}
                <select value={user.role} onChange={e => handleRoleChange(user.uid, e.target.value as UserRole)}
                  disabled={user.email === 'gestor@mgr.com'}
                  className="text-[10px] font-bold px-2 py-1 rounded-full border bg-white text-gray-700 cursor-pointer">
                  <option value="pending">Pendente</option>
                  <option value="employee">Colaborador</option>
                  <option value="technician">Técnico</option>
                  <option value="manager">Gerente</option>
                  <option value="admin">Admin</option>
                </select>

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
          onClose={() => setSelectedUser(null)}
          onSaved={() => setSelectedUser(null)} />
      )}
    </div>
  );
};

export default Users;

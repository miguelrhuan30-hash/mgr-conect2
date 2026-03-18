import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, UserProfile, UserRole, WorkLocation, Sector, PermissionSet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import { 
  Users as UsersIcon, ShieldCheck, Loader2, Camera, MapPin, Clock, 
  Settings, FileText, Briefcase, Package, DollarSign, X, Save, Shield,
  AlertTriangle
} from 'lucide-react';

// Default permissions matching SectorManagement
const INITIAL_PERMISSIONS: PermissionSet = {
  canManageUsers: false, canManageSettings: false, canManageSectors: false, canViewLogs: false,
  canRegisterAttendance: true, canViewAttendanceReports: false, canManageAttendance: false, requiresTimeClock: false,
  canViewTasks: true, canCreateTasks: false, canEditTasks: false, canDeleteTasks: false,
  canManageProjects: false, canViewSchedule: false, canViewFullSchedule: false, canViewMySchedule: true,
  canViewFinancials: false, canManageClients: false,
  canViewInventory: false, canManageInventory: false,
  canViewRanking: true, canViewBI: false, canViewVehicles: false,
};

// Mini toggle used in permission modal
const MiniToggle: React.FC<{ on: boolean; onChange: () => void }> = ({ on, onChange }) => (
  <button
    type="button" onClick={onChange}
    className={`relative inline-flex flex-shrink-0 h-5 w-9 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
      on ? 'bg-brand-600' : 'bg-gray-200'
    }`}
  >
    <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
      on ? 'translate-x-4' : 'translate-x-0'
    }`} />
  </button>
);

// Module definitions shared with SectorManagement
interface UA { key: keyof PermissionSet; label: string; desc?: string }
interface UM { id: string; label: string; color: string; txtColor: string; actions: UA[] }
const USER_MODULES: UM[] = [
  { id: 'os', label: 'Ordens de Serviço', color: 'bg-orange-50', txtColor: 'text-orange-700',
    actions: [
      { key: 'canViewTasks', label: 'Visualizar Tarefas' },
      { key: 'canManageProjects', label: 'Pipeline / Kanban' },
      { key: 'canViewMySchedule', label: 'Minha Agenda' },
      { key: 'canViewFullSchedule', label: 'Agenda Completa' },
      { key: 'canViewSchedule', label: 'Agenda / Gantt' },
      { key: 'canCreateTasks', label: 'Criar Nova O.S.' },
      { key: 'canEditTasks', label: 'Editar O.S.' },
      { key: 'canDeleteTasks', label: 'Excluir O.S.' },
      { key: 'canViewFinancials', label: 'Faturamento & Financeiro' },
    ]
  },
  { id: 'hr', label: 'RH & Ponto', color: 'bg-blue-50', txtColor: 'text-blue-700',
    actions: [
      { key: 'canRegisterAttendance', label: 'Registrar Ponto' },
      { key: 'canViewAttendanceReports', label: 'Espelho de Ponto' },
      { key: 'canManageAttendance', label: 'Corrigir / Gerenciar Ponto' },
      { key: 'requiresTimeClock', label: 'Exigir Ponto para Acesso', desc: 'Bloqueia entrada até bater ponto' },
    ]
  },
  { id: 'clients', label: 'Clientes & Ativos', color: 'bg-purple-50', txtColor: 'text-purple-700',
    actions: [{ key: 'canManageClients', label: 'Gerenciar Clientes & Ativos' }] },
  { id: 'inventory', label: 'Almoxarifado', color: 'bg-emerald-50', txtColor: 'text-emerald-700',
    actions: [
      { key: 'canViewInventory', label: 'Visualizar Estoque' },
      { key: 'canManageInventory', label: 'Movimentar Estoque' },
    ]
  },
  { id: 'ranking', label: 'Ranking & Gamificação', color: 'bg-yellow-50', txtColor: 'text-yellow-700',
    actions: [{ key: 'canViewRanking', label: 'Visualizar Ranking' }] },
  { id: 'vehicles', label: 'Controle de Veículos', color: 'bg-cyan-50', txtColor: 'text-cyan-700',
    actions: [{ key: 'canViewVehicles', label: 'Acessar Veículos' }] },
  { id: 'bi', label: 'BI & Inteligência', color: 'bg-indigo-50', txtColor: 'text-indigo-700',
    actions: [{ key: 'canViewBI', label: 'BI Dashboard' }] },
  { id: 'admin', label: 'Administração', color: 'bg-red-50', txtColor: 'text-red-700',
    actions: [
      { key: 'canManageUsers', label: 'Gerenciar Usuários' },
      { key: 'canManageSectors', label: 'Gerenciar Cargos & Acessos' },
      { key: 'canManageSettings', label: 'Configurações do Sistema' },
      { key: 'canViewLogs', label: 'Log do Sistema' },
    ]
  },
];

const modEnabled = (mod: UM, p: PermissionSet) => mod.actions.some(a => !!p[a.key]);

const Users: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);

  // Inline Editing State (Schedule/Locations)
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editScheduleType, setEditScheduleType] = useState<'FIXED' | 'FLEXIBLE'>('FIXED');
  const [editSchedule, setEditSchedule] = useState({ start: '08:00', lunch: 60, end: '17:00' });
  const [editFlexibleSchedule, setEditFlexibleSchedule] = useState<any>({
    monday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
    tuesday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
    wednesday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
    thursday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
    friday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
    saturday: { active: false, startTime: '08:00', lunchDuration: 60, endTime: '12:00' },
    sunday: { active: false, startTime: '08:00', lunchDuration: 0, endTime: '12:00' },
  });
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [editHourlyRate, setEditHourlyRate] = useState<number>(0);
  const [editRate50, setEditRate50] = useState<number>(1.5);
  const [editRate100, setEditRate100] = useState<number>(2.0);
  const [editTimeBankBalance, setEditTimeBankBalance] = useState<number>(0);

  // Profile fields
  const [editCargo, setEditCargo] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editPix, setEditPix] = useState('');
  const [editBanco, setEditBanco] = useState('');
  const [editConta, setEditConta] = useState('');
  const [editAgencia, setEditAgencia] = useState('');
  const [editPhone, setEditPhone] = useState('');
  
  // Permission Modal State
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permEditingUser, setPermEditingUser] = useState<UserProfile | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');
  const [currentPermissions, setCurrentPermissions] = useState<PermissionSet>(INITIAL_PERMISSIONS);
  
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    // Fetch Users
    const q = query(collection(db, CollectionName.USERS), orderBy('displayName', 'asc'));
    const unsubscribeUsers = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const usersData = snapshot.docs.map(doc => ({ ...(doc.data() as any), uid: doc.id })) as UserProfile[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    // Fetch Locations
    const fetchLocs = async () => {
      try {
        const snap = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
        setLocations(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as WorkLocation)));
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };

    // Fetch Sectors
    const fetchSectors = async () => {
      try {
        const snap = await getDocs(query(collection(db, CollectionName.SECTORS), orderBy('name')));
        setSectors(snap.docs.map(d => ({id: d.id, ...(d.data() as any)} as Sector)));
      } catch (error) {
        console.error("Error fetching sectors:", error);
      }
    };

    fetchLocs();
    fetchSectors();

    return () => unsubscribeUsers();
  }, [isAdmin]);

  // --- INLINE EDITING LOGIC (SCHEDULE) ---
  const startEditing = (user: UserProfile) => {
    setEditingUserId(user.uid);
    setEditScheduleType(user.scheduleType || 'FIXED');
    setEditSchedule({
      start: user.workSchedule?.startTime || '08:00',
      lunch: user.workSchedule?.lunchDuration || 60,
      end: user.workSchedule?.endTime || '17:00'
    });
    
    // Load flexible schedule if it exists, otherwise use defaults
    const defaultFlex = {
      monday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
      tuesday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
      wednesday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
      thursday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
      friday: { active: true, startTime: '08:00', lunchDuration: 60, endTime: '17:00' },
      saturday: { active: false, startTime: '08:00', lunchDuration: 60, endTime: '12:00' },
      sunday: { active: false, startTime: '08:00', lunchDuration: 0, endTime: '12:00' },
    };
    
    if (user.workSchedule && (user.workSchedule.monday || user.workSchedule.tuesday)) {
       setEditFlexibleSchedule({
         monday: user.workSchedule.monday || defaultFlex.monday,
         tuesday: user.workSchedule.tuesday || defaultFlex.tuesday,
         wednesday: user.workSchedule.wednesday || defaultFlex.wednesday,
         thursday: user.workSchedule.thursday || defaultFlex.thursday,
         friday: user.workSchedule.friday || defaultFlex.friday,
         saturday: user.workSchedule.saturday || defaultFlex.saturday,
         sunday: user.workSchedule.sunday || defaultFlex.sunday,
       });
    } else {
       // Auto-fill flexible schedule based on legacy fixed schedule
       setEditFlexibleSchedule({
         monday: { active: true, startTime: editSchedule.start, lunchDuration: editSchedule.lunch, endTime: editSchedule.end },
         tuesday: { active: true, startTime: editSchedule.start, lunchDuration: editSchedule.lunch, endTime: editSchedule.end },
         wednesday: { active: true, startTime: editSchedule.start, lunchDuration: editSchedule.lunch, endTime: editSchedule.end },
         thursday: { active: true, startTime: editSchedule.start, lunchDuration: editSchedule.lunch, endTime: editSchedule.end },
         friday: { active: true, startTime: editSchedule.start, lunchDuration: editSchedule.lunch, endTime: editSchedule.end },
         saturday: { active: false, startTime: editSchedule.start, lunchDuration: editSchedule.lunch, endTime: editSchedule.end },
         sunday: { active: false, startTime: editSchedule.start, lunchDuration: 0, endTime: editSchedule.end },
       });
    }

    setEditLocations(user.allowedLocationIds || []);
    setEditHourlyRate(user.hourlyRate || 0);
    setEditRate50(user.overtimeRules?.rate50 || 1.5);
    setEditRate100(user.overtimeRules?.rate100 || 2.0);
    setEditTimeBankBalance(user.timeBankBalance ?? 0);
    // Profile fields
    setEditCargo((user as any).cargo || '');
    setEditCpf((user as any).cpf || '');
    setEditPix((user as any).pixKey || '');
    setEditBanco((user as any).banco || '');
    setEditConta((user as any).conta || '');
    setEditAgencia((user as any).agencia || '');
    setEditPhone((user as any).phone || '');
  };

  const saveEdits = async (uid: string) => {
    setIsSaving(true);
    try {
      
      const updatedWorkSchedule = editScheduleType === 'FIXED' ? {
        startTime: editSchedule.start,
        lunchDuration: editSchedule.lunch,
        endTime: editSchedule.end
      } : {
        ...editFlexibleSchedule,
        // Keep fallback values for compatibility
        startTime: editSchedule.start,
        lunchDuration: editSchedule.lunch,
        endTime: editSchedule.end
      };

      await updateDoc(doc(db, CollectionName.USERS, uid), {
        scheduleType: editScheduleType,
        workSchedule: updatedWorkSchedule,
        allowedLocationIds: editLocations,
        hourlyRate: editHourlyRate,
        overtimeRules: { rate50: editRate50, rate100: editRate100 },
        timeBankBalance: editTimeBankBalance,
        // Profile fields
        cargo:    editCargo    || null,
        cpf:      editCpf      || null,
        pixKey:   editPix      || null,
        banco:    editBanco    || null,
        conta:    editConta    || null,
        agencia:  editAgencia  || null,
        phone:    editPhone    || null,
      });
      setEditingUserId(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleLocation = (locId: string) => {
    if (editLocations.includes(locId)) {
      setEditLocations(editLocations.filter(id => id !== locId));
    } else {
      setEditLocations([...editLocations, locId]);
    }
  };

  // --- PERMISSION MODAL LOGIC ---
  const openPermissionModal = (user: UserProfile) => {
    setPermEditingUser(user);
    setSelectedSectorId(user.sectorId || '');
    
    // Merge default structure with user saved permissions to ensure all keys exist
    setCurrentPermissions({
      ...INITIAL_PERMISSIONS,
      ...(user.permissions || {})
    });
    
    setPermissionModalOpen(true);
  };

  const handleSectorChange = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    
    // Auto-fill permissions based on sector defaults
    const sector = sectors.find(s => s.id === sectorId);
    if (sector) {
      setCurrentPermissions({
        ...INITIAL_PERMISSIONS, // Reset to baseline first
        ...sector.defaultPermissions // Apply sector defaults
      });
    }
  };

  const togglePermission = (key: keyof PermissionSet) => {
    setCurrentPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const savePermissions = async (useCustom = true) => {
    if (!permEditingUser) return;
    setIsSaving(true);
    try {
      const sectorName = sectors.find(s => s.id === selectedSectorId)?.name || '';
      await updateDoc(doc(db, CollectionName.USERS, permEditingUser.uid), {
        sectorId: selectedSectorId,
        sectorName,
        permissions: currentPermissions,
        hasCustomPermissions: useCustom,
      });
      setPermissionModalOpen(false);
      setPermEditingUser(null);
    } catch (e) {
      console.error('Error saving permissions:', e);
      alert('Erro ao salvar permissões.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToSector = () => {
    const sector = sectors.find(s => s.id === selectedSectorId);
    if (!sector) return;
    setCurrentPermissions({ ...INITIAL_PERMISSIONS, ...sector.defaultPermissions });
  };

  // --- GENERAL ACTIONS ---
  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    await updateDoc(doc(db, CollectionName.USERS, uid), { role: newRole });
  };

  const handlePhotoUpload = async (uid: string, file: File) => {
    if (!file) return;
    try {
      const compressedFile = await compressImage(file, 600, 0.8);
      const storageRef = ref(storage, `users/${uid}/profile_${Date.now()}.jpg`);
      await uploadBytes(storageRef, compressedFile);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, CollectionName.USERS, uid), { photoURL: url });
      alert("Foto atualizada!");
    } catch (e) {
      console.error(e);
      alert("Erro no upload.");
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
        <p className="text-gray-500">Apenas administradores podem gerenciar usuÃ¡rios.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">GestÃ£o de Equipe & RH</h1>
          <p className="text-gray-500">Defina jornadas, locais e nÃ­veis de acesso.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600"/></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Colaborador</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Setor & Acesso</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jornada/Locais</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Papel (Role)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Saldos & PrÃªmios</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AÃ§Ãµes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="relative group cursor-pointer">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">{user.displayName?.charAt(0)}</div>
                          )}
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                             <label className="cursor-pointer">
                               <Camera size={16} className="text-white" />
                               <input type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files && handlePhotoUpload(user.uid, e.target.files[0])} />
                             </label>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{user.displayName}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                       <div className="flex flex-col items-start gap-1">
                          <span className="text-sm font-medium text-gray-900">
                            {user.sectorName || <span className="text-gray-400 italic">Sem setor</span>}
                          </span>
                          {(user as any).hasCustomPermissions && (
                            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">Override</span>
                          )}
                          <button
                            onClick={() => openPermissionModal(user)}
                            className="text-xs flex items-center gap-1 text-brand-600 hover:text-brand-800 bg-brand-50 px-2 py-1 rounded border border-brand-100 hover:border-brand-200 transition-colors"
                          >
                            <ShieldCheck size={12} /> Gerenciar Acessos
                          </button>
                       </div>
                    </td>
                    
                    <td className="px-6 py-4">
                       {editingUserId === user.uid ? (
                         <div className="space-y-3 bg-gray-50 p-3 rounded border border-gray-200 min-w-[300px]">
                           {/* Tipo de Jornada */}
                           <div className="flex bg-white rounded border border-gray-200 p-1">
                             <button
                               onClick={() => setEditScheduleType('FIXED')}
                               className={`flex-1 text-xs py-1 rounded text-center ${editScheduleType === 'FIXED' ? 'bg-brand-100 text-brand-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                             >
                               Fixa
                             </button>
                             <button
                               onClick={() => setEditScheduleType('FLEXIBLE')}
                               className={`flex-1 text-xs py-1 rounded text-center ${editScheduleType === 'FLEXIBLE' ? 'bg-brand-100 text-brand-700 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}
                             >
                               FlexÃ­vel
                             </button>
                           </div>

                           {editScheduleType === 'FIXED' ? (
                             <>
                               <div className="flex items-center gap-2">
                                 <Clock size={14} className="text-gray-500"/>
                                 <input type="time" value={editSchedule.start} onChange={e => setEditSchedule({...editSchedule, start: e.target.value})} className="text-xs border rounded px-1 py-0.5 w-full bg-white text-gray-900" />
                                 <span className="text-xs">Ã s</span>
                                 <input type="time" value={editSchedule.end} onChange={e => setEditSchedule({...editSchedule, end: e.target.value})} className="text-xs border rounded px-1 py-0.5 w-full bg-white text-gray-900" />
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="text-xs text-gray-500">AlmoÃ§o (min):</span>
                                 <input type="number" value={editSchedule.lunch} onChange={e => setEditSchedule({...editSchedule, lunch: parseInt(e.target.value)})} className="text-xs border rounded w-16 px-1 py-0.5 bg-white text-gray-900" />
                                </div>
                             </>
                           ) : (
                             <div className="space-y-2 border-t border-gray-200 pt-2">
                               {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                                 const dayNames: any = { monday: 'Seg', tuesday: 'Ter', wednesday: 'Qua', thursday: 'Qui', friday: 'Sex', saturday: 'SÃ¡b', sunday: 'Dom' };
                                 const dayData = editFlexibleSchedule[day];
                                 return (
                                   <div key={day} className={`flex items-center justify-between gap-2 p-1 rounded ${dayData.active ? 'bg-white border text-gray-900' : 'bg-transparent text-gray-400 opacity-60'}`}>
                                     <label className="flex items-center gap-2 min-w-[45px] cursor-pointer">
                                       <input 
                                         type="checkbox" 
                                         checked={dayData.active} 
                                         onChange={e => setEditFlexibleSchedule({ ...editFlexibleSchedule, [day]: { ...dayData, active: e.target.checked } })}
                                         className="rounded border-gray-300 text-brand-600 focus:ring-brand-500 w-3 h-3"
                                       />
                                       <span className="text-xs font-medium">{dayNames[day]}</span>
                                     </label>
                                     <div className="flex items-center gap-1 flex-1">
                                       <input disabled={!dayData.active} type="time" value={dayData.startTime} onChange={e => setEditFlexibleSchedule({ ...editFlexibleSchedule, [day]: { ...dayData, startTime: e.target.value } })} className="text-xs border rounded px-1 py-0.5 w-[65px] bg-white text-gray-900" />
                                       <span className="text-[10px]">-</span>
                                       <input disabled={!dayData.active} type="time" value={dayData.endTime} onChange={e => setEditFlexibleSchedule({ ...editFlexibleSchedule, [day]: { ...dayData, endTime: e.target.value } })} className="text-xs border rounded px-1 py-0.5 w-[65px] bg-white text-gray-900" />
                                     </div>
                                     <div className="flex items-center gap-1">
                                       <Clock size={10} className="text-gray-400"/>
                                       <input disabled={!dayData.active} type="number" title="Minutos de AlmoÃ§o" value={dayData.lunchDuration} onChange={e => setEditFlexibleSchedule({ ...editFlexibleSchedule, [day]: { ...dayData, lunchDuration: parseInt(e.target.value) } })} className="text-xs border rounded w-12 px-1 py-0.5 bg-white text-gray-900" />
                                     </div>
                                   </div>
                                 );
                               })}
                             </div>
                           )}
                           <div className="space-y-1">
                             <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><MapPin size={12}/> Locais Permitidos:</p>
                             <div className="flex flex-wrap gap-1">
                               {locations.map(loc => (
                                 <button 
                                   key={loc.id}
                                   onClick={() => toggleLocation(loc.id)}
                                   className={`text-[10px] px-2 py-0.5 rounded border ${editLocations.includes(loc.id) ? 'bg-brand-100 border-brand-300 text-brand-700' : 'bg-white border-gray-200 text-gray-500'}`}
                                 >
                                   {loc.name}
                                 </button>
                               ))}
                             </div>
                           </div>
                           
                           <div className="space-y-1 pt-3 border-t border-gray-200 mt-3">
                             <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><DollarSign size={12}/> Dados Financeiros (CLT):</p>
                             <div className="flex items-center gap-2">
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-gray-500">Valor Hora (R$)</span>
                                 <input type="number" step="0.01" min="0" value={editHourlyRate} onChange={e => setEditHourlyRate(parseFloat(e.target.value) || 0)} className="text-xs border rounded px-1 py-0.5 w-20 bg-white text-gray-900" />
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-gray-500">Extra (50%) - Ex: 1.5</span>
                                 <input type="number" step="0.1" min="1" value={editRate50} onChange={e => setEditRate50(parseFloat(e.target.value) || 1.5)} className="text-xs border rounded px-1 py-0.5 w-20 bg-white text-gray-900" />
                               </div>
                               <div className="flex flex-col">
                                 <span className="text-[10px] text-gray-500">Extra (100%) - Ex: 2.0</span>
                                 <input type="number" step="0.1" min="1" value={editRate100} onChange={e => setEditRate100(parseFloat(e.target.value) || 2.0)} className="text-xs border rounded px-1 py-0.5 w-20 bg-white text-gray-900" />
                               </div>
                             </div>
                           </div>
                            {/* Dados Profissionais */}
                            <div className="space-y-2 pt-3 border-t border-gray-200 mt-3">
                              <p className="text-xs font-bold text-gray-700">Dados Profissionais:</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col col-span-2">
                                  <span className="text-[10px] text-gray-500">Cargo / Função</span>
                                  <input value={editCargo} onChange={e => setEditCargo(e.target.value)} placeholder="Ex: Técnico de Campo" className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-500">Telefone</span>
                                  <input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="(11) 99999-9999" className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-500">CPF</span>
                                  <input value={editCpf} onChange={e => setEditCpf(e.target.value)} placeholder="000.000.000-00" className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-500">Chave PIX</span>
                                  <input value={editPix} onChange={e => setEditPix(e.target.value)} placeholder="CPF, e-mail ou tel." className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-[10px] text-gray-500">Banco</span>
                                  <input value={editBanco} onChange={e => setEditBanco(e.target.value)} placeholder="Nubank, Itaú..." className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900" />
                                </div>
                                <div className="flex flex-col col-span-2">
                                  <span className="text-[10px] text-gray-500">Agência / Conta</span>
                                  <div className="flex gap-1">
                                    <input value={editAgencia} onChange={e => setEditAgencia(e.target.value)} placeholder="Agência" className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900 w-20" />
                                    <input value={editConta} onChange={e => setEditConta(e.target.value)} placeholder="Conta" className="text-xs border rounded px-1.5 py-0.5 bg-white text-gray-900 flex-1" />
                                  </div>
                                </div>
                              </div>
                            </div>
                         </div>
                       ) : (
                         <div className="text-sm">
                           {user.workSchedule ? (
                             <div className="flex flex-col gap-1">
                               <span className="text-xs flex items-center gap-1 text-gray-600">
                                 <Clock size={12}/> 
                                 {user.scheduleType === 'FLEXIBLE' ? (
                                   <span className="text-brand-600 font-medium">Escala FlexÃ­vel (ver detalhes)</span>
                                 ) : (
                                   <div className="flex items-center gap-1">
                                     <span>{user.workSchedule.startTime} - {user.workSchedule.endTime} ({user.workSchedule.lunchDuration}m)</span>
                                     {(() => {
                                       const [sh, sm] = (user.workSchedule.startTime || "00:00").split(':').map(Number);
                                       const [eh, em] = (user.workSchedule.endTime || "00:00").split(':').map(Number);
                                       const diffHrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
                                       if (diffHrs > 6 && (user.workSchedule.lunchDuration || 0) < 60) {
                                         return (
                                           <span title="Risco de Não Conformidade (Art. 71 CLT)">
                                             <AlertTriangle size={12} className="text-yellow-500" />
                                           </span>
                                         );
                                       }
                                       return null;
                                     })()}
                                   </div>
                                 )}
                               </span>
                               <span className="text-xs flex items-center gap-1 text-gray-500">
                                 <MapPin size={12}/> {user.allowedLocationIds?.length || 0} locais
                               </span>
                             </div>
                           ) : <span className="text-xs text-orange-500 italic">Sem jornada definida</span>}
                         </div>
                       )}
                    </td>

                    <td className="px-6 py-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.uid, e.target.value as UserRole)}
                        className="text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer bg-white text-gray-900"
                        disabled={user.email === 'gestor@mgr.com'}
                      >
                        <option value="pending">Pendente</option>
                        <option value="employee">Colaborador</option>
                        <option value="technician">TÃ©cnico</option>
                        <option value="manager">Gerente</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>

                    <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          {typeof user.accumulatedPrize === 'number' && (
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Saldo Bônus</span>
                              <div className="flex items-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm leading-tight">
                                <DollarSign size={14} />
                                <span>R$ {user.accumulatedPrize.toFixed(2)}</span>
                              </div>
                            </div>
                          )}

                          {typeof user.timeBankBalance === 'number' && user.timeBankBalance !== 0 && (
                            <div className="flex flex-col items-start gap-0.5">
                              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Banco de Horas</span>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 shadow-sm leading-tight">
                                <Clock size={14} />
                                <span>{Math.floor(user.timeBankBalance / 60)}h {Math.abs(user.timeBankBalance % 60)}min</span>
                              </div>
                            </div>
                          )}
                          
                          {!(typeof user.accumulatedPrize === 'number') && !(typeof user.timeBankBalance === 'number' && user.timeBankBalance !== 0) && (
                            <span className="text-xs text-gray-400 italic">Sem saldos</span>
                          )}
                        </div>
                      </td>

                     <td className="px-6 py-4 text-right">
                       {editingUserId === user.uid ? (
                         <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingUserId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                            <button onClick={() => saveEdits(user.uid)} disabled={isSaving} className="text-xs bg-brand-600 text-white px-3 py-1 rounded hover:bg-brand-700">
                              {isSaving ? 'Salvando...' : 'Salvar'}
                            </button>
                         </div>
                       ) : (
                         <button onClick={() => startEditing(user)} className="text-xs text-brand-600 hover:underline">Editar RH</button>
                       )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* PERMISSION MODAL */}
      {permissionModalOpen && permEditingUser && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => !isSaving && setPermissionModalOpen(false)} />
          <div className="w-full max-w-xl bg-white flex flex-col shadow-2xl h-full overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-base font-bold text-gray-900">Acessos: {permEditingUser.displayName}</h2>
                <p className="text-xs text-gray-500">Configure o setor e permissões individuais</p>
              </div>
              <button onClick={() => setPermissionModalOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {/* Sector select */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase block mb-1">Setor / Cargo</label>
                <select
                  value={selectedSectorId}
                  onChange={e => handleSectorChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 bg-white"
                >
                  <option value="">Selecione um setor...</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Ao mudar o setor, as permissões são redefinidas para o padrão do setor.</p>
              </div>

              {/* Module cards */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1">
                    <ShieldCheck size={12} className="text-brand-600" /> Permissões por Módulo
                  </h3>
                  {selectedSectorId && (
                    <button
                      type="button"
                      onClick={resetToSector}
                      className="text-[10px] text-brand-600 hover:underline font-bold"
                    >
                      ↺ Resetar para o setor
                    </button>
                  )}
                </div>

                {USER_MODULES.map(mod => {
                  const enabled = modEnabled(mod, currentPermissions);
                  const activeCount = mod.actions.filter(a => !!currentPermissions[a.key]).length;
                  return (
                    <details key={mod.id} className={`rounded-xl border overflow-hidden ${
                      enabled ? 'border-gray-200' : 'border-gray-100 opacity-60'
                    }`}>
                      <summary className={`${mod.color} px-3 py-2.5 flex items-center gap-2 cursor-pointer list-none`}>
                        <div className="flex-1 min-w-0">
                          <span className={`text-xs font-bold ${mod.txtColor}`}>{mod.label}</span>
                          <span className="text-[10px] text-gray-400 ml-2">{activeCount}/{mod.actions.length} ativas</span>
                        </div>
                        {/* Master toggle */}
                        <MiniToggle
                          on={enabled}
                          onChange={() => {
                            if (enabled) {
                              mod.actions.forEach(a => { if (currentPermissions[a.key]) togglePermission(a.key); });
                            } else {
                              mod.actions.forEach(a => { if (!currentPermissions[a.key]) togglePermission(a.key); });
                            }
                          }}
                        />
                      </summary>
                      <div className="bg-white divide-y divide-gray-50">
                        {mod.actions.map(action => (
                          <div key={action.key} className="px-3 py-2 flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700">{action.label}</p>
                              {action.desc && <p className="text-[9px] text-gray-400">{action.desc}</p>}
                            </div>
                            <MiniToggle
                              on={!!currentPermissions[action.key]}
                              onChange={() => togglePermission(action.key)}
                            />
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 bg-white flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => { resetToSector(); savePermissions(false); }}
                disabled={!selectedSectorId || isSaving}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-xl disabled:opacity-40"
              >
                Usar padrão do setor
              </button>
              <div className="flex gap-2">
                <button onClick={() => setPermissionModalOpen(false)} className="px-3 py-1.5 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600">
                  Cancelar
                </button>
                <button
                  onClick={() => savePermissions(true)}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar Acessos
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;

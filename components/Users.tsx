import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, UserProfile, UserRole, WorkLocation, Sector, PermissionSet } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import { 
  Users as UsersIcon, ShieldCheck, Loader2, Camera, MapPin, Clock, 
  Settings, FileText, Briefcase, Package, DollarSign, X, Save, Shield
} from 'lucide-react';

// Default permissions structure (same as SectorManagement for consistency)
const INITIAL_PERMISSIONS: PermissionSet = {
  canManageUsers: false,
  canManageSettings: false,
  canManageSectors: false,
  canViewLogs: false,
  canViewTasks: true,
  canCreateTasks: false,
  canEditTasks: false,
  canDeleteTasks: false,
  canViewSchedule: false,
  canViewFullSchedule: false,
  canViewMySchedule: false,
  canManageClients: false,
  canManageProjects: false,
  canViewInventory: false,
  canManageInventory: false,
  canRegisterAttendance: true,
  canViewAttendanceReports: false,
  canManageAttendance: false,
  requiresTimeClock: false,
  canViewFinancials: false,
};

const PERMISSION_GROUPS = [
  {
    id: 'admin',
    title: 'Administrativo & Sistema',
    icon: Settings,
    color: 'text-gray-600 bg-gray-100',
    perms: [
      { key: 'canManageUsers', label: 'Gerenciar UsuÃ¡rios' },
      { key: 'canManageSectors', label: 'Gerenciar Cargos e Setores' },
      { key: 'canManageSettings', label: 'ConfiguraÃ§Ãµes do Sistema' },
      { key: 'canViewLogs', label: 'Acesso aos Logs do Sistema' },
    ]
  },
  {
    id: 'hr',
    title: 'RH & Ponto',
    icon: Clock,
    color: 'text-blue-600 bg-blue-100',
    perms: [
      { key: 'canRegisterAttendance', label: 'Registrar Ponto' },
      { 
        key: 'canViewAttendanceReports', 
        label: 'Visualizar RelatÃ³rios de Ponto',
        description: 'Permite acessar e gerar relatÃ³rios de frequÃªncia e ponto dos colaboradores'
      },
      { key: 'canManageAttendance', label: 'Gerenciar/Corrigir Ponto' },
      { 
        key: 'requiresTimeClock', 
        label: 'Exigir Ponto para Acesso ao Sistema?', 
        description: 'Se desmarcado, o usuÃ¡rio poderÃ¡ acessar o sistema mesmo sem registrar entrada.'
      },
    ]
  },
  {
    id: 'ops',
    title: 'Operacional (Tarefas/OS)',
    icon: FileText,
    color: 'text-orange-600 bg-orange-100',
    perms: [
      { key: 'canViewTasks', label: 'Visualizar Tarefas' },
      { key: 'canViewSchedule', label: 'Acesso BÃ¡sico Ã  Agenda', description: 'Permite acessar a tela de agenda' },
      { key: 'canViewFullSchedule', label: 'Agenda Completa (Gerencial)', description: 'VÃª TODAS as OS de todos os colaboradores' },
      { key: 'canViewMySchedule', label: 'Minha Agenda (Atividades Pessoais)', description: 'VÃª APENAS as OS onde Ã© responsÃ¡vel' },
      { key: 'canCreateTasks', label: 'Criar Novas Tarefas' },
      { key: 'canEditTasks', label: 'Editar Tarefas' },
      { key: 'canDeleteTasks', label: 'Excluir Tarefas' },
    ]
  },
  {
    id: 'commercial',
    title: 'Comercial & Projetos',
    icon: Briefcase,
    color: 'text-purple-600 bg-purple-100',
    perms: [
      { key: 'canManageClients', label: 'Gerenciar Clientes' },
      { key: 'canManageProjects', label: 'Gerenciar Projetos' },
    ]
  },
  {
    id: 'inventory',
    title: 'Estoque',
    icon: Package,
    color: 'text-emerald-600 bg-emerald-100',
    perms: [
      { key: 'canViewInventory', label: 'Visualizar Estoque' },
      { key: 'canManageInventory', label: 'Movimentar Estoque' },
    ]
  },
  {
    id: 'financial',
    title: 'Financeiro',
    icon: DollarSign,
    color: 'text-green-600 bg-green-100',
    perms: [
      { key: 'canViewFinancials', label: 'Acesso a Dados Financeiros', description: 'Visualizar custos, salÃ¡rios e gerar extratos financeiros.' },
    ]
  }
];

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
        timeBankBalance: editTimeBankBalance
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

  const savePermissions = async () => {
    if (!permEditingUser) return;
    setIsSaving(true);
    try {
      const sectorName = sectors.find(s => s.id === selectedSectorId)?.name || '';
      
      await updateDoc(doc(db, CollectionName.USERS, permEditingUser.uid), {
        sectorId: selectedSectorId,
        sectorName: sectorName,
        permissions: currentPermissions
      });
      
      setPermissionModalOpen(false);
      setPermEditingUser(null);
    } catch (e) {
      console.error("Error saving permissions:", e);
      alert("Erro ao salvar permissÃµes.");
    } finally {
      setIsSaving(false);
    }
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cofre ðŸ†</th>
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
                                   <span>{user.workSchedule.startTime} - {user.workSchedule.endTime} ({user.workSchedule.lunchDuration}m)</span>
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
                        {typeof user.accumulatedPrize === 'number' ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-sm font-bold text-yellow-700 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-200">
                              R$ {user.accumulatedPrize.toFixed(2)}
                            </span>
                            {user.currentPoints ? (
                              <span className="text-[10px] text-gray-400 mt-0">{user.currentPoints} pts</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Sem saldo</span>
                        )}
                        {/* Time Bank Badge */}
                        {typeof user.timeBankBalance === 'number' && user.timeBankBalance > 0 ? (
                          <div className="mt-1">
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 flex items-center gap-1">
                              â±ï¸ {Math.floor(user.timeBankBalance / 60)}h {user.timeBankBalance % 60}min
                            </span>
                          </div>
                        ) : null}
                     </td>

                     <td className="px-6 py-4 text-right">
                       {editingUserId === user.uid ? (
                         <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingUserId(null)} className="text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                            <button onClick={() => saveEdits(user.uid)} disabled={isSaving} className="text-xs bg-brand-600 text-white px-3 py-1 rounded hover:bg-brand-700">
                              {isSaving ? 'Salvant...' : 'Salvar'}
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
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Acessos: {permEditingUser.displayName}</h2>
                <p className="text-sm text-gray-500">Defina o setor e personalize as permissÃµes individuais.</p>
              </div>
              <button onClick={() => setPermissionModalOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              
              {/* Sector Selection */}
              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-6">
                 <label className="block text-sm font-bold text-gray-700 mb-2">Setor / Departamento</label>
                 <select 
                   value={selectedSectorId}
                   onChange={(e) => handleSectorChange(e.target.value)}
                   className="w-full rounded-lg border-gray-300 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-900"
                 >
                   <option value="">Selecione um setor...</option>
                   {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                 </select>
                 <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                   <Shield size={12} /> Ao mudar o setor, as permissÃµes abaixo serÃ£o redefinidas para o padrÃ£o daquele setor.
                 </p>
              </div>

              {/* Granular Permissions */}
              <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={16} className="text-brand-600"/> PermissÃµes Individuais
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className={`px-4 py-3 border-b border-gray-100 flex items-center gap-2 font-bold text-sm ${group.color.split(' ')[1]}`}>
                          <group.icon size={16} className={group.color.split(' ')[0]} />
                          <span className="text-gray-800">{group.title}</span>
                        </div>
                        <div className="p-4 space-y-3">
                          {group.perms.map(perm => (
                            <div key={perm.key} className="flex flex-col">
                              <label className="flex items-center justify-between cursor-pointer group/toggle">
                                <span className="text-sm text-gray-600 group-hover/toggle:text-gray-900 transition-colors">{perm.label}</span>
                                <div className="relative">
                                  <input 
                                    type="checkbox" 
                                    className="sr-only"
                                    checked={!!currentPermissions[perm.key as keyof PermissionSet]}
                                    onChange={() => togglePermission(perm.key as keyof PermissionSet)}
                                  />
                                  <div className={`block w-10 h-6 rounded-full transition-colors ${currentPermissions[perm.key as keyof PermissionSet] ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${currentPermissions[perm.key as keyof PermissionSet] ? 'transform translate-x-4' : ''}`}></div>
                                </div>
                              </label>
                              {/* Render Description if Exists */}
                              {(perm as any).description && (
                                <p className="text-[10px] text-gray-400 mt-1 ml-0.5 leading-tight">{(perm as any).description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white rounded-b-2xl flex justify-end gap-3">
              <button 
                onClick={() => setPermissionModalOpen(false)} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                onClick={savePermissions}
                disabled={isSaving} 
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-75 shadow-sm"
              >
                {isSaving ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />} 
                Salvar Acessos
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Users;
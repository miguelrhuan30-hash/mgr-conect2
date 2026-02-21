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
  canViewFinancial: false,
  canManageFinancial: false,
};

const PERMISSION_GROUPS = [
  {
    id: 'admin',
    title: 'Administrativo & Sistema',
    icon: Settings,
    color: 'text-gray-600 bg-gray-100',
    perms: [
      { key: 'canManageUsers', label: 'Gerenciar Usuários' },
      { key: 'canManageSectors', label: 'Gerenciar Cargos e Setores' },
      { key: 'canManageSettings', label: 'Configurações do Sistema' },
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
        label: 'Visualizar Relatórios de Ponto',
        description: 'Permite acessar e gerar relatórios de frequência e ponto dos colaboradores'
      },
      { key: 'canManageAttendance', label: 'Gerenciar/Corrigir Ponto' },
      { 
        key: 'requiresTimeClock', 
        label: 'Exigir Ponto para Acesso ao Sistema?', 
        description: 'Se desmarcado, o usuário poderá acessar o sistema mesmo sem registrar entrada.'
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
      { key: 'canViewSchedule', label: 'Acesso Básico à Agenda', description: 'Permite acessar a tela de agenda' },
      { key: 'canViewFullSchedule', label: 'Agenda Completa (Gerencial)', description: 'Vê TODAS as OS de todos os colaboradores' },
      { key: 'canViewMySchedule', label: 'Minha Agenda (Atividades Pessoais)', description: 'Vê APENAS as OS onde é responsável' },
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
      { key: 'canViewFinancial', label: 'Visualizar Financeiro' },
      { key: 'canManageFinancial', label: 'Gerenciar Financeiro' },
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
  const [editSchedule, setEditSchedule] = useState({ start: '08:00', lunch: 60, end: '17:00' });
  const [editLocations, setEditLocations] = useState<string[]>([]);
  
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
    setEditSchedule({
      start: user.workSchedule?.startTime || '08:00',
      lunch: user.workSchedule?.lunchDuration || 60,
      end: user.workSchedule?.endTime || '17:00'
    });
    setEditLocations(user.allowedLocationIds || []);
  };

  const saveEdits = async (uid: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, CollectionName.USERS, uid), {
        workSchedule: {
          startTime: editSchedule.start,
          lunchDuration: editSchedule.lunch,
          endTime: editSchedule.end
        },
        allowedLocationIds: editLocations
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
      alert("Erro ao salvar permissões.");
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
        <p className="text-gray-500">Apenas administradores podem gerenciar usuários.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Equipe & RH</h1>
          <p className="text-gray-500">Defina jornadas, locais e níveis de acesso.</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
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
                         <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200 min-w-[200px]">
                           <div className="flex items-center gap-2">
                             <Clock size={14} className="text-gray-500"/>
                             <input type="time" value={editSchedule.start} onChange={e => setEditSchedule({...editSchedule, start: e.target.value})} className="text-xs border rounded px-1 py-0.5 w-full bg-white text-gray-900" />
                             <span className="text-xs">às</span>
                             <input type="time" value={editSchedule.end} onChange={e => setEditSchedule({...editSchedule, end: e.target.value})} className="text-xs border rounded px-1 py-0.5 w-full bg-white text-gray-900" />
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500">Almoço (min):</span>
                             <input type="number" value={editSchedule.lunch} onChange={e => setEditSchedule({...editSchedule, lunch: parseInt(e.target.value)})} className="text-xs border rounded w-16 px-1 py-0.5 bg-white text-gray-900" />
                           </div>
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
                         </div>
                       ) : (
                         <div className="text-sm">
                           {user.workSchedule ? (
                             <div className="flex flex-col gap-1">
                               <span className="text-xs flex items-center gap-1 text-gray-600">
                                 <Clock size={12}/> {user.workSchedule.startTime} - {user.workSchedule.endTime} ({user.workSchedule.lunchDuration}m)
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
                        <option value="technician">Técnico</option>
                        <option value="manager">Gerente</option>
                        <option value="admin">Admin</option>
                      </select>
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
                <p className="text-sm text-gray-500">Defina o setor e personalize as permissões individuais.</p>
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
                   <Shield size={12} /> Ao mudar o setor, as permissões abaixo serão redefinidas para o padrão daquele setor.
                 </p>
              </div>

              {/* Granular Permissions */}
              <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck size={16} className="text-brand-600"/> Permissões Individuais
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
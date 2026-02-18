import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, updateDoc, doc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, UserProfile, UserRole, WorkLocation } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { compressImage } from '../utils/compressor';
import { Users as UsersIcon, ShieldCheck, Loader2, UserPlus, Check, Camera, MapPin, Clock } from 'lucide-react';

const Users: React.FC = () => {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<WorkLocation[]>([]);

  // Editing State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editSchedule, setEditSchedule] = useState({ start: '08:00', lunch: 60, end: '17:00' });
  const [editLocations, setEditLocations] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const isAdmin = userProfile?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    // Fetch Users
    const q = query(collection(db, CollectionName.USERS), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id })) as UserProfile[];
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    // Fetch Locations for Dropdown
    const fetchLocs = async () => {
      try {
        const snap = await getDocs(collection(db, CollectionName.WORK_LOCATIONS));
        setLocations(snap.docs.map(d => ({id: d.id, ...d.data()} as WorkLocation)));
      } catch (error) {
        console.error("Error fetching locations:", error);
      }
    };
    fetchLocs();

    return () => unsubscribe();
  }, [isAdmin]);

  // Optimization: Memoize sorted list
  const userList = useMemo(() => {
    return users; 
  }, [users]);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    await updateDoc(doc(db, CollectionName.USERS, uid), { role: newRole });
  };

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

  const handlePhotoUpload = async (uid: string, file: File) => {
    if (!file) return;
    try {
      // Compress Image before upload
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

  const toggleLocation = (locId: string) => {
    if (editLocations.includes(locId)) {
      setEditLocations(editLocations.filter(id => id !== locId));
    } else {
      setEditLocations([...editLocations, locId]);
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
          <p className="text-gray-500">Defina jornadas, locais permitidos e aprove acessos.</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Jornada/Locais</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permissão</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {userList.map((user) => (
                  <tr key={user.uid} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="relative group cursor-pointer">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="h-10 w-10 rounded-full object-cover border border-gray-200" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">{user.displayName?.charAt(0)}</div>
                          )}
                          {/* Photo Upload Overlay */}
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
                       {editingUserId === user.uid ? (
                         <div className="space-y-2 bg-gray-50 p-3 rounded border border-gray-200">
                           <div className="flex items-center gap-2">
                             <Clock size={14} className="text-gray-500"/>
                             <input type="time" value={editSchedule.start} onChange={e => setEditSchedule({...editSchedule, start: e.target.value})} className="text-xs border rounded px-1 py-0.5" />
                             <span className="text-xs">às</span>
                             <input type="time" value={editSchedule.end} onChange={e => setEditSchedule({...editSchedule, end: e.target.value})} className="text-xs border rounded px-1 py-0.5" />
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-500">Almoço (min):</span>
                             <input type="number" value={editSchedule.lunch} onChange={e => setEditSchedule({...editSchedule, lunch: parseInt(e.target.value)})} className="text-xs border rounded w-16 px-1 py-0.5" />
                           </div>
                           <div className="space-y-1">
                             <p className="text-xs font-bold text-gray-700 flex items-center gap-1"><MapPin size={12}/> Locais Permitidos:</p>
                             <div className="flex flex-wrap gap-1 max-w-xs">
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
                        className="text-xs font-semibold px-2 py-1 rounded-full border cursor-pointer bg-gray-50"
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
    </div>
  );
};

export default Users;
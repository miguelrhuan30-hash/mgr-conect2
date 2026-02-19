import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Sector, PermissionSet } from '../types';
import { 
  Shield, Plus, Trash2, Edit2, Check, X, Save, Loader2, 
  Users, Briefcase, Settings, FileText, Package, DollarSign, Clock 
} from 'lucide-react';

// Default state for new sectors
const INITIAL_PERMISSIONS: PermissionSet = {
  canManageUsers: false,
  canManageSettings: false,
  canManageSectors: false,
  canViewTasks: true,
  canCreateTasks: false,
  canEditTasks: false,
  canDeleteTasks: false,
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

// Grouping permissions for better UI UX
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
      { key: 'canViewAttendanceReports', label: 'Ver Relatórios de Equipe' },
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

const SectorManagement: React.FC = () => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPerms, setFormPerms] = useState<PermissionSet>(INITIAL_PERMISSIONS);

  useEffect(() => {
    const q = query(collection(db, CollectionName.SECTORS), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...(doc.data() as any) 
      })) as Sector[];
      setSectors(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching sectors:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const openModal = (sector?: Sector) => {
    if (sector) {
      setEditingId(sector.id);
      setFormName(sector.name);
      setFormDesc(sector.description || '');
      // Merge with initial to ensure all keys exist even if new ones were added to the type later
      setFormPerms({ ...INITIAL_PERMISSIONS, ...sector.defaultPermissions });
    } else {
      setEditingId(null);
      setFormName('');
      setFormDesc('');
      setFormPerms(INITIAL_PERMISSIONS);
    }
    setIsModalOpen(true);
  };

  const handleTogglePerm = (key: keyof PermissionSet) => {
    setFormPerms(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este setor? Usuários vinculados perderão as permissões associadas.')) {
      try {
        await deleteDoc(doc(db, CollectionName.SECTORS, id));
      } catch (error) {
        console.error("Error deleting sector:", error);
        alert("Erro ao excluir setor.");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim(),
        defaultPermissions: formPerms,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, CollectionName.SECTORS, editingId), payload);
      } else {
        await addDoc(collection(db, CollectionName.SECTORS), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error("Error saving sector:", error);
      alert("Erro ao salvar setor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const countActivePerms = (perms: PermissionSet) => {
    return Object.values(perms).filter(Boolean).length;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Setores e Acessos</h1>
          <p className="text-gray-500">Crie perfis de acesso (cargos) para padronizar as permissões dos usuários.</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Setor
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-brand-600 w-8 h-8"/></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sectors.length === 0 && (
            <div className="col-span-full text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
              <Shield className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum setor definido</h3>
              <p className="text-gray-500">Crie o primeiro setor (ex: "Administrativo") para começar.</p>
            </div>
          )}

          {sectors.map((sector) => (
            <div key={sector.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col relative group">
               <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-lg">
                      {sector.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                     <h3 className="font-bold text-gray-900">{sector.name}</h3>
                     <p className="text-xs text-gray-500">{countActivePerms(sector.defaultPermissions)} permissões ativas</p>
                   </div>
                 </div>
                 <div className="flex gap-1">
                    <button onClick={() => openModal(sector)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(sector.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                 </div>
               </div>
               
               <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
                 {sector.description || <span className="italic text-gray-400">Sem descrição.</span>}
               </p>

               <div className="mt-auto pt-4 border-t border-gray-100">
                 <div className="flex flex-wrap gap-1.5">
                    {/* Permission Pills Preview */}
                    {sector.defaultPermissions.canManageUsers && <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100">Gestão Usuários</span>}
                    {sector.defaultPermissions.canViewFinancial && <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded border border-green-100">Financeiro</span>}
                    {sector.defaultPermissions.requiresTimeClock && <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100">Exige Ponto</span>}
                 </div>
               </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900">
                {editingId ? 'Editar Setor' : 'Novo Setor'}
              </h2>
              <button onClick={() => setIsModalOpen(false)}><X className="w-6 h-6 text-gray-500" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
              <form id="sector-form" onSubmit={handleSubmit} className="space-y-6">
                
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Setor / Cargo</label>
                    <input 
                      required 
                      type="text" 
                      value={formName} 
                      onChange={e => setFormName(e.target.value)} 
                      className="w-full rounded-lg border-gray-300 bg-white text-gray-900" 
                      placeholder="Ex: Auxiliar Administrativo" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <textarea 
                      rows={2}
                      value={formDesc} 
                      onChange={e => setFormDesc(e.target.value)} 
                      className="w-full rounded-lg border-gray-300 resize-none bg-white text-gray-900" 
                      placeholder="Breve descrição das responsabilidades..." 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <Shield size={16} className="text-brand-600"/> Definição de Permissões
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
                                    checked={!!formPerms[perm.key as keyof PermissionSet]}
                                    onChange={() => handleTogglePerm(perm.key as keyof PermissionSet)}
                                  />
                                  <div className={`block w-10 h-6 rounded-full transition-colors ${formPerms[perm.key as keyof PermissionSet] ? 'bg-brand-600' : 'bg-gray-300'}`}></div>
                                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${formPerms[perm.key as keyof PermissionSet] ? 'transform translate-x-4' : ''}`}></div>
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

              </form>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 bg-white rounded-b-2xl flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)} 
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button 
                type="submit" 
                form="sector-form" 
                disabled={isSubmitting} 
                className="flex items-center px-6 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-75 shadow-sm"
              >
                {isSubmitting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Save className="mr-2 w-4 h-4" />} 
                Salvar Setor
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SectorManagement;
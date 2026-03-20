/**
 * components/SectorManagement.tsx — Rebuilt
 *
 * Gestão de Cargos/Setores com:
 * - Cards por MÓDULO da aplicação (não por grupo plano)
 * - Toggle master por módulo (liga/desliga o módulo inteiro)
 * - Toggles por ação dentro de cada módulo
 * - Propagação automática para usuários do setor (sem override individual)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot,
  serverTimestamp, query, orderBy, getDocs, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Sector, PermissionSet } from '../types';
import {
  Shield, Plus, Trash2, Edit2, X, Save, Loader2, Users,
  ChevronDown, ChevronUp, CheckCircle2, ClipboardList, Clock,
  Building, Package, DollarSign, Kanban, Trophy, BarChart3,
  Car, Settings, Activity, ListTodo, Calendar,
} from 'lucide-react';

// ── Default permissions ────────────────────────────────────────────────────────
const EMPTY_PERMS = (): PermissionSet => ({
  canManageUsers: false,
  canManageSettings: false,
  canManageSectors: false,
  canViewLogs: false,
  canRegisterAttendance: true,
  canViewAttendanceReports: false,
  canManageAttendance: false,
  requiresTimeClock: false,
  canViewTasks: true,
  canCreateTasks: false,
  canEditTasks: false,
  canDeleteTasks: false,
  canManageProjects: false,
  canViewSchedule: false,
  canViewFullSchedule: false,
  canViewMySchedule: true,
  canViewFinancials: false,
  canManageClients: false,
  canViewInventory: false,
  canManageInventory: false,
  canViewRanking: true,
  canViewBI: false,
  canViewIntel: false,
  canViewVehicles: false,
});

// ── Module definitions ─────────────────────────────────────────────────────────
interface PermAction { key: keyof PermissionSet; label: string; desc?: string }
interface ModuleDef {
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;        // tailwind bg class for card header
  textColor: string;    // tailwind text class
  masterKey?: keyof PermissionSet; // if set, toggling master flips this key + all actions
  actions: PermAction[];
}

const MODULES: ModuleDef[] = [
  {
    id: 'os',
    label: 'Ordens de Serviço',
    icon: ClipboardList,
    color: 'bg-orange-50',
    textColor: 'text-orange-700',
    actions: [
      { key: 'canViewTasks',       label: 'Visualizar Tarefas (Lista)' },
      { key: 'canManageProjects',  label: 'Pipeline / Kanban' },
      { key: 'canViewMySchedule',  label: 'Minha Agenda' },
      { key: 'canViewFullSchedule',label: 'Agenda Completa (Gerencial)' },
      { key: 'canViewSchedule',    label: 'Agenda / Gantt (Geral)' },
      { key: 'canCreateTasks',     label: 'Criar Nova O.S.' },
      { key: 'canEditTasks',       label: 'Editar O.S.' },
      { key: 'canDeleteTasks',     label: 'Excluir O.S.' },
      { key: 'canViewFinancials',  label: 'Faturamento & Financeiro' },
    ],
  },
  {
    id: 'hr',
    label: 'RH & Ponto',
    icon: Clock,
    color: 'bg-blue-50',
    textColor: 'text-blue-700',
    actions: [
      { key: 'canRegisterAttendance',    label: 'Registrar Ponto' },
      { key: 'canViewAttendanceReports', label: 'Espelho de Ponto (Equipe)' },
      { key: 'canManageAttendance',      label: 'Corrigir / Gerenciar Ponto' },
      { key: 'requiresTimeClock',        label: 'Exigir Ponto para Acesso', desc: 'Bloqueia entrada no sistema até o colaborador bater ponto' },
    ],
  },
  {
    id: 'clients',
    label: 'Clientes & Ativos',
    icon: Building,
    color: 'bg-purple-50',
    textColor: 'text-purple-700',
    actions: [
      { key: 'canManageClients',  label: 'Gerenciar Clientes & Ativos' },
    ],
  },
  {
    id: 'inventory',
    label: 'Almoxarifado',
    icon: Package,
    color: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    actions: [
      { key: 'canViewInventory',    label: 'Visualizar Estoque' },
      { key: 'canManageInventory',  label: 'Movimentar / Gerenciar Estoque' },
    ],
  },
  {
    id: 'ranking',
    label: 'Ranking da Equipe',
    icon: Trophy,
    color: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    actions: [
      { key: 'canViewRanking', label: 'Visualizar Ranking & Gamificação' },
    ],
  },
  {
    id: 'vehicles',
    label: 'Controle de Veículos',
    icon: Car,
    color: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    actions: [
      { key: 'canViewVehicles', label: 'Acessar Controle de Veículos' },
    ],
  },
  {
    id: 'intel',
    label: 'Inteligência de Negócios',
    icon: BarChart3,
    color: 'bg-indigo-50',
    textColor: 'text-indigo-700',
    actions: [
      { key: 'canViewBI',    label: 'BI / Dashboard Analítico' },
      { key: 'canViewIntel', label: 'Inteligência MGR 🧠', desc: 'Acesso ao hub de análise estratégica' },
    ],
  },
  {
    id: 'admin',
    label: 'Administração do Sistema',
    icon: Settings,
    color: 'bg-red-50',
    textColor: 'text-red-700',
    actions: [
      { key: 'canManageUsers',    label: 'Gerenciar Usuários & Equipe' },
      { key: 'canManageSectors',  label: 'Gerenciar Cargos & Acessos' },
      { key: 'canManageSettings', label: 'Configurações do Sistema' },
      { key: 'canViewLogs',       label: 'Log do Sistema' },
    ],
  },
];

// Module is "enabled" if at least one action key is true
const isModuleEnabled = (mod: ModuleDef, perms: PermissionSet) =>
  mod.actions.some(a => !!perms[a.key]);

// ── Toggle component ───────────────────────────────────────────────────────────
const Toggle: React.FC<{ on: boolean; onChange: () => void; size?: 'sm' | 'md' }> = ({
  on, onChange, size = 'md',
}) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
      size === 'md' ? 'h-6 w-11' : 'h-5 w-9'
    } ${on ? 'bg-brand-600' : 'bg-gray-200'}`}
    role="switch"
    aria-checked={on}
  >
    <span className={`pointer-events-none inline-block rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
      size === 'md'
        ? `h-5 w-5 ${on ? 'translate-x-5' : 'translate-x-0'}`
        : `h-4 w-4 ${on ? 'translate-x-4' : 'translate-x-0'}`
    }`} />
  </button>
);

// ── Module Card ────────────────────────────────────────────────────────────────
const ModuleCard: React.FC<{
  mod: ModuleDef;
  perms: PermissionSet;
  onToggle: (key: keyof PermissionSet) => void;
}> = ({ mod, perms, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const enabled = isModuleEnabled(mod, perms);
  const Icon = mod.icon;
  const activeCount = mod.actions.filter(a => !!perms[a.key]).length;

  const handleMasterToggle = () => {
    // Enable all if currently disabled; disable all if currently enabled
    if (enabled) {
      mod.actions.forEach(a => { if (perms[a.key]) onToggle(a.key); });
    } else {
      mod.actions.forEach(a => { if (!perms[a.key]) onToggle(a.key); });
    }
  };

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      enabled ? 'border-gray-200 shadow-sm' : 'border-gray-100 opacity-60'
    }`}>
      {/* Card Header */}
      <div className={`${mod.color} px-4 py-3 flex items-center gap-3`}>
        <div className={`p-1.5 rounded-lg bg-white/60`}>
          <Icon size={16} className={mod.textColor} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${mod.textColor} truncate`}>{mod.label}</p>
          <p className="text-[10px] text-gray-500">
            {activeCount}/{mod.actions.length} ações ativas
          </p>
        </div>
        {/* Master toggle */}
        <Toggle on={enabled} onChange={handleMasterToggle} />
        {/* Expand chevron */}
        <button
          type="button"
          onClick={() => setExpanded(p => !p)}
          className="p-1 rounded-lg hover:bg-white/50 text-gray-500 transition-colors"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Action list */}
      {expanded && (
        <div className="bg-white divide-y divide-gray-50">
          {mod.actions.map(action => (
            <div key={action.key} className="px-4 py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{action.label}</p>
                {action.desc && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{action.desc}</p>
                )}
              </div>
              <Toggle
                on={!!perms[action.key]}
                onChange={() => onToggle(action.key)}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Sector Card ────────────────────────────────────────────────────────────────
const SectorCard: React.FC<{
  sector: Sector;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ sector, onEdit, onDelete }) => {
  const perms = { ...EMPTY_PERMS(), ...sector.defaultPermissions };
  const enabledModules = MODULES.filter(m => isModuleEnabled(m, perms));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {sector.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-sm">{sector.name}</h3>
            <p className="text-[10px] text-gray-400">
              {enabledModules.length} módulo{enabledModules.length !== 1 ? 's' : ''} ativo{enabledModules.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {sector.description && (
        <p className="text-xs text-gray-500 line-clamp-2">{sector.description}</p>
      )}

      {/* Enabled modules pills */}
      <div className="flex flex-wrap gap-1.5 mt-auto pt-2 border-t border-gray-100">
        {enabledModules.length === 0 ? (
          <span className="text-[10px] text-gray-400 italic">Nenhum módulo ativo</span>
        ) : (
          enabledModules.map(m => {
            const Icon = m.icon;
            return (
              <span key={m.id} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${m.color} ${m.textColor} border-transparent`}>
                <Icon size={9} /> {m.label}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const SectorManagement: React.FC = () => {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPerms, setFormPerms] = useState<PermissionSet>(EMPTY_PERMS());

  useEffect(() => {
    const q = query(collection(db, CollectionName.SECTORS), orderBy('name', 'asc'));
    return onSnapshot(q, snap => {
      setSectors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sector)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormName('');
    setFormDesc('');
    setFormPerms(EMPTY_PERMS());
    setShowForm(true);
  };

  const openEdit = (sector: Sector) => {
    setEditingId(sector.id);
    setFormName(sector.name);
    setFormDesc(sector.description || '');
    setFormPerms({ ...EMPTY_PERMS(), ...sector.defaultPermissions });
    setShowForm(true);
  };

  const handleToggle = (key: keyof PermissionSet) => {
    setFormPerms(p => ({ ...p, [key]: !p[key] }));
  };

  const propagateToUsers = async (sectorId: string, perms: PermissionSet) => {
    try {
      const snap = await getDocs(
        query(collection(db, CollectionName.USERS), where('sectorId', '==', sectorId))
      );
      const batch: Promise<void>[] = [];
      snap.docs.forEach(d => {
        const data = d.data() as any;
        // Skip users with individual permission override
        if (data.hasCustomPermissions) return;
        batch.push(updateDoc(doc(db, CollectionName.USERS, d.id), { permissions: perms }));
      });
      await Promise.all(batch);
    } catch { /* silent — propagation is best-effort */ }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDesc.trim(),
        defaultPermissions: formPerms,
        updatedAt: serverTimestamp(),
      };

      if (editingId) {
        await updateDoc(doc(db, CollectionName.SECTORS, editingId), payload);
        // Propagate to users of this sector
        await propagateToUsers(editingId, formPerms);
      } else {
        await addDoc(collection(db, CollectionName.SECTORS), {
          ...payload, createdAt: serverTimestamp(),
        });
      }
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar setor.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Excluir setor "${name}"? Usuários vinculados perderão as permissões associadas.`)) return;
    await deleteDoc(doc(db, CollectionName.SECTORS, id));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cargos & Acessos</h1>
          <p className="text-sm text-gray-500">
            Defina quais módulos e ações cada cargo pode acessar. As permissões se propagam automaticamente para os colaboradores do setor.
          </p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-bold shadow-sm"
        >
          <Plus size={16} /> Novo Cargo / Setor
        </button>
      </div>

      {/* Sector cards grid */}
      {loading ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-brand-600 w-8 h-8" />
        </div>
      ) : sectors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
          <Shield className="mx-auto w-12 h-12 text-gray-300 mb-3" />
          <h3 className="text-lg font-bold text-gray-900">Nenhum setor criado</h3>
          <p className="text-sm text-gray-500 mt-1">Crie o primeiro cargo (ex: "Técnico de Campo")</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {sectors.map(sector => (
            <SectorCard
              key={sector.id}
              sector={sector}
              onEdit={() => openEdit(sector)}
              onDelete={() => handleDelete(sector.id, sector.name)}
            />
          ))}
        </div>
      )}

      {/* ── FORM DRAWER ── */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={() => !saving && setShowForm(false)} />

          {/* Panel */}
          <div className="w-full max-w-2xl bg-white flex flex-col shadow-2xl h-full overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingId ? 'Editar Cargo / Setor' : 'Novo Cargo / Setor'}
                </h2>
                <p className="text-xs text-gray-500">Configure quais módulos e ações este cargo pode acessar</p>
              </div>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-gray-200 text-gray-500">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <form id="sector-form" onSubmit={handleSave} className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Name + Desc */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1">
                    Nome do Cargo *
                  </label>
                  <input
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Ex: Técnico de Campo, Auxiliar Administrativo"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-1">
                    Descrição
                  </label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Responsabilidades e contexto do cargo..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                </div>
              </div>

              {/* Module cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                    <Shield size={13} className="text-brand-600" /> Permissões por Módulo
                  </h3>
                  <span className="text-[10px] text-gray-400">
                    {MODULES.filter(m => isModuleEnabled(m, formPerms)).length}/{MODULES.length} módulos ativos
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
                  💡 Módulos <strong>desativados</strong> somem completamente da barra lateral do colaborador. Clique em um card para expandir as ações individuais.
                </p>
                {MODULES.map(mod => (
                  <ModuleCard
                    key={mod.id}
                    mod={mod}
                    perms={formPerms}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between gap-3">
              <div className="text-xs text-gray-500">
                {editingId && '⚡ Ao salvar, as permissões serão propagadas para todos os colaboradores deste setor sem override individual.'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="sector-form"
                  disabled={saving || !formName.trim()}
                  className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {saving ? 'Salvando...' : 'Salvar Cargo'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectorManagement;
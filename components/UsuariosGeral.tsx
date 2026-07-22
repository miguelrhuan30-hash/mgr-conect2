/**
 * components/UsuariosGeral.tsx
 * Gestão Geral de Usuários — visão única de todos os usuários que existem no
 * sistema (equipe interna + acessos de clientes ao Portal), com o marcador de
 * papel (role) determinando o tipo. Não substitui os cadastros — cada tipo
 * continua sendo criado e editado no seu próprio fluxo:
 *   - Equipe interna → Gestão de Pessoas → Equipe & RH (Users.tsx)
 *   - Acesso de cliente → Gestão de Clientes → aba Usuários (ClientPortalUsers.tsx)
 * Esta tela só lista e direciona pro lugar certo — é a busca/visão cruzada.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, UserProfile, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Search, ArrowRight, Loader2, Users2, Building2, ShieldOff } from 'lucide-react';
import GerenciarUsuarioPortal from './GerenciarUsuarioPortal';

const ROLE_INFO: Partial<Record<UserRole, { label: string; className: string }>> = {
  admin:         { label: 'Admin',      className: 'bg-red-50 text-red-700 border-red-200' },
  manager:       { label: 'Gerente',    className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  gestor:        { label: 'Gestor',     className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  technician:    { label: 'Técnico',    className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  tecnico:       { label: 'Técnico',    className: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  employee:      { label: 'Colaborador',className: 'bg-blue-50 text-blue-700 border-blue-200' },
  pending:       { label: 'Pendente',   className: 'bg-gray-100 text-gray-600 border-gray-200' },
  cliente:       { label: 'Cliente',    className: 'bg-purple-50 text-purple-700 border-purple-200' },
  developer:     { label: 'Developer',  className: 'bg-gray-100 text-gray-600 border-gray-200' },
  intel_viewer:  { label: 'Intel',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  intel_analyst: { label: 'Intel',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  intel_admin:   { label: 'Intel',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
};

const roleInfo = (role: UserRole) => ROLE_INFO[role] || { label: role || '—', className: 'bg-gray-100 text-gray-600 border-gray-200' };

type TipoFiltro = 'todos' | 'equipe' | 'cliente';

const UsuariosGeral: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.role === 'admin';

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<TipoFiltro>('todos');
  const [managingUid, setManagingUid] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    const q = query(collection(db, CollectionName.USERS), orderBy('displayName', 'asc'));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ ...(d.data() as any), uid: d.id } as UserProfile)));
      setLoading(false);
    }, () => setLoading(false));
  }, [isAdmin]);

  const equipeCount = useMemo(() => users.filter(u => u.role !== 'cliente').length, [users]);
  const clienteCount = useMemo(() => users.filter(u => u.role === 'cliente').length, [users]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter(u => {
      const matchesTipo = tipo === 'todos' || (tipo === 'cliente' ? u.role === 'cliente' : u.role !== 'cliente');
      if (!matchesTipo) return false;
      if (!term) return true;
      const name = (u.nomeCompleto || u.displayName || '').toLowerCase();
      return name.includes(term) || u.email.toLowerCase().includes(term) || (u.clientName || '').toLowerCase().includes(term);
    });
  }, [users, search, tipo]);

  const handleAbrir = (u: UserProfile) => {
    if (u.role === 'cliente') {
      setManagingUid(managingUid === u.uid ? null : u.uid);
    } else {
      navigate('/app/usuarios', { state: { openUid: u.uid } });
    }
  };

  if (!isAdmin) return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold text-gray-900">Acesso Negado</h2>
      <p className="text-gray-500">Apenas administradores podem ver a gestão geral de usuários.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Users2 className="w-6 h-6 text-brand-600" /> Gestão Geral de Usuários</h1>
        <p className="text-sm text-gray-500">Todos os usuários do sistema — equipe interna e acessos de clientes — num só lugar, só pra consulta e navegação.</p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, e-mail ou cliente..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          <button onClick={() => setTipo('todos')}
            className={`px-3 py-2 rounded-lg text-xs font-bold ${tipo === 'todos' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            Todos <span className="opacity-70">({users.length})</span>
          </button>
          <button onClick={() => setTipo('equipe')}
            className={`px-3 py-2 rounded-lg text-xs font-bold ${tipo === 'equipe' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            Equipe <span className="opacity-70">({equipeCount})</span>
          </button>
          <button onClick={() => setTipo('cliente')}
            className={`px-3 py-2 rounded-lg text-xs font-bold ${tipo === 'cliente' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
            Clientes <span className="opacity-70">({clienteCount})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-brand-600" size={28} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ShieldOff size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum usuário encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => {
            const info = roleInfo(u.role);
            const inativo = u.ativo === false;
            const nome = u.nomeCompleto || u.displayName || u.email;
            return (
              <div key={u.uid}>
                <div className={`bg-white rounded-2xl border p-4 flex items-center gap-4 ${inativo ? 'border-gray-200 opacity-60' : 'border-gray-200 hover:shadow-sm hover:border-brand-200'}`}>
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold flex-shrink-0">
                    {(nome || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{nome}</p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    {u.role === 'cliente' && u.clientName && (
                      <p className="text-[10px] text-purple-600 flex items-center gap-1 mt-0.5"><Building2 size={10} /> {u.clientName}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full border flex-shrink-0 ${info.className}`}>{info.label}</span>
                  {inativo && <span className="text-[9px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">Inativo</span>}
                  <button onClick={() => handleAbrir(u)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-brand-50 text-brand-700 border border-brand-200 rounded-xl text-xs font-bold hover:bg-brand-100 flex-shrink-0">
                    Abrir <ArrowRight size={13} />
                  </button>
                </div>
                {managingUid === u.uid && (
                  <div className="mt-2">
                    <GerenciarUsuarioPortal user={u} onClose={() => setManagingUid(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default UsuariosGeral;

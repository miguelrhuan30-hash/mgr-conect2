/**
 * components/ClientModules.tsx
 * Aba "Módulos" dentro do card do cliente (Clients.tsx) — staff MGR ativa/desativa
 * os módulos de manutenção que o cliente pode operar dentro do subsistema
 * (Câmaras Frias / Frota). Cliente NUNCA se autoconcede módulo, nem o próprio
 * Admin Mestre — exclusivo de quem tem canManageClients (Cloud Function
 * adminSetClientModule faz a checagem de verdade, isto aqui é só a tela).
 * Também lista quem hoje é Admin Mestre daquele cliente (designação em si
 * acontece na aba Usuários, via GerenciarUsuarioPortal — não duplicado aqui).
 */
import React, { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { CollectionName, ClientModule, ClientModuleId, UserProfile } from '../types';
import { Loader2, Snowflake, Truck, Check, Crown } from 'lucide-react';

const MODULOS: { id: ClientModuleId; label: string; icon: React.ReactNode; descricao: string }[] = [
  { id: 'camaras_frias', label: 'Câmaras Frias', icon: <Snowflake size={16} />, descricao: 'Ativos/Maquinários, Contrato SLA e Chamados' },
  { id: 'frota', label: 'Frota de Veículos', icon: <Truck size={16} />, descricao: 'Veículos, prestadores e manutenção de frota' },
];

const ClientModules: React.FC<{ clientId: string; clientName?: string }> = ({ clientId, clientName }) => {
  const [modulos, setModulos] = useState<Record<string, ClientModule>>({});
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<ClientModuleId | null>(null);
  const [adminMestres, setAdminMestres] = useState<UserProfile[]>([]);

  useEffect(() => {
    const q = query(collection(db, CollectionName.CLIENT_MODULES), where('clientId', '==', clientId));
    const unsub = onSnapshot(q, snap => {
      const map: Record<string, ClientModule> = {};
      snap.docs.forEach(d => { const m = d.data() as ClientModule; map[m.moduleId] = m; });
      setModulos(map);
      setLoading(false);
    });
    return () => unsub();
  }, [clientId]);

  useEffect(() => {
    const q = query(
      collection(db, CollectionName.USERS),
      where('clientId', '==', clientId),
      where('role', '==', 'cliente'),
      where('clientRole', '==', 'admin_mestre'),
    );
    const unsub = onSnapshot(q, snap => setAdminMestres(snap.docs.map(d => d.data() as UserProfile)));
    return () => unsub();
  }, [clientId]);

  // camaras_frias sem doc = tratado como ativo (comportamento atual preservado, sem backfill)
  const isAtivo = (moduleId: ClientModuleId) =>
    modulos[moduleId] ? modulos[moduleId].ativo : moduleId === 'camaras_frias';

  const handleToggle = async (moduleId: ClientModuleId) => {
    const proximoEstado = !isAtivo(moduleId);
    const label = MODULOS.find(m => m.id === moduleId)?.label || moduleId;
    if (!window.confirm(`${proximoEstado ? 'Ativar' : 'Desativar'} o módulo "${label}" pra ${clientName || 'este cliente'}?`)) return;
    setTogglingId(moduleId);
    try {
      const fn = httpsCallable(functions, 'adminSetClientModule');
      await fn({ clientId, clientName: clientName || null, moduleId, ativo: proximoEstado });
    } catch (e: any) {
      alert(e?.message?.replace('FirebaseError: ', '').replace('functions/', '') || 'Erro ao alterar o módulo.');
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {MODULOS.map(mod => {
          const ativo = isAtivo(mod.id);
          return (
            <div key={mod.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${ativo ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
                  {mod.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-700">{mod.label}</p>
                  <p className="text-[10px] text-gray-400 truncate">{mod.descricao}</p>
                </div>
              </div>
              <button onClick={() => handleToggle(mod.id)} disabled={togglingId === mod.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 flex-shrink-0 ${
                  ativo
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
                }`}>
                {togglingId === mod.id ? <Loader2 size={13} className="animate-spin" /> : ativo ? <Check size={13} /> : null}
                {ativo ? 'Ativo' : 'Inativo'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2"><Crown size={13} className="text-amber-500" /> Admin Mestre do cliente</p>
        {adminMestres.length === 0 ? (
          <p className="text-[11px] text-gray-400">Nenhum usuário designado ainda — defina na aba "Usuários", editando o clientRole pra "Admin Mestre".</p>
        ) : (
          <ul className="space-y-1">
            {adminMestres.map(u => (
              <li key={u.uid} className="text-[11px] text-gray-600 flex items-center gap-1.5">
                <Crown size={11} className="text-amber-500 flex-shrink-0" /> {u.nomeCompleto || u.displayName || u.email}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ClientModules;

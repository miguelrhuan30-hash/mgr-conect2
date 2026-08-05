/**
 * components/Portal/PortalFrota.tsx
 * Casca do módulo Frota dentro do Portal do Cliente — sub-navegação
 * (Veículos/Prestadores/Manutenção) + checagem de módulo ativo. O módulo só
 * é liberado por staff MGR (client_modules/{clientId}_frota.ativo) — acesso
 * direto por URL sem o módulo ativo cai num aviso, não nas telas internas.
 */
import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName } from '../../types';
import { Truck, Users, Wrench, AlertTriangle, Loader2 } from 'lucide-react';

const SUBNAV = [
  { to: '/portal/frota/veiculos',     label: 'Veículos',     icon: Truck },
  { to: '/portal/frota/prestadores',  label: 'Prestadores',  icon: Users },
  { to: '/portal/frota/manutencoes',  label: 'Manutenção',   icon: Wrench },
];

export default function PortalFrota() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const clientId = (userProfile as any)?.clientId as string | undefined;
  const [ativo, setAtivo] = useState<boolean | null>(null);

  useEffect(() => {
    if (!clientId) { setAtivo(false); return; }
    const ref = doc(db, CollectionName.CLIENT_MODULES, `${clientId}_frota`);
    return onSnapshot(ref, snap => setAtivo(snap.exists() && snap.data()?.ativo === true), () => setAtivo(false));
  }, [clientId]);

  if (ativo === null) {
    return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  }

  if (!ativo) {
    return (
      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">O módulo Frota ainda não foi liberado pra sua empresa.</p>
        <button onClick={() => navigate('/portal')} className="mt-3 text-xs font-bold text-brand-600 hover:underline">Voltar</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {SUBNAV.map(t => (
          <NavLink key={t.to} to={t.to}
            className={({ isActive }) =>
              `flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-colors ${
                isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`
            }>
            <t.icon size={13} /> {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}

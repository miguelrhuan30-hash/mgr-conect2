/**
 * components/Portal/PortalLayout.tsx
 * Casca do Portal do Cliente — acesso externo à MGR (role 'cliente').
 * Minimalista: sem sidebar/módulos internos, só o essencial pro cliente
 * acompanhar e abrir chamados de contrato SLA.
 */
import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, ShieldCheck } from 'lucide-react';

export default function PortalLayout() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-brand-600" />
          <div>
            <p className="text-sm font-extrabold text-gray-900">Portal MGR</p>
            <p className="text-[10px] text-gray-400">{userProfile?.clientName || 'Cliente'}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 max-w-2xl w-full mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
}

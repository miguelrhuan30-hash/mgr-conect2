/**
 * components/Portal/PortalLayout.tsx
 * Casca do Portal do Cliente — acesso externo à MGR (role 'cliente').
 * Minimalista: sem sidebar/módulos internos, só o essencial pro cliente
 * acompanhar e abrir chamados de contrato SLA.
 */
import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, ShieldCheck, Download, X, MessageSquareText, FileSignature, Thermometer } from 'lucide-react';
import { verificarNovaVersaoSistema, VersaoSistemaInfo } from '../../services/notificationService';
import NotificacoesBell from '../NotificacoesBell';

const TABS = [
  { to: '/portal',          label: 'Meus Chamados', icon: MessageSquareText, end: true,  gate: null as null | 'podeVerContrato' | 'podeVerAtivos' },
  { to: '/portal/contrato', label: 'Meu Contrato',  icon: FileSignature,     end: false, gate: 'podeVerContrato' as const },
  { to: '/portal/ativos',   label: 'Meus Ativos',   icon: Thermometer,       end: false, gate: 'podeVerAtivos' as const },
];

export default function PortalLayout() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  // Banner de "nova versão do sistema disponível" — mesmo mecanismo do
  // gestor web e do FieldApp, agora também pro cliente do Portal.
  const [versaoNova, setVersaoNova] = useState<VersaoSistemaInfo | null>(null);
  const [versaoBannerDismissed, setVersaoBannerDismissed] = useState(false);
  useEffect(() => {
    if (!currentUser?.uid) return;
    verificarNovaVersaoSistema(currentUser.uid).then(v => { if (v) setVersaoNova(v); });
  }, [currentUser?.uid]);

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
        <div className="flex items-center gap-1">
          <NotificacoesBell />
          <button onClick={handleLogout} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {versaoNova && !versaoBannerDismissed && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50 border-b border-emerald-100">
          <Download size={14} className="text-emerald-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-emerald-800">
              Sistema atualizado — v{versaoNova.version}
            </p>
            <p className="text-[11px] text-emerald-700/80 truncate">{versaoNova.notas}</p>
          </div>
          <button
            onClick={() => setVersaoBannerDismissed(true)}
            className="flex-shrink-0 p-1 text-emerald-600/60 hover:text-emerald-700"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {(() => {
        const visibleTabs = TABS.filter(t => !t.gate || (userProfile as any)?.[t.gate] !== false);
        if (visibleTabs.length < 2) return null;
        return (
          <div className="max-w-2xl w-full mx-auto px-4 pt-3">
            <nav className="flex bg-gray-100 rounded-xl p-1 gap-1">
              {visibleTabs.map(t => (
                <NavLink key={t.to} to={t.to} end={t.end}
                  className={({ isActive }) =>
                    `flex-1 flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg transition-colors ${
                      isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`
                  }>
                  <t.icon size={13} /> {t.label}
                </NavLink>
              ))}
            </nav>
          </div>
        );
      })()}

      <div className="flex-1 max-w-2xl w-full mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
}

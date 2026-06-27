import React, { useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ClipboardList, MapPin, User, Radio, UtensilsCrossed, Car, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { startFieldServices, stopFieldServices } from '../../services/FieldAppBootstrap';

export default function FieldLayout() {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const started  = useRef(false);
  const isAdmin  = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  useEffect(() => {
    if (!currentUser || started.current) return;
    started.current = true;
    const displayName = userProfile?.displayName ?? currentUser.email ?? 'Técnico';
    startFieldServices(currentUser.uid, displayName);
    return () => {
      started.current = false;
      stopFieldServices();
    };
  }, [currentUser]);

  const NAV_BASE = [
    { to: '/campo/os',      icon: ClipboardList,   label: 'Minhas O.S.' },
    { to: '/campo/ponto',   icon: MapPin,           label: 'Ponto'       },
    { to: '/campo/almoco',  icon: UtensilsCrossed,  label: 'Almoço'      },
    { to: '/campo/veiculo', icon: Car,              label: 'Veículo'     },
  ];

  const NAV = isAdmin
    ? [
        ...NAV_BASE,
        { to: '/campo/gestao', icon: Shield, label: 'Gestão' },
      ]
    : NAV_BASE;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 safe-area-top">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
            <span className="text-white font-black text-xs">M</span>
          </div>
          <span className="font-bold text-sm text-white">MGR Campo</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <Radio size={10} className="text-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-400">Rastreio ativo</span>
          </div>
          <button
            onClick={() => navigate('/campo/perfil')}
            className="w-8 h-8 rounded-full bg-emerald-700 flex items-center justify-center active:bg-emerald-600 border border-emerald-600/50"
          >
            <User size={15} className="text-white" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>

      {/* Bottom nav */}
      <nav className="flex bg-gray-900 border-t border-gray-800 safe-area-bottom">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
                isActive ? 'text-emerald-400' : 'text-gray-500 hover:text-gray-300'
              }`
            }
          >
            <Icon size={22} />
            <span className="text-[10px] font-semibold tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

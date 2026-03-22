import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { logEvent } from '../utils/logger';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PermissionSet, CollectionName } from '../types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  LayoutDashboard, 
  Clock, 
  Briefcase, 
  CheckSquare, 
  Package, 
  LogOut, 
  Hexagon,
  Users,
  FileText,
  Building,
  Globe,
  Edit,
  MapPin,
  CalendarCheck,
  Shield,
  Menu,
  X,
  CalendarDays,
  Activity,
  Trophy,
  Download,
  RefreshCcw,
  Target,
  Brain,
  Kanban,
  Wrench,
  Receipt,
  BarChart3,
  Car,
  Settings,
  Headphones,
  ChevronRight,
  ClipboardList,
  Camera,
  FileSpreadsheet,
  UtensilsCrossed,
} from 'lucide-react';

const Layout: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Mobile Menu State
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null); // PWA Install Prompt
  const [isClearingCache, setIsClearingCache] = useState(false);

  const prevPath = useRef('');

  // Sprint 46A — Suporte Primário notification badge for Gestores
  const [suporteNaoLidos, setSuporteNaoLidos] = useState(0);
  const isGestorLayout = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  // Sprint 46 — expandable submenu
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useEffect(() => {
    if (!isGestorLayout || !currentUser) return;
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_MSGS),
      where('leitoPorGestor', '==', false),
      where('solicitouHumano', '==', true),
    );
    return onSnapshot(q, snap => setSuporteNaoLidos(snap.size));
  }, [isGestorLayout, currentUser]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  useEffect(() => {
    if (!userProfile || !currentUser) return;
    if (location.pathname === prevPath.current) return;
    prevPath.current = location.pathname;

    const PAGE_TITLES: Record<string, string> = {
      '/app':                  'Dashboard',
      '/app/ponto':            'Registro de Ponto',
      '/app/tarefas':          'Tarefas (OS)',
      '/app/agenda':           'Agenda (Gantt)',
      '/app/clientes':         'Clientes',
      '/app/projetos':         'Projetos',
      '/app/estoque':          'Almoxarifado',
      '/app/modelos':          'Modelos',
      '/app/relatorios-ponto': 'Espelho de Ponto',
      '/app/usuarios':         'Equipe & RH',
      '/app/setores':          'Cargos & Acessos',
      '/app/locais':           'Locais de Trabalho',
      '/app/logs':             'Log do Sistema',
      '/app/ranking':          'Ranking da Equipe',
      '/app/campanhas':        'Gestão de Campanhas',
      '/app/perfil':           'Meu Perfil',
      '/app/inteligencia':     'Inteligência MGR',
      '/app/ativos':           'Ativos de Clientes',
      '/app/pipeline':         'Pipeline de O.S.',
      '/app/faturamento':      'Faturamento & Recebíveis',
      '/app/orcamentos':       'Orçamentos',
      '/app/bi':               'BI & Inteligência',
      '/app/meu-almoco':       'Meu Almoço',
      '/app/gestao-almoco':    'Gestão de Almoços',
    };

    const pageTitle = PAGE_TITLES[location.pathname] ?? location.pathname;

    logEvent(
      currentUser.uid,
      userProfile.displayName,
      'page_view',
      'info',
      `Acessou: ${pageTitle}`,
      { page: location.pathname, pageTitle }
    );
  }, [location.pathname, userProfile, currentUser]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
       console.log('User accepted the install prompt');
       setDeferredPrompt(null);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Atenção: Isso forçará o aplicativo a baixar a versão mais recente do servidor. Deseja continuar?')) {
      setIsClearingCache(true);
      try {
        // 1. Unregister Service Workers
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        }
        // 2. Clear all Caches
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          await Promise.all(cacheKeys.map(key => caches.delete(key)));
        }
        // 3. Force Reload
        window.location.reload();
      } catch (err) {
        console.error("Erro ao limpar cache: ", err);
        setIsClearingCache(false);
      }
    }
  };

  // Helper to check granular permissions
  const can = (key: keyof PermissionSet) => {
    if (!userProfile) return false;
    // Admins and Developers have master access
    if (userProfile.role === 'admin' || userProfile.role === 'developer') return true;
    // Check specific permission flag
    return !!userProfile.permissions?.[key];
  };

  // ── Navigation structure with submenu support ────────────────────────────
  type NavChild = { to: string; icon: React.ElementType; label: string; visible: boolean };
  type NavItem  = NavChild & { children?: NavChild[]; end?: boolean };

  // O.S. submenu routes for auto-expand detection
  const OS_ROUTES       = ['/app/pipeline', '/app/agenda', '/app/tarefas', '/app/faturamento', '/app/orcamentos', '/app/projetos', '/app/modelos'];
  const CLIENT_ROUTES   = ['/app/clientes', '/app/ativos'];
  const VEHICLE_ROUTES  = ['/app/veiculos'];
  const INTEL_ROUTES    = ['/app/inteligencia', '/app/bi'];
  const LUNCH_ROUTES    = ['/app/meu-almoco', '/app/gestao-almoco'];

  const isInOSGroup      = OS_ROUTES.some(r => location.pathname.startsWith(r));
  const isInClientGroup  = CLIENT_ROUTES.some(r => location.pathname.startsWith(r));
  const isInVehicleGroup = VEHICLE_ROUTES.some(r => location.pathname.startsWith(r));
  const isInIntelGroup   = INTEL_ROUTES.some(r => location.pathname.startsWith(r));
  const isInLunchGroup   = LUNCH_ROUTES.some(r => location.pathname.startsWith(r));

  // Auto-expand groups when on their routes
  const osGroupOpen      = expandedGroup === 'os'       || isInOSGroup;
  const clientGroupOpen  = expandedGroup === 'clients'  || isInClientGroup;
  const vehicleGroupOpen = expandedGroup === 'vehicles' || isInVehicleGroup;
  const intelGroupOpen   = expandedGroup === 'intel'    || isInIntelGroup;
  const lunchGroupOpen   = expandedGroup === 'lunch'    || isInLunchGroup;

  const navItems: NavItem[] = [
    { to: '/app', icon: LayoutDashboard, label: 'Início', end: true, visible: true },

    // ── Almoço MGR (grupo com submenu) ──
    {
      to: '/app/meu-almoco',
      icon: UtensilsCrossed,
      label: 'Almoço MGR',
      visible: true,
      children: [
        { to: '/app/meu-almoco',    icon: UtensilsCrossed, label: 'Meu Almoço',        visible: true },
        { to: '/app/gestao-almoco', icon: UtensilsCrossed, label: 'Gestão de Almoços', visible: can('canManageLunch') },
      ],
    },
    { to: '/app/ranking', icon: Trophy, label: 'Ranking da Equipe', visible: can('canViewRanking') || userProfile?.role === 'admin' || userProfile?.role === 'gestor' || userProfile?.role === 'manager' },
    { to: '/app/ponto', icon: Clock, label: 'Registrar Ponto', visible: can('canRegisterAttendance') },
    { to: '/app/estoque', icon: Package, label: 'Almoxarifado', visible: can('canViewInventory') },

    // ── Inteligência de Negócios (grupo com submenu) ──
    {
      to: '/app/inteligencia',
      icon: Brain,
      label: 'Inteligência de Negócios',
      visible: can('canViewBI') || can('canViewIntel') || can('canManageSettings')
               || ['admin','developer','intel_admin','intel_analyst','intel_viewer'].includes(userProfile?.role || ''),
      children: [
        { to: '/app/inteligencia', icon: Brain,     label: 'Inteligência MGR 🧠',
          visible: can('canViewIntel') || ['admin','developer','intel_admin','intel_analyst','intel_viewer'].includes(userProfile?.role || '') },
        { to: '/app/bi',           icon: BarChart3, label: 'BI / Dashboard',
          visible: can('canViewBI') || can('canManageSettings') },
      ],
    },

    // ── Ordens de Serviço (grupo com submenu) ──
    {
      to: '/app/pipeline',
      icon: ClipboardList,
      label: 'Ordens de Serviço',
      visible: can('canViewTasks') || can('canManageProjects'),
      children: [
        { to: '/app/pipeline',      icon: Kanban,          label: 'Pipeline',            visible: can('canManageProjects') },
        { to: '/app/agenda',        icon: CalendarDays,    label: 'Agenda',              visible: can('canViewSchedule') || can('canViewFullSchedule') || can('canViewMySchedule') },
        { to: '/app/tarefas',       icon: CheckSquare,     label: 'Lista de O.S.',       visible: can('canViewTasks') },
        { to: '/app/projetos',      icon: Briefcase,       label: 'Projetos',            visible: can('canManageProjects') },
        { to: '/app/faturamento',   icon: Receipt,         label: 'Faturamento',         visible: can('canViewFinancials') },
        { to: '/app/orcamentos',    icon: FileSpreadsheet, label: 'Orçamentos',          visible: can('canViewFinancials') },
        { to: '/app/modelos',       icon: FileText,        label: 'Modelos de O.S.',     visible: can('canManageSettings') },
        { to: '/app/os-foto-config',icon: Camera,          label: 'Config. Fotos O.S.', visible: can('canManageSettings') },
      ],
    },

    // ── Gestão de Clientes (grupo com submenu) ──
    {
      to: '/app/clientes',
      icon: Building,
      label: 'Gestão de Clientes',
      visible: can('canManageClients'),
      children: [
        { to: '/app/clientes', icon: Building, label: 'Clientes',         visible: can('canManageClients') },
        { to: '/app/ativos',   icon: Wrench,   label: 'Ativos de Cliente', visible: can('canManageClients') },
      ],
    },

    // ── Gestão de Veículos (grupo com submenu) ──
    {
      to: '/app/veiculos',
      icon: Car,
      label: 'Gestão de Veículos',
      visible: can('canViewVehicles') || can('canViewAttendanceReports'),
      children: [
        { to: '/app/veiculos',        icon: Car,      label: 'Controle de Veículos', visible: can('canViewVehicles') || can('canViewAttendanceReports') },
        { to: '/app/veiculos/config', icon: Settings, label: 'Config. Veículos',     visible: can('canManageSettings') },
      ],
    },

    // Management Section
    { to: '/app/campanhas',        icon: Target,       label: 'Campanhas (MGR Coins)', visible: can('canManageSettings') },
    { to: '/app/relatorios-ponto', icon: CalendarCheck,label: 'Espelho de Ponto',      visible: can('canViewAttendanceReports') },
    { to: '/app/logs',             icon: Activity,     label: 'Log do Sistema',        visible: userProfile?.permissions?.canViewLogs === true || userProfile?.role === 'admin' },

    // Admin Section
    { to: '/app/usuarios', icon: Users,  label: 'Equipe & RH',      visible: can('canManageUsers') },
    { to: '/app/setores',  icon: Shield, label: 'Cargos & Acessos', visible: can('canManageSectors') },
    { to: '/app/locais',   icon: MapPin, label: 'Locais de Trabalho',visible: can('canManageUsers') },
  ];

  // Add "Editar Site" only for Developers/Admins
  if (['admin', 'developer'].includes(userProfile?.role || '')) {
    navItems.push({ to: '/editor-site', icon: Edit, label: 'Editar Site', visible: true, end: false });
  }

  const visibleItems = navItems.filter(item => item.visible);

  // Avatar logic
  const avatarUrl = userProfile?.avatar || userProfile?.photoURL;
  const initial = (userProfile?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();

  // Helper to get Page Title for Mobile Header
  const getCurrentPageTitle = () => {
    // Exact match
    const currentItem = visibleItems.find(item => item.to === location.pathname);
    if (currentItem) return currentItem.label;
    
    // Fallbacks for sub-routes or specific paths
    if (location.pathname.includes('/app/perfil')) return 'Meu Perfil';
    
    return 'MGR Conect';
  };

  // Close sidebar handler
  const closeSidebar = () => setSidebarOpen(false);

  // Navigation handler (closes drawer on mobile)
  const handleNavClick = (path: string) => {
    navigate(path);
    closeSidebar();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      
      {/* MOBILE HEADER (Fixed Top) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-12 bg-white border-b border-gray-200 z-30 flex items-center justify-between px-4 shadow-sm">
        <button 
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <Menu size={24} />
        </button>
        
        <span className="font-bold text-gray-900 truncate">
          {getCurrentPageTitle()}
        </span>
        
        <button onClick={() => navigate('/app/perfil')} className="relative">
             {avatarUrl ? (
               <img src={avatarUrl} alt="User" className="w-8 h-8 rounded-full border border-brand-200 object-cover" />
             ) : (
               <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs border border-brand-200">
                  {initial}
               </div>
             )}
        </button>

        {/* Sprint 46A — Suporte Primário badge para gestores */}
        {isGestorLayout && suporteNaoLidos > 0 && (
          <button
            onClick={() => navigate('/app/pipeline')}
            className="relative p-2 bg-purple-600 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold shadow animate-pulse"
            title="Técnico solicitando suporte"
          >
            <Headphones size={16} />
            <span className="bg-red-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
              {suporteNaoLidos}
            </span>
          </button>
        )}
      </header>

      {/* MOBILE OVERLAY (Backdrop) */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-200 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeSidebar}
      />

      {/* SIDEBAR (Desktop Fixed / Mobile Drawer) */}
      <aside 
        className={`
          fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:inset-auto
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Logo Area */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-100">
            <div 
              onClick={() => handleNavClick('/app')} 
              className="flex items-center cursor-pointer group"
            >
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white mr-3 group-hover:bg-brand-700 transition-colors">
                <Hexagon size={20} fill="currentColor" />
              </div>
              <span className="text-xl font-bold text-gray-900 group-hover:text-brand-700 transition-colors">MGR Conect</span>
            </div>
            {/* Close Button (Mobile Only) */}
            <button onClick={closeSidebar} className="lg:hidden text-gray-500">
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {visibleItems.map((item) => {
              // ── Group item with children (e.g. "Ordens de Serviço") ──
              if (item.children && item.children.length > 0) {
                const isGroupKey = item.label === 'Ordens de Serviço' ? 'os'
                                 : item.label === 'Gestão de Clientes'  ? 'clients'
                                 : item.label === 'Gestão de Veículos'  ? 'vehicles'
                                 : item.label === 'Inteligência de Negócios' ? 'intel'
                                 : item.label === 'Almoço MGR'           ? 'lunch'
                                 : item.label;
                const isOpen = item.label === 'Ordens de Serviço'         ? osGroupOpen
                             : item.label === 'Gestão de Clientes'        ? clientGroupOpen
                             : item.label === 'Gestão de Veículos'        ? vehicleGroupOpen
                             : item.label === 'Inteligência de Negócios'  ? intelGroupOpen
                             : item.label === 'Almoço MGR'                ? lunchGroupOpen
                             : expandedGroup === isGroupKey;
                const visibleChildren = item.children.filter(c => c.visible);
                if (visibleChildren.length === 0) return null;
                return (
                  <div key={item.label}>
                    {/* Parent button */}
                    <button
                      onClick={() => setExpandedGroup(isOpen ? null : isGroupKey)}
                      className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                        ${isInOSGroup
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                    >
                      <item.icon size={20} className="mr-3 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      <ChevronRight
                        size={16}
                        className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                      />
                    </button>
                    {/* Children (animated slide) */}
                    {isOpen && (
                      <div className="mt-1 ml-4 pl-3 border-l-2 border-brand-100 space-y-0.5">
                        {visibleChildren.map(child => (
                          <NavLink
                            key={child.to}
                            to={child.to}
                            onClick={closeSidebar}
                            className={({ isActive }) => `
                              flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors
                              ${isActive
                                ? 'bg-brand-50 text-brand-700'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}
                            `}
                          >
                            <child.icon size={16} className="mr-2.5 flex-shrink-0" />
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Regular flat NavLink ──
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeSidebar}
                  className={({ isActive }) => `
                    flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                    ${isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}
                  `}
                >
                  <item.icon size={20} className="mr-3 flex-shrink-0" />
                  {item.label}
                </NavLink>
              );
            })}

            <div className="pt-4 mt-4 border-t border-gray-100">
              <NavLink
                to="/"
                onClick={closeSidebar}
                className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <Globe size={20} className="mr-3" />
                Ir para o Site
              </NavLink>
            </div>
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div 
              onClick={() => handleNavClick('/app/perfil')}
              className="flex items-center mb-4 cursor-pointer hover:bg-white p-2 rounded-lg transition-colors group"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="User" className="w-10 h-10 rounded-full border border-gray-200 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold group-hover:bg-brand-200 transition-colors">
                  {initial}
                </div>
              )}
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate group-hover:text-brand-600 transition-colors">
                  {userProfile?.displayName || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {userProfile?.sectorName || userProfile?.role || 'Colaborador'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
            >
              <LogOut size={16} className="mr-2" />
              Sair
            </button>
            
            {/* SPRINT 6: Ferramentas do PWA */}
            <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
               {deferredPrompt && (
                   <button
                     onClick={handleInstallPWA}
                     className="w-full flex items-center justify-center px-4 py-2 text-sm font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200"
                   >
                     <Download size={16} className="mr-2" />
                     Instalar App no Celular
                   </button>
               )}
               
               <button
                 onClick={handleClearCache}
                 disabled={isClearingCache}
                 className="w-full flex items-center justify-center px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
               >
                 <RefreshCcw size={14} className={`mr-2 ${isClearingCache ? 'animate-spin' : ''}`} />
                 {isClearingCache ? 'Limpando...' : 'Limpar Cache e Atualizar'}
               </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-12 lg:pt-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
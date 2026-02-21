import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PermissionSet } from '../types';
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
  CalendarDays
} from 'lucide-react';

const Layout: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Mobile Menu State
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
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

  // Dynamic Navigation Building
  const navItems = [
    { to: '/app', icon: LayoutDashboard, label: 'Início', end: true, visible: true },
    { to: '/app/tarefas', icon: CheckSquare, label: 'Tarefas (OS)', visible: can('canViewTasks') },
    { to: '/app/agenda', icon: CalendarDays, label: 'Agenda (Gantt)', visible: can('canViewSchedule') || can('canViewFullSchedule') || can('canViewMySchedule') },
    { to: '/app/clientes', icon: Building, label: 'Clientes', visible: can('canManageClients') },
    { to: '/app/projetos', icon: Briefcase, label: 'Projetos', visible: can('canManageProjects') },
    { to: '/app/ponto', icon: Clock, label: 'Registrar Ponto', visible: can('canRegisterAttendance') },
    { to: '/app/estoque', icon: Package, label: 'Almoxarifado', visible: can('canViewInventory') }, // Renomeado
    
    // Management Section
    { to: '/app/modelos', icon: FileText, label: 'Modelos', visible: can('canManageSettings') },
    { to: '/app/relatorios-ponto', icon: CalendarCheck, label: 'Espelho de Ponto', visible: can('canViewAttendanceReports') },
    
    // Admin Section
    { to: '/app/usuarios', icon: Users, label: 'Equipe & RH', visible: can('canManageUsers') },
    { to: '/app/setores', icon: Shield, label: 'Cargos & Acessos', visible: can('canManageSectors') },
    { to: '/app/locais', icon: MapPin, label: 'Locais de Trabalho', visible: can('canManageUsers') },
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
            {visibleItems.map((item) => (
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
                <item.icon size={20} className="mr-3" />
                {item.label}
              </NavLink>
            ))}

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
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
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
  CalendarCheck
} from 'lucide-react';

const Layout: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const navItems = [
    { to: '/app', icon: LayoutDashboard, label: 'Início', end: true },
    { to: '/app/tarefas', icon: CheckSquare, label: 'Tarefas' },
    { to: '/app/clientes', icon: Building, label: 'Clientes' },
    { to: '/app/projetos', icon: Briefcase, label: 'Projetos' },
    { to: '/app/ponto', icon: Clock, label: 'Registrar Ponto' },
    { to: '/app/estoque', icon: Package, label: 'Estoque' },
  ];

  // Add "Modelos" for Admins/Managers
  if (['admin', 'manager', 'developer'].includes(userProfile?.role || '')) {
     navItems.push({ to: '/app/modelos', icon: FileText, label: 'Modelos' });
  }

  // Add "Equipe" only for Admins/Developers
  if (['admin', 'developer'].includes(userProfile?.role || '')) {
    navItems.push({ to: '/app/usuarios', icon: Users, label: 'Equipe & RH' });
    navItems.push({ to: '/app/locais', icon: MapPin, label: 'Locais de Trabalho' });
    navItems.push({ to: '/app/relatorios-ponto', icon: CalendarCheck, label: 'Espelho de Ponto' });
  }

  // Add "Editar Site" only for Developers/Admins
  if (['admin', 'developer'].includes(userProfile?.role || '')) {
    navItems.push({ to: '/editor-site', icon: Edit, label: 'Editar Site' });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      
      {/* MOBILE HEADER (Top Bar) */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-40 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white mr-3">
            <Hexagon size={20} fill="currentColor" />
          </div>
          <span className="text-xl font-bold text-gray-900">MGR Conect</span>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs border border-brand-200">
              {(userProfile?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase()}
           </div>
           <button onClick={handleLogout} className="text-gray-500 hover:text-red-600">
             <LogOut size={20} />
           </button>
        </div>
      </header>

      {/* DESKTOP SIDEBAR (Left) */}
      <aside className="hidden lg:flex fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 flex-col">
        <div className="h-full flex flex-col">
          {/* Logo Area */}
          <div className="h-16 flex items-center px-6 border-b border-gray-100">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white mr-3">
              <Hexagon size={20} fill="currentColor" />
            </div>
            <span className="text-xl font-bold text-gray-900">MGR Conect</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
                className="flex items-center px-4 py-3 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <Globe size={20} className="mr-3" />
                Ir para o Site
              </NavLink>
            </div>
          </nav>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold">
                {(userProfile?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userProfile?.displayName || 'Usuário'}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {userProfile?.role || 'Colaborador'}
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
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden pt-16 lg:pt-0 pb-20 lg:pb-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION (Footer) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex items-center overflow-x-auto no-scrollbar pb-safe">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `
              min-w-[4.5rem] flex-1 flex flex-col items-center justify-center py-2 px-1 transition-colors
              ${isActive 
                ? 'text-brand-600 border-t-2 border-brand-600' 
                : 'text-gray-500 hover:text-gray-900 border-t-2 border-transparent'}
            `}
          >
            <item.icon size={20} className="mb-1" />
            <span className="text-[10px] font-medium truncate w-full text-center leading-none">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
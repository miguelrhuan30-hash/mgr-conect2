import React, { Suspense, lazy, useEffect, useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, QuerySnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from './firebase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout'; // Mantido estático como estrutura base
import LoadingScreen from './components/LoadingScreen';
import { PermissionSet, CollectionName } from './types';
import { ShieldAlert, LogOut, Clock, Lock } from 'lucide-react';

// Lazy Load Components
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Ponto = lazy(() => import('./components/Ponto'));
const Tasks = lazy(() => import('./components/Tasks'));
const Schedule = lazy(() => import('./components/Schedule')); // NEW
const TaskTemplates = lazy(() => import('./components/TaskTemplates'));
const Projects = lazy(() => import('./components/Projects'));
const Inventory = lazy(() => import('./components/Inventory'));
const Users = lazy(() => import('./components/Users'));
const UserProfile = lazy(() => import('./components/UserProfile')); // New Component
const SectorManagement = lazy(() => import('./components/SectorManagement'));
const Clients = lazy(() => import('./components/Clients'));
const WorkLocations = lazy(() => import('./components/WorkLocations'));
const AttendanceReports = lazy(() => import('./components/AttendanceReports'));
const PendingApproval = lazy(() => import('./components/PendingApproval'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const LandingPageEditor = lazy(() => import('./components/LandingPageEditor'));

// Extracted EnforceShiftLock Component
const EnforceShiftLock = ({ isShiftLocked, children }: { isShiftLocked: boolean, children?: React.ReactNode }) => {
  const location = useLocation();

  if (isShiftLocked) {
     // If currently not on Ponto page, redirect to Ponto
     if (!location.pathname.includes('/app/ponto')) {
        return <Navigate to="/app/ponto" replace />;
     }
     
     // If on Ponto page, show a warning banner above the content
     return (
       <div className="flex flex-col h-full">
          <div className="bg-orange-50 border-b border-orange-200 px-4 py-3 flex items-center justify-between">
             <div className="flex items-center gap-3">
                <Lock className="text-orange-600 w-5 h-5 animate-pulse" />
                <span className="text-orange-800 text-sm font-bold">
                  Acesso ao sistema bloqueado. Registre sua entrada para liberar os menus.
                </span>
             </div>
          </div>
          {children}
       </div>
     );
  }
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();
  
  // --- SHIFT LOCK STATE ---
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const [checkingShift, setCheckingShift] = useState(true);

  // --- MASTER BYPASS LOGIC (Regra Suprema) ---
  const isMaster = currentUser?.email?.toLowerCase() === 'gestor@mgr.com';

  // 1. Auto-Correction Logic for Master Admin
  useEffect(() => {
    if (isMaster && userProfile && currentUser) {
      // Check if permissions are wrong (blocking the admin)
      const needsCorrection = userProfile.permissions?.requiresTimeClock === true || 
                              userProfile.role !== 'admin';

      if (needsCorrection) {
        console.log("⚠️ MASTER ADMIN: Auto-correcting permissions...");
        const correctPermissions = async () => {
          try {
             const userRef = doc(db, CollectionName.USERS, currentUser.uid);
             await updateDoc(userRef, {
               role: 'admin',
               'permissions.requiresTimeClock': false,
               'permissions.canManageUsers': true,
               'permissions.canManageSettings': true,
               'permissions.canRegisterAttendance': true
             });
             console.log("✅ MASTER ADMIN: Permissions fixed.");
          } catch (error) {
             console.error("❌ MASTER ADMIN: Fix failed", error);
          }
        };
        correctPermissions();
      }
    }
  }, [isMaster, userProfile, currentUser]);

  // Real-time listener for Attendance Status
  useEffect(() => {
    if (!currentUser) {
      setCheckingShift(false);
      return;
    }

    // Listener for the latest time entry
    const q = query(
      collection(db, CollectionName.TIME_ENTRIES),
      where('userId', '==', currentUser.uid),
      orderBy('timestamp', 'desc'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<DocumentData>) => {
      if (!snapshot.empty) {
        const lastEntry = snapshot.docs[0].data();
        // Shift is open if last action was 'entry' or returning from lunch
        const isOpen = lastEntry.type === 'entry' || lastEntry.type === 'lunch_end';
        setIsShiftOpen(isOpen);
      } else {
        // No entries ever = Shift Closed
        setIsShiftOpen(false);
      }
      setCheckingShift(false);
    }, (error) => {
      console.error("Error monitoring shift status:", error);
      setCheckingShift(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Helper to check permissions safely
  const hasPermission = (key: keyof PermissionSet) => {
    if (!userProfile) return false;
    // Admins and Developers have full access bypass
    if (userProfile.role === 'admin' || userProfile.role === 'developer') return true;
    // Check specific granular permission
    return !!userProfile.permissions?.[key];
  };

  const handleEmergencyLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/';
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading || (currentUser && checkingShift)) {
    return <LoadingScreen />;
  }

  // Identity Lock Logic
  // Define se falta a foto. (A lógica de bypass do gestor é feita na renderização)
  const isAvatarMissing = currentUser && 
                          userProfile && 
                          userProfile.role !== 'pending' && 
                          !userProfile.avatar && 
                          !userProfile.photoURL;

  // --- ACCESS CONTROL LOGIC ---
  // BYPASS: Gestor nunca requer ponto
  const requiresTimeClock = !isMaster && (userProfile?.permissions?.requiresTimeClock ?? false);
  
  // Lógica de Bloqueio de Turno
  // 1. Se role for pending -> não bloqueia aqui (bloqueia na rota específica)
  // 2. Se requiresTimeClock for FALSE -> NUNCA bloqueia.
  // 3. Se requiresTimeClock for TRUE -> Bloqueia se o turno estiver fechado.
  // BYPASS: Adicionado explicitamente para segurança
  const isShiftLocked = !!(!isMaster && 
                        currentUser && 
                        userProfile?.role !== 'pending' && 
                        requiresTimeClock && 
                        !isShiftOpen);

  return (
    <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* PUBLIC ROUTES */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          
          {/* PENDING APPROVAL */}
          <Route path="/aguardando-aprovacao" element={
            currentUser ? <PendingApproval /> : <Navigate to="/login" />
          } />

          {/* CMS EDITOR - RESTRICTED (Developer or Admin) */}
          <Route path="/editor-site" element={
            currentUser && (userProfile?.role === 'developer' || userProfile?.role === 'admin') 
            ? <LandingPageEditor /> 
            : <Navigate to="/app" />
          } />

          {/* PROTECTED APP ROUTES */}
          <Route path="/app" element={
            currentUser ? (
               // LÓGICA DE PRIORIDADE:
               // 1. SE FOR GESTOR (isMaster) -> ACESSO TOTAL IMEDIATO
               isMaster ? (
                 <EnforceShiftLock isShiftLocked={isShiftLocked}>
                    <Layout />
                 </EnforceShiftLock>
               ) : 
               // 2. SE FOR PENDENTE -> TELA DE ESPERA
               userProfile?.role === 'pending' ? (
                 <Navigate to="/aguardando-aprovacao" />
               ) : 
               // 3. SE FALTAR FOTO (E NÃO FOR GESTOR) -> BLOQUEIO
               isAvatarMissing ? (
                 // BLOQUEIO DE SEGURANÇA DE IDENTIDADE
                 <div className="min-h-screen bg-gray-50 flex flex-col">
                    <div className="bg-red-600 px-4 py-3 text-white flex items-center justify-between shadow-md z-50 sticky top-0">
                        <div className="flex items-center gap-3 mx-auto">
                            <ShieldAlert className="w-6 h-6 animate-pulse flex-shrink-0" />
                            <span className="font-bold text-sm md:text-base text-center">
                              BLOQUEIO DE SEGURANÇA: Para utilizar o sistema e registrar ponto, você deve cadastrar uma foto de perfil válida.
                            </span>
                        </div>
                        <button 
                          onClick={handleEmergencyLogout} 
                          className="text-white/80 hover:text-white text-xs underline ml-4 flex items-center gap-1 flex-shrink-0"
                        >
                            <LogOut size={14} /> Sair
                        </button>
                    </div>
                    <div className="flex-1 p-6 flex justify-center overflow-y-auto">
                        <div className="w-full max-w-4xl pt-8">
                           <UserProfile />
                        </div>
                    </div>
                 </div>
               ) : (
                 // 4. ACESSO NORMAL (SUJEITO A SHIFT LOCK)
                 <EnforceShiftLock isShiftLocked={isShiftLocked}>
                    <Layout />
                 </EnforceShiftLock>
               )
            ) : (
              <Navigate to="/login" />
            )
          }>
            <Route index element={<Dashboard />} />
            <Route path="perfil" element={<UserProfile />} /> {/* Rota de Perfil */}
            
            {/* Operational Routes */}
            <Route path="ponto" element={
              hasPermission('canRegisterAttendance') ? <Ponto /> : <Navigate to="/app" />
            } />
            
            <Route path="projetos" element={
              hasPermission('canManageProjects') ? <Projects /> : <Navigate to="/app" />
            } />
            
            <Route path="tarefas" element={
              hasPermission('canViewTasks') ? <Tasks /> : <Navigate to="/app" />
            } />

            {/* NEW: SCHEDULE ROUTE */}
            <Route path="agenda" element={
              hasPermission('canViewSchedule') ? <Schedule /> : <Navigate to="/app" />
            } />
            
            <Route path="clientes" element={
              hasPermission('canManageClients') ? <Clients /> : <Navigate to="/app" />
            } />
            
            <Route path="estoque" element={
              hasPermission('canViewInventory') ? <Inventory /> : <Navigate to="/app" />
            } />

            {/* Management & Admin Routes */}
            <Route path="modelos" element={
              hasPermission('canManageSettings') ? <TaskTemplates /> : <Navigate to="/app" />
            } />
            
            <Route path="usuarios" element={
              hasPermission('canManageUsers') ? <Users /> : <Navigate to="/app" />
            } />
            
            <Route path="setores" element={
              hasPermission('canManageSectors') ? <SectorManagement /> : <Navigate to="/app" />
            } />
            
            <Route path="locais" element={
              hasPermission('canManageUsers') ? <WorkLocations /> : <Navigate to="/app" />
            } />
            
            <Route path="relatorios-ponto" element={
              hasPermission('canViewAttendanceReports') ? <AttendanceReports /> : <Navigate to="/app" />
            } />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
    </Suspense>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;
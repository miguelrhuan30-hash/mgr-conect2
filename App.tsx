import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout'; // Mantido estático como estrutura base
import LoadingScreen from './components/LoadingScreen';
import { PermissionSet } from './types';

// Lazy Load Components
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Ponto = lazy(() => import('./components/Ponto'));
const Tasks = lazy(() => import('./components/Tasks'));
const TaskTemplates = lazy(() => import('./components/TaskTemplates'));
const Projects = lazy(() => import('./components/Projects'));
const Inventory = lazy(() => import('./components/Inventory'));
const Users = lazy(() => import('./components/Users'));
const SectorManagement = lazy(() => import('./components/SectorManagement')); // New Component
const Clients = lazy(() => import('./components/Clients'));
const WorkLocations = lazy(() => import('./components/WorkLocations'));
const AttendanceReports = lazy(() => import('./components/AttendanceReports'));
const PendingApproval = lazy(() => import('./components/PendingApproval'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const LandingPageEditor = lazy(() => import('./components/LandingPageEditor'));

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();

  // Helper to check permissions safely
  const hasPermission = (key: keyof PermissionSet) => {
    if (!userProfile) return false;
    // Admins and Developers have full access bypass
    if (userProfile.role === 'admin' || userProfile.role === 'developer') return true;
    // Check specific granular permission
    return !!userProfile.permissions?.[key];
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
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
               userProfile?.role === 'pending' ? <Navigate to="/aguardando-aprovacao" /> : <Layout />
            ) : (
              <Navigate to="/login" />
            )
          }>
            <Route index element={<Dashboard />} />
            
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
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
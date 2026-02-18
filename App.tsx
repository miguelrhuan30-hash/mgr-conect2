import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout'; // Mantido estático como estrutura base
import LoadingScreen from './components/LoadingScreen';

// Lazy Load Components
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Ponto = lazy(() => import('./components/Ponto'));
const Tasks = lazy(() => import('./components/Tasks'));
const TaskTemplates = lazy(() => import('./components/TaskTemplates'));
const Projects = lazy(() => import('./components/Projects'));
const Inventory = lazy(() => import('./components/Inventory'));
const Users = lazy(() => import('./components/Users'));
const Clients = lazy(() => import('./components/Clients'));
const WorkLocations = lazy(() => import('./components/WorkLocations'));
const AttendanceReports = lazy(() => import('./components/AttendanceReports'));
const PendingApproval = lazy(() => import('./components/PendingApproval'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const LandingPageEditor = lazy(() => import('./components/LandingPageEditor'));

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();

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
            <Route path="ponto" element={<Ponto />} />
            <Route path="projetos" element={<Projects />} />
            <Route path="tarefas" element={<Tasks />} />
            <Route path="clientes" element={<Clients />} />
            <Route path="estoque" element={<Inventory />} />

            {/* RESTRICTED ROUTES (Guarded against unauthorized access) */}
            <Route path="modelos" element={
              ['admin', 'manager', 'developer'].includes(userProfile?.role || '') 
              ? <TaskTemplates /> 
              : <Navigate to="/app" />
            } />
            
            <Route path="usuarios" element={
              ['admin', 'developer'].includes(userProfile?.role || '') 
              ? <Users /> 
              : <Navigate to="/app" />
            } />
            
            <Route path="locais" element={
              ['admin', 'developer'].includes(userProfile?.role || '') 
              ? <WorkLocations /> 
              : <Navigate to="/app" />
            } />
            
            <Route path="relatorios-ponto" element={
              ['admin', 'developer', 'manager'].includes(userProfile?.role || '') 
              ? <AttendanceReports /> 
              : <Navigate to="/app" />
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
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Ponto from './components/Ponto';
import Tasks from './components/Tasks';
import TaskTemplates from './components/TaskTemplates';
import Projects from './components/Projects';
import Inventory from './components/Inventory';
import Users from './components/Users';
import Clients from './components/Clients';
import WorkLocations from './components/WorkLocations';
import AttendanceReports from './components/AttendanceReports';
import PendingApproval from './components/PendingApproval';
import LandingPage from './components/LandingPage';
import LandingPageEditor from './components/LandingPageEditor';
import { Loader2 } from 'lucide-react';

const AppContent: React.FC = () => {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <Router>
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
          <Route path="modelos" element={<TaskTemplates />} />
          <Route path="clientes" element={<Clients />} />
          <Route path="estoque" element={<Inventory />} />
          <Route path="usuarios" element={<Users />} />
          <Route path="locais" element={<WorkLocations />} />
          <Route path="relatorios-ponto" element={<AttendanceReports />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
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
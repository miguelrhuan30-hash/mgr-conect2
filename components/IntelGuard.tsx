import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingScreen from './LoadingScreen';

interface IntelGuardProps {
  children: React.ReactNode;
}

const IntelGuard: React.FC<IntelGuardProps> = ({ children }) => {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  const isAuthorized = 
    userProfile?.role === 'admin' || 
    userProfile?.role === 'developer' || 
    userProfile?.role === 'intel_admin' || 
    userProfile?.role === 'intel_analyst' || 
    userProfile?.role === 'intel_viewer';

  if (!isAuthorized) {
    console.warn("🚫 IntelGuard: Acesso negado para o usuário", userProfile?.email);
    return <Navigate to="/app" replace />;
  }

  return <>{children}</>;
};

export default IntelGuard;

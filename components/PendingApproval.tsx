import React from 'react';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, LogOut, Clock, Hexagon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PendingApproval: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
        
        <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center text-yellow-600 mb-6">
          <Clock className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Aprovação Necessária</h2>
          <p className="text-gray-500">
            Olá, <span className="font-semibold text-gray-700">{userProfile?.displayName || 'Usuário'}</span>. 
            Sua conta foi criada com sucesso, mas o acesso ao sistema requer aprovação de um administrador.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm text-yellow-800 font-medium">O que fazer agora?</p>
              <p className="text-sm text-yellow-700 mt-1">
                Aguarde a liberação do seu gestor. Você pode sair e tentar logar novamente mais tarde para verificar se o acesso foi liberado.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 transition-colors"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sair e Voltar Mais Tarde
        </button>

        <div className="flex items-center justify-center text-gray-300 gap-2 mt-8">
            <Hexagon size={16} />
            <span className="text-xs font-semibold tracking-wider uppercase">MGR Conect</span>
        </div>
      </div>
    </div>
  );
};

export default PendingApproval;
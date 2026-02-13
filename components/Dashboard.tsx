import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, Clock, CheckSquare, Package, Briefcase, TrendingUp } from 'lucide-react';

const Dashboard: React.FC = () => {
  const { userProfile } = useAuth();

  const stats = [
    { label: 'Tarefas Pendentes', value: '12', icon: CheckSquare, color: 'text-blue-600', bg: 'bg-blue-100' },
    { label: 'Projetos Ativos', value: '4', icon: Briefcase, color: 'text-purple-600', bg: 'bg-purple-100' },
    { label: 'Horas no Mês', value: '142h', icon: Clock, color: 'text-green-600', bg: 'bg-green-100' },
    { label: 'Itens em Baixa', value: '3', icon: Package, color: 'text-orange-600', bg: 'bg-orange-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <p className="text-gray-500">Bem-vindo de volta, {userProfile?.displayName || 'Colaborador'}.</p>
      </div>

      {/* Gamification Banner */}
      <div className="bg-gradient-to-r from-brand-900 to-brand-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-full backdrop-blur-sm">
              <Trophy className="w-8 h-8 text-accent-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Nível {userProfile?.level || 1}</h2>
              <p className="text-brand-100 text-sm">Próximo nível em 250 XP</p>
            </div>
          </div>
          
          <div className="w-full md:w-1/3">
            <div className="flex justify-between text-xs mb-1 font-medium text-brand-100">
              <span>Progresso Atual</span>
              <span>75%</span>
            </div>
            <div className="w-full bg-black/20 rounded-full h-2.5 backdrop-blur-sm">
              <div 
                className="bg-accent-500 h-2.5 rounded-full transition-all duration-500 shadow-lg shadow-accent-500/50" 
                style={{ width: '75%' }}
              ></div>
            </div>
          </div>
        </div>
        
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-48 h-48 rounded-full bg-white/5 blur-2xl"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.bg} p-3 rounded-lg`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full flex items-center">
                <TrendingUp size={12} className="mr-1" /> +2.5%
              </span>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
            <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Recent Activity Section Placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Atividades Recentes</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
              <div className="w-2 h-2 mt-2 rounded-full bg-gray-300"></div>
              <div>
                <p className="text-sm text-gray-900">Atualização de status no projeto <strong>Marketing Digital</strong></p>
                <p className="text-xs text-gray-500">Há 2 horas • via Sistema</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
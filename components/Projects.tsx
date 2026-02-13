import React from 'react';
import { Briefcase, Construction } from 'lucide-react';

const Projects: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meus Projetos</h1>
          <p className="text-gray-500">Gerencie o andamento dos projetos ativos.</p>
        </div>
        <button className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors text-sm font-medium">
          Novo Projeto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Construction className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Módulo em Desenvolvimento</h3>
        <p className="text-gray-500 mt-2 max-w-md mx-auto">
          A gestão completa de projetos com Kanban e Gantt estará disponível na próxima atualização do sistema (v1.1).
        </p>
      </div>
    </div>
  );
};

export default Projects;
import React from 'react';
import { Loader2, Hexagon } from 'lucide-react';

const LoadingScreen: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center animate-pulse">
        <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center text-brand-600 mb-4">
          <Hexagon size={40} strokeWidth={1.5} />
        </div>
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mb-2" />
        <p className="text-sm font-medium text-gray-400">Carregando...</p>
      </div>
    </div>
  );
};

export default LoadingScreen;
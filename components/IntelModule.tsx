import React from 'react';
import { Brain, Sparkles, Loader2 } from 'lucide-react';
import IntelInput from './IntelInput';
import IntelFeed from './IntelFeed';
import IntelInsights from './IntelInsights';
import IntelConfig from './IntelConfig';
import { useIntel } from '../hooks/useIntel';
import { useIntelApply } from '../hooks/useIntelApply';
import { useAuth } from '../contexts/AuthContext';
import { IntelNote, IntelDestino } from '../types';

const IntelModule: React.FC = () => {
    const { userProfile } = useAuth();
    const { notes, loading, createNote } = useIntel();
    const { handleApplyInsight } = useIntelApply();
    const [activeTab, setActiveTab] = React.useState<'feed' | 'insights' | 'config'>('feed');

    /**
     * Chamado pelo IntelCard.
     * Recebe a nota completa (para ter acesso à analise) + o destino escolhido pelo gestor.
     */
    const handleApply = async (note: IntelNote, destino: IntelDestino): Promise<void> => {
        await handleApplyInsight(note, destino);
    };

    const isAdmin = ['admin', 'developer', 'intel_admin'].includes(userProfile?.role || '');

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-600/20">
                            <Brain size={24} />
                        </div>
                        Inteligência MGR
                    </h1>
                    <p className="text-gray-500 mt-1">Transforme observações operacionais em decisões estratégicas.</p>
                </div>
                <div className="flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-2 rounded-lg border border-brand-200">
                    <Sparkles size={18} className="animate-pulse" />
                    <span className="text-sm font-bold uppercase tracking-wider">Powered by Gemini</span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-gray-200 gap-8">
                <button
                    onClick={() => setActiveTab('feed')}
                    className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'feed' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Feed de Insights
                    {notes.length > 0 && (
                        <span className="ml-2 bg-brand-100 text-brand-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            {notes.filter(n => n.status !== 'aplicada').length || notes.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('insights')}
                    className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'insights' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                    Painel Estratégico
                </button>
                {isAdmin && (
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`pb-4 text-sm font-bold transition-all border-b-2 ${activeTab === 'config' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                    >
                        Configurações
                    </button>
                )}
            </div>

            {/* Content Section */}
            {activeTab === 'feed' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <IntelInput onSend={createNote} />
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                            <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Sincronizando Insights...</p>
                        </div>
                    ) : (
                        <IntelFeed notes={notes} onApply={handleApply} />
                    )}
                </div>
            )}

            {activeTab === 'insights' && <IntelInsights />}
            {activeTab === 'config' && <IntelConfig />}
        </div>
    );
};

export default IntelModule;

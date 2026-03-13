import React from 'react';
import { Brain, Sparkles, Loader2 } from 'lucide-react';
import IntelInput from './IntelInput';
import IntelFeed from './IntelFeed';
import { useIntel } from '../hooks/useIntel';

const IntelModule: React.FC = () => {
    const { notes, loading, createNote } = useIntel();

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
                    <span className="text-sm font-bold uppercase tracking-wider">AI Powered</span>
                </div>
            </div>

            {/* Input Section */}
            <IntelInput onSend={createNote} />

            {/* Content Section */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Sincronizando Insights...</p>
                </div>
            ) : (
                <IntelFeed notes={notes} />
            )}
        </div>
    );
};

export default IntelModule;

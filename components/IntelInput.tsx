import React, { useState } from 'react';
import { Brain, Send, Loader2, Sparkles } from 'lucide-react';

interface IntelInputProps {
    onSend: (text: string) => Promise<void>;
}

const IntelInput: React.FC<IntelInputProps> = ({ onSend }) => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!text.trim() || loading) return;

        setLoading(true);
        try {
            await onSend(text);
            setText('');
        } catch (err) {
            console.error("Error sending insight:", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border-2 border-brand-100 shadow-xl overflow-hidden shadow-brand-900/5">
            <form onSubmit={handleSubmit} className="p-4">
                <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white">
                        <Brain size={18} />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">Novo Insight em Linguagem Natural</h3>
                        <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Oponente estratégico: Claude-3.5-Sonnet</p>
                    </div>
                </div>

                <div className="relative">
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Ex: Identifiquei que os técnicos estão perdendo muito tempo no deslocamento para o setor Sul. Precisamos otimizar as rotas."
                        className="w-full h-24 p-4 text-sm text-gray-900 bg-gray-50 rounded-xl border-none focus:ring-2 focus:ring-brand-500 resize-none transition-all placeholder:text-gray-400"
                        disabled={loading}
                    />
                    
                    <div className="absolute bottom-2 right-2 flex items-center gap-2">
                        {loading && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-brand-700 animate-pulse">
                                <Loader2 size={14} className="animate-spin" /> Processando IA...
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={!text.trim() || loading}
                            className={`
                                flex items-center justify-center w-10 h-10 rounded-xl transition-all
                                ${text.trim() && !loading 
                                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/20 hover:scale-105 active:scale-95' 
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'}
                            `}
                        >
                            <Send size={20} />
                        </button>
                    </div>
                </div>
                
                <div className="mt-3 flex items-center gap-4 px-1">
                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                      <Sparkles size={12} className="text-brand-500" /> Auto-Categorização Ativa
                   </div>
                   <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase">
                      <Sparkles size={12} className="text-brand-500" /> Análise de Sentimento
                   </div>
                </div>
            </form>
        </div>
    );
};

export default IntelInput;

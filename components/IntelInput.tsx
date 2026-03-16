import React, { useState, useRef } from 'react';
import { Brain, Send, Loader2, Sparkles, ChevronRight, AlertTriangle } from 'lucide-react';

interface IntelInputProps {
    onSend: (text: string) => Promise<void>;
}

const PLACEHOLDER_EXAMPLES = [
    'Ex: O cliente Honor ficou 3 dias sem resposta após aprovação do orçamento. Ninguém avisou o administrativo...',
    'Ex: Poderíamos oferecer contratos anuais de manutenção para os 8 clientes que instalamos no último ano...',
    'Ex: A equipe técnica não tem um padrão para registrar o que foi feito na OS. Cada um faz diferente...',
    'Ex: Duas câmaras com manutenção preventiva vencendo em abril e nenhuma está agendada ainda...',
];

const MIN_CHARS = 20;

const IntelInput: React.FC<IntelInputProps> = ({ onSend }) => {
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [placeholder] = useState(PLACEHOLDER_EXAMPLES[Math.floor(Math.random() * PLACEHOLDER_EXAMPLES.length)]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const trimmed = text.trim();
    const isReady = trimmed.length >= MIN_CHARS && !loading;

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!isReady) return;

        setError(null);
        setLoading(true);
        try {
            await onSend(trimmed);
            setText('');
            textareaRef.current?.focus();
        } catch (err: any) {
            setError(err?.message || 'Erro ao processar insight. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    // Ctrl+Enter / Cmd+Enter submits
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="bg-white rounded-2xl border-2 border-brand-100 shadow-xl overflow-hidden shadow-brand-900/5">
            <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-5 pb-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center text-white shadow-lg shadow-brand-600/20 flex-shrink-0">
                        <Brain size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-900 leading-tight">Novo Insight Operacional</h3>
                        <p className="text-[10px] text-brand-500 font-semibold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                            <Sparkles size={10} className="animate-pulse" />
                            Powered by Gemini 2.0 Flash
                        </p>
                    </div>
                    <div className="hidden sm:flex flex-col items-end gap-0.5">
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Auto-Categorização</span>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Análise de Sentimento</span>
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-wider">Roteamento para Hub</span>
                    </div>
                </div>

                {/* Textarea */}
                <div className="px-5 pb-3 relative">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => { setText(e.target.value); setError(null); }}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        rows={4}
                        className={`w-full p-4 text-sm text-gray-900 bg-gray-50 rounded-xl border 
                            focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent
                            resize-none transition-all placeholder:text-gray-400 leading-relaxed
                            ${loading ? 'opacity-50 cursor-not-allowed' : ''}
                            ${error ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                        disabled={loading}
                    />

                    {/* Char counter */}
                    <div className="absolute bottom-5 left-8 flex items-center gap-2">
                        {trimmed.length > 0 && trimmed.length < MIN_CHARS && (
                            <span className="text-[10px] text-amber-500 font-medium">
                                Mínimo {MIN_CHARS - trimmed.length} caractere(s)
                            </span>
                        )}
                        {trimmed.length >= MIN_CHARS && !loading && (
                            <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                                <ChevronRight size={10} /> Pronto para análise
                            </span>
                        )}
                    </div>
                </div>

                {/* Error state */}
                {error && (
                    <div className="mx-5 mb-3 flex items-start gap-2 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2 border border-red-100">
                        <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                        {error}
                    </div>
                )}

                {/* Footer */}
                <div className="px-5 pb-5 flex items-center justify-between gap-3 flex-wrap">
                    {loading ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 animate-pulse">
                            <Loader2 size={14} className="animate-spin" />
                            Gemini está analisando o seu insight...
                        </div>
                    ) : (
                        <span className="text-[10px] text-gray-400">
                            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">Ctrl</kbd>
                            {' '}+{' '}
                            <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] font-mono">↵</kbd>
                            {' '}para enviar
                        </span>
                    )}

                    <button
                        type="submit"
                        disabled={!isReady}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all
                            ${isReady
                                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 hover:scale-105 active:scale-95'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                    >
                        {loading
                            ? <><Loader2 size={16} className="animate-spin" /> Processando...</>
                            : <><Send size={16} /> Analisar com Gemini</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default IntelInput;

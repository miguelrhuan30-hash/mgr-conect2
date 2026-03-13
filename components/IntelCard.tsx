import React from 'react';
import { 
    AlertCircle, 
    CheckCircle, 
    Info, 
    ArrowUpRight, 
    MessageSquare, 
    Zap, 
    TrendingUp, 
    ShieldAlert, 
    Clock, 
    User,
    Check,
    Loader2
} from 'lucide-react';
import { IntelNote } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface IntelCardProps {
    note: IntelNote;
    onApply?: (noteId: string) => Promise<void>;
}

const IntelCard: React.FC<IntelCardProps> = ({ note, onApply }) => {
    const { analysis } = note;
    const [applying, setApplying] = React.useState(false);

    const handleApply = async () => {
        if (!onApply || !note.id || applying) return;
        setApplying(true);
        try {
            await onApply(note.id);
        } finally {
            setApplying(false);
        }
    };

    const getUrgencyStyles = (urgency: string = 'low') => {
        switch (urgency) {
            case 'critical': return 'bg-red-50 border-red-200 text-red-700';
            case 'high':     return 'bg-orange-50 border-orange-200 text-orange-700';
            case 'medium':   return 'bg-blue-50 border-blue-200 text-blue-700';
            default:         return 'bg-gray-50 border-gray-200 text-gray-700';
        }
    };

    const getUrgencyIcon = (urgency: string = 'low') => {
        switch (urgency) {
            case 'critical': return <ShieldAlert size={16} />;
            case 'high':     return <Zap size={16} />;
            case 'medium':   return <Info size={16} />;
            default:         return <Clock size={16} />;
        }
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'positive':   return '😊';
            case 'frustrated': return '😤';
            case 'negative':   return '😟';
            default:           return '😐';
        }
    };

    return (
        <div className={`rounded-xl border p-5 transition-all hover:shadow-md ${analysis ? 'bg-white' : 'bg-gray-50/50 grayscale'}`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-bold border border-brand-200">
                      <User size={16} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-gray-900">{note.createdBy}</p>
                        <p className="text-[10px] text-gray-500">
                           {note.createdAt ? format(note.createdAt.toDate(), "dd 'de' MMMM, HH:mm", { locale: ptBR }) : 'Processando...'}
                        </p>
                    </div>
                </div>
                {analysis && (
                    <div className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getUrgencyStyles(analysis.urgency)}`}>
                        {getUrgencyIcon(analysis.urgency)}
                        {analysis.urgency}
                    </div>
                )}
            </div>

            <div className="mb-4">
                <p className="text-sm text-gray-800 italic border-l-2 border-gray-200 pl-3">"{note.text}"</p>
            </div>

            {analysis ? (
                <div className="space-y-4 pt-4 border-t border-gray-100">
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 shadow-sm inline-block">Resumo da IA</h4>
                        <p className="text-sm text-gray-900 leading-relaxed font-medium">
                            {analysis.summary}
                        </p>
                    </div>

                    <div className="bg-emerald-50/50 rounded-lg p-3 border border-emerald-100/50">
                        <h4 className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <TrendingUp size={10} /> Sugestão de Ação
                        </h4>
                        <p className="text-sm text-emerald-900 italic">
                            {analysis.suggestion}
                        </p>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <span className="text-xs text-gray-500 flex items-center gap-1.5">
                                <span className="text-lg">{getSentimentIcon(analysis.sentiment)}</span>
                                <span className="capitalize">{analysis.sentiment}</span>
                            </span>
                            <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded border border-brand-100">
                                {analysis.category}
                            </span>
                        </div>

                        <button 
                            onClick={handleApply}
                            disabled={note.applied || applying}
                            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all
                                ${note.applied 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default' 
                                    : 'text-brand-700 hover:text-brand-800 bg-brand-50 border-brand-200 active:scale-95'}
                                ${applying ? 'opacity-50 cursor-wait' : ''}
                            `}
                        >
                            {note.applied ? (
                                <><Check size={14} /> Aplicado</>
                            ) : (
                                <>
                                    {applying ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar Sugestão'} 
                                    <ArrowUpRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-2 text-gray-400 py-4 animate-pulse">
                    <Zap size={16} />
                    <span className="text-xs font-medium">Claude está analisando esta nota...</span>
                </div>
            )}
        </div>
    );
};

export default IntelCard;

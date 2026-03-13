import React from 'react';
import { Sparkles, History } from 'lucide-react';
import IntelCard from './IntelCard';
import { IntelNote } from '../types';

interface IntelFeedProps {
    notes: IntelNote[];
    onApply?: (noteId: string) => Promise<void>;
}

const IntelFeed: React.FC<IntelFeedProps> = ({ notes, onApply }) => {
    if (notes.length === 0) {
        return (
            <div className="bg-white rounded-xl border border-gray-100 p-12 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center text-brand-400 mb-6">
                    <Sparkles size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum insight encontrado</h3>
                <p className="text-sm text-gray-500 max-w-xs mx-auto">
                    Suas observações aparecerão aqui após serem processadas pela IA. Comece registrando algo acima!
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <History size={14} /> Feed de Inteligência
                </h3>
                <span className="text-[10px] font-medium text-gray-400">Total: {notes.length} registros</span>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
                {notes.map((note) => (
                    <IntelCard key={note.id} note={note} onApply={onApply} />
                ))}
            </div>
        </div>
    );
};

export default IntelFeed;

/**
 * components/intel/IshikawaAnalysisList.tsx — Sprint IW-02
 * Tela de lista de análises Ishikawa com modal de criação.
 */
import React, { useState } from 'react';
import { Plus, Fish, Loader2, AlertCircle } from 'lucide-react';
import { IshikawaAnalysis } from '../../types';
import IshikawaAnalysisCard from './IshikawaAnalysisCard';

interface IshikawaAnalysisListProps {
  analyses: IshikawaAnalysis[];
  loading: boolean;
  onSelect: (id: string) => void;
  onCreate: (nome: string) => Promise<string>;
  onRename: (id: string, nome: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border-2 border-gray-100 p-5 pl-6 animate-pulse">
    <div className="flex items-center gap-2 mb-3">
      <div className="h-4 w-4 bg-gray-200 rounded" />
      <div className="h-4 bg-gray-200 rounded flex-1" />
    </div>
    <div className="h-3 bg-gray-100 rounded mb-4 w-3/4" />
    <div className="h-1.5 bg-gray-100 rounded-full mb-4" />
    <div className="flex justify-between pt-3 border-t border-gray-50">
      <div className="h-3 w-16 bg-gray-100 rounded" />
      <div className="h-3 w-20 bg-gray-100 rounded" />
    </div>
  </div>
);

const IshikawaAnalysisList: React.FC<IshikawaAnalysisListProps> = ({
  analyses, loading, onSelect, onCreate, onRename, onDelete,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [nomeDraft, setNomeDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    const trimmed = nomeDraft.trim();
    if (trimmed.length < 3) {
      setError('O nome deve ter pelo menos 3 caracteres.');
      return;
    }
    if (trimmed.length > 120) {
      setError('O nome deve ter no máximo 120 caracteres.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      const id = await onCreate(trimmed);
      setModalOpen(false);
      setNomeDraft('');
      onSelect(id); // Navega direto para o editor
    } catch (e: any) {
      setError(e?.message || 'Erro ao criar análise.');
    } finally {
      setCreating(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
    setNomeDraft('');
    setError('');
  };

  return (
    <div className="space-y-6">

      {/* Header da lista */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            <Fish size={20} className="text-red-600" />
            Análises Ishikawa
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {loading ? 'Carregando...' : `${analyses.length} análise${analyses.length !== 1 ? 's' : ''} salva${analyses.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          id="btn-nova-analise-ishikawa"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-600/25 transition-all hover:scale-[1.02] active:scale-95"
        >
          <Plus size={16} />
          Nova Análise
        </button>
      </div>

      {/* Grid de cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : analyses.length === 0 ? (
        /* Estado vazio */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mb-5 text-4xl shadow-inner shadow-red-100">
            🐟
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">
            Nenhuma análise ainda
          </h3>
          <p className="text-sm text-gray-500 max-w-xs mb-6">
            Crie sua primeira espinha de Ishikawa para mapear causas-raiz de um problema específico.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-600/20 transition-all hover:scale-[1.02]"
          >
            <Plus size={16} />
            Criar primeira análise
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map(a => (
            <IshikawaAnalysisCard
              key={a.id}
              analysis={a}
              onOpen={onSelect}
              onRename={(id, nome) => onRename(id, nome)}
              onDelete={(id) => onDelete(id)}
            />
          ))}
        </div>
      )}

      {/* Modal de criação */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget) closeModal(); }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />

          {/* Dialog */}
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-xl">
                🐟
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900">Nova Análise Ishikawa</h3>
                <p className="text-xs text-gray-500">Dê um nome claro ao problema a analisar</p>
              </div>
            </div>

            <label className="block text-xs font-bold text-gray-600 mb-1.5 uppercase tracking-wide">
              Nome da Análise / Caso
            </label>
            <input
              id="input-nome-analise"
              autoFocus
              value={nomeDraft}
              onChange={e => { setNomeDraft(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter' && !creating) handleCreate(); if (e.key === 'Escape') closeModal(); }}
              maxLength={120}
              placeholder="Ex: Alta taxa de retrabalho técnico em câmaras Walk-in"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 transition-all"
            />
            <div className="flex justify-between mt-1 mb-4">
              {error ? (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {error}
                </p>
              ) : <span />}
              <span className="text-[10px] text-gray-400 ml-auto">{nomeDraft.length}/120</span>
            </div>

            <div className="flex gap-3">
              <button
                onClick={closeModal}
                className="flex-1 px-4 py-2.5 border-2 border-gray-200 text-gray-600 font-bold text-sm rounded-xl hover:bg-gray-50 transition-all"
              >
                Cancelar
              </button>
              <button
                id="btn-confirmar-nova-analise"
                onClick={handleCreate}
                disabled={creating || nomeDraft.trim().length < 3}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                {creating ? 'Criando...' : 'Criar e Abrir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IshikawaAnalysisList;

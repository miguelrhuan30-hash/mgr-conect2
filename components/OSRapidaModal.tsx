import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';
import { criarOSRapida } from '../services/osService';
import { useAuth } from '../contexts/AuthContext';
import { X, Zap, Loader2, Building2, User } from 'lucide-react';

interface OSRapidaModalProps {
  open: boolean;
  onClose: () => void;
  onGerada: (osId: string, numeroOS: string) => void;
}

const OSRapidaModal: React.FC<OSRapidaModalProps> = ({ open, onClose, onGerada }) => {
  const { currentUser, userProfile } = useAuth() as any;

  const [clientes, setClientes] = useState<{ id: string; name: string }[]>([]);
  const [clienteId, setClienteId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteQuery, setClienteQuery] = useState('');
  const [showSugestoes, setShowSugestoes] = useState(false);

  const [tecnicoId, setTecnicoId] = useState('');
  const [tecnicoNome, setTecnicoNome] = useState('');

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Pré-preenche técnico com o usuário logado
  useEffect(() => {
    if (currentUser) {
      setTecnicoId(currentUser.uid);
      setTecnicoNome(userProfile?.displayName || userProfile?.nomeCompleto || currentUser.email || '');
    }
  }, [currentUser, userProfile]);

  // Carrega clientes uma vez
  useEffect(() => {
    if (!open) return;
    getDocs(collection(db, CollectionName.CLIENTS))
      .then(snap => setClientes(snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || d.id }))))
      .catch(() => setClientes([]));

    setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sugestoesFiltradas = clienteQuery.trim()
    ? clientes.filter(c => c.name.toLowerCase().includes(clienteQuery.toLowerCase())).slice(0, 6)
    : [];

  const selecionarCliente = (id: string, name: string) => {
    setClienteId(id);
    setClienteNome(name);
    setClienteQuery(name);
    setShowSugestoes(false);
  };

  const limparCliente = () => {
    setClienteId('');
    setClienteNome('');
    setClienteQuery('');
  };

  const handleGerar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const { osId, numeroOS } = await criarOSRapida({
        clienteId: clienteId || undefined,
        clienteNome: clienteNome || undefined,
        tecnicoId: tecnicoId || undefined,
        tecnicoNome: tecnicoNome || undefined,
      });
      onGerada(osId, numeroOS);
      onClose();
    } catch (e: any) {
      setErro('Falha ao gerar OS. Tente novamente.');
      console.error('OSRapidaModal error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) handleGerar();
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-brand-600 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Nova OS Rápida</h2>
              <p className="text-[11px] text-gray-400">Número gerado em &lt;2 seg · formulário impresso em branco</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Cliente */}
          <div className="relative">
            <label className="flex items-center gap-1 text-xs font-bold text-gray-600 mb-1.5">
              <Building2 className="w-3.5 h-3.5" /> Cliente <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                value={clienteQuery}
                onChange={e => {
                  setClienteQuery(e.target.value);
                  setShowSugestoes(true);
                  if (!e.target.value) limparCliente();
                }}
                onFocus={() => setShowSugestoes(true)}
                onBlur={() => setTimeout(() => setShowSugestoes(false), 150)}
                placeholder="Buscar cliente..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
              {clienteId && (
                <button onClick={limparCliente}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {showSugestoes && sugestoesFiltradas.length > 0 && (
              <div className="absolute z-10 w-full bg-white border border-gray-100 rounded-xl shadow-lg mt-1 overflow-hidden">
                {sugestoesFiltradas.map(c => (
                  <button key={c.id} type="button"
                    onMouseDown={() => selecionarCliente(c.id, c.name)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 text-gray-700 transition-colors">
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Técnico */}
          <div>
            <label className="flex items-center gap-1 text-xs font-bold text-gray-600 mb-1.5">
              <User className="w-3.5 h-3.5" /> Técnico Responsável <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              value={tecnicoNome}
              onChange={e => setTecnicoNome(e.target.value)}
              placeholder="Nome do técnico..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>

          {erro && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Info */}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 text-xs text-amber-700">
            <strong>Gerador Rápido:</strong> A OS recebe um número sequencial único (ex: MGR-2026-05-001) e o formulário em branco é impresso automaticamente para preenchimento manual em campo.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex gap-3">
          <button onClick={onClose} disabled={loading}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Cancelar
          </button>
          <button onClick={handleGerar} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
              : <><Zap className="w-4 h-4" /> Gerar e Imprimir</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OSRapidaModal;

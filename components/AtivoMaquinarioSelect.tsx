/**
 * AtivoMaquinarioSelect — par de selects "Ativo vinculado" (ClientAsset) +
 * "Maquinário específico" (Maquinario, escopado pelo ativo escolhido).
 *
 * Reutilizado em qualquer ponto onde o vínculo de equipamento da O.S. pode
 * ser definido ou corrigido: criação (OSCreationModal), edição pelo gestor
 * (OSEditModal) e edição pelo técnico em campo (FieldOSDetail) — o cliente
 * pode ter apontado o ativo errado, e o técnico só descobre a peça exata
 * durante o atendimento.
 */
import React, { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';

interface Props {
  clientId: string;
  ativoId: string;
  maquinarioId: string;
  onChangeAtivo: (id: string, nome: string) => void;
  onChangeMaquinario: (id: string, nome: string) => void;
  variant?: 'light' | 'dark';
  disabled?: boolean;
}

export default function AtivoMaquinarioSelect({
  clientId, ativoId, maquinarioId,
  onChangeAtivo, onChangeMaquinario, variant = 'light', disabled,
}: Props) {
  const dark = variant === 'dark';
  const [ativos, setAtivos] = useState<{ id: string; nome: string }[]>([]);
  const [maquinarios, setMaquinarios] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    if (!clientId) { setAtivos([]); return; }
    getDocs(query(collection(db, CollectionName.ASSETS), where('clientId', '==', clientId)))
      .then(snap => setAtivos(snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setAtivos([]));
  }, [clientId]);

  useEffect(() => {
    if (!ativoId) { setMaquinarios([]); return; }
    getDocs(query(collection(db, CollectionName.MAQUINARIOS), where('ativosFinaisAtendidos', 'array-contains', ativoId)))
      .then(snap => setMaquinarios(snap.docs.map(d => ({ id: d.id, nome: (d.data() as any).nome || d.id }))))
      .catch(() => setMaquinarios([]));
  }, [ativoId]);

  const selectCls = dark
    ? 'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50'
    : 'w-full rounded-lg border-gray-300 bg-white text-gray-900 text-sm disabled:opacity-50';
  const labelCls = dark ? 'block text-[10px] font-bold text-gray-500 uppercase mb-1' : 'block text-sm font-medium text-gray-700 mb-1';

  if (!clientId || ativos.length === 0) return null;

  return (
    <div className="space-y-2">
      <div>
        <label className={labelCls}>Ativo vinculado</label>
        <select
          value={ativoId}
          disabled={disabled}
          onChange={e => onChangeAtivo(e.target.value, ativos.find(a => a.id === e.target.value)?.nome || '')}
          className={selectCls}
        >
          <option value="">Nenhum ativo</option>
          {ativos.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
        </select>
      </div>

      {ativoId && maquinarios.length > 0 && (
        <div>
          <label className={labelCls}>Maquinário específico (opcional)</label>
          <select
            value={maquinarioId}
            disabled={disabled}
            onChange={e => onChangeMaquinario(e.target.value, maquinarios.find(m => m.id === e.target.value)?.nome || '')}
            className={selectCls}
          >
            <option value="">Ainda não identificado</option>
            {maquinarios.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

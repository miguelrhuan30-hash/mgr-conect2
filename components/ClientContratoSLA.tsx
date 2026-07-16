/**
 * components/ClientContratoSLA.tsx
 * Gestão do Contrato de Manutenção SLA de um cliente — cadastro de prazos de
 * resposta por prioridade (P1-P4) e status do contrato. Mesmo padrão visual
 * de ClientAssets.tsx.
 */
import React, { useState, useEffect } from 'react';
import {
  FileSignature, Plus, Loader2, Pencil, Check, X, Calendar, Clock,
} from 'lucide-react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { ContratoSLA, PrioridadeSLA, CollectionName } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
  clientName?: string;
}

const PRIORIDADES: PrioridadeSLA[] = ['P1', 'P2', 'P3', 'P4'];
const PRIORIDADE_COR: Record<PrioridadeSLA, string> = {
  P1: 'bg-red-50 border-red-200 text-red-700',
  P2: 'bg-orange-50 border-orange-200 text-orange-700',
  P3: 'bg-amber-50 border-amber-200 text-amber-700',
  P4: 'bg-gray-50 border-gray-200 text-gray-600',
};
const STATUS_PILL: Record<ContratoSLA['status'], string> = {
  ativo:    'bg-emerald-50 border-emerald-200 text-emerald-700',
  inativo:  'bg-gray-50 border-gray-200 text-gray-600',
  suspenso: 'bg-amber-50 border-amber-200 text-amber-700',
};
const PRAZO_PADRAO: Record<PrioridadeSLA, number> = { P1: 2, P2: 4, P3: 24, P4: 48 };

const ClientContratoSLA: React.FC<Props> = ({ clientId, clientName }) => {
  const { currentUser } = useAuth();
  const [contrato, setContrato] = useState<ContratoSLA | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    identificador: '',
    status: 'ativo' as ContratoSLA['status'],
    dataInicio: format(new Date(), 'yyyy-MM-dd'),
    dataFim: '',
    prazos: { ...PRAZO_PADRAO } as Record<PrioridadeSLA, number>,
  });

  useEffect(() => {
    if (!clientId) return;
    const q = query(collection(db, CollectionName.CONTRATOS_SLA), where('clientId', '==', clientId), limit(1));
    return onSnapshot(q, snap => {
      if (snap.empty) { setContrato(null); setLoading(false); return; }
      const d = snap.docs[0];
      setContrato({ id: d.id, ...d.data() } as ContratoSLA);
      setLoading(false);
    }, () => setLoading(false));
  }, [clientId]);

  const abrirEdicao = () => {
    if (contrato) {
      setForm({
        identificador: contrato.identificador || '',
        status: contrato.status,
        dataInicio: contrato.dataInicio ? format((contrato.dataInicio as Timestamp).toDate(), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        dataFim: contrato.dataFim ? format((contrato.dataFim as Timestamp).toDate(), 'yyyy-MM-dd') : '',
        prazos: { ...contrato.prazosPrioridade },
      });
    }
    setEditando(true);
  };

  const handleSalvar = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const payload = {
        clientId,
        clientName: clientName || '',
        identificador: form.identificador.trim() || null,
        status: form.status,
        dataInicio: Timestamp.fromDate(new Date(`${form.dataInicio}T00:00:00`)),
        dataFim: form.dataFim ? Timestamp.fromDate(new Date(`${form.dataFim}T00:00:00`)) : null,
        prazosPrioridade: form.prazos,
        updatedAt: serverTimestamp(),
      };
      if (contrato) {
        await updateDoc(doc(db, CollectionName.CONTRATOS_SLA, contrato.id), payload);
      } else {
        await addDoc(collection(db, CollectionName.CONTRATOS_SLA), {
          ...payload,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
        });
      }
      setEditando(false);
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-10 text-brand-600">
      <Loader2 size={20} className="animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <FileSignature size={16} className="text-brand-600" />
          Contrato SLA de {clientName || 'Cliente'}
        </h3>
        {!editando && (
          <button onClick={abrirEdicao}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700">
            {contrato ? <><Pencil size={12} /> Editar</> : <><Plus size={12} /> Criar Contrato SLA</>}
          </button>
        )}
      </div>

      {editando ? (
        <div className="border-2 border-dashed border-brand-200 rounded-xl p-4 bg-brand-50/20 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold text-brand-700">{contrato ? 'Editar Contrato' : 'Novo Contrato SLA'}</p>
            <button type="button" onClick={() => setEditando(false)}>
              <X size={14} className="text-gray-400" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">Identificador (opcional)</label>
              <input value={form.identificador} onChange={e => setForm(p => ({ ...p, identificador: e.target.value }))}
                placeholder="Ex: Contrato Manutenção Anual 2026"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value as ContratoSLA['status'] }))}
                className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg">
                <option value="ativo">Ativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">Início</label>
              <input type="date" value={form.dataInicio} onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-bold text-gray-500 mb-1 block">Fim (opcional)</label>
              <input type="date" value={form.dataFim} onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 mb-2 block">Prazo de resposta por prioridade (horas)</label>
            <div className="grid grid-cols-4 gap-2">
              {PRIORIDADES.map(p => (
                <div key={p}>
                  <p className={`text-[10px] font-bold px-2 py-0.5 rounded-full border text-center mb-1 ${PRIORIDADE_COR[p]}`}>{p}</p>
                  <input type="number" min={1} value={form.prazos[p]}
                    onChange={e => setForm(prev => ({ ...prev, prazos: { ...prev.prazos, [p]: parseInt(e.target.value) || 1 } }))}
                    className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg text-center" />
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSalvar} disabled={saving}
            className="w-full py-2 bg-brand-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Salvar Contrato
          </button>
        </div>
      ) : contrato ? (
        <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900">{contrato.identificador || 'Contrato SLA'}</p>
              <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                <Calendar size={10} />
                Início: {format((contrato.dataInicio as Timestamp).toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                {contrato.dataFim && <> · Fim: {format((contrato.dataFim as Timestamp).toDate(), 'dd/MM/yyyy', { locale: ptBR })}</>}
              </p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_PILL[contrato.status]}`}>
              {contrato.status}
            </span>
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock size={10} /> Prazo de resposta por prioridade
            </p>
            <div className="grid grid-cols-4 gap-2">
              {PRIORIDADES.map(p => (
                <div key={p} className={`rounded-lg border p-2 text-center ${PRIORIDADE_COR[p]}`}>
                  <p className="text-[10px] font-bold">{p}</p>
                  <p className="text-sm font-extrabold">{contrato.prazosPrioridade[p]}h</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <FileSignature size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum contrato SLA cadastrado para este cliente.</p>
        </div>
      )}
    </div>
  );
};

export default ClientContratoSLA;

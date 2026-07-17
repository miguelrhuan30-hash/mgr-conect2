/**
 * components/ChamadosSLA.tsx
 * Painel interno de triagem — chamados abertos pelos clientes no Portal
 * (contrato SLA). Permite transformar um chamado em O.S. de campo, já
 * pré-preenchida com o contrato/prioridade/cliente indicados pelo cliente.
 */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, ChamadoSLA, PrioridadeSLA } from '../types';
import { Loader2, MessageSquareText, Clock, ArrowRightCircle, Ban, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const OSCreationModal = lazy(() => import('./OSCreationModal'));

const PRIORIDADE_COR: Record<PrioridadeSLA, string> = {
  P1: 'bg-red-50 border-red-200 text-red-700',
  P2: 'bg-orange-50 border-orange-200 text-orange-700',
  P3: 'bg-amber-50 border-amber-200 text-amber-700',
  P4: 'bg-gray-50 border-gray-200 text-gray-600',
};
const STATUS_LABEL: Record<ChamadoSLA['status'], { label: string; cor: string }> = {
  aberto:       { label: 'Aberto',         cor: 'bg-blue-50 border-blue-200 text-blue-700' },
  em_triagem:   { label: 'Em análise',     cor: 'bg-amber-50 border-amber-200 text-amber-700' },
  convertido:   { label: 'Convertido',     cor: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  cancelado:    { label: 'Cancelado',      cor: 'bg-gray-50 border-gray-200 text-gray-500' },
};

const PRIORIDADE_ORDEM: Record<PrioridadeSLA, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };

export default function ChamadosSLA() {
  const { userProfile } = useAuth();
  const [chamados, setChamados] = useState<ChamadoSLA[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<'aberto' | 'todos'>('aberto');
  const [chamadoConvertendo, setChamadoConvertendo] = useState<ChamadoSLA | null>(null);

  useEffect(() => {
    const q = query(collection(db, CollectionName.CHAMADOS_SLA), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setChamados(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChamadoSLA)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const visiveis = chamados
    .filter(c => filtroStatus === 'todos' || (c.status === 'aberto' || c.status === 'em_triagem'))
    .sort((a, b) => PRIORIDADE_ORDEM[a.prioridade] - PRIORIDADE_ORDEM[b.prioridade]);

  const handleCancelar = async (c: ChamadoSLA) => {
    if (!confirm(`Cancelar o chamado "${c.titulo}"?`)) return;
    await updateDoc(doc(db, CollectionName.CHAMADOS_SLA, c.id), { status: 'cancelado', updatedAt: serverTimestamp() });
  };

  const handleConvertidoComSucesso = async (taskId?: string) => {
    if (chamadoConvertendo) {
      // A O.S. em si é criada pelo próprio OSCreationModal; aqui só marcamos o chamado.
      await updateDoc(doc(db, CollectionName.CHAMADOS_SLA, chamadoConvertendo.id), {
        status: 'convertido',
        taskId: taskId || null,
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    }
    setChamadoConvertendo(null);
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <MessageSquareText className="w-5 h-5 text-brand-600" /> Chamados de Contrato SLA
        </h1>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {([{ key: 'aberto', label: 'Abertos' }, { key: 'todos', label: 'Todos' }] as const).map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filtroStatus === f.key ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <MessageSquareText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Nenhum chamado {filtroStatus === 'aberto' ? 'em aberto' : ''} no momento.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visiveis.map(c => {
            const st = STATUS_LABEL[c.status];
            const finalizado = c.status === 'convertido' || c.status === 'cancelado';
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORIDADE_COR[c.prioridade]}`}>{c.prioridade}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cor}`}>{st.label}</span>
                  <span className="text-xs font-bold text-gray-400">{c.clientName}</span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />
                    {c.createdAt ? format((c.createdAt as any).toDate(), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">{c.titulo}</p>
                <p className="text-xs text-gray-500 mt-1">{c.descricao}</p>
                <p className="text-[10px] text-gray-400 mt-1.5">Solicitado por {c.criadoPorNome}</p>

                {!finalizado && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setChamadoConvertendo(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700">
                      <ArrowRightCircle className="w-3.5 h-3.5" /> Transformar em O.S.
                    </button>
                    <button onClick={() => handleCancelar(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50">
                      <Ban className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                )}
                {c.status === 'convertido' && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 mt-2">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Convertido em O.S.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {chamadoConvertendo && (
        <Suspense fallback={null}>
          <OSCreationModal
            isOpen={!!chamadoConvertendo}
            onClose={() => setChamadoConvertendo(null)}
            onSuccess={handleConvertidoComSucesso}
            prefill={{
              clientId: chamadoConvertendo.clientId,
              contratoSlaId: chamadoConvertendo.contratoSlaId,
              prioridadeSla: chamadoConvertendo.prioridade,
              title: chamadoConvertendo.titulo,
              description: chamadoConvertendo.descricao,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

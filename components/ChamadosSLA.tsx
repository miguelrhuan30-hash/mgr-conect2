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
import { CollectionName, ChamadoSLA, PrioridadeSLA, TIPO_CHAMADO_LABEL } from '../types';
import { Loader2, MessageSquareText, Clock, ArrowRightCircle, Ban, CheckCircle2, Thermometer } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SlaCountdown from './SlaCountdown';

const OSCreationModal = lazy(() => import('./OSCreationModal'));

interface ChamadosSLAProps {
  variant?: 'light' | 'dark';
  embedded?: boolean;
}

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

export default function ChamadosSLA({ variant = 'light', embedded }: ChamadosSLAProps) {
  const dark = variant === 'dark';
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
    <div className={embedded ? 'space-y-4' : `p-4 md:p-6 space-y-4 max-w-4xl mx-auto ${dark ? 'bg-gray-950 min-h-full' : ''}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {!embedded && (
          <h1 className={`text-xl font-extrabold flex items-center gap-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            <MessageSquareText className="w-5 h-5 text-brand-600" /> Chamados de Contrato SLA
          </h1>
        )}
        <div className={`flex gap-1 p-1 rounded-lg ${dark ? 'bg-gray-900' : 'bg-gray-100'}`}>
          {([{ key: 'aberto', label: 'Abertos' }, { key: 'todos', label: 'Todos' }] as const).map(f => (
            <button key={f.key} onClick={() => setFiltroStatus(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                filtroStatus === f.key
                  ? (dark ? 'bg-gray-800 text-white shadow-sm' : 'bg-white text-brand-700 shadow-sm')
                  : (dark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700')
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {visiveis.length === 0 ? (
        <div className={`text-center py-16 rounded-2xl border border-dashed ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
          <MessageSquareText className={`w-10 h-10 mx-auto mb-3 ${dark ? 'text-gray-700' : 'text-gray-200'}`} />
          <p className={`text-sm ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Nenhum chamado {filtroStatus === 'aberto' ? 'em aberto' : ''} no momento.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visiveis.map(c => {
            const st = STATUS_LABEL[c.status];
            const finalizado = c.status === 'convertido' || c.status === 'cancelado';
            return (
              <div key={c.id} className={`rounded-2xl border p-4 ${dark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORIDADE_COR[c.prioridade]}`}>{c.prioridade}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cor}`}>{st.label}</span>
                  {c.tipo && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dark ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      {TIPO_CHAMADO_LABEL[c.tipo]}
                    </span>
                  )}
                  <span className={`text-xs font-bold ${dark ? 'text-gray-400' : 'text-gray-400'}`}>{c.clientName}</span>
                  <span className={`text-[10px] flex items-center gap-1 ml-auto ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                    <Clock className="w-3 h-3" />
                    {c.createdAt ? format((c.createdAt as any).toDate(), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                  </span>
                </div>
                <p className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{c.titulo}</p>
                <p className={`text-xs mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{c.descricao}</p>
                {c.ativoNome && (
                  <p className={`flex items-center gap-1 text-[11px] mt-1.5 ${dark ? 'text-sky-400' : 'text-sky-600'}`}>
                    <Thermometer className="w-3 h-3" /> {c.ativoNome}
                  </p>
                )}
                {!!c.fotos?.length && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {c.fotos.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block w-12 h-12 rounded-lg overflow-hidden border border-gray-700/40">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                )}
                <p className={`text-[10px] mt-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>Solicitado por {c.criadoPorNome}</p>

                {!finalizado && c.prazoSlaLimite && (
                  <div className="mt-2">
                    <SlaCountdown prazoSlaLimite={c.prazoSlaLimite} prioridade={c.prioridade} variant={dark ? 'dark' : 'light'} />
                  </div>
                )}

                {!finalizado && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setChamadoConvertendo(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700">
                      <ArrowRightCircle className="w-3.5 h-3.5" /> Transformar em O.S.
                    </button>
                    <button onClick={() => handleCancelar(c)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border ${dark ? 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      <Ban className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                )}
                {c.status === 'convertido' && (
                  <div className={`mt-2 space-y-1`}>
                    <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Convertido em O.S.
                    </p>
                    {c.dataAtendimentoPrevista && (
                      <p className={`text-[11px] ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Atendimento previsto: {format((c.dataAtendimentoPrevista as any).toDate(), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    )}
                  </div>
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
              chamadoId: chamadoConvertendo.id,
              ativoId: chamadoConvertendo.ativoId,
              ativoNome: chamadoConvertendo.ativoNome,
              evidencias: chamadoConvertendo.fotos,
            }}
          />
        </Suspense>
      )}
    </div>
  );
}

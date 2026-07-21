/**
 * components/Portal/PortalChamados.tsx
 * Lista de chamados de contrato SLA abertos pelo próprio cliente logado.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, ChamadoSLA, PrioridadeSLA, TIPO_CHAMADO_LABEL } from '../../types';
import { Plus, Loader2, MessageSquareText, Clock, CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SlaCountdown from '../SlaCountdown';

const PRIORIDADE_COR: Record<PrioridadeSLA, string> = {
  P1: 'bg-red-50 border-red-200 text-red-700',
  P2: 'bg-orange-50 border-orange-200 text-orange-700',
  P3: 'bg-amber-50 border-amber-200 text-amber-700',
  P4: 'bg-gray-50 border-gray-200 text-gray-600',
};
const STATUS_LABEL: Record<ChamadoSLA['status'], { label: string; cor: string }> = {
  aberto:       { label: 'Aberto',            cor: 'bg-blue-50 border-blue-200 text-blue-700' },
  em_triagem:   { label: 'Em análise',        cor: 'bg-amber-50 border-amber-200 text-amber-700' },
  convertido:   { label: 'Em atendimento',    cor: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  cancelado:    { label: 'Cancelado',         cor: 'bg-gray-50 border-gray-200 text-gray-500' },
};

export default function PortalChamados() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [chamados, setChamados] = useState<ChamadoSLA[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clientId = (userProfile as any)?.clientId;
    if (!clientId) { setLoading(false); return; }
    const q = query(
      collection(db, CollectionName.CHAMADOS_SLA),
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, snap => {
      setChamados(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChamadoSLA)));
      setLoading(false);
    }, () => setLoading(false));
  }, [userProfile]);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-gray-900">Meus Chamados</h1>
        {(userProfile as any)?.podeAbrirChamado !== false && (
          <button onClick={() => navigate('/portal/novo')}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700">
            <Plus className="w-3.5 h-3.5" /> Novo Chamado
          </button>
        )}
      </div>

      {chamados.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <MessageSquareText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Você ainda não abriu nenhum chamado.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {chamados.map(c => {
            const st = STATUS_LABEL[c.status];
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORIDADE_COR[c.prioridade]}`}>{c.prioridade}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cor}`}>{st.label}</span>
                  {c.tipo && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-gray-50 border-gray-200 text-gray-600">
                      {TIPO_CHAMADO_LABEL[c.tipo]}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-auto">
                    <Clock className="w-3 h-3" />
                    {c.createdAt ? format((c.createdAt as any).toDate(), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                  </span>
                </div>
                <p className="text-sm font-bold text-gray-900">{c.titulo}</p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-3">{c.descricao}</p>
                {(c.status === 'aberto' || c.status === 'em_triagem') && c.prazoSlaLimite && (
                  <div className="mt-2"><SlaCountdown prazoSlaLimite={c.prazoSlaLimite} prioridade={c.prioridade} /></div>
                )}
                {c.status === 'convertido' && c.dataAtendimentoPrevista && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mt-2">
                    <CalendarClock className="w-3.5 h-3.5" />
                    Atendimento previsto: {format((c.dataAtendimentoPrevista as any).toDate(), "dd/MM 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

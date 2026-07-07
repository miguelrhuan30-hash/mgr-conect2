/**
 * ProjectConversas — "Conversas do Projeto" (M4)
 * Agrega, por projeto: dúvidas técnicas (activity_feed tipo duvida_os) e
 * mensagens do Suporte Primário (os_suporte_msgs) de todas as O.S. do
 * projeto, numa timeline única — a intranet de comunicação do projeto.
 */
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';
import { ACTIVITY_FEED_COLLECTION } from '../services/activityFeedService';
import { MessageCircle, HelpCircle, Bot, Loader2, ClipboardList } from 'lucide-react';

interface Props { projectId: string; }

interface Item {
  id: string;
  tipo: 'duvida' | 'suporte';
  autorNome: string;
  autorRole?: string;
  texto: string;
  osTitulo?: string;
  tarefaDescricao?: string;
  criadoEm: Timestamp;
  respondida?: boolean;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function ProjectConversas({ projectId }: Props) {
  const [itens, setItens]     = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelado = false;
    (async () => {
      setLoading(true);
      try {
        const tasksSnap = await getDocs(query(collection(db, CollectionName.TASKS), where('projectId', '==', projectId)));
        const osIds = tasksSnap.docs.map(d => d.id);
        if (osIds.length === 0) { if (!cancelado) { setItens([]); setLoading(false); } return; }

        const grupos = chunk(osIds, 10);
        const [duvidasSnaps, suporteArrs] = await Promise.all([
          Promise.all(grupos.map(g => getDocs(query(
            collection(db, ACTIVITY_FEED_COLLECTION),
            where('osId', 'in', g),
          )).catch(() => null))),
          Promise.all(grupos.map(g => getDocs(query(
            collection(db, CollectionName.OS_SUPORTE_MSGS),
            where('osId', 'in', g),
          )).catch(() => null))),
        ]);

        const duvidas: Item[] = duvidasSnaps.filter(Boolean).flatMap(snap =>
          snap!.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(a => a.tipo === 'duvida_os')
            .map(a => ({
              id: a.id, tipo: 'duvida' as const,
              autorNome: a.autorNome, texto: a.descricao || a.titulo,
              osTitulo: a.osTitulo, criadoEm: a.criadoEm, respondida: a.respondida,
            }))
        );

        const suporte: Item[] = suporteArrs.filter(Boolean).flatMap(snap =>
          snap!.docs.map(d => {
            const s = d.data() as any;
            return {
              id: d.id, tipo: 'suporte' as const,
              autorNome: s.autorNome, autorRole: s.autorRole, texto: s.texto,
              tarefaDescricao: s.tarefaDescricao, criadoEm: s.criadaEm,
            };
          })
        );

        const todos = [...duvidas, ...suporte]
          .filter(i => i.criadoEm)
          .sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));

        if (!cancelado) setItens(todos);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [projectId]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <MessageCircle size={13} /> Conversas do Projeto
      </h3>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
      ) : itens.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Nenhuma conversa registrada nas O.S. deste projeto ainda.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {itens.map(it => (
            <div key={it.id} className={`rounded-xl px-3 py-2.5 border ${
              it.tipo === 'duvida'
                ? it.respondida ? 'bg-emerald-50/60 border-emerald-200' : 'bg-orange-50/60 border-orange-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                {it.tipo === 'duvida'
                  ? <HelpCircle size={11} className={it.respondida ? 'text-emerald-600' : 'text-orange-600'} />
                  : (it.autorRole === 'ia' ? <Bot size={11} className="text-purple-600" /> : <MessageCircle size={11} className="text-gray-500" />)
                }
                <span className="text-xs font-bold text-gray-700">{it.autorNome}</span>
                {it.tarefaDescricao && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5 ml-auto">
                    <ClipboardList size={9} /> {it.tarefaDescricao}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{it.texto}</p>
              {it.osTitulo && <p className="text-[10px] text-gray-400 mt-1">{it.osTitulo}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

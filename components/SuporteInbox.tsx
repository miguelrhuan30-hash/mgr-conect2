/**
 * SuporteInbox — aba "Suporte" do gestor: lista as conversas de suporte
 * agrupadas por O.S. (não é uma lista de mensagens soltas). O gestor escolhe
 * qual O.S. vai responder. Conversas somem da aba "Abertas" quando marcadas
 * como resolvidas (manual, pelo próprio gestor) ou quando a O.S. é concluída
 * (arquivamento automático via Cloud Function) — nunca são apagadas, ficam
 * disponíveis em "Arquivadas" para consulta futura.
 *
 * Usado como página web (`/app/suporte`, variant="light") e como aba dentro
 * de FieldGestaoOS no FieldApp (variant="dark", embedded=true).
 */
import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, OSSuporteThread, Task } from '../types';
import OSSuporteChat from './OSSuporteChat';
import { Headphones, Archive, Inbox, Loader2, Building2 } from 'lucide-react';

const timeAgo = (ts?: Timestamp): string => {
  if (!ts) return '';
  const diffMs = Date.now() - ts.toDate().getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

interface SuporteInboxProps {
  variant?: 'light' | 'dark';
  embedded?: boolean; // true = sem título/cabeçalho próprio, sem padding de página inteira
}

export default function SuporteInbox({ variant = 'light', embedded = false }: SuporteInboxProps) {
  const isDark = variant === 'dark';
  const [aba, setAba] = useState<'abertas' | 'arquivadas'>('abertas');
  const [threads, setThreads] = useState<OSSuporteThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [taskAberta, setTaskAberta] = useState<Task | null>(null);
  const [abrindoId, setAbrindoId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_THREADS),
      where('archived', '==', aba === 'arquivadas'),
      orderBy('ultimaMsgEm', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setThreads(snap.docs.map(d => ({ id: d.id, ...d.data() } as OSSuporteThread)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [aba]);

  const abrirConversa = async (threadId: string) => {
    setAbrindoId(threadId);
    try {
      const snap = await getDoc(doc(db, CollectionName.TASKS, threadId));
      if (snap.exists()) {
        setTaskAberta({ id: snap.id, ...snap.data() } as Task);
      } else {
        alert('Não foi possível encontrar a O.S. dessa conversa.');
      }
    } finally {
      setAbrindoId(null);
    }
  };

  const theme = isDark
    ? {
        card: 'bg-gray-900 border-gray-800 hover:border-purple-700',
        title: 'text-white',
        subtitle: 'text-gray-500',
        osTitulo: 'text-gray-100',
        lastMsg: 'text-gray-400',
        lastMsgAutor: 'text-gray-300',
        time: 'text-gray-500',
        tabOff: 'bg-gray-900 border-gray-800 text-gray-400',
        emptyText: 'text-gray-600',
      }
    : {
        card: 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-sm',
        title: 'text-gray-900',
        subtitle: 'text-gray-500',
        osTitulo: 'text-gray-800',
        lastMsg: 'text-gray-500',
        lastMsgAutor: 'text-gray-600',
        time: 'text-gray-400',
        tabOff: 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
        emptyText: 'text-gray-400',
      };

  return (
    <div className={embedded ? 'space-y-4' : 'max-w-3xl mx-auto px-4 py-6 space-y-5'}>
      {!embedded && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-100 flex items-center justify-center">
            <Headphones size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className={`text-lg font-black ${theme.title}`}>Suporte</h1>
            <p className={`text-xs ${theme.subtitle}`}>Dúvidas dos técnicos, organizadas por O.S.</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => setAba('abertas')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
            aba === 'abertas' ? 'bg-purple-600 border-purple-600 text-white' : theme.tabOff
          }`}
        >
          <Inbox size={13} /> Abertas
        </button>
        <button
          onClick={() => setAba('arquivadas')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
            aba === 'arquivadas' ? 'bg-purple-600 border-purple-600 text-white' : theme.tabOff
          }`}
        >
          <Archive size={13} /> Arquivadas
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={24} className="animate-spin text-purple-500" />
        </div>
      ) : threads.length === 0 ? (
        <div className={`text-center py-16 text-sm ${theme.emptyText}`}>
          {aba === 'abertas' ? 'Nenhuma conversa de suporte em aberto.' : 'Nenhuma conversa arquivada ainda.'}
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map(t => (
            <button
              key={t.id}
              onClick={() => abrirConversa(t.id)}
              disabled={abrindoId === t.id}
              className={`w-full flex items-center gap-3 border rounded-2xl px-4 py-3 text-left transition-all disabled:opacity-60 ${theme.card}`}
            >
              <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0 relative">
                <Headphones size={15} className="text-purple-500" />
                {t.naoLidasGestor > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center">
                    {t.naoLidasGestor}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">{t.osCode}</span>
                  {t.osTitulo && <span className={`text-sm font-semibold truncate ${theme.osTitulo}`}>{t.osTitulo}</span>}
                </div>
                {t.clienteNome && (
                  <span className={`text-[11px] flex items-center gap-1 truncate mt-0.5 ${theme.subtitle}`}>
                    <Building2 size={10} /> {t.clienteNome}
                  </span>
                )}
                <p className={`text-xs truncate mt-1 ${theme.lastMsg}`}>
                  <span className={`font-semibold ${theme.lastMsgAutor}`}>{t.ultimaMsgAutorNome}:</span> {t.ultimaMsgTexto}
                </p>
              </div>
              <span className={`text-[10px] flex-shrink-0 ${theme.time}`}>{timeAgo(t.ultimaMsgEm)}</span>
              {abrindoId === t.id && <Loader2 size={14} className="animate-spin text-purple-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}

      {taskAberta && (
        <OSSuporteChat task={taskAberta} onClose={() => setTaskAberta(null)} variant={variant} />
      )}
    </div>
  );
}

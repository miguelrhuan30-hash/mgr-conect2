/**
 * FieldFeed — Feed de atividades mobile (dark theme) para gestores no campo.
 * Usado como aba dentro de FieldGestaoOS.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, increment, Timestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
  LogIn, LogOut, UtensilsCrossed, ClipboardList, Play,
  CheckCircle2, CheckSquare, Camera, Car, HelpCircle, MapPin,
  Send, MessageSquare, ChevronDown, ChevronUp, Loader2, Activity,
} from 'lucide-react';
import {
  ACTIVITY_FEED_COLLECTION, FeedAtividade, FeedResposta, ActivityTipo,
} from '../../services/activityFeedService';

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const timeAgo = (ts: Timestamp): string => {
  const diff = Date.now() - ts.toDate().getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const initials = (nome: string) =>
  nome.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* ─── Config de tipos ─────────────────────────────────────────────────── */
type TipoCfg = { label: string; icon: React.ReactNode; color: string; dot: string };
const TIPO_CFG: Record<ActivityTipo, TipoCfg> = {
  ponto_entrada:       { label: 'Entrada',         icon: <LogIn size={12} />,           color: 'text-emerald-400', dot: 'bg-emerald-500'  },
  ponto_saida:         { label: 'Saída',           icon: <LogOut size={12} />,          color: 'text-red-400',     dot: 'bg-red-500'      },
  ponto_almoco_inicio: { label: 'Almoço',          icon: <UtensilsCrossed size={12} />, color: 'text-orange-400',  dot: 'bg-orange-500'   },
  ponto_almoco_fim:    { label: 'Retorno',         icon: <UtensilsCrossed size={12} />, color: 'text-blue-400',    dot: 'bg-blue-500'     },
  os_aberta:           { label: 'O.S. Aberta',     icon: <ClipboardList size={12} />,   color: 'text-blue-400',    dot: 'bg-blue-500'     },
  os_iniciada:         { label: 'O.S. Iniciada',   icon: <Play size={12} />,            color: 'text-yellow-400',  dot: 'bg-yellow-500'   },
  os_concluida:        { label: 'O.S. Concluída',  icon: <CheckCircle2 size={12} />,    color: 'text-emerald-400', dot: 'bg-emerald-500'  },
  tarefa_concluida:    { label: 'Tarefa',          icon: <CheckSquare size={12} />,     color: 'text-teal-400',    dot: 'bg-teal-500'     },
  foto_tarefa:         { label: 'Foto',            icon: <Camera size={12} />,          color: 'text-purple-400',  dot: 'bg-purple-500'   },
  veiculo_aberto:      { label: 'Checklist',       icon: <Car size={12} />,             color: 'text-sky-400',     dot: 'bg-sky-500'      },
  veiculo_fechado:     { label: 'Encerramento',    icon: <Car size={12} />,             color: 'text-gray-400',    dot: 'bg-gray-500'     },
  duvida_os:           { label: 'Dúvida',          icon: <HelpCircle size={12} />,      color: 'text-orange-400',  dot: 'bg-orange-500'   },
};

type FiltroId = 'tudo' | 'ponto' | 'os' | 'duvidas';
const FILTROS: { id: FiltroId; label: string }[] = [
  { id: 'tudo',    label: 'Tudo'    },
  { id: 'ponto',   label: 'Ponto'   },
  { id: 'os',      label: 'O.S.'    },
  { id: 'duvidas', label: 'Dúvidas' },
];
const matchFiltro = (tipo: ActivityTipo, f: FiltroId) => {
  if (f === 'tudo')    return true;
  if (f === 'ponto')   return tipo.startsWith('ponto_');
  if (f === 'os')      return ['os_aberta','os_iniciada','os_concluida','tarefa_concluida','foto_tarefa'].includes(tipo);
  if (f === 'duvidas') return tipo === 'duvida_os';
  return true;
};

/* ─── Thread de dúvida (mobile) ──────────────────────────────────────── */
function DuvidaThread({ atividade }: { atividade: FeedAtividade }) {
  const { currentUser, userProfile } = useAuth();
  const [aberto, setAberto]       = useState(false);
  const [respostas, setRespostas] = useState<FeedResposta[]>([]);
  const [loading, setLoading]     = useState(false);
  const [texto, setTexto]         = useState('');
  const [sending, setSending]     = useState(false);
  const unsubRef                  = useRef<(() => void) | null>(null);

  const toggle = () => {
    if (aberto) {
      setAberto(false);
      unsubRef.current?.();
      unsubRef.current = null;
      return;
    }
    setAberto(true);
    setLoading(true);
    const q = query(
      collection(db, ACTIVITY_FEED_COLLECTION, atividade.id, 'respostas'),
      orderBy('criadoEm', 'asc'),
    );
    unsubRef.current = onSnapshot(q, snap => {
      setRespostas(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedResposta)));
      setLoading(false);
    }, () => setLoading(false));
  };

  useEffect(() => () => { unsubRef.current?.(); }, []);

  const enviar = async () => {
    if (!texto.trim() || !currentUser) return;
    setSending(true);
    try {
      const autorNome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || currentUser.email || 'Gestor';
      await addDoc(collection(db, ACTIVITY_FEED_COLLECTION, atividade.id, 'respostas'), {
        autorId:  currentUser.uid,
        autorNome,
        texto:    texto.trim(),
        criadoEm: Timestamp.now(),
      });
      await updateDoc(doc(db, ACTIVITY_FEED_COLLECTION, atividade.id), {
        respondida:     true,
        respostasCount: increment(1),
      });
      setTexto('');
    } catch (e) {
      console.error('[FieldFeed] enviar:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-2 border-t border-gray-700/60 pt-2">
      <button
        onClick={toggle}
        className={`flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${
          atividade.respondida ? 'text-emerald-400' : 'text-orange-400'
        }`}
      >
        <MessageSquare size={11} />
        {(atividade.respostasCount ?? 0) > 0
          ? `${atividade.respostasCount} resposta${(atividade.respostasCount ?? 0) > 1 ? 's' : ''}`
          : 'Responder'}
        {aberto ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
      </button>

      {aberto && (
        <div className="mt-2 space-y-2">
          {loading && <Loader2 size={14} className="animate-spin text-gray-500 mx-auto" />}
          {respostas.map(r => (
            <div key={r.id} className="flex gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-900 text-blue-300 flex items-center justify-center flex-shrink-0 text-[9px] font-black">
                {initials(r.autorNome)}
              </div>
              <div className="flex-1 bg-gray-700 rounded-xl px-2.5 py-1.5">
                <p className="text-[9px] font-bold text-blue-300">{r.autorNome}</p>
                <p className="text-xs text-gray-100 mt-0.5">{r.texto}</p>
              </div>
            </div>
          ))}
          {respostas.length === 0 && !loading && (
            <p className="text-[10px] text-gray-600 text-center">Sem respostas ainda</p>
          )}
          <div className="flex gap-2 mt-1">
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviar()}
              placeholder="Responder..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-orange-400"
            />
            <button
              onClick={enviar}
              disabled={sending || !texto.trim()}
              className="p-1.5 bg-orange-500 text-white rounded-xl disabled:opacity-50 active:bg-orange-600"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Card de atividade (mobile) ────────────────────────────────────── */
function FeedCard({ atividade }: { atividade: FeedAtividade }) {
  const cfg = TIPO_CFG[atividade.tipo] ?? TIPO_CFG['os_aberta'];
  const [imgExpanded, setImgExpanded] = useState(false);

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50">
      <div className="p-3.5">
        <div className="flex items-start gap-2.5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-gray-700 text-gray-300 flex items-center justify-center text-sm font-black">
              {atividade.autorFotoUrl
                ? <img src={atividade.autorFotoUrl} alt="" className="w-full h-full rounded-full object-cover" />
                : initials(atividade.autorNome)
              }
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${cfg.dot}`} />
          </div>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-white truncate">{atividade.autorNome}</p>
              <span className="text-[10px] text-gray-500 flex-shrink-0">{timeAgo(atividade.criadoEm)}</span>
            </div>
            <div className={`flex items-center gap-1 text-[10px] font-bold mt-0.5 ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </div>
            <p className="text-sm text-gray-200 mt-1 leading-snug">{atividade.titulo}</p>
            {atividade.descricao && (
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">{atividade.descricao}</p>
            )}
            {atividade.endereco && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                <MapPin size={9} /> {atividade.endereco}
              </div>
            )}
            {atividade.osId && (
              <div className="mt-1.5 flex items-center gap-1.5 bg-gray-750 border border-gray-700 rounded-lg px-2 py-1">
                <ClipboardList size={10} className="text-gray-500" />
                <span className="text-[10px] text-gray-400 truncate">
                  {atividade.osNumero} {atividade.osTitulo ? `· ${atividade.osTitulo}` : ''}
                  {atividade.clienteNome ? ` · ${atividade.clienteNome}` : ''}
                </span>
              </div>
            )}
            {atividade.fotoUrl && (
              <div className="mt-2">
                <img
                  src={atividade.fotoUrl}
                  alt="Evidência"
                  onClick={() => setImgExpanded(true)}
                  className="w-full rounded-xl object-cover max-h-48 border border-gray-700 cursor-zoom-in"
                />
              </div>
            )}
            {atividade.tipo === 'duvida_os' && (
              <div className={`mt-2 px-2.5 py-1.5 rounded-xl border ${atividade.respondida ? 'bg-emerald-900/30 border-emerald-800/50' : 'bg-orange-900/30 border-orange-800/50'}`}>
                <span className={`text-[10px] font-bold ${atividade.respondida ? 'text-emerald-400' : 'text-orange-400'}`}>
                  {atividade.respondida ? '✓ Respondida' : '⏳ Aguardando resposta'}
                </span>
              </div>
            )}
            {atividade.tipo === 'duvida_os' && <DuvidaThread atividade={atividade} />}
          </div>
        </div>
      </div>

      {imgExpanded && atividade.fotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setImgExpanded(false)}
        >
          <img src={atividade.fotoUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────────── */
export default function FieldFeed() {
  const [atividades, setAtividades] = useState<FeedAtividade[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filtro, setFiltro]         = useState<FiltroId>('tudo');

  useEffect(() => {
    const q = query(
      collection(db, ACTIVITY_FEED_COLLECTION),
      orderBy('criadoEm', 'desc'),
      limit(80),
    );
    const unsub = onSnapshot(q, snap => {
      setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedAtividade)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtradas       = atividades.filter(a => matchFiltro(a.tipo, filtro));
  const duvidaAberta    = atividades.filter(a => a.tipo === 'duvida_os' && !a.respondida).length;

  return (
    <div className="flex flex-col h-full bg-gray-950">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-orange-400" />
            <span className="text-sm font-black text-white">Feed em Tempo Real</span>
          </div>
          <div className="flex items-center gap-2">
            {duvidaAberta > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded-full text-[10px] font-bold text-orange-400">
                <HelpCircle size={9} /> {duvidaAberta} dúvida{duvidaAberta > 1 ? 's' : ''}
              </span>
            )}
            {loading && <Loader2 size={12} className="text-gray-500 animate-spin" />}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {FILTROS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filtro === id
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Loader2 size={24} className="animate-spin mb-2" />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-600">
            <Activity size={36} className="mb-3 opacity-30" />
            <p className="text-sm font-semibold text-gray-500">Nenhuma atividade</p>
            <p className="text-xs mt-1 text-gray-600">
              {filtro === 'tudo' ? 'As atividades aparecerão aqui' : 'Nada nesta categoria'}
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {filtradas.map(a => <FeedCard key={a.id} atividade={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

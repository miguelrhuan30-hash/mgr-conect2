/**
 * FeedGestao — Feed de atividades estilo rede social para gestores.
 * Mostra em tempo real: pontos, O.S., fotos de tarefas, veículos e dúvidas técnicas.
 * Dúvidas têm thread de respostas inline.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, increment, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity, LogIn, LogOut, UtensilsCrossed, ClipboardList, Play,
  CheckCircle2, CheckSquare, Camera, Car, HelpCircle, MapPin, Send,
  MessageSquare, ChevronDown, ChevronUp, Loader2, Filter, RefreshCcw,
} from 'lucide-react';
import {
  ACTIVITY_FEED_COLLECTION, FeedAtividade, FeedResposta, ActivityTipo,
} from '../services/activityFeedService';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const timeAgo = (ts: Timestamp): string => {
  const diff = Date.now() - ts.toDate().getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return ts.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
};

const initials = (nome: string) =>
  nome.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase();

/* ─── Config de tipos ────────────────────────────────────────────────────── */
const TIPO_CFG: Record<ActivityTipo, {
  label: string;
  icon: React.ReactNode;
  border: string;
  badge: string;
  avatarBg: string;
}> = {
  ponto_entrada:       { label: 'Ponto Entrada',   icon: <LogIn size={14} />,          border: 'border-l-emerald-500', badge: 'bg-emerald-100 text-emerald-700', avatarBg: 'bg-emerald-100 text-emerald-700' },
  ponto_saida:         { label: 'Ponto Saída',     icon: <LogOut size={14} />,         border: 'border-l-red-400',     badge: 'bg-red-100 text-red-700',         avatarBg: 'bg-red-100 text-red-700'         },
  ponto_almoco_inicio: { label: 'Almoço',          icon: <UtensilsCrossed size={14} />, border: 'border-l-orange-400',  badge: 'bg-orange-100 text-orange-700',   avatarBg: 'bg-orange-100 text-orange-700'   },
  ponto_almoco_fim:    { label: 'Retorno Almoço',  icon: <UtensilsCrossed size={14} />, border: 'border-l-blue-400',    badge: 'bg-blue-100 text-blue-700',       avatarBg: 'bg-blue-100 text-blue-700'       },
  os_aberta:           { label: 'O.S. Aberta',     icon: <ClipboardList size={14} />,  border: 'border-l-blue-500',    badge: 'bg-blue-100 text-blue-700',       avatarBg: 'bg-blue-100 text-blue-700'       },
  os_iniciada:         { label: 'O.S. Iniciada',   icon: <Play size={14} />,           border: 'border-l-yellow-400',  badge: 'bg-yellow-100 text-yellow-700',   avatarBg: 'bg-yellow-100 text-yellow-700'   },
  os_concluida:        { label: 'O.S. Concluída',  icon: <CheckCircle2 size={14} />,   border: 'border-l-emerald-600', badge: 'bg-emerald-100 text-emerald-700', avatarBg: 'bg-emerald-100 text-emerald-700' },
  tarefa_concluida:    { label: 'Tarefa',          icon: <CheckSquare size={14} />,    border: 'border-l-teal-400',    badge: 'bg-teal-100 text-teal-700',       avatarBg: 'bg-teal-100 text-teal-700'       },
  foto_tarefa:         { label: 'Foto Tarefa',     icon: <Camera size={14} />,         border: 'border-l-purple-400',  badge: 'bg-purple-100 text-purple-700',   avatarBg: 'bg-purple-100 text-purple-700'   },
  veiculo_aberto:      { label: 'Veículo',         icon: <Car size={14} />,            border: 'border-l-sky-400',     badge: 'bg-sky-100 text-sky-700',         avatarBg: 'bg-sky-100 text-sky-700'         },
  veiculo_fechado:     { label: 'Veículo',         icon: <Car size={14} />,            border: 'border-l-gray-400',    badge: 'bg-gray-100 text-gray-600',       avatarBg: 'bg-gray-100 text-gray-600'       },
  duvida_os:           { label: 'Dúvida Técnica',  icon: <HelpCircle size={14} />,     border: 'border-l-orange-500',  badge: 'bg-orange-100 text-orange-700',   avatarBg: 'bg-orange-100 text-orange-700'   },
};

type FiltroTipo = 'tudo' | 'ponto' | 'os' | 'fotos' | 'duvidas';

const FILTROS: { id: FiltroTipo; label: string }[] = [
  { id: 'tudo',    label: 'Tudo'    },
  { id: 'ponto',   label: 'Ponto'   },
  { id: 'os',      label: 'O.S.'    },
  { id: 'fotos',   label: 'Fotos'   },
  { id: 'duvidas', label: 'Dúvidas' },
];

const matchFiltro = (tipo: ActivityTipo, filtro: FiltroTipo): boolean => {
  if (filtro === 'tudo') return true;
  if (filtro === 'ponto')   return ['ponto_entrada','ponto_saida','ponto_almoco_inicio','ponto_almoco_fim'].includes(tipo);
  if (filtro === 'os')      return ['os_aberta','os_iniciada','os_concluida','tarefa_concluida'].includes(tipo);
  if (filtro === 'fotos')   return tipo === 'foto_tarefa';
  if (filtro === 'duvidas') return tipo === 'duvida_os';
  return true;
};

/* ─── Thread de dúvida ──────────────────────────────────────────────────── */
function DuvidaThread({ atividade }: { atividade: FeedAtividade }) {
  const { currentUser, userProfile } = useAuth();
  const [aberto, setAberto]         = useState(false);
  const [respostas, setRespostas]   = useState<FeedResposta[]>([]);
  const [loading, setLoading]       = useState(false);
  const [texto, setTexto]           = useState('');
  const [sending, setSending]       = useState(false);
  const unsubRef                    = useRef<(() => void) | null>(null);

  const toggleThread = () => {
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

  const enviarResposta = async () => {
    if (!texto.trim() || !currentUser) return;
    setSending(true);
    try {
      const autorNome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || currentUser.email || 'Gestor';
      await addDoc(collection(db, ACTIVITY_FEED_COLLECTION, atividade.id, 'respostas'), {
        autorId:   currentUser.uid,
        autorNome,
        texto:     texto.trim(),
        criadoEm:  Timestamp.now(),
      });
      await updateDoc(doc(db, ACTIVITY_FEED_COLLECTION, atividade.id), {
        respondida:    true,
        respostasCount: increment(1),
      });
      setTexto('');
    } catch (e) {
      console.error('[FeedGestao] enviarResposta:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <button
        onClick={toggleThread}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors"
      >
        <MessageSquare size={14} />
        {(atividade.respostasCount ?? 0) > 0
          ? `${atividade.respostasCount} resposta${(atividade.respostasCount ?? 0) > 1 ? 's' : ''}`
          : 'Responder dúvida'}
        {aberto ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          {loading && (
            <div className="flex justify-center py-2">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          )}
          {respostas.map(r => (
            <div key={r.id} className="flex gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0 text-[10px] font-black">
                {initials(r.autorNome)}
              </div>
              <div className="flex-1 bg-blue-50 rounded-xl px-3 py-2">
                <p className="text-[10px] font-bold text-blue-700">{r.autorNome}</p>
                <p className="text-sm text-gray-800 mt-0.5">{r.texto}</p>
                <p className="text-[9px] text-gray-400 mt-1">{timeAgo(r.criadoEm)}</p>
              </div>
            </div>
          ))}
          {respostas.length === 0 && !loading && (
            <p className="text-xs text-gray-400 text-center py-1">Nenhuma resposta ainda</p>
          )}

          {/* Input de resposta */}
          <div className="flex gap-2 mt-2">
            <input
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && enviarResposta()}
              placeholder="Responder dúvida..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-orange-400 bg-white"
            />
            <button
              onClick={enviarResposta}
              disabled={sending || !texto.trim()}
              className="p-2.5 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Card de atividade ─────────────────────────────────────────────────── */
function ActivityCard({ atividade }: { atividade: FeedAtividade }) {
  const cfg = TIPO_CFG[atividade.tipo] ?? TIPO_CFG['os_aberta'];
  const [imgExpanded, setImgExpanded] = useState(false);

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 border-l-4 ${cfg.border} overflow-hidden`}>
      <div className="p-4">
        {/* Header do card */}
        <div className="flex items-start gap-3 mb-2">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-black ${cfg.avatarBg}`}>
            {atividade.autorFotoUrl
              ? <img src={atividade.autorFotoUrl} alt="" className="w-full h-full rounded-full object-cover" />
              : initials(atividade.autorNome)
            }
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900">{atividade.autorNome}</p>
              <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(atividade.criadoEm)}</p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="pl-12">
          <p className="text-sm font-semibold text-gray-800">{atividade.titulo}</p>
          {atividade.descricao && (
            <p className="text-sm text-gray-600 mt-1 leading-relaxed">{atividade.descricao}</p>
          )}

          {/* Localização */}
          {atividade.endereco && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-400">
              <MapPin size={11} /> {atividade.endereco}
            </div>
          )}

          {/* Badge de O.S. */}
          {atividade.osId && (
            <div className="mt-2 inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
              <ClipboardList size={11} className="text-gray-500" />
              <span className="text-[11px] text-gray-600 font-semibold">
                {atividade.osNumero ?? 'O.S.'} {atividade.osTitulo ? `· ${atividade.osTitulo}` : ''}
              </span>
              {atividade.clienteNome && (
                <span className="text-[11px] text-gray-400">· {atividade.clienteNome}</span>
              )}
            </div>
          )}

          {/* Foto inline */}
          {atividade.fotoUrl && (
            <div className="mt-3">
              <img
                src={atividade.fotoUrl}
                alt="Evidência"
                onClick={() => setImgExpanded(true)}
                className="w-full max-w-sm rounded-xl object-cover cursor-zoom-in border border-gray-100 max-h-64"
              />
            </div>
          )}

          {/* Thread para dúvidas */}
          {atividade.tipo === 'duvida_os' && (
            <div className={`mt-2 px-3 py-2 rounded-xl border ${atividade.respondida ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <span className={`text-[10px] font-bold ${atividade.respondida ? 'text-green-600' : 'text-orange-600'}`}>
                {atividade.respondida ? '✓ Respondida' : '⏳ Aguardando resposta do gestor'}
              </span>
            </div>
          )}
          {atividade.tipo === 'duvida_os' && (
            <DuvidaThread atividade={atividade} />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {imgExpanded && atividade.fotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setImgExpanded(false)}
        >
          <img src={atividade.fotoUrl} alt="" className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────────────── */
export default function FeedGestao() {
  const [atividades, setAtividades] = useState<FeedAtividade[]>([]);
  const [loading, setLoading]       = useState(true);
  const [filtro, setFiltro]         = useState<FiltroTipo>('tudo');

  useEffect(() => {
    const q = query(
      collection(db, ACTIVITY_FEED_COLLECTION),
      orderBy('criadoEm', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(q, snap => {
      setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedAtividade)));
      setLoading(false);
    }, err => {
      console.error('[FeedGestao]', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtradas = atividades.filter(a => matchFiltro(a.tipo, filtro));

  const contadores: Record<FiltroTipo, number> = {
    tudo:    atividades.length,
    ponto:   atividades.filter(a => matchFiltro(a.tipo, 'ponto')).length,
    os:      atividades.filter(a => matchFiltro(a.tipo, 'os')).length,
    fotos:   atividades.filter(a => matchFiltro(a.tipo, 'fotos')).length,
    duvidas: atividades.filter(a => matchFiltro(a.tipo, 'duvidas')).length,
  };

  const duvidaAberta = atividades.filter(a => a.tipo === 'duvida_os' && !a.respondida).length;

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
              <Activity size={18} className="text-orange-600" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-900">Feed de Atividades</h1>
              <p className="text-xs text-gray-500">Monitoramento em tempo real das equipes de campo</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {duvidaAberta > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold border border-orange-200">
                <HelpCircle size={12} /> {duvidaAberta} dúvida{duvidaAberta > 1 ? 's' : ''} sem resposta
              </span>
            )}
            {loading && <Loader2 size={16} className="text-gray-400 animate-spin" />}
            {!loading && (
              <span className="text-xs text-gray-400 font-semibold">{filtradas.length} atividades</span>
            )}
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <Filter size={14} className="text-gray-400 flex-shrink-0" />
          {FILTROS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFiltro(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                filtro === id
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
              {contadores[id] > 0 && (
                <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
                  filtro === id ? 'bg-white/30 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {contadores[id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Loader2 size={32} className="animate-spin mb-3" />
            <p className="text-sm">Carregando atividades...</p>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Activity size={48} className="mb-4 opacity-20" />
            <p className="text-base font-semibold">Nenhuma atividade registrada</p>
            <p className="text-sm mt-1 text-gray-300">
              {filtro === 'tudo'
                ? 'As atividades da equipe aparecerão aqui em tempo real'
                : 'Nenhuma atividade nesta categoria ainda'}
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4">
            {filtradas.map(a => <ActivityCard key={a.id} atividade={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

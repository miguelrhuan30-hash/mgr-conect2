/**
 * FeedGestao — Feed de atividades estilo rede social para gestores.
 * Mostra em tempo real: pontos, O.S., fotos de tarefas, veículos e dúvidas técnicas.
 * Dúvidas têm thread de respostas inline.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, increment, Timestamp, getDocs, where, writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, OSObservacao, WorkflowStatus } from '../types';
import { gerarNumeroOS } from '../services/osService';
import { notificarVarios } from '../services/notificationService';
import OSViewModal from './OSViewModal';
import {
  Activity, LogIn, LogOut, UtensilsCrossed, ClipboardList, Play,
  CheckCircle2, CheckSquare, Camera, Car, HelpCircle, MapPin, Send,
  MessageSquare, ChevronDown, ChevronUp, Loader2, Filter, RefreshCcw,
  Video, Trash2, Plus as PlusIcon, Pencil, UserCog, Archive, Calendar,
  XCircle, MessageCircle, PlusCircle, ExternalLink,
} from 'lucide-react';
import {
  ACTIVITY_FEED_COLLECTION, FeedAtividade, FeedResposta, ActivityTipo, registrarAtividade,
} from '../services/activityFeedService';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
const timeAgo = (ts: Timestamp): string => {
  const d = ts.toDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  return `${hh}:${mm} · ${dd}/${mo}/${yy}`;
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
  duvida_os:            { label: 'Dúvida Técnica',  icon: <HelpCircle size={14} />,     border: 'border-l-orange-500',  badge: 'bg-orange-100 text-orange-700',   avatarBg: 'bg-orange-100 text-orange-700'   },
  foto_apagada:         { label: 'Foto Apagada',    icon: <Trash2 size={14} />,         border: 'border-l-red-500',     badge: 'bg-red-100 text-red-700',         avatarBg: 'bg-red-100 text-red-700'         },
  tarefa_criada_tecnico:{ label: 'Nova Tarefa',     icon: <PlusIcon size={14} />,       border: 'border-l-cyan-400',    badge: 'bg-cyan-100 text-cyan-700',       avatarBg: 'bg-cyan-100 text-cyan-700'       },
  video_gravado:        { label: 'Vídeo Gravado',   icon: <Video size={14} />,          border: 'border-l-violet-500',  badge: 'bg-violet-100 text-violet-700',   avatarBg: 'bg-violet-100 text-violet-700'   },
  os_editada:           { label: 'O.S. Editada',    icon: <Pencil size={14} />,         border: 'border-l-gray-400',    badge: 'bg-gray-100 text-gray-600',       avatarBg: 'bg-gray-100 text-gray-600'       },
  os_status_mudou:      { label: 'Status Alterado', icon: <RefreshCcw size={14} />,     border: 'border-l-yellow-500',  badge: 'bg-yellow-100 text-yellow-700',   avatarBg: 'bg-yellow-100 text-yellow-700'   },
  os_atribuida:         { label: 'O.S. Atribuída',  icon: <UserCog size={14} />,        border: 'border-l-purple-400',  badge: 'bg-purple-100 text-purple-700',   avatarBg: 'bg-purple-100 text-purple-700'   },
  os_arquivada:         { label: 'O.S. Arquivada',  icon: <Archive size={14} />,        border: 'border-l-gray-500',    badge: 'bg-gray-100 text-gray-500',       avatarBg: 'bg-gray-100 text-gray-500'       },
  os_excluida:          { label: 'O.S. Excluída',   icon: <Trash2 size={14} />,         border: 'border-l-red-600',     badge: 'bg-red-100 text-red-700',         avatarBg: 'bg-red-100 text-red-700'         },
  os_reagendada:        { label: 'O.S. Reagendada', icon: <Calendar size={14} />,       border: 'border-l-orange-400',  badge: 'bg-orange-100 text-orange-700',   avatarBg: 'bg-orange-100 text-orange-700'   },
  tarefa_nao_concluida: { label: 'Tarefa Não Concluída', icon: <XCircle size={14} />,   border: 'border-l-red-400',     badge: 'bg-red-100 text-red-700',         avatarBg: 'bg-red-100 text-red-700'         },
  observacao_gestor:    { label: 'Observação do Gestor', icon: <MessageCircle size={14} />, border: 'border-l-indigo-400', badge: 'bg-indigo-100 text-indigo-700', avatarBg: 'bg-indigo-100 text-indigo-700'   },
};

type FiltroTipo = 'tudo' | 'ponto' | 'os' | 'fotos' | 'duvidas' | 'videos';

const FILTROS: { id: FiltroTipo; label: string }[] = [
  { id: 'tudo',    label: 'Tudo'    },
  { id: 'ponto',   label: 'Ponto'   },
  { id: 'os',      label: 'O.S.'    },
  { id: 'fotos',   label: 'Fotos'   },
  { id: 'duvidas', label: 'Dúvidas' },
  { id: 'videos',  label: 'Vídeos'  },
];

const matchFiltro = (tipo: ActivityTipo, filtro: FiltroTipo): boolean => {
  if (filtro === 'tudo') return true;
  if (filtro === 'ponto')   return ['ponto_entrada','ponto_saida','ponto_almoco_inicio','ponto_almoco_fim'].includes(tipo);
  if (filtro === 'os')      return ['os_aberta','os_iniciada','os_concluida','os_editada','os_status_mudou','os_atribuida','os_arquivada','os_excluida','os_reagendada','tarefa_concluida','tarefa_criada_tecnico','tarefa_nao_concluida','observacao_gestor'].includes(tipo);
  if (filtro === 'fotos')   return ['foto_tarefa','video_gravado'].includes(tipo);
  if (filtro === 'duvidas') return tipo === 'duvida_os';
  if (filtro === 'videos')  return tipo === 'video_gravado';
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
      const autorNome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor';
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
  const [verOSId, setVerOSId] = useState<string | null>(null);
  const { currentUser, userProfile } = useAuth();

  const [criandoOS, setCriandoOS] = useState(false);
  const [osCriada, setOsCriada]   = useState(false);

  const [showObs, setShowObs]         = useState(false);
  const [textoObs, setTextoObs]       = useState('');
  const [enviandoObs, setEnviandoObs] = useState(false);
  const [obsEnviada, setObsEnviada]   = useState(false);

  const criarOSDaTarefa = async () => {
    if (!currentUser || !atividade.osId) return;
    if (!confirm(`Criar uma nova O.S. a partir da tarefa "${atividade.titulo.replace('Tarefa não concluída: ', '')}"?`)) return;
    setCriandoOS(true);
    try {
      const nome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor';
      const numeroOS = await gerarNumeroOS();
      const tarefaDescricao = atividade.titulo.replace('Tarefa não concluída: ', '');
      const ref = await addDoc(collection(db, CollectionName.TASKS), {
        numeroOS,
        title: `${numeroOS} — Continuação: ${tarefaDescricao}`,
        description: atividade.descricao || 'Tarefa retomada a partir de pendência não concluída.',
        status: 'pending',
        priority: 'medium',
        workflowStatus: WorkflowStatus.AGUARDANDO_APROVACAO,
        clientName: atividade.clienteNome || '',
        reagendamentoDe: atividade.osId,
        dadosCompletos: false,
        tarefasOS: [{
          id: `tarefa_${Date.now()}`,
          descricao: tarefaDescricao,
          status: 'pendente',
        }],
        createdAt: Timestamp.now(),
      });
      registrarAtividade({
        tipo: 'os_aberta',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `O.S. criada a partir de pendência: ${tarefaDescricao}`,
        osId: ref.id,
        osNumero: numeroOS,
        osTitulo: tarefaDescricao,
        clienteNome: atividade.clienteNome,
        meta: { origemOsId: atividade.osId, ambiente: 'web' },
      });
      setOsCriada(true);
    } catch {
      alert('Erro ao criar O.S. Tente novamente.');
    } finally {
      setCriandoOS(false);
    }
  };

  const enviarObservacao = async () => {
    if (!currentUser || !atividade.osId || !textoObs.trim()) return;
    setEnviandoObs(true);
    try {
      const nome = (userProfile as any)?.nomeCompleto || (userProfile as any)?.displayName || 'Gestor';
      const obs: OSObservacao = {
        id: `obs_${Date.now()}`,
        texto: textoObs.trim(),
        autorId: currentUser.uid,
        autorNome: nome,
        autorRole: userProfile?.role || 'gestor',
        criadaEm: Timestamp.now(),
        fotoUrl: atividade.fotoUrl || atividade.videoUrl || undefined,
      };
      await updateDoc(doc(db, CollectionName.TASKS, atividade.osId), {
        observacoes: arrayUnion(obs),
      });
      registrarAtividade({
        tipo: 'observacao_gestor',
        autorId: currentUser.uid,
        autorNome: nome,
        titulo: `Observação em: ${atividade.titulo}`,
        descricao: textoObs.trim(),
        osId: atividade.osId,
        osNumero: atividade.osNumero,
        osTitulo: atividade.osTitulo,
        clienteNome: atividade.clienteNome,
      });
      if (atividade.autorId) {
        // A observação também aparece mesclada na timeline do Suporte daquela
        // O.S. (OSSuporteChat) — leva o técnico pra lá, não mais pro feed,
        // já que agora ele pode responder direto no mesmo lugar.
        notificarVarios([atividade.autorId], {
          tipo: 'os_observacao_gestor',
          canal: 'os',
          titulo: '📋 Observação do gestor sobre sua evidência',
          corpo: textoObs.trim(),
          som: true,
          osId: atividade.osId,
          rota: '/campo/os',
        });
      }
      setObsEnviada(true);
      setShowObs(false);
      setTextoObs('');
    } catch {
      alert('Erro ao salvar observação.');
    } finally {
      setEnviandoObs(false);
    }
  };

  const temEvidencia = !!(atividade.fotoUrl || atividade.videoUrl) && !atividade.apagada;

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-l-4 overflow-hidden ${
      atividade.apagada ? 'border-red-200 border-l-red-500 bg-red-50' : `border-gray-100 ${cfg.border}`
    }`}>
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

          {/* Badge de O.S. — clicável, abre a visualização completa da O.S. */}
          {atividade.osId && (
            <button
              onClick={() => setVerOSId(atividade.osId!)}
              className="mt-2 inline-flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 hover:bg-gray-100 hover:border-gray-300 transition-colors"
            >
              <ClipboardList size={11} className="text-gray-500" />
              <span className="text-[11px] text-gray-600 font-semibold">
                {atividade.osNumero ?? 'O.S.'} {atividade.osTitulo ? `· ${atividade.osTitulo}` : ''}
              </span>
              {atividade.clienteNome && (
                <span className="text-[11px] text-gray-400">· {atividade.clienteNome}</span>
              )}
              <ExternalLink size={10} className="text-gray-400" />
            </button>
          )}

          {/* Vídeo inline */}
          {atividade.videoUrl && (
            <div className="mt-3">
              <video
                src={atividade.videoUrl}
                controls
                className="w-full max-w-sm rounded-xl border border-gray-200 max-h-64"
                preload="metadata"
              />
            </div>
          )}

          {/* Foto inline — vermelha se apagada */}
          {atividade.fotoUrl && (
            <div className="mt-3 relative inline-block">
              <img
                src={atividade.fotoUrl}
                alt="Evidência"
                onClick={() => !atividade.apagada && setImgExpanded(true)}
                className={`w-full max-w-sm rounded-xl object-cover border max-h-64 ${
                  atividade.apagada
                    ? 'border-red-300 opacity-60 grayscale cursor-default'
                    : 'border-gray-100 cursor-zoom-in'
                }`}
              />
              {atividade.apagada && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="bg-red-500 text-white text-[10px] font-black px-3 py-1 rounded-full border border-red-400 rotate-[-12deg]">
                    APAGADA DA O.S.
                  </span>
                </div>
              )}
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

          {/* Ação: criar O.S. a partir de tarefa não concluída */}
          {atividade.tipo === 'tarefa_nao_concluida' && (
            osCriada ? (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 size={13} /> Nova O.S. criada com sucesso
              </div>
            ) : (
              <button
                onClick={criarOSDaTarefa}
                disabled={criandoOS}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100 disabled:opacity-50"
              >
                <PlusCircle size={13} /> {criandoOS ? 'Criando O.S...' : 'Criar O.S. a partir desta tarefa'}
              </button>
            )
          )}

          {/* Ação: gestor adiciona observação sobre a evidência */}
          {temEvidencia && atividade.osId && (
            obsEnviada ? (
              <div className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
                <CheckCircle2 size={13} /> Observação enviada à equipe
              </div>
            ) : showObs ? (
              <div className="mt-2.5 space-y-2">
                <textarea
                  value={textoObs} onChange={e => setTextoObs(e.target.value)}
                  placeholder="Descreva o que foi entregue, ajuste necessário..."
                  rows={2}
                  className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <div className="flex gap-2">
                  <button onClick={enviarObservacao} disabled={enviandoObs || !textoObs.trim()}
                    className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg px-3 py-1.5 disabled:opacity-50">
                    <Send size={12} /> {enviandoObs ? 'Enviando...' : 'Enviar'}
                  </button>
                  <button onClick={() => { setShowObs(false); setTextoObs(''); }} className="text-xs text-gray-500 px-2">
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowObs(true)}
                className="mt-2.5 flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 hover:bg-indigo-100"
              >
                <MessageCircle size={13} /> Adicionar observação
              </button>
            )
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

      {/* Visualização completa da O.S., aberta ao clicar no badge */}
      {verOSId && (
        <OSViewModal taskId={verOSId} onClose={() => setVerOSId(null)} />
      )}
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────────────── */
const WINDOW = 7 * 24 * 60 * 60 * 1000; // 7 dias em ms

export default function FeedGestao() {
  const [atividades, setAtividades]     = useState<FeedAtividade[]>([]);
  const [syntheticAts, setSyntheticAts] = useState<FeedAtividade[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filtro, setFiltro]             = useState<FiltroTipo>('tudo');
  const [windowDays, setWindowDays]     = useState(7);
  const [hasMore, setHasMore]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);

  /* ── Migração única: corrige autorNome com email → nome real ─ */
  useEffect(() => {
    const KEY = 'feed_nome_migration_v2';
    if (localStorage.getItem(KEY)) return;
    Promise.all([
      getDocs(collection(db, ACTIVITY_FEED_COLLECTION)),
      getDocs(collection(db, 'users')),
    ]).then(([feedSnap, usersSnap]) => {
      const userMap = new Map<string, string>();
      usersSnap.docs.forEach(d => {
        const u = d.data();
        const nome = u.nomeCompleto || u.displayName;
        if (nome) userMap.set(d.id, nome);
      });
      const toFix = feedSnap.docs.filter(d => (d.data().autorNome || '').includes('@'));
      if (!toFix.length) { localStorage.setItem(KEY, 'done'); return; }
      // batch em chunks de 450
      const chunks: typeof toFix[] = [];
      for (let i = 0; i < toFix.length; i += 450) chunks.push(toFix.slice(i, i + 450));
      Promise.all(chunks.map(chunk => {
        const b = writeBatch(db);
        chunk.forEach(d => {
          const nome = userMap.get(d.data().autorId);
          if (nome) b.update(d.ref, { autorNome: nome });
        });
        return b.commit();
      })).then(() => localStorage.setItem(KEY, 'done')).catch(() => {});
    }).catch(() => {});
  }, []);

  /* ── Feed em tempo real (janela de windowDays dias) ─────── */
  useEffect(() => {
    const windowStart = Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const q = query(
      collection(db, ACTIVITY_FEED_COLLECTION),
      where('criadoEm', '>=', windowStart),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedAtividade)));
      setLoading(false);
    }, err => {
      console.error('[FeedGestao]', err);
      setLoading(false);
    });
    return unsub;
  }, [windowDays]);

  /* ── Histórico: tasks + time_entries (filtrados por janela no render) ─ */
  useEffect(() => {
    const PONTO_TIPO: Record<string, ActivityTipo> = {
      entry: 'ponto_entrada', exit: 'ponto_saida',
      lunch_start: 'ponto_almoco_inicio', lunch_end: 'ponto_almoco_fim',
    };
    const PONTO_TITULO: Record<string, string> = {
      entry: 'Ponto de entrada', exit: 'Ponto de saída',
      lunch_start: 'Almoço iniciado', lunch_end: 'Retorno do almoço',
    };

    Promise.all([
      getDocs(collection(db, CollectionName.TASKS)),
      getDocs(collection(db, CollectionName.TIME_ENTRIES)),
      getDocs(collection(db, CollectionName.USERS)),
    ]).then(([tasksSnap, pontoSnap, usersSnap]) => {
      // mapa uid → nome
      const userMap = new Map<string, string>();
      usersSnap.docs.forEach(d => {
        const u = d.data();
        const nome = u.nomeCompleto || u.displayName;
        if (nome) userMap.set(d.id, nome);
      });

      // tasks sintéticas
      const taskItems: FeedAtividade[] = tasksSnap.docs
        .filter(d => d.data().createdAt)
        .map(d => {
          const t = d.data();
          return {
            id: `hist-task-${d.id}`,
            tipo: 'os_aberta' as ActivityTipo,
            autorId: t.assignedTo || 'sistema',
            autorNome: userMap.get(t.assignedTo) || t.assigneeName || t.responsavelNome || t.criadoPorNome || 'Sistema',
            criadoEm: t.createdAt,
            titulo: `O.S. criada: ${t.title || t.numeroOS || d.id}`,
            osId: d.id, osNumero: t.numeroOS || t.code,
            osTitulo: t.title, clienteNome: t.clientName || t.clienteNome,
            meta: { ambiente: 'historico' },
          } as FeedAtividade;
        });

      // ponto sintético
      const pontoItems: FeedAtividade[] = pontoSnap.docs
        .filter(d => d.data().timestamp && PONTO_TIPO[d.data().type])
        .map(d => {
          const p = d.data();
          const tipo = PONTO_TIPO[p.type];
          const nome = userMap.get(p.userId) || 'Colaborador';
          return {
            id: `hist-ponto-${d.id}`,
            tipo,
            autorId: p.userId,
            autorNome: nome,
            criadoEm: p.timestamp,
            titulo: PONTO_TITULO[p.type] || 'Ponto registrado',
            descricao: p.locationName || undefined,
            meta: { ambiente: 'historico', source: p.source || 'app' },
          } as FeedAtividade;
        });

      setSyntheticAts([...taskItems, ...pontoItems]);
    }).catch(() => {});
  }, []);

  /* ── Carregar mais 7 dias ────────────────────────────────── */
  const carregarMais = async () => {
    setLoadingMore(true);
    const currentWindowStart = Timestamp.fromMillis(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    // Verifica se há itens no feed antes da janela atual
    const checkFeed = await getDocs(query(
      collection(db, ACTIVITY_FEED_COLLECTION),
      where('criadoEm', '<', currentWindowStart),
      limit(1),
    )).catch(() => null);
    // Verifica se há tasks sintéticas antes da janela atual
    const windowStartMs = currentWindowStart.toMillis();
    const olderSynthetic = syntheticAts.some(s => (s.criadoEm?.toMillis?.() ?? 0) < windowStartMs);

    if ((checkFeed && !checkFeed.empty) || olderSynthetic) {
      setWindowDays(d => d + 7);
    } else {
      setHasMore(false);
    }
    setLoadingMore(false);
  };

  /* ── Merge: janela atual (real + sintético, sem duplicatas) ─ */
  const windowStartMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  // IDs reais de os_aberta (dedup por osId)
  const osAbertasReais = new Set(
    atividades.filter(a => a.tipo === 'os_aberta' && a.osId).map(a => a.osId!)
  );
  // Buckets de 5 min para dedup de ponto (autorId-tipo-bucket)
  const pontoBuckets = new Set(
    atividades
      .filter(a => a.tipo.startsWith('ponto_'))
      .map(a => `${a.autorId}-${a.tipo}-${Math.floor((a.criadoEm?.toMillis?.() ?? 0) / 300_000)}`)
  );
  const todasAtividades = [
    ...atividades,
    ...syntheticAts.filter(s => {
      if ((s.criadoEm?.toMillis?.() ?? 0) < windowStartMs) return false;
      if (s.tipo === 'os_aberta') return !osAbertasReais.has(s.osId!);
      if (s.tipo.startsWith('ponto_')) {
        const bucket = Math.floor((s.criadoEm?.toMillis?.() ?? 0) / 300_000);
        return !pontoBuckets.has(`${s.autorId}-${s.tipo}-${bucket}`);
      }
      return true;
    }),
  ].sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));

  const filtradas = todasAtividades.filter(a => matchFiltro(a.tipo, filtro));

  const contadores: Record<FiltroTipo, number> = {
    tudo:    todasAtividades.length,
    ponto:   todasAtividades.filter(a => matchFiltro(a.tipo, 'ponto')).length,
    os:      todasAtividades.filter(a => matchFiltro(a.tipo, 'os')).length,
    fotos:   todasAtividades.filter(a => matchFiltro(a.tipo, 'fotos')).length,
    duvidas: todasAtividades.filter(a => matchFiltro(a.tipo, 'duvidas')).length,
    videos:  todasAtividades.filter(a => matchFiltro(a.tipo, 'videos')).length,
  };

  const duvidaAberta = todasAtividades.filter(a => a.tipo === 'duvida_os' && !a.respondida).length;
  const periodoLabel = windowDays <= 7 ? 'últimos 7 dias' : `últimos ${windowDays} dias`;

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

            {/* Carregar anteriores */}
            <div className="flex flex-col items-center gap-2 py-6">
              {hasMore ? (
                <button
                  onClick={carregarMais}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 shadow-sm disabled:opacity-50 transition-all"
                >
                  {loadingMore
                    ? <><Loader2 size={14} className="animate-spin" /> Carregando...</>
                    : <>↓ Carregar +7 dias anteriores</>
                  }
                </button>
              ) : (
                <p className="text-xs text-gray-400 font-medium">
                  ✓ Início do histórico — todos os registros carregados
                </p>
              )}
              <p className="text-[11px] text-gray-400">Exibindo: {periodoLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

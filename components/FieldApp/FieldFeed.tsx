/**
 * FieldFeed — Feed de atividades mobile (dark theme) para gestores no campo.
 * Usado como aba dentro de FieldGestaoOS.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, limit, onSnapshot,
  addDoc, updateDoc, doc, Timestamp, getDocs, getDoc, where, writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, OSObservacao, WorkflowStatus, Task, OSSuporteThread } from '../../types';
import { gerarNumeroOS } from '../../services/osService';
import { notificarVarios } from '../../services/notificationService';
import FieldGestaoOSDetail from './FieldGestaoOSDetail';
import OSSuporteChat from '../OSSuporteChat';
import { OSField } from './FieldOS';
import {
  LogIn, LogOut, UtensilsCrossed, ClipboardList, Play,
  CheckCircle2, CheckSquare, Camera, Car, HelpCircle, MapPin,
  Send, Headphones, Loader2, Activity,
  Video, Trash2, Plus as PlusIcon, Pencil, UserCog, Archive, Calendar,
  XCircle, MessageCircle, ExternalLink,
} from 'lucide-react';
import {
  ACTIVITY_FEED_COLLECTION, FeedAtividade, ActivityTipo, registrarAtividade,
} from '../../services/activityFeedService';

/* ─── Helpers ─────────────────────────────────────────────────────────── */
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
  almoco_pedido:       { label: 'Marmita',         icon: <UtensilsCrossed size={12} />, color: 'text-amber-400',   dot: 'bg-amber-500'    },
  os_pedido_reagendamento: { label: 'Pedido Reagend.', icon: <Calendar size={12} />, color: 'text-red-400', dot: 'bg-red-500' },
  duvida_os:             { label: 'Dúvida',          icon: <HelpCircle size={12} />,      color: 'text-orange-400',  dot: 'bg-orange-500'   },
  foto_apagada:          { label: 'Foto Apagada',   icon: <Trash2 size={12} />,          color: 'text-red-400',     dot: 'bg-red-500'      },
  tarefa_criada_tecnico: { label: 'Nova Tarefa',    icon: <PlusIcon size={12} />,        color: 'text-cyan-400',    dot: 'bg-cyan-500'     },
  video_gravado:         { label: 'Vídeo',          icon: <Video size={12} />,           color: 'text-violet-400',  dot: 'bg-violet-500'   },
  os_editada:            { label: 'O.S. Editada',   icon: <Pencil size={12} />,          color: 'text-gray-400',    dot: 'bg-gray-500'     },
  os_status_mudou:       { label: 'Status',         icon: <Activity size={12} />,        color: 'text-yellow-400',  dot: 'bg-yellow-500'   },
  os_atribuida:          { label: 'Atribuição',     icon: <UserCog size={12} />,         color: 'text-purple-400',  dot: 'bg-purple-500'   },
  os_arquivada:          { label: 'Arquivada',      icon: <Archive size={12} />,         color: 'text-gray-500',    dot: 'bg-gray-600'     },
  os_excluida:           { label: 'Excluída',       icon: <Trash2 size={12} />,          color: 'text-red-500',     dot: 'bg-red-600'      },
  os_reagendada:         { label: 'Reagendada',     icon: <Calendar size={12} />,        color: 'text-orange-400',  dot: 'bg-orange-500'   },
  tarefa_nao_concluida:  { label: 'Não Concluída',  icon: <XCircle size={12} />,         color: 'text-red-400',     dot: 'bg-red-500'      },
  observacao_gestor:     { label: 'Observação',     icon: <MessageCircle size={12} />,   color: 'text-indigo-400',  dot: 'bg-indigo-500'   },
};

type FiltroId = 'tudo' | 'ponto' | 'os' | 'duvidas' | 'videos';
const FILTROS: { id: FiltroId; label: string }[] = [
  { id: 'tudo',    label: 'Tudo'    },
  { id: 'ponto',   label: 'Ponto'   },
  { id: 'os',      label: 'O.S.'    },
  { id: 'duvidas', label: 'Dúvidas' },
  { id: 'videos',  label: 'Vídeos'  },
];
const matchFiltro = (tipo: ActivityTipo, f: FiltroId) => {
  if (f === 'tudo')    return true;
  if (f === 'ponto')   return tipo.startsWith('ponto_');
  if (f === 'os')      return ['os_aberta','os_iniciada','os_concluida','os_editada','os_status_mudou','os_atribuida','os_arquivada','os_excluida','os_reagendada','tarefa_concluida','foto_tarefa','tarefa_criada_tecnico','tarefa_nao_concluida','observacao_gestor'].includes(tipo);
  if (f === 'duvidas') return tipo === 'duvida_os';
  if (f === 'videos')  return tipo === 'video_gravado';
  return true;
};

/* ─── Status ao vivo de uma dúvida (mobile) — reflete os_suporte_threads ── */
function DuvidaStatusBadge({ osId }: { osId: string }) {
  const [thread, setThread] = useState<OSSuporteThread | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, CollectionName.OS_SUPORTE_THREADS, osId), snap => {
      setThread(snap.exists() ? ({ id: snap.id, ...snap.data() } as OSSuporteThread) : null);
    }, () => {});
    return unsub;
  }, [osId]);

  if (!thread) return null;
  const pendente = thread.naoLidasGestor > 0;

  return (
    <span className={`text-[10px] font-bold ${pendente ? 'text-orange-400' : 'text-emerald-400'}`}>
      {pendente ? `⏳ Aguardando resposta (${thread.naoLidasGestor})` : '✓ Visto pelo gestor'}
    </span>
  );
}

/* ─── Card de atividade (mobile) ────────────────────────────────────── */
function FeedCard({ atividade }: { atividade: FeedAtividade }) {
  const cfg = TIPO_CFG[atividade.tipo] ?? TIPO_CFG['os_aberta'];
  const [imgExpanded, setImgExpanded] = useState(false);
  const { currentUser, userProfile } = useAuth();

  const [verOS, setVerOS]         = useState<OSField | null>(null);
  const [carregandoOS, setCarregandoOS] = useState(false);

  const abrirOS = async () => {
    if (!atividade.osId || carregandoOS) return;
    setCarregandoOS(true);
    try {
      const snap = await getDoc(doc(db, CollectionName.TASKS, atividade.osId));
      if (snap.exists()) setVerOS({ id: snap.id, ...snap.data() } as OSField);
      else alert('Esta O.S. não foi encontrada (pode ter sido excluída).');
    } catch {
      alert('Erro ao abrir a O.S.');
    } finally {
      setCarregandoOS(false);
    }
  };

  const [criandoOS, setCriandoOS] = useState(false);
  const [osCriada, setOsCriada]   = useState(false);

  const [showObs, setShowObs]         = useState(false);
  const [textoObs, setTextoObs]       = useState('');
  const [enviandoObs, setEnviandoObs] = useState(false);
  const [obsEnviada, setObsEnviada]   = useState(false);

  const [taskSuporte, setTaskSuporte] = useState<Task | null>(null);
  const [abrindoSuporte, setAbrindoSuporte] = useState(false);

  const abrirSuporte = async () => {
    if (!atividade.osId || abrindoSuporte) return;
    setAbrindoSuporte(true);
    try {
      const snap = await getDoc(doc(db, CollectionName.TASKS, atividade.osId));
      if (snap.exists()) setTaskSuporte({ id: snap.id, ...snap.data() } as Task);
    } finally {
      setAbrindoSuporte(false);
    }
  };

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
        meta: { origemOsId: atividade.osId, ambiente: 'app_gestor' },
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
        notificarVarios([atividade.autorId], {
          tipo: 'os_observacao_gestor',
          canal: 'os',
          titulo: '📋 Observação do gestor sobre sua evidência',
          corpo: textoObs.trim(),
          som: true,
          osId: atividade.osId,
          rota: '/campo/feed',
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
    <div className={`rounded-2xl overflow-hidden border ${atividade.apagada ? 'bg-red-950/40 border-red-800/40' : 'bg-gray-800 border-gray-700/50'}`}>
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
              <button
                onClick={abrirOS}
                disabled={carregandoOS}
                className="mt-1.5 flex items-center gap-1.5 bg-gray-750 border border-gray-700 rounded-lg px-2 py-1 active:bg-gray-700 disabled:opacity-60"
              >
                <ClipboardList size={10} className="text-gray-500" />
                <span className="text-[10px] text-gray-400 truncate">
                  {atividade.osNumero} {atividade.osTitulo ? `· ${atividade.osTitulo}` : ''}
                  {atividade.clienteNome ? ` · ${atividade.clienteNome}` : ''}
                </span>
                {carregandoOS ? <Loader2 size={9} className="animate-spin text-gray-500" /> : <ExternalLink size={9} className="text-gray-500" />}
              </button>
            )}
            {atividade.videoUrl && (
              <div className="mt-2">
                <video
                  src={atividade.videoUrl}
                  controls
                  className="w-full rounded-xl border border-gray-700 max-h-48"
                  preload="metadata"
                />
              </div>
            )}
            {atividade.fotoUrl && (
              <div className="mt-2 relative">
                <img
                  src={atividade.fotoUrl}
                  alt="Evidência"
                  onClick={() => !atividade.apagada && setImgExpanded(true)}
                  className={`w-full rounded-xl object-cover max-h-48 border ${
                    atividade.apagada
                      ? 'border-red-800/50 opacity-50 grayscale cursor-default'
                      : 'border-gray-700 cursor-zoom-in'
                  }`}
                />
                {atividade.apagada && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="bg-red-500 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full rotate-[-12deg]">
                      APAGADA DA O.S.
                    </span>
                  </div>
                )}
              </div>
            )}
            {atividade.tipo === 'duvida_os' && atividade.osId && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <DuvidaStatusBadge osId={atividade.osId} />
                <button
                  onClick={abrirSuporte}
                  disabled={abrindoSuporte}
                  className="flex items-center gap-1.5 text-xs font-bold text-purple-300 bg-purple-900/30 border border-purple-800/50 rounded-lg px-2.5 py-1.5 active:bg-purple-900/50 disabled:opacity-50"
                >
                  {abrindoSuporte ? <Loader2 size={12} className="animate-spin" /> : <Headphones size={12} />}
                  Responder no Suporte
                </button>
              </div>
            )}

            {/* Ação: criar O.S. a partir de tarefa não concluída */}
            {atividade.tipo === 'tarefa_nao_concluida' && (
              osCriada ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-900/30 border border-emerald-800/50 rounded-lg px-2.5 py-1.5">
                  <CheckCircle2 size={12} /> Nova O.S. criada
                </div>
              ) : (
                <button
                  onClick={criarOSDaTarefa}
                  disabled={criandoOS}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-red-400 bg-red-900/30 border border-red-800/50 rounded-lg px-2.5 py-1.5 active:bg-red-900/50 disabled:opacity-50"
                >
                  <PlusIcon size={12} /> {criandoOS ? 'Criando...' : 'Criar O.S. desta tarefa'}
                </button>
              )
            )}

            {/* Ação: gestor adiciona observação sobre a evidência */}
            {(atividade.fotoUrl || atividade.videoUrl) && !atividade.apagada && atividade.osId && (
              obsEnviada ? (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-400 bg-indigo-900/30 border border-indigo-800/50 rounded-lg px-2.5 py-1.5">
                  <CheckCircle2 size={12} /> Observação enviada
                </div>
              ) : showObs ? (
                <div className="mt-2 space-y-2">
                  <textarea
                    value={textoObs} onChange={e => setTextoObs(e.target.value)}
                    placeholder="Descreva o que foi entregue, ajuste necessário..."
                    rows={2}
                    spellCheck autoCorrect="on" autoCapitalize="sentences"
                    className="w-full text-xs bg-gray-900 border border-gray-700 rounded-lg px-2.5 py-2 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button onClick={enviarObservacao} disabled={enviandoObs || !textoObs.trim()}
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg px-3 py-1.5 disabled:opacity-50">
                      <Send size={11} /> {enviandoObs ? 'Enviando...' : 'Enviar'}
                    </button>
                    <button onClick={() => { setShowObs(false); setTextoObs(''); }} className="text-xs text-gray-500 px-2">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowObs(true)}
                  className="mt-2 flex items-center gap-1.5 text-xs font-bold text-indigo-400 bg-indigo-900/30 border border-indigo-800/50 rounded-lg px-2.5 py-1.5 active:bg-indigo-900/50"
                >
                  <MessageCircle size={12} /> Adicionar observação
                </button>
              )
            )}
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

      {/* Painel de gestão completo da O.S., aberto ao tocar no badge */}
      {verOS && (
        <FieldGestaoOSDetail
          os={verOS}
          onClose={() => setVerOS(null)}
          onUpdate={updated => setVerOS(updated)}
          onDelete={() => setVerOS(null)}
        />
      )}

      {/* Suporte da O.S., aberto ao tocar em "Responder no Suporte" */}
      {taskSuporte && (
        <OSSuporteChat task={taskSuporte} onClose={() => setTaskSuporte(null)} variant="dark" />
      )}
    </div>
  );
}

/* ─── Componente principal ──────────────────────────────────────────── */
export default function FieldFeed() {
  const [atividades, setAtividades]     = useState<FeedAtividade[]>([]);
  const [syntheticAts, setSyntheticAts] = useState<FeedAtividade[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filtro, setFiltro]             = useState<FiltroId>('tudo');
  const [windowDays, setWindowDays]     = useState(7);
  const [hasMore, setHasMore]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [duvidaAberta, setDuvidaAberta] = useState(0);

  /* ── Contagem de dúvidas de suporte aguardando resposta (live) ── */
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_THREADS),
      where('naoLidasGestor', '>', 0),
      where('archived', '==', false),
    );
    return onSnapshot(q, snap => setDuvidaAberta(snap.size), () => {});
  }, []);

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
    }, () => setLoading(false));
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
      const userMap = new Map<string, string>();
      usersSnap.docs.forEach(d => {
        const u = d.data();
        const nome = u.nomeCompleto || u.displayName;
        if (nome) userMap.set(d.id, nome);
      });

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
    const checkFeed = await getDocs(query(
      collection(db, ACTIVITY_FEED_COLLECTION),
      where('criadoEm', '<', currentWindowStart),
      limit(1),
    )).catch(() => null);
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
  const osAbertasReais = new Set(
    atividades.filter(a => a.tipo === 'os_aberta' && a.osId).map(a => a.osId!)
  );
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

  const filtradas    = todasAtividades.filter(a => matchFiltro(a.tipo, filtro));
  const periodoLabel = windowDays <= 7 ? 'últimos 7 dias' : `últimos ${windowDays} dias`;

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
          <div className="space-y-3 pb-4">
            {filtradas.map(a => <FeedCard key={a.id} atividade={a} />)}

            {/* Carregar anteriores */}
            <div className="flex flex-col items-center gap-2 py-5">
              {hasMore ? (
                <button
                  onClick={carregarMais}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-800 border border-gray-700 rounded-full text-xs font-bold text-gray-300 active:bg-gray-700 disabled:opacity-50"
                >
                  {loadingMore
                    ? <><Loader2 size={13} className="animate-spin" /> Carregando...</>
                    : <>↓ Carregar +7 dias anteriores</>
                  }
                </button>
              ) : (
                <p className="text-[11px] text-gray-600 font-medium">
                  ✓ Início do histórico
                </p>
              )}
              <p className="text-[10px] text-gray-700">{periodoLabel}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

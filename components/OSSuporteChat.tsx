/**
 * components/OSSuporteChat.tsx — Suporte da O.S. (técnico ↔ gestor, direto)
 *
 * Canal de suporte estruturado por O.S.: o técnico escolhe explicitamente se
 * a dúvida é sobre uma tarefa específica ou geral da O.S., manda a mensagem
 * (texto/foto/vídeo/áudio) e ela vai direto para a fila do gestor — sem bot
 * de triagem no meio. Observações que o gestor adiciona às evidências no feed
 * também aparecem nessa mesma linha do tempo, para o técnico ver e responder.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, setDoc, doc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, OSSuporteMsg, OSObservacao, Task } from '../types';
import { registrarAtividade } from '../services/activityFeedService';
import { notificarVarios } from '../services/notificationService';
import {
  Send, Mic, MicOff, Camera, User, Briefcase, Loader2,
  X, CheckCircle2, Headphones, ClipboardList, BookmarkPlus, MessageCircleQuestion,
} from 'lucide-react';

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  technician: { label: 'Técnico',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <User      size={10} /> },
  tecnico:    { label: 'Técnico',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <User      size={10} /> },
  employee:   { label: 'Técnico',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <User      size={10} /> },
  manager:    { label: 'Gestor',   cls: 'bg-green-100 text-green-700 border-green-200', icon: <Briefcase size={10} /> },
  gestor:     { label: 'Gestor',   cls: 'bg-green-100 text-green-700 border-green-200', icon: <Briefcase size={10} /> },
  admin:      { label: 'Gestor',   cls: 'bg-green-100 text-green-700 border-green-200', icon: <Briefcase size={10} /> },
  ia:         { label: '🤖 IA',    cls: 'bg-purple-100 text-purple-700 border-purple-200', icon: <span>🤖</span> },
};
const TECH_ROLES = ['technician', 'tecnico', 'employee'];

const getRoleBadge = (role: string) =>
  ROLE_BADGE[role] ?? { label: role, cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: <User size={10} /> };

const isVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

// ── Mensagem bubble ───────────────────────────────────────────────────────────
const MsgBubble: React.FC<{
  msg: OSSuporteMsg; isOwn: boolean; isGestor: boolean; isDark: boolean;
  perguntaAnterior?: string; onSalvarKB?: (msg: OSSuporteMsg, pergunta: string) => void;
  kbSalva?: boolean;
}> = ({ msg, isOwn, isGestor, isDark, perguntaAnterior, onSalvarKB, kbSalva }) => {
  const badge = getRoleBadge(msg.autorRole);
  const ts = msg.criadaEm instanceof Timestamp
    ? msg.criadaEm.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${isOwn ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
        {msg.autorNome.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[78%] space-y-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
          <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{msg.autorNome} · {ts}</span>
        </div>
        {msg.tarefaDescricao && (
          <span className={`text-[11px] font-semibold flex items-center gap-1 leading-snug ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
            <ClipboardList size={11} className="flex-shrink-0" /> {msg.tarefaDescricao}
          </span>
        )}
        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm
          ${isOwn ? 'bg-purple-600 text-white' : isDark ? 'bg-gray-800 border border-gray-700 text-gray-100' : 'bg-white border border-gray-200 text-gray-800'}`}>
          {msg.texto}
        </div>

        {/* Evidência: fotos/vídeos */}
        {msg.fotosURLs && msg.fotosURLs.length > 0 && (
          <div className="grid grid-cols-2 gap-1.5">
            {msg.fotosURLs.map((url, i) => (
              isVideoUrl(url)
                ? <video key={i} src={url} controls className="w-28 h-28 rounded-lg object-cover border border-gray-200" />
                : <img key={i} src={url} alt="Evidência" className="w-28 h-28 rounded-lg object-cover border border-gray-200" />
            ))}
          </div>
        )}
        {/* Evidência: áudio */}
        {msg.audioURL && (
          <audio src={msg.audioURL} controls className="h-9 max-w-[240px]" />
        )}

        {/* Gestor pode salvar a resposta como solução na Base de Conhecimento */}
        {isGestor && !isOwn && onSalvarKB && (
          kbSalva ? (
            <span className="text-[9px] text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={10} /> Salva na base de conhecimento
            </span>
          ) : (
            <button
              onClick={() => onSalvarKB(msg, perguntaAnterior || '')}
              className="text-[9px] text-gray-400 hover:text-purple-600 flex items-center gap-1"
            >
              <BookmarkPlus size={10} /> Salvar como solução
            </button>
          )
        )}
      </div>
    </div>
  );
};

// ── Bolha de observação de evidência (mesclada na timeline, não é OSSuporteMsg) ──
const ObservacaoBubble: React.FC<{ obs: OSObservacao; isDark: boolean }> = ({ obs, isDark }) => {
  const ts = obs.criadaEm instanceof Timestamp
    ? obs.criadaEm.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-amber-700 bg-amber-100">
        <Camera size={12} />
      </div>
      <div className="max-w-[78%] space-y-1 flex flex-col items-start">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200">
            Observação sobre evidência
          </span>
          <span className={`text-[9px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{obs.autorNome} · {ts}</span>
        </div>
        <div className="rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm bg-amber-50 border border-amber-200 text-amber-900">
          {obs.texto}
        </div>
        {obs.fotoUrl && (
          isVideoUrl(obs.fotoUrl)
            ? <video src={obs.fotoUrl} controls className="w-28 h-28 rounded-lg object-cover border border-amber-200" />
            : <img src={obs.fotoUrl} alt="Evidência comentada" className="w-28 h-28 rounded-lg object-cover border border-amber-200" />
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
interface OSSuporteChatProps {
  task: Task;
  onClose: () => void;
  variant?: 'light' | 'dark';
}

type TimelineItem =
  | { kind: 'msg'; ts: number; data: OSSuporteMsg }
  | { kind: 'obs'; ts: number; data: OSObservacao };

const OSSuporteChat: React.FC<OSSuporteChatProps> = ({ task, onClose, variant = 'light' }) => {
  const { currentUser, userProfile } = useAuth();
  const osId = task.id;
  const isDark = variant === 'dark';

  const [msgs, setMsgs] = useState<OSSuporteMsg[]>([]);
  const [msgsCarregadas, setMsgsCarregadas] = useState(false);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [gateStep, setGateStep] = useState<'escolha' | 'chat'>('chat');
  const [tarefaSelId, setTarefaSelId] = useState('');
  const [kbSalvas, setKbSalvas] = useState<Set<string>>(new Set());
  const [erroEnvio, setErroEnvio] = useState('');

  const tarefasOS = task.tarefasOS || [];
  const tarefaSelDescricao = tarefasOS.find(t => t.id === tarefaSelId)?.descricao;

  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fotoRef   = useRef<HTMLInputElement>(null);
  const gestoresRef = useRef<string[] | null>(null);

  // Mesmo critério usado em FieldGestaoOS.tsx pra liberar a aba "Gestão de
  // O.S." — quem já vê o Suporte pela lista do gestor tem que abrir como
  // gestor aqui também, independente do texto exato do role.
  const isGestor = ['admin', 'gestor', 'manager', 'developer'].includes(userProfile?.role || '')
    || !!(userProfile as any)?.permissions?.canManageProjects
    || !!((userProfile as any)?.permissions?.canEditTasks && (userProfile as any)?.permissions?.canDeleteTasks);

  // ── Subscribe to messages ─────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_MSGS),
      where('osId', '==', osId),
      orderBy('criadaEm', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as OSSuporteMsg));
      setMsgs(list);
      setMsgsCarregadas(true);
      // Mark other side's msgs as read
      if (!isGestor) {
        snap.docs.filter(d => !d.data().leitoPorTecnico && !TECH_ROLES.includes(d.data().autorRole))
          .forEach(d => updateDoc(d.ref, { leitoPorTecnico: true }).catch(() => {}));
      } else {
        snap.docs.filter(d => !d.data().leitoPorGestor && TECH_ROLES.includes(d.data().autorRole))
          .forEach(d => updateDoc(d.ref, { leitoPorGestor: true }).catch(() => {}));
      }
    });
    return unsub;
  }, [osId, isGestor]);

  // ── Gate: técnico escolhe tarefa específica ou dúvida geral ANTES de poder
  // compor mensagem — toda vez que abre o Suporte, não só na primeira vez.
  // Só pula direto pro chat se a O.S. não tiver tarefas pra escolher.
  // Corrige de volta pra 'chat' explicitamente quando isGestor vira true —
  // evita ficar preso em 'escolha' se o perfil do usuário carregar com
  // atraso (isGestor passa por false antes de resolver o valor real). ────
  useEffect(() => {
    if (isGestor) { setGateStep('chat'); return; }
    setGateStep(tarefasOS.length > 0 ? 'escolha' : 'chat');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGestor]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  // ── Timeline mesclada: mensagens reais + observações do gestor sobre evidência ──
  const timeline: TimelineItem[] = useMemo(() => {
    const msgItems: TimelineItem[] = msgs.map(m => ({
      kind: 'msg', ts: m.criadaEm instanceof Timestamp ? m.criadaEm.toMillis() : 0, data: m,
    }));
    const obsItems: TimelineItem[] = (task.observacoes || [])
      .filter(o => !TECH_ROLES.includes(o.autorRole)) // só observações feitas pelo gestor
      .map(o => ({
        kind: 'obs', ts: o.criadaEm instanceof Timestamp ? o.criadaEm.toMillis() : 0, data: o,
      }));
    return [...msgItems, ...obsItems].sort((a, b) => a.ts - b.ts);
  }, [msgs, task.observacoes]);

  // ── Carrega lista de gestores (cache em ref, 1x por sessão do modal) ──────
  const carregarGestores = useCallback(async (): Promise<string[]> => {
    if (gestoresRef.current) return gestoresRef.current;
    const snap = await getDocs(collection(db, CollectionName.USERS));
    const ids = snap.docs
      .filter(d => {
        const u: any = d.data();
        return ['admin', 'gestor', 'manager', 'developer'].includes(u.role || '') || u.permissions?.canViewFeed === true;
      })
      .map(d => d.id);
    gestoresRef.current = ids;
    return ids;
  }, []);

  // ── Notifica automaticamente o outro lado a cada mensagem nova ────────────
  const notificarNovaMsgSuporte = useCallback(async (resumoTexto: string) => {
    if (isGestor) {
      const tecnicoIds = [task.assignedTo, ...(task.assignedUsers || [])].filter(Boolean) as string[];
      if (tecnicoIds.length === 0) return;
      notificarVarios(tecnicoIds, {
        tipo: 'os_suporte_resposta',
        canal: 'duvida',
        titulo: '💬 Suporte respondeu sua dúvida',
        corpo: `${task.title}${tarefaSelDescricao ? ` — ${tarefaSelDescricao}` : ''}: ${resumoTexto}`,
        som: true,
        prioridade: 'alta',
        osId,
        rota: '/campo/os',
      });
    } else {
      const destinatarios = await carregarGestores();
      if (destinatarios.length === 0) return;
      const nomeTecnico = (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Técnico';
      notificarVarios(destinatarios, {
        tipo: 'os_duvida',
        canal: 'duvida',
        titulo: '🆘 Nova dúvida de suporte',
        corpo: `${nomeTecnico} — ${task.title}${tarefaSelDescricao ? `: ${tarefaSelDescricao}` : ''}`,
        som: true,
        prioridade: 'alta',
        osId,
        rota: '/app/suporte',
      });
    }
  }, [isGestor, task, tarefaSelDescricao, osId, userProfile, carregarGestores]);

  const handleSalvarKB = async (msg: OSSuporteMsg, pergunta: string) => {
    if (!currentUser) return;
    try {
      const nome = (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Gestor';
      await addDoc(collection(db, CollectionName.KNOWLEDGE_BASE), {
        tipoServico: task.tipoServico || '',
        pergunta: pergunta || '(sem pergunta registrada)',
        resposta: msg.texto,
        tags: tarefaSelDescricao ? [tarefaSelDescricao] : [],
        origemOsId: osId,
        origemMsgId: msg.id,
        criadoPor: currentUser.uid,
        criadoPorNome: nome,
        criadoEm: serverTimestamp(),
      });
      setKbSalvas(prev => new Set(prev).add(msg.id));
    } catch {
      alert('Erro ao salvar na base de conhecimento.');
    }
  };

  // ── Gestor marca a dúvida como resolvida manualmente — some da aba
  // "Abertas" do Suporte mesmo que a O.S. continue em andamento. Se o
  // técnico escrever de novo depois, a Cloud Function reabre automaticamente. ──
  const [encerrando, setEncerrando] = useState(false);
  const encerrarDuvida = async () => {
    if (!isGestor || encerrando) return;
    if (!confirm('Marcar esta dúvida como resolvida? Ela sai da lista de conversas abertas.')) return;
    setEncerrando(true);
    try {
      await setDoc(doc(db, CollectionName.OS_SUPORTE_THREADS, osId), {
        archived: true,
        archivedEm: Timestamp.now(),
      }, { merge: true });
      onClose();
    } catch {
      alert('Erro ao marcar como resolvida. Tente de novo.');
    } finally {
      setEncerrando(false);
    }
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || !currentUser || sending) return;
    setSending(true);
    setErroEnvio('');
    const txt = texto.trim();
    try {
      await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
        osId,
        osCode: task.code || task.id.slice(0, 8),
        osTitulo: task.title || '',
        clienteNome: (task as any).clientName || '',
        projectId: (task as any).projectId || '',
        ...(tarefaSelId ? { tarefaId: tarefaSelId, tarefaDescricao: tarefaSelDescricao || '' } : {}),
        tipoServico: task.tipoServico || '',
        texto: txt,
        autorId: currentUser.uid,
        autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
        autorRole: userProfile?.role || 'technician',
        criadaEm: Timestamp.now(),
        leitoPorGestor: isGestor,
        leitoPorTecnico: !isGestor,
      } as Omit<OSSuporteMsg, 'id'>);

      setTexto('');

      if (!isGestor) {
        const nomeTecnico = (userProfile as any)?.nomeCompleto || userProfile?.displayName || 'Técnico';
        registrarAtividade({
          tipo: 'duvida_os',
          autorId: currentUser.uid,
          autorNome: nomeTecnico,
          titulo: `Dúvida técnica${tarefaSelDescricao ? `: ${tarefaSelDescricao}` : ''}`,
          descricao: txt,
          osId, osNumero: task.code, osTitulo: task.title,
          clienteNome: (task as any).clientName,
          meta: { ...(tarefaSelId ? { tarefaId: tarefaSelId } : {}), projectId: (task as any).projectId || '' },
        });
      }

      notificarNovaMsgSuporte(txt);
    } catch (e) {
      console.error('[OSSuporteChat] enviarMensagem:', e);
      setErroEnvio('Não foi possível enviar. Verifique a conexão e tente de novo.');
    } finally {
      setSending(false);
    }
  };

  // ── Photo/video evidence upload ───────────────────────────────────────────
  const handleFotoEvid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadingFoto(true);
    setErroEnvio('');
    try {
      const path = `os_suporte_evidencias/${osId}/${Date.now()}_${currentUser.uid}.jpg`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
        osId,
        osCode: task.code || task.id.slice(0, 8),
        osTitulo: task.title || '',
        clienteNome: (task as any).clientName || '',
        projectId: (task as any).projectId || '',
        ...(tarefaSelId ? { tarefaId: tarefaSelId, tarefaDescricao: tarefaSelDescricao || '' } : {}),
        tipoServico: task.tipoServico || '',
        texto: `📷 Evidência enviada`,
        autorId: currentUser.uid,
        autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
        autorRole: userProfile?.role || 'technician',
        criadaEm: Timestamp.now(),
        leitoPorGestor: isGestor,
        leitoPorTecnico: !isGestor,
        fotosURLs: [url],
      } as any);
      notificarNovaMsgSuporte('📷 enviou uma evidência');
    } catch (err) {
      console.error('[OSSuporteChat] handleFotoEvid:', err);
      setErroEnvio('Não foi possível enviar a foto/vídeo. Tente de novo.');
    } finally {
      setUploadingFoto(false);
      e.target.value = '';
    }
  };

  // ── Audio recording ────────────────────────────────────────────────────────
  const toggleGravacao = async () => {
    if (gravando) {
      mediaRef.current?.stop();
      setGravando(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (!currentUser) return;
        try {
          const path = `os_suporte_audios/${osId}/${Date.now()}.webm`;
          const snap = await uploadBytes(storageRef(storage, path), blob);
          const audioUrl = await getDownloadURL(snap.ref);
          await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
            osId,
            osCode: task.code || task.id.slice(0, 8),
            osTitulo: task.title || '',
            clienteNome: (task as any).clientName || '',
            projectId: (task as any).projectId || '',
            ...(tarefaSelId ? { tarefaId: tarefaSelId, tarefaDescricao: tarefaSelDescricao || '' } : {}),
            tipoServico: task.tipoServico || '',
            texto: `🎙️ Áudio enviado`,
            autorId: currentUser.uid,
            autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
            autorRole: userProfile?.role || 'technician',
            criadaEm: Timestamp.now(),
            leitoPorGestor: isGestor,
            leitoPorTecnico: !isGestor,
            audioURL: audioUrl,
          } as any);
          notificarNovaMsgSuporte('🎙️ enviou um áudio');
        } catch (err) {
          console.error('[OSSuporteChat] toggleGravacao:', err);
          setErroEnvio('Não foi possível enviar o áudio. Tente de novo.');
        }
      };
      rec.start();
      mediaRef.current = rec;
      setGravando(true);
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  };

  // ── Tema ───────────────────────────────────────────────────────────────────
  const theme = isDark
    ? {
        modal: 'bg-gray-950',
        header: 'bg-gray-900 border-gray-800',
        title: 'text-white',
        subtitle: 'text-gray-400',
        inputArea: 'border-gray-800 bg-gray-950',
        input: 'bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-purple-500',
        gateCard: 'bg-gray-900 border-gray-800',
        gateBtn: 'bg-gray-800 border-gray-700 text-gray-100 active:bg-gray-700',
        gateBtnAlt: 'bg-gray-800 border-gray-700 text-gray-100 active:bg-gray-700',
        chip: 'bg-gray-800 border-gray-700 text-gray-300',
      }
    : {
        modal: 'bg-white',
        header: 'bg-gradient-to-r from-purple-50 to-blue-50 border-gray-100',
        title: 'text-gray-900',
        subtitle: 'text-gray-500',
        inputArea: 'border-gray-100',
        input: 'border-gray-200 focus:ring-purple-300',
        gateCard: 'bg-white border-gray-200',
        gateBtn: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
        gateBtnAlt: 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100',
        chip: 'bg-gray-50 border-gray-200 text-gray-600',
      };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className={`${theme.modal} w-full sm:max-w-lg sm:rounded-2xl flex flex-col shadow-2xl`} style={{ height: '90vh', maxHeight: 700 }}>

        {/* Header */}
        <div className={`flex items-center gap-3 px-4 py-3 border-b ${theme.header} sm:rounded-t-2xl`}>
          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Headphones size={16} className="text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-bold ${theme.title}`}>Suporte</p>
            <p className={`text-[10px] truncate ${theme.subtitle}`}>O.S.: {task.code || task.id.slice(0, 8)} — {task.title}</p>
          </div>
          {isGestor && (
            <button
              onClick={encerrarDuvida}
              disabled={encerrando}
              className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 border border-emerald-300 rounded-full px-2.5 py-1 hover:bg-emerald-50 disabled:opacity-50 flex-shrink-0"
              title="Marcar como resolvida — some da lista de conversas abertas"
            >
              {encerrando ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Resolvida
            </button>
          )}
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100/20">
            <X size={18} />
          </button>
        </div>

        {/* Gate: escolha explícita de tarefa vs. dúvida geral (só técnico, conversa nova) */}
        {!isGestor && gateStep === 'escolha' ? (
          <div className={`flex-1 overflow-y-auto px-5 py-6 flex flex-col gap-4 ${theme.gateCard}`}>
            <div className="text-center space-y-1 mb-2">
              <MessageCircleQuestion size={28} className="mx-auto text-purple-500" />
              <p className={`text-base font-bold ${theme.title}`}>Sobre o que é sua dúvida?</p>
              <p className={`text-xs ${theme.subtitle}`}>Escolha uma opção pra continuar</p>
            </div>

            <div className={`rounded-2xl border p-4 space-y-2 ${theme.gateCard}`}>
              <p className={`text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${theme.subtitle}`}>
                <ClipboardList size={12} /> Dúvida sobre uma tarefa
              </p>
              <div className="space-y-1.5">
                {tarefasOS.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setTarefaSelId(t.id); setGateStep('chat'); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors ${theme.gateBtn}`}
                  >
                    {t.descricao}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setTarefaSelId(''); setGateStep('chat'); }}
              className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border text-sm font-bold transition-colors ${theme.gateBtnAlt}`}
            >
              <Headphones size={14} /> Pergunta geral sobre a O.S.
            </button>
          </div>
        ) : (
          <>
            {/* Chip com o contexto da dúvida atual (só técnico) */}
            {!isGestor && (
              <div className={`px-4 py-2 border-b flex items-center justify-between gap-2 ${theme.inputArea}`}>
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 truncate ${theme.chip}`}>
                  {tarefaSelDescricao ? <><ClipboardList size={11} /> {tarefaSelDescricao}</> : <><Headphones size={11} /> Dúvida geral da O.S.</>}
                </span>
                <button
                  onClick={() => setGateStep('escolha')}
                  className="flex-shrink-0 flex items-center gap-1 text-[11px] font-bold text-purple-500 border border-purple-300 rounded-full px-2.5 py-1 hover:bg-purple-50"
                >
                  <X size={11} /> Encerrar Suporte
                </button>
              </div>
            )}

            {erroEnvio && (
              <div className="px-4 py-2 bg-red-50 border-b border-red-200">
                <p className="text-xs text-red-600 font-semibold">{erroEnvio}</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {timeline.map((item, idx) => {
                if (item.kind === 'obs') {
                  return <ObservacaoBubble key={`obs-${idx}`} obs={item.data} isDark={isDark} />;
                }
                const msg = item.data;
                const perguntaAnterior = [...msgs.slice(0, msgs.indexOf(msg))].reverse()
                  .find(m => TECH_ROLES.includes(m.autorRole))?.texto;
                return (
                  <MsgBubble
                    key={msg.id}
                    msg={msg}
                    isOwn={msg.autorId === currentUser?.uid}
                    isGestor={isGestor}
                    isDark={isDark}
                    perguntaAnterior={perguntaAnterior}
                    onSalvarKB={handleSalvarKB}
                    kbSalva={kbSalvas.has(msg.id)}
                  />
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className={`px-3 py-3 border-t space-y-2 ${theme.inputArea}`}>
              <div className="flex gap-2 items-end">
                <textarea
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
                  placeholder="Escreva sua mensagem..."
                  rows={2}
                  className={`flex-1 border rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 ${theme.input}`}
                />
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={toggleGravacao}
                    className={`p-2 rounded-full transition-colors ${gravando ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600'}`}
                    title={gravando ? 'Parar gravação' : 'Gravar áudio'}
                  >
                    {gravando ? <MicOff size={16} /> : <Mic size={16} />}
                  </button>
                  <button
                    onClick={() => fotoRef.current?.click()}
                    disabled={uploadingFoto}
                    className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                    title="Enviar foto ou vídeo"
                  >
                    {uploadingFoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                  </button>
                  <button
                    onClick={enviarMensagem}
                    disabled={!texto.trim() || sending}
                    className="p-2 rounded-full bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors"
                  >
                    {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
              {gravando && (
                <p className="text-xs text-red-500 flex items-center gap-1 animate-pulse">
                  <Mic size={10} /> Gravando... Toque novamente para parar.
                </p>
              )}
            </div>
          </>
        )}

        <input ref={fotoRef} type="file" accept="image/*,video/*" capture="environment" className="hidden" onChange={handleFotoEvid} />
      </div>
    </div>
  );
};

export default OSSuporteChat;

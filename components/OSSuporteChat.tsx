/**
 * components/OSSuporteChat.tsx — Sprint 46A
 * Suporte Primário ao Técnico: chat IA-First dentro de uma O.S.
 *
 * Fluxo:
 *  1. IA inicia triagem → coleta texto, áudio, fotos de evidência
 *  2. IA analisa com Gemini (contexto O.S. + histórico de chats similares)
 *  3. IA oferece sugestão da base de conhecimento OU escala para gestor humano
 *  4. Gestor entra → IA acompanha, mas ação executiva é sempre do gestor
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, getDocs, limit, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, OSSuporteMsg, Task } from '../types';
import { GoogleGenAI } from '@google/genai';
import {
  Send, Mic, MicOff, Camera, Bot, User, Briefcase, Loader2,
  X, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Headphones,
} from 'lucide-react';

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  technician: { label: 'Técnico',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <User      size={10} /> },
  tecnico:    { label: 'Técnico',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <User      size={10} /> },
  employee:   { label: 'Técnico',  cls: 'bg-blue-100 text-blue-700 border-blue-200',   icon: <User      size={10} /> },
  manager:    { label: 'Gestor',   cls: 'bg-green-100 text-green-700 border-green-200', icon: <Briefcase size={10} /> },
  gestor:     { label: 'Gestor',   cls: 'bg-green-100 text-green-700 border-green-200', icon: <Briefcase size={10} /> },
  admin:      { label: 'Gestor',   cls: 'bg-green-100 text-green-700 border-green-200', icon: <Briefcase size={10} /> },
  ia:         { label: '🤖 IA',    cls: 'bg-purple-100 text-purple-700 border-purple-200', icon: <Bot    size={10} /> },
};

const getRoleBadge = (role: string) =>
  ROLE_BADGE[role] ?? { label: role, cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: <User size={10} /> };

// ── IA — gera resposta via Gemini ─────────────────────────────────────────────
const genAI = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || '' });

async function gerarRespostaIA(
  task: Task,
  mensagens: OSSuporteMsg[],
  historico: OSSuporteMsg[],
): Promise<string> {
  // Build context
  const ctxOS = `
O.S. #${task.code || task.id.slice(0, 8)}: "${task.title}"
Tipo de serviço: ${task.tipoServico || 'não informado'}
Cliente: ${task.clientName || 'não informado'}
Ativo: ${(task as any).ativoNome || 'não informado'}
Tarefas: ${(task.checklist || []).map(c => `• ${c.text}`).join('\n') || 'nenhuma'}
Ferramentas previstas: ${((task as any).ferramentasUtilizadas || []).join(', ') || 'nenhuma'}
`;

  const ctxChat = mensagens
    .filter(m => m.autorRole !== 'ia')
    .map(m => {
      const techRoles = ['technician', 'tecnico', 'employee'];
      return `${techRoles.includes(m.autorRole) ? '[TÉCNICO]' : '[GESTOR]'}: ${m.texto}`;
    })
    .join('\n');

  const ctxHistorico = historico.length > 0
    ? '\n\nCasos anteriores similares na base de conhecimento:\n' +
      historico.slice(0, 30).map(m => `  - ${m.texto}`).join('\n')
    : '';

  const prompt = `Você é o Suporte Primário da MGR — um assistente técnico especializado que auxilia técnicos de campo.

REGRAS CRÍTICAS:
• Você NUNCA dá ordens executivas ("faça", "substitua", "desligue"). Use sempre linguagem de diagnóstico: "pode indicar que", "sugiro verificar", "é possível que".
• A ação executiva é SEMPRE do Gestor de Projetos.
• Seja conciso, técnico e prático. Máximo 3 parágrafos.
• Finalize sua resposta com a pergunta: "Gostaria de uma sugestão da base de conhecimento ou prefere solicitar suporte do Gestor?"

CONTEXTO DA O.S.:
${ctxOS}

CONVERSA ATUAL:
${ctxChat}
${ctxHistorico}

Responda em português, como assistente técnico especializado.`;

  const result = await genAI.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  return result.text ?? 'Não consegui gerar uma resposta. Por favor, tente novamente ou solicite suporte humano.';
}

// ── Mensagem bubble ───────────────────────────────────────────────────────────
const MsgBubble: React.FC<{ msg: OSSuporteMsg; isOwn: boolean }> = ({ msg, isOwn }) => {
  const badge = getRoleBadge(msg.autorRole);
  const isIA = msg.autorRole === 'ia';
  const ts = msg.criadaEm instanceof Timestamp
    ? msg.criadaEm.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${isIA ? 'bg-purple-100 text-purple-700' : isOwn ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
        {isIA ? '🤖' : msg.autorNome.charAt(0).toUpperCase()}
      </div>
      <div className={`max-w-[78%] space-y-1 ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${badge.cls}`}>
            {badge.label}
          </span>
          <span className="text-[9px] text-gray-400">{msg.autorNome} · {ts}</span>
        </div>
        <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap shadow-sm
          ${isIA ? 'bg-purple-50 border border-purple-100 text-purple-900' :
            isOwn ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-800'}`}>
          {msg.texto}
        </div>
        {/* Evidence photos */}
        {msg.isIASugestao && (
          <span className="text-[9px] text-purple-500 italic">Sugestão baseada na base de conhecimento MGR</span>
        )}
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
interface OSSuporteChatProps {
  task: Task;
  onClose: () => void;
}

const OSSuporteChat: React.FC<OSSuporteChatProps> = ({ task, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const osId = task.id;

  const [msgs, setMsgs] = useState<OSSuporteMsg[]>([]);
  const [texto, setTexto] = useState('');
  const [sending, setSending] = useState(false);
  const [iaThinking, setIAThinking] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [phase, setPhase] = useState<'triage' | 'suggestions' | 'human'>('triage');

  const bottomRef = useRef<HTMLDivElement>(null);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fotoRef   = useRef<HTMLInputElement>(null);

  const isGestor = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

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
      // Mark gestor msgs as read
      if (!isGestor) {
        snap.docs.filter(d => !d.data().leitoPorTecnico && d.data().autorRole !== 'technician' && d.data().autorRole !== 'tecnico' && d.data().autorRole !== 'employee')
          .forEach(d => updateDoc(d.ref, { leitoPorTecnico: true }).catch(() => {}));
      } else {
        snap.docs.filter(d => !d.data().leitoPorGestor && (d.data().autorRole === 'technician' || d.data().autorRole === 'tecnico' || d.data().autorRole === 'employee' || d.data().autorRole === 'ia'))
          .forEach(d => updateDoc(d.ref, { leitoPorGestor: true }).catch(() => {}));
      }
    });
    return unsub;
  }, [osId, isGestor]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, iaThinking]);

  // ── IA greeting on first open ─────────────────────────────────────────────
  useEffect(() => {
    if (msgs.length === 0 && !isGestor) {
      setTimeout(() => enviarMsgIA(
        `Olá! Sou o Suporte Primário MGR 🤖

Estou aqui para ajudar você na O.S. **"${task.title}"**.

Para iniciar, preciso entender o problema:
1️⃣ Descreva com suas palavras o que está acontecendo
2️⃣ Se possível, envie fotos ou evidências do problema (botão 📷)
3️⃣ Você também pode enviar um áudio descritivo (botão 🎙️)

Pode começar!`
      ), 600);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // ── Send message helpers ──────────────────────────────────────────────────
  const enviarMsgIA = useCallback(async (texto: string, isSugestao = false) => {
    if (!currentUser) return;
    await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
      osId,
      osCode: task.code || task.id.slice(0, 8),
      tipoServico: task.tipoServico || '',
      texto,
      autorId: 'ia',
      autorNome: 'Suporte Primário MGR',
      autorRole: 'ia',
      criadaEm: serverTimestamp(),
      leitoPorGestor: false,
      leitoPorTecnico: true,
      isIASugestao: isSugestao,
    } as Omit<OSSuporteMsg, 'id'>);
  }, [currentUser, osId, task]);

  const notificarGestor = async () => {
    // Mark all existing msgs as requesting human support
    await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
      osId,
      osCode: task.code || task.id.slice(0, 8),
      tipoServico: task.tipoServico || '',
      texto: `⚠️ O técnico **${userProfile?.displayName || 'do campo'}** solicita suporte humano para esta O.S.`,
      autorId: 'ia',
      autorNome: 'Suporte Primário MGR',
      autorRole: 'ia',
      criadaEm: serverTimestamp(),
      leitoPorGestor: false,
      leitoPorTecnico: true,
      isIASugestao: false,
      solicitouHumano: true,
    } as any);
    setPhase('human');
  };

  const enviarMensagem = async () => {
    if (!texto.trim() || !currentUser || sending) return;
    setSending(true);
    const txt = texto.trim();
    setTexto('');
    try {
      await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
        osId,
        osCode: task.code || task.id.slice(0, 8),
        tipoServico: task.tipoServico || '',
        texto: txt,
        autorId: currentUser.uid,
        autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
        autorRole: userProfile?.role || 'technician',
        criadaEm: serverTimestamp(),
        leitoPorGestor: isGestor,
        leitoPorTecnico: !isGestor,
      } as Omit<OSSuporteMsg, 'id'>);

      // If in triage phase and not a gestor, trigger IA analysis after tech message
      if (phase === 'triage' && !isGestor) {
        setIAThinking(true);
        try {
          // Get historical messages from similar OS
          const histQ = query(
            collection(db, CollectionName.OS_SUPORTE_MSGS),
            where('tipoServico', '==', task.tipoServico || ''),
            orderBy('criadaEm', 'desc'),
            limit(50),
          );
          const histSnap = await getDocs(histQ);
          const historico = histSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as OSSuporteMsg))
            .filter(m => m.osId !== osId && m.isIASugestao === false && m.autorRole !== 'ia');

          const currentMsgs = [...msgs, { texto: txt, autorRole: userProfile?.role || 'technician' } as OSSuporteMsg];
          const resposta = await gerarRespostaIA(task, currentMsgs, historico);
          await enviarMsgIA(resposta, false);
          setPhase('suggestions');
        } catch (err) {
          await enviarMsgIA('Desculpe, tive dificuldade em processar. Por favor, detalhe mais o problema ou solicite suporte humano.');
        } finally {
          setIAThinking(false);
        }
      }
    } finally {
      setSending(false);
    }
  };

  // ── Photo evidence upload ─────────────────────────────────────────────────
  const handleFotoEvid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setUploadingFoto(true);
    try {
      const path = `os_suporte_evidencias/${osId}/${Date.now()}_${currentUser.uid}.jpg`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
        osId,
        osCode: task.code || task.id.slice(0, 8),
        tipoServico: task.tipoServico || '',
        texto: `📷 Evidência fotográfica enviada`,
        autorId: currentUser.uid,
        autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
        autorRole: userProfile?.role || 'technician',
        criadaEm: serverTimestamp(),
        leitoPorGestor: false,
        leitoPorTecnico: true,
        fotosURLs: [url],
      } as any);
    } finally {
      setUploadingFoto(false);
    }
  };

  // ── Audio recording (MediaRecorder → Gemini transcription) ───────────────
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
        // Upload to storage
        if (!currentUser) return;
        setIAThinking(true);
        try {
          const path = `os_suporte_audios/${osId}/${Date.now()}.webm`;
          const snap = await uploadBytes(storageRef(storage, path), blob);
          const audioUrl = await getDownloadURL(snap.ref);
          // For now send as evidence link; full Gemini audio transcription requires server-side
          await addDoc(collection(db, CollectionName.OS_SUPORTE_MSGS), {
            osId,
            osCode: task.code || task.id.slice(0, 8),
            tipoServico: task.tipoServico || '',
            texto: `🎙️ Áudio de suporte enviado`,
            autorId: currentUser.uid,
            autorNome: userProfile?.displayName || currentUser.email || 'Usuário',
            autorRole: userProfile?.role || 'technician',
            criadaEm: serverTimestamp(),
            leitoPorGestor: false,
            leitoPorTecnico: true,
            audioURL: audioUrl,
          } as any);
          await enviarMsgIA('Recebi seu áudio! Para que eu possa ajudar melhor, pode também descrever por texto o problema principal? Isso me ajuda a buscar na base de conhecimento.');
        } finally {
          setIAThinking(false);
        }
      };
      rec.start();
      mediaRef.current = rec;
      setGravando(true);
    } catch {
      alert('Não foi possível acessar o microfone.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl flex flex-col shadow-2xl" style={{ height: '90vh', maxHeight: 700 }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-blue-50 sm:rounded-t-2xl">
          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-lg flex-shrink-0">🤖</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">Suporte Primário MGR</p>
            <p className="text-[10px] text-gray-500 truncate">O.S.: {task.code || task.id.slice(0, 8)} — {task.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {phase === 'human' && (
              <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 size={10} /> Gestor notificado
              </span>
            )}
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {msgs.map(msg => (
            <MsgBubble
              key={msg.id}
              msg={msg}
              isOwn={msg.autorId === currentUser?.uid}
            />
          ))}
          {iaThinking && (
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-sm">🤖</div>
              <div className="bg-purple-50 border border-purple-100 rounded-2xl px-3 py-2 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-purple-500" />
                <span className="text-xs text-purple-600">Analisando com a base de conhecimento...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Quick Actions (suggestions phase) */}
        {phase === 'suggestions' && !isGestor && (
          <div className="px-4 py-2 bg-purple-50 border-t border-purple-100 flex gap-2 flex-wrap">
            <button
              onClick={() => { setTexto('Sim, quero sugestões da base de conhecimento'); }}
              className="text-xs px-3 py-1.5 rounded-full bg-purple-600 text-white font-bold hover:bg-purple-700"
            >
              💡 Ver sugestões da base MGR
            </button>
            <button
              onClick={notificarGestor}
              className="text-xs px-3 py-1.5 rounded-full bg-green-600 text-white font-bold hover:bg-green-700 flex items-center gap-1"
            >
              <Headphones size={12} /> Solicitar suporte humano
            </button>
          </div>
        )}

        {/* Input */}
        <div className="px-3 py-3 border-t border-gray-100 space-y-2">
          <div className="flex gap-2 items-end">
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviarMensagem(); } }}
              placeholder="Descreva o problema ou envie evidências..."
              rows={2}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <div className="flex flex-col gap-1.5">
              {/* Audio */}
              <button
                onClick={toggleGravacao}
                className={`p-2 rounded-full transition-colors ${gravando ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-100 text-gray-500 hover:bg-purple-100 hover:text-purple-600'}`}
                title={gravando ? 'Parar gravação' : 'Gravar áudio'}
              >
                {gravando ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {/* Photo */}
              <button
                onClick={() => fotoRef.current?.click()}
                disabled={uploadingFoto}
                className="p-2 rounded-full bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                title="Enviar foto de evidência"
              >
                {uploadingFoto ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              </button>
              {/* Send */}
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

        <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFotoEvid} />
      </div>
    </div>
  );
};

export default OSSuporteChat;

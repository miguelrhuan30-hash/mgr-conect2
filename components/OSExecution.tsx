/**
 * components/OSExecution.tsx — Sprints 38-45
 * Execução de O.S. com: permissões por role, fotos configuráveis por tarefa,
 * check-in geoloc, digitalização Gemini, KPIs, questionário IA, observações.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, serverTimestamp, arrayUnion, Timestamp,
  collection, getDocs, addDoc, query, where,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Task, Client, CollectionName, WorkflowStatus as WS,
  OSFotoSlot, OSItemTarefa, OSObservacao, OSAtualizacaoViaFoto,
  OSEdicao, OSKpiEntry,
} from '../types';
import { TASK_PHOTO_DEFAULT } from './TaskPhotoConfig';
import {
  MapPin, CheckCircle2, AlertCircle, Camera, Loader2, X, ArrowLeft,
  CheckSquare, Square, ClipboardList, Upload, Lock, Unlock, Navigation,
  ShieldCheck, MessageSquare, Send, FileText, Wrench, Zap, Clock,
  ChevronDown, ChevronUp, Printer, ScanLine,
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// ── Haversine ────────────────────────────────────────────────────────────────
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180, φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Role helpers ─────────────────────────────────────────────────────────────
const isGestorRole = (role?: string) =>
  role === 'admin' || role === 'gestor' || role === 'manager';
const isTecnicoRole = (role?: string) =>
  role === 'technician' || role === 'tecnico' || role === 'employee';

// ── Stage ────────────────────────────────────────────────────────────────────
type Stage = 'checkin' | 'execution' | 'finalizacao' | 'done';

// ── Autocomplete helpers ──────────────────────────────────────────────────────
const AutocompleteField: React.FC<{
  label: string; value: string; onChange: (v: string) => void;
  suggestions: string[]; onSelect: (v: string) => void; placeholder?: string;
}> = ({ label, value, onChange, suggestions, onSelect, placeholder }) => (
  <div className="relative">
    <label className="text-xs font-bold text-gray-600 mb-1 block">{label}</label>
    <input value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
    {suggestions.length > 0 && (
      <div className="absolute z-10 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 w-full max-h-36 overflow-y-auto">
        {suggestions.map(s => (
          <button key={s} type="button" onClick={() => onSelect(s)}
            className="w-full text-left px-3 py-1.5 text-sm hover:bg-brand-50 hover:text-brand-700">
            {s}
          </button>
        ))}
      </div>
    )}
  </div>
);

// ── OSSExecution ──────────────────────────────────────────────────────────────
const OSExecution: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate   = useNavigate();
  const { currentUser, userProfile } = useAuth();

  const isGestor = isGestorRole(userProfile?.role);
  const isTecnico = isTecnicoRole(userProfile?.role);

  const [task,    setTask]    = useState<Task | null>(null);
  const [client,  setClient]  = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage,   setStage]   = useState<Stage>('checkin');
  const [saving,  setSaving]  = useState(false);

  // Sprint 39 — Photo slots
  const [photoSlots, setPhotoSlots] = useState<OSFotoSlot[]>(TASK_PHOTO_DEFAULT);
  const [tarefasOS,  setTarefasOS]  = useState<OSItemTarefa[]>([]);
  const [uploadingFoto, setUploadingFoto] = useState<string | null>(null);

  // Sprint 40 — Check-in geoloc
  const [geoStatus,  setGeoStatus]  = useState<'idle'|'checking'|'ok'|'blocked'>('idle');
  const [geoCoords,  setGeoCoords]  = useState<GeolocationCoordinates | null>(null);
  const [distancia,  setDistancia]  = useState<number | null>(null);
  const [checkinFeito, setCheckinFeito] = useState(false);

  // Sprint 43 — Service type + tools  
  const [tipoServico,     setTipoServico]     = useState('');
  const [tipoSugestoes,   setTipoSugestoes]   = useState<string[]>([]);
  const [ferramentas,     setFerramentas]      = useState<string[]>([]);
  const [ferrInput,       setFerrInput]        = useState('');
  const [ferrSugestoes,   setFerrSugestoes]    = useState<string[]>([]);

  // Sprint 45 — Observations
  const [obsTexto,  setObsTexto]  = useState('');
  const [observations, setObservations] = useState<OSObservacao[]>([]);
  const [showObs, setShowObs] = useState(false);

  // Sprint 42 — Documento físico
  const [docFotoUrl,    setDocFotoUrl]    = useState<string | null>(null);
  const [analisandoDoc, setAnalisandoDoc] = useState(false);
  const [sugestoesIA,   setSugestoesIA]   = useState<OSAtualizacaoViaFoto[]>([]);
  const [showDigitalizacao, setShowDigitalizacao] = useState(false);
  const docFileRef = useRef<HTMLInputElement>(null);

  // Sprint 44 — Finalization
  const [showQuestionario, setShowQuestionario] = useState(false);
  const [fConcluida, setFConcluida] = useState<boolean | null>(null);
  const [fImpedimento, setFImpedimento] = useState('');
  const [fNovoProblema, setFNovoProblema] = useState(false);
  const [fNovoProblemaDesc, setFNovoProblemaDesc] = useState('');
  const [fSolucao, setFSolucao] = useState('');

  // Legacy execution state
  const [adversidades, setAdversidades] = useState('');
  const [evidencias,   setEvidencias]   = useState<string[]>([]);
  const [uploading,    setUploading]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Load task + photo config ───────────────────────────────────────────────
  useEffect(() => {
    if (!taskId) return;
    (async () => {
      const [snap, configSnap] = await Promise.all([
        getDoc(doc(db, CollectionName.TASKS, taskId)),
        getDoc(doc(db, CollectionName.OS_TASK_PHOTO_CONFIG, 'default')),
      ]);
      if (!snap.exists()) { setLoading(false); return; }
      const t = { id: snap.id, ...snap.data() } as Task;
      setTask(t);
      setTipoServico(t.tipoServico || '');
      setFerramentas(t.ferramentasUtilizadas || []);
      setObservations(t.observacoes || []);
      setSugestoesIA(t.atualizacoesViaFoto || []);
      if (t.documentoFisico?.fotoUrl) setDocFotoUrl(t.documentoFisico.fotoUrl);

      // Init tarefasOS from checklist if not already set
      if (t.tarefasOS && t.tarefasOS.length > 0) {
        setTarefasOS(t.tarefasOS);
      } else {
        setTarefasOS((t.checklist || []).map(c => ({
          id: c.id, descricao: c.text, status: 'pendente' as const,
          iniciadaEm: null, concluidaEm: null, fotos: {},
        })));
      }

      if (configSnap.exists() && Array.isArray(configSnap.data().slots)) {
        setPhotoSlots((configSnap.data().slots as OSFotoSlot[]).filter(s => s.active).sort((a, b) => a.order - b.order));
      }

      // Check if already checked in
      if ((t as any).checkinOS?.feito) {
        setCheckinFeito(true);
        setStage('execution');
      }

      if (t.clientId) {
        const cSnap = await getDoc(doc(db, CollectionName.CLIENTS, t.clientId));
        if (cSnap.exists()) setClient({ id: cSnap.id, ...cSnap.data() } as Client);
      }
      setLoading(false);
    })();
  }, [taskId]);

  // ── Audit helper ──────────────────────────────────────────────────────────
  const registrarEdicao = (campo: string, valorAnterior: any, valorNovo: any): OSEdicao => ({
    campo, valorAnterior, valorNovo,
    editadoPor: currentUser?.uid || '',
    editadoPorNome: userProfile?.displayName || currentUser?.email || '',
    editadoEm: Timestamp.now(),
    viaDados: 'sistema',
  });

  // ── Sprint 40: Check-in ───────────────────────────────────────────────────
  const checkGeo = () => {
    setGeoStatus('checking');
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGeoCoords(pos.coords);
        const geo = (client as any)?.geolocalizacao;
        if (!geo?.latitude || !geo?.longitude) {
          setGeoStatus('ok'); return;
        }
        const dist = haversine(pos.coords.latitude, pos.coords.longitude, geo.latitude, geo.longitude);
        setDistancia(Math.round(dist));
        setGeoStatus(dist <= (geo.raioMetros ?? 200) ? 'ok' : 'blocked');
      },
      () => setGeoStatus('blocked')
    );
  };

  const handleCheckIn = async (manual = false) => {
    if (!task || !taskId || !currentUser) return;
    setSaving(true);
    try {
      const checkinData = {
        feito: true,
        timestamp: Timestamp.now(),
        gpsCoords: geoCoords ? { lat: geoCoords.latitude, lng: geoCoords.longitude, accuracy: geoCoords.accuracy } : null,
        distanciaMetros: distancia,
        userId: currentUser.uid,
        manual,
      };
      await updateDoc(doc(db, CollectionName.TASKS, taskId), {
        checkinOS: checkinData,
        workflowStatus: WS.EM_EXECUCAO,
        status: 'in-progress',
        'execution.checkIn': Timestamp.now(),
        'geofencing.validated': true,
        statusHistory: arrayUnion({ status: WS.EM_EXECUCAO, changedAt: Timestamp.now(), changedBy: currentUser.uid }),
        updatedAt: serverTimestamp(),
      });
      setCheckinFeito(true);
      setStage('execution');
    } finally { setSaving(false); }
  };

  // ── Sprint 39: Task photos ─────────────────────────────────────────────────
  const fotoFileRef = useRef<HTMLInputElement>(null);
  const [pendingFotoKey, setPendingFotoKey] = useState<{ tarefaId: string; slotKey: string } | null>(null);

  const abrirCamera = (tarefaId: string, slotKey: string) => {
    setPendingFotoKey({ tarefaId, slotKey });
    fotoFileRef.current?.click();
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingFotoKey || !taskId || !currentUser) return;
    const { tarefaId, slotKey } = pendingFotoKey;
    const slot = photoSlots.find(s => s.key === slotKey);
    setUploadingFoto(`${tarefaId}_${slotKey}`);
    try {
      const path = `os_fotos/${taskId}/${tarefaId}_${slotKey}_${Date.now()}.jpg`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setTarefasOS(prev => prev.map(t => t.id === tarefaId ? {
        ...t,
        fotos: {
          ...(t.fotos || {}),
          [slotKey]: {
            url, uploadEm: Timestamp.now(), uploadPor: currentUser.uid,
            descricaoGestor: slot?.descricao || '', comentarioTecnico: '',
          },
        },
      } : t));
    } finally { setUploadingFoto(null); e.target.value = ''; }
  };

  const salvarComentarioFoto = (tarefaId: string, slotKey: string, comentario: string) => {
    setTarefasOS(prev => prev.map(t => t.id === tarefaId ? {
      ...t,
      fotos: {
        ...(t.fotos || {}),
        [slotKey]: { ...(t.fotos?.[slotKey] as any), comentarioTecnico: comentario },
      },
    } : t));
  };

  const iniciarTarefa = async (tarefaId: string) => {
    if (!taskId || !currentUser) return;
    const now = Timestamp.now();
    setTarefasOS(prev => prev.map(t => t.id === tarefaId ? { ...t, status: 'em_andamento', iniciadaEm: now } : t));
  };

  const concluirTarefa = async (tarefaId: string) => {
    if (!taskId || !currentUser) return;
    const tarefa = tarefasOS.find(t => t.id === tarefaId);
    if (!tarefa) return;

    // Verificar fotos obrigatórias
    const fotasObrigatorias = photoSlots.filter(s => s.required && s.active);
    const fotasFaltando = fotasObrigatorias.filter(s => !tarefa.fotos?.[s.key]?.url);
    if (fotasFaltando.length > 0) {
      alert(`Fotos obrigatórias faltando: ${fotasFaltando.map(s => s.label).join(', ')}`);
      return;
    }
    const now = Timestamp.now();
    const inicio = tarefa.iniciadaEm || now;
    const duracao = Math.round((now.toMillis() - inicio.toMillis()) / 60000);

    const updatedTarefa = { ...tarefa, status: 'concluida' as const, concluidaEm: now, tempoDuracaoMinutos: duracao };
    setTarefasOS(prev => prev.map(t => t.id === tarefaId ? updatedTarefa : t));

    // Salvar KPI
    try {
      const kpiEntry: Omit<OSKpiEntry, 'id'> = {
        descricaoTarefa: tarefa.descricao,
        tipoServico: tipoServico || undefined,
        tempoDuracaoMinutos: duracao,
        osId: taskId,
        tecnicoId: currentUser.uid,
        data: now,
      };
      await addDoc(collection(db, CollectionName.TASK_KPIS), kpiEntry);
    } catch (e) { console.error('KPI save error', e); }
  };

  // ── Sprint 43: Autocomplete ────────────────────────────────────────────────
  const buscarTipos = useCallback(async (val: string) => {
    if (!val.trim()) { setTipoSugestoes([]); return; }
    try {
      const snap = await getDocs(collection(db, CollectionName.SERVICE_TYPES));
      const all = snap.docs.map(d => (d.data() as any).nome as string);
      setTipoSugestoes(all.filter(n => n.toLowerCase().includes(val.toLowerCase())).slice(0, 6));
    } catch { setTipoSugestoes([]); }
  }, []);

  const buscarFerramentas = useCallback(async (val: string) => {
    if (!val.trim()) { setFerrSugestoes([]); return; }
    try {
      const snap = await getDocs(collection(db, CollectionName.TOOLS_CATALOG));
      const all = snap.docs.map(d => (d.data() as any).nome as string);
      setFerrSugestoes(all.filter(n => n.toLowerCase().includes(val.toLowerCase()) && !ferramentas.includes(n)).slice(0, 6));
    } catch { setFerrSugestoes([]); }
  }, [ferramentas]);

  const selecionarTipo = async (tipo: string) => {
    setTipoServico(tipo); setTipoSugestoes([]);
    // upsert in service_types
    try {
      const snap = await getDocs(query(collection(db, CollectionName.SERVICE_TYPES), where('nome', '==', tipo)));
      if (snap.empty) await addDoc(collection(db, CollectionName.SERVICE_TYPES), { nome: tipo, usoCount: 1, criadoEm: Timestamp.now() });
    } catch { /* silent */ }
  };

  const adicionarFerramenta = async (nome: string) => {
    const n = nome.trim(); if (!n || ferramentas.includes(n)) return;
    setFerramentas(p => [...p, n]); setFerrInput(''); setFerrSugestoes([]);
    try {
      const snap = await getDocs(query(collection(db, CollectionName.TOOLS_CATALOG), where('nome', '==', n)));
      if (snap.empty) await addDoc(collection(db, CollectionName.TOOLS_CATALOG), { nome: n, categoria: '', usoCount: 1 });
    } catch { /* silent */ }
  };

  // ── Sprint 42: Digitalização ──────────────────────────────────────────────
  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId || !currentUser) return;
    setAnalisandoDoc(true);
    try {
      const path = `documentos_os/${taskId}/assinado_${Date.now()}.jpg`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setDocFotoUrl(url);
      await updateDoc(doc(db, CollectionName.TASKS, taskId), {
        'documentoFisico.fotoUrl': url, 'documentoFisico.uploadEm': Timestamp.now(),
        'documentoFisico.uploadPor': currentUser.uid, 'documentoFisico.analisadoPorIA': false,
      });

      // Gemini analysis
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
          const prompt = `Esta é uma Ordem de Serviço física. Analise e responda SOMENTE em JSON válido:
{"temAssinatura":boolean,"camposAtualizados":[{"campo":string,"valor":string,"confianca":"alta"|"media"|"baixa"}]}`;
          const res = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: { parts: [{ inlineData: { mimeType: 'image/jpeg', data: base64 } }, { text: prompt }] },
            config: { responseMimeType: 'application/json' },
          });
          const parsed = JSON.parse(res.text || '{}');
          const atualizacoes: OSAtualizacaoViaFoto[] = (parsed.camposAtualizados || []).map((c: any) => ({
            campo: c.campo, valorIdentificado: c.valor, confianca: c.confianca || 'baixa',
            aplicadoNaOS: false, revisadoPorGestor: false, timestamp: Timestamp.now(),
          }));
          setSugestoesIA(atualizacoes);
          await updateDoc(doc(db, CollectionName.TASKS, taskId), {
            'documentoFisico.analisadoPorIA': true,
            'documentoFisico.temAssinatura': parsed.temAssinatura ?? false,
            atualizacoesViaFoto: atualizacoes,
          });
        } catch (err) { console.error('Gemini doc analysis error', err); }
        setAnalisandoDoc(false);
      };
      reader.readAsDataURL(file);
    } catch (err) { console.error('Doc upload error', err); setAnalisandoDoc(false); }
    e.target.value = '';
  };

  const confirmarSugestao = async (idx: number, aceitar: boolean) => {
    if (!taskId) return;
    const updated = sugestoesIA.map((s, i) => i === idx ? { ...s, revisadoPorGestor: true, aplicadoNaOS: aceitar } : s);
    setSugestoesIA(updated);
    const edicoes: OSEdicao[] = aceitar ? [registrarEdicao(sugestoesIA[idx].campo, '', sugestoesIA[idx].valorIdentificado)] : [];
    await updateDoc(doc(db, CollectionName.TASKS, taskId), {
      atualizacoesViaFoto: updated,
      ...(edicoes.length > 0 ? { edicoes: arrayUnion(edicoes[0]) } : {}),
    });
  };

  // ── Sprint 45: Observações ────────────────────────────────────────────────
  const adicionarObservacao = async () => {
    if (!obsTexto.trim() || !taskId || !currentUser) return;
    const obs: OSObservacao = {
      id: `obs_${Date.now()}`,
      texto: obsTexto.trim(),
      autorId: currentUser.uid,
      autorNome: userProfile?.displayName || currentUser.email || '',
      autorRole: userProfile?.role || '',
      criadaEm: Timestamp.now(),
    };
    setObservations(p => [...p, obs]);
    setObsTexto('');
    await updateDoc(doc(db, CollectionName.TASKS, taskId), {
      observacoes: arrayUnion(obs),
    });
  };

  // ── Photo upload (legacy evidence) ────────────────────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !taskId || !currentUser) return;
    setUploading(true);
    try {
      const path = `evidencias/${taskId}/${Date.now()}_${currentUser.uid}.jpg`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setEvidencias(p => [...p, url]);
    } finally { setUploading(false); }
  };

  // ── Sprint 44: Finalizar O.S. ─────────────────────────────────────────────
  const finalizarOS = async () => {
    if (!task || !taskId || !currentUser) return;
    setSaving(true);
    try {
      let newStatus: WS = WS.AGUARDANDO_FATURAMENTO;
      let statusOS = 'concluida';
      if (fConcluida === false) {
        if (fImpedimento === 'falta_peca' || fImpedimento === 'falta_ferramenta') statusOS = 'pendente_administrativo';
        else if (fImpedimento === 'tempo_insuficiente') statusOS = 'reagendar';
        else if (fImpedimento === 'problema_diferente') statusOS = 'em_revisao_tecnica';
      } else if (fNovoProblema) {
        statusOS = 'concluida_nova_os_sugerida';
      }

      // Save tarefasOS back
      await updateDoc(doc(db, CollectionName.TASKS, taskId), {
        workflowStatus: newStatus,
        status: 'completed',
        statusOS,
        tipoServico,
        ferramentasUtilizadas: ferramentas,
        tarefasOS,
        'execution.checkOut': Timestamp.now(),
        'execution.adversidades': adversidades,
        'execution.evidencias': evidencias.length > 0 ? arrayUnion(...evidencias) : [],
        checkoutOS: { feito: true, timestamp: Timestamp.now(), userId: currentUser.uid },
        finalizacaoRespostas: arrayUnion({
          perguntaId: 'foiConcluida', perguntaTexto: 'Foi possível concluir?',
          resposta: fConcluida ?? false, timestamp: Timestamp.now(),
        }),
        edicoes: arrayUnion(registrarEdicao('status', task.workflowStatus, newStatus)),
        statusHistory: arrayUnion({ status: newStatus, changedAt: Timestamp.now(), changedBy: currentUser.uid }),
        updatedAt: serverTimestamp(),
      });

      // Save asset
      if (task.ativoId) {
        try {
          await updateDoc(doc(db, CollectionName.ASSETS, task.ativoId), {
            historicoOS: arrayUnion({ osId: taskId, tipo: tipoServico, dataExecucao: Timestamp.now(), status: 'concluida' }),
          });
        } catch { /* silent */ }
      }

      setStage('done');
    } finally { setSaving(false); setShowQuestionario(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
  if (!task) return (
    <div className="text-center py-16">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
      <p className="text-gray-500">O.S. não encontrada.</p>
      <button onClick={() => navigate('/app')} className="mt-4 text-brand-600 underline text-sm">Voltar</button>
    </div>
  );

  const clientGeo = (client as any)?.geolocalizacao;

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">{task.code || taskId}</p>
          <h1 className="text-xl font-bold text-gray-900 truncate">{task.title}</h1>
        </div>
        <button onClick={() => window.open(`/app/os/${taskId}/print`, '_blank')}
          className="p-2 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50" title="Imprimir O.S.">
          <Printer className="w-4 h-4" />
        </button>
      </div>

      {/* Sprint 38 — Modo execução badge */}
      {isTecnico && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-xs text-blue-700 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span><strong>Modo execução</strong> — você pode adicionar informações a esta O.S.</span>
        </div>
      )}

      {/* ────── STAGE: CHECK-IN ────── */}
      {stage === 'checkin' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-5">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${geoStatus === 'ok' ? 'bg-emerald-100' : geoStatus === 'blocked' ? 'bg-red-100' : 'bg-gray-100'}`}>
            <Navigation className={`w-10 h-10 ${geoStatus === 'ok' ? 'text-emerald-600' : geoStatus === 'blocked' ? 'text-red-500' : 'text-gray-400'}`} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Check-in na O.S.</h2>
            {clientGeo ? (
              <p className="text-sm text-gray-500 mt-1">
                {geoStatus === 'idle'    && `Raio exigido: ${clientGeo.raioMetros ?? 200}m. Verifique sua localização.`}
                {geoStatus === 'checking' && 'Verificando localização...'}
                {geoStatus === 'ok'      && `✅ Dentro do raio! ${distancia != null ? `(${distancia}m)` : ''}. Faça o check-in.`}
                {geoStatus === 'blocked' && `🔴 Você está a ${distancia}m. Raio: ${clientGeo.raioMetros ?? 200}m.`}
              </p>
            ) : (
              <p className="text-sm text-amber-600 mt-1">⚠️ Cliente sem geolocalização cadastrada. Solicite ao gestor cadastrar no perfil do cliente.</p>
            )}
          </div>
          {clientGeo && geoStatus !== 'ok' && (
            <button onClick={checkGeo} disabled={geoStatus === 'checking'}
              className="px-6 py-3 rounded-xl bg-brand-600 text-white font-bold disabled:opacity-50 flex items-center gap-2 mx-auto">
              {geoStatus === 'checking' ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
              Verificar GPS
            </button>
          )}
          {geoStatus === 'ok' && (
            <button onClick={() => handleCheckIn(false)} disabled={saving}
              className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold flex items-center gap-2 mx-auto">
              {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Unlock className="w-5 h-5" />} Fazer Check-in
            </button>
          )}
          {isGestor && (
            <button onClick={() => handleCheckIn(true)} disabled={saving}
              className="text-xs text-gray-400 underline flex items-center gap-1 mx-auto mt-2">
              <ShieldCheck className="w-3 h-3" /> Check-in manual (bypass GPS)
            </button>
          )}
        </div>
      )}

      {/* ────── STAGE: EXECUTION ────── */}
      {stage === 'execution' && (
        <div className="space-y-5">
          {/* Sprint 43 — Tipo de serviço */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Zap className="w-4 h-4 text-brand-500" /> Tipo de Serviço
            </h2>
            <AutocompleteField label="Tipo de serviço" value={tipoServico}
              onChange={v => { setTipoServico(v); buscarTipos(v); }}
              suggestions={tipoSugestoes}
              onSelect={selecionarTipo}
              placeholder="Ex: Instalação, Manutenção..." />
          </div>

          {/* Sprint 39 — Tarefas com fotos */}
          {tarefasOS.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-brand-500" /> Tarefas
              </h2>
              {tarefasOS.map(tarefa => (
                <div key={tarefa.id} className={`border rounded-xl p-4 space-y-3 ${tarefa.status === 'concluida' ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {tarefa.status === 'concluida'
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      : <Clock className="w-5 h-5 text-gray-400 flex-shrink-0" />}
                    <span className={`text-sm font-medium ${tarefa.status === 'concluida' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{tarefa.descricao}</span>
                    {tarefa.tempoDuracaoMinutos && (
                      <span className="ml-auto text-[10px] text-gray-400">{tarefa.tempoDuracaoMinutos}min</span>
                    )}
                  </div>

                  {tarefa.status !== 'concluida' && (
                    <>
                      {/* Foto slots */}
                      <div className="space-y-2">
                        {photoSlots.map(slot => {
                          const foto = tarefa.fotos?.[slot.key];
                          const uploading = uploadingFoto === `${tarefa.id}_${slot.key}`;
                          return (
                            <div key={slot.key} className="border border-gray-100 rounded-xl p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-semibold text-gray-700 flex-1">{slot.label}
                                  {slot.required && <span className="ml-1 text-red-400">*</span>}
                                </p>
                                {foto?.url && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                              </div>
                              <p className="text-[10px] text-gray-400 italic">{slot.descricao}</p>
                              {foto?.url ? (
                                <img src={foto.url} className="w-full rounded-lg aspect-video object-cover" alt={slot.label} />
                              ) : (
                                <button onClick={() => abrirCamera(tarefa.id, slot.key)} disabled={!!uploading}
                                  className="w-full aspect-video border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-brand-300 hover:text-brand-500">
                                  {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-7 h-7" />}
                                  <span className="text-xs">{uploading ? 'Enviando...' : `Tirar: ${slot.label}`}</span>
                                </button>
                              )}
                              {foto?.url && (
                                <textarea rows={2} placeholder="Comentário sobre esta foto (opcional)..."
                                  value={foto.comentarioTecnico || ''}
                                  onChange={e => salvarComentarioFoto(tarefa.id, slot.key, e.target.value)}
                                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Tarefa actions */}
                      <div className="flex gap-2 pt-1">
                        {tarefa.status === 'pendente' && (
                          <button onClick={() => iniciarTarefa(tarefa.id)}
                            className="flex-1 py-1.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-200">
                            Iniciar tarefa
                          </button>
                        )}
                        {tarefa.status === 'em_andamento' && (
                          <button onClick={() => concluirTarefa(tarefa.id)}
                            className="flex-1 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                            <CheckSquare className="w-3.5 h-3.5 inline mr-1" /> Concluir tarefa
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              <input ref={fotoFileRef} type="file" accept="image/*" capture="environment"
                className="hidden" onChange={handleFotoUpload} />
            </div>
          )}

          {/* Sprint 43 — Ferramentas */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-orange-500" /> Ferramentas Utilizadas
            </h2>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {ferramentas.map(f => (
                <span key={f} className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
                  {f}
                  <button onClick={() => setFerramentas(p => p.filter(x => x !== f))}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
            <AutocompleteField label="" value={ferrInput}
              onChange={v => { setFerrInput(v); buscarFerramentas(v); }}
              suggestions={ferrSugestoes}
              onSelect={adicionarFerramenta}
              placeholder="Buscar ou digitar ferramenta..." />
            {ferrInput.trim() && !ferrSugestoes.includes(ferrInput.trim()) && (
              <button onClick={() => adicionarFerramenta(ferrInput)}
                className="text-xs text-brand-600 underline">
                + Adicionar "{ferrInput.trim()}"
              </button>
            )}
          </div>

          {/* Adversidades / diário */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <AlertCircle className="w-5 h-5 text-orange-500" /> Diário de Bordo
            </h2>
            <textarea rows={4} value={adversidades} onChange={e => setAdversidades(e.target.value)}
              placeholder="Descreva adversidades, materiais usados e observações..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none" />
          </div>

          {/* Evidências */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
              <Camera className="w-5 h-5 text-blue-500" /> Evidências Gerais
            </h2>
            <div className="flex flex-wrap gap-2 mb-3">
              {evidencias.map(url => (
                <div key={url} className="relative w-20 h-20">
                  <img src={url} className="w-full h-full object-cover rounded-xl border" alt="" />
                  <button onClick={() => setEvidencias(p => p.filter(u => u !== url))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400">
                {uploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />}
                <span className="text-[9px]">{uploading ? 'Enviando' : 'Adicionar'}</span>
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>

          {/* Sprint 45 — Observações */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
            <button onClick={() => setShowObs(!showObs)}
              className="w-full flex items-center justify-between">
              <span className="font-bold text-gray-900 flex items-center gap-2 text-sm">
                <MessageSquare className="w-4 h-4 text-purple-500" /> Observações ({observations.length})
              </span>
              {showObs ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>
            {showObs && (
              <div className="space-y-3">
                {observations.map(obs => {
                  const roleColor = obs.autorRole === 'admin' || obs.autorRole === 'gestor' || obs.autorRole === 'manager'
                    ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600';
                  return (
                    <div key={obs.id} className="bg-gray-50 rounded-xl p-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${roleColor}`}>
                          {obs.autorRole}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">{obs.autorNome}</span>
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {obs.criadaEm?.toDate ? obs.criadaEm.toDate().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{obs.texto}</p>
                    </div>
                  );
                })}
                <div className="flex gap-2">
                  <textarea rows={2} value={obsTexto} onChange={e => setObsTexto(e.target.value)}
                    placeholder="Adicionar observação..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
                  <button onClick={adicionarObservacao} disabled={!obsTexto.trim()}
                    className="px-3 py-2 bg-brand-600 text-white rounded-xl disabled:opacity-50">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sprint 44 — Finalizar */}
          <button onClick={() => setShowQuestionario(true)}
            className="w-full py-4 rounded-2xl text-lg font-extrabold flex items-center justify-center gap-3 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg">
            <CheckCircle2 className="w-6 h-6" /> Finalizar O.S.
          </button>
        </div>
      )}

      {/* ────── STAGE: DONE ────── */}
      {stage === 'done' && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-10 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h2 className="text-2xl font-extrabold text-gray-900">O.S. Finalizada!</h2>

          {/* Sprint 42 — Digitalização */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-3">
            <button onClick={() => setShowDigitalizacao(!showDigitalizacao)}
              className="w-full flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-orange-500" /> Documento físico assinado
              </span>
              {showDigitalizacao ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showDigitalizacao && (
              <div className="space-y-3">
                {docFotoUrl ? (
                  <img src={docFotoUrl} className="w-full rounded-lg" alt="Documento" />
                ) : (
                  <button onClick={() => docFileRef.current?.click()} disabled={analisandoDoc}
                    className="w-full aspect-video border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400">
                    {analisandoDoc ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-7 h-7" />}
                    <span className="text-xs">{analisandoDoc ? 'Analisando com IA...' : 'Fotografar O.S. assinada'}</span>
                  </button>
                )}
                <input ref={docFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDocUpload} />

                {/* Sugestões Gemini */}
                {sugestoesIA.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-gray-600">Campos identificados pelo Gemini:</p>
                    {sugestoesIA.map((s, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs border ${s.revisadoPorGestor ? (s.aplicadoNaOS ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200') : 'bg-orange-50 border-orange-200'}`}>
                        <div className="flex-1">
                          <span className="font-bold">{s.campo}:</span> {s.valorIdentificado}
                          <span className={`ml-1 text-[10px] px-1 py-0.5 rounded font-bold ${s.confianca === 'alta' ? 'text-emerald-600' : s.confianca === 'media' ? 'text-amber-600' : 'text-red-500'}`}>
                            {s.confianca}
                          </span>
                        </div>
                        {isGestor && !s.revisadoPorGestor && (
                          <div className="flex gap-1">
                            <button onClick={() => confirmarSugestao(i, true)}
                              className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">Aceitar</button>
                            <button onClick={() => confirmarSugestao(i, false)}
                              className="px-2 py-0.5 bg-gray-400 text-white rounded text-[10px] font-bold">Ignorar</button>
                          </div>
                        )}
                        {s.revisadoPorGestor && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${s.aplicadoNaOS ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.aplicadoNaOS ? '✓ Confirmado' : '✕ Ignorado'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={() => navigate('/app/pipeline')}
            className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm">
            Voltar ao Pipeline
          </button>
        </div>
      )}

      {/* ────── MODAL: Questionário ────── */}
      {showQuestionario && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-600" /> Questionário de Finalização
              </h3>
              <button onClick={() => setShowQuestionario(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {/* Q1 */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Foi possível concluir a O.S.?</p>
              <div className="flex gap-3">
                <button onClick={() => setFConcluida(true)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border ${fConcluida === true ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600'}`}>
                  ✓ Sim
                </button>
                <button onClick={() => setFConcluida(false)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border ${fConcluida === false ? 'bg-red-500 text-white border-red-500' : 'border-gray-200 text-gray-600'}`}>
                  ✕ Não
                </button>
              </div>
            </div>

            {/* Se SIM */}
            {fConcluida === true && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Foram identificados novos problemas?</p>
                  <div className="flex gap-3">
                    <button onClick={() => setFNovoProblema(true)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-bold border ${fNovoProblema ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600'}`}>
                      Sim
                    </button>
                    <button onClick={() => setFNovoProblema(false)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-bold border ${!fNovoProblema ? 'bg-gray-100 text-gray-700 border-gray-200' : 'border-gray-200 text-gray-600'}`}>
                      Não
                    </button>
                  </div>
                  {fNovoProblema && (
                    <textarea rows={2} value={fNovoProblemaDesc} onChange={e => setFNovoProblemaDesc(e.target.value)}
                      placeholder="Descreva o novo problema identificado..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Qual solução foi aplicada?</p>
                  <textarea rows={3} value={fSolucao} onChange={e => setFSolucao(e.target.value)}
                    placeholder="Descreva a solução aplicada..."
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
                </div>
              </div>
            )}

            {/* Se NÃO */}
            {fConcluida === false && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-700">O que impediu a conclusão?</p>
                {['falta_peca', 'falta_ferramenta', 'tempo_insuficiente', 'problema_diferente', 'outro'].map(imp => (
                  <label key={imp} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${fImpedimento === imp ? 'bg-brand-50 border-brand-400' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="radio" name="impedimento" value={imp} checked={fImpedimento === imp} onChange={() => setFImpedimento(imp)} className="accent-brand-600" />
                    <span className="text-sm text-gray-700">
                      {imp === 'falta_peca' && 'Falta de peça'}
                      {imp === 'falta_ferramenta' && 'Falta de ferramenta'}
                      {imp === 'tempo_insuficiente' && 'Tempo insuficiente'}
                      {imp === 'problema_diferente' && 'Problema diferente do descrito'}
                      {imp === 'outro' && 'Outro motivo'}
                    </span>
                  </label>
                ))}
              </div>
            )}

            {/* Confirm */}
            {fConcluida !== null && (
              <button onClick={finalizarOS} disabled={saving || (fConcluida === false && !fImpedimento)}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                Confirmar Finalização
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OSExecution;

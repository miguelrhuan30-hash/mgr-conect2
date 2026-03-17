/**
 * components/OSExecution.tsx — Sprint 32
 * Execução de Campo com Geofencing, Diário de Bordo e Upload de Evidências.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    doc, getDoc, updateDoc, serverTimestamp, arrayUnion, Timestamp, collection, getDocs, query, where
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task, Client, CollectionName, WorkflowStatus as WS } from '../types';
import {
    MapPin, CheckCircle2, AlertCircle, Camera, Loader2, X, ArrowLeft,
    CheckSquare, Square, ClipboardList, Upload, Lock, Unlock, Navigation
} from 'lucide-react';

// ── Haversine distance (metres) ─────────────────────────────────────────────
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R  = 6371000;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Stage type ──────────────────────────────────────────────────────────────
type Stage = 'geo' | 'execution' | 'done';

// ── OSExecution ─────────────────────────────────────────────────────────────
const OSExecution: React.FC = () => {
    const { taskId }                 = useParams<{ taskId: string }>();
    const navigate                   = useNavigate();
    const { currentUser, userProfile } = useAuth();

    const [task,    setTask]    = useState<Task | null>(null);
    const [client,  setClient]  = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [stage,   setStage]   = useState<Stage>('geo');
    const [saving,  setSaving]  = useState(false);

    // Geo state
    const [geoStatus, setGeoStatus] = useState<'idle' | 'checking' | 'ok' | 'blocked'>('idle');
    const [distance,  setDistance]  = useState<number | null>(null);

    // Execution state
    const [checklist,    setChecklist]    = useState<{ id: string; text: string; done: boolean }[]>([]);
    const [adversidades, setAdversidades] = useState('');
    const [evidencias,   setEvidencias]   = useState<string[]>([]);
    const [uploading,    setUploading]    = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── Load task ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!taskId) return;
        (async () => {
            const snap = await getDoc(doc(db, CollectionName.TASKS, taskId));
            if (!snap.exists()) { setLoading(false); return; }
            const t = { id: snap.id, ...snap.data() } as Task;
            setTask(t);
            setChecklist((t.checklist || []).map(c => ({ ...c, done: false })));

            if (t.clientId) {
                const cSnap = await getDoc(doc(db, CollectionName.CLIENTS, t.clientId));
                if (cSnap.exists()) setClient({ id: cSnap.id, ...cSnap.data() } as Client);
            }
            setLoading(false);
        })();
    }, [taskId]);

    // ── Geolocation check ───────────────────────────────────────────────────
    const checkGeo = () => {
        setGeoStatus('checking');
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                const clientGeo = (client as any)?.geo;
                if (!clientGeo?.lat || !clientGeo?.lng) {
                    setGeoStatus('ok'); // No geo set — allow entry anyway
                    return;
                }
                const dist = haversine(latitude, longitude, clientGeo.lat, clientGeo.lng);
                setDistance(Math.round(dist));
                setGeoStatus(dist <= 100 ? 'ok' : 'blocked');
            },
            () => setGeoStatus('blocked')
        );
    };

    // ── Check-in ────────────────────────────────────────────────────────────
    const handleCheckIn = async () => {
        if (!task || !taskId || !currentUser) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, CollectionName.TASKS, taskId), {
                workflowStatus: WS.EM_EXECUCAO,
                status: 'in-progress',
                'execution.checkIn': Timestamp.now(),
                'geofencing.validated': true,
                statusHistory: arrayUnion({
                    status: WS.EM_EXECUCAO,
                    changedAt: Timestamp.now(),
                    changedBy: currentUser.uid,
                }),
                updatedAt: serverTimestamp(),
            });
            setStage('execution');
        } finally { setSaving(false); }
    };

    // ── Photo upload ─────────────────────────────────────────────────────────
    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !taskId || !currentUser) return;
        setUploading(true);
        try {
            const path = `evidencias/${taskId}/${Date.now()}_${currentUser.uid}.jpg`;
            const snap = await uploadBytes(storageRef(storage, path), file);
            const url  = await getDownloadURL(snap.ref);
            setEvidencias(p => [...p, url]);
        } finally { setUploading(false); }
    };

    const removePhoto = (url: string) => setEvidencias(p => p.filter(u => u !== url));

    // ── Finalize ─────────────────────────────────────────────────────────────
    const canFinish = adversidades.trim().length > 0 && evidencias.length > 0;

    const handleFinalize = async () => {
        if (!canFinish || !task || !taskId || !currentUser) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, CollectionName.TASKS, taskId), {
                workflowStatus: WS.AGUARDANDO_FATURAMENTO,
                status: 'completed',
                'execution.checkOut': Timestamp.now(),
                'execution.adversidades': adversidades,
                'execution.evidencias': arrayUnion(...evidencias),
                statusHistory: arrayUnion({
                    status: WS.AGUARDANDO_FATURAMENTO,
                    changedAt: Timestamp.now(),
                    changedBy: currentUser.uid,
                }),
                updatedAt: serverTimestamp(),
            });

            // Append to ClientAsset.historicoOS if assetId set
            if (task.assetId) {
                await updateDoc(doc(db, CollectionName.ASSETS, task.assetId), {
                    historicoOS: arrayUnion(taskId),
                });
            }

            setStage('done');
        } finally { setSaving(false); }
    };

    const toggleChecklist = (id: string) =>
        setChecklist(p => p.map(c => c.id === id ? { ...c, done: !c.done } : c));

    // ── Render ──────────────────────────────────────────────────────────────
    if (loading) return (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
    );
    if (!task) return (
        <div className="text-center py-16">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <p className="text-gray-500">O.S. não encontrada.</p>
            <button onClick={() => navigate('/app')} className="mt-4 text-brand-600 underline text-sm">Voltar</button>
        </div>
    );

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-12">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-700">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <p className="text-xs text-gray-400">{task.code || taskId}</p>
                    <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
                </div>
            </div>

            {/* ──── STAGE 1: Geofencing ──── */}
            {stage === 'geo' && (
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center space-y-5">
                    <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
                        geoStatus === 'ok'      ? 'bg-emerald-100' :
                        geoStatus === 'blocked' ? 'bg-red-100'     : 'bg-gray-100'}`}>
                        <Navigation className={`w-10 h-10 ${
                            geoStatus === 'ok'      ? 'text-emerald-600' :
                            geoStatus === 'blocked' ? 'text-red-500'     : 'text-gray-400'}`} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Verificação de Localização</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            {geoStatus === 'idle'    && 'Clique para verificar se você está dentro do raio de 100m do cliente.'}
                            {geoStatus === 'checking'&& 'Verificando localização...'}
                            {geoStatus === 'ok'      && `✅ Localização validada! ${distance != null ? `(${distance}m)` : ''}. Pode iniciar.`}
                            {geoStatus === 'blocked' && `🔴 Fora do raio permitido. ${distance != null ? `Distância: ${distance}m.` : ''} Aproxime-se do local.`}
                        </p>
                    </div>
                    {geoStatus !== 'ok' && (
                        <button onClick={checkGeo} disabled={geoStatus === 'checking'}
                            className="px-6 py-3 rounded-xl bg-brand-600 text-white font-bold disabled:opacity-50 flex items-center gap-2 mx-auto">
                            {geoStatus === 'checking' ? <Loader2 className="animate-spin w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                            Verificar GPS
                        </button>
                    )}
                    {geoStatus === 'ok' && (
                        <button onClick={handleCheckIn} disabled={saving}
                            className="px-8 py-3 rounded-xl bg-emerald-600 text-white font-bold animate-pulse flex items-center gap-2 mx-auto">
                            {saving ? <Loader2 className="animate-spin w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                            Iniciar O.S.
                        </button>
                    )}
                    {geoStatus === 'blocked' && (
                        <div className="flex items-center gap-2 text-red-600 text-sm justify-center">
                            <Lock className="w-4 h-4" /> Botão bloqueado fora do raio
                        </div>
                    )}
                </div>
            )}

            {/* ──── STAGE 2: Execution Journal ──── */}
            {stage === 'execution' && (
                <div className="space-y-5">
                    {/* Checklist */}
                    {checklist.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                                <ClipboardList className="w-5 h-5 text-brand-500" /> Checklist
                            </h2>
                            <div className="space-y-2">
                                {checklist.map(item => (
                                    <button key={item.id} onClick={() => toggleChecklist(item.id)}
                                        className="w-full flex items-center gap-3 text-left py-2 px-3 rounded-lg hover:bg-gray-50">
                                        {item.done
                                            ? <CheckSquare className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                            : <Square className="w-5 h-5 text-gray-300 flex-shrink-0" />}
                                        <span className={`text-sm ${item.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                            {item.text}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Adversidades */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-orange-500" /> Diário de Bordo *
                        </h2>
                        <p className="text-xs text-gray-400 mb-2">Descreva adversidades, materiais usados e observações de campo.</p>
                        <textarea rows={5} value={adversidades} onChange={e => setAdversidades(e.target.value)}
                            placeholder="Ex: Encontrado vazamento no compressor. Substituído conforme manual..."
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-brand-300" />
                        {adversidades.trim().length === 0 && (
                            <p className="text-[10px] text-red-400 mt-1">* Campo obrigatório para finalizar</p>
                        )}
                    </div>

                    {/* Evidence photos */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-3">
                            <Camera className="w-5 h-5 text-blue-500" /> Evidências Antes/Depois *
                        </h2>
                        <div className="flex flex-wrap gap-2 mb-3">
                            {evidencias.map(url => (
                                <div key={url} className="relative w-24 h-24">
                                    <img src={url} className="w-full h-full object-cover rounded-xl border" alt="" />
                                    <button onClick={() => removePhoto(url)}
                                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 rounded-full text-white flex items-center justify-center">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button onClick={() => fileRef.current?.click()} disabled={uploading}
                                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-brand-300 hover:text-brand-500">
                                {uploading ? <Loader2 className="animate-spin w-5 h-5" /> : <Upload className="w-5 h-5" />}
                                <span className="text-[9px]">{uploading ? 'Enviando' : 'Adicionar'}</span>
                            </button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                        {evidencias.length === 0 && (
                            <p className="text-[10px] text-red-400">* Mínimo 1 foto obrigatória</p>
                        )}
                    </div>

                    {/* Finalize button */}
                    <button onClick={handleFinalize} disabled={!canFinish || saving}
                        className={`w-full py-4 rounded-2xl text-lg font-extrabold flex items-center justify-center gap-3 transition-all ${
                            canFinish ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg' :
                            'bg-gray-100 text-gray-400 cursor-not-allowed'}`}>
                        {saving ? <Loader2 className="animate-spin w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                        Finalizar O.S.
                    </button>
                    {!canFinish && (
                        <p className="text-center text-xs text-gray-400">Preencha o diário e adicione ao menos 1 foto para finalizar.</p>
                    )}
                </div>
            )}

            {/* ──── STAGE 3: Done ──── */}
            {stage === 'done' && (
                <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-10 text-center space-y-4">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
                    <h2 className="text-2xl font-extrabold text-gray-900">O.S. Finalizada!</h2>
                    <p className="text-gray-500 text-sm">Enviada para <strong>Aguardando Faturamento</strong>. O administrativo irá proceder com o faturamento.</p>
                    <button onClick={() => navigate('/app/tarefas')}
                        className="px-6 py-2.5 rounded-xl bg-brand-600 text-white font-bold text-sm">
                        Voltar para Tarefas
                    </button>
                </div>
            )}
        </div>
    );
};

export default OSExecution;

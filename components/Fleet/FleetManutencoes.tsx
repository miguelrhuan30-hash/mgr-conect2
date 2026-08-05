/**
 * components/Fleet/FleetManutencoes.tsx
 * Fluxo de manutenção de um veículo de frota — Fase 1 do subsistema
 * multi-tenant de manutenção. Solicitação (relatar necessidade) → conversão
 * em manutenção formal (define prestador) → finalização (fleetFinalizarManutencao).
 *
 * Gate de cobertura de contrato: se o veículo TEM contrato ativo
 * (vehicle.contratoId), o auto-registro fica bloqueado — só resta abrir um
 * Chamado (vira O.S. da MGR). Sem contrato (avulso), o cliente registra o
 * ciclo completo ele mesmo, inclusive custo.
 *
 * Usado só no Portal do Cliente — clientId sempre fixo (useAuth).
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, serverTimestamp, getDoc, Timestamp,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { db, storage, functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, FleetVehicle, FleetProvider, FleetMaintenanceRequest, FleetMaintenance } from '../../types';
import {
    Wrench, Loader2, X, Camera, AlertTriangle, FileSignature, ArrowLeft,
    CheckCircle2, Clock, ChevronDown, ChevronUp, Truck, Send,
} from 'lucide-react';

const STATUS_MAINT: Record<string, { label: string; color: string }> = {
    aberta:       { label: 'Aberta',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
    em_andamento: { label: 'Em Andamento',  color: 'bg-sky-100 text-sky-700 border-sky-200' },
    concluida:    { label: 'Concluída',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

// ── Modal: relatar necessidade ──────────────────────────────────────────
const RelatarNecessidadeModal: React.FC<{ vehicle: FleetVehicle; onClose: () => void }> = ({ vehicle, onClose }) => {
    const { userProfile } = useAuth();
    const [problema, setProblema] = useState('');
    const [km, setKm] = useState(String(vehicle.kmAtual || ''));
    const [fotos, setFotos] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const path = `fleet_maintenance_requests/${vehicle.clientId}/${vehicle.id}/${Date.now()}_${file.name}`;
            const snap = await uploadBytes(ref(storage, path), file);
            const url = await getDownloadURL(snap.ref);
            setFotos(prev => [...prev, url]);
        } finally { setUploading(false); }
    };

    const handleSubmit = async () => {
        if (!problema.trim()) { alert('Descreva o problema.'); return; }
        setSaving(true);
        try {
            await addDoc(collection(db, CollectionName.FLEET_MAINTENANCE_REQUESTS), {
                clientId: vehicle.clientId,
                clientName: vehicle.clientName,
                vehicleId: vehicle.id,
                vehiclePlaca: vehicle.placa,
                problemaRelatado: problema.trim(),
                fotos,
                abertoPorUid: userProfile?.uid,
                abertoPorNome: userProfile?.nomeCompleto || userProfile?.displayName || '',
                abertoPorClientRole: (userProfile as any)?.clientRole || 'equipe_producao',
                kmNoMomento: parseInt(km, 10) || 0,
                status: 'pendente',
                createdAt: serverTimestamp(),
            });
            onClose();
        } catch {
            alert('Erro ao relatar a necessidade.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
                    <h2 className="font-bold text-gray-900">Relatar Necessidade — {vehicle.placa}</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">O que está acontecendo?</label>
                        <textarea value={problema} onChange={e => setProblema(e.target.value)} rows={3}
                            placeholder="Descreva o problema com o máximo de detalhes possível"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">KM atual</label>
                        <input type="number" value={km} onChange={e => setKm(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Fotos (opcional)</label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {fotos.map((url, i) => (
                                <img key={i} src={url} className="w-14 h-14 object-cover rounded-lg border" alt="evidência" />
                            ))}
                            <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer text-gray-400 hover:border-brand-300 hover:text-brand-500">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                <input type="file" accept="image/*" capture="environment" onChange={handleUpload} disabled={uploading} className="hidden" />
                            </label>
                        </div>
                    </div>
                    <button onClick={handleSubmit} disabled={saving}
                        className="w-full py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        Enviar Solicitação
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Modal: finalizar manutenção ─────────────────────────────────────────
const FinalizarModal: React.FC<{
    maintenance: FleetMaintenance; vehicle: FleetVehicle; providers: FleetProvider[]; onClose: () => void;
}> = ({ maintenance, vehicle, providers, onClose }) => {
    const [providerId, setProviderId] = useState(maintenance.providerId || '');
    const [servicos, setServicos] = useState('');
    const [pecas, setPecas] = useState('');
    const [custo, setCusto] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [fotos, setFotos] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [erro, setErro] = useState('');
    const aceitaCusto = !vehicle.contratoId;

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const path = `fleet_maintenances/${vehicle.clientId}/${maintenance.id}/${Date.now()}_${file.name}`;
            const snap = await uploadBytes(ref(storage, path), file);
            const url = await getDownloadURL(snap.ref);
            setFotos(prev => [...prev, url]);
        } finally { setUploading(false); }
    };

    const handleSubmit = async () => {
        setErro('');
        const provider = providers.find(p => p.id === providerId);
        if (!provider) { setErro('Selecione o prestador que realizou o serviço.'); return; }
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'fleetFinalizarManutencao');
            await fn({
                maintenanceId: maintenance.id,
                providerId: provider.id,
                providerNome: provider.nome,
                servicosRealizados: servicos.split('\n').map(s => s.trim()).filter(Boolean).map((descricao, i) => ({ id: `s${i}`, descricao })),
                pecasUtilizadas: pecas.split('\n').map(s => s.trim()).filter(Boolean).map((descricao, i) => ({ id: `p${i}`, descricao })),
                fotosFinalizacao: fotos,
                observacoesFinais: observacoes.trim() || undefined,
                ...(aceitaCusto && custo ? { custo: parseFloat(custo) } : {}),
            });
            onClose();
        } catch (e: any) {
            setErro(e?.message?.replace('FirebaseError: ', '').replace('functions/', '') || 'Erro ao finalizar a manutenção.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
                    <h2 className="font-bold text-gray-900">Finalizar Manutenção — {vehicle.placa}</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Prestador</label>
                        <select value={providerId} onChange={e => setProviderId(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                            <option value="">Selecione...</option>
                            {providers.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                        </select>
                        {providers.length === 0 && (
                            <p className="text-[10px] text-amber-600 mt-1">Cadastre um prestador antes de finalizar.</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Serviços realizados (um por linha)</label>
                        <textarea value={servicos} onChange={e => setServicos(e.target.value)} rows={3}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Peças utilizadas (uma por linha)</label>
                        <textarea value={pecas} onChange={e => setPecas(e.target.value)} rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
                    </div>
                    {aceitaCusto && (
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Custo (R$)</label>
                            <input type="number" step="0.01" value={custo} onChange={e => setCusto(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Observações finais</label>
                        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Fotos da finalização</label>
                        <div className="flex items-center gap-2 flex-wrap">
                            {fotos.map((url, i) => (
                                <img key={i} src={url} className="w-14 h-14 object-cover rounded-lg border" alt="finalização" />
                            ))}
                            <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center cursor-pointer text-gray-400 hover:border-brand-300 hover:text-brand-500">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                <input type="file" accept="image/*" capture="environment" onChange={handleUpload} disabled={uploading} className="hidden" />
                            </label>
                        </div>
                    </div>
                    {erro && (
                        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {erro}
                        </div>
                    )}
                    <button onClick={handleSubmit} disabled={saving}
                        className="w-full py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Finalizar Manutenção
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────
export default function FleetManutencoes() {
    const { userProfile } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const clientId = (userProfile as any)?.clientId as string | undefined;
    const clientRole = (userProfile as any)?.clientRole || 'equipe_producao';
    const clientPermissions = (userProfile as any)?.clientPermissions || {};
    const vehicleIds: string[] = (userProfile as any)?.vehicleIds || [];

    const [vehicles, setVehicles] = useState<FleetVehicle[] | null>(null);
    const vehicleId = searchParams.get('vehicleId') || '';
    const [vehicle, setVehicle] = useState<FleetVehicle | null>(null);

    const [requests, setRequests] = useState<FleetMaintenanceRequest[]>([]);
    const [maintenances, setMaintenances] = useState<FleetMaintenance[]>([]);
    const [providers, setProviders] = useState<FleetProvider[]>([]);

    const [showRelatar, setShowRelatar] = useState(false);
    const [finalizando, setFinalizando] = useState<FleetMaintenance | null>(null);
    const [convertendo, setConvertendo] = useState<string | null>(null);
    const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);

    useEffect(() => {
        if (!clientId) return;
        const q = query(collection(db, CollectionName.FLEET_VEHICLES), where('clientId', '==', clientId));
        return onSnapshot(q, snap => setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetVehicle))), () => setVehicles([]));
    }, [clientId]);

    useEffect(() => {
        if (!vehicleId) { setVehicle(null); return; }
        getDoc(doc(db, CollectionName.FLEET_VEHICLES, vehicleId))
            .then(snap => setVehicle(snap.exists() ? ({ id: snap.id, ...snap.data() } as FleetVehicle) : null))
            .catch(() => setVehicle(null));
    }, [vehicleId]);

    useEffect(() => {
        if (!clientId || !vehicleId) { setRequests([]); setMaintenances([]); return; }
        const unsub1 = onSnapshot(
            query(collection(db, CollectionName.FLEET_MAINTENANCE_REQUESTS), where('clientId', '==', clientId), where('vehicleId', '==', vehicleId)),
            snap => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetMaintenanceRequest))), () => {});
        const unsub2 = onSnapshot(
            query(collection(db, CollectionName.FLEET_MAINTENANCES), where('clientId', '==', clientId), where('vehicleId', '==', vehicleId)),
            snap => setMaintenances(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetMaintenance))), () => {});
        return () => { unsub1(); unsub2(); };
    }, [clientId, vehicleId]);

    useEffect(() => {
        if (!clientId) return;
        return onSnapshot(
            query(collection(db, CollectionName.FLEET_PROVIDERS), where('clientId', '==', clientId), where('status', '==', 'ativo')),
            snap => setProviders(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetProvider))), () => {});
    }, [clientId]);

    const podeConverter = clientRole === 'admin_mestre' || clientPermissions.fleetAbrirManutencaoFormal === true;
    const vehiclesVisiveis = clientRole === 'motorista' ? (vehicles || []).filter(v => vehicleIds.includes(v.id)) : (vehicles || []);

    const handleConverter = async (req: FleetMaintenanceRequest) => {
        if (!vehicle) return;
        setConvertendo(req.id);
        try {
            const maintRef = await addDoc(collection(db, CollectionName.FLEET_MAINTENANCES), {
                clientId: vehicle.clientId,
                clientName: vehicle.clientName,
                vehicleId: vehicle.id,
                vehiclePlaca: vehicle.placa,
                requestId: req.id,
                problemaRelatado: req.problemaRelatado,
                tipo: 'corretiva',
                fotosAbertura: req.fotos || [],
                servicosRealizados: [],
                pecasUtilizadas: [],
                abertoPorUid: userProfile?.uid,
                abertoPorNome: userProfile?.nomeCompleto || userProfile?.displayName || '',
                createdAt: serverTimestamp(),
                status: 'aberta',
            });
            await updateDoc(doc(db, CollectionName.FLEET_MAINTENANCE_REQUESTS, req.id), {
                status: 'convertida', maintenanceId: maintRef.id, updatedAt: serverTimestamp(),
            });
            await updateDoc(doc(db, CollectionName.FLEET_VEHICLES, vehicle.id), { status: 'manutencao', updatedAt: serverTimestamp() });
        } catch {
            alert('Erro ao converter em manutenção formal.');
        } finally {
            setConvertendo(null);
        }
    };

    if (!vehicleId) {
        return (
            <div className="space-y-4">
                <button onClick={() => navigate('/portal/frota/veiculos')} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="w-3.5 h-3.5" /> Voltar
                </button>
                <h1 className="text-lg font-extrabold text-gray-900 flex items-center gap-2"><Wrench className="w-5 h-5 text-brand-600" /> Manutenção</h1>
                <p className="text-sm text-gray-500">Selecione o veículo pra ver ou registrar manutenção.</p>
                {vehicles === null ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>
                ) : vehiclesVisiveis.length === 0 ? (
                    <p className="text-sm text-gray-400">Nenhum veículo disponível.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {vehiclesVisiveis.map(v => (
                            <button key={v.id} onClick={() => setSearchParams({ vehicleId: v.id })}
                                className="text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-brand-300 hover:shadow-md transition-all flex items-center gap-3">
                                <Truck className="w-8 h-8 text-gray-300 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-gray-900">{v.placa}</p>
                                    <p className="text-xs text-gray-400">{v.marca} · {v.modelo}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    if (!vehicle) {
        return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>;
    }

    const requestsPendentes = requests.filter(r => r.status === 'pendente');
    const maintenancesAbertas = maintenances.filter(m => m.status !== 'concluida');
    const maintenancesConcluidas = maintenances.filter(m => m.status === 'concluida');

    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <button onClick={() => setSearchParams({})} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600">
                <ArrowLeft className="w-3.5 h-3.5" /> Trocar veículo
            </button>

            <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold text-gray-400">{vehicle.marca} · {vehicle.modelo}</p>
                    <h1 className="text-lg font-extrabold text-gray-900">{vehicle.placa}</h1>
                </div>
                {vehicle.contratoId ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                        <FileSignature className="w-3 h-3" /> Coberto — {vehicle.contratoIdentificador || 'Contrato'}
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                        <FileSignature className="w-3 h-3" /> Avulso
                    </span>
                )}
            </div>

            {vehicle.contratoId ? (
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                    <p className="text-sm text-sky-800 font-bold mb-1">Veículo coberto por contrato</p>
                    <p className="text-xs text-sky-700 mb-3">Esse veículo já tem contrato de manutenção com a MGR — o registro de necessidade vira Chamado, que se torna O.S. automaticamente.</p>
                    <button onClick={() => navigate(`/portal/novo?veiculoId=${vehicle.id}`)}
                        className="w-full py-2.5 bg-sky-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                        <Send className="w-4 h-4" /> Abrir Chamado
                    </button>
                </div>
            ) : (
                <div className="space-y-2">
                    {/* Chamado é sempre permitido, com ou sem contrato — é o alerta rápido pra
                        MGR/Admin Mestre ver a necessidade. Pro motorista, "Relatar Necessidade"
                        é a mesma coisa que Abrir Chamado na prática (mesmo resultado: fica
                        visível pro gestor levar o veículo pra manutenção) — então some o botão
                        duplicado e sobra só Abrir Chamado. Outros papéis do Portal mantêm as
                        duas opções, já que "Relatar Necessidade" tem o fluxo mais longo de
                        auto-registro (km, fotos) que fica com quem gerencia a frota. */}
                    <button onClick={() => navigate(`/portal/novo?veiculoId=${vehicle.id}`)}
                        className="w-full py-2.5 bg-sky-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                        <Send className="w-4 h-4" /> Abrir Chamado
                    </button>
                    {clientRole !== 'motorista' && (
                        <button onClick={() => setShowRelatar(true)}
                            className="w-full py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2">
                            <Wrench className="w-4 h-4" /> Relatar Necessidade de Manutenção
                        </button>
                    )}
                </div>
            )}

            {requestsPendentes.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Solicitações pendentes</p>
                    {requestsPendentes.map(r => (
                        <div key={r.id} className="bg-white rounded-xl border border-amber-200 p-3">
                            <div className="flex items-start justify-between gap-2">
                                <div>
                                    <p className="text-sm text-gray-800">{r.problemaRelatado}</p>
                                    <p className="text-[10px] text-gray-400 mt-1">{r.abertoPorNome} · KM {r.kmNoMomento?.toLocaleString('pt-BR')}</p>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-100 text-amber-700 border-amber-200 flex-shrink-0">Pendente</span>
                            </div>
                            {podeConverter && !vehicle.contratoId && (
                                <button onClick={() => handleConverter(r)} disabled={convertendo === r.id}
                                    className="mt-2 w-full py-1.5 text-xs font-bold rounded-lg border border-brand-200 text-brand-700 hover:bg-brand-50 disabled:opacity-50 flex items-center justify-center gap-1.5">
                                    {convertendo === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />}
                                    Converter em Manutenção Formal
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {maintenancesAbertas.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Em andamento</p>
                    {maintenancesAbertas.map(m => {
                        const podeFinalizar = m.abertoPorUid === userProfile?.uid || clientRole === 'admin_mestre';
                        const sc = STATUS_MAINT[m.status] || STATUS_MAINT.aberta;
                        return (
                            <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3">
                                <div className="flex items-start justify-between gap-2">
                                    <p className="text-sm text-gray-800">{m.problemaRelatado}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>{sc.label}</span>
                                </div>
                                {podeFinalizar && (
                                    <button onClick={() => setFinalizando(m)}
                                        className="mt-2 w-full py-1.5 text-xs font-bold rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center justify-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {maintenancesConcluidas.length > 0 && (
                <div className="space-y-2">
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Histórico</p>
                    {maintenancesConcluidas.map(m => {
                        const aberto = historicoAberto === m.id;
                        const dataRef = (m.finalizadoEm || m.createdAt) as Timestamp | undefined;
                        const fotos = [...(m.fotosAbertura || []), ...(m.fotosFinalizacao || [])];
                        return (
                            <div key={m.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <button onClick={() => setHistoricoAberto(aberto ? null : m.id)}
                                    className="w-full text-left p-3 hover:bg-gray-50">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <p className="text-sm font-bold text-gray-800">{m.providerNome || 'Manutenção'}</p>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200">Concluída</span>
                                            {aberto ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                        </div>
                                    </div>
                                    {dataRef && (
                                        <p className="text-[10px] text-gray-400 mb-1">{format(dataRef.toDate(), "dd/MM/yyyy", { locale: ptBR })}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mb-1">{m.problemaRelatado}</p>
                                    {!aberto && m.servicosRealizados?.length > 0 && (
                                        <p className="text-[11px] text-gray-400">Serviços: {m.servicosRealizados.map(s => s.descricao).join(', ')}</p>
                                    )}
                                    {!aberto && typeof m.custo === 'number' && (
                                        <p className="text-[11px] text-gray-500 font-bold mt-1">Custo: R$ {m.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                    )}
                                </button>
                                {aberto && (
                                    <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2.5">
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Tipo</p>
                                            <p className="text-xs text-gray-700">{m.tipo === 'preventiva' ? 'Preventiva' : 'Corretiva'}</p>
                                        </div>
                                        {m.servicosRealizados?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Serviços realizados</p>
                                                <ul className="text-xs text-gray-700 list-disc list-inside space-y-0.5">
                                                    {m.servicosRealizados.map(s => <li key={s.id}>{s.descricao}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {m.pecasUtilizadas?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Peças utilizadas</p>
                                                <ul className="text-xs text-gray-700 list-disc list-inside space-y-0.5">
                                                    {m.pecasUtilizadas.map(p => <li key={p.id}>{p.descricao}{p.quantidade ? ` (${p.quantidade}x)` : ''}</li>)}
                                                </ul>
                                            </div>
                                        )}
                                        {typeof m.custo === 'number' && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Custo</p>
                                                <p className="text-xs text-gray-700 font-bold">R$ {m.custo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        )}
                                        {m.observacoesFinais && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Observações</p>
                                                <p className="text-xs text-gray-700">{m.observacoesFinais}</p>
                                            </div>
                                        )}
                                        {fotos.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Fotos</p>
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {fotos.map((url, i) => (
                                                        <a key={i} href={url} target="_blank" rel="noreferrer">
                                                            <img src={url} alt="evidência" className="w-14 h-14 object-cover rounded border hover:opacity-80" />
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {(m.abertoPorNome || m.finalizadoPorNome) && (
                                            <div>
                                                <p className="text-[10px] font-bold text-gray-400 uppercase mb-0.5">Registrado por</p>
                                                <p className="text-xs text-gray-700">{m.finalizadoPorNome || m.abertoPorNome}</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {requestsPendentes.length === 0 && maintenances.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <Clock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Nenhuma manutenção registrada pra este veículo ainda.</p>
                </div>
            )}

            {showRelatar && <RelatarNecessidadeModal vehicle={vehicle} onClose={() => setShowRelatar(false)} />}
            {finalizando && (
                <FinalizarModal maintenance={finalizando} vehicle={vehicle} providers={providers}
                    onClose={() => setFinalizando(null)} />
            )}
        </div>
    );
}

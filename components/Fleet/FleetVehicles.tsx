/**
 * components/Fleet/FleetVehicles.tsx
 * Cadastro de veículos de frota de cliente — Fase 1 do subsistema
 * multi-tenant de manutenção (vault: 04-erp-mgrconnect/
 * 2026-08-03_doc-tecnica_subsistema-manutencao-multitenant-frota.md).
 * Componente único, mesmo padrão de components/Assets.tsx: staff usa sem
 * clientId (módulo global, seletor de cliente), Portal usa com clientId
 * fixo + modoPortal (cadastro gated por clientRole/clientPermissions,
 * lista filtrada por vehicleIds quando o usuário é motorista).
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, serverTimestamp, orderBy, getDocs,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import {
    CollectionName, FleetVehicle, FleetVehicleTipo, FleetCarroceriaTipo, Client, ContratoSLA,
} from '../../types';
import {
    Truck, Plus, Loader2, X, Save, Camera, Building2, AlertTriangle, FileSignature, Search, Wrench,
} from 'lucide-react';

const TIPOS_VEICULO: { value: FleetVehicleTipo; label: string }[] = [
    { value: 'toco', label: 'Toco' },
    { value: 'truck', label: 'Truck' },
    { value: 'camionete', label: 'Camionete' },
    { value: 'carreta', label: 'Carreta' },
    { value: 'utilitario', label: 'Utilitário' },
    { value: 'outro', label: 'Outro' },
];
const CARROCERIAS: { value: FleetCarroceriaTipo; label: string }[] = [
    { value: 'bau', label: 'Baú' },
    { value: 'refrigerado', label: 'Refrigerado' },
    { value: 'aberta', label: 'Aberta' },
    { value: 'sider', label: 'Sider' },
    { value: 'tanque', label: 'Tanque' },
    { value: 'outro', label: 'Outro' },
];
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    ativo:      { label: 'Ativo',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    manutencao: { label: 'Em Manutenção', color: 'bg-amber-100 text-amber-700 border-amber-200' },
    inativo:    { label: 'Inativo',       color: 'bg-gray-100 text-gray-500 border-gray-200' },
};

// ── Form Modal ────────────────────────────────────────────────────────────
interface VehicleFormProps {
    clientId: string;
    clientName?: string;
    clientes: Client[];
    clienteTravado?: boolean;
    /** Vínculo com contrato é decisão exclusiva da MGR — nunca do cliente, nem
     *  mesmo Admin Mestre (ver firestore.rules). false no Portal, sempre true no staff. */
    podeDefinirContrato: boolean;
    initial?: FleetVehicle | null;
    onClose: () => void;
}
const VehicleForm: React.FC<VehicleFormProps> = ({ clientId, clientName, clientes, clienteTravado, podeDefinirContrato, initial, onClose }) => {
    const { userProfile } = useAuth();
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        clientId:       initial?.clientId    || clientId,
        placa:          initial?.placa       || '',
        modelo:         initial?.modelo      || '',
        marca:          initial?.marca       || '',
        tipo:           initial?.tipo        || TIPOS_VEICULO[0].value,
        tipoCarroceria: initial?.tipoCarroceria || CARROCERIAS[0].value,
        equipRefMarca:  initial?.equipamentoRefrigeracao?.marca  || '',
        equipRefModelo: initial?.equipamentoRefrigeracao?.modelo || '',
        ano:            initial?.ano ? String(initial.ano) : '',
        status:         initial?.status || 'ativo' as FleetVehicle['status'],
        contratoId:     initial?.contratoId || '',
        observacoes:    initial?.observacoes || '',
        fotoUrl:        initial?.fotoUrl || '',
    });
    const [contratos, setContratos] = useState<ContratoSLA[]>([]);

    useEffect(() => {
        if (!form.clientId || !podeDefinirContrato) { setContratos([]); return; }
        getDocs(query(collection(db, CollectionName.CONTRATOS_SLA), where('clientId', '==', form.clientId), where('status', '==', 'ativo')))
            .then(snap => setContratos(snap.docs.map(d => ({ id: d.id, ...d.data() } as ContratoSLA))))
            .catch(() => setContratos([]));
    }, [form.clientId, podeDefinirContrato]);

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !form.clientId) return;
        setUploading(true);
        try {
            const path = `fleet_vehicles/${form.clientId}/${initial?.id || 'new'}/${Date.now()}_${file.name}`;
            const snap = await uploadBytes(ref(storage, path), file);
            const url = await getDownloadURL(snap.ref);
            setForm(p => ({ ...p, fotoUrl: url }));
        } finally { setUploading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientId) { alert('Selecione um cliente.'); return; }
        if (!form.placa.trim() || !form.modelo.trim() || !form.marca.trim()) { alert('Preencha placa, marca e modelo.'); return; }
        setSaving(true);
        try {
            const nomeCliente = (clienteTravado && clientName) || clientes.find(c => c.id === form.clientId)?.name || '';
            const payload: any = {
                clientId: form.clientId,
                clientName: nomeCliente,
                placa: form.placa.trim().toUpperCase(),
                modelo: form.modelo.trim(),
                marca: form.marca.trim(),
                tipo: form.tipo,
                tipoCarroceria: form.tipoCarroceria,
                status: form.status,
                observacoes: form.observacoes.trim() || null,
                fotoUrl: form.fotoUrl || null,
                updatedAt: serverTimestamp(),
            };
            // Vínculo com contrato é exclusivo da MGR — o Portal nem envia esses
            // campos (regra do Firestore rejeita a escrita se vierem do cliente).
            if (podeDefinirContrato) {
                const contratoEscolhido = contratos.find(c => c.id === form.contratoId);
                payload.contratoId = form.contratoId || null;
                payload.contratoIdentificador = contratoEscolhido?.identificador || null;
            }
            payload.equipamentoRefrigeracao = form.tipoCarroceria === 'refrigerado'
                ? { marca: form.equipRefMarca.trim() || null, modelo: form.equipRefModelo.trim() || null }
                : null;
            if (form.ano) payload.ano = parseInt(form.ano, 10);

            if (isEdit && initial) {
                await updateDoc(doc(db, CollectionName.FLEET_VEHICLES, initial.id), payload);
            } else {
                await addDoc(collection(db, CollectionName.FLEET_VEHICLES), {
                    ...payload,
                    kmAtual: 0,
                    createdAt: serverTimestamp(),
                    createdBy: userProfile?.uid || '',
                    createdByName: userProfile?.nomeCompleto || userProfile?.displayName || '',
                });
            }
            onClose();
        } catch {
            alert('Erro ao salvar o veículo.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
                    <h2 className="font-bold text-gray-900">{isEdit ? 'Editar Veículo' : 'Novo Veículo'}</h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {!clienteTravado && (
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Cliente</label>
                            <select value={form.clientId} onChange={set('clientId')} required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                <option value="">Selecione...</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Placa</label>
                            <input value={form.placa} onChange={set('placa')} required placeholder="ABC-1234"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white uppercase" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Ano</label>
                            <input type="number" value={form.ano} onChange={set('ano')} placeholder="2020"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Marca</label>
                            <input value={form.marca} onChange={set('marca')} required placeholder="Ex: Volkswagen"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Modelo</label>
                            <input value={form.modelo} onChange={set('modelo')} required placeholder="Ex: Delivery 9.170"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                            <select value={form.tipo} onChange={set('tipo')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                {TIPOS_VEICULO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Carroceria</label>
                            <select value={form.tipoCarroceria} onChange={set('tipoCarroceria')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                {CARROCERIAS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {form.tipoCarroceria === 'refrigerado' && (
                        <div className="grid grid-cols-2 gap-3 bg-sky-50 border border-sky-200 rounded-lg p-3">
                            <div>
                                <label className="block text-xs font-bold text-sky-700 mb-1">Equip. Refrigeração — Marca</label>
                                <input value={form.equipRefMarca} onChange={set('equipRefMarca')} placeholder="Ex: Thermo King"
                                    className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-sky-700 mb-1">Modelo</label>
                                <input value={form.equipRefModelo} onChange={set('equipRefModelo')}
                                    className="w-full rounded-lg border border-sky-200 px-3 py-2 text-sm bg-white" />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                            <select value={form.status} onChange={set('status')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                <option value="ativo">Ativo</option>
                                <option value="manutencao">Em Manutenção</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        {podeDefinirContrato && (
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Contrato de Manutenção</label>
                                <select value={form.contratoId} onChange={set('contratoId')} disabled={!form.clientId || contratos.length === 0}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white disabled:opacity-50">
                                    <option value="">Sem contrato (avulso)</option>
                                    {contratos.map(c => <option key={c.id} value={c.id}>{c.identificador || `Contrato ${c.id.slice(0, 6)}`}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                    {podeDefinirContrato ? (
                        <p className="text-[10px] text-gray-400 -mt-2">
                            Sem contrato, o cliente pode registrar a própria manutenção (avulsa). Com contrato, só pode abrir chamado — a manutenção vira O.S. da MGR.
                        </p>
                    ) : (
                        <p className="text-[10px] text-gray-400 -mt-2">
                            O vínculo com contrato de manutenção é definido pela MGR — até lá, o veículo é tratado como avulso.
                        </p>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Observações</label>
                        <textarea value={form.observacoes} onChange={set('observacoes')} rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Foto</label>
                        <div className="flex items-center gap-2">
                            {form.fotoUrl && <img src={form.fotoUrl} className="w-16 h-16 object-cover rounded-lg border" alt="veículo" />}
                            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                                className="px-3 py-2 border-2 border-dashed border-brand-200 rounded-lg text-brand-600 text-xs font-bold flex items-center gap-1.5 hover:bg-brand-50 disabled:opacity-50">
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                {form.fotoUrl ? 'Trocar' : 'Adicionar'}
                            </button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFotoUpload} />
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600">Cancelar</button>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? 'Salvar' : 'Cadastrar Veículo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Card ──────────────────────────────────────────────────────────────────
const VehicleCard: React.FC<{ v: FleetVehicle; clientNome?: string; podeEditar: boolean; modoPortal: boolean; onEdit: () => void }> =
    ({ v, clientNome, podeEditar, modoPortal, onEdit }) => {
    const navigate = useNavigate();
    const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.ativo;

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            {v.fotoUrl && (
                <div className="h-32 overflow-hidden">
                    <img src={v.fotoUrl} alt={v.placa} className="w-full h-full object-cover" />
                </div>
            )}
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400">{v.marca} · {v.modelo}</p>
                        <h3 className="font-bold text-gray-900 tracking-wide">{v.placa}</h3>
                        {clientNome && (
                            <p className="text-[10px] text-sky-600 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {clientNome}</p>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>{sc.label}</span>
                </div>

                <div className="mb-2">
                    {v.contratoId ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                            <FileSignature className="w-3 h-3" /> Coberto — {v.contratoIdentificador || 'Contrato'}
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                            <FileSignature className="w-3 h-3" /> Avulso — sem contrato
                        </span>
                    )}
                </div>

                <p className="text-[11px] text-gray-500 mb-3">KM atual: <strong>{v.kmAtual?.toLocaleString('pt-BR') ?? 0}</strong></p>

                <div className="flex gap-2">
                    {podeEditar && (
                        <button onClick={onEdit}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-brand-200 text-brand-700 font-bold hover:bg-brand-50">
                            Editar
                        </button>
                    )}
                    {modoPortal && (
                        <button onClick={() => navigate(`/portal/frota/manutencoes?vehicleId=${v.id}`)}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                            <Wrench className="w-3 h-3" /> Manutenção
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Main ──────────────────────────────────────────────────────────────────
interface FleetVehiclesProps {
    clientId?: string;
    clientName?: string;
    modoPortal?: boolean;   // Portal do Cliente — cadastro gated por clientRole/clientPermissions
}

const FleetVehicles: React.FC<FleetVehiclesProps> = ({ clientId: clientIdProp, clientName: clientNameProp, modoPortal }) => {
    const { userProfile } = useAuth();
    const embutido = !!clientIdProp;

    const [vehicles, setVehicles] = useState<FleetVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<{ open: boolean; vehicle: FleetVehicle | null }>({ open: false, vehicle: null });

    const [clientes, setClientes] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const effectiveClientId = clientIdProp || selectedClientId;
    const clientesPorId = React.useMemo(() => new Map(clientes.map(c => [c.id, c.name])), [clientes]);
    const effectiveClientName = clientNameProp || (selectedClientId ? clientesPorId.get(selectedClientId) : undefined);

    useEffect(() => {
        if (modoPortal || embutido) return;
        getDocs(query(collection(db, CollectionName.CLIENTS), orderBy('name', 'asc')))
            .then(snap => setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))))
            .catch(() => setClientes([]));
    }, [modoPortal, embutido]);

    useEffect(() => {
        const q = effectiveClientId
            ? query(collection(db, CollectionName.FLEET_VEHICLES), where('clientId', '==', effectiveClientId), orderBy('createdAt', 'desc'))
            : query(collection(db, CollectionName.FLEET_VEHICLES), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setVehicles(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetVehicle)));
            setLoading(false);
        }, () => setLoading(false));
    }, [effectiveClientId]);

    const clientRole = (userProfile as any)?.clientRole || 'equipe_producao';
    const clientPermissions = (userProfile as any)?.clientPermissions || {};
    const vehicleIds: string[] = (userProfile as any)?.vehicleIds || [];
    const podeCadastrar = !modoPortal || clientRole === 'admin_mestre' || clientPermissions.fleetCadastrarVeiculos === true;

    const listaBase = (modoPortal && clientRole === 'motorista')
        ? vehicles.filter(v => vehicleIds.includes(v.id))
        : vehicles;
    const filteredVehicles = listaBase.filter(v =>
        v.placa.toLowerCase().includes(search.toLowerCase()) ||
        v.modelo.toLowerCase().includes(search.toLowerCase()) ||
        v.marca.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className={embutido ? 'space-y-4' : 'max-w-6xl mx-auto space-y-6 pb-12'}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Truck className="w-6 h-6 text-brand-600" />
                        {effectiveClientName ? `Frota de ${effectiveClientName}` : 'Frota de Veículos'}
                    </h1>
                    {modoPortal && clientRole === 'motorista' && (
                        <p className="text-gray-500 text-sm mt-0.5">Mostrando só os veículos vinculados a você.</p>
                    )}
                </div>
                {podeCadastrar && (
                    <button onClick={() => setModal({ open: true, vehicle: null })}
                        disabled={!effectiveClientId}
                        title={!effectiveClientId ? 'Selecione um cliente primeiro' : undefined}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus className="w-4 h-4" /> Novo Veículo
                    </button>
                )}
            </div>

            {!modoPortal && !embutido && !effectiveClientId && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    "Novo Veículo" fica desabilitado até você escolher um cliente específico no filtro abaixo — todo veículo precisa nascer vinculado a um cliente.
                </p>
            )}

            {!embutido && !modoPortal && (
                <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full sm:w-80 pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        <option value="">Todos os clientes</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    type="text" name="busca-frota" autoComplete="off"
                    placeholder="Buscar por placa, marca ou modelo..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredVehicles.length === 0 && (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">
                                {effectiveClientId ? 'Nenhum veículo cadastrado.' : 'Selecione um cliente pra ver a frota.'}
                            </p>
                        </div>
                    )}
                    {filteredVehicles.map(v => (
                        <VehicleCard key={v.id} v={v} modoPortal={!!modoPortal}
                            clientNome={!embutido ? clientesPorId.get(v.clientId) : undefined}
                            podeEditar={podeCadastrar}
                            onEdit={() => setModal({ open: true, vehicle: v })} />
                    ))}
                </div>
            )}

            {modal.open && (
                <VehicleForm clientId={effectiveClientId} clientName={effectiveClientName} clientes={clientes}
                    clienteTravado={embutido || modoPortal}
                    podeDefinirContrato={!modoPortal}
                    initial={modal.vehicle}
                    onClose={() => setModal({ open: false, vehicle: null })} />
            )}
        </div>
    );
};

export default FleetVehicles;

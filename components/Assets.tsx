/**
 * components/Assets.tsx — Sprint 30
 * Inventário de Equipamentos de Clientes (client_assets)
 *
 * Funcionalidades:
 *  • Listar ativos filtrados por clientId (query string ou prop)
 *  • Criar / editar ativo: nome, tipo, ficha técnica completa
 *  • Upload de fotos para Firebase Storage → ClientAsset.fotos[]
 *  • Status badge: ativo | inativo | manutencao
 *  • Galeria Histórica: fotos de O.S. anteriores relacionadas ao ativo (assetId)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, serverTimestamp, orderBy, getDocs, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
    CollectionName, ClientAsset, Task
} from '../types';
import {
    Wrench, Plus, Loader2, X, Save, Camera, ChevronDown,
    ChevronUp, Calendar, Tag, AlertCircle, CheckCircle2, Clock,
    ImageIcon, Search, Building2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ────────────────────────────────────────────────────────────────
const ASSET_TYPES = ['Câmara Fria', 'Split', 'Chiller', 'Condensadora', 'Evaporadora', 'Câmara de Congelamento', 'Outro'];

const STATUS_CONFIG = {
    ativo:      { label: 'Ativo',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    inativo:    { label: 'Inativo',    color: 'bg-gray-100 text-gray-500 border-gray-200' },
    manutencao: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700 border-amber-200' },
} as const;

// ── Asset Form Modal ────────────────────────────────────────────────────────
interface AssetFormProps {
    clientId: string;
    initial?: ClientAsset | null;
    onClose: () => void;
}

const AssetForm: React.FC<AssetFormProps> = ({ clientId, initial, onClose }) => {
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        nome:             initial?.nome        || '',
        tipo:             initial?.tipo        || 'Câmara Fria',
        localizacao:      (initial as any)?.localizacao  || '',
        status:           initial?.status      || 'ativo' as ClientAsset['status'],
        dataInstalacao:   initial?.dataInstalacao ? format((initial.dataInstalacao as Timestamp).toDate(), 'yyyy-MM-dd') : '',
        // ficha técnica
        marca:            initial?.especificacoes?.marca            || '',
        modelo:           initial?.especificacoes?.modelo           || '',
        capacidadeBTU:    initial?.especificacoes?.capacidadeBTU    || '',
        potenciaKW:       initial?.especificacoes?.potenciaKW       || '',
        refrigerante:     initial?.especificacoes?.refrigerante      || '',
        anoFabricacao:    initial?.especificacoes?.anoFabricacao    || '',
        numeroSerie:      initial?.especificacoes?.numeroSerie      || '',
        fotos:            initial?.fotos || [] as string[],
    });

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !clientId) return;
        setUploading(true);
        try {
            const path = `assets/${clientId}/${initial?.id || 'new'}/${Date.now()}_${file.name}`;
            const snap = await uploadBytes(ref(storage, path), file);
            const url  = await getDownloadURL(snap.ref);
            setForm(p => ({ ...p, fotos: [...p.fotos, url] }));
        } finally { setUploading(false); }
    };

    const removePhoto = (url: string) =>
        setForm(p => ({ ...p, fotos: p.fotos.filter(f => f !== url) }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const payload: Record<string, any> = {
                clientId,
                nome:          form.nome,
                tipo:          form.tipo,
                status:        form.status,
                fotos:         form.fotos,
                dataInstalacao: form.dataInstalacao ? Timestamp.fromDate(new Date(form.dataInstalacao)) : null,
                especificacoes: {
                    marca:         form.marca         || null,
                    modelo:        form.modelo        || null,
                    capacidadeBTU: form.capacidadeBTU ? Number(form.capacidadeBTU) : null,
                    potenciaKW:    form.potenciaKW    ? Number(form.potenciaKW)    : null,
                    refrigerante:  form.refrigerante  || null,
                    anoFabricacao: form.anoFabricacao ? Number(form.anoFabricacao) : null,
                    numeroSerie:   form.numeroSerie   || null,
                },
                historicoOS: initial?.historicoOS || [],
            };

            if (isEdit && initial) {
                await updateDoc(doc(db, CollectionName.ASSETS, initial.id), { ...payload, updatedAt: serverTimestamp() });
            } else {
                await addDoc(collection(db, CollectionName.ASSETS), { ...payload, createdAt: serverTimestamp() });
            }
            onClose();
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Wrench className="w-5 h-5 text-brand-600" />
                        {isEdit ? 'Editar Ativo' : 'Novo Ativo'}
                    </h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    {/* Identificação */}
                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-600 mb-1">Nome do Equipamento *</label>
                                <input required value={form.nome} onChange={set('nome')}
                                    placeholder="Ex: Câmara Fria Walk-in #1"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                                <select value={form.tipo} onChange={set('tipo')}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                    {ASSET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                                <select value={form.status} onChange={set('status')}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                    <option value="ativo">Ativo</option>
                                    <option value="inativo">Inativo</option>
                                    <option value="manutencao">Em Manutenção</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Localização no Site</label>
                                <input value={form.localizacao} onChange={set('localizacao')}
                                    placeholder="Ex: Câmara 2 – subsolo"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Data de Instalação</label>
                                <input type="date" value={form.dataInstalacao} onChange={set('dataInstalacao')}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                            </div>
                        </div>
                    </section>

                    {/* Ficha Técnica */}
                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Ficha Técnica</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                ['marca',         'Marca',            'text', 'Tecumseh, Embraco...'],
                                ['modelo',        'Modelo',           'text', 'CWS-200'],
                                ['capacidadeBTU', 'Capacidade (BTU)', 'number', '12000'],
                                ['potenciaKW',    'Potência (kW)',    'number', '3.5'],
                                ['refrigerante',  'Gás Refrigerante', 'text', 'R-22, R-404A...'],
                                ['anoFabricacao', 'Ano Fabricação',   'number', '2020'],
                                ['numeroSerie',   'Número de Série',  'text', 'SN-000000'],
                            ].map(([k, label, type, ph]) => (
                                <div key={k as string}>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">{label as string}</label>
                                    <input type={type as string} value={(form as any)[k as string]} onChange={set(k as string)}
                                        placeholder={ph as string}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Fotos */}
                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Fotos (Placa, Esquema, Estado Geral)</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {form.fotos.map(url => (
                                <div key={url} className="relative w-20 h-20">
                                    <img src={url} className="w-full h-full object-cover rounded-lg border" alt="ativo" />
                                    <button type="button" onClick={() => removePhoto(url)}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="w-20 h-20 border-2 border-dashed border-brand-200 rounded-lg flex flex-col items-center justify-center gap-1 text-brand-500 hover:bg-brand-50">
                                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                                <span className="text-[9px]">{uploading ? 'Enviando...' : 'Adicionar'}</span>
                            </button>
                        </div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    </section>

                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600">Cancelar</button>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? 'Salvar' : 'Criar Ativo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Asset Card ──────────────────────────────────────────────────────────────
const AssetCard: React.FC<{ asset: ClientAsset; onEdit: () => void }> = ({ asset, onEdit }) => {
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<Task[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const loadHistory = async () => {
        if (showHistory) { setShowHistory(false); return; }
        setLoadingHistory(true);
        try {
            const snap = await getDocs(
                query(collection(db, CollectionName.TASKS),
                    where('assetId', '==', asset.id),
                    orderBy('createdAt', 'desc'))
            );
            setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        } finally { setLoadingHistory(false); setShowHistory(true); }
    };

    const status = asset.status || 'ativo';
    const sc = STATUS_CONFIG[status];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            {/* Foto principal */}
            {asset.fotos?.[0] && (
                <div className="h-36 overflow-hidden">
                    <img src={asset.fotos[0]} alt={asset.nome} className="w-full h-full object-cover" />
                </div>
            )}

            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400">{asset.tipo}</p>
                        <h3 className="font-bold text-gray-900">{asset.nome}</h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>
                        {sc.label}
                    </span>
                </div>

                {/* Ficha resumida */}
                <div className="space-y-1 text-[11px] text-gray-500 mb-3">
                    {asset.especificacoes?.marca   && <p>🏭 {asset.especificacoes.marca} {asset.especificacoes.modelo}</p>}
                    {asset.especificacoes?.refrigerante && <p>❄️ {asset.especificacoes.refrigerante}</p>}
                    {asset.dataInstalacao && (
                        <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Inst.: {format((asset.dataInstalacao as Timestamp).toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                    )}
                    {asset.historicoOS && asset.historicoOS.length > 0 && (
                        <p className="flex items-center gap-1"><Tag className="w-3 h-3" /> {asset.historicoOS.length} O.S. registadas</p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button onClick={onEdit}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-brand-200 text-brand-700 font-bold hover:bg-brand-50">
                        Editar
                    </button>
                    <button onClick={loadHistory}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                        {loadingHistory ? <Loader2 className="w-3 h-3 animate-spin" /> :
                            showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        Histórico O.S.
                    </button>
                </div>
            </div>

            {/* Galeria Histórica */}
            {showHistory && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Galeria Histórica de O.S.</p>
                    {history.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Nenhuma O.S. com evidências para este ativo.</p>
                    ) : (
                        <div className="space-y-3">
                            {history.map(task => (
                                <div key={task.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-bold text-gray-700">{task.code || task.id.slice(0, 8)}</p>
                                        <p className="text-[10px] text-gray-400">
                                            {task.assigneeName} · {task.createdAt && format((task.createdAt as Timestamp).toDate(), 'dd/MM/yy', { locale: ptBR })}
                                        </p>
                                    </div>
                                    {task.execution?.evidencias && task.execution.evidencias.length > 0 && (
                                        <div className="flex gap-1.5 flex-wrap">
                                            {task.execution.evidencias.map((url, i) => (
                                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                                    <img src={url} alt="evidência" className="w-14 h-14 object-cover rounded border hover:opacity-80" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    {(!task.execution?.evidencias || task.execution.evidencias.length === 0) && (
                                        <p className="text-[10px] text-gray-400 italic">Sem fotos de evidência nesta O.S.</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Main Assets ─────────────────────────────────────────────────────────────
const Assets: React.FC = () => {
    const [assets, setAssets] = useState<ClientAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean; asset: ClientAsset | null; clientId: string }>({
        open: false, asset: null, clientId: ''
    });
    const [search, setSearch] = useState('');

    // Get clientId from URL query string or show all
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const clientIdFilter = params.get('clientId') || '';

    useEffect(() => {
        let q;
        if (clientIdFilter) {
            q = query(collection(db, CollectionName.ASSETS),
                where('clientId', '==', clientIdFilter), orderBy('createdAt', 'desc'));
        } else {
            q = query(collection(db, CollectionName.ASSETS), orderBy('createdAt', 'desc'));
        }
        return onSnapshot(q, snap => {
            setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientAsset)));
            setLoading(false);
        }, () => setLoading(false));
    }, [clientIdFilter]);

    const filtered = assets.filter(a =>
        a.nome.toLowerCase().includes(search.toLowerCase()) ||
        a.tipo?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Wrench className="w-6 h-6 text-brand-600" /> Inventário de Ativos
                    </h1>
                    <p className="text-gray-500 text-sm mt-0.5">Equipamentos e histórico de O.S. por ativo.</p>
                </div>
                <button onClick={() => setModal({ open: true, asset: null, clientId: clientIdFilter })}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700">
                    <Plus className="w-4 h-4" /> Novo Ativo
                </button>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar por nome ou tipo..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
            </div>

            {/* Grid */}
            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filtered.length === 0 && (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                            <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">Nenhum ativo encontrado.</p>
                        </div>
                    )}
                    {filtered.map(asset => (
                        <AssetCard
                            key={asset.id}
                            asset={asset}
                            onEdit={() => setModal({ open: true, asset, clientId: asset.clientId })}
                        />
                    ))}
                </div>
            )}

            {modal.open && (
                <AssetForm
                    clientId={modal.clientId}
                    initial={modal.asset}
                    onClose={() => setModal({ open: false, asset: null, clientId: '' })}
                />
            )}
        </div>
    );
};

export default Assets;

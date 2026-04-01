/**
 * components/ClientAssets.tsx
 * Sprint 30 — Galeria de Ativos por Cliente com histórico de O.S.
 */
import React, { useState, useEffect } from 'react';
import {
    Thermometer, Plus, Loader2, ChevronDown, ChevronUp,
    Camera, Calendar, CheckCircle2, AlertTriangle, Wrench, X
} from 'lucide-react';
import {
    collection, query, where, onSnapshot, addDoc,
    serverTimestamp, doc, updateDoc, orderBy, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { ClientAsset, CollectionName, Task } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClientAssetsProps {
    clientId: string;
    clientName?: string;
}

const ASSET_TIPOS = [
    'Câmara Fria', 'Câmara de Congelamento', 'Split', 'Chiller',
    'Condensadora', 'Evaporadora', 'Câmara Walk-in', 'Outro'
];

const STATUS_PILL: Record<string, string> = {
    ativo:       'bg-emerald-50 border-emerald-200 text-emerald-700',
    inativo:     'bg-gray-50 border-gray-200 text-gray-600',
    manutencao:  'bg-amber-50 border-amber-200 text-amber-700',
};

const ClientAssets: React.FC<ClientAssetsProps> = ({ clientId, clientName }) => {
    const { currentUser, userProfile } = useAuth();
    const [assets, setAssets] = useState<ClientAsset[]>([]);
    const [osHistory, setOsHistory] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        nome: '',
        tipo: 'Câmara Fria',
        localizacao: '',
        dataInstalacao: '',
        marca: '',
        modelo: '',
        numeroSerie: '',
        refrigerante: '',
        potenciaKW: '',
        capacidadeBTU: '',
        anoFabricacao: '',
    });

    // Load assets
    useEffect(() => {
        if (!clientId) return;
        const q = query(
            collection(db, CollectionName.ASSETS),
            where('clientId', '==', clientId),
            orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, snap => {
            setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientAsset)));
            setLoading(false);
        });
    }, [clientId]);

    // Load OS history for the client
    useEffect(() => {
        if (!clientId) return;
        const q = query(
            collection(db, CollectionName.TASKS),
            where('clientId', '==', clientId),
            orderBy('createdAt', 'desc')
        );
        return onSnapshot(q, snap => {
            setOsHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
        });
    }, [clientId]);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser || !form.nome.trim()) return;
        setSaving(true);
        try {
            await addDoc(collection(db, CollectionName.ASSETS), {
                clientId,
                nome:      form.nome,
                tipo:      form.tipo,
                localizacao: form.localizacao || null,
                dataInstalacao: form.dataInstalacao
                    ? Timestamp.fromDate(new Date(form.dataInstalacao))
                    : null,
                status:    'ativo',
                fotos:     [],
                historicoOS: [],
                especificacoes: {
                    marca:         form.marca || null,
                    modelo:        form.modelo || null,
                    numeroSerie:   form.numeroSerie || null,
                    refrigerante:  form.refrigerante || null,
                    potenciaKW:    form.potenciaKW ? parseFloat(form.potenciaKW) : null,
                    capacidadeBTU: form.capacidadeBTU ? parseFloat(form.capacidadeBTU) : null,
                    anoFabricacao: form.anoFabricacao ? parseInt(form.anoFabricacao) : null,
                },
                createdAt: serverTimestamp(),
            });
            setForm({
                nome: '', tipo: 'Câmara Fria', localizacao: '', dataInstalacao: '',
                marca: '', modelo: '', numeroSerie: '', refrigerante: '',
                potenciaKW: '', capacidadeBTU: '', anoFabricacao: '',
            });
            setShowAdd(false);
        } finally { setSaving(false); }
    };

    const osForAsset = (assetId: string) =>
        osHistory.filter(t => t.assetId === assetId);

    if (loading) return (
        <div className="flex items-center justify-center py-10 text-brand-600">
            <Loader2 size={20} className="animate-spin" />
        </div>
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Thermometer size={16} className="text-brand-600" />
                    Ativos de {clientName || 'Cliente'} ({assets.length})
                </h3>
                <button onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white font-bold hover:bg-brand-700">
                    <Plus size={12} /> Novo Ativo
                </button>
            </div>

            {/* Add form */}
            {showAdd && (
                <form onSubmit={handleAdd} className="border-2 border-dashed border-brand-200 rounded-xl p-4 bg-brand-50/20 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-bold text-brand-700">Cadastrar Ativo</p>
                        <button type="button" onClick={() => setShowAdd(false)}>
                            <X size={14} className="text-gray-400" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Nome / Identificação *</label>
                            <input required value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                                placeholder="Ex: Câmara Fria Walk-in #1"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Tipo</label>
                            <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                                className="w-full px-2 py-2 text-sm border border-gray-200 rounded-lg">
                                {ASSET_TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Localização</label>
                            <input value={form.localizacao} onChange={e => setForm(p => ({ ...p, localizacao: e.target.value }))}
                                placeholder="Ex: Sala B2, 2º andar"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Data de Instalação</label>
                            <input type="date" value={form.dataInstalacao} onChange={e => setForm(p => ({ ...p, dataInstalacao: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Marca</label>
                            <input value={form.marca} onChange={e => setForm(p => ({ ...p, marca: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Modelo</label>
                            <input value={form.modelo} onChange={e => setForm(p => ({ ...p, modelo: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Nº de Série</label>
                            <input value={form.numeroSerie} onChange={e => setForm(p => ({ ...p, numeroSerie: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Refrigerante</label>
                            <input value={form.refrigerante} onChange={e => setForm(p => ({ ...p, refrigerante: e.target.value }))}
                                placeholder="R-404A, R-507..."
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Potência (kW)</label>
                            <input type="number" step="0.1" value={form.potenciaKW} onChange={e => setForm(p => ({ ...p, potenciaKW: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Capacidade (BTU)</label>
                            <input type="number" value={form.capacidadeBTU} onChange={e => setForm(p => ({ ...p, capacidadeBTU: e.target.value }))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg" />
                        </div>
                    </div>
                    <button type="submit" disabled={saving || !form.nome.trim()}
                        className="w-full py-2 bg-brand-600 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        Cadastrar Ativo
                    </button>
                </form>
            )}

            {/* Asset list */}
            {assets.length === 0 && !showAdd && (
                <div className="text-center py-10 text-gray-400">
                    <Thermometer size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhum ativo cadastrado para este cliente.</p>
                </div>
            )}

            {assets.map(asset => {
                const isExpanded = expandedId === asset.id;
                const assetOS = osForAsset(asset.id);
                const specs = asset.especificacoes;

                return (
                    <div key={asset.id} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Header */}
                        <button onClick={() => setExpandedId(isExpanded ? null : asset.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 bg-brand-50 border border-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Thermometer size={18} className="text-brand-600" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-gray-900">{asset.nome}</p>
                                    <p className="text-[10px] text-gray-500">{asset.tipo}
                                        {asset.localizacao && <> · {asset.localizacao}</>}
                                        {asset.dataInstalacao && <>
                                            · Instalado: {format((asset.dataInstalacao as Timestamp).toDate(), 'MM/yyyy', { locale: ptBR })}
                                        </>}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${STATUS_PILL[asset.status || 'ativo']}`}>
                                    {asset.status || 'ativo'}
                                </span>
                                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                                    {assetOS.length} O.S.
                                </span>
                                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                            </div>
                        </button>

                        {/* Expanded content */}
                        {isExpanded && (
                            <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50/50">
                                {/* Specs */}
                                {specs && Object.keys(specs).some(k => specs[k]) && (
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Especificações Técnicas</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {specs.marca && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Marca</p><p className="text-xs font-bold">{specs.marca}</p></div>}
                                            {specs.modelo && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Modelo</p><p className="text-xs font-bold">{specs.modelo}</p></div>}
                                            {specs.numeroSerie && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Nº Série</p><p className="text-xs font-bold font-mono">{specs.numeroSerie}</p></div>}
                                            {specs.refrigerante && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Refrigerante</p><p className="text-xs font-bold">{specs.refrigerante}</p></div>}
                                            {specs.potenciaKW && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Potência</p><p className="text-xs font-bold">{specs.potenciaKW} kW</p></div>}
                                            {specs.capacidadeBTU && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Capacidade</p><p className="text-xs font-bold">{Number(specs.capacidadeBTU).toLocaleString()} BTU</p></div>}
                                            {specs.anoFabricacao && <div className="bg-white rounded-lg p-2 border border-gray-100"><p className="text-[9px] text-gray-400">Fabricação</p><p className="text-xs font-bold">{specs.anoFabricacao}</p></div>}
                                        </div>
                                    </div>
                                )}

                                {/* OS History */}
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Wrench size={10} /> Histórico de O.S. ({assetOS.length})
                                    </p>
                                    {assetOS.length === 0 ? (
                                        <p className="text-xs text-gray-400 italic">Nenhuma O.S. vinculada a este ativo.</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {assetOS.map(os => (
                                                <div key={os.id} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-gray-100">
                                                    {os.status === 'completed'
                                                        ? <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                                                        : <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-gray-900 truncate">{os.title}</p>
                                                        <p className="text-[9px] text-gray-400">
                                                            {os.code || os.id.slice(0, 8)} ·{' '}
                                                            {os.createdAt
                                                                ? format((os.createdAt as Timestamp).toDate(), "dd/MM/yy", { locale: ptBR })
                                                                : '—'}
                                                        </p>
                                                    </div>
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border
                                                        ${os.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                          os.status === 'in-progress' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                                          'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                        {os.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default ClientAssets;

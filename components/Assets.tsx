/**
 * components/Assets.tsx — Sprint 30, reestruturado em camada reversa
 * Ativos finais (client_assets) e Maquinários (maquinarios)
 *
 * Cadastro "de trás pra frente": o maquinário (evaporador, condensadora,
 * compressor, rack...) é cadastrado primeiro e depois vinculado a quais
 * ativos finais ele atende (N:N — um rack pode atender 2 câmaras). O
 * histórico de manutenção fica preso ao maquinário, não ao ativo final —
 * abrir um ativo final lista os maquinários que o atendem; escolher um
 * deles mostra o histórico de O.S. daquela peça específica.
 *
 * Componente único, usado em dois contextos:
 *  - Módulo global "Ativos e Maquinários" (rota /app/ativos, sem clientId
 *    fixo) — mostra o seletor de cliente pra filtrar.
 *  - Embutido no card de um cliente (Clients.tsx, prop clientId fixa) ou no
 *    Portal do Cliente (PortalAtivos.tsx, clientId fixa + readOnly) — mesma
 *    tela, só que travada num cliente e sem o seletor.
 * Antes disso existiam DUAS implementações (esta, e o antigo
 * ClientAssets.tsx com formulário próprio) mostrando a mesma coisa de
 * jeitos diferentes — unificado aqui; ClientAssets.tsx agora só delega.
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, serverTimestamp, orderBy, getDocs, Timestamp
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import {
    CollectionName, ClientAsset, Maquinario, Task, Client, RelatorioOS,
    TIPOS_ATIVO_FINAL, TIPOS_MAQUINARIO
} from '../types';
import {
    Wrench, Plus, Loader2, X, Save, Camera, ChevronDown,
    ChevronUp, Calendar, Search, Cog, Thermometer, FileText, Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ConteudoSomenteLeitura, ConteudoEditavel } from './OSRelatorioConclusao';

const STATUS_CONFIG = {
    ativo:      { label: 'Ativo',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    inativo:    { label: 'Inativo',    color: 'bg-gray-100 text-gray-500 border-gray-200' },
    manutencao: { label: 'Manutenção', color: 'bg-amber-100 text-amber-700 border-amber-200' },
} as const;

const FICHA_TECNICA_FIELDS: [string, string, string, string][] = [
    ['marca',         'Marca',            'text', 'Tecumseh, Embraco...'],
    ['modelo',        'Modelo',           'text', 'CWS-200'],
    ['capacidadeBTU', 'Capacidade (BTU)', 'number', '12000'],
    ['potenciaKW',    'Potência (kW)',    'number', '3.5'],
    ['refrigerante',  'Gás Refrigerante', 'text', 'R-22, R-404A...'],
    ['anoFabricacao', 'Ano Fabricação',   'number', '2020'],
    ['numeroSerie',   'Número de Série',  'text', 'SN-000000'],
];

// ── Ativo Final Form Modal ───────────────────────────────────────────────────
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
        tipo:             initial?.tipo        || TIPOS_ATIVO_FINAL[0],
        localizacao:      (initial as any)?.localizacao  || '',
        status:           initial?.status      || 'ativo' as ClientAsset['status'],
        dataInstalacao:   initial?.dataInstalacao ? format((initial.dataInstalacao as Timestamp).toDate(), 'yyyy-MM-dd') : '',
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
            const payload: Record<string, any> = {
                clientId,
                nome:          form.nome,
                tipo:          form.tipo,
                status:        form.status,
                localizacao:   form.localizacao || null,
                fotos:         form.fotos,
                dataInstalacao: form.dataInstalacao ? Timestamp.fromDate(new Date(form.dataInstalacao)) : null,
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
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Thermometer className="w-5 h-5 text-brand-600" />
                        {isEdit ? 'Editar Ativo Final' : 'Novo Ativo Final'}
                    </h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">Nome *</label>
                            <input required value={form.nome} onChange={set('nome')}
                                placeholder="Ex: Câmara Fria Walk-in #1"
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                            <select value={form.tipo} onChange={set('tipo')}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                {TIPOS_ATIVO_FINAL.map(t => <option key={t} value={t}>{t}</option>)}
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

                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Fotos</p>
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

// ── Maquinário Form Modal ────────────────────────────────────────────────────
interface MaquinarioFormProps {
    clientId: string;
    initial?: Maquinario | null;
    ativosDoCliente: ClientAsset[];
    onClose: () => void;
}

const MaquinarioForm: React.FC<MaquinarioFormProps> = ({ clientId, initial, ativosDoCliente, onClose }) => {
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const [form, setForm] = useState({
        nome:  initial?.nome || '',
        tipo:  initial?.tipo || TIPOS_MAQUINARIO[0],
        status: initial?.status || 'ativo' as Maquinario['status'],
        dataInstalacao: initial?.dataInstalacao ? format((initial.dataInstalacao as Timestamp).toDate(), 'yyyy-MM-dd') : '',
        marca:            initial?.especificacoes?.marca            || '',
        modelo:           initial?.especificacoes?.modelo           || '',
        capacidadeBTU:    initial?.especificacoes?.capacidadeBTU    || '',
        potenciaKW:       initial?.especificacoes?.potenciaKW       || '',
        refrigerante:     initial?.especificacoes?.refrigerante      || '',
        anoFabricacao:    initial?.especificacoes?.anoFabricacao    || '',
        numeroSerie:      initial?.especificacoes?.numeroSerie      || '',
        fotos: initial?.fotos || [] as string[],
    });
    const [ativosSelecionados, setAtivosSelecionados] = useState<string[]>(initial?.ativosFinaisAtendidos || []);

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !clientId) return;
        setUploading(true);
        try {
            const path = `maquinarios/${clientId}/${initial?.id || 'new'}/${Date.now()}_${file.name}`;
            const snap = await uploadBytes(ref(storage, path), file);
            const url  = await getDownloadURL(snap.ref);
            setForm(p => ({ ...p, fotos: [...p.fotos, url] }));
        } finally { setUploading(false); }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: Record<string, any> = {
                clientId,
                nome: form.nome,
                tipo: form.tipo,
                status: form.status,
                fotos: form.fotos,
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
                ativosFinaisAtendidos: ativosSelecionados,
            };
            if (isEdit && initial) {
                await updateDoc(doc(db, CollectionName.MAQUINARIOS, initial.id), payload);
            } else {
                await addDoc(collection(db, CollectionName.MAQUINARIOS), { ...payload, createdAt: serverTimestamp() });
            }
            onClose();
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-10 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 rounded-t-2xl">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Cog className="w-5 h-5 text-brand-600" />
                        {isEdit ? 'Editar Maquinário' : 'Novo Maquinário'}
                    </h2>
                    <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-600 mb-1">Nome do Maquinário *</label>
                                <input required value={form.nome} onChange={set('nome')}
                                    placeholder="Ex: Evaporador Bohn EM-450 — Rack 2"
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 mb-1">Tipo</label>
                                <select value={form.tipo} onChange={set('tipo')}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                    {TIPOS_MAQUINARIO.map(t => <option key={t} value={t}>{t}</option>)}
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
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-gray-600 mb-1">Data de Instalação</label>
                                <input type="date" value={form.dataInstalacao} onChange={set('dataInstalacao')}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                            </div>
                        </div>
                    </section>

                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Ficha Técnica</p>
                        <div className="grid grid-cols-2 gap-3">
                            {FICHA_TECNICA_FIELDS.map(([k, label, type, ph]) => (
                                <div key={k}>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">{label}</label>
                                    <input type={type} value={(form as any)[k]} onChange={set(k)}
                                        placeholder={ph}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Vínculo N:N — um maquinário pode atender mais de um ativo final
                        (ex. rack de refrigeração compartilhado entre duas câmaras) */}
                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Atende quais ativos?</p>
                        {ativosDoCliente.length === 0 ? (
                            <p className="text-xs text-gray-400">Cadastre um Ativo Final para este cliente antes de vincular o maquinário.</p>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {ativosDoCliente.map(a => {
                                    const checked = ativosSelecionados.includes(a.id);
                                    return (
                                        <label key={a.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                            checked ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}>
                                            <input type="checkbox" checked={checked} className="accent-brand-600"
                                                onChange={e => {
                                                    if (e.target.checked) setAtivosSelecionados(prev => [...prev, a.id]);
                                                    else setAtivosSelecionados(prev => prev.filter(id => id !== a.id));
                                                }} />
                                            {a.nome}
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </section>

                    <section>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Fotos</p>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {form.fotos.map(url => (
                                <div key={url} className="relative w-20 h-20">
                                    <img src={url} className="w-full h-full object-cover rounded-lg border" alt="maquinário" />
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
                            {isEdit ? 'Salvar' : 'Criar Maquinário'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Histórico de manutenção de um maquinário (equipe interna) ───────────────
const HistoricoMaquinario: React.FC<{ maquinarioId: string }> = ({ maquinarioId }) => {
    const [history, setHistory] = useState<Task[] | null>(null);
    useEffect(() => {
        getDocs(query(collection(db, CollectionName.TASKS), where('maquinarioId', '==', maquinarioId), orderBy('createdAt', 'desc')))
            .then(snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task))))
            .catch(() => setHistory([]));
    }, [maquinarioId]);

    if (history === null) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;
    if (history.length === 0) return <p className="text-xs text-gray-400 text-center py-3">Nenhuma O.S. registrada para este maquinário ainda.</p>;

    return (
        <div className="space-y-2">
            {history.map(task => (
                <div key={task.id} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-bold text-gray-700">{task.code || task.id.slice(0, 8)}</p>
                        <p className="text-[10px] text-gray-400">
                            {task.assigneeName} · {task.createdAt && format((task.createdAt as Timestamp).toDate(), 'dd/MM/yy', { locale: ptBR })}
                        </p>
                    </div>
                    {task.execution?.evidencias && task.execution.evidencias.length > 0 ? (
                        <div className="flex gap-1.5 flex-wrap">
                            {task.execution.evidencias.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer">
                                    <img src={url} alt="evidência" className="w-12 h-12 object-cover rounded border hover:opacity-80" />
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-400 italic">Sem fotos de evidência nesta O.S.</p>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Relatórios de O.S. enviados ao cliente, filtrados por ativo ─────────────
// Lê a coleção espelho `relatorios_os` (só campos seguros — ver
// OSRelatorioConclusao.tsx) — é o que o Portal do Cliente consegue ler.
// Reaproveitado também no lado interno, pra staff conferir o que foi enviado.
const RelatoriosDoAtivo: React.FC<{ ativoId: string }> = ({ ativoId }) => {
    const [relatorios, setRelatorios] = useState<RelatorioOS[] | null>(null);
    const [aberto, setAberto] = useState<string | null>(null);

    useEffect(() => {
        getDocs(query(collection(db, CollectionName.RELATORIOS_OS), where('ativoId', '==', ativoId), orderBy('enviadoEm', 'desc')))
            .then(snap => setRelatorios(snap.docs.map(d => ({ id: d.id, ...d.data() } as RelatorioOS))))
            .catch(() => setRelatorios([]));
    }, [ativoId]);

    if (relatorios === null) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;
    if (relatorios.length === 0) return <p className="text-xs text-gray-400 text-center py-3">Nenhum relatório de O.S. enviado para este equipamento ainda.</p>;

    return (
        <div className="space-y-2">
            {relatorios.map(r => (
                <div key={r.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <button onClick={() => setAberto(aberto === r.id ? null : r.id)}
                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50">
                        <div>
                            <p className="text-xs font-bold text-gray-800">{r.numeroOS} — {r.titulo || 'O.S.'}</p>
                            <p className="text-[10px] text-gray-400">
                                {r.enviadoEm && format((r.enviadoEm as Timestamp).toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                            </p>
                        </div>
                        {aberto === r.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
                    </button>
                    {aberto === r.id && (
                        <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                            <ConteudoSomenteLeitura c={r.conteudo as ConteudoEditavel} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Asset (Ativo Final) Card ─────────────────────────────────────────────────
const AssetCard: React.FC<{ asset: ClientAsset; clientNome?: string; onEdit?: () => void; readOnly?: boolean }> = ({ asset, clientNome, onEdit, readOnly }) => {
    const [expandido, setExpandido] = useState<'maquinarios' | 'relatorios' | null>(null);
    const [maquinarios, setMaquinarios] = useState<Maquinario[] | null>(null);
    const [maquinarioAberto, setMaquinarioAberto] = useState<string | null>(null);

    const toggleMaquinarios = () => {
        if (expandido === 'maquinarios') { setExpandido(null); return; }
        setExpandido('maquinarios');
        if (maquinarios === null) {
            getDocs(query(collection(db, CollectionName.MAQUINARIOS), where('ativosFinaisAtendidos', 'array-contains', asset.id)))
                .then(snap => setMaquinarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as Maquinario))))
                .catch(() => setMaquinarios([]));
        }
    };
    const toggleRelatorios = () => setExpandido(expandido === 'relatorios' ? null : 'relatorios');

    const status = asset.status || 'ativo';
    const sc = STATUS_CONFIG[status];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
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
                        {clientNome && (
                            <p className="text-[10px] text-sky-600 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {clientNome}</p>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>
                        {sc.label}
                    </span>
                </div>

                <div className="space-y-1 text-[11px] text-gray-500 mb-3">
                    {asset.dataInstalacao && (
                        <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Inst.: {format((asset.dataInstalacao as Timestamp).toDate(), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                    )}
                </div>

                <div className="flex gap-2 flex-wrap">
                    {!readOnly && onEdit && (
                        <button onClick={onEdit}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-brand-200 text-brand-700 font-bold hover:bg-brand-50">
                            Editar
                        </button>
                    )}
                    {!readOnly && (
                        <button onClick={toggleMaquinarios}
                            className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                            {expandido === 'maquinarios' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            Maquinários
                        </button>
                    )}
                    <button onClick={toggleRelatorios}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                        {expandido === 'relatorios' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        <FileText className="w-3 h-3" /> Relatórios de O.S.
                    </button>
                </div>
            </div>

            {expandido === 'maquinarios' && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Maquinários que atendem este ativo</p>
                    {maquinarios === null ? (
                        <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                    ) : maquinarios.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Nenhum maquinário vinculado a este ativo ainda. Cadastre um maquinário e marque este ativo na lista de "Atende quais ativos?".</p>
                    ) : (
                        <div className="space-y-2">
                            {maquinarios.map(m => (
                                <div key={m.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <button onClick={() => setMaquinarioAberto(maquinarioAberto === m.id ? null : m.id)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{m.nome}</p>
                                            <p className="text-[10px] text-gray-400">{m.tipo}</p>
                                        </div>
                                        {maquinarioAberto === m.id ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                                    </button>
                                    {maquinarioAberto === m.id && (
                                        <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                                            <HistoricoMaquinario maquinarioId={m.id} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {expandido === 'relatorios' && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Relatórios de O.S. enviados</p>
                    <RelatoriosDoAtivo ativoId={asset.id} />
                </div>
            )}
        </div>
    );
};

// ── Maquinário Card (visão direta, sem passar pelo ativo final) ─────────────
const MaquinarioCard: React.FC<{ m: Maquinario; ativos: ClientAsset[]; clientNome?: string; onEdit: () => void }> = ({ m, ativos, clientNome, onEdit }) => {
    const [open, setOpen] = useState(false);
    const nomesAtivos = m.ativosFinaisAtendidos
        .map(id => ativos.find(a => a.id === id)?.nome)
        .filter(Boolean);
    const status = m.status || 'ativo';
    const sc = STATUS_CONFIG[status];

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400">{m.tipo}</p>
                        <h3 className="font-bold text-gray-900">{m.nome}</h3>
                        {clientNome && (
                            <p className="text-[10px] text-sky-600 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {clientNome}</p>
                        )}
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${sc.color}`}>{sc.label}</span>
                </div>
                {nomesAtivos.length > 0 ? (
                    <p className="text-[11px] text-sky-600 flex items-center gap-1 mb-3">
                        <Thermometer className="w-3 h-3" /> Atende: {nomesAtivos.join(', ')}
                    </p>
                ) : (
                    <p className="text-[11px] text-amber-600 mb-3">Ainda não vinculado a nenhum ativo final.</p>
                )}
                <div className="flex gap-2">
                    <button onClick={onEdit}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-brand-200 text-brand-700 font-bold hover:bg-brand-50">
                        Editar
                    </button>
                    <button onClick={() => setOpen(v => !v)}
                        className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1">
                        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Histórico
                    </button>
                </div>
            </div>
            {open && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                    <HistoricoMaquinario maquinarioId={m.id} />
                </div>
            )}
        </div>
    );
};

// ── Main Assets ─────────────────────────────────────────────────────────────
interface AssetsProps {
    clientId?: string;    // fixo — embutido no card de um cliente ou no Portal
    clientName?: string;
    readOnly?: boolean;   // Portal do Cliente — sem cadastro, sem aba Maquinários
}

const Assets: React.FC<AssetsProps> = ({ clientId: clientIdProp, clientName: clientNameProp, readOnly }) => {
    const embutido = !!clientIdProp;

    const [tab, setTab] = useState<'finais' | 'maquinarios'>(embutido ? 'finais' : 'maquinarios');
    const [assets, setAssets] = useState<ClientAsset[]>([]);
    const [maquinarios, setMaquinarios] = useState<Maquinario[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ open: boolean; asset: ClientAsset | null; clientId: string }>({
        open: false, asset: null, clientId: ''
    });
    const [modalMaquinario, setModalMaquinario] = useState<{ open: boolean; maquinario: Maquinario | null; clientId: string }>({
        open: false, maquinario: null, clientId: ''
    });
    const [search, setSearch] = useState('');

    // Seletor de cliente — só existe no módulo global (não embutido). Aceita
    // deep-link via ?clientId= (ex: link vindo de outro módulo) como valor inicial.
    const [clientes, setClientes] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState(() => {
        if (embutido) return '';
        const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
        return params.get('clientId') || '';
    });

    const effectiveClientId = clientIdProp || selectedClientId;
    const clientesPorId = useMemo(() => new Map(clientes.map(c => [c.id, c.name])), [clientes]);
    const effectiveClientName = clientNameProp || (selectedClientId ? clientesPorId.get(selectedClientId) : undefined);

    useEffect(() => {
        if (embutido) return;
        getDocs(query(collection(db, CollectionName.CLIENTS), orderBy('name', 'asc')))
            .then(snap => setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))))
            .catch(() => setClientes([]));
    }, [embutido]);

    useEffect(() => {
        const q = effectiveClientId
            ? query(collection(db, CollectionName.ASSETS), where('clientId', '==', effectiveClientId), orderBy('createdAt', 'desc'))
            : query(collection(db, CollectionName.ASSETS), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setAssets(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClientAsset)));
            setLoading(false);
        }, () => setLoading(false));
    }, [effectiveClientId]);

    // Maquinários — nunca carregados no Portal do Cliente (coleção bloqueada
    // pras regras do Firestore pra role 'cliente'; nem tenta a leitura).
    useEffect(() => {
        if (readOnly) { setMaquinarios([]); return; }
        const q = effectiveClientId
            ? query(collection(db, CollectionName.MAQUINARIOS), where('clientId', '==', effectiveClientId), orderBy('createdAt', 'desc'))
            : query(collection(db, CollectionName.MAQUINARIOS), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setMaquinarios(snap.docs.map(d => ({ id: d.id, ...d.data() } as Maquinario)));
        }, () => {});
    }, [effectiveClientId, readOnly]);

    const filteredAssets = assets.filter(a =>
        a.nome.toLowerCase().includes(search.toLowerCase()) || a.tipo?.toLowerCase().includes(search.toLowerCase())
    );
    const filteredMaquinarios = maquinarios.filter(m =>
        m.nome.toLowerCase().includes(search.toLowerCase()) || m.tipo?.toLowerCase().includes(search.toLowerCase())
    );
    // Ativos do cliente relevante ao formulário de maquinário aberto no momento
    const ativosDoClienteDoModal = assets.filter(a => a.clientId === modalMaquinario.clientId);

    return (
        <div className={embutido ? 'space-y-4' : 'max-w-6xl mx-auto space-y-6 pb-12'}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Wrench className="w-6 h-6 text-brand-600" />
                        {effectiveClientName ? `Ativos de ${effectiveClientName}` : 'Ativos e Maquinários'}
                    </h1>
                    {!readOnly && (
                        <p className="text-gray-500 text-sm mt-0.5">
                            Cadastre o maquinário primeiro, depois vincule a quais ativos finais (câmaras) ele atende.
                        </p>
                    )}
                </div>
                {!readOnly && (
                    <div className="flex gap-2">
                        <button onClick={() => setModal({ open: true, asset: null, clientId: effectiveClientId })}
                            disabled={!effectiveClientId}
                            title={!effectiveClientId ? 'Selecione um cliente primeiro' : undefined}
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-brand-200 text-brand-700 rounded-lg text-sm font-bold hover:bg-brand-50 disabled:opacity-40 disabled:cursor-not-allowed">
                            <Thermometer className="w-4 h-4" /> Novo Ativo Final
                        </button>
                        <button onClick={() => setModalMaquinario({ open: true, maquinario: null, clientId: effectiveClientId })}
                            disabled={!effectiveClientId}
                            title={!effectiveClientId ? 'Selecione um cliente primeiro' : undefined}
                            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed">
                            <Plus className="w-4 h-4" /> Novo Maquinário
                        </button>
                    </div>
                )}
            </div>

            {!embutido && (
                <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}
                        className="w-full sm:w-80 pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                        <option value="">Todos os clientes</option>
                        {clientes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
            )}

            {!readOnly && (
                <div className="flex items-center gap-4 border-b border-gray-200">
                    {([{ id: 'maquinarios', label: `Maquinários (${maquinarios.length})`, icon: Cog },
                       { id: 'finais', label: `Ativos Finais (${assets.length})`, icon: Thermometer }] as const).map(t => (
                        <button key={t.id} onClick={() => setTab(t.id)}
                            className={`flex items-center gap-1.5 pb-2.5 px-1 text-sm font-bold border-b-2 transition-colors ${
                                tab === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-400 hover:text-gray-600'
                            }`}>
                            <t.icon className="w-4 h-4" /> {t.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                    type="text" name="busca-ativos" autoComplete="off"
                    placeholder="Buscar por nome ou tipo..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
            ) : (readOnly || tab === 'finais') ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredAssets.length === 0 && (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                            <Thermometer className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">{effectiveClientId ? 'Nenhum ativo cadastrado para este cliente.' : 'Nenhum ativo final encontrado.'}</p>
                        </div>
                    )}
                    {filteredAssets.map(asset => (
                        <AssetCard key={asset.id} asset={asset} readOnly={readOnly}
                            clientNome={!effectiveClientId ? clientesPorId.get(asset.clientId) : undefined}
                            onEdit={() => setModal({ open: true, asset, clientId: asset.clientId })} />
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredMaquinarios.length === 0 && (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                            <Cog className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">Nenhum maquinário cadastrado.</p>
                        </div>
                    )}
                    {filteredMaquinarios.map(m => (
                        <MaquinarioCard key={m.id} m={m} ativos={assets}
                            clientNome={!effectiveClientId ? clientesPorId.get(m.clientId) : undefined}
                            onEdit={() => setModalMaquinario({ open: true, maquinario: m, clientId: m.clientId })} />
                    ))}
                </div>
            )}

            {!readOnly && modal.open && (
                <AssetForm clientId={modal.clientId} initial={modal.asset}
                    onClose={() => setModal({ open: false, asset: null, clientId: '' })} />
            )}
            {!readOnly && modalMaquinario.open && (
                <MaquinarioForm
                    clientId={modalMaquinario.clientId}
                    initial={modalMaquinario.maquinario}
                    ativosDoCliente={ativosDoClienteDoModal}
                    onClose={() => setModalMaquinario({ open: false, maquinario: null, clientId: '' })}
                />
            )}
        </div>
    );
};

export default Assets;

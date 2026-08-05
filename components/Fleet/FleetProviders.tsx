/**
 * components/Fleet/FleetProviders.tsx
 * Cadastro de prestadores de serviço terceiros (oficinas, eletricistas,
 * borracharias...) usados na manutenção avulsa de veículos de frota do
 * cliente — Fase 1 do subsistema multi-tenant de manutenção. Mesmo padrão
 * de FleetVehicles.tsx: staff usa sem clientId (módulo global), Portal usa
 * com clientId fixo + modoPortal (cadastro gated por clientRole/clientPermissions).
 */
import React, { useState, useEffect } from 'react';
import {
    collection, query, where, onSnapshot, addDoc, updateDoc,
    doc, serverTimestamp, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, FleetProvider, FleetEspecialidade, Client } from '../../types';
import { Users, Plus, Loader2, X, Save, Building2, Search, Phone, Mail, MapPin, AlertTriangle } from 'lucide-react';

const ESPECIALIDADES: { value: FleetEspecialidade; label: string }[] = [
    { value: 'eletrica', label: 'Elétrica' },
    { value: 'refrigeracao', label: 'Refrigeração' },
    { value: 'mecanica', label: 'Mecânica' },
    { value: 'funilaria', label: 'Funilaria' },
    { value: 'borracharia', label: 'Borracharia' },
];

// ── Form Modal ────────────────────────────────────────────────────────────
interface ProviderFormProps {
    clientId: string;
    clientName?: string;
    clientes: Client[];
    clienteTravado?: boolean;
    initial?: FleetProvider | null;
    onClose: () => void;
}
const ProviderForm: React.FC<ProviderFormProps> = ({ clientId, clientName, clientes, clienteTravado, initial, onClose }) => {
    const { userProfile } = useAuth();
    const isEdit = !!initial;
    const [saving, setSaving] = useState(false);

    const [form, setForm] = useState({
        clientId:           initial?.clientId    || clientId,
        nome:               initial?.nome        || '',
        cpfCnpj:            initial?.cpfCnpj      || '',
        especialidades:     initial?.especialidades || [] as FleetEspecialidade[],
        telefone:           initial?.telefone     || '',
        email:              initial?.email        || '',
        endereco:           initial?.endereco     || '',
        contatoResponsavel: initial?.contatoResponsavel || '',
        status:             initial?.status || 'ativo' as FleetProvider['status'],
        observacoes:        initial?.observacoes  || '',
    });

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(p => ({ ...p, [k]: e.target.value }));

    const toggleEspecialidade = (esp: FleetEspecialidade) =>
        setForm(p => ({
            ...p,
            especialidades: p.especialidades.includes(esp)
                ? p.especialidades.filter(e => e !== esp)
                : [...p.especialidades, esp],
        }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.clientId) { alert('Selecione um cliente.'); return; }
        if (!form.nome.trim() || !form.cpfCnpj.trim()) { alert('Preencha nome e CPF/CNPJ.'); return; }
        setSaving(true);
        try {
            const nomeCliente = (clienteTravado && clientName) || clientes.find(c => c.id === form.clientId)?.name || '';
            const payload: any = {
                clientId: form.clientId,
                clientName: nomeCliente,
                nome: form.nome.trim(),
                cpfCnpj: form.cpfCnpj.trim(),
                especialidades: form.especialidades,
                telefone: form.telefone.trim() || null,
                email: form.email.trim() || null,
                endereco: form.endereco.trim() || null,
                contatoResponsavel: form.contatoResponsavel.trim() || null,
                status: form.status,
                observacoes: form.observacoes.trim() || null,
            };
            if (isEdit && initial) {
                await updateDoc(doc(db, CollectionName.FLEET_PROVIDERS, initial.id), payload);
            } else {
                await addDoc(collection(db, CollectionName.FLEET_PROVIDERS), {
                    ...payload,
                    createdAt: serverTimestamp(),
                    createdBy: userProfile?.uid || '',
                    createdByName: userProfile?.nomeCompleto || userProfile?.displayName || '',
                });
            }
            onClose();
        } catch {
            alert('Erro ao salvar o prestador.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="px-5 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
                    <h2 className="font-bold text-gray-900">{isEdit ? 'Editar Prestador' : 'Novo Prestador'}</h2>
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
                            <label className="block text-xs font-bold text-gray-600 mb-1">Nome / Razão Social</label>
                            <input value={form.nome} onChange={set('nome')} required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">CPF/CNPJ</label>
                            <input value={form.cpfCnpj} onChange={set('cpfCnpj')} required
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Telefone</label>
                            <input value={form.telefone} onChange={set('telefone')}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">E-mail</label>
                            <input type="email" value={form.email} onChange={set('email')}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-600 mb-1">Endereço</label>
                            <input value={form.endereco} onChange={set('endereco')}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Contato Responsável</label>
                            <input value={form.contatoResponsavel} onChange={set('contatoResponsavel')}
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Status</label>
                            <select value={form.status} onChange={set('status')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white">
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1.5">Especialidades</label>
                        <div className="flex flex-wrap gap-2">
                            {ESPECIALIDADES.map(esp => {
                                const checked = form.especialidades.includes(esp.value);
                                return (
                                    <label key={esp.value} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                                        checked ? 'bg-brand-50 border-brand-200 text-brand-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}>
                                        <input type="checkbox" checked={checked} onChange={() => toggleEspecialidade(esp.value)} className="accent-brand-600" />
                                        {esp.label}
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-600 mb-1">Observações</label>
                        <textarea value={form.observacoes} onChange={set('observacoes')} rows={2}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white resize-none" />
                    </div>

                    <div className="flex justify-end gap-3 pt-2 border-t">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600">Cancelar</button>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 text-sm bg-brand-600 text-white rounded-lg disabled:opacity-50">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEdit ? 'Salvar' : 'Cadastrar Prestador'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Card ──────────────────────────────────────────────────────────────────
const ProviderCard: React.FC<{ p: FleetProvider; clientNome?: string; podeEditar: boolean; onEdit: () => void }> =
    ({ p, clientNome, podeEditar, onEdit }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
            <div>
                <h3 className="font-bold text-gray-900">{p.nome}</h3>
                <p className="text-[10px] text-gray-400">{p.cpfCnpj}</p>
                {clientNome && (
                    <p className="text-[10px] text-sky-600 flex items-center gap-1 mt-0.5"><Building2 className="w-3 h-3" /> {clientNome}</p>
                )}
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${
                p.status === 'ativo' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}>{p.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
        </div>
        {p.especialidades?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
                {p.especialidades.map(esp => (
                    <span key={esp} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {ESPECIALIDADES.find(e => e.value === esp)?.label || esp}
                    </span>
                ))}
            </div>
        )}
        <div className="space-y-1 text-[11px] text-gray-500 mb-3">
            {p.telefone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.telefone}</p>}
            {p.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {p.email}</p>}
            {p.endereco && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.endereco}</p>}
        </div>
        {podeEditar && (
            <button onClick={onEdit}
                className="w-full text-xs py-1.5 rounded-lg border border-brand-200 text-brand-700 font-bold hover:bg-brand-50">
                Editar
            </button>
        )}
    </div>
);

// ── Main ──────────────────────────────────────────────────────────────────
interface FleetProvidersProps {
    clientId?: string;
    clientName?: string;
    modoPortal?: boolean;
}

const FleetProviders: React.FC<FleetProvidersProps> = ({ clientId: clientIdProp, clientName: clientNameProp, modoPortal }) => {
    const { userProfile } = useAuth();
    const embutido = !!clientIdProp;

    const [providers, setProviders] = useState<FleetProvider[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState<{ open: boolean; provider: FleetProvider | null }>({ open: false, provider: null });

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
            ? query(collection(db, CollectionName.FLEET_PROVIDERS), where('clientId', '==', effectiveClientId), orderBy('createdAt', 'desc'))
            : query(collection(db, CollectionName.FLEET_PROVIDERS), orderBy('createdAt', 'desc'));
        return onSnapshot(q, snap => {
            setProviders(snap.docs.map(d => ({ id: d.id, ...d.data() } as FleetProvider)));
            setLoading(false);
        }, () => setLoading(false));
    }, [effectiveClientId]);

    const clientRole = (userProfile as any)?.clientRole || 'equipe_producao';
    const clientPermissions = (userProfile as any)?.clientPermissions || {};
    const podeCadastrar = !modoPortal || clientRole === 'admin_mestre' || clientPermissions.fleetCadastrarPrestadores === true;

    const filteredProviders = providers.filter(p =>
        p.nome.toLowerCase().includes(search.toLowerCase()) || p.cpfCnpj.includes(search)
    );

    return (
        <div className={embutido ? 'space-y-4' : 'max-w-6xl mx-auto space-y-6 pb-12'}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-brand-600" />
                        {effectiveClientName ? `Prestadores de ${effectiveClientName}` : 'Prestadores de Serviço'}
                    </h1>
                </div>
                {podeCadastrar && (
                    <button onClick={() => setModal({ open: true, provider: null })}
                        disabled={!effectiveClientId}
                        title={!effectiveClientId ? 'Selecione um cliente primeiro' : undefined}
                        className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus className="w-4 h-4" /> Novo Prestador
                    </button>
                )}
            </div>

            {!modoPortal && !embutido && !effectiveClientId && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    "Novo Prestador" fica desabilitado até você escolher um cliente específico no filtro abaixo — todo prestador precisa nascer vinculado a um cliente.
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
                    type="text" name="busca-prestadores" autoComplete="off"
                    placeholder="Buscar por nome ou CPF/CNPJ..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredProviders.length === 0 && (
                        <div className="col-span-full text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-500">
                                {effectiveClientId ? 'Nenhum prestador cadastrado.' : 'Selecione um cliente pra ver os prestadores.'}
                            </p>
                        </div>
                    )}
                    {filteredProviders.map(p => (
                        <ProviderCard key={p.id} p={p}
                            clientNome={!embutido ? clientesPorId.get(p.clientId) : undefined}
                            podeEditar={podeCadastrar}
                            onEdit={() => setModal({ open: true, provider: p })} />
                    ))}
                </div>
            )}

            {modal.open && (
                <ProviderForm clientId={effectiveClientId} clientName={effectiveClientName} clientes={clientes}
                    clienteTravado={embutido || modoPortal}
                    initial={modal.provider}
                    onClose={() => setModal({ open: false, provider: null })} />
            )}
        </div>
    );
};

export default FleetProviders;

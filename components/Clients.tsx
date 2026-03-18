import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, deleteDoc, doc, serverTimestamp,
  query, orderBy, onSnapshot, updateDoc, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Client, ClientContact, ClientStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Analytics } from '../utils/mgr-analytics';
import {
  Building, Plus, Trash2, Search, Phone, MapPin, User,
  Loader2, Save, X, Pencil, ChevronDown, ChevronUp,
  Globe, Mail, Tag, Users, Thermometer
} from 'lucide-react';
import ClientAssets from './ClientAssets';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ClientStatus, { label: string; cls: string }> = {
  novo:      { label: 'Novo',      cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  ativo:     { label: 'Ativo',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  inativo:   { label: 'Inativo',   cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  reativado: { label: 'Reativado', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
};

// ── Segment options ───────────────────────────────────────────────────────────
const SEGMENTS = [
  'Supermercado', 'Atacado / Distribuição', 'Indústria Alimentícia',
  'Restaurante / Food Service', 'Hospital / Clínica', 'Laboratório',
  'Hotel / Pousada', 'Condomínio', 'Outro',
];

// ── Contact role labels ───────────────────────────────────────────────────────
const CARGO_LABELS: Record<ClientContact['cargo'], string> = {
  decisor:     'Decisor / Sócio',
  financeiro:  'Financeiro',
  operacional: 'Operacional / TI',
  outro:       'Outro',
};

// ── Empty form ────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '',
  document: '',
  cnpj: '',
  razaoSocial: '',
  nomeFantasia: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  segment: '',
  address: '',
  contactName: '',
  contacts: [] as ClientContact[],
  status: 'novo' as ClientStatus,
  // Sprint 40 — geoloc
  geoLat: '',
  geoLng: '',
  geoRaio: '200',
  geoEndereco: '',
};

type FormData = typeof EMPTY_FORM;

// ── Client Modal (create + edit) ──────────────────────────────────────────────
interface ClientModalProps {
  initial?: Client | null;
  onClose: () => void;
}

const ClientModal: React.FC<ClientModalProps> = ({ initial, onClose }) => {
  const isEdit = !!initial;
  const { currentUser, userProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [capturandoGPS, setCapturandoGPS] = useState(false);
  const [form, setForm] = useState<FormData>({
    name:         initial?.name         || '',
    document:     initial?.document     || '',
    cnpj:         initial?.cnpj         || '',
    razaoSocial:  initial?.razaoSocial  || '',
    nomeFantasia: initial?.nomeFantasia || '',
    phone:        initial?.phone        || '',
    whatsapp:     initial?.whatsapp     || '',
    email:        initial?.email        || '',
    website:      initial?.website      || '',
    segment:      initial?.segment      || '',
    address:      initial?.address      || '',
    contactName:  initial?.contactName  || '',
    contacts:     (initial?.contacts    || []) as ClientContact[],
    status:       (initial as any)?.status || 'novo' as ClientStatus,
    geoLat:       String(initial?.geolocalizacao?.latitude  || ''),
    geoLng:       String(initial?.geolocalizacao?.longitude || ''),
    geoRaio:      String(initial?.geolocalizacao?.raioMetros ?? 200),
    geoEndereco:  initial?.geolocalizacao?.enderecoReferencia || '',
  });

  // Multiple contacts management
  const [newContact, setNewContact] = useState<Omit<ClientContact, 'id'>>({
    nome: '', cargo: 'operacional', phone: '', email: '', whatsapp: '',
  });
  const [showContactForm, setShowContactForm] = useState(false);

  const set = (field: keyof FormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm(p => ({ ...p, [field]: e.target.value }));

  const addContact = () => {
    if (!newContact.nome.trim()) return;
    setForm(p => ({
      ...p,
      contacts: [...p.contacts, { ...newContact, id: `c-${Date.now()}` }],
    }));
    setNewContact({ nome: '', cargo: 'operacional', phone: '', email: '', whatsapp: '' });
    setShowContactForm(false);
  };

  const removeContact = (id: string) =>
    setForm(p => ({ ...p, contacts: p.contacts.filter(c => c.id !== id) }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    const userId = currentUser?.uid || 'unknown';
    const userName = userProfile?.displayName || currentUser?.email || 'Gestor';
    try {
      const payload = {
        name:         form.name.trim(),
        document:     form.document.trim() || null,
        cnpj:         form.cnpj.trim()     || null,
        razaoSocial:  form.razaoSocial.trim()  || null,
        nomeFantasia: form.nomeFantasia.trim()  || null,
        phone:        form.phone.trim()     || null,
        whatsapp:     form.whatsapp.trim()  || null,
        email:        form.email.trim()     || null,
        website:      form.website.trim()   || null,
        segment:      form.segment          || null,
        address:      form.address.trim()   || null,
        contactName:  form.contactName.trim() || null,
        contacts:     form.contacts,
        status:       form.status,
        geolocalizacao: form.geoLat && form.geoLng ? {
          latitude:  parseFloat(form.geoLat),
          longitude: parseFloat(form.geoLng),
          raioMetros: parseInt(form.geoRaio) || 200,
          enderecoReferencia: form.geoEndereco.trim() || null,
        } : null,
        updatedAt:    serverTimestamp(),
      };

      if (isEdit && initial) {
        await updateDoc(doc(db, CollectionName.CLIENTS, initial.id), payload);
      } else {
        const docRef = await addDoc(collection(db, CollectionName.CLIENTS), {
          ...payload,
          totalOS: 0,
          createdAt: serverTimestamp(),
          _meta: Analytics.initMeta({ userId, userName, area: 'clientes', faseInicial: form.status }),
        });
        await Analytics.logEvent({
          eventType: 'cliente_criado',
          area: 'clientes',
          userId,
          userName,
          entityId: docRef.id,
          entityType: 'client',
          payload: { nome: form.name.trim(), status: form.status },
        });
      }
      onClose();
    } catch (err) {
      console.error('Erro ao salvar cliente:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-10">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Building className="w-5 h-5 text-brand-600" />
            {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
          </h2>
          <button onClick={onClose}><X className="w-6 h-6 text-gray-400 hover:text-gray-700" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* Section: Identificação */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Identificação</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome / Fantasia *</label>
                <input required value={form.name} onChange={set('name')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  placeholder="Nome fantasia da empresa" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Razão Social</label>
                  <input value={form.razaoSocial} onChange={set('razaoSocial')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                    placeholder="Razão Social Ltda." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ / CPF</label>
                  <input value={form.document} onChange={set('document')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                    placeholder="00.000.000/0001-00" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Segmento</label>
                <select value={form.segment} onChange={set('segment')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900">
                  <option value="">Selecionar segmento...</option>
                  {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status do cliente</label>
                <select value={form.status} onChange={set('status')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900">
                  {(Object.keys(STATUS_CONFIG) as ClientStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Section: Contato Principal */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Contato Principal</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                <input value={form.phone} onChange={set('phone')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                  placeholder="(11) 3333-3333" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input value={form.whatsapp} onChange={set('whatsapp')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                  placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input type="email" value={form.email} onChange={set('email')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                  placeholder="contato@empresa.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input value={form.website} onChange={set('website')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                  placeholder="www.empresa.com.br" />
              </div>
            </div>
          </section>

          {/* Section: Endereço */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Endereço</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Endereço Completo</label>
              <textarea rows={2} value={form.address} onChange={set('address')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900 resize-none"
                placeholder="Rua, Número, Bairro, Cidade - UF, CEP" />
            </div>
          </section>

          {/* Section: Geolocalizacao Sprint 40 */}
          <section>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Geolocalização (Check-in O.S.)</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
                  <input type="number" step="any" value={form.geoLat} onChange={set('geoLat')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                    placeholder="-23.550520" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
                  <input type="number" step="any" value={form.geoLng} onChange={set('geoLng')}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                    placeholder="-46.633309" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Raio de tolerância (m)</label>
                <input type="number" min={50} max={2000} step={50} value={form.geoRaio} onChange={set('geoRaio')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço de referência</label>
                <input value={form.geoEndereco} onChange={set('geoEndereco')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white text-gray-900"
                  placeholder="Rua X, 100 — São Paulo" />
              </div>
              <button type="button" disabled={capturandoGPS}
                onClick={() => {
                  setCapturandoGPS(true);
                  navigator.geolocation.getCurrentPosition(
                    pos => {
                      setForm(p => ({ ...p, geoLat: String(pos.coords.latitude), geoLng: String(pos.coords.longitude) }));
                      setCapturandoGPS(false);
                    },
                    () => { alert('Não foi possível obter GPS.'); setCapturandoGPS(false); }
                  );
                }}
                className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 px-3 py-2 rounded-lg hover:bg-brand-100 disabled:opacity-50">
                <MapPin className="w-4 h-4" />
                {capturandoGPS ? 'Capturando...' : 'Usar minha localização atual'}
              </button>
              {form.geoLat && form.geoLng && (
                <p className="text-[10px] text-emerald-600 font-semibold">✅ Geoloc cadastrada: {parseFloat(form.geoLat).toFixed(5)}, {parseFloat(form.geoLng).toFixed(5)}</p>
              )}
            </div>
          </section>

          {/* Section: Contactos */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Contactos por Papel</p>
              <button type="button" onClick={() => setShowContactForm(!showContactForm)}
                className="text-xs px-2 py-1 rounded-lg bg-brand-50 text-brand-700 font-bold flex items-center gap-1 border border-brand-200">
                <Plus className="w-3 h-3" /> Adicionar
              </button>
            </div>

            {/* Contact list */}
            {form.contacts.length > 0 && (
              <div className="space-y-2 mb-3">
                {form.contacts.map(c => (
                  <div key={c.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800">{c.nome}</p>
                      <p className="text-[10px] text-gray-500">{CARGO_LABELS[c.cargo]}{c.phone ? ` · ${c.phone}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => removeContact(c.id)}>
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add contact form */}
            {showContactForm && (
              <div className="border border-brand-100 rounded-xl p-3 bg-brand-50/30 space-y-2 mb-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={newContact.nome}
                    onChange={e => setNewContact(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome *"
                    className="col-span-2 rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white" />
                  <select value={newContact.cargo}
                    onChange={e => setNewContact(p => ({ ...p, cargo: e.target.value as ClientContact['cargo'] }))}
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm bg-white">
                    {Object.entries(CARGO_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input value={newContact.phone || ''}
                    onChange={e => setNewContact(p => ({ ...p, phone: e.target.value }))}
                    placeholder="Telefone"
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white" />
                  <input value={newContact.email || ''}
                    onChange={e => setNewContact(p => ({ ...p, email: e.target.value }))}
                    placeholder="E-mail"
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white" />
                  <input value={newContact.whatsapp || ''}
                    onChange={e => setNewContact(p => ({ ...p, whatsapp: e.target.value }))}
                    placeholder="WhatsApp"
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm bg-white" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowContactForm(false)}
                    className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-500">Cancelar</button>
                  <button type="button" onClick={addContact} disabled={!newContact.nome.trim()}
                    className="flex-1 text-xs py-1.5 rounded-lg bg-brand-600 text-white font-bold disabled:opacity-50">Adicionar</button>
                </div>
              </div>
            )}
          </section>

          {/* Footer */}
          <div className="pt-2 flex justify-end gap-3 border-t border-gray-100">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-75">
              {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Salvar Alterações' : 'Criar Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Clients ──────────────────────────────────────────────────────────────
const Clients: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; client: Client | null }>({ open: false, client: null });
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'todos'>('todos');

  useEffect(() => {
    const q = query(collection(db, CollectionName.CLIENTS), orderBy('name', 'asc'));
    return onSnapshot(q, snap => {
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setLoading(false);
    }, err => { console.error('Clients:', err); setLoading(false); });
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Remover este cliente permanentemente?')) return;
    await deleteDoc(doc(db, CollectionName.CLIENTS, id)).catch(console.error);
  };

  const filtered = clients.filter(c => {
    const matchText =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.contactName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (c.segment?.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchStatus = statusFilter === 'todos' || (c as any).status === statusFilter;
    return matchText && matchStatus;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Carteira de Clientes</h1>
          <p className="text-gray-500 text-sm">Cadastro 360º de clientes e ativos.</p>
        </div>
        <button onClick={() => setModal({ open: true, client: null })}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 shadow-sm gap-2 text-sm font-bold">
          <Plus className="w-4 h-4" /> Novo Cliente
        </button>
      </div>

      {/* Search + Status filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900 placeholder-gray-400"
            placeholder="Buscar por nome, contato ou segmento..." />
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['todos', 'novo', 'ativo', 'inativo', 'reativado'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                statusFilter === s
                  ? s === 'todos' ? 'bg-gray-800 text-white border-gray-800' : STATUS_CONFIG[s as ClientStatus].cls
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
              }`}>
              {s === 'todos' ? 'Todos' : STATUS_CONFIG[s as ClientStatus].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Building className="mx-auto h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhum cliente encontrado</h3>
              <p className="text-gray-500 text-sm">Cadastre um novo cliente para começar.</p>
            </div>
          )}

          {filtered.map(client => {
            const isExpanded = expandedId === client.id;
            return (
              <div key={client.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                {/* Card header */}
                <div className="p-5 flex items-start gap-4">
                  <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center text-brand-600 flex-shrink-0">
                    <Building className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{client.name}</h3>
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {client.document && <span className="text-xs text-gray-400 font-mono">{client.document}</span>}
                          {client.segment && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-brand-50 text-brand-700 rounded-full border border-brand-100">
                              {client.segment}
                            </span>
                          )}
                          {(client as any).status && STATUS_CONFIG[(client as any).status as ClientStatus] && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CONFIG[(client as any).status as ClientStatus].cls}`}>
                              {STATUS_CONFIG[(client as any).status as ClientStatus].label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => setModal({ open: true, client })}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                          title="Editar cliente">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(client.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Remover cliente">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Quick info row */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-gray-500">
                      {(client.contactName || (client.contacts && client.contacts.length > 0)) && (
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          {client.contacts?.length ? `${client.contacts.length} contacto(s)` : client.contactName}
                        </span>
                      )}
                      {client.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {client.phone}</span>}
                      {client.address && (
                        <span className="flex items-center gap-1 truncate max-w-xs">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{client.address}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expand toggle (ativos) */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  className="w-full px-5 py-2.5 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                  <span className="flex items-center gap-1.5"><Thermometer className="w-3.5 h-3.5 text-brand-500" /> Ativos e Equipamentos</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 p-5 bg-gray-50/50">
                    <ClientAssets clientId={client.id} clientName={client.name} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal.open && (
        <ClientModal
          initial={modal.client}
          onClose={() => setModal({ open: false, client: null })}
        />
      )}
    </div>
  );
};

export default Clients;
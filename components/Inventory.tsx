/**
 * components/Inventory.tsx — Sprint 48
 * Almoxarifado com CRUD completo via Firestore.
 */
import React, { useState, useEffect } from 'react';
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  Package, Search, Plus, Edit2, Trash2, X, Save, Loader2,
  AlertTriangle, CheckCircle2, ChevronDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────
interface InventoryItem {
  id: string;
  nome: string;
  sku?: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  custoUnitario?: number;
  minEstoque?: number;
  descricao?: string;
  createdAt?: any;
  updatedAt?: any;
}

const COLLECTION = 'inventory_items';

const CATEGORIAS = ['EPI', 'Ferramenta', 'Eletrônico', 'Elétrico', 'Hidráulico', 'Peça de Reposição', 'Material de Consumo', 'Outro'];
const UNIDADES   = ['un', 'cx', 'kg', 'm', 'm²', 'L', 'par', 'kit'];

const EMPTY: Omit<InventoryItem, 'id'> = {
  nome: '', sku: '', categoria: 'Ferramenta', quantidade: 0,
  unidade: 'un', custoUnitario: 0, minEstoque: 0, descricao: '',
};

// ── Item Form Modal ────────────────────────────────────────────────────────────
interface FormModalProps {
  initial?: InventoryItem | null;
  onClose: () => void;
  onSave: (data: Omit<InventoryItem, 'id'>) => Promise<void>;
}
const FormModal: React.FC<FormModalProps> = ({ initial, onClose, onSave }) => {
  const [form, setForm] = useState<Omit<InventoryItem, 'id'>>(
    initial ? { ...initial } : { ...EMPTY }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nome.trim()) return setErr('Nome é obrigatório.');
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (e: any) { setErr(e.message || 'Erro ao salvar'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '90vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold text-gray-900 text-sm">
            {initial ? '✏️ Editar Item' : '➕ Novo Item'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {err && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <AlertTriangle size={12} /> {err}
            </div>
          )}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Nome *</label>
            <input value={form.nome} onChange={e => set('nome', e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">SKU / Código</label>
              <input value={form.sku || ''} onChange={e => set('sku', e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Categoria</label>
              <div className="relative">
                <select value={form.categoria} onChange={e => set('categoria', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-300 pr-7">
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Quantidade</label>
              <input type="number" min={0} value={form.quantidade} onChange={e => set('quantidade', Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Unidade</label>
              <div className="relative">
                <select value={form.unidade} onChange={e => set('unidade', e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-brand-300 pr-7">
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Custo Unitário (R$)</label>
              <input type="number" min={0} step={0.01} value={form.custoUnitario || 0} onChange={e => set('custoUnitario', Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">Estoque Mínimo</label>
              <input type="number" min={0} value={form.minEstoque || 0} onChange={e => set('minEstoque', Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">Descrição</label>
            <textarea value={form.descricao || ''} onChange={e => set('descricao', e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
        </div>
        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.nome.trim()}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const Inventory: React.FC = () => {
  const { userProfile } = useAuth();
  const isGestor = ['admin', 'gestor', 'manager'].includes(userProfile?.role || '');

  const [items, setItems]   = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]  = useState('');
  const [catFilter, setCatFilter] = useState('Todas');
  const [formItem, setFormItem] = useState<InventoryItem | null | 'new'>('new' as any);
  const [showForm, setShowForm] = useState(false);
  const [success, setSuccess]   = useState('');

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('nome'));
    return onSnapshot(q, snap => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  const toast = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleSave = async (data: Omit<InventoryItem, 'id'>) => {
    if (formItem && typeof formItem === 'object' && formItem.id) {
      await updateDoc(doc(db, COLLECTION, formItem.id), { ...data, updatedAt: serverTimestamp() });
      toast('Item atualizado ✓');
    } else {
      await addDoc(collection(db, COLLECTION), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      toast('Item adicionado ✓');
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Excluir "${nome}"?`)) return;
    await deleteDoc(doc(db, COLLECTION, id));
    toast('Item removido');
  };

  const filtered = items.filter(item => {
    const matchSearch = item.nome.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku?.toLowerCase().includes(search.toLowerCase()));
    const matchCat = catFilter === 'Todas' || item.categoria === catFilter;
    return matchSearch && matchCat;
  });

  const totalValue = filtered.reduce((s, i) => s + i.quantidade * (i.custoUnitario || 0), 0);
  const lowStock   = filtered.filter(i => i.minEstoque && i.quantidade <= i.minEstoque).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Almoxarifado</h1>
          <p className="text-sm text-gray-500">Gestão de materiais, ferramentas e equipamentos</p>
        </div>
        {isGestor && (
          <button onClick={() => { setFormItem(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-bold shadow-sm">
            <Plus size={16} /> Novo Item
          </button>
        )}
      </div>

      {/* Toast */}
      {success && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium px-4 py-2.5 rounded-2xl">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Total de Itens</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">{items.length}</p>
        </div>
        <div className={`rounded-2xl border p-4 shadow-sm ${lowStock > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className={`text-xs font-semibold ${lowStock > 0 ? 'text-red-500' : 'text-gray-500'}`}>Estoque Baixo</p>
          <p className={`text-2xl font-extrabold mt-1 ${lowStock > 0 ? 'text-red-700' : 'text-gray-900'}`}>{lowStock}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-semibold">Valor em Estoque</p>
          <p className="text-2xl font-extrabold text-gray-900 mt-1">
            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Buscar nome ou SKU..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-200" />
        </div>
        <div className="relative">
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
            className="border border-gray-200 rounded-xl text-sm px-4 py-2 bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-brand-200">
            <option>Todas</option>
            {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center p-20 bg-white rounded-2xl border border-gray-200">
          <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
          {/* Desktop header */}
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
            <div className="col-span-4">Item</div>
            <div className="col-span-2">Categoria</div>
            <div className="col-span-2 text-center">Qtd / Un</div>
            <div className="col-span-2 text-center">Custo Un.</div>
            <div className="col-span-1 text-center">Status</div>
            {isGestor && <div className="col-span-1 text-center">Ações</div>}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum item encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map(item => {
                const isLow = !!(item.minEstoque && item.quantidade <= item.minEstoque);
                return (
                  <div key={item.id} className="md:grid md:grid-cols-12 md:gap-2 md:items-center px-4 py-3 hover:bg-gray-50 transition-colors flex flex-col gap-2">
                    {/* Item name */}
                    <div className="col-span-4 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package size={14} className="text-brand-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{item.nome}</p>
                          {item.sku && <p className="text-[10px] text-gray-400">{item.sku}</p>}
                        </div>
                      </div>
                    </div>
                    {/* Category */}
                    <div className="col-span-2 text-xs text-gray-600">{item.categoria}</div>
                    {/* Qty */}
                    <div className="col-span-2 text-center">
                      <span className={`text-sm font-bold ${isLow ? 'text-red-600' : 'text-gray-900'}`}>{item.quantidade}</span>
                      <span className="text-[10px] text-gray-400 ml-1">{item.unidade}</span>
                    </div>
                    {/* Cost */}
                    <div className="col-span-2 text-center text-xs text-gray-600">
                      {item.custoUnitario ? `R$ ${item.custoUnitario.toFixed(2)}` : '—'}
                    </div>
                    {/* Status */}
                    <div className="col-span-1 flex justify-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isLow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {isLow ? 'Baixo' : 'OK'}
                      </span>
                    </div>
                    {/* Actions */}
                    {isGestor && (
                      <div className="col-span-1 flex items-center justify-center gap-1">
                        <button onClick={() => { setFormItem(item); setShowForm(true); }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDelete(item.id, item.nome)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <FormModal
          initial={formItem && typeof formItem === 'object' ? formItem : null}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Inventory;
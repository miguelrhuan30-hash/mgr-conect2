/**
 * components/Fornecedores.tsx
 * Cadastro e gestão do banco de fornecedores.
 * Cada fornecedor tem: nome, especialidades (tags), responsável, WhatsApp, e-mail, CNPJ.
 */
import React, { useState, useMemo } from 'react';
import {
  Plus, Search, Truck, Phone, Mail, Tag, Edit2, Trash2,
  Loader2, X, Check, MessageCircle, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useFornecedores } from '../hooks/useFornecedores';
import { Fornecedor } from '../types';

// ── Paleta de cores para especialidades ─────────────────────────────────────
const TAG_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-orange-100 text-orange-700 border-orange-200',
];
const tagColor = (idx: number) => TAG_COLORS[idx % TAG_COLORS.length];

const fmtPhone = (tel: string) => {
  const d = tel.replace(/\D/g, '');
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return tel;
};

// ── Modal de Criação/Edição ──────────────────────────────────────────────────
const FornecedorModal: React.FC<{
  initial?: Partial<Fornecedor>;
  onSave: (data: Omit<Fornecedor, 'id' | 'criadoEm' | 'criadoPor'>) => Promise<void>;
  onClose: () => void;
}> = ({ initial, onSave, onClose }) => {
  const [nome, setNome] = useState(initial?.nome || '');
  const [responsavelNome, setResponsavelNome] = useState(initial?.responsavelNome || '');
  const [telefoneWhatsApp, setTelefoneWhatsApp] = useState(initial?.telefoneWhatsApp || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [cnpj, setCnpj] = useState(initial?.cnpj || '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes || '');
  const [especialidades, setEspecialidades] = useState<string[]>(initial?.especialidades || []);
  const [novaEspec, setNovaEspec] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const addEspec = () => {
    const v = novaEspec.trim();
    if (v && !especialidades.includes(v)) setEspecialidades(p => [...p, v]);
    setNovaEspec('');
  };
  const removeEspec = (e: string) => setEspecialidades(p => p.filter(x => x !== e));

  const handleSave = async () => {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return; }
    if (!responsavelNome.trim()) { setErro('Nome do responsável é obrigatório.'); return; }
    if (!telefoneWhatsApp.trim()) { setErro('WhatsApp é obrigatório.'); return; }
    setSaving(true);
    try {
      await onSave({ nome: nome.trim(), responsavelNome, telefoneWhatsApp: telefoneWhatsApp.replace(/\D/g, ''), email, cnpj, observacoes, especialidades, ativo: true });
      onClose();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao salvar.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-white text-base flex items-center gap-2">
            <Truck className="w-5 h-5" />
            {initial?.nome ? 'Editar Fornecedor' : 'Novo Fornecedor'}
          </h2>
          <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {erro && <div className="bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-xl border border-red-200">{erro}</div>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { label: 'Nome do Fornecedor *', value: nome, set: setNome, placeholder: 'ex: Frigomaq Equipamentos' },
              { label: 'Responsável Comercial *', value: responsavelNome, set: setResponsavelNome, placeholder: 'Nome do contato' },
              { label: 'WhatsApp * (com DDD)', value: telefoneWhatsApp, set: setTelefoneWhatsApp, placeholder: '5511999999999' },
              { label: 'E-mail', value: email, set: setEmail, placeholder: 'comercial@fornecedor.com' },
              { label: 'CNPJ', value: cnpj, set: setCnpj, placeholder: '00.000.000/0001-00' },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs font-bold text-gray-600 block mb-1">{f.label}</label>
                <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            ))}
          </div>

          {/* Especialidades */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Especialidades (o que ele fornece)
            </label>
            <div className="flex gap-2 mb-2">
              <input value={novaEspec} onChange={e => setNovaEspec(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEspec()}
                placeholder="ex: câmaras frias, portas rápidas, prateleiras..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              <button onClick={addEspec} disabled={!novaEspec.trim()}
                className="px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-40">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {especialidades.map((e, i) => (
                <span key={e} className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${tagColor(i)}`}>
                  {e}
                  <button onClick={() => removeEspec(e)} className="hover:opacity-60 ml-0.5">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </span>
              ))}
              {especialidades.length === 0 && <span className="text-xs text-gray-400">Nenhuma especialidade adicionada</span>}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Condições gerais, marcas, regiões de atendimento..." />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Salvar Fornecedor
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Card de Fornecedor ────────────────────────────────────────────────────────
const FornecedorCard: React.FC<{
  fornecedor: Fornecedor;
  onEditar: () => void;
  onRemover: () => void;
}> = ({ fornecedor, onEditar, onRemover }) => {
  const [expandido, setExpandido] = useState(false);
  const inicial = fornecedor.nome.charAt(0).toUpperCase();
  const waUrl = `https://wa.me/${fornecedor.telefoneWhatsApp.replace(/\D/g, '')}`;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center text-white font-extrabold text-xl flex-shrink-0">
            {inicial}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{fornecedor.nome}</h3>
                <p className="text-xs text-gray-500">{fornecedor.responsavelNome}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={onEditar}
                  className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => window.confirm(`Remover ${fornecedor.nome}?`) && onRemover()}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Especialidades */}
            {fornecedor.especialidades.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {fornecedor.especialidades.map((e, i) => (
                  <span key={e} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${tagColor(i)}`}>{e}</span>
                ))}
              </div>
            )}

            {/* Ações rápidas */}
            <div className="flex items-center gap-2 mt-3">
              <a href={waUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-600 transition-colors">
                <MessageCircle className="w-3 h-3" />
                WhatsApp
              </a>
              {fornecedor.email && (
                <a href={`mailto:${fornecedor.email}`}
                  className="flex items-center gap-1 px-2.5 py-1 border border-gray-200 text-gray-600 rounded-lg text-[10px] font-bold hover:bg-gray-50 transition-colors">
                  <Mail className="w-3 h-3" />
                  Email
                </a>
              )}
              <button onClick={() => setExpandido(!expandido)}
                className="ml-auto flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-600">
                {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {expandido ? 'Menos' : 'Mais'}
              </button>
            </div>

            {expandido && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {fmtPhone(fornecedor.telefoneWhatsApp)}
                </div>
                {fornecedor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                    {fornecedor.email}
                  </div>
                )}
                {fornecedor.cnpj && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    {fornecedor.cnpj}
                  </div>
                )}
                {fornecedor.observacoes && (
                  <p className="text-gray-500 italic pl-5">{fornecedor.observacoes}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Componente Principal ──────────────────────────────────────────────────────
const Fornecedores: React.FC = () => {
  const { fornecedores, loading, addFornecedor, updateFornecedor, deleteFornecedor } = useFornecedores();
  const [busca, setBusca] = useState('');
  const [filtroEspec, setFiltroEspec] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Fornecedor | null>(null);

  // Lista única de especialidades para filtro
  const todasEspecialidades = useMemo(() => {
    const set = new Set<string>();
    fornecedores.forEach(f => f.especialidades.forEach(e => set.add(e)));
    return Array.from(set).sort();
  }, [fornecedores]);

  const lista = useMemo(() => {
    let r = fornecedores.filter(f => f.ativo !== false);
    const q = busca.toLowerCase().trim();
    if (q) r = r.filter(f => f.nome.toLowerCase().includes(q) || f.responsavelNome.toLowerCase().includes(q) || f.especialidades.some(e => e.toLowerCase().includes(q)));
    if (filtroEspec) r = r.filter(f => f.especialidades.includes(filtroEspec));
    return r;
  }, [fornecedores, busca, filtroEspec]);

  const handleSave = async (data: Omit<Fornecedor, 'id' | 'criadoEm' | 'criadoPor'>) => {
    if (editando) await updateFornecedor(editando.id, data);
    else await addFornecedor(data);
    setEditando(null);
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-brand-600" /> Fornecedores
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Banco de dados de fornecedores de materiais e equipamentos</p>
        </div>
        <button onClick={() => { setEditando(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white rounded-xl font-bold text-sm hover:bg-brand-700 transition-colors">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </button>
      </div>

      {/* KPIs rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de Fornecedores', value: fornecedores.filter(f => f.ativo !== false).length, color: 'text-brand-600' },
          { label: 'Especialidades Mapeadas', value: todasEspecialidades.length, color: 'text-emerald-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-xs text-gray-400 font-medium">{k.label}</p>
            <p className={`text-3xl font-extrabold mt-1 ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Busca + filtro */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome, responsável ou especialidade..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        {todasEspecialidades.length > 0 && (
          <select value={filtroEspec} onChange={e => setFiltroEspec(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400">
            <option value="">Todas as especialidades</option>
            {todasEspecialidades.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-16">
          <Truck className="w-12 h-12 mx-auto text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">
            {fornecedores.length === 0 ? 'Nenhum fornecedor cadastrado ainda.' : 'Nenhum resultado para esta busca.'}
          </p>
          {fornecedores.length === 0 && (
            <button onClick={() => setShowModal(true)}
              className="mt-3 text-brand-600 font-bold text-sm hover:underline">
              Cadastrar primeiro fornecedor →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map(f => (
            <FornecedorCard key={f.id} fornecedor={f}
              onEditar={() => { setEditando(f); setShowModal(true); }}
              onRemover={() => deleteFornecedor(f.id)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <FornecedorModal
          initial={editando || undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditando(null); }}
        />
      )}
    </div>
  );
};

export default Fornecedores;

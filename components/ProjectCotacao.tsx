/**
 * components/ProjectCotacao.tsx — Sprint 2
 *
 * Gestão de cotações de projeto: cadastro de fornecedores,
 * itens/preços, upload de PDF, seleção de vencedora, comparativo.
 */
import React, { useState, useEffect } from 'react';
import {
  Plus, Trash2, Upload, Check, Star, Loader2,
  FileText, Package, ExternalLink, ChevronDown, ChevronUp,
  Link2, Search as SearchIcon,
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useProjectCotacao } from '../hooks/useProjectCotacao';
import type { CotacaoItem } from '../types';
import type { ProjectCotacao as ProjectCotacaoType } from '../types';
import { CollectionName } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props { projectId: string; }

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), 'dd/MM/yy', { locale: ptBR }); }
  catch { return '—'; }
};

// ── FormulárioItem ──
const ItemRow: React.FC<{
  item: CotacaoItem;
  onChange: (f: keyof CotacaoItem, v: any) => void;
  onRemove: () => void;
}> = ({ item, onChange, onRemove }) => (
  <div className="grid grid-cols-12 gap-2 items-center">
    <input value={item.descricao} onChange={e => onChange('descricao', e.target.value)}
      className="col-span-4 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
      placeholder="Descrição do item" />
    <input type="number" value={item.quantidade} onChange={e => onChange('quantidade', Number(e.target.value))}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center"
      min={1} />
    <input value={item.unidade || ''} onChange={e => onChange('unidade', e.target.value)}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center"
      placeholder="un" />
    <input type="number" value={item.valorUnitario} onChange={e => {
      const vu = Number(e.target.value);
      onChange('valorUnitario', vu);
      onChange('valorTotal', vu * item.quantidade);
    }}
      className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
      placeholder="R$ unit." />
    <div className="col-span-2 px-2 py-1.5 bg-gray-50 rounded-lg text-xs font-bold text-gray-700 text-right">
      {fmtCurrency(item.valorTotal)}
    </div>
    <button onClick={onRemove} className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50 text-red-400">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
    <input value={item.prazoEntrega || ''} onChange={e => onChange('prazoEntrega', e.target.value)}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
      placeholder="Prazo" />
  </div>
);

const newItem = (): CotacaoItem => ({
  id: Math.random().toString(36).slice(2),
  descricao: '',
  quantidade: 1,
  unidade: 'un',
  valorUnitario: 0,
  valorTotal: 0,
});

// ── Formulário nova cotação ──
const NovaCotacaoForm: React.FC<{
  projectId: string;
  onSave: () => void;
  onCancel: () => void;
  addCotacao: (d: any) => Promise<string>;
  calcularTotal: (i: CotacaoItem[]) => number;
}> = ({ onSave, onCancel, addCotacao, calcularTotal }) => {
  const [fornecedor, setFornecedor] = useState('');
  const [contato, setContato] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [condicoes, setCondicoes] = useState('');
  const [prazoGeral, setPrazoGeral] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<CotacaoItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, field: keyof CotacaoItem, value: any) => {
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };
  const addItem = () => setItens(prev => [...prev, newItem()]);
  const removeItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx));
  const total = calcularTotal(itens);

  const handleSave = async () => {
    if (!fornecedor.trim()) return;
    setSaving(true);
    try {
      await addCotacao({
        fornecedor,
        fornecedorContato: contato,
        fornecedorEmail: email,
        fornecedorTelefone: telefone,
        itens,
        valorTotal: total,
        condicoesPagamento: condicoes,
        prazoEntregaGeral: prazoGeral,
        observacoes,
        selecionada: false,
      });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-5">
      <h4 className="font-bold text-gray-900">Nova Cotação</h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Fornecedor *', value: fornecedor, set: setFornecedor, placeholder: 'Nome do fornecedor' },
          { label: 'Contato', value: contato, set: setContato, placeholder: 'Nome do responsável' },
          { label: 'E-mail', value: email, set: setEmail, placeholder: 'email@fornecedor.com' },
          { label: 'Telefone', value: telefone, set: setTelefone, placeholder: '(00) 00000-0000' },
          { label: 'Condições de Pagamento', value: condicoes, set: setCondicoes, placeholder: 'Ex: 30/60/90 dias' },
          { label: 'Prazo de Entrega Geral', value: prazoGeral, set: setPrazoGeral, placeholder: 'Ex: 15 dias úteis' },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs font-bold text-gray-600 block mb-1">{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder={f.placeholder} />
          </div>
        ))}
      </div>

      {/* Itens */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">
          <span className="col-span-4">Descrição</span>
          <span className="col-span-1 text-center">Qtd</span>
          <span className="col-span-1 text-center">Un</span>
          <span className="col-span-2">Vl. Unit.</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-1"></span>
          <span className="col-span-1">Prazo</span>
        </div>
        {itens.map((item, i) => (
          <ItemRow key={item.id} item={item}
            onChange={(f, v) => updateItem(i, f, v)}
            onRemove={() => removeItem(i)} />
        ))}
        <button onClick={addItem}
          className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 mt-2">
          <Plus className="w-3.5 h-3.5" /> Adicionar Item
        </button>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
        <span className="text-sm font-bold text-gray-600">Total da Cotação</span>
        <span className="text-xl font-extrabold text-gray-900">{fmtCurrency(total)}</span>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
          placeholder="Observações adicionais sobre esta cotação..." />
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSave} disabled={saving || !fornecedor.trim()}
          className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Salvar Cotação
        </button>
      </div>
    </div>
  );
};

// ── Card de cotação ──
const CotacaoCard: React.FC<{
  cotacao: ProjectCotacaoType;
  isBest: boolean;
  onSelect: () => void;
  onUpload: (f: File) => void;
  uploading: boolean;
}> = ({ cotacao, isBest, onSelect, onUpload, uploading }) => {
  const [expanded, setExpanded] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      cotacao.selecionada
        ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md'
        : isBest ? 'border-green-200 bg-green-50/30'
        : 'border-gray-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900">{cotacao.fornecedor}</h4>
              {cotacao.selecionada && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">
                  ✓ SELECIONADA
                </span>
              )}
              {isBest && !cotacao.selecionada && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full">
                  💰 MENOR PREÇO
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              {cotacao.fornecedorContato && <span>{cotacao.fornecedorContato}</span>}
              {cotacao.prazoEntregaGeral && <span>📦 {cotacao.prazoEntregaGeral}</span>}
              {cotacao.condicoesPagamento && <span>💳 {cotacao.condicoesPagamento}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-extrabold text-gray-900">{fmtCurrency(cotacao.valorTotal)}</p>
            <p className="text-[10px] text-gray-400">{fmtDate(cotacao.criadoEm)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button onClick={onSelect}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
              cotacao.selecionada
                ? 'bg-emerald-100 text-emerald-700'
                : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {cotacao.selecionada ? <Check className="w-3.5 h-3.5" /> : <Star className="w-3.5 h-3.5" />}
            {cotacao.selecionada ? 'Selecionada' : 'Selecionar'}
          </button>

          {cotacao.documentoUrl ? (
            <a href={cotacao.documentoUrl} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-blue-200 text-blue-600 hover:bg-blue-50 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5" /> Ver PDF
            </a>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 flex items-center gap-1">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload PDF
            </button>
          )}

          <button onClick={() => setExpanded(!expanded)}
            className="ml-auto px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:bg-gray-50 flex items-center gap-1">
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {cotacao.itens.length} itens
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            {cotacao.itens.map((item: CotacaoItem, i: number) => (
              <div key={i} className="grid grid-cols-12 gap-2 text-xs text-gray-600">
                <span className="col-span-5">{item.descricao || '—'}</span>
                <span className="col-span-2 text-center text-gray-400">{item.quantidade} {item.unidade}</span>
                <span className="col-span-2 text-right">{fmtCurrency(item.valorUnitario)}</span>
                <span className="col-span-3 text-right font-bold">{fmtCurrency(item.valorTotal)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </div>
  );
};

// ── Modal: Importar Orçamento Legado — Sprint 13 ──
const ImportarOrcamentoModal: React.FC<{
  onImport: (nome: string, itens: CotacaoItem[], total: number) => void;
  onClose: () => void;
}> = ({ onImport, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(query(
          collection(db, CollectionName.OS_ORCAMENTOS),
          orderBy('criadoEm', 'desc'), limit(60)
        ));
        setOrcamentos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* coleção vazia ou erro */ }
      setLoading(false);
    };
    load();
  }, []);

  const filtrados = orcamentos.filter(o => {
    const q = busca.toLowerCase();
    return !q || (o.clientName || o.nomeCliente || '').toLowerCase().includes(q)
      || (o.titulo || o.descricao || '').toLowerCase().includes(q);
  });

  const handleConfirm = () => {
    if (!selecionado) return;
    const itensRaw: any[] = selecionado.itens || [];
    const itens: CotacaoItem[] = itensRaw.map((it: any) => ({
      id: it.id || String(Math.random()),
      descricao: it.descricao || it.nome || it.titulo || '',
      quantidade: Number(it.quantidade) || 1,
      unidade: it.unidade || 'un',
      valorUnitario: Number(it.valorUnitario || it.precoUnitario) || 0,
      valorTotal: Number(it.valorTotal || it.total) || 0,
    }));
    const total = itens.reduce((s, i) => s + i.valorTotal, 0);
    onImport(
      selecionado.clientName || selecionado.nomeCliente || 'Orçamento Importado',
      itens, total
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-4 h-4 text-brand-600" />
            Importar Orçamento Existente
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <span className="text-xs font-bold text-gray-400">✕</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input placeholder="Buscar por cliente ou título..." value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl" />
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">Nenhum orçamento encontrado.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {filtrados.map(o => (
                <button key={o.id} onClick={() => setSelecionado(o === selecionado ? null : o)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    selecionado?.id === o.id
                      ? 'border-brand-400 bg-brand-50 ring-2 ring-brand-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">
                        {o.clientName || o.nomeCliente || 'Sem cliente'}
                      </p>
                      <p className="text-[10px] text-gray-500 truncate">
                        {o.titulo || o.descricao || 'Sem título'}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {(o.itens?.length || 0)} itens
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-extrabold text-gray-900">
                        {fmtCurrency(o.valorTotal || o.total || 0)}
                      </p>
                      {selecionado?.id === o.id && (
                        <Check className="w-4 h-4 text-brand-600 ml-auto mt-1" />
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={!selecionado}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Importar Selecionado
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ──
const ProjectCotacao: React.FC<Props> = ({ projectId }) => {
  const { cotacoes, loading, cotacaoSelecionada, addCotacao, selecionarCotacao, uploadDocumento, calcularTotal } = useProjectCotacao(projectId);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const menorPreco = cotacoes.length > 0
    ? cotacoes.reduce((best, c) => c.valorTotal < best.valorTotal ? c : best, cotacoes[0])
    : null;

  const handleUpload = async (cotacaoId: string, file: File) => {
    setUploadingId(cotacaoId);
    try { await uploadDocumento(cotacaoId, file); }
    finally { setUploadingId(null); }
  };

  // Importar orçamento legado como nova cotação — Sprint 13
  const handleImport = async (fornecedor: string, itens: CotacaoItem[], total: number) => {
    await addCotacao({
      projectId,
      fornecedor,
      fornecedorContato: '',
      prazoEntregaGeral: '',
      condicoesPagamento: '',
      observacoes: '⚠️ Importado do módulo Orçamento',
      itens,
      valorTotal: total,
      selecionada: false,
    });
    setShowImport(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">💰 Cotações</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-brand-200 text-brand-700 rounded-xl text-xs font-bold hover:bg-brand-50">
            <Link2 className="w-3.5 h-3.5" />
            Importar Orçamento
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700">
            <Plus className="w-3.5 h-3.5" />
            Nova Cotação
          </button>
        </div>
      </div>

      {/* Comparativo resumido */}
      {cotacoes.length >= 2 && (
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl p-4 border border-gray-200">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-3">Comparativo</p>
          <div className="space-y-2">
            {[...cotacoes].sort((a, b) => a.valorTotal - b.valorTotal).map((c, i) => {
              const max = Math.max(...cotacoes.map(x => x.valorTotal));
              const pct = Math.round((c.valorTotal / max) * 100);
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-28 truncate font-medium">{c.fornecedor}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className={`h-2 rounded-full ${i === 0 ? 'bg-green-500' : 'bg-blue-400'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-900 w-24 text-right">{fmtCurrency(c.valorTotal)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <NovaCotacaoForm projectId={projectId}
          onSave={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
          addCotacao={addCotacao}
          calcularTotal={calcularTotal} />
      )}

      {cotacoes.length === 0 && !showForm ? (
        <div className="text-center py-10 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Nenhuma cotação cadastrada ainda.</p>
          <button onClick={() => setShowForm(true)}
            className="mt-3 text-brand-600 text-sm font-bold hover:underline">
            Adicionar primeira cotação →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cotacoes.map(c => (
            <CotacaoCard key={c.id} cotacao={c}
              isBest={menorPreco?.id === c.id}
              onSelect={() => selecionarCotacao(c.id)}
              onUpload={f => handleUpload(c.id, f)}
              uploading={uploadingId === c.id} />
          ))}
        </div>
      )}

      {/* Modal: Importar Orçamento */}
      {showImport && (
        <ImportarOrcamentoModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
};

export default ProjectCotacao;

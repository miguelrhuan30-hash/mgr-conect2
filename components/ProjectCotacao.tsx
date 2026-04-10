/**
 * components/ProjectCotacao.tsx — Módulo de Cotações com Grupos
 *
 * Gestão de cotações agrupadas por categoria:
 *   - Categorias: ex "Câmara Fria Completa", "Portas Rápidas", "Prateleiras"
 *   - Cada categoria tem N cotações de N fornecedores
 *   - Comparativo por grupo
 *   - Upload de PDF por cotação
 *   - Seleção de vencedor por grupo
 *   - Botão "Cotações Recebidas" → avança fase para cotacao_recebida
 *                                  → atualiza sub-status lead para 'material_cotado'
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Upload, Check, Star, Loader2,
  FileText, Package, ExternalLink, ChevronDown, ChevronUp,
  Link2, Search as SearchIcon, Tag, X, Archive,
} from 'lucide-react';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useProjectCotacao } from '../hooks/useProjectCotacao';
import { useProject } from '../hooks/useProject';
import { useProjectLeads } from '../hooks/useProjectLeads';
import type { CotacaoItem, CotacaoCategoria } from '../types';
import type { ProjectCotacao as ProjectCotacaoType } from '../types';
import { CollectionName } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Paleta de cores por categoria ──────────────────────────────────────────
const COR_PALETTE = [
  { id: 'blue',   bg: 'bg-blue-100',   text: 'text-blue-700',   border: 'border-blue-300',   dot: 'bg-blue-500'   },
  { id: 'amber',  bg: 'bg-amber-100',  text: 'text-amber-700',  border: 'border-amber-300',  dot: 'bg-amber-500'  },
  { id: 'emerald',bg: 'bg-emerald-100',text: 'text-emerald-700',border: 'border-emerald-300',dot: 'bg-emerald-500'},
  { id: 'violet', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-300', dot: 'bg-violet-500' },
  { id: 'rose',   bg: 'bg-rose-100',   text: 'text-rose-700',   border: 'border-rose-300',   dot: 'bg-rose-500'   },
  { id: 'cyan',   bg: 'bg-cyan-100',   text: 'text-cyan-700',   border: 'border-cyan-300',   dot: 'bg-cyan-500'   },
];
const getCor = (cor?: string) => COR_PALETTE.find(c => c.id === cor) || COR_PALETTE[0];

// ── Props ───────────────────────────────────────────────────────────────────
interface Props {
  projectId: string;
  leadId?: string;
  categoriasCotacao?: CotacaoCategoria[];
}

// ── Utils ───────────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), 'dd/MM/yy', { locale: ptBR }); }
  catch { return '—'; }
};
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── ItemRow para formulário ─────────────────────────────────────────────────
const newItem = (): CotacaoItem => ({
  id: makeId(), descricao: '', quantidade: 1, unidade: 'un', valorUnitario: 0, valorTotal: 0,
});

const ItemRow: React.FC<{ item: CotacaoItem; onChange: (f: keyof CotacaoItem, v: any) => void; onRemove: () => void }> = ({ item, onChange, onRemove }) => (
  <div className="grid grid-cols-12 gap-2 items-center">
    <input value={item.descricao} onChange={e => onChange('descricao', e.target.value)}
      className="col-span-4 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-400"
      placeholder="Descrição" />
    <input type="number" value={item.quantidade} min={1}
      onChange={e => { const q = Number(e.target.value); onChange('quantidade', q); onChange('valorTotal', q * item.valorUnitario); }}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none" />
    <input value={item.unidade || ''} onChange={e => onChange('unidade', e.target.value)}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none" placeholder="un" />
    <input type="number" value={item.valorUnitario} placeholder="R$"
      onChange={e => { const vu = Number(e.target.value); onChange('valorUnitario', vu); onChange('valorTotal', vu * item.quantidade); }}
      className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
    <div className="col-span-2 px-2 py-1.5 bg-gray-50 rounded-lg text-xs font-bold text-gray-700 text-right">{fmtCurrency(item.valorTotal)}</div>
    <button onClick={onRemove} className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50 text-red-400">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
    <input value={item.prazoEntrega || ''} onChange={e => onChange('prazoEntrega', e.target.value)}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" placeholder="Prazo" />
  </div>
);

// ── Formulário Nova Cotação ─────────────────────────────────────────────────
const NovaCotacaoForm: React.FC<{
  projectId: string;
  categoriaId: string;
  onSave: () => void;
  onCancel: () => void;
  addCotacao: (d: any) => Promise<string>;
  calcularTotal: (i: CotacaoItem[]) => number;
}> = ({ categoriaId, onSave, onCancel, addCotacao, calcularTotal }) => {
  const [fornecedor, setFornecedor] = useState('');
  const [contato, setContato] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [condicoes, setCondicoes] = useState('');
  const [prazoGeral, setPrazoGeral] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<CotacaoItem[]>([newItem()]);
  const [saving, setSaving] = useState(false);

  const updateItem = (idx: number, field: keyof CotacaoItem, value: any) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  const total = calcularTotal(itens);

  const handleSave = async () => {
    if (!fornecedor.trim()) return;
    setSaving(true);
    try {
      await addCotacao({ categoriaId, fornecedor, fornecedorContato: contato, fornecedorEmail: email, fornecedorTelefone: telefone, itens, valorTotal: total, condicoesPagamento: condicoes, prazoEntregaGeral: prazoGeral, observacoes, selecionada: false });
      onSave();
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <h4 className="font-bold text-gray-900 text-sm">Nova Cotação</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { label: 'Fornecedor *', value: fornecedor, set: setFornecedor, placeholder: 'Nome do fornecedor' },
          { label: 'Contato', value: contato, set: setContato, placeholder: 'Nome do responsável' },
          { label: 'E-mail', value: email, set: setEmail, placeholder: 'email@fornecedor.com' },
          { label: 'Telefone', value: telefone, set: setTelefone, placeholder: '(00) 00000-0000' },
          { label: 'Condições de Pagamento', value: condicoes, set: setCondicoes, placeholder: 'Ex: 30/60/90 dias' },
          { label: 'Prazo de Entrega', value: prazoGeral, set: setPrazoGeral, placeholder: 'Ex: 15 dias úteis' },
        ].map(f => (
          <div key={f.label}>
            <label className="text-xs font-bold text-gray-600 block mb-1">{f.label}</label>
            <input value={f.value} onChange={e => f.set(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400"
              placeholder={f.placeholder} />
          </div>
        ))}
      </div>

      {/* Itens */}
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase px-1">
          <span className="col-span-4">Descrição</span>
          <span className="col-span-1 text-center">Qtd</span>
          <span className="col-span-1 text-center">Un</span>
          <span className="col-span-2">Vl. Unit.</span>
          <span className="col-span-2 text-right">Total</span>
          <span className="col-span-1" />
          <span className="col-span-1">Prazo</span>
        </div>
        {itens.map((item, i) => (
          <ItemRow key={item.id} item={item}
            onChange={(f, v) => updateItem(i, f, v)}
            onRemove={() => setItens(prev => prev.filter((_, j) => j !== i))} />
        ))}
        <button onClick={() => setItens(prev => [...prev, newItem()])}
          className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 mt-1">
          <Plus className="w-3.5 h-3.5" /> Adicionar Item
        </button>
      </div>

      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
        <span className="text-sm font-bold text-gray-600">Total</span>
        <span className="text-xl font-extrabold text-gray-900">{fmtCurrency(total)}</span>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-brand-400"
          placeholder="Observações adicionais..." />
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

// ── Card de Cotação individual ──────────────────────────────────────────────
const CotacaoCard: React.FC<{
  cotacao: ProjectCotacaoType;
  isBest: boolean;
  onSelect: () => void;
  onUpload: (f: File) => void;
  onDelete: () => void;
  uploading: boolean;
}> = ({ cotacao, isBest, onSelect, onUpload, onDelete, uploading }) => {
  const [expanded, setExpanded] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      cotacao.selecionada ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md'
        : isBest ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 text-sm">{cotacao.fornecedor}</h4>
              {cotacao.selecionada && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">✓ SELECIONADA</span>
              )}
              {isBest && !cotacao.selecionada && (
                <span className="text-[9px] font-bold px-2 py-0.5 bg-green-100 text-green-700 border border-green-200 rounded-full">💰 MENOR PREÇO</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
              {cotacao.fornecedorContato && <span>{cotacao.fornecedorContato}</span>}
              {cotacao.prazoEntregaGeral && <span>📦 {cotacao.prazoEntregaGeral}</span>}
              {cotacao.condicoesPagamento && <span>💳 {cotacao.condicoesPagamento}</span>}
              <span className="text-gray-300">{fmtDate(cotacao.criadoEm)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xl font-extrabold text-gray-900">{fmtCurrency(cotacao.valorTotal)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <button onClick={onSelect}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
              cotacao.selecionada ? 'bg-emerald-100 text-emerald-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
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

          <button onClick={() => window.confirm('Remover esta cotação?') && onDelete()}
            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
            <div className="grid grid-cols-12 gap-2 text-[9px] font-bold text-gray-400 uppercase px-1">
              <span className="col-span-5">Item</span>
              <span className="col-span-2 text-center">Qtd</span>
              <span className="col-span-2 text-right">Unit.</span>
              <span className="col-span-3 text-right">Total</span>
            </div>
            {cotacao.itens.map((item: CotacaoItem, i: number) => (
              <div key={i} className="grid grid-cols-12 gap-2 text-xs text-gray-600">
                <span className="col-span-5 truncate">{item.descricao || '—'}</span>
                <span className="col-span-2 text-center text-gray-400">{item.quantidade} {item.unidade}</span>
                <span className="col-span-2 text-right">{fmtCurrency(item.valorUnitario)}</span>
                <span className="col-span-3 text-right font-bold">{fmtCurrency(item.valorTotal)}</span>
              </div>
            ))}
            {cotacao.observacoes && (
              <p className="text-xs text-gray-400 italic pt-1 border-t border-gray-100">{cotacao.observacoes}</p>
            )}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </div>
  );
};

// ── Bloco de Categoria ──────────────────────────────────────────────────────
const CategoriaBloco: React.FC<{
  categoria: CotacaoCategoria;
  cotacoes: ProjectCotacaoType[];
  projectId: string;
  onRenomear: (nome: string) => void;
  onRemover: () => void;
  addCotacao: (d: any) => Promise<string>;
  selecionarCotacao: (id: string) => void;
  deleteCotacao: (id: string) => void;
  uploadDocumento: (id: string, f: File) => Promise<string>;
  calcularTotal: (i: CotacaoItem[]) => number;
}> = ({ categoria, cotacoes, projectId, onRenomear, onRemover, addCotacao, selecionarCotacao, deleteCotacao, uploadDocumento, calcularTotal }) => {
  const [showForm, setShowForm] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(categoria.nome);
  const cor = getCor(categoria.cor);

  const menorPreco = cotacoes.length > 0
    ? cotacoes.reduce((best, c) => c.valorTotal < best.valorTotal ? c : best, cotacoes[0]) : null;

  const totalSelecionada = cotacoes.find(c => c.selecionada)?.valorTotal;

  const handleUpload = async (cotacaoId: string, file: File) => {
    setUploadingId(cotacaoId);
    try { await uploadDocumento(cotacaoId, file); }
    finally { setUploadingId(null); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header da categoria */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${cor.bg}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cor.dot}`} />
          {editando ? (
            <input value={nomeEdit} onChange={e => setNomeEdit(e.target.value)}
              onBlur={() => { onRenomear(nomeEdit); setEditando(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { onRenomear(nomeEdit); setEditando(false); } }}
              className="flex-1 text-sm font-bold bg-transparent border-b border-gray-400 outline-none"
              autoFocus />
          ) : (
            <button onClick={() => setEditando(true)} className="flex-1 text-left">
              <span className={`text-sm font-bold ${cor.text}`}>{categoria.nome}</span>
            </button>
          )}
          <div className="flex items-center gap-1 ml-2">
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${cor.border} ${cor.text}`}>
              {cotacoes.length} cotação{cotacoes.length !== 1 ? 'ões' : ''}
            </span>
            {totalSelecionada != null && (
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                ✓ {fmtCurrency(totalSelecionada)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${cor.text} border ${cor.border} hover:bg-white/60`}>
            <Plus className="w-3 h-3" /> Nova Cotação
          </button>
          <button onClick={() => window.confirm(`Remover categoria "${categoria.nome}" e todas as suas cotações?`) && onRemover()}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Comparativo dentro do grupo */}
      {cotacoes.length >= 2 && (
        <div className="px-4 pt-3">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Comparativo do Grupo</p>
            {[...cotacoes].sort((a, b) => a.valorTotal - b.valorTotal).map((c, i) => {
              const max = Math.max(...cotacoes.map(x => x.valorTotal)) || 1;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-600 w-24 truncate font-medium">{c.fornecedor}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${i === 0 ? 'bg-emerald-500' : 'bg-blue-400'}`}
                      style={{ width: `${Math.round((c.valorTotal / max) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-gray-900 w-20 text-right">{fmtCurrency(c.valorTotal)}</span>
                  {c.selecionada && <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulário de nova cotação */}
      {showForm && (
        <div className="px-4 pt-3">
          <NovaCotacaoForm
            projectId={projectId}
            categoriaId={categoria.id}
            onSave={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
            addCotacao={addCotacao}
            calcularTotal={calcularTotal}
          />
        </div>
      )}

      {/* Lista de cotações */}
      <div className="p-4 space-y-3">
        {cotacoes.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <Package className="w-7 h-7 mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">Nenhuma cotação nesta categoria.</p>
            <button onClick={() => setShowForm(true)} className="text-xs font-bold text-brand-600 hover:underline mt-1">
              Adicionar cotação →
            </button>
          </div>
        ) : cotacoes.map(c => (
          <CotacaoCard key={c.id} cotacao={c}
            isBest={menorPreco?.id === c.id && cotacoes.length > 1}
            onSelect={() => selecionarCotacao(c.id)}
            onUpload={f => handleUpload(c.id, f)}
            onDelete={() => deleteCotacao(c.id)}
            uploading={uploadingId === c.id} />
        ))}
      </div>
    </div>
  );
};

// ── Componente Principal ────────────────────────────────────────────────────
const ProjectCotacao: React.FC<Props> = ({ projectId, leadId, categoriasCotacao: catsProp }) => {
  const { cotacoes, loading, addCotacao, selecionarCotacao, deleteCotacao, uploadDocumento, calcularTotal } = useProjectCotacao(projectId);
  const { advancePhase, updateProject } = useProject();
  const { atualizarSubStatus } = useProjectLeads();

  // Categorias — gerenciadas localmente e salvas no projeto
  const [categorias, setCategorias] = useState<CotacaoCategoria[]>(catsProp || []);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [adicionandoCat, setAdicionandoCat] = useState(false);
  const [cotacoesRecebidas, setCotacoesRecebidas] = useState(false);
  const [salvandoRecebidas, setSalvandoRecebidas] = useState(false);

  // Sincroniza categorias quando proj muda
  useEffect(() => { if (catsProp) setCategorias(catsProp); }, [catsProp]);

  // Salva as categorias no Firestore (dentro do doc do projeto)
  const salvarCategorias = async (novas: CotacaoCategoria[]) => {
    await updateProject(projectId, { categoriasCotacao: novas } as any);
  };

  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    setAdicionandoCat(true);
    try {
      const corIdx = categorias.length % COR_PALETTE.length;
      const nova: CotacaoCategoria = {
        id: makeId(),
        nome: novaCategoria.trim(),
        cor: COR_PALETTE[corIdx].id,
        criadaEm: new Date().toISOString(),
      };
      const novas = [...categorias, nova];
      setCategorias(novas);
      await salvarCategorias(novas);
      setNovaCategoria('');
    } finally { setAdicionandoCat(false); }
  };

  const renomearCategoria = async (id: string, nome: string) => {
    const novas = categorias.map(c => c.id === id ? { ...c, nome } : c);
    setCategorias(novas);
    await salvarCategorias(novas);
  };

  const removerCategoria = async (id: string) => {
    const novas = categorias.filter(c => c.id !== id);
    setCategorias(novas);
    await salvarCategorias(novas);
  };

  // Cotações agrupadas
  const cotacoesPorCategoria = useMemo(() => {
    const sem: ProjectCotacaoType[] = [];
    const mapa: Record<string, ProjectCotacaoType[]> = {};
    categorias.forEach(c => { mapa[c.id] = []; });
    cotacoes.forEach(c => {
      if (c.categoriaId && mapa[c.categoriaId] !== undefined) mapa[c.categoriaId].push(c);
      else sem.push(c);
    });
    return { mapa, sem };
  }, [cotacoes, categorias]);

  // Total consolidado
  const totalGeral = useMemo(() => {
    const selecionadas = cotacoes.filter(c => c.selecionada);
    return selecionadas.reduce((s, c) => s + c.valorTotal, 0);
  }, [cotacoes]);

  // "Cotações Recebidas" — avança projeto para cotacao_recebida + lead para material_cotado
  const handleCotacoesRecebidas = async () => {
    if (!window.confirm('Confirmar que todas as cotações foram recebidas? O status será atualizado.')) return;
    setSalvandoRecebidas(true);
    try {
      await advancePhase(projectId, 'cotacao_recebida', 'Cotações recebidas — prontas para análise');
      if (leadId) {
        try { await atualizarSubStatus(leadId, 'material_cotado'); } catch { /**/ }
      }
      setCotacoesRecebidas(true);
    } catch (err: any) {
      alert(`Erro: ${err?.message || String(err)}`);
    } finally { setSalvandoRecebidas(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">💰 Cotações de Materiais</h3>
          <p className="text-xs text-gray-400 mt-0.5">Organize por categoria — cada grupo pode ter múltiplos fornecedores</p>
        </div>
        {totalGeral > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <p className="text-[9px] font-bold text-emerald-600 uppercase">Total Selecionado</p>
            <p className="text-lg font-extrabold text-emerald-800">{fmtCurrency(totalGeral)}</p>
          </div>
        )}
      </div>

      {/* ── Adicionar categoria ── */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Criar Grupo de Cotação
        </p>
        <div className="flex gap-2">
          <input value={novaCategoria}
            onChange={e => setNovaCategoria(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adicionarCategoria()}
            placeholder="Ex: Câmara Fria Completa, Portas Rápidas, Prateleiras..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
          <button onClick={adicionarCategoria} disabled={!novaCategoria.trim() || adicionandoCat}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-40 transition-colors flex-shrink-0">
            {adicionandoCat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar Grupo
          </button>
        </div>
        {categorias.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {categorias.map(c => {
              const cor = getCor(c.cor);
              return (
                <span key={c.id} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${cor.bg} ${cor.text} ${cor.border}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${cor.dot} inline-block mr-1`} />
                  {c.nome}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Blocos por categoria ── */}
      {categorias.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">Crie um grupo de cotação para começar.</p>
          <p className="text-xs text-gray-300 mt-1">Ex: "Câmara Fria Completa", "Portas Rápidas", "Prateleiras"</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categorias.map(cat => (
            <CategoriaBloco
              key={cat.id}
              categoria={cat}
              cotacoes={cotacoesPorCategoria.mapa[cat.id] || []}
              projectId={projectId}
              onRenomear={nome => renomearCategoria(cat.id, nome)}
              onRemover={() => removerCategoria(cat.id)}
              addCotacao={addCotacao}
              selecionarCotacao={selecionarCotacao}
              deleteCotacao={deleteCotacao}
              uploadDocumento={uploadDocumento}
              calcularTotal={calcularTotal}
            />
          ))}

          {/* Cotações sem categoria (legado / avulso) */}
          {cotacoesPorCategoria.sem.length > 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500">📋 Cotações sem categoria (legado)</p>
              {cotacoesPorCategoria.sem.map(c => (
                <CotacaoCard key={c.id} cotacao={c}
                  isBest={false}
                  onSelect={() => selecionarCotacao(c.id)}
                  onUpload={f => uploadDocumento(c.id, f).catch(() => {})}
                  onDelete={() => deleteCotacao(c.id)}
                  uploading={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Botão Cotações Recebidas ── */}
      <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 ${
        cotacoesRecebidas ? 'bg-emerald-100 border border-emerald-300' : 'bg-amber-50 border border-amber-200'
      }`}>
        <div>
          <p className="text-sm font-bold text-amber-900">
            {cotacoesRecebidas ? '✅ Cotações marcadas como recebidas!' : '📩 Todas as cotações foram recebidas?'}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            {cotacoesRecebidas
              ? 'Lead atualizado para "🟢 Material Cotado". O comercial pode montar a proposta.'
              : 'Após receber e registrar todas as cotações, avance para análise e proposta.'}
          </p>
        </div>
        {!cotacoesRecebidas && (
          <button onClick={handleCotacoesRecebidas} disabled={salvandoRecebidas || cotacoes.length === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 disabled:opacity-50 flex-shrink-0 transition-colors">
            {salvandoRecebidas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Cotações Recebidas 🟢
          </button>
        )}
      </div>
    </div>
  );
};

export default ProjectCotacao;

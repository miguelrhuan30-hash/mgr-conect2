/**
 * components/ProjectCotacao.tsx — Módulo de Cotações com Grupos + WhatsApp
 *
 * Fluxo:
 *   - Grupos de cotação (categorias) — ex: Câmara Fria, Portas Rápidas, Prateleiras
 *   - Cada grupo pode ter N cotações de N fornecedores
 *   - Botão [📲 Enviar Cotação] abre modal com seleção de fornecedor cadastrado
 *     → Gera link WhatsApp com texto de solicitação pré-preenchido
 *     → Cria cotação no grupo com status "aguardando_retorno"
 *   - [✅ Marcar Recebido] → status "recebida", libera preenchimento de preço/PDF
 *   - [📩 Cotações Recebidas] → avança fase + atualiza lead para 🟢 material_cotado
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Trash2, Upload, Check, Star, Loader2,
  FileText, Package, ChevronDown, ChevronUp,
  Tag, X, Archive, MessageCircle, Clock, Search,
  Truck,
} from 'lucide-react';
import { useProjectCotacao } from '../hooks/useProjectCotacao';
import { useFornecedores } from '../hooks/useFornecedores';
import { useProject } from '../hooks/useProject';
import { useProjectLeads } from '../hooks/useProjectLeads';
import type { CotacaoItem, CotacaoCategoria, Fornecedor } from '../types';
import type { ProjectCotacao as ProjectCotacaoType } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Paleta ──────────────────────────────────────────────────────────────────
const COR_PALETTE = [
  { id: 'blue',    bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'    },
  { id: 'amber',   bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500'   },
  { id: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  { id: 'violet',  bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-300',  dot: 'bg-violet-500'  },
  { id: 'rose',    bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-300',    dot: 'bg-rose-500'    },
  { id: 'cyan',    bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-300',    dot: 'bg-cyan-500'    },
];
const getCor = (cor?: string) => COR_PALETTE.find(c => c.id === cor) || COR_PALETTE[0];

// ── Props ────────────────────────────────────────────────────────────────────
interface Props {
  projectId: string;
  leadId?: string;
  categoriasCotacao?: CotacaoCategoria[];
  escopoTexto?: string;      // texto da prancheta para pré-preencher mensagem WhatsApp
  projectName?: string;
  clientName?: string;
}

// ── Utils ────────────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), 'dd/MM/yy HH:mm', { locale: ptBR }); }
  catch { return '—'; }
};
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const newItem = (): CotacaoItem => ({ id: makeId(), descricao: '', quantidade: 1, unidade: 'un', valorUnitario: 0, valorTotal: 0 });

// ── ItemRow ──────────────────────────────────────────────────────────────────
const ItemRow: React.FC<{ item: CotacaoItem; onChange: (f: keyof CotacaoItem, v: any) => void; onRemove: () => void }> = ({ item, onChange, onRemove }) => (
  <div className="grid grid-cols-12 gap-2 items-center">
    <input value={item.descricao} onChange={e => onChange('descricao', e.target.value)} placeholder="Descrição"
      className="col-span-4 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-400" />
    <input type="number" value={item.quantidade} min={1}
      onChange={e => { const q = Number(e.target.value); onChange('quantidade', q); onChange('valorTotal', q * item.valorUnitario); }}
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none" />
    <input value={item.unidade || ''} onChange={e => onChange('unidade', e.target.value)} placeholder="un"
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center outline-none" />
    <input type="number" value={item.valorUnitario} placeholder="R$"
      onChange={e => { const vu = Number(e.target.value); onChange('valorUnitario', vu); onChange('valorTotal', vu * item.quantidade); }}
      className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
    <div className="col-span-2 px-2 py-1.5 bg-gray-50 rounded-lg text-xs font-bold text-gray-700 text-right">{fmtCurrency(item.valorTotal)}</div>
    <button onClick={onRemove} className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50 text-red-400">
      <Trash2 className="w-3.5 h-3.5" />
    </button>
    <input value={item.prazoEntrega || ''} onChange={e => onChange('prazoEntrega', e.target.value)} placeholder="Prazo"
      className="col-span-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
  </div>
);

// ── Formulário de nova cotação manual ────────────────────────────────────────
const NovaCotacaoForm: React.FC<{
  projectId: string; categoriaId: string;
  onSave: () => void; onCancel: () => void;
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
  const updateItem = (idx: number, f: keyof CotacaoItem, v: any) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, [f]: v } : it));
  const total = calcularTotal(itens);
  const handleSave = async () => {
    if (!fornecedor.trim()) return;
    setSaving(true);
    try {
      await addCotacao({ categoriaId, fornecedor, fornecedorContato: contato, fornecedorEmail: email, fornecedorTelefone: telefone, itens, valorTotal: total, condicoesPagamento: condicoes, prazoEntregaGeral: prazoGeral, observacoes, selecionada: false, status: 'rascunho' });
      onSave();
    } finally { setSaving(false); }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5 space-y-4">
      <h4 className="font-bold text-gray-900 text-sm">Registrar Cotação Manualmente</h4>
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
            <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-400 uppercase px-1">
          <span className="col-span-4">Descrição</span><span className="col-span-1 text-center">Qtd</span>
          <span className="col-span-1 text-center">Un</span><span className="col-span-2">Vl Unit.</span>
          <span className="col-span-2 text-right">Total</span><span className="col-span-1" /><span className="col-span-1">Prazo</span>
        </div>
        {itens.map((item, i) => (
          <ItemRow key={item.id} item={item} onChange={(f, v) => updateItem(i, f, v)} onRemove={() => setItens(p => p.filter((_, j) => j !== i))} />
        ))}
        <button onClick={() => setItens(p => [...p, newItem()])} className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700"><Plus className="w-3.5 h-3.5" /> Adicionar Item</button>
      </div>
      <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
        <span className="text-sm font-bold text-gray-600">Total</span>
        <span className="text-xl font-extrabold text-gray-900">{fmtCurrency(total)}</span>
      </div>
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
        <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" placeholder="..." />
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
        <button onClick={handleSave} disabled={saving || !fornecedor.trim()}
          className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar
        </button>
      </div>
    </div>
  );
};

// ── Modal Enviar via WhatsApp ─────────────────────────────────────────────────
const WhatsAppModal: React.FC<{
  categoriaId: string;
  categoriaNome: string;
  projectName?: string;
  clientName?: string;
  escopoTexto?: string;
  fornecedores: Fornecedor[];
  onEnviar: (fornecedor: Fornecedor, texto: string) => Promise<void>;
  onClose: () => void;
}> = ({ categoriaId, categoriaNome, projectName, clientName, escopoTexto, fornecedores, onEnviar, onClose }) => {
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Fornecedor | null>(null);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Texto padrão gerado automaticamente
  useEffect(() => {
    if (!selecionado) return;
    const linhas: string[] = [
      `Olá ${selecionado.responsavelNome}! 👋`,
      `Sou da *MGR* e gostaria de solicitar uma cotação referente ao projeto abaixo.`,
      '',
      `📋 *Projeto:* ${projectName || 'Projeto MGR'}`,
      clientName ? `👤 *Cliente:* ${clientName}` : '',
      `📦 *Categoria:* ${categoriaNome}`,
      '',
    ];
    if (escopoTexto?.trim()) {
      linhas.push('*Descrição / Escopo:*');
      linhas.push(escopoTexto.trim());
      linhas.push('');
    }
    linhas.push('Por favor, nos informe preços, prazo de entrega e condições de pagamento. ');
    linhas.push('Aguardamos seu retorno. Obrigado! 🙏');
    setTexto(linhas.filter(l => l !== undefined).join('\n'));
  }, [selecionado, projectName, clientName, categoriaNome, escopoTexto]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return fornecedores.filter(f =>
      !q || f.nome.toLowerCase().includes(q) ||
      f.especialidades.some(e => e.toLowerCase().includes(q))
    );
  }, [fornecedores, busca]);

  const handleEnviar = async () => {
    if (!selecionado || !texto.trim()) return;
    setEnviando(true);
    try {
      // Abre WhatsApp
      const tel = selecionado.telefoneWhatsApp.replace(/\D/g, '');
      const url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
      window.open(url, '_blank');
      // Registra a cotação
      await onEnviar(selecionado, texto);
      onClose();
    } finally { setEnviando(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-5 h-5" /> Enviar Cotação via WhatsApp
            </h2>
            <p className="text-emerald-100 text-xs mt-0.5">Grupo: <strong>{categoriaNome}</strong></p>
          </div>
          <button onClick={onClose} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Seleção de fornecedor */}
          <div className="w-full md:w-64 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-100 flex flex-col p-4 max-h-60 md:max-h-full overflow-hidden">
            <p className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5" /> Selecionar Fornecedor
            </p>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..."
                className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-1.5">
              {filtrados.length === 0 ? (
                <div className="text-center py-4">
                  <Truck className="w-6 h-6 mx-auto text-gray-200 mb-1" />
                  <p className="text-xs text-gray-400">Nenhum fornecedor{busca ? ' encontrado' : ' cadastrado'}.</p>
                </div>
              ) : filtrados.map(f => (
                <button key={f.id} onClick={() => setSelecionado(f)}
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                    selecionado?.id === f.id
                      ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}>
                  <p className="font-bold text-gray-900 truncate">{f.nome}</p>
                  <p className="text-gray-500">{f.responsavelNome}</p>
                  {f.especialidades.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {f.especialidades.slice(0, 2).map(e => (
                        <span key={e} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{e}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Texto da mensagem */}
          <div className="flex-1 p-4 flex flex-col overflow-hidden">
            <p className="text-xs font-bold text-gray-600 mb-2">Mensagem (editável)</p>
            {!selecionado ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-xs text-center">
                <div>
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                  Selecione um fornecedor ao lado para gerar a mensagem automaticamente
                </div>
              </div>
            ) : (
              <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={12}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                placeholder="Mensagem para o fornecedor..." />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-shrink-0 bg-gray-50">
          <p className="text-xs text-gray-400">
            {selecionado
              ? `Enviando para: ${selecionado.nome} (${selecionado.telefoneWhatsApp})`
              : 'Nenhum fornecedor selecionado'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-white">Cancelar</button>
            <button onClick={handleEnviar} disabled={!selecionado || !texto.trim() || enviando}
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Enviar via WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Card de Cotação ───────────────────────────────────────────────────────────
const CotacaoCard: React.FC<{
  cotacao: ProjectCotacaoType;
  isBest: boolean;
  onSelect: () => void;
  onUpload: (f: File) => void;
  onDelete: () => void;
  onMarcarRecebido: (valorTotal: number) => void;
  uploading: boolean;
}> = ({ cotacao, isBest, onSelect, onUpload, onDelete, onMarcarRecebido, uploading }) => {
  const [expanded, setExpanded] = useState(false);
  const [valorInput, setValorInput] = useState('');
  const [showValorInput, setShowValorInput] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const isAguardando = cotacao.status === 'aguardando_retorno';

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      cotacao.selecionada ? 'border-emerald-400 ring-2 ring-emerald-100 shadow-md'
        : isAguardando ? 'border-amber-200 bg-amber-50/30'
        : isBest ? 'border-green-200 bg-green-50/30' : 'border-gray-200'
    }`}>
      <div className="p-4">
        {/* Status badge para aguardando */}
        {isAguardando && (
          <div className="flex items-center gap-1.5 mb-3 px-2.5 py-1.5 bg-amber-100 border border-amber-200 rounded-xl w-fit">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
            <span className="text-xs font-bold text-amber-700">⏳ Aguardando retorno de {cotacao.fornecedor}</span>
            {cotacao.enviadoViaWhatsapp && (
              <span className="text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">via WhatsApp</span>
            )}
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 text-sm">{cotacao.fornecedor}</h4>
              {cotacao.selecionada && (
                <span className="text-[9px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full">✓ SELECIONADA</span>
              )}
              {isBest && !cotacao.selecionada && !isAguardando && (
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
            {cotacao.valorTotal > 0
              ? <p className="text-xl font-extrabold text-gray-900">{fmtCurrency(cotacao.valorTotal)}</p>
              : isAguardando ? <p className="text-sm text-amber-500 font-bold">Aguardando</p>
              : <p className="text-sm text-gray-400">—</p>
            }
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* Marcar Recebido — para cotações em aguardando */}
          {isAguardando && (
            showValorInput ? (
              <div className="flex items-center gap-1.5 w-full">
                <span className="text-xs text-gray-600 font-bold">R$</span>
                <input type="number" value={valorInput} onChange={e => setValorInput(e.target.value)} placeholder="Valor total da cotação"
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-400" />
                <button onClick={() => { onMarcarRecebido(Number(valorInput)); setShowValorInput(false); }}
                  disabled={!valorInput}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Confirmar
                </button>
                <button onClick={() => setShowValorInput(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowValorInput(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors">
                <Check className="w-3.5 h-3.5" /> Marcar Recebido
              </button>
            )
          )}

          {!isAguardando && (
            <>
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
            </>
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
            {cotacao.itens.length > 0 ? (
              cotacao.itens.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 text-xs text-gray-600">
                  <span className="col-span-5 truncate">{item.descricao || '—'}</span>
                  <span className="col-span-2 text-center text-gray-400">{item.quantidade} {item.unidade}</span>
                  <span className="col-span-2 text-right">{fmtCurrency(item.valorUnitario)}</span>
                  <span className="col-span-3 text-right font-bold">{fmtCurrency(item.valorTotal)}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-400 italic">Nenhum item detalhado</p>
            )}
            {cotacao.textoEnviado && (
              <div className="mt-2 pt-2 border-t border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase mb-1">Texto enviado via WhatsApp</p>
                <p className="text-xs text-gray-500 whitespace-pre-wrap bg-gray-50 rounded-lg p-2">{cotacao.textoEnviado}</p>
              </div>
            )}
            {cotacao.observacoes && <p className="text-xs text-gray-400 italic pt-1 border-t border-gray-100">{cotacao.observacoes}</p>}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
    </div>
  );
};

// ── Bloco de Categoria ────────────────────────────────────────────────────────
const CategoriaBloco: React.FC<{
  categoria: CotacaoCategoria;
  cotacoes: ProjectCotacaoType[];
  projectId: string;
  projectName?: string;
  clientName?: string;
  escopoTexto?: string;
  fornecedores: Fornecedor[];
  onRenomear: (nome: string) => void;
  onRemover: () => void;
  addCotacao: (d: any) => Promise<string>;
  selecionarCotacao: (id: string) => void;
  updateCotacao: (id: string, data: any) => Promise<void>;
  deleteCotacao: (id: string) => void;
  uploadDocumento: (id: string, f: File) => Promise<string>;
  calcularTotal: (i: CotacaoItem[]) => number;
}> = ({ categoria, cotacoes, projectId, projectName, clientName, escopoTexto, fornecedores, onRenomear, onRemover, addCotacao, selecionarCotacao, updateCotacao, deleteCotacao, uploadDocumento, calcularTotal }) => {
  const [showForm, setShowForm] = useState(false);
  const [showWaModal, setShowWaModal] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [nomeEdit, setNomeEdit] = useState(categoria.nome);
  const cor = getCor(categoria.cor);

  const cotacoesRecebidas = cotacoes.filter(c => c.status !== 'aguardando_retorno');
  const menorPreco = cotacoesRecebidas.length > 0
    ? cotacoesRecebidas.reduce((b, c) => c.valorTotal < b.valorTotal ? c : b, cotacoesRecebidas[0]) : null;
  const totalSelecionada = cotacoes.find(c => c.selecionada)?.valorTotal;

  const handleUpload = async (cotacaoId: string, file: File) => {
    setUploadingId(cotacaoId);
    try { await uploadDocumento(cotacaoId, file); } finally { setUploadingId(null); }
  };

  const handleEnviarWhatsApp = async (fornecedor: Fornecedor, texto: string) => {
    await addCotacao({
      categoriaId: categoria.id,
      fornecedor: fornecedor.nome,
      fornecedorId: fornecedor.id,
      fornecedorContato: fornecedor.responsavelNome,
      fornecedorTelefone: fornecedor.telefoneWhatsApp,
      fornecedorEmail: fornecedor.email || '',
      itens: [],
      valorTotal: 0,
      selecionada: false,
      status: 'aguardando_retorno',
      enviadoViaWhatsapp: true,
      textoEnviado: texto,
    });
  };

  const handleMarcarRecebido = async (cotacaoId: string, valorTotal: number) => {
    await updateCotacao(cotacaoId, { status: 'recebida', valorTotal });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 ${cor.bg}`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${cor.dot}`} />
          {editando ? (
            <input value={nomeEdit} onChange={e => setNomeEdit(e.target.value)} autoFocus
              onBlur={() => { onRenomear(nomeEdit); setEditando(false); }}
              onKeyDown={e => e.key === 'Enter' && (onRenomear(nomeEdit), setEditando(false))}
              className="flex-1 text-sm font-bold bg-transparent border-b border-gray-400 outline-none" />
          ) : (
            <button onClick={() => setEditando(true)} className="flex-1 text-left">
              <span className={`text-sm font-bold ${cor.text}`}>{categoria.nome}</span>
            </button>
          )}
          <div className="flex items-center gap-1 ml-2">
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${cor.border} ${cor.text}`}>
              {cotacoes.length} cotaç{cotacoes.length !== 1 ? 'ões' : 'ão'}
            </span>
            {totalSelecionada != null && (
              <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                ✓ {fmtCurrency(totalSelecionada)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => setShowWaModal(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors">
            <MessageCircle className="w-3 h-3" /> Enviar Cotação
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${cor.text} border ${cor.border} hover:bg-white/60`}>
            <Plus className="w-3 h-3" /> Manual
          </button>
          <button onClick={() => window.confirm(`Remover "${categoria.nome}"?`) && onRemover()}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Comparativo */}
      {cotacoesRecebidas.length >= 2 && (
        <div className="px-4 pt-3">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
            <p className="text-[9px] font-bold text-gray-400 uppercase">Comparativo (cotações recebidas)</p>
            {[...cotacoesRecebidas].sort((a, b) => a.valorTotal - b.valorTotal).map((c, i) => {
              const max = Math.max(...cotacoesRecebidas.map(x => x.valorTotal)) || 1;
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

      {/* Formulário manual */}
      {showForm && (
        <div className="px-4 pt-3">
          <NovaCotacaoForm projectId={projectId} categoriaId={categoria.id}
            onSave={() => setShowForm(false)} onCancel={() => setShowForm(false)}
            addCotacao={addCotacao} calcularTotal={calcularTotal} />
        </div>
      )}

      {/* Lista de cotações */}
      <div className="p-4 space-y-3">
        {cotacoes.length === 0 && !showForm ? (
          <div className="text-center py-6">
            <Package className="w-7 h-7 mx-auto text-gray-200 mb-2" />
            <p className="text-xs text-gray-400">Nenhuma cotação nesta categoria.</p>
            <div className="flex items-center justify-center gap-2 mt-2">
              <button onClick={() => setShowWaModal(true)} className="text-xs font-bold text-emerald-600 hover:underline flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Enviar via WhatsApp
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setShowForm(true)} className="text-xs font-bold text-brand-600 hover:underline">
                Registrar manualmente
              </button>
            </div>
          </div>
        ) : cotacoes.map(c => (
          <CotacaoCard key={c.id} cotacao={c}
            isBest={menorPreco?.id === c.id && cotacoesRecebidas.length > 1}
            onSelect={() => selecionarCotacao(c.id)}
            onUpload={f => handleUpload(c.id, f)}
            onDelete={() => deleteCotacao(c.id)}
            onMarcarRecebido={valor => handleMarcarRecebido(c.id, valor)}
            uploading={uploadingId === c.id} />
        ))}
      </div>

      {/* Modal WhatsApp */}
      {showWaModal && (
        <WhatsAppModal
          categoriaId={categoria.id}
          categoriaNome={categoria.nome}
          projectName={projectName}
          clientName={clientName}
          escopoTexto={escopoTexto}
          fornecedores={fornecedores}
          onEnviar={handleEnviarWhatsApp}
          onClose={() => setShowWaModal(false)}
        />
      )}
    </div>
  );
};

// ── Componente Principal ──────────────────────────────────────────────────────
const ProjectCotacao: React.FC<Props> = ({ projectId, leadId, categoriasCotacao: catsProp, escopoTexto, projectName, clientName }) => {
  const { cotacoes, loading, addCotacao, selecionarCotacao, updateCotacao, deleteCotacao, uploadDocumento, calcularTotal } = useProjectCotacao(projectId);
  const { fornecedores } = useFornecedores();
  const { advancePhase, updateProject } = useProject();
  const { atualizarSubStatus } = useProjectLeads();

  const [categorias, setCategorias] = useState<CotacaoCategoria[]>(catsProp || []);
  const [novaCategoria, setNovaCategoria] = useState('');
  const [adicionandoCat, setAdicionandoCat] = useState(false);
  const [cotacoesRecebidas, setCotacoesRecebidas] = useState(false);
  const [salvandoRecebidas, setSalvandoRecebidas] = useState(false);

  useEffect(() => { if (catsProp) setCategorias(catsProp); }, [catsProp]);

  const salvarCategorias = async (novas: CotacaoCategoria[]) => {
    await updateProject(projectId, { categoriasCotacao: novas } as any);
  };

  const adicionarCategoria = async () => {
    if (!novaCategoria.trim()) return;
    setAdicionandoCat(true);
    try {
      const corIdx = categorias.length % COR_PALETTE.length;
      const nova: CotacaoCategoria = {
        id: makeId(), nome: novaCategoria.trim(), cor: COR_PALETTE[corIdx].id, criadaEm: new Date().toISOString(),
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

  const totalGeral = useMemo(() =>
    cotacoes.filter(c => c.selecionada).reduce((s, c) => s + c.valorTotal, 0), [cotacoes]);

  const handleCotacoesRecebidas = async () => {
    if (!window.confirm('Confirmar que todas as cotações foram recebidas?')) return;
    setSalvandoRecebidas(true);
    try {
      await advancePhase(projectId, 'cotacao_recebida', 'Cotações recebidas — prontas para análise');
      if (leadId) { try { await atualizarSubStatus(leadId, 'material_cotado'); } catch { } }
      setCotacoesRecebidas(true);
    } catch (err: any) { alert(`Erro: ${err?.message || String(err)}`); }
    finally { setSalvandoRecebidas(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">💰 Cotações de Materiais</h3>
          <p className="text-xs text-gray-400 mt-0.5">Grupos por categoria — múltiplos fornecedores por grupo — envio via WhatsApp</p>
        </div>
        {totalGeral > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
            <p className="text-[9px] font-bold text-emerald-600 uppercase">Total Selecionado</p>
            <p className="text-lg font-extrabold text-emerald-800">{fmtCurrency(totalGeral)}</p>
          </div>
        )}
      </div>

      {/* Criar categoria */}
      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-600 mb-3 flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5" /> Criar Grupo de Cotação
        </p>
        <div className="flex gap-2">
          <input value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)}
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

      {/* Blocos por categoria */}
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
              projectName={projectName}
              clientName={clientName}
              escopoTexto={escopoTexto}
              fornecedores={fornecedores.filter(f => f.ativo !== false)}
              onRenomear={nome => renomearCategoria(cat.id, nome)}
              onRemover={() => removerCategoria(cat.id)}
              addCotacao={addCotacao}
              selecionarCotacao={selecionarCotacao}
              updateCotacao={updateCotacao}
              deleteCotacao={deleteCotacao}
              uploadDocumento={uploadDocumento}
              calcularTotal={calcularTotal}
            />
          ))}

          {cotacoesPorCategoria.sem.length > 0 && (
            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500">📋 Cotações sem categoria (legado)</p>
              {cotacoesPorCategoria.sem.map(c => (
                <CotacaoCard key={c.id} cotacao={c} isBest={false}
                  onSelect={() => selecionarCotacao(c.id)}
                  onUpload={f => uploadDocumento(c.id, f).catch(() => {})}
                  onDelete={() => deleteCotacao(c.id)}
                  onMarcarRecebido={valor => updateCotacao(c.id, { status: 'recebida', valorTotal: valor })}
                  uploading={false} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Botão Cotações Recebidas */}
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

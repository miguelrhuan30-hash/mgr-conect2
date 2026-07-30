/**
 * components/FaturamentoPanel.tsx
 *
 * UI genérica de faturamento (parcelas, KPIs, dar baixa, documentos) — extraída
 * de ProjectFaturamento.tsx e generalizada pra também cobrir cobrança de O.S.
 * avulsa (única ou agrupada), não só de projeto. Ver hooks/useFaturamento.ts.
 */
import React, { useState, useRef } from 'react';
import {
  Plus, Trash2, CheckCircle2, XCircle, Clock,
  Loader2, AlertTriangle, Upload, TrendingUp, DollarSign, FileText, Receipt,
} from 'lucide-react';
import { useFaturamento } from '../hooks/useFaturamento';
import {
  FaturamentoParcela, ParcelaStatus, MetodoPagamento, TipoPlanoFaturamento,
  TipoDocumentoFaturamento,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

// Referência de UI (mais rica que a do hook — carrega nome/resumo pra exibição
// e criação). Convertida pra FaturamentoReferencia (mais enxuta) antes de
// chamar useFaturamento.
export type PanelReferencia =
  | { tipo: 'projeto'; projectId: string; projectNome: string }
  | { tipo: 'os'; taskIds: string[]; resumoOS?: string };

interface Props {
  referencia: PanelReferencia;
  clientId: string;
  clientName: string;
  valorSugerido?: number;
}

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), "dd/MM/yyyy", { locale: ptBR }); }
  catch { return '—'; }
};

const PARCELA_STATUS: Record<ParcelaStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pendente:  { label: 'Pendente',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: <Clock className="w-3.5 h-3.5" /> },
  pago:      { label: 'Pago',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  atrasado:  { label: 'Atrasado',  color: 'bg-red-50 text-red-700 border-red-200', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
};

const METODO_LABELS: Record<MetodoPagamento, string> = {
  pix: 'PIX', boleto: 'Boleto', dinheiro: 'Dinheiro', cartao: 'Cartão',
  transferencia: 'Transferência', outro: 'Outro',
};

const DOC_LABELS: Record<TipoDocumentoFaturamento, string> = {
  comprovante: 'Comprovante', boleto: 'Boleto', nf: 'Nota Fiscal',
};

interface NovaParcela {
  descricao?: string;
  valor: number;
  dataVencimento: any; // Timestamp
  metodoPagamento: MetodoPagamento;
}

const parcelasIniciais = (valor: number): NovaParcela[] => ([
  { descricao: 'Sinal (30%)', valor: valor * 0.3, dataVencimento: Timestamp.fromDate(new Date()), metodoPagamento: 'pix' },
  { descricao: 'Intermediária (40%)', valor: valor * 0.4, dataVencimento: Timestamp.fromDate(new Date()), metodoPagamento: 'pix' },
  { descricao: 'Final (30%)', valor: valor * 0.3, dataVencimento: Timestamp.fromDate(new Date()), metodoPagamento: 'pix' },
]);

const FaturamentoPanel: React.FC<Props> = ({ referencia, clientId, clientName, valorSugerido = 0 }) => {
  const referenciaHook = referencia.tipo === 'projeto'
    ? { projectId: referencia.projectId }
    : { taskIds: referencia.taskIds };
  const { faturamento, loading, percentualRecebido, createFaturamento, registrarPagamento, marcarAtrasado, uploadDocumento } = useFaturamento(referenciaHook);
  const [showCreator, setShowCreator] = useState(false);
  const [tipoPlano, setTipoPlano] = useState<TipoPlanoFaturamento>('parcelado');
  const [valorTotal, setValorTotal] = useState(valorSugerido);
  const [parcelas, setParcelas] = useState<NovaParcela[]>(parcelasIniciais(valorSugerido));
  const [aVistaVencimento, setAVistaVencimento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [aVistaMetodo, setAVistaMetodo] = useState<MetodoPagamento>('pix');
  const [saving, setSaving] = useState(false);
  const [pagamentoParcelaId, setPagamentoParcelaId] = useState<string | null>(null);
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [metodoPagamentoBaixa, setMetodoPagamentoBaixa] = useState<MetodoPagamento>('pix');
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const comprovanteRef = useRef<HTMLInputElement>(null);
  const [uploadingDocTipo, setUploadingDocTipo] = useState<TipoDocumentoFaturamento | null>(null);
  const docComprovanteRef = useRef<HTMLInputElement>(null);
  const docBoletoRef = useRef<HTMLInputElement>(null);
  const docNfRef = useRef<HTMLInputElement>(null);

  const addParcela = () => {
    setParcelas(prev => [...prev, { descricao: '', valor: 0, dataVencimento: Timestamp.fromDate(new Date()), metodoPagamento: 'pix' }]);
  };
  const removeParcela = (i: number) => setParcelas(prev => prev.filter((_, idx) => idx !== i));
  const updateParcela = (i: number, field: keyof NovaParcela, value: any) => {
    setParcelas(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const sumParcelas = parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const projectNome = referencia.tipo === 'projeto' ? referencia.projectNome : undefined;
      const planoParcelas = tipoPlano === 'a_vista'
        ? [{ descricao: 'Pagamento único', valor: valorTotal, dataVencimento: Timestamp.fromDate(new Date(aVistaVencimento + 'T12:00:00')), metodoPagamento: aVistaMetodo }]
        : parcelas;
      await createFaturamento(
        valorTotal, tipoPlano, planoParcelas as any, clientId, clientName, projectNome,
      );
      setShowCreator(false);
    } finally { setSaving(false); }
  };

  const handlePagar = async (parcelaId: string, comprovanteFile?: File) => {
    if (!faturamento) return;
    setUploadingId(parcelaId);
    try {
      await registrarPagamento(faturamento.id, parcelaId, new Date(dataPagamento), comprovanteFile, metodoPagamentoBaixa);
      setPagamentoParcelaId(null);
    } finally {
      setUploadingId(null);
    }
  };

  const handleUploadDocumento = async (tipo: TipoDocumentoFaturamento, file: File) => {
    if (!faturamento) return;
    setUploadingDocTipo(tipo);
    try { await uploadDocumento(faturamento.id, tipo, file); }
    finally { setUploadingDocTipo(null); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;

  /* ── Sem faturamento ── */
  if (!faturamento) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">💳 Faturamento</h3>
        </div>

        {!showCreator ? (
          <div className="text-center py-10 text-gray-400">
            <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">Faturamento não configurado.</p>
            <button onClick={() => setShowCreator(true)}
              className="mt-4 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 flex items-center gap-2 mx-auto">
              <Plus className="w-4 h-4" /> Configurar Faturamento
            </button>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-5">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Valor Total Cobrado (R$)</label>
              <input type="number" value={valorTotal} onChange={e => {
                const v = Number(e.target.value);
                setValorTotal(v);
                setParcelas(parcelasIniciais(v));
              }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1.5">Plano de Pagamento</label>
              <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
                <button onClick={() => setTipoPlano('a_vista')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tipoPlano === 'a_vista' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
                  À Vista
                </button>
                <button onClick={() => setTipoPlano('parcelado')}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${tipoPlano === 'parcelado' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500'}`}>
                  Parcelado
                </button>
              </div>
            </div>

            {tipoPlano === 'a_vista' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Vencimento</label>
                  <input type="date" value={aVistaVencimento} onChange={e => setAVistaVencimento(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">Método</label>
                  <select value={aVistaMetodo} onChange={e => setAVistaMetodo(e.target.value as MetodoPagamento)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                    {Object.entries(METODO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">Parcelas</p>
                <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-wide px-1">
                  <span className="col-span-3">Descrição</span>
                  <span className="col-span-3">Vencimento</span>
                  <span className="col-span-3">Valor</span>
                  <span className="col-span-2">Método</span>
                  <span className="col-span-1"></span>
                </div>
                {parcelas.map((p, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <input value={p.descricao} onChange={e => updateParcela(i, 'descricao', e.target.value)}
                      className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="Ex: Sinal" />
                    <input type="date" value={format(p.dataVencimento?.toDate ? p.dataVencimento.toDate() : new Date(), 'yyyy-MM-dd')}
                      onChange={e => updateParcela(i, 'dataVencimento', Timestamp.fromDate(new Date(e.target.value + 'T12:00:00')))}
                      className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" value={p.valor} onChange={e => updateParcela(i, 'valor', Number(e.target.value))}
                      className="col-span-3 border border-gray-200 rounded-lg px-2 py-1.5 text-xs"
                      placeholder="R$ 0,00" />
                    <select value={p.metodoPagamento} onChange={e => updateParcela(i, 'metodoPagamento', e.target.value as MetodoPagamento)}
                      className="col-span-2 border border-gray-200 rounded-lg px-1 py-1.5 text-xs">
                      {Object.entries(METODO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button onClick={() => removeParcela(i)}
                      className="col-span-1 flex items-center justify-center w-7 h-7 rounded-lg hover:bg-red-50 text-red-400">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button onClick={addParcela}
                  className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700 mt-1">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Parcela
                </button>

                <div className={`flex items-center justify-between bg-gray-50 rounded-xl p-3 ${sumParcelas !== valorTotal ? 'border border-orange-200' : ''}`}>
                  <span className="text-xs font-bold text-gray-600">Total das parcelas</span>
                  <div className="text-right">
                    <p className={`text-base font-extrabold ${sumParcelas !== valorTotal ? 'text-orange-600' : 'text-gray-900'}`}>
                      {fmtCurrency(sumParcelas)}
                    </p>
                    {sumParcelas !== valorTotal && (
                      <p className="text-[10px] text-orange-500">≠ valor total ({fmtCurrency(valorTotal)})</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreator(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={saving}
                className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Criar Cobrança
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Com faturamento ── */
  const atrasadas = faturamento.parcelas.filter(p => p.status === 'atrasado').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">💳 Faturamento</h3>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          faturamento.status === 'concluido' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {faturamento.status === 'concluido' ? 'Concluído' : 'Em aberto'} · {faturamento.tipoPlano === 'a_vista' ? 'À Vista' : 'Parcelado'}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Recebido</p>
          <p className="text-xl font-extrabold text-emerald-700">{fmtCurrency(faturamento.totalPago)}</p>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200">
          <p className="text-[10px] font-bold text-yellow-600 uppercase tracking-wide">Pendente</p>
          <p className="text-xl font-extrabold text-yellow-700">{fmtCurrency(faturamento.totalPendente)}</p>
        </div>
        <div className={`rounded-2xl p-4 border ${atrasadas > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-[10px] font-bold uppercase tracking-wide ${atrasadas > 0 ? 'text-red-600' : 'text-gray-500'}`}>Atrasado</p>
          <p className={`text-xl font-extrabold ${atrasadas > 0 ? 'text-red-700' : 'text-gray-600'}`}>{fmtCurrency(faturamento.totalAtrasado)}</p>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-gray-600">Progresso de Recebimento</span>
          <span className="text-sm font-extrabold text-gray-900">{percentualRecebido}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all ${percentualRecebido === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
            style={{ width: `${percentualRecebido}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{fmtCurrency(faturamento.totalPago)} recebidos</span>
          <span className="text-[10px] text-gray-400">{fmtCurrency(faturamento.valorTotal)} total</span>
        </div>
      </div>

      {/* Lista de parcelas */}
      <div className="space-y-2.5">
        {faturamento.parcelas.map((parcela) => {
          const cfg = PARCELA_STATUS[parcela.status];
          return (
            <div key={parcela.id} className={`bg-white rounded-2xl border p-4 transition-all ${parcela.status === 'atrasado' ? 'border-red-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">
                      Parcela {parcela.numero}: {parcela.descricao}
                    </span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${cfg.color}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                    {parcela.metodoPagamento && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-600 border-gray-200">
                        {METODO_LABELS[parcela.metodoPagamento]}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                    <span>Venc: {fmtDate(parcela.dataVencimento)}</span>
                    {parcela.dataPagamento && <span>Pago: {fmtDate(parcela.dataPagamento)}</span>}
                  </div>
                </div>
                <p className="text-lg font-extrabold text-gray-900 flex-shrink-0">
                  {fmtCurrency(parcela.valor)}
                </p>
              </div>

              {/* Ações da parcela */}
              {parcela.status !== 'pago' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {pagamentoParcelaId !== parcela.id ? (
                    <>
                      <button onClick={() => { setPagamentoParcelaId(parcela.id); setMetodoPagamentoBaixa(parcela.metodoPagamento || 'pix'); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Registrar Pagamento
                      </button>
                      {parcela.status === 'pendente' && (
                        <button onClick={() => marcarAtrasado(faturamento.id, parcela.id)}
                          className="flex items-center gap-1 px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50">
                          <AlertTriangle className="w-3.5 h-3.5" /> Marcar Atrasado
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                      <select value={metodoPagamentoBaixa} onChange={e => setMetodoPagamentoBaixa(e.target.value as MetodoPagamento)}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs">
                        {Object.entries(METODO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <button onClick={() => comprovanteRef.current?.click()}
                        className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50">
                        <Upload className="w-3.5 h-3.5" /> Comprovante
                      </button>
                      <button onClick={() => handlePagar(parcela.id)} disabled={uploadingId === parcela.id}
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
                        {uploadingId === parcela.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirmar
                      </button>
                      <button onClick={() => setPagamentoParcelaId(null)}
                        className="px-2 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                        Cancelar
                      </button>
                    </div>
                  )}
                  {parcela.comprovanteUrl && (
                    <a href={parcela.comprovanteUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs hover:bg-gray-50">
                      <TrendingUp className="w-3 h-3" /> Comprovante
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <input ref={comprovanteRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f && pagamentoParcelaId) handlePagar(pagamentoParcelaId, f);
          e.target.value = '';
        }} />

      {/* Documentos — comprovantes avulsos, boletos gerados, notas fiscais */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
          <Receipt className="w-3.5 h-3.5" /> Documentos
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { tipo: 'comprovante' as const, ref: docComprovanteRef },
            { tipo: 'boleto' as const, ref: docBoletoRef },
            { tipo: 'nf' as const, ref: docNfRef },
          ]).map(({ tipo, ref }) => (
            <button key={tipo} onClick={() => ref.current?.click()} disabled={uploadingDocTipo === tipo}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50 disabled:opacity-50">
              {uploadingDocTipo === tipo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {DOC_LABELS[tipo]}
            </button>
          ))}
        </div>
        <input ref={docComprovanteRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDocumento('comprovante', f); e.target.value = ''; }} />
        <input ref={docBoletoRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDocumento('boleto', f); e.target.value = ''; }} />
        <input ref={docNfRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDocumento('nf', f); e.target.value = ''; }} />

        {(faturamento.documentos?.length ?? 0) === 0 ? (
          <p className="text-xs text-gray-400 text-center py-2">Nenhum documento enviado ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {faturamento.documentos!.map(doc => (
              <a key={doc.id} href={doc.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 hover:bg-gray-100 transition-colors">
                <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 flex-shrink-0">
                  {DOC_LABELS[doc.tipo]}
                </span>
                <span className="text-xs text-gray-700 truncate flex-1">{doc.nome}</span>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(doc.enviadoEm)}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaturamentoPanel;

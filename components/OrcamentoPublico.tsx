/**
 * components/OrcamentoPublico.tsx — Sprint 51
 *
 * Página pública de visualização de orçamento + PDF.
 * Acessível sem autenticação via /orcamentos/:id
 * URL pública: www.mgrrefrigeracao.com.br/orcamentos/{id}
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Orcamento, CollectionName } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  FileText, CheckCircle2, XCircle, Clock, Loader2,
  AlertTriangle, Download, ExternalLink, Eye, Shield,
  Phone, Mail,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatBRL = (v?: number) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

const STATUS_CONFIG = {
  rascunho:  { label: 'Rascunho',  color: 'text-gray-600',  bg: 'bg-gray-100',   icon: Clock },
  enviado:   { label: 'Enviado',   color: 'text-blue-700',  bg: 'bg-blue-100',   icon: Clock },
  aprovado:  { label: 'Aprovado',  color: 'text-green-700', bg: 'bg-green-100',  icon: CheckCircle2 },
  rejeitado: { label: 'Rejeitado', color: 'text-red-700',   bg: 'bg-red-100',    icon: XCircle },
};

// ─── Main Component ───────────────────────────────────────────────────────────

const OrcamentoPublico: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [orcamento, setOrcamento] = useState<Orcamento | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [pdfFullscreen, setPdfFullscreen] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }

    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, CollectionName.OS_ORCAMENTOS, id));
        if (!snap.exists()) { setNotFound(true); setLoading(false); return; }

        const data = { id: snap.id, ...snap.data() } as Orcamento;

        // Somente exibir se link público está ativo
        if (!data.linkPublicoAtivo) { setNotFound(true); setLoading(false); return; }

        setOrcamento(data);
        setLoading(false);

        // Incrementar contador de visualizações (fire-and-forget)
        updateDoc(doc(db, CollectionName.OS_ORCAMENTOS, id), {
          linkPublicoViews: increment(1),
        }).catch(() => {});
      } catch {
        setNotFound(true);
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-400" />
          <p className="text-blue-200 text-sm">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  // ── Not Found ──
  if (notFound || !orcamento) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center max-w-md space-y-6">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <div className="text-white space-y-2">
            <h1 className="text-2xl font-bold">Orçamento não encontrado</h1>
            <p className="text-blue-200 text-sm leading-relaxed">
              Este link pode ter expirado ou o orçamento não está mais disponível para visualização pública.
            </p>
          </div>
          <div className="pt-2 text-blue-300/60 text-xs">
            <p>Em caso de dúvidas, entre em contato com a MGR Refrigeração</p>
            <a
              href="https://wa.me/5511999999999"
              className="text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[orcamento.status] ?? STATUS_CONFIG['enviado'];
  const StatusIcon = statusCfg.icon;

  const validadeFormatted = orcamento.validoAte
    ? format((orcamento.validoAte as any).toDate(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : null;

  const criadoFormatted = orcamento.criadoEm
    ? format((orcamento.criadoEm as any).toDate(), "dd/MM/yyyy", { locale: ptBR })
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">

      {/* ── Header MGR ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <polygon points="12,2 22,8 22,16 12,22 2,16 2,8" />
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none">MGR Refrigeração</p>
              <p className="text-blue-400 text-[10px]">mgrrefrigeracao.com.br</p>
            </div>
          </div>

          {/* Views badge */}
          {(orcamento.linkPublicoViews ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 text-blue-300/60 text-xs">
              <Eye size={12} />
              <span>{orcamento.linkPublicoViews} visualização{(orcamento.linkPublicoViews ?? 0) !== 1 ? 'ões' : ''}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* ── Hero Card ── */}
        <div className="relative rounded-3xl overflow-hidden bg-white/5 border border-white/10 backdrop-blur-sm p-6 sm:p-8">
          {/* Background gradient accent */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent pointer-events-none" />

          <div className="relative space-y-5">
            {/* Status + Titulo */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusCfg.bg} ${statusCfg.color}`}>
                    <StatusIcon size={11} />
                    {statusCfg.label}
                  </span>
                  {criadoFormatted && (
                    <span className="text-blue-300/60 text-xs">{criadoFormatted}</span>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {orcamento.titulo}
                </h1>
                <p className="text-blue-200 text-sm font-medium">{orcamento.clientName}</p>
                {orcamento.taskCode && (
                  <p className="text-blue-300/50 text-xs">O.S. vinculada: {orcamento.taskCode}</p>
                )}
              </div>

              {/* Valor Total */}
              <div className="text-right flex-shrink-0">
                <p className="text-blue-300/70 text-xs uppercase tracking-wider mb-1">Valor Total</p>
                <p className="text-3xl font-extrabold text-white">
                  {formatBRL(orcamento.valorTotal)}
                </p>
              </div>
            </div>

            {/* Descrição */}
            {orcamento.descricao && (
              <p className="text-blue-200/80 text-sm leading-relaxed border-t border-white/10 pt-4">
                {orcamento.descricao}
              </p>
            )}

            {/* Validade */}
            {validadeFormatted && (
              <div className="flex items-center gap-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2.5">
                <Clock size={14} className="flex-shrink-0" />
                <span>Válido até <strong>{validadeFormatted}</strong></span>
              </div>
            )}
          </div>
        </div>

        {/* ── Itens do Orçamento ─────────────────────────────────────────── */}
        {orcamento.itens && orcamento.itens.length > 0 && (
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10">
              <h2 className="text-white font-bold text-sm uppercase tracking-wider">
                Itens do Orçamento
              </h2>
            </div>

            <div className="divide-y divide-white/5">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-6 py-3 text-blue-300/50 text-xs font-bold uppercase tracking-wider">
                <div className="col-span-6">Descrição</div>
                <div className="col-span-2 text-center">Qtd.</div>
                <div className="col-span-2 text-right">Unit.</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {/* Items */}
              {orcamento.itens.map((item, idx) => (
                <div key={item.id ?? idx} className="grid grid-cols-12 gap-2 px-6 py-4 items-center hover:bg-white/5 transition-colors">
                  <div className="col-span-6">
                    <p className="text-white text-sm font-medium">{item.descricao || `Item ${idx + 1}`}</p>
                  </div>
                  <div className="col-span-2 text-center text-blue-200 text-sm">{item.quantidade}</div>
                  <div className="col-span-2 text-right text-blue-200 text-sm">{formatBRL(item.valorUnitario)}</div>
                  <div className="col-span-2 text-right text-white font-bold text-sm">{formatBRL(item.valorTotal)}</div>
                </div>
              ))}

              {/* Total Footer */}
              <div className="px-6 py-4 bg-white/5 flex justify-between items-center">
                <span className="text-blue-200 text-sm font-medium">{orcamento.itens.length} {orcamento.itens.length === 1 ? 'item' : 'itens'}</span>
                <span className="text-white text-xl font-extrabold">{formatBRL(orcamento.valorTotal)}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Observações ───────────────────────────────────────────────── */}
        {orcamento.observacoes && (
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-6">
            <h2 className="text-white font-bold text-sm uppercase tracking-wider mb-3">Observações</h2>
            <p className="text-blue-200/80 text-sm leading-relaxed whitespace-pre-wrap">{orcamento.observacoes}</p>
          </div>
        )}

        {/* ── PDF Viewer ────────────────────────────────────────────────── */}
        {orcamento.pdfUrl && (
          <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <FileText size={16} className="text-red-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">Documento PDF</p>
                  {orcamento.pdfNome && (
                    <p className="text-blue-300/60 text-xs truncate max-w-[200px]">{orcamento.pdfNome}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPdfFullscreen(!pdfFullscreen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors"
                >
                  <ExternalLink size={12} />
                  {pdfFullscreen ? 'Reduzir' : 'Expandir'}
                </button>
                <a
                  href={orcamento.pdfUrl}
                  download={orcamento.pdfNome || 'orcamento.pdf'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
                >
                  <Download size={12} />
                  Baixar PDF
                </a>
              </div>
            </div>

            {/* Iframe PDF */}
            <div className={`w-full bg-gray-900 transition-all duration-300 ${pdfFullscreen ? 'h-[85vh]' : 'h-[600px]'}`}>
              <iframe
                src={`${orcamento.pdfUrl}#view=FitH`}
                title={`Orçamento — ${orcamento.titulo}`}
                className="w-full h-full border-0"
                loading="lazy"
              />
            </div>

            {/* Fallback para mobile (alguns browsers bloqueiam iframes de PDF) */}
            <div className="px-6 py-3 border-t border-white/10 text-center">
              <p className="text-blue-300/60 text-xs">
                Se o PDF não carregar,{' '}
                <a href={orcamento.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300">
                  clique aqui para abrir diretamente
                </a>
              </p>
            </div>
          </div>
        )}

        {/* ── Rodapé / Contato ──────────────────────────────────────────── */}
        <div className="rounded-3xl bg-white/5 border border-white/10 backdrop-blur-sm p-6 text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-blue-300/70">
            <Shield size={14} />
            <span className="text-xs">Documento gerado e autenticado pela MGR Refrigeração</span>
          </div>
          <p className="text-blue-200/50 text-xs leading-relaxed">
            Este link foi gerado exclusivamente para você. Em caso de dúvidas sobre este orçamento, entre em contato diretamente com nossa equipe.
          </p>
          <div className="flex items-center justify-center gap-4 pt-2">
            <a
              href="https://mgrrefrigeracao.com.br"
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-xs transition-colors"
            >
              <ExternalLink size={11} />
              mgrrefrigeracao.com.br
            </a>
          </div>
        </div>

        {/* Spacer */}
        <div className="h-8" />
      </main>
    </div>
  );
};

export default OrcamentoPublico;

/**
 * components/FluxoCaixaGerencial.tsx — Sprint 15
 *
 * Dashboard de Fluxo de Caixa cross-projeto:
 * - 4 KPIs globais: Total Contratado / Recebido / Pendente / Atrasado
 * - Barra de progresso global de recebimento
 * - Timeline mensal (barras empilhadas: pago / pendente / atrasado)
 * - Alerta de parcelas vencidas com link ao projeto
 * - Lista "Próximas a vencer" (14 dias)
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, Clock, AlertTriangle,
  ExternalLink, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle2, Bell,
} from 'lucide-react';
import { useFluxoCaixaGerencial } from '../hooks/useFluxoCaixaGerencial';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch { return '—'; }
};

const FluxoCaixaGerencial: React.FC = () => {
  const navigate = useNavigate();
  const { loading, kpis, timeline, vencidas, proximasVencer } = useFluxoCaixaGerencial();
  const [showVencidas, setShowVencidas]     = useState(true);
  const [showProximas, setShowProximas]     = useState(true);
  const [showTimeline, setShowTimeline]     = useState(true);

  if (loading) return (
    <div className="flex justify-center py-10">
      <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
    </div>
  );

  // Máximo de valor em qualquer mês (para escalar barras)
  const maxMes = Math.max(...timeline.map(m => m.total), 1);

  return (
    <div className="space-y-6">

      {/* ── KPIs Globais ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Total Contratado', value: fmtCurrency(kpis.totalContratado),
            color: 'bg-brand-50 border-brand-100 text-brand-700',
            icon: <DollarSign className="w-4 h-4 text-brand-500" />,
          },
          {
            label: 'Recebido', value: fmtCurrency(kpis.totalRecebido),
            color: 'bg-emerald-50 border-emerald-100 text-emerald-700',
            icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
          },
          {
            label: 'A Receber', value: fmtCurrency(kpis.totalPendente),
            color: 'bg-yellow-50 border-yellow-100 text-yellow-700',
            icon: <Clock className="w-4 h-4 text-yellow-500" />,
          },
          {
            label: 'Em Atraso', value: fmtCurrency(kpis.totalAtrasado),
            color: kpis.totalAtrasado > 0
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-gray-50 border-gray-100 text-gray-500',
            icon: <AlertTriangle className="w-4 h-4 text-red-400" />,
          },
        ].map(k => (
          <div key={k.label} className={`rounded-2xl border p-4 ${k.color}`}>
            <div className="flex items-center gap-1.5 mb-2 opacity-70">
              {k.icon}
              <span className="text-[10px] font-bold uppercase tracking-wide">{k.label}</span>
            </div>
            <p className="text-lg font-extrabold truncate">{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Progresso Global ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-brand-500" />
            Recebimento Global
          </span>
          <span className="text-sm font-extrabold text-gray-900">{kpis.percentualRecebido}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all duration-700 ${
              kpis.percentualRecebido >= 100 ? 'bg-emerald-500' :
              kpis.percentualRecebido >= 70  ? 'bg-brand-500'   :
              kpis.percentualRecebido >= 40  ? 'bg-yellow-500'  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(kpis.percentualRecebido, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-gray-400">{fmtCurrency(kpis.totalRecebido)} recebidos</span>
          <span className="text-[10px] text-gray-400">{fmtCurrency(kpis.totalContratado)} contratados</span>
        </div>
      </div>

      {/* ── Timeline Mensal ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <button
          onClick={() => setShowTimeline(v => !v)}
          className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
            📊 Timeline Mensal
          </span>
          {showTimeline ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showTimeline && (
          <div className="px-5 pb-5">
            {/* Legendas */}
            <div className="flex items-center gap-4 mb-4">
              {[
                { color: 'bg-emerald-400', label: 'Pago' },
                { color: 'bg-yellow-400',  label: 'Pendente' },
                { color: 'bg-red-400',     label: 'Atrasado' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                  <span className="text-[10px] text-gray-500 font-medium">{l.label}</span>
                </div>
              ))}
            </div>

            {/* Barras */}
            <div className="overflow-x-auto">
              <div className="flex items-end gap-1.5" style={{ minWidth: `${timeline.length * 52}px`, height: '140px' }}>
                {timeline.map(mes => {
                  const totalH   = 120; // px máximo
                  const pagoH    = mes.pago    > 0 ? Math.max(4, Math.round((mes.pago    / maxMes) * totalH)) : 0;
                  const pendH    = mes.pendente > 0 ? Math.max(4, Math.round((mes.pendente / maxMes) * totalH)) : 0;
                  const atrasH   = mes.atrasado > 0 ? Math.max(4, Math.round((mes.atrasado / maxMes) * totalH)) : 0;
                  const isEmpty  = mes.total === 0;

                  return (
                    <div key={mes.mesKey} className="flex flex-col items-center gap-1 flex-1" style={{ minWidth: '48px' }}>
                      {/* Barra empilhada */}
                      <div className="flex flex-col justify-end w-full gap-0.5" style={{ height: '120px' }}>
                        {isEmpty ? (
                          <div className="w-full bg-gray-100 rounded-sm" style={{ height: '4px' }} />
                        ) : (
                          <>
                            {atrasH > 0 && (
                              <div className="w-full bg-red-400 rounded-sm" style={{ height: `${atrasH}px` }}
                                title={`Atrasado: ${fmtCurrency(mes.atrasado)}`} />
                            )}
                            {pendH > 0 && (
                              <div className="w-full bg-yellow-400 rounded-sm" style={{ height: `${pendH}px` }}
                                title={`Pendente: ${fmtCurrency(mes.pendente)}`} />
                            )}
                            {pagoH > 0 && (
                              <div className="w-full bg-emerald-400 rounded-sm" style={{ height: `${pagoH}px` }}
                                title={`Pago: ${fmtCurrency(mes.pago)}`} />
                            )}
                          </>
                        )}
                      </div>
                      {/* Label */}
                      <span className="text-[9px] text-gray-400 font-medium capitalize">{mes.mesLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Alertas: Parcelas Vencidas ── */}
      {vencidas.length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 overflow-hidden">
          <button
            onClick={() => setShowVencidas(v => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-red-50/50 transition-colors"
          >
            <span className="text-sm font-bold text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Parcelas Vencidas
              <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {vencidas.length}
              </span>
            </span>
            {showVencidas ? <ChevronUp className="w-4 h-4 text-red-400" /> : <ChevronDown className="w-4 h-4 text-red-400" />}
          </button>

          {showVencidas && (
            <div className="divide-y divide-red-100">
              {vencidas.map(p => (
                <div key={`${p.faturamentoId}-${p.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-red-50/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      Parcela {p.numero}: {p.descricao}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{p.projectNome} · {p.clientName}</p>
                    <p className="text-[10px] text-red-600 font-bold">Venc: {fmtDate(p.dataVencimento)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold text-red-700">{fmtCurrency(p.valor || 0)}</p>
                    <button
                      onClick={() => navigate(`/app/projetos-v2/${p.projectId}`)}
                      className="mt-1 flex items-center gap-1 text-[10px] text-brand-600 font-bold hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver Projeto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Próximas a Vencer (14 dias) ── */}
      {proximasVencer.length > 0 && (
        <div className="bg-white rounded-2xl border border-yellow-200 overflow-hidden">
          <button
            onClick={() => setShowProximas(v => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-yellow-50/50 transition-colors"
          >
            <span className="text-sm font-bold text-yellow-700 flex items-center gap-2">
              <Bell className="w-4 h-4 text-yellow-500" />
              Próximas a Vencer (14 dias)
              <span className="bg-yellow-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {proximasVencer.length}
              </span>
            </span>
            {showProximas ? <ChevronUp className="w-4 h-4 text-yellow-400" /> : <ChevronDown className="w-4 h-4 text-yellow-400" />}
          </button>

          {showProximas && (
            <div className="divide-y divide-yellow-100">
              {proximasVencer.map(p => (
                <div key={`${p.faturamentoId}-${p.id}`}
                  className="px-5 py-3 flex items-center gap-3 hover:bg-yellow-50/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      Parcela {p.numero}: {p.descricao}
                    </p>
                    <p className="text-[10px] text-gray-500 truncate">{p.projectNome} · {p.clientName}</p>
                    <p className="text-[10px] text-yellow-600 font-bold">Venc: {fmtDate(p.dataVencimento)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-extrabold text-yellow-700">{fmtCurrency(p.valor || 0)}</p>
                    <button
                      onClick={() => navigate(`/app/projetos-v2/${p.projectId}`)}
                      className="mt-1 flex items-center gap-1 text-[10px] text-brand-600 font-bold hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" /> Ver Projeto
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estado vazio */}
      {kpis.totalContratado === 0 && (
        <div className="text-center py-10 text-gray-400">
          <DollarSign className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium">Nenhum faturamento configurado ainda.</p>
          <p className="text-xs text-gray-400 mt-1">Configure o faturamento em cada projeto para visualizar o fluxo de caixa.</p>
        </div>
      )}
    </div>
  );
};

export default FluxoCaixaGerencial;

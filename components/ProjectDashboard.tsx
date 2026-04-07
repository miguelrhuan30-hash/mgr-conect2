/**
 * components/ProjectDashboard.tsx — Sprint 5
 *
 * Dashboard de KPIs e funil de conversão do módulo de projetos.
 * Dados agregados em tempo real do Firestore:
 * - Funil: Lead → Levantamento → Cotação → Proposta → Contrato → Execução → Concluído
 * - KPIs: Taxa de conversão, ticket médio, projetos em atraso, faturamento previsto
 * - Distribuição: Por tipo de projeto, por fase, por origem de lead
 * - Leads: Recentes com origem, status e tempo de resposta
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp, TrendingDown, Users, Briefcase,
  DollarSign, Clock, ArrowRight, RefreshCw, Filter,
  CheckCircle2, AlertCircle, XCircle,
} from 'lucide-react';
import {
  collection, onSnapshot, query, orderBy, limit, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  CollectionName, ProjectV2, ProjectLead,
  PROJECT_PHASE_LABELS, ProjectPhase,
} from '../types';
import { format, differenceInHours, differenceInDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import FluxoCaixaGerencial from './FluxoCaixaGerencial';

// ── Funil de fases (ordem) ──
const FUNIL_FASES: { fase: string; label: string; color: string }[] = [
  { fase: 'lead_capturado',      label: 'Lead',          color: '#8b5cf6' },
  { fase: 'em_levantamento',     label: 'Levantamento',  color: '#6366f1' },
  { fase: 'em_cotacao',          label: 'Cotação',       color: '#3b82f6' },
  { fase: 'cotacao_recebida',    label: 'Cot. Recebida', color: '#06b6d4' },
  { fase: 'proposta_enviada',    label: 'Proposta',      color: '#10b981' },
  { fase: 'contrato_assinado',   label: 'Contrato',      color: '#f59e0b' },
  { fase: 'em_execucao',         label: 'Execução',      color: '#f97316' },
  { fase: 'concluido',           label: 'Concluído',     color: '#22c55e' },
];

// ── KPI Card ──
const KPICard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; color: string; trend?: 'up' | 'down' | 'neutral';
}> = ({ label, value, sub, icon, color, trend }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        {icon}
      </div>
      {trend && (
        <span className={`text-xs font-bold ${trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'}`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : trend === 'down' ? <TrendingDown className="w-4 h-4" /> : null}
        </span>
      )}
    </div>
    <p className="text-2xl font-extrabold text-gray-900">{value}</p>
    <p className="text-xs font-bold text-gray-500 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ── Barra do funil com drill-down — Sprint 16 ──
const FunilBarDrilldown: React.FC<{
  fase: string; label: string; count: number; maxCount: number; color: string;
  perdidos?: number;  // projetos perdidos nessa fase
  isExpanded?: boolean;
  onClick?: () => void;
}> = ({ label, count, maxCount, color, perdidos = 0, isExpanded, onClick }) => {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const totalFase = count + perdidos;
  const taxaPerda = totalFase > 0 ? Math.round((perdidos / totalFase) * 100) : 0;
  return (
    <div>
      <button
        className={`w-full flex items-center gap-3 rounded-xl px-2 py-1 transition-colors ${
          isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'
        }`}
        onClick={onClick}
      >
        <span className="text-xs text-gray-600 w-28 text-right font-medium flex-shrink-0">{label}</span>
        <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
          <div className="h-full rounded-full flex items-center px-2 transition-all duration-700"
            style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}>
            <span className="text-white text-[10px] font-bold">{count}</span>
          </div>
        </div>
        <div className="w-16 text-right flex-shrink-0">
          <span className="text-xs font-bold text-gray-400">{pct.toFixed(0)}%</span>
          {perdidos > 0 && (
            <span className="block text-[9px] text-red-500 font-bold">{taxaPerda}% saiu</span>
          )}
        </div>
      </button>
    </div>
  );
};

// ── Badge de origem ──
const OrigemBadge: React.FC<{ origem: string }> = ({ origem }) => {
  const map: Record<string, { label: string; color: string }> = {
    'formulario_site':  { label: '🌐 Site',      color: 'bg-blue-50 text-blue-700' },
    'anuncio_meta':     { label: '📘 Meta Ads',   color: 'bg-indigo-50 text-indigo-700' },
    'anuncio_google':   { label: '🔍 Google Ads', color: 'bg-green-50 text-green-700' },
    'manual':           { label: '✋ Manual',     color: 'bg-gray-50 text-gray-600' },
  };
  const m = map[origem] || { label: origem, color: 'bg-gray-50 text-gray-500' };
  return (
    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>
  );
};

// ── Componente principal ──
const ProjectDashboard: React.FC = () => {
  const [projetos, setProjetos] = useState<ProjectV2[]>([]);
  const [leads, setLeads] = useState<ProjectLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    const unsubP = onSnapshot(
      query(collection(db, CollectionName.PROJECTS_V2), orderBy('createdAt', 'desc')),
      snap => { setProjetos(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectV2))); setLoading(false); },
      () => setLoading(false)
    );
    const unsubL = onSnapshot(
      query(collection(db, CollectionName.PROJECT_LEADS), orderBy('criadoEm', 'desc'), limit(100)),
      snap => setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectLead))),
    );
    return () => { unsubP(); unsubL(); };
  }, []);

  const now = new Date();
  const cutoff = subDays(now, periodo);

  const projetosRecentes = useMemo(() =>
    projetos.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : null;
      return d && d >= cutoff;
    }), [projetos, periodo]);

  const leadsRecentes = useMemo(() =>
    leads.filter(l => {
      const d = (l as any).criadoEm?.toDate ? (l as any).criadoEm.toDate() : null;
      return d && d >= cutoff;
    }), [leads, periodo]);

  // KPIs
  const totalProjetos = projetosRecentes.length;
  const ativos = projetosRecentes.filter(p => !['concluido', 'nao_aprovado'].includes(p.fase)).length;
  const concluidos = projetosRecentes.filter(p => p.fase === 'concluido').length;
  const naoAprovados = projetosRecentes.filter(p => p.fase === 'nao_aprovado').length;
  const taxaConversao = totalProjetos > 0 ? ((concluidos / totalProjetos) * 100).toFixed(1) : '0';

  const faturamentoTotal = projetosRecentes.reduce((sum, p) => sum + (p.valorContrato || 0), 0);
  const faturamentoRecebido = projetosRecentes.reduce((sum, p) => sum + (p.valorRecebido || 0), 0);

  const leadsConvertidos = leadsRecentes.filter(l => (l as any).status === 'convertido').length;
  const convertidosLeads = leadsRecentes.length > 0
    ? ((leadsConvertidos / leadsRecentes.length) * 100).toFixed(1) : '0';

  // Distribuição por fase
  const faseCount: Record<string, number> = {};
  projetos.forEach(p => { faseCount[p.fase] = (faseCount[p.fase] || 0) + 1; });
  const maxFase = Math.max(...Object.values(faseCount), 1);

  // Distribuição por origem de lead
  const origemCount: Record<string, number> = {};
  leadsRecentes.forEach(l => {
    const o = (l as any).origem || 'manual';
    origemCount[o] = (origemCount[o] || 0) + 1;
  });

  // Por tipo de projeto
  const tipoCount: Record<string, number> = {};
  projetosRecentes.forEach(p => {
    const t = p.tipoProjetoSlug || 'outros';
    tipoCount[t] = (tipoCount[t] || 0) + 1;
  });

  // ── Tempo médio de ciclo (Lead → Concluído) — Sprint 11 ──
  const projetosConcluidos = projetos.filter(p => p.fase === 'concluido' && p.createdAt);
  const diasCicloValues = projetosConcluidos
    .map(p => {
      const ini = p.createdAt?.toDate ? p.createdAt.toDate() : null;
      if (!ini) return null;
      // Usar updatedAt ou atualizadoEm como proxy do fechamento
      const fim = (p as any).atualizadoEm?.toDate ? (p as any).atualizadoEm.toDate() : new Date();
      return differenceInDays(fim, ini);
    })
    .filter((d): d is number => d !== null && d > 0);
  const mediaCiclo = diasCicloValues.length > 0
    ? Math.round(diasCicloValues.reduce((s, v) => s + v, 0) / diasCicloValues.length)
    : null;

  // Ticket médio
  const projetosComValor = projetosRecentes.filter(p => (p.valorContrato || 0) > 0);
  const ticketMedio = projetosComValor.length > 0
    ? projetosComValor.reduce((s, p) => s + (p.valorContrato || 0), 0) / projetosComValor.length
    : 0;

  const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  // ─ Drill-down: projetos perdidos por fase — Sprint 16 ─
  const [drilldownFase, setDrilldownFase] = useState<string | null>(null);

  // Para cada fase do funil, conta quantos projetos não foram aprovados NAQUELA fase
  const naoAprovadosPorFase = useMemo(() => {
    const m: Record<string, ProjectV2[]> = {};
    projetos.filter(p => p.fase === 'nao_aprovado' && p.naoAprovadoData?.faseParou).forEach(p => {
      const f = p.naoAprovadoData!.faseParou;
      if (!m[f]) m[f] = [];
      m[f].push(p);
    });
    return m;
  }, [projetos]);

  // Top motivo de perda por fase
  const topMotivoPorFase = useMemo(() => {
    const result: Record<string, string> = {};
    Object.entries(naoAprovadosPorFase).forEach(([fase, lista]) => {
      const counts: Record<string, number> = {};
      lista.forEach(p => {
        const m = p.naoAprovadoData?.motivoTexto || 'Desconhecido';
        counts[m] = (counts[m] || 0) + 1;
      });
      result[fase] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    });
    return result;
  }, [naoAprovadosPorFase]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-gray-900">Dashboard de Projetos</h2>
          <p className="text-sm text-gray-500">{totalProjetos} projetos · {leadsRecentes.length} leads no período</p>
        </div>
        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-bold">
          {([30, 60, 90] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-2 transition-colors ${periodo === p ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {p} dias
            </button>
          ))}
        </div>
      </div>

      {/* ── Alertas Automáticos — Sprint 6 ─────────────────── */}
      {(() => {
        const leadsAtrasados = leadsRecentes.filter((l: any) => {
          if (l.status !== 'novo') return false;
          const d = l.criadoEm?.toDate ? l.criadoEm.toDate() : null;
          return d && differenceInHours(now, d) > 24;
        });
        const projetosAtrasados = projetosRecentes.filter(p =>
          ['em_faturamento', 'aguardando_recebimento'].includes(p.fase) &&
          (p.valorRecebido || 0) < (p.valorContrato || 0)
        );
        if (leadsAtrasados.length === 0 && projetosAtrasados.length === 0) return null;
        return (
          <div className="space-y-2">
            {leadsAtrasados.length > 0 && (
              <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <p className="text-sm font-bold text-orange-800">
                  ⏰ {leadsAtrasados.length} lead{leadsAtrasados.length > 1 ? 's' : ''} sem resposta há mais de 24h
                </p>
                <a href="#/app/leads" className="ml-auto text-xs font-bold text-orange-700 underline whitespace-nowrap">Ver leads</a>
              </div>
            )}
            {projetosAtrasados.length > 0 && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm font-bold text-red-800">
                  💸 {projetosAtrasados.length} projeto{projetosAtrasados.length > 1 ? 's' : ''} com pagamento pendente
                </p>
                <a href="#/app/projetos-v2" className="ml-auto text-xs font-bold text-red-700 underline whitespace-nowrap">Ver projetos</a>
              </div>
            )}
          </div>
        );
      })()}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard label="Projetos Ativos" value={ativos}
          icon={<Briefcase className="w-5 h-5 text-brand-600" />}
          color="bg-brand-50" trend="neutral" />
        <KPICard label="Taxa de Conversão" value={`${taxaConversao}%`}
          sub={`${concluidos} concluídos de ${totalProjetos}`}
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          color="bg-emerald-50" trend="up" />
        <KPICard label="Faturamento Previsto" value={fmtCurrency(faturamentoTotal)}
          sub={`${fmtCurrency(faturamentoRecebido)} recebido`}
          icon={<DollarSign className="w-5 h-5 text-yellow-600" />}
          color="bg-yellow-50" />
        <KPICard label="Conversão de Leads" value={`${convertidosLeads}%`}
          sub={`${leadsConvertidos} de ${leadsRecentes.length} leads`}
          icon={<Users className="w-5 h-5 text-purple-600" />}
          color="bg-purple-50" trend="neutral" />
        {/* Novos KPIs — Sprint 11 */}
        <KPICard label="Ciclo Médio" value={mediaCiclo !== null ? `${mediaCiclo}d` : '—'}
          sub={mediaCiclo !== null ? `${projetosConcluidos.length} proj. concluídos` : 'Sem dados ainda'}
          icon={<Clock className="w-5 h-5 text-teal-600" />}
          color="bg-teal-50" trend="neutral" />
        <KPICard label="Ticket Médio" value={ticketMedio > 0 ? fmtCurrency(ticketMedio) : '—'}
          sub={`${projetosComValor.length} proj. com valor`}
          icon={<DollarSign className="w-5 h-5 text-indigo-600" />}
          color="bg-indigo-50" trend="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Funil de Fases com drill-down — Sprint 16 */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h3 className="font-extrabold text-gray-900 mb-4 flex items-center gap-2">
            📊 Funil de Projetos
            <span className="ml-auto text-xs text-gray-400 font-normal">todos os períodos</span>
          </h3>
          <div className="space-y-1.5">
            {FUNIL_FASES.map(f => {
              const perdidos = naoAprovadosPorFase[f.fase]?.length ?? 0;
              const isExp = drilldownFase === f.fase;
              return (
                <div key={f.fase}>
                  <FunilBarDrilldown
                    fase={f.fase} label={f.label}
                    count={faseCount[f.fase] || 0}
                    maxCount={maxFase} color={f.color}
                    perdidos={perdidos}
                    isExpanded={isExp}
                    onClick={() => setDrilldownFase(isExp ? null : f.fase)}
                  />
                  {/* Drill-down expandido */}
                  {isExp && perdidos > 0 && (
                    <div className="ml-32 mr-2 mt-1 mb-2 bg-red-50 border border-red-100 rounded-xl p-3 space-y-1">
                      <p className="text-[9px] font-bold text-red-600 uppercase tracking-wide mb-1.5">
                        {perdidos} projeto{perdidos > 1 ? 's' : ''} perdidos nesta fase
                        {topMotivoPorFase[f.fase] ? ` · Top motivo: ${topMotivoPorFase[f.fase]}` : ''}
                      </p>
                      {naoAprovadosPorFase[f.fase].slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center gap-2 text-[10px]">
                          <XCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                          <span className="font-bold text-gray-800 truncate">{p.nome}</span>
                          <span className="text-gray-400 truncate">{p.clientName}</span>
                          {p.naoAprovadoData?.motivoTexto && (
                            <span className="ml-auto text-red-500 font-medium flex-shrink-0">{p.naoAprovadoData.motivoTexto}</span>
                          )}
                        </div>
                      ))}
                      {perdidos > 5 && (
                        <p className="text-[9px] text-red-400">+ {perdidos - 5} mais...</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {naoAprovados > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <FunilBarDrilldown fase="nao_aprovado" label="✕ Não Aprv."
                  count={naoAprovados} maxCount={maxFase} color="#ef4444" />
              </div>
            )}
          </div>
        </div>

        {/* Origem dos Leads + Tipos */}
        <div className="space-y-4">
          {/* Origem de leads */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-extrabold text-gray-900 mb-3">📍 Origem dos Leads</h3>
            {Object.keys(origemCount).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum lead no período.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(origemCount).sort((a,b) => b[1]-a[1]).map(([origem, count]) => (
                  <div key={origem} className="flex items-center justify-between">
                    <OrigemBadge origem={origem} />
                    <span className="text-sm font-extrabold text-gray-900">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top tipos de projeto */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-extrabold text-gray-900 mb-3">🏗️ Tipos de Projeto</h3>
            {Object.keys(tipoCount).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Nenhum projeto no período.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(tipoCount).sort((a,b) => b[1]-a[1]).slice(0, 5).map(([tipo, count]) => {
                  const tipoMap: Record<string, string> = {
                    'camara_fria': 'Câmara Fria',
                    'tunel_congelamento': 'Túnel de Congelamento',
                    'girofreezer': 'Girofreezer',
                    'climatizacao': 'Climatização',
                    'manutencao': 'Manutenção',
                    'outros': 'Outros',
                  };
                  return (
                    <div key={tipo} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{tipoMap[tipo] || tipo}</span>
                      <span className="text-xs font-extrabold text-gray-900">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leads recentes */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <h3 className="font-extrabold text-gray-900 mb-4">🎯 Leads Recentes</h3>
        {leadsRecentes.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Nenhum lead no período selecionado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {leadsRecentes.slice(0, 10).map((lead: any) => {
              const criadoEm = lead.criadoEm?.toDate ? lead.criadoEm.toDate() : null;
              const horas = criadoEm ? differenceInHours(now, criadoEm) : null;
              const statusColor = {
                'novo':        'bg-yellow-50 text-yellow-700',
                'contatado':   'bg-blue-50 text-blue-700',
                'convertido':  'bg-emerald-50 text-emerald-700',
                'descartado':  'bg-gray-50 text-gray-500',
              }[lead.status as string] || 'bg-gray-50 text-gray-500';

              return (
                <div key={lead.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-gray-900 truncate">{lead.nomeContato}</p>
                      <OrigemBadge origem={lead.origem || 'manual'} />
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusColor}`}>
                        {lead.status || 'novo'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{lead.telefone} · {lead.tipoProjetoTexto || lead.tipoProjetoSlug}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {horas !== null && (
                      <p className={`text-[10px] font-bold ${horas > 24 ? 'text-red-500' : horas > 2 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                        {horas < 1 ? '< 1h' : horas < 24 ? `${horas}h` : `${differenceInDays(now, criadoEm!)}d`}
                      </p>
                    )}
                    {criadoEm && (
                      <p className="text-[10px] text-gray-400">{format(criadoEm, 'dd/MM HH:mm')}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Fluxo de Caixa Gerencial — Sprint 15 ── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <span>💳</span> Fluxo de Caixa
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Recebimentos consolidados de todos os projetos</p>
        </div>
        <div className="p-5">
          <FluxoCaixaGerencial />
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;

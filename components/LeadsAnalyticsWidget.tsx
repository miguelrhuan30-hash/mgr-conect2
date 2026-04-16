/**
 * components/LeadsAnalyticsWidget.tsx
 *
 * Widget de analytics de leads para o BIDashboard.
 * Extrai a aba "Lista" do antigo LeadsDashboard com KPIs de tempo.
 */
import React, { useState, useMemo } from 'react';
import {
  UserPlus, Search, Clock, Download, Filter, Phone,
  Mail, MapPin, TrendingUp, Users, Target, ExternalLink,
} from 'lucide-react';
import { useProjectLeads } from '../hooks/useProjectLeads';
import {
  LeadStatus, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, PROJECT_TYPES, ProjectLead,
} from '../types';
import { format, differenceInHours, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return format(d, 'dd/MM/yy HH:mm', { locale: ptBR });
  } catch { return '—'; }
};

const tipoLabel = (slug: string) =>
  PROJECT_TYPES.find((t) => t.slug === slug)?.label || slug;

// ── Widget Principal ──────────────────────────────────────────────────────────

const LeadsAnalyticsWidget: React.FC = () => {
  const { leads, loading } = useProjectLeads();
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<7 | 30 | 90 | 0>(30);
  const [search, setSearch] = useState('');
  const now = new Date();

  // ── KPIs ──
  const kpis = useMemo(() => {
    const novo = leads.filter((l) => l.status === 'novo').length;
    const contatado = leads.filter((l) => l.status === 'contatado').length;
    const em_negociacao = leads.filter((l) => l.status === 'em_negociacao').length;
    const convertido = leads.filter((l) => l.status === 'convertido').length;
    const descartado = leads.filter((l) => l.status === 'descartado').length;
    const total = leads.length;
    const taxaConversao = total > 0 ? Math.round((convertido / total) * 100) : 0;

    // Tempo médio até primeiro contato (usando faseTimestamps.contatado quando disponível, senão contatadoEm)
    const tempos = leads
      .filter((l) => l.status !== 'novo')
      .map((l) => {
        try {
          const criadoEm = (l as any).criadoEm?.toDate?.();
          const contatadoTs = (l.faseTimestamps?.contatado as any)?.toDate?.() || (l as any).contatadoEm?.toDate?.();
          return criadoEm && contatadoTs ? differenceInHours(contatadoTs, criadoEm) : null;
        } catch { return null; }
      })
      .filter((t): t is number => t !== null && t >= 0);

    const tempoMedioContato = tempos.length > 0
      ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length)
      : null;

    // Tempo médio lead → convertido (dias)
    const temposConversao = leads
      .filter((l) => l.status === 'convertido')
      .map((l) => {
        try {
          const criadoEm = (l as any).criadoEm?.toDate?.();
          const convertidoTs = (l.faseTimestamps?.convertido as any)?.toDate?.();
          return criadoEm && convertidoTs
            ? Math.round(differenceInHours(convertidoTs, criadoEm) / 24)
            : null;
        } catch { return null; }
      })
      .filter((t): t is number => t !== null && t >= 0);

    const tempoMedioConversao = temposConversao.length > 0
      ? Math.round(temposConversao.reduce((a, b) => a + b, 0) / temposConversao.length)
      : null;

    return {
      novo, contatado, em_negociacao, convertido, descartado,
      total, taxaConversao, tempoMedioContato, tempoMedioConversao,
    };
  }, [leads]);

  // ── Filtros ──
  const filtered = useMemo(() => {
    let result = leads;
    if (statusFilter !== 'todos') result = result.filter((l) => l.status === statusFilter);
    if (origemFilter !== 'todos') result = result.filter((l) => (l as any).origem === origemFilter);
    if (periodoFilter > 0) {
      const cutoff = subDays(now, periodoFilter);
      result = result.filter((l) => {
        const d = (l as any).criadoEm?.toDate ? (l as any).criadoEm.toDate() : null;
        return d && d >= cutoff;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) => l.nomeContato.toLowerCase().includes(q)
          || l.empresa?.toLowerCase().includes(q)
          || l.telefone.includes(q),
      );
    }
    return result.sort((a, b) => {
      if (a.status === 'novo' && b.status !== 'novo') return -1;
      if (b.status === 'novo' && a.status !== 'novo') return 1;
      return 0;
    });
  }, [leads, statusFilter, origemFilter, periodoFilter, search]);

  const STATUS_TABS: { value: LeadStatus | 'todos'; label: string; count: number }[] = [
    { value: 'todos', label: 'Todos', count: leads.length },
    { value: 'novo', label: 'Novos', count: kpis.novo },
    { value: 'contatado', label: 'Contatados', count: kpis.contatado },
    { value: 'em_negociacao', label: 'Em Negociação', count: kpis.em_negociacao },
    { value: 'convertido', label: 'Convertidos', count: kpis.convertido },
    { value: 'descartado', label: 'Descartados', count: kpis.descartado },
    { value: 'nao_aprovado', label: 'Não Aprovados', count: leads.filter((l) => l.status === 'nao_aprovado').length },
  ];

  const exportarCSV = () => {
    const rows = [
      ['Nome', 'Empresa', 'Telefone', 'Email', 'Tipo', 'Origem', 'Status', 'Data', 'Localização', 'Notas'],
      ...filtered.map((l: any) => [
        l.nomeContato, l.empresa || '', l.telefone, l.email || '',
        tipoLabel(l.tipoProjetoSlug), l.origem || 'manual', l.status,
        l.criadoEm?.toDate ? format(l.criadoEm.toDate(), 'dd/MM/yyyy HH:mm') : '',
        l.localizacao || '', l.notas || '',
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${format(now, 'yyyyMMdd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-5 h-5 text-violet-600" />
          <h3 className="text-sm font-extrabold text-gray-900">Analytics de Leads</h3>
        </div>
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-white" />
            <h3 className="text-sm font-extrabold text-white">Analytics de Leads</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button
              onClick={() => window.open('/solicitar-projeto', '_blank')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Formulário
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: 'Total de Leads',
              value: kpis.total,
              icon: Users,
              color: 'bg-gray-50 text-gray-700',
              dot: 'bg-gray-400',
            },
            {
              label: 'Novos',
              value: kpis.novo,
              icon: UserPlus,
              color: 'bg-violet-50 text-violet-700',
              dot: 'bg-violet-500',
            },
            {
              label: 'Taxa de Conversão',
              value: `${kpis.taxaConversao}%`,
              icon: TrendingUp,
              color: 'bg-emerald-50 text-emerald-700',
              dot: 'bg-emerald-500',
            },
            {
              label: 'Tempo Médio Contato',
              value: kpis.tempoMedioContato !== null
                ? (kpis.tempoMedioContato < 24 ? `${kpis.tempoMedioContato}h` : `${Math.round(kpis.tempoMedioContato / 24)}d`)
                : '—',
              icon: Clock,
              color: 'bg-blue-50 text-blue-700',
              dot: 'bg-blue-500',
            },
          ].map((k) => (
            <div key={k.label} className={`${k.color} rounded-2xl p-4 border border-current/10`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${k.dot}`} />
                <span className="text-[10px] font-bold uppercase tracking-wide">{k.label}</span>
              </div>
              <p className="text-2xl font-extrabold">{k.value}</p>
            </div>
          ))}
        </div>

        {/* KPI extra — tempo médio de conversão */}
        {kpis.tempoMedioConversao !== null && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
            <Target className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-amber-700 uppercase">Tempo médio lead → contrato</p>
              <p className="text-sm font-extrabold text-amber-900">{kpis.tempoMedioConversao} dias</p>
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex p-1 gap-0.5 bg-white rounded-xl overflow-x-auto border border-gray-200 flex-shrink-0">
              {STATUS_TABS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setStatusFilter(t.value)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
                    statusFilter === t.value
                      ? 'bg-violet-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                  <span className={`text-[9px] px-1.5 rounded-full font-extrabold ${statusFilter === t.value ? 'bg-white/20 text-white' : 'bg-gray-200'}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar lead..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-gray-400 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Origem:
            </span>
            {(['todos', 'formulario_site', 'anuncio_meta', 'anuncio_google', 'manual', 'homepage-mgr-refrigeracao'] as const).map((o) => {
              const labels: Record<string, string> = {
                todos: 'Todas',
                formulario_site: '🌐 Site',
                anuncio_meta: '📘 Meta',
                anuncio_google: '🔍 Google',
                manual: '✋ Manual',
                'homepage-mgr-refrigeracao': '🏠 Homepage',
              };
              return (
                <button
                  key={o}
                  onClick={() => setOrigemFilter(o)}
                  className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                    origemFilter === o
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {labels[o]}
                </button>
              );
            })}
            <span className="ml-3 text-xs font-bold text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Período:
            </span>
            {([0, 7, 30, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodoFilter(p)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                  periodoFilter === p
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {p === 0 ? 'Todos' : `${p}d`}
              </button>
            ))}
          </div>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-10 text-center">
            <UserPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 font-medium text-sm">Nenhum lead encontrado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((lead) => (
              <div
                key={lead.id}
                className="bg-gray-50 rounded-xl border border-gray-200 p-3 md:p-4 hover:bg-white hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-gray-900 text-sm">{lead.nomeContato}</h4>
                      {lead.empresa && (
                        <span className="text-xs text-gray-500">({lead.empresa})</span>
                      )}
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${LEAD_STATUS_COLORS[lead.status]}`}>
                        {LEAD_STATUS_LABELS[lead.status]}
                      </span>
                      {(lead as any).origem && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                          {(
                            {
                              formulario_site: '🌐 Site',
                              anuncio_meta: '📘 Meta',
                              anuncio_google: '🔍 Google',
                              manual: '✋ Manual',
                              'homepage-mgr-refrigeracao': '🏠 Homepage',
                            } as any
                          )[(lead as any).origem] || (lead as any).origem}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />{lead.telefone}
                      </span>
                      {lead.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />{lead.email}
                        </span>
                      )}
                      {lead.localizacao && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />{lead.localizacao}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(lead.criadoEm)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="bg-white border border-gray-200 px-2 py-0.5 rounded-lg text-xs font-medium text-gray-600">
                    {tipoLabel(lead.tipoProjetoSlug)}
                  </span>
                  {lead.notas && (
                    <span className="text-[10px] text-gray-400 italic truncate max-w-[200px]">
                      📝 {lead.notas}
                    </span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-gray-400 text-center pt-2">{filtered.length} lead(s) exibido(s)</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsAnalyticsWidget;

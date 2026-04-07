/**
 * components/LeadsDashboard.tsx — Sprint Projetos v2
 *
 * Dashboard interno de gestão de leads capturados.
 * KPI cards, filtros por status, ações (contatar, converter, descartar).
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Search, Loader2, Phone, Mail, MapPin,
  CheckCircle2, XCircle, ArrowRight, Filter, Briefcase,
  AlertCircle, ExternalLink, Clock, Download, Globe, Target,
} from 'lucide-react';
import { useProjectLeads } from '../hooks/useProjectLeads';
import { LeadStatus, LEAD_STATUS_LABELS, LEAD_STATUS_COLORS, PROJECT_TYPES } from '../types';
import { format, differenceInHours, differenceInDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return format(d, "dd/MM/yy HH:mm", { locale: ptBR });
  } catch { return '—'; }
};

const tipoLabel = (slug: string) =>
  PROJECT_TYPES.find((t) => t.slug === slug)?.label || slug;

const LeadsDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { leads, loading, leadsNovos, marcarContatado, converterEmProjeto, descartarLead } = useProjectLeads();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'todos'>('todos');
  const [origemFilter, setOrigemFilter] = useState<string>('todos');
  const [periodoFilter, setPeriodoFilter] = useState<7 | 30 | 90 | 0>(0); // 0 = todos
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const now = new Date();

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
        (l) =>
          l.nomeContato.toLowerCase().includes(q) ||
          l.empresa?.toLowerCase().includes(q) ||
          l.telefone.includes(q),
      );
    }
    // Ordenar: novos sem resposta primeiro
    return result.sort((a, b) => {
      if (a.status === 'novo' && b.status !== 'novo') return -1;
      if (b.status === 'novo' && a.status !== 'novo') return 1;
      return 0;
    });
  }, [leads, statusFilter, origemFilter, periodoFilter, search]);

  // KPI counts
  const counts = useMemo(() => ({
    novo: leads.filter((l) => l.status === 'novo').length,
    contatado: leads.filter((l) => l.status === 'contatado').length,
    convertido: leads.filter((l) => l.status === 'convertido').length,
    descartado: leads.filter((l) => l.status === 'descartado').length,
  }), [leads]);

  const handleContatar = async (leadId: string) => {
    setActionLoading(leadId + '_contatar');
    await marcarContatado(leadId);
    setActionLoading(null);
  };

  const handleConverter = async (leadId: string) => {
    setActionLoading(leadId + '_converter');
    try {
      const projectId = await converterEmProjeto(leadId);
      navigate(`/app/projetos-v2/${projectId}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDescartar = async (leadId: string) => {
    const motivo = window.prompt('Motivo do descarte:');
    if (!motivo) return;
    setActionLoading(leadId + '_descartar');
    await descartarLead(leadId, motivo);
    setActionLoading(null);
  };

  // CSV Export — Sprint 7
  const exportarCSV = () => {
    const rows = [
      ['Nome', 'Empresa', 'Telefone', 'Email', 'Tipo', 'Origem', 'Status', 'Data', 'Localização'],
      ...filtered.map((l: any) => [
        l.nomeContato, l.empresa || '', l.telefone, l.email || '',
        tipoLabel(l.tipoProjetoSlug), l.origem || 'manual', l.status,
        l.criadoEm?.toDate ? format(l.criadoEm.toDate(), 'dd/MM/yyyy HH:mm') : '',
        l.localizacao || '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `leads_${format(now, 'yyyyMMdd')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const horasDesde = (ts: any): number | null => {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : null;
    return d ? differenceInHours(now, d) : null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  const STATUS_TABS: { value: LeadStatus | 'todos'; label: string; count: number }[] = [
    { value: 'todos', label: 'Todos', count: leads.length },
    { value: 'novo', label: 'Novos', count: counts.novo },
    { value: 'contatado', label: 'Contatados', count: counts.contatado },
    { value: 'convertido', label: 'Convertidos', count: counts.convertido },
    { value: 'descartado', label: 'Descartados', count: counts.descartado },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-violet-600" />
            Leads
            {leadsNovos > 0 && (
              <span className="bg-violet-600 text-white text-xs font-extrabold px-2 py-0.5 rounded-full animate-pulse">
                {leadsNovos} {leadsNovos === 1 ? 'novo' : 'novos'}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500">{filtered.length} leads exibidos de {leads.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={() => navigate('/app/projetos-v2')}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <Briefcase className="w-4 h-4" />
            Projetos
          </button>
          <button
            onClick={() => window.open('/solicitar-projeto', '_blank')}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl text-sm font-bold hover:bg-violet-700"
          >
            <ExternalLink className="w-4 h-4" />
            Ver Formulário
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Novos', value: counts.novo, color: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
          { label: 'Contatados', value: counts.contatado, color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
          { label: 'Convertidos', value: counts.convertido, color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
          { label: 'Descartados', value: counts.descartado, color: 'bg-gray-50 text-gray-600', dot: 'bg-gray-400' },
        ].map((kpi) => (
          <div key={kpi.label} className={`${kpi.color} rounded-2xl p-4 border border-current/10`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${kpi.dot}`} />
              <span className="text-[10px] font-bold uppercase tracking-wide">{kpi.label}</span>
            </div>
            <p className="text-2xl font-extrabold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros avançados — Sprint 7 */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-3">
        {/* Row 1: Status + Busca */}
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex p-1 gap-0.5 bg-gray-100/80 rounded-xl overflow-x-auto flex-shrink-0">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
                  statusFilter === t.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
                <span className="text-[9px] bg-gray-200 px-1.5 rounded-full font-extrabold">{t.count}</span>
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
        {/* Row 2: Origem + Período */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Filter className="w-3 h-3" /> Origem:</span>
          {(['todos', 'formulario_site', 'anuncio_meta', 'anuncio_google', 'manual'] as const).map(o => {
            const labels: Record<string, string> = {
              'todos': 'Todas', 'formulario_site': '🌐 Site', 'anuncio_meta': '📘 Meta',
              'anuncio_google': '🔍 Google', 'manual': '✋ Manual',
            };
            return (
              <button key={o} onClick={() => setOrigemFilter(o)}
                className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                  origemFilter === o ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}>
                {labels[o]}
              </button>
            );
          })}
          <span className="ml-3 text-xs font-bold text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Período:</span>
          {([0, 7, 30, 90] as const).map(p => (
            <button key={p} onClick={() => setPeriodoFilter(p)}
              className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                periodoFilter === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}>
              {p === 0 ? 'Todos' : `${p}d`}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Nenhum lead encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-gray-900">{lead.nomeContato}</h3>
                    {lead.empresa && <span className="text-xs text-gray-500">({lead.empresa})</span>}
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${LEAD_STATUS_COLORS[lead.status]}`}>
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                    {/* Origem badge */}
                    {(lead as any).origem && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                        {{'formulario_site':'🌐 Site','anuncio_meta':'📘 Meta','anuncio_google':'🔍 Google','manual':'✋'}[(lead as any).origem as string] || (lead as any).origem}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.telefone}</span>
                    {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                    {lead.localizacao && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{lead.localizacao}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 flex-shrink-0">{fmtDate(lead.criadoEm)}</span>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                  <span className="bg-gray-100 px-2 py-0.5 rounded-lg font-medium">{tipoLabel(lead.tipoProjetoSlug)}</span>
                  {lead.medidasAproximadas && <span>📐 {lead.medidasAproximadas}</span>}
                  {lead.finalidade && <span>🎯 {lead.finalidade}</span>}
                </div>
                {/* Tempo de resposta */}
                {(() => {
                  const h = horasDesde((lead as any).criadoEm);
                  if (h === null) return null;
                  const color = h > 48 ? 'text-red-600 bg-red-50' : h > 24 ? 'text-orange-600 bg-orange-50' : h > 4 ? 'text-yellow-600 bg-yellow-50' : 'text-emerald-600 bg-emerald-50';
                  const label = h < 1 ? '< 1h' : h < 24 ? `${h}h` : `${differenceInDays(now, (lead as any).criadoEm.toDate())}d`;
                  return (
                    <span className={`flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full ${color}`}>
                      <Clock className="w-2.5 h-2.5" /> {label}
                    </span>
                  );
                })()}
              </div>

              {lead.motivoDescarte && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-xs text-red-700">
                  <strong>Descartado:</strong> {lead.motivoDescarte}
                </div>
              )}

              {/* Ações */}
              <div className="flex items-center gap-2 flex-wrap">
                {lead.status === 'novo' && (
                  <>
                    <button
                      onClick={() => handleContatar(lead.id)}
                      disabled={actionLoading === lead.id + '_contatar'}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {actionLoading === lead.id + '_contatar' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Phone className="w-3 h-3" />}
                      Marcar Contatado
                    </button>
                    <button
                      onClick={() => handleConverter(lead.id)}
                      disabled={actionLoading === lead.id + '_converter'}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {actionLoading === lead.id + '_converter' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      Converter em Projeto
                    </button>
                    <button
                      onClick={() => handleDescartar(lead.id)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      Descartar
                    </button>
                  </>
                )}
                {lead.status === 'contatado' && (
                  <>
                    <button
                      onClick={() => handleConverter(lead.id)}
                      disabled={actionLoading === lead.id + '_converter'}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 disabled:opacity-50"
                    >
                      {actionLoading === lead.id + '_converter' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                      Converter em Projeto
                    </button>
                    <button
                      onClick={() => handleDescartar(lead.id)}
                      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs font-bold hover:bg-gray-50 flex items-center gap-1"
                    >
                      <XCircle className="w-3 h-3" />
                      Descartar
                    </button>
                  </>
                )}
                {lead.status === 'convertido' && lead.projectId && (
                  <button
                    onClick={() => navigate(`/app/projetos-v2/${lead.projectId}`)}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 flex items-center gap-1"
                  >
                    <Briefcase className="w-3 h-3" />
                    Ver Projeto
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LeadsDashboard;

/**
 * components/ProjectHub.tsx — Sprint 10
 *
 * Hub central do módulo de Projetos:
 * - Modo Lista (padrão): cards com busca, filtros de fase, ordenação, export CSV
 * - Modo Kanban: colunas por grupo de fase com drag visual (scroll horizontal)
 * - Modo Dashboard: KPIs, funil, alertas
 * - Filtro por tipo de projeto
 * - Compacto / Normal toggle
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase, Plus, Search, Loader2, ChevronRight,
  UserPlus, XCircle, Filter, BarChart3, LayoutDashboard,
  LayoutList, ArrowUpDown, Download, SlidersHorizontal,
  CheckCircle2, Calendar, DollarSign, Zap, AlertCircle, X, Copy,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import ProjectDashboard from './ProjectDashboard';
import {
  ProjectV2, ProjectPhase,
  PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS,
  PROJECT_PHASE_ORDER, PROJECT_TYPES, PROJECT_TRANSITIONS,
} from '../types';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Stepper mini ──
const PhaseStepperMini: React.FC<{ currentPhase: ProjectPhase }> = ({ currentPhase }) => {
  const idx = PROJECT_PHASE_ORDER.indexOf(currentPhase);
  const isNaoAprovado = currentPhase === 'nao_aprovado';
  const start = Math.max(0, Math.min(idx - 2, PROJECT_PHASE_ORDER.length - 5));
  const visible = PROJECT_PHASE_ORDER.slice(start, start + 5);

  if (isNaoAprovado) return (
    <div className="flex items-center gap-1">
      <span className="w-2 h-2 rounded-full bg-gray-400" />
      <span className="text-[10px] text-gray-400 font-medium">Não Aprovado</span>
    </div>
  );

  return (
    <div className="flex items-center gap-0.5">
      {visible.map((phase, i) => {
        const phaseIdx = PROJECT_PHASE_ORDER.indexOf(phase);
        const done = phaseIdx < idx;
        const active = phaseIdx === idx;
        return (
          <React.Fragment key={phase}>
            <div className={`w-2 h-2 rounded-full transition-all ${
              active ? 'bg-brand-600 ring-2 ring-brand-200 w-2.5 h-2.5'
              : done ? 'bg-emerald-500'
              : 'bg-gray-200'
            }`} title={PROJECT_PHASE_LABELS[phase]} />
            {i < visible.length - 1 && (
              <div className={`w-3 h-0.5 ${done ? 'bg-emerald-300' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

// ── Helpers ──
const tipoLabel = (slug: string) => PROJECT_TYPES.find((t) => t.slug === slug)?.label || slug;
const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts), "dd/MM/yy", { locale: ptBR }); }
  catch { return '—'; }
};
const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`;

// ── KPI Card ──
const KPICard: React.FC<{
  label: string; value: number; icon: React.ReactNode; color: string;
  onClick?: () => void; active?: boolean;
}> = ({ label, value, icon, color, onClick, active }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left ${
      active
        ? `${color} border-current shadow-sm`
        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
    }`}
  >
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-white/60' : 'bg-gray-50'}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="text-[10px] font-medium text-gray-500 mt-0.5">{label}</p>
    </div>
  </button>
);

// ── Tipos de filtro ──
type PhaseFilter = 'todos' | 'lead_capturado' | 'em_levantamento' | 'comercial' | 'execucao' | 'financeiro' | 'nao_aprovado';
type SortKey = 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc' | 'fase';
type ViewMode = 'lista' | 'dashboard';

const PHASE_TABS: { value: PhaseFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'lead_capturado', label: 'Leads' },
  { value: 'em_levantamento', label: 'Levantamento' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'execucao', label: 'Execução' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'nao_aprovado', label: 'Não Aprovados' },
];

const PHASE_GROUPS: Record<PhaseFilter, ProjectPhase[]> = {
  todos: [],
  lead_capturado: ['lead_capturado'],
  em_levantamento: ['em_levantamento'],
  comercial: ['em_cotacao', 'cotacao_recebida', 'proposta_enviada', 'contrato_enviado', 'contrato_assinado'],
  execucao: ['em_planejamento', 'cronograma_aprovado', 'os_distribuidas', 'em_execucao', 'relatorio_enviado'],
  financeiro: ['em_faturamento', 'aguardando_recebimento', 'concluido'],
  nao_aprovado: ['nao_aprovado'],
};

// Kanban removido — vive exclusivamente no FlowAtendimento


// ── Card de projeto (Lista) com Quick Advance — Sprint 13 + Template — Sprint 14 ──
const ListCard: React.FC<{
  project: ProjectV2;
  onClick: () => void;
  compact?: boolean;
  onQuickAdvance?: (project: ProjectV2) => void;
  advanceLoading?: boolean;
  advanceError?: string;
  nextPhaseLabel?: string;
  onUseTemplate?: (project: ProjectV2) => void;
  templateLoading?: boolean;
}> = ({ project, onClick, compact, onQuickAdvance, advanceLoading, advanceError, nextPhaseLabel, onUseTemplate, templateLoading }) => {
  const canAdvance = onQuickAdvance && !!nextPhaseLabel && !['concluido', 'nao_aprovado'].includes(project.fase);
  const isTemplate = project.fase === 'concluido' && !!onUseTemplate;

  return (
    <div className={`w-full bg-white rounded-2xl border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all text-left group ${
      compact ? '' : ''
    }`}>
      {/* Erro inline */}
      {advanceError && (
        <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border-b border-red-100 rounded-t-2xl">
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 flex-1">{advanceError}</p>
        </div>
      )}

      <button onClick={onClick} className={`w-full text-left ${compact ? 'px-4 py-3' : 'p-4 md:p-5'}`}>
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className={`font-bold text-gray-900 truncate ${compact ? 'text-sm' : 'text-base'}`}>{project.nome}</h3>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${PROJECT_PHASE_COLORS[project.fase]}`}>
                {PROJECT_PHASE_LABELS[project.fase]}
              </span>
              {project.fase === 'concluido' && (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
              <span>{project.clientName || 'Sem cliente'}</span>
              <span>·</span>
              <span>{tipoLabel(project.tipoProjetoSlug)}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{fmtDate(project.createdAt)}</span>
            </div>
            {!compact && (
              <div className="mt-2">
                <PhaseStepperMini currentPhase={project.fase} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {project.valorContrato != null && project.valorContrato > 0 && (
              <span className="text-sm font-extrabold text-gray-900">
                {fmtCurrency(project.valorContrato)}
              </span>
            )}
            <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-brand-600 transition-colors" />
          </div>
        </div>
      </button>

      {/* Barra inferior: Quick Advance ou Template — Sprint 13+14 */}
      {(canAdvance || isTemplate) && (
        <div className="px-4 pb-3 -mt-1 flex items-center gap-2">
          {canAdvance && (
            <button
              onClick={e => { e.stopPropagation(); onQuickAdvance?.(project); }}
              disabled={advanceLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 text-xs font-bold hover:bg-brand-100 transition-colors disabled:opacity-50"
            >
              {advanceLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Avançar: {nextPhaseLabel}
            </button>
          )}
          {isTemplate && (
            <button
              onClick={e => { e.stopPropagation(); onUseTemplate?.(project); }}
              disabled={templateLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-xs font-bold hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {templateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Copy className="w-3 h-3" />}
              Usar como Template
            </button>
          )}
        </div>
      )}
    </div>
  );
};


// ── Componente principal ──
const ProjectHub: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading, phaseCounters, advancePhase, createProject } = useProject();

  // Estados de UI
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState<PhaseFilter>('todos');
  const [tipoFilter, setTipoFilter] = useState('todos');
  const [sortKey, setSortKey] = useState<SortKey>('data_desc');
  const [viewMode, setViewMode] = useState<ViewMode>('lista');
  // Kanban agora vive exclusivamente no FlowAtendimento
  const [compact, setCompact] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Quick Advance state — Sprint 13
  const [quickAdvancingId, setQuickAdvancingId] = useState<string | null>(null);
  const [quickAdvanceErrors, setQuickAdvanceErrors] = useState<Record<string, string>>({});

  const handleQuickAdvance = async (project: ProjectV2) => {
    const transitions = PROJECT_TRANSITIONS[project.fase].filter(f => f !== 'nao_aprovado');
    if (transitions.length === 0) return;
    const nextPhase = transitions[0];
    setQuickAdvancingId(project.id);
    setQuickAdvanceErrors(prev => { const n = { ...prev }; delete n[project.id]; return n; });
    const result = await advancePhase(project.id, nextPhase);
    setQuickAdvancingId(null);
    if (!result.success) {
      setQuickAdvanceErrors(prev => ({ ...prev, [project.id]: result.error || 'Erro ao avançar' }));
      // Auto-limpar erro após 6s
      setTimeout(() => setQuickAdvanceErrors(prev => { const n = { ...prev }; delete n[project.id]; return n; }), 6000);
    }
  };

  const getNextPhaseLabel = (project: ProjectV2): string => {
    const transitions = PROJECT_TRANSITIONS[project.fase].filter(f => f !== 'nao_aprovado');
    if (transitions.length === 0) return '';
    return PROJECT_PHASE_LABELS[transitions[0]] || transitions[0];
  };

  // ─ Template: clonar projeto concluído — Sprint 14 ─
  const [templateLoading, setTemplateLoading] = useState<string | null>(null);
  const handleUseTemplate = async (project: ProjectV2) => {
    if (templateLoading) return;
    const nome = window.prompt(
      `Usar '${project.nome}' como template.\nNome do novo projeto:`,
      `[Cópia] ${project.nome}`
    );
    if (!nome?.trim()) return;
    setTemplateLoading(project.id);
    try {
      const newId = await createProject({
        nome: nome.trim(),
        descricao: project.descricao || '',
        clientId: '',
        clientName: '',
        tipoProjetoSlug: project.tipoProjetoSlug,
        fase: 'lead_capturado',
        leadData: undefined as any,
        leadId: undefined as any,
        osIds: [],
        // Clonar prancheta com campos técnicos
        ...(project.prancheta ? { prancheta: { ...project.prancheta, preenchidoEm: undefined as any, preenchidoPor: undefined as any, preenchidoPorNome: undefined as any } } : {}),
        createdBy: '',
        createdByNome: '',
      } as any);
      navigate(`/app/projetos-v2/${newId}`);
    } finally {
      setTemplateLoading(null);
    }
  };

  // ─ Filtros + Ordenação ─
  const filtered = useMemo(() => {
    let result = projects;

    // Fase
    if (phaseFilter !== 'todos') {
      result = result.filter((p) => PHASE_GROUPS[phaseFilter].includes(p.fase));
    }

    // Tipo de projeto
    if (tipoFilter !== 'todos') {
      result = result.filter((p) => p.tipoProjetoSlug === tipoFilter);
    }

    // Busca
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.nome.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q)
      );
    }

    // Ordenação
    return [...result].sort((a, b) => {
      if (sortKey === 'data_desc') {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return db2 - da;
      }
      if (sortKey === 'data_asc') {
        const da = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const db2 = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return da - db2;
      }
      if (sortKey === 'valor_desc') return (b.valorContrato || 0) - (a.valorContrato || 0);
      if (sortKey === 'valor_asc') return (a.valorContrato || 0) - (b.valorContrato || 0);
      if (sortKey === 'fase') return PROJECT_PHASE_ORDER.indexOf(a.fase) - PROJECT_PHASE_ORDER.indexOf(b.fase);
      return 0;
    });
  }, [projects, search, phaseFilter, tipoFilter, sortKey]);

  // ── KPIs ──
  const totalAtivos = projects.filter((p) => p.fase !== 'nao_aprovado' && p.fase !== 'concluido').length;
  const totalLeads = phaseCounters.lead_capturado || 0;
  const totalExecucao = ['em_planejamento', 'cronograma_aprovado', 'os_distribuidas', 'em_execucao', 'relatorio_enviado']
    .reduce((sum, f) => sum + (phaseCounters[f as ProjectPhase] || 0), 0);
  const totalNaoAprovados = phaseCounters.nao_aprovado || 0;
  const totalConcluidos = phaseCounters.concluido || 0;

  // ── Export CSV ──
  const exportarCSV = () => {
    const rows = [
      ['Projeto', 'Cliente', 'Tipo', 'Fase', 'Valor (R$)', 'Data Criação', 'Dias no Ciclo'],
      ...filtered.map(p => {
        const criacao = p.createdAt?.toDate ? p.createdAt.toDate() : null;
        const diasCiclo = criacao ? differenceInDays(new Date(), criacao) : '';
        return [
          p.nome, p.clientName,
          tipoLabel(p.tipoProjetoSlug),
          PROJECT_PHASE_LABELS[p.fase],
          String(p.valorContrato || ''),
          criacao ? format(criacao, 'dd/MM/yyyy') : '',
          String(diasCiclo),
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `projetos_${format(new Date(), 'yyyyMMdd')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Tipos únicos nos projetos ──
  const tiposDisponiveis = useMemo(() => {
    const slugs = [...new Set(projects.map(p => p.tipoProjetoSlug))];
    return slugs.map(s => ({ slug: s, label: tipoLabel(s) })).sort((a, b) => a.label.localeCompare(b.label));
  }, [projects]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Briefcase className="w-6 h-6 text-brand-600" />
            Projetos
          </h1>
          <p className="text-sm text-gray-500">
            {filtered.length} projeto{filtered.length !== 1 ? 's' : ''} · ciclo Lead → Entrega
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle View */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {([
              { mode: 'lista',     icon: LayoutList,      title: 'Lista' },
              { mode: 'dashboard', icon: LayoutDashboard,  title: 'Dashboard' },
            ] as { mode: ViewMode; icon: React.ElementType; title: string }[]).map(({ mode, icon: Icon, title }) => (
              <button key={mode} onClick={() => setViewMode(mode)} title={title}
                className={`px-3 py-2 transition-colors ${viewMode === mode ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>

          {/* Compact toggle (só no modo lista) */}
          {viewMode === 'lista' && (
            <button onClick={() => setCompact(!compact)} title="Modo compacto"
              className={`px-3 py-2 border rounded-xl text-xs font-bold transition-colors ${compact ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {compact ? 'Normal' : 'Compacto'}
            </button>
          )}

          {/* Export CSV */}
          {viewMode !== 'dashboard' && (
            <button onClick={exportarCSV}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">
              <Download className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => navigate('/app/leads')}
            className="flex items-center gap-1.5 px-3 py-2 border border-violet-200 text-violet-700 rounded-xl text-sm font-bold hover:bg-violet-50 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Leads
            {totalLeads > 0 && (
              <span className="bg-violet-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                {totalLeads}
              </span>
            )}
          </button>
          <button
            onClick={() => navigate('/app/flow-atendimento')}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </button>
        </div>
      </div>

      {/* ── Vista Dashboard ── */}
      {viewMode === 'dashboard' && <ProjectDashboard />}

      {/* ── Vista Lista ou Kanban ── */}
      {viewMode !== 'dashboard' && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <KPICard label="Ativos" value={totalAtivos}
              icon={<Briefcase className="w-4 h-4 text-blue-600" />} color="bg-blue-50 text-blue-700"
              onClick={() => setPhaseFilter('todos')} active={phaseFilter === 'todos'} />
            <KPICard label="Leads" value={totalLeads}
              icon={<UserPlus className="w-4 h-4 text-violet-600" />} color="bg-violet-50 text-violet-700"
              onClick={() => setPhaseFilter('lead_capturado')} active={phaseFilter === 'lead_capturado'} />
            <KPICard label="Em Execução" value={totalExecucao}
              icon={<BarChart3 className="w-4 h-4 text-amber-600" />} color="bg-amber-50 text-amber-700"
              onClick={() => setPhaseFilter('execucao')} active={phaseFilter === 'execucao'} />
            <KPICard label="Concluídos" value={totalConcluidos}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-600" />} color="bg-emerald-50 text-emerald-700"
              onClick={() => setPhaseFilter('financeiro')} active={phaseFilter === 'financeiro'} />
            <KPICard label="Não Aprovados" value={totalNaoAprovados}
              icon={<XCircle className="w-4 h-4 text-gray-500" />} color="bg-gray-50 text-gray-600"
              onClick={() => setPhaseFilter('nao_aprovado')} active={phaseFilter === 'nao_aprovado'} />
          </div>

          {/* Barra de filtros */}
          <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm space-y-3">
            {/* Row 1: Status tabs + busca */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex p-1 gap-0.5 bg-gray-100/80 rounded-xl overflow-x-auto flex-shrink-0">
                {PHASE_TABS.map((t) => (
                  <button key={t.value} onClick={() => setPhaseFilter(t.value)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      phaseFilter === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input type="text" placeholder="Buscar projeto ou cliente..." value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white" />
              </div>
              <button onClick={() => setShowFilters(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-colors flex-shrink-0 ${showFilters ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                <SlidersHorizontal className="w-3.5 h-3.5" /> Filtros
              </button>
            </div>

            {/* Row 2: Filtros avançados (colapsável) */}
            {showFilters && (
              <div className="flex items-center gap-3 flex-wrap border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500">Tipo:</span>
                  <select value={tipoFilter} onChange={e => setTipoFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium outline-none bg-white">
                    <option value="todos">Todos os tipos</option>
                    {tiposDisponiveis.map(t => (
                      <option key={t.slug} value={t.slug}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-bold text-gray-500">Ordenar:</span>
                  <select value={sortKey} onChange={e => setSortKey(e.target.value as SortKey)}
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium outline-none bg-white">
                    <option value="data_desc">Mais recentes</option>
                    <option value="data_asc">Mais antigos</option>
                    <option value="valor_desc">Maior valor</option>
                    <option value="valor_asc">Menor valor</option>
                    <option value="fase">Por fase</option>
                  </select>
                </div>
                {(tipoFilter !== 'todos' || sortKey !== 'data_desc') && (
                  <button onClick={() => { setTipoFilter('todos'); setSortKey('data_desc'); }}
                    className="text-xs text-brand-600 font-bold hover:underline">
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Vista LISTA ── */}
          {viewMode === 'lista' && (
            <>
              {filtered.length === 0 ? (
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                  <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">
                    {search || tipoFilter !== 'todos' ? 'Nenhum projeto encontrado.' : 'Nenhum projeto nesta categoria.'}
                  </p>
                  <button onClick={() => navigate('/app/projetos-v2/novo')}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700">
                    <Plus className="w-4 h-4" /> Criar Projeto
                  </button>
                </div>
              ) : (
                <div className={compact ? 'space-y-1.5' : 'space-y-2.5'}>
                  {filtered.map((project) => (
                    <ListCard key={project.id} project={project} compact={compact}
                      onClick={() => navigate(`/app/projetos-v2/${project.id}`)}
                      onQuickAdvance={handleQuickAdvance}
                      advanceLoading={quickAdvancingId === project.id}
                      advanceError={quickAdvanceErrors[project.id]}
                      nextPhaseLabel={getNextPhaseLabel(project)}
                      onUseTemplate={handleUseTemplate}
                      templateLoading={templateLoading === project.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Kanban removido — agora vive exclusivamente no FlowAtendimento */}
        </>
      )}
    </div>
  );
};

export default ProjectHub;

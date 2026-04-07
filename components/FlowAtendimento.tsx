/**
 * components/FlowAtendimento.tsx
 *
 * Módulo unificado "Flow de Atendimento" — consolida as 12 fases do ciclo
 * de vida do projeto em uma única tela com header de cards clicáveis.
 *
 * Estrutura:
 *   - Header: barra horizontal scrollável com um card por fase + badge de contagem
 *   - Conteúdo: lista de projetos filtrados pela fase ativa, com mini-card clicável
 *   - Fase 0 (Leads): renderiza LeadsDashboard diretamente
 *   - Fase 11 (Não Aprovados): renderiza ProjectUpsell diretamente
 *   - Fases 1-10: lista filtrada de ProjectV2 com click → /app/projetos-v2/:id
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Ruler, Calculator, Presentation, FileSignature,
  CalendarDays, Wrench, HardHat, FileText, CreditCard,
  Archive, XCircle, ChevronRight, Search, Plus,
  Loader2, Building2, Calendar, DollarSign, CheckCircle2,
  ArrowRight, Briefcase, AlertCircle, LayoutGrid,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import LeadsDashboard from './LeadsDashboard';
import ProjectUpsell from './ProjectUpsell';
import {
  ProjectV2, ProjectPhase,
  PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS, PROJECT_PHASE_ORDER,
  PROJECT_TYPES,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowFaseId =
  | 'leads'
  | 'prancheta'
  | 'cotacao'
  | 'proposta'
  | 'contrato'
  | 'gantt'
  | 'os'
  | 'execucao'
  | 'relatorio'
  | 'faturamento'
  | 'historico'
  | 'nao_aprovados';

interface FlowFase {
  id: FlowFaseId;
  numero: number;
  label: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;          // Tailwind bg+text para o card ativo
  corBorder: string;    // border do card ativo
  corBg: string;        // bg suave do card inativo
  fases: ProjectPhase[] | null;  // null = componente próprio
  tabHint?: string;     // tab a abrir em ProjectDetail
}

// ── Configuração das fases ─────────────────────────────────────────────────────

const FLOW_FASES: FlowFase[] = [
  {
    id: 'leads',
    numero: 0,
    label: 'Leads',
    descricao: 'Captação via site e anúncios',
    icon: UserPlus,
    cor: 'bg-violet-600 text-white',
    corBorder: 'border-violet-400',
    corBg: 'bg-violet-50 text-violet-700',
    fases: null,
  },
  {
    id: 'prancheta',
    numero: 1,
    label: 'Prancheta',
    descricao: 'Levantamento técnico',
    icon: Ruler,
    cor: 'bg-blue-600 text-white',
    corBorder: 'border-blue-400',
    corBg: 'bg-blue-50 text-blue-700',
    fases: ['lead_capturado', 'em_levantamento'],
    tabHint: 'prancheta',
  },
  {
    id: 'cotacao',
    numero: 2,
    label: 'Cotação',
    descricao: 'Materiais e fornecedores',
    icon: Calculator,
    cor: 'bg-cyan-600 text-white',
    corBorder: 'border-cyan-400',
    corBg: 'bg-cyan-50 text-cyan-700',
    fases: ['em_cotacao', 'cotacao_recebida'],
    tabHint: 'cotacao',
  },
  {
    id: 'proposta',
    numero: 3,
    label: 'Proposta',
    descricao: 'Apresentação comercial',
    icon: Presentation,
    cor: 'bg-indigo-600 text-white',
    corBorder: 'border-indigo-400',
    corBg: 'bg-indigo-50 text-indigo-700',
    fases: ['proposta_enviada'],
    tabHint: 'proposta',
  },
  {
    id: 'contrato',
    numero: 4,
    label: 'Contrato',
    descricao: 'Assinatura e gate de execução',
    icon: FileSignature,
    cor: 'bg-amber-600 text-white',
    corBorder: 'border-amber-400',
    corBg: 'bg-amber-50 text-amber-700',
    fases: ['contrato_enviado', 'contrato_assinado'],
    tabHint: 'contrato',
  },
  {
    id: 'gantt',
    numero: 5,
    label: 'Gantt',
    descricao: 'Planejamento executivo',
    icon: CalendarDays,
    cor: 'bg-sky-600 text-white',
    corBorder: 'border-sky-400',
    corBg: 'bg-sky-50 text-sky-700',
    fases: ['em_planejamento', 'cronograma_aprovado'],
    tabHint: 'gantt',
  },
  {
    id: 'os',
    numero: 6,
    label: 'O.S.',
    descricao: 'Distribuição de ordens de serviço',
    icon: Wrench,
    cor: 'bg-orange-600 text-white',
    corBorder: 'border-orange-400',
    corBg: 'bg-orange-50 text-orange-700',
    fases: ['os_distribuidas'],
    tabHint: 'os',
  },
  {
    id: 'execucao',
    numero: 7,
    label: 'Execução',
    descricao: 'Equipe em campo',
    icon: HardHat,
    cor: 'bg-yellow-600 text-white',
    corBorder: 'border-yellow-400',
    corBg: 'bg-yellow-50 text-yellow-700',
    fases: ['em_execucao'],
    tabHint: 'os',
  },
  {
    id: 'relatorio',
    numero: 8,
    label: 'Relatório',
    descricao: 'Relatório final ao cliente',
    icon: FileText,
    cor: 'bg-pink-600 text-white',
    corBorder: 'border-pink-400',
    corBg: 'bg-pink-50 text-pink-700',
    fases: ['relatorio_enviado'],
    tabHint: 'relatorio',
  },
  {
    id: 'faturamento',
    numero: 9,
    label: 'Faturamento',
    descricao: 'Cobrança e recebimento',
    icon: CreditCard,
    cor: 'bg-rose-600 text-white',
    corBorder: 'border-rose-400',
    corBg: 'bg-rose-50 text-rose-700',
    fases: ['em_faturamento', 'aguardando_recebimento'],
    tabHint: 'faturamento',
  },
  {
    id: 'historico',
    numero: 10,
    label: 'Concluídos',
    descricao: 'Projetos finalizados',
    icon: Archive,
    cor: 'bg-emerald-600 text-white',
    corBorder: 'border-emerald-400',
    corBg: 'bg-emerald-50 text-emerald-700',
    fases: ['concluido'],
    tabHint: 'historico',
  },
  {
    id: 'nao_aprovados',
    numero: 11,
    label: 'Não Aprovados',
    descricao: 'Upsell e reabordagem',
    icon: XCircle,
    cor: 'bg-gray-600 text-white',
    corBorder: 'border-gray-400',
    corBg: 'bg-gray-100 text-gray-600',
    fases: null,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (ts: any): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'dd/MM/yy', { locale: ptBR });
  } catch { return '—'; }
};

const fmtCurrency = (v?: number) =>
  v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—';

const tipoLabel = (slug: string) =>
  PROJECT_TYPES.find(t => t.slug === slug)?.label || slug;

// ── Mini Card do Projeto ───────────────────────────────────────────────────────

const ProjectMiniCard: React.FC<{
  project: ProjectV2;
  fase: FlowFase;
  onOpen: () => void;
}> = ({ project, fase, onOpen }) => {
  const osProgress = project.totalOSConcluidas != null && project.totalOSPrevistas
    ? Math.round((project.totalOSConcluidas / project.totalOSPrevistas) * 100)
    : null;

  const phaseColor = PROJECT_PHASE_COLORS[project.fase] || 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <button
      onClick={onOpen}
      className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all group"
    >
      <div className="flex items-start gap-3">
        {/* Ícone da fase */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${fase.corBg}`}>
          <fase.icon className="w-5 h-5" />
        </div>

        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-bold text-gray-900 truncate">{project.nome}</h4>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${phaseColor}`}>
              {PROJECT_PHASE_LABELS[project.fase]}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
            <span className="flex items-center gap-0.5">
              <Building2 className="w-3 h-3" />{project.clientName}
            </span>
            <span className="flex items-center gap-0.5">
              <Briefcase className="w-3 h-3" />{tipoLabel(project.tipoProjetoSlug)}
            </span>
            {project.valorContrato && (
              <span className="flex items-center gap-0.5 font-bold text-gray-600">
                <DollarSign className="w-3 h-3" />{fmtCurrency(project.valorContrato)}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />{fmtDate(project.createdAt)}
            </span>
          </div>

          {/* Barra de progresso de O.S. */}
          {osProgress != null && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-1.5 rounded-full transition-all ${osProgress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                  style={{ width: `${osProgress}%` }}
                />
              </div>
              <span className="text-[9px] font-bold text-gray-500 flex-shrink-0">
                {project.totalOSConcluidas}/{project.totalOSPrevistas} O.S.
              </span>
            </div>
          )}
        </div>

        {/* Chevron */}
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 flex-shrink-0 transition-colors mt-1" />
      </div>
    </button>
  );
};

// ── Lista de projetos por fase ─────────────────────────────────────────────────

const FaseProjectList: React.FC<{
  fase: FlowFase;
  projects: ProjectV2[];
  search: string;
  onSearch: (v: string) => void;
}> = ({ fase, projects, search, onSearch }) => {
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.nome.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const handleOpen = (project: ProjectV2) => {
    if (fase.tabHint) {
      navigate(`/app/projetos-v2/${project.id}?tab=${fase.tabHint}`);
    } else {
      navigate(`/app/projetos-v2/${project.id}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Barra de busca + novo projeto */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder={`Buscar em ${fase.label}...`}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 outline-none"
          />
        </div>
        <button
          onClick={() => navigate('/app/projetos-v2')}
          className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <LayoutGrid className="w-3.5 h-3.5" /> Ver todos
        </button>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">
            {search ? 'Nenhum projeto encontrado' : `Nenhum projeto em ${fase.label}`}
          </p>
          {!search && (
            <p className="text-xs text-gray-300 mt-1">
              Projetos aparecerão aqui quando avançarem para esta fase.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(project => (
            <ProjectMiniCard
              key={project.id}
              project={project}
              fase={fase}
              onOpen={() => handleOpen(project)}
            />
          ))}
        </div>
      )}

      {/* Dica de navegação */}
      {filtered.length > 0 && (
        <p className="text-[10px] text-gray-400 text-center">
          💡 Clique em um projeto para abrir a fase <strong>{fase.label}</strong> e executar as atividades.
        </p>
      )}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────────

const FlowAtendimento: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading } = useProject();

  const [faseSelecionada, setFaseSelecionada] = useState<FlowFaseId>('leads');
  const [search, setSearch] = useState('');

  // Contagem de projetos por agrupamento de fase
  const contagemPorFase = useMemo(() => {
    const counts: Record<FlowFaseId, number> = {} as any;
    FLOW_FASES.forEach(f => { counts[f.id] = 0; });

    if (!projects) return counts;

    projects.forEach(p => {
      FLOW_FASES.forEach(f => {
        if (f.fases && f.fases.includes(p.fase)) {
          counts[f.id]++;
        }
      });
    });

    return counts;
  }, [projects]);

  // Projetos filtrados para a fase selecionada
  const projetosDaFase = useMemo(() => {
    if (!projects) return [];
    const fase = FLOW_FASES.find(f => f.id === faseSelecionada);
    if (!fase?.fases) return [];
    return projects.filter(p => fase.fases!.includes(p.fase));
  }, [projects, faseSelecionada]);

  const faseAtual = FLOW_FASES.find(f => f.id === faseSelecionada)!;

  // Reset search ao trocar de fase
  const handleFaseChange = (id: FlowFaseId) => {
    setFaseSelecionada(id);
    setSearch('');
  };

  return (
    <div className="space-y-0 -m-4 sm:-m-6 lg:-m-8 min-h-screen bg-gray-50">

      {/* ── Header da página ── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 pt-6 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
              <div className="w-8 h-8 bg-brand-600 rounded-xl flex items-center justify-center">
                <ArrowRight className="w-4 h-4 text-white" />
              </div>
              Flow de Atendimento
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Ciclo completo: Lead → Prancheta → Cotação → Proposta → Contrato → Gantt → O.S. → Execução → Relatório → Faturamento
            </p>
          </div>
          <button
            onClick={() => navigate('/app/projetos-v2/novo')}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Projeto
          </button>
        </div>

        {/* ── Cards de fase (scroll horizontal) ── */}
        <div className="overflow-x-auto pb-0 scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-0">
            {FLOW_FASES.map((fase, idx) => {
              const isActive = faseSelecionada === fase.id;
              const count = fase.fases ? contagemPorFase[fase.id] : null;

              return (
                <button
                  key={fase.id}
                  onClick={() => handleFaseChange(fase.id)}
                  className={`
                    relative flex flex-col items-center gap-1.5 px-4 py-3 rounded-t-2xl border-b-2 transition-all min-w-[100px]
                    ${isActive
                      ? `${fase.cor} border-transparent shadow-sm`
                      : `bg-white text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-700`
                    }
                  `}
                >
                  {/* Número da fase */}
                  <span className={`text-[9px] font-extrabold tracking-widest uppercase ${isActive ? 'opacity-70' : 'text-gray-300'}`}>
                    Fase {fase.numero}
                  </span>

                  {/* Ícone */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : fase.corBg}`}>
                    <fase.icon className="w-4 h-4" />
                  </div>

                  {/* Label */}
                  <span className="text-xs font-bold whitespace-nowrap">{fase.label}</span>

                  {/* Badge de contagem */}
                  {count != null && count > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[9px] font-extrabold rounded-full flex items-center justify-center px-1 ${
                      isActive ? 'bg-white text-gray-800' : 'bg-brand-600 text-white'
                    }`}>
                      {count}
                    </span>
                  )}

                  {/* Indicador ativo (bottom border) */}
                  {isActive && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Conteúdo da fase ── */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">

        {/* Cabeçalho da fase selecionada */}
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${faseAtual.corBg}`}>
            <faseAtual.icon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-gray-900">
              Fase {faseAtual.numero} — {faseAtual.label}
            </h2>
            <p className="text-xs text-gray-400">{faseAtual.descricao}</p>
          </div>
          {faseAtual.fases && (
            <div className="ml-auto flex gap-1.5 flex-wrap justify-end">
              {faseAtual.fases.map(f => (
                <span key={f} className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${PROJECT_PHASE_COLORS[f]}`}>
                  {PROJECT_PHASE_LABELS[f]}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && faseSelecionada !== 'leads' && faseSelecionada !== 'nao_aprovados' && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
          </div>
        )}

        {/* Fase 0 — Leads: renderiza módulo próprio */}
        {faseSelecionada === 'leads' && !loading && (
          <LeadsDashboard />
        )}

        {/* Fase 11 — Não Aprovados: renderiza módulo próprio */}
        {faseSelecionada === 'nao_aprovados' && !loading && (
          <ProjectUpsell />
        )}

        {/* Fases 1-10 — Lista filtrada de projetos */}
        {faseAtual.fases && !loading && (
          <FaseProjectList
            fase={faseAtual}
            projects={projetosDaFase}
            search={search}
            onSearch={setSearch}
          />
        )}
      </div>
    </div>
  );
};

export default FlowAtendimento;

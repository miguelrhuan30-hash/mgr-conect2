/**
 * components/FunilConversao.tsx
 *
 * Funil visual de conversão — mostra projetos nas fases 1-4 (comercial)
 * em retângulos decrescentes formando um funil. Cards clicáveis navegam
 * para a fase correspondente no FlowAtendimento.
 *
 * A descida do card é automática: o hook useProject usa onSnapshot em
 * real-time, então quando advancePhase() é chamado em qualquer aba, o
 * componente recebe os projetos atualizados e o card reaparece no estágio correto.
 */
import React, { useState } from 'react';
import {
  Ruler, Calculator, Presentation, FileSignature,
  CheckCircle2, ChevronRight, Clock, TrendingUp,
} from 'lucide-react';
import { ProjectV2, ProjectPhase, PROJECT_TYPES } from '../types';
import { differenceInDays } from 'date-fns';

// ── Tipos locais ──────────────────────────────────────────────────────────────

type FlowFaseId =
  | 'leads' | 'prancheta' | 'cotacao' | 'proposta' | 'contrato'
  | 'gantt' | 'os' | 'execucao' | 'relatorio' | 'faturamento'
  | 'historico' | 'nao_aprovados';

// ── Configuração dos estágios do funil ────────────────────────────────────────

interface FunilStage {
  faseId: FlowFaseId;
  label: string;
  descricao: string;
  icon: React.ElementType;
  projectPhases: ProjectPhase[];
  widthPercent: number;
  cor: string;
  corBg: string;
  corBorder: string;
  corText: string;
  isConvertido?: boolean;
}

const FUNIL_STAGES: FunilStage[] = [
  {
    faseId: 'prancheta',
    label: 'Prancheta',
    descricao: 'Levantamento técnico em andamento',
    icon: Ruler,
    projectPhases: ['lead_capturado', 'em_levantamento'],
    widthPercent: 100,
    cor: 'bg-blue-600',
    corBg: 'bg-blue-50',
    corBorder: 'border-blue-200',
    corText: 'text-blue-700',
  },
  {
    faseId: 'cotacao',
    label: 'Cotação',
    descricao: 'Materiais sendo cotados',
    icon: Calculator,
    projectPhases: ['em_cotacao', 'cotacao_recebida'],
    widthPercent: 82,
    cor: 'bg-cyan-600',
    corBg: 'bg-cyan-50',
    corBorder: 'border-cyan-200',
    corText: 'text-cyan-700',
  },
  {
    faseId: 'proposta',
    label: 'Proposta',
    descricao: 'Proposta em preparação/enviada',
    icon: Presentation,
    projectPhases: ['proposta_enviada'],
    widthPercent: 65,
    cor: 'bg-indigo-600',
    corBg: 'bg-indigo-50',
    corBorder: 'border-indigo-200',
    corText: 'text-indigo-700',
  },
  {
    faseId: 'contrato',
    label: 'Contrato',
    descricao: 'Aguardando assinatura',
    icon: FileSignature,
    projectPhases: ['contrato_enviado', 'contrato_assinado'],
    widthPercent: 50,
    cor: 'bg-amber-600',
    corBg: 'bg-amber-50',
    corBorder: 'border-amber-200',
    corText: 'text-amber-700',
  },
  {
    faseId: 'gantt',
    label: 'Convertido',
    descricao: 'Contrato assinado — em execução',
    icon: CheckCircle2,
    projectPhases: [
      'em_planejamento', 'cronograma_aprovado',
      'os_distribuidas', 'em_execucao',
      'relatorio_enviado', 'em_faturamento',
      'aguardando_recebimento', 'concluido',
    ],
    widthPercent: 36,
    cor: 'bg-emerald-600',
    corBg: 'bg-emerald-50',
    corBorder: 'border-emerald-200',
    corText: 'text-emerald-700',
    isConvertido: true,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const tipoLabel = (slug: string) =>
  PROJECT_TYPES.find((t) => t.slug === slug)?.label || slug;

const diasNaFase = (project: ProjectV2): number | null => {
  try {
    const hist = project.faseHistorico;
    if (!hist || hist.length === 0) return null;
    const last = hist[hist.length - 1];
    const d = (last.alteradoEm as any)?.toDate?.();
    return d ? differenceInDays(new Date(), d) : null;
  } catch { return null; }
};

// ── Card de Projeto no Funil ──────────────────────────────────────────────────

interface FunilProjetoCardProps {
  project: ProjectV2;
  stage: FunilStage;
  onClick: () => void;
}

const FunilProjetoCard: React.FC<FunilProjetoCardProps> = ({ project, stage, onClick }) => {
  const dias = diasNaFase(project);
  const atrasado = dias !== null && dias > 3;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-2.5 transition-all hover:shadow-md group ${
        atrasado
          ? 'bg-red-50 border-red-200 hover:border-red-300'
          : `bg-white ${stage.corBorder} hover:border-current`
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <p className="text-[11px] font-bold text-gray-900 leading-tight line-clamp-2 flex-1">
          {project.nome}
        </p>
        <ChevronRight className={`w-3 h-3 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${stage.corText}`} />
      </div>
      <p className="text-[10px] text-gray-500 truncate mb-1.5">{project.clientName}</p>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md truncate max-w-[80px]">
          {tipoLabel(project.tipoProjetoSlug)}
        </span>
        {dias !== null && (
          <span className={`text-[9px] font-bold flex items-center gap-0.5 ${atrasado ? 'text-red-600' : 'text-gray-400'}`}>
            <Clock className="w-2.5 h-2.5" />
            {dias === 0 ? 'hoje' : `${dias}d`}
          </span>
        )}
      </div>
      {project.valorContrato && (
        <p className="text-[9px] font-bold text-emerald-700 mt-1">
          R$ {project.valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
        </p>
      )}
    </button>
  );
};

// ── Componente Principal ──────────────────────────────────────────────────────

interface FunilConversaoProps {
  projects: ProjectV2[];
  onNavigateToFase: (faseId: FlowFaseId, projectId?: string) => void;
  faseSelecionada: FlowFaseId;
}

const FunilConversao: React.FC<FunilConversaoProps> = ({
  projects,
  onNavigateToFase,
  faseSelecionada,
}) => {
  const [collapsed, setCollapsed] = useState(false);

  // Agrupa projetos por estágio do funil
  const projetosPorEstagio = FUNIL_STAGES.map((stage) => ({
    stage,
    projects: projects.filter((p) => stage.projectPhases.includes(p.fase)),
  }));

  const totalEmConversao = projetosPorEstagio
    .filter((e) => !e.stage.isConvertido)
    .reduce((acc, e) => acc + e.projects.length, 0);

  const totalConvertido = projetosPorEstagio
    .find((e) => e.stage.isConvertido)?.projects.length ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header colapsável */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-600" />
          <span className="text-sm font-extrabold text-gray-900">Funil de Conversão</span>
          <span className="text-[10px] text-gray-500 font-medium">
            {totalEmConversao} em conversão · {totalConvertido} convertido(s)
          </span>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? '' : 'rotate-90'}`}
        />
      </button>

      {!collapsed && (
        <div className="px-5 py-5 space-y-2">
          {projetosPorEstagio.map(({ stage, projects: stageProjects }, idx) => {
            const isActive = faseSelecionada === stage.faseId;
            const hasProjects = stageProjects.length > 0;

            return (
              <div key={stage.faseId} className="flex flex-col items-center">
                {/* Conector entre estágios */}
                {idx > 0 && (
                  <div className="w-0.5 h-2 bg-gray-200 flex-shrink-0" />
                )}

                {/* Retângulo do estágio */}
                <div
                  className={`rounded-xl border transition-all ${stage.corBorder} ${stage.corBg} ${
                    isActive ? 'ring-2 ring-offset-1 ring-current shadow-sm' : ''
                  }`}
                  style={{ width: `${stage.widthPercent}%` }}
                >
                  {/* Header do estágio */}
                  <button
                    onClick={() => onNavigateToFase(stage.faseId)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-t-xl transition-colors hover:opacity-90 ${stage.cor}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <stage.icon className="w-3.5 h-3.5 text-white" />
                      <span className="text-[11px] font-extrabold text-white">{stage.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold bg-white/20 text-white px-1.5 py-0.5 rounded-full`}>
                        {stageProjects.length}
                      </span>
                      <ChevronRight className="w-3 h-3 text-white/70" />
                    </div>
                  </button>

                  {/* Cards dos projetos */}
                  <div className="p-2">
                    {!hasProjects ? (
                      <p className={`text-[10px] text-center py-2 ${stage.corText} opacity-50`}>
                        Nenhum projeto nesta fase
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {stageProjects.slice(0, 5).map((project) => (
                          <FunilProjetoCard
                            key={project.id}
                            project={project}
                            stage={stage}
                            onClick={() => {
                              if (stage.isConvertido) {
                                // Para convertidos, navega direto ao projeto na sua fase atual
                                onNavigateToFase(stage.faseId, project.id);
                              } else {
                                onNavigateToFase(stage.faseId, project.id);
                              }
                            }}
                          />
                        ))}
                        {stageProjects.length > 5 && (
                          <button
                            onClick={() => onNavigateToFase(stage.faseId)}
                            className={`w-full text-center text-[10px] font-bold py-1.5 rounded-lg ${stage.corBg} ${stage.corText} border ${stage.corBorder} hover:opacity-80 transition-opacity`}
                          >
                            +{stageProjects.length - 5} mais → Ver todos
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Legenda */}
          <p className="text-[9px] text-gray-400 text-center pt-1">
            Clique em um card para ir diretamente à fase · Cards vermelhos indicam &gt;3 dias na fase
          </p>
        </div>
      )}
    </div>
  );
};

export default FunilConversao;

/**
 * components/FlowAtendimento.tsx
 *
 * Módulo unificado "Flow de Atendimento" — consolida as 12 fases do ciclo
 * de vida do projeto em uma única tela com header de cards clicáveis.
 *
 * Novidade (RACI):
 *   - Cada card de fase tem um badge mostrando o setor responsável (RACI)
 *   - Gestores com canManageSettings podem editar o setor via dropdown
 *   - Configuração salva em raci_config/flow_phases no Firestore
 *   - Dados refletidos no BI (RaciMatrizWidget em BIDashboard.tsx)
 */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus, Ruler, Calculator, Presentation, FileSignature,
  Wrench, HardHat, FileText, CreditCard,
  Archive, XCircle, ChevronRight, Search, Plus, ArrowLeft,
  Loader2, Building2, Calendar, DollarSign,
  ArrowRight, Briefcase, AlertCircle, LayoutGrid,
  Settings, Check, Users, Pencil, Printer, Eye,
  FolderOpen, Zap, ClipboardList, Trash2, ExternalLink, Hash,
} from 'lucide-react';
import {
  doc, getDoc, setDoc, collection, getDocs, onSnapshot, Timestamp,
  query, where, orderBy, updateDoc, deleteDoc, writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../hooks/useProject';
import LeadsDashboard from './LeadsDashboard';
import ProjectUpsell from './ProjectUpsell';
import ProjectPrancheta from './ProjectPrancheta';
import ProjectCotacao from './ProjectCotacao';
import ProjectProposta from './ProjectProposta';
import ProjectContrato from './ProjectContrato';
import FunilConversao from './FunilConversao';
import { Suspense, lazy } from 'react';
const OSEditModal = lazy(() => import('./OSEditModal'));
const OSRelatorioConclusao = lazy(() => import('./OSRelatorioConclusao'));
import {
  ProjectV2, ProjectPhase, Sector,
  PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS,
  PROJECT_TYPES, CollectionName,
  RaciFlowEntry, RaciFlowConfig,
  Task, WorkflowStatus as WS, WORKFLOW_LABELS, WORKFLOW_COLORS,
  STATUS_OS_LABELS, STATUS_OS_COLORS, OSStatusFinal,
} from '../types';
import { normalizeStatusOS } from '../services/osService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ── Types locais ────────────────────────────────────────────────────────────────

type FlowFaseId =
  | 'leads' | 'prancheta' | 'cotacao' | 'proposta' | 'contrato'
  | 'gantt' | 'os' | 'execucao' | 'relatorio' | 'faturamento'
  | 'historico' | 'nao_aprovados';

interface FlowFase {
  id: FlowFaseId;
  numero: number;
  label: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;
  corBg: string;
  fases: ProjectPhase[] | null;
  tabHint?: string;
}

// ── Configuração das fases ─────────────────────────────────────────────────────

const FLOW_FASES: FlowFase[] = [
  { id: 'leads',        numero: 0,  label: 'Leads',         descricao: 'Captação via site e anúncios',         icon: UserPlus,     cor: 'bg-violet-600 text-white', corBg: 'bg-violet-50 text-violet-700',   fases: null },
  { id: 'prancheta',    numero: 1,  label: 'Prancheta',     descricao: 'Levantamento técnico',                  icon: Ruler,        cor: 'bg-blue-600 text-white',   corBg: 'bg-blue-50 text-blue-700',       fases: ['lead_capturado', 'em_levantamento'], tabHint: 'prancheta' },
  { id: 'cotacao',      numero: 2,  label: 'Cotação',       descricao: 'Materiais e fornecedores',              icon: Calculator,   cor: 'bg-cyan-600 text-white',   corBg: 'bg-cyan-50 text-cyan-700',       fases: ['em_cotacao', 'cotacao_recebida'],    tabHint: 'cotacao' },
  { id: 'proposta',     numero: 3,  label: 'Proposta',      descricao: 'Apresentação comercial',                icon: Presentation, cor: 'bg-indigo-600 text-white', corBg: 'bg-indigo-50 text-indigo-700',   fases: ['proposta_enviada'],                 tabHint: 'proposta' },
  { id: 'contrato',     numero: 4,  label: 'Contrato',      descricao: 'Assinatura e gate de execução',         icon: FileSignature,cor: 'bg-amber-600 text-white',  corBg: 'bg-amber-50 text-amber-700',     fases: ['contrato_enviado'], tabHint: 'contrato' },
  { id: 'os',           numero: 5,  label: 'Planejamento',  descricao: 'Tarefas, distribuição em O.S. e cronograma Gantt', icon: ClipboardList, cor: 'bg-orange-600 text-white', corBg: 'bg-orange-50 text-orange-700',   fases: ['contrato_assinado', 'em_planejamento', 'cronograma_aprovado', 'os_distribuidas'],  tabHint: 'os' },
  { id: 'execucao',     numero: 6,  label: 'Execução',      descricao: 'Equipe em campo — criar/ajustar O.S. e Gantt', icon: HardHat, cor: 'bg-yellow-600 text-white', corBg: 'bg-yellow-50 text-yellow-700',   fases: ['em_execucao'],                     tabHint: 'os' },
  { id: 'relatorio',    numero: 7,  label: 'Relatório',     descricao: 'Relatório final ao cliente',            icon: FileText,     cor: 'bg-pink-600 text-white',   corBg: 'bg-pink-50 text-pink-700',       fases: ['relatorio_enviado'],               tabHint: 'relatorio' },
  { id: 'faturamento',  numero: 8,  label: 'Faturamento',   descricao: 'Cobrança e recebimento',                icon: CreditCard,   cor: 'bg-rose-600 text-white',   corBg: 'bg-rose-50 text-rose-700',       fases: ['em_faturamento', 'aguardando_recebimento'], tabHint: 'faturamento' },
  { id: 'historico',    numero: 9,  label: 'Concluídos',    descricao: 'Projetos finalizados',                  icon: Archive,      cor: 'bg-emerald-600 text-white',corBg: 'bg-emerald-50 text-emerald-700', fases: ['concluido'],                       tabHint: 'historico' },
  { id: 'nao_aprovados',numero: 10, label: 'Não Aprovados', descricao: 'Upsell e reabordagem',                  icon: XCircle,      cor: 'bg-gray-600 text-white',   corBg: 'bg-gray-100 text-gray-600',      fases: null },
];

const RACI_DOC = 'flow_phases';

// Fases que abrem inline no FlowAtendimento (sem navegar para o ProjectDetail)
const INLINE_FASES: FlowFaseId[] = ['prancheta', 'cotacao', 'proposta', 'contrato'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (ts: any): string => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), 'dd/MM/yy', { locale: ptBR }); }
  catch { return '—'; }
};
const fmtCurrency = (v?: number) => v != null ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : '—';
const tipoLabel = (slug: string) => PROJECT_TYPES.find(t => t.slug === slug)?.label || slug;

// ── Mini Card do Projeto ───────────────────────────────────────────────────────

const ProjectMiniCard: React.FC<{
  project: ProjectV2;
  fase: FlowFase;
  onOpen: () => void;
  canManage?: boolean;
  onArchive?: () => void;
  onDelete?: () => void;
}> = ({ project, fase, onOpen, canManage, onArchive, onDelete }) => {
  const osProgress = project.totalOSConcluidas != null && project.totalOSPrevistas
    ? Math.round((project.totalOSConcluidas / project.totalOSPrevistas) * 100) : null;
  const phaseColor = PROJECT_PHASE_COLORS[project.fase] || 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="relative group">
      <button onClick={onOpen} className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all group/card">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${fase.corBg}`}>
            <fase.icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-bold text-gray-900 truncate">{project.nome}</h4>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${phaseColor}`}>
                {PROJECT_PHASE_LABELS[project.fase]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
              <span className="flex items-center gap-0.5"><Building2 className="w-3 h-3" />{project.clientName}</span>
              <span className="flex items-center gap-0.5"><Briefcase className="w-3 h-3" />{tipoLabel(project.tipoProjetoSlug)}</span>
              {project.valorContrato && <span className="flex items-center gap-0.5 font-bold text-gray-600"><DollarSign className="w-3 h-3" />{fmtCurrency(project.valorContrato)}</span>}
              <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmtDate(project.createdAt)}</span>
            </div>
            {osProgress != null && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-1.5 rounded-full transition-all ${osProgress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${osProgress}%` }} />
                  </div>
                  <span className="text-[9px] font-bold text-gray-500 flex-shrink-0">{project.totalOSConcluidas}/{project.totalOSPrevistas} O.S.</span>
                </div>
                {osProgress >= 100 && (
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-emerald-600 animate-pulse">
                    <Check className="w-3 h-3" /> Todas OS concluídas — pronto para avançar
                  </div>
                )}
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover/card:text-brand-500 flex-shrink-0 transition-colors mt-1" />
        </div>
      </button>

      {/* Ações de gestão — visíveis apenas no hover para usuários com canManageProjects */}
      {canManage && (
        <div className="absolute top-2 right-8 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => { e.stopPropagation(); onArchive?.(); }}
            title="Arquivar projeto"
            className="p-1.5 rounded-lg bg-amber-50 text-amber-500 hover:bg-amber-100 border border-amber-100 transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
            title="Excluir projeto"
            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 border border-red-100 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

// ── RACI Setor Badge — exibido em cada card de fase ───────────────────────────

const RaciSetorBadge: React.FC<{
  faseId: FlowFaseId;
  faseLabel: string;
  raciConfig: Record<string, RaciFlowEntry>;
  setores: Sector[];
  canEdit: boolean;
  onSave: (faseId: string, setorId: string, setorNome: string) => Promise<void>;
}> = ({ faseId, faseLabel, raciConfig, setores, canEdit, onSave }) => {
  const entry = raciConfig[faseId];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(entry?.setorId || '');

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const setor = setores.find(s => s.id === selected);
    if (setor) await onSave(faseId, setor.id, setor.name);
    setSaving(false);
    setEditing(false);
  };

  // Se setor atribuído
  if (entry?.setorNome && !editing) {
    return (
      <div className="flex items-center gap-1 mt-1.5">
        <span className="flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 bg-white/20 rounded-full text-white/90 truncate max-w-[90px]">
          <Users className="w-2.5 h-2.5 flex-shrink-0" />
          <span className="truncate">{entry.setorNome}</span>
        </span>
        {canEdit && (
          <button onClick={e => { e.stopPropagation(); setEditing(true); }}
            className="p-0.5 rounded-full bg-white/10 hover:bg-white/30 text-white/70 transition-colors">
            <Settings className="w-2.5 h-2.5" />
          </button>
        )}
      </div>
    );
  }

  // Sem setor ou em edição
  if (!canEdit) return null; // não gestor + sem setor → não mostra nada

  if (!editing) {
    return (
      <button onClick={e => { e.stopPropagation(); setEditing(true); }}
        className="mt-1.5 flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 bg-white/10 hover:bg-white/20 rounded-full text-white/60 transition-colors">
        <Users className="w-2.5 h-2.5" /> Definir setor
      </button>
    );
  }

  // Dropdown de seleção
  return (
    <div onClick={e => e.stopPropagation()} className="mt-1.5 flex items-center gap-1">
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        className="text-[9px] rounded-lg px-1.5 py-0.5 bg-white text-gray-700 font-bold border-0 outline-none max-w-[100px] cursor-pointer"
        autoFocus
      >
        <option value="">Setor...</option>
        {setores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <button onClick={handleSave} disabled={!selected || saving}
        className="p-0.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white disabled:opacity-40 transition-colors">
        {saving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Check className="w-2.5 h-2.5" />}
      </button>
      <button onClick={() => setEditing(false)} className="p-0.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors">
        <XCircle className="w-2.5 h-2.5" />
      </button>
    </div>
  );
};

// ── Lista de projetos por fase ─────────────────────────────────────────────────

const FaseProjectList: React.FC<{
  fase: FlowFase;
  projects: ProjectV2[];
  search: string;
  onSearch: (v: string) => void;
  onSelectInline?: (projectId: string) => void;
  canManage?: boolean;
  onArchiveProject?: (project: ProjectV2) => void;
  onDeleteProject?: (project: ProjectV2) => void;
}> = ({ fase, projects, search, onSearch, onSelectInline, canManage, onArchiveProject, onDeleteProject }) => {
  const navigate = useNavigate();
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => p.nome.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q));
  }, [projects, search]);

  const handleOpen = (project: ProjectV2) => {
    if (onSelectInline) {
      onSelectInline(project.id);
    } else {
      navigate(fase.tabHint
        ? `/app/projetos-v2/${project.id}?tab=${fase.tabHint}&from=flow`
        : `/app/projetos-v2/${project.id}?from=flow`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder={`Buscar em ${fase.label}...`}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-400 outline-none" />
        </div>
        {!onSelectInline && (
          <button onClick={() => navigate('/app/projetos-v2')}
            className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            <LayoutGrid className="w-3.5 h-3.5" /> Ver todos
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-bold text-gray-400">{search ? 'Nenhum projeto encontrado' : `Nenhum projeto em ${fase.label}`}</p>
          {!search && <p className="text-xs text-gray-300 mt-1">Projetos aparecerão aqui quando avançarem para esta fase.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(project => (
            <ProjectMiniCard
              key={project.id}
              project={project}
              fase={fase}
              onOpen={() => handleOpen(project)}
              canManage={canManage}
              onArchive={() => onArchiveProject?.(project)}
              onDelete={() => onDeleteProject?.(project)}
            />
          ))}
        </div>
      )}
      {filtered.length > 0 && (
        <p className="text-[10px] text-gray-400 text-center">
          {onSelectInline
            ? `📄 Clique para abrir ${fase.label} do projeto.`
            : `💡 Clique em um projeto para abrir a fase ${fase.label} e executar as atividades.`}
        </p>
      )}
    </div>
  );
};

// ── Fase 6 — Lista unificada de O.S. (projetos + avulsas) ────────────────────

const OSTaskCard: React.FC<{
  task: Task;
  onEdit: (task: Task) => void;
  onPrint: (task: Task) => void;
}> = ({ task, onEdit, onPrint }) => {
  const statusNorm = normalizeStatusOS((task as any).statusOS);
  const wfColor = WORKFLOW_COLORS[task.workflowStatus as WS] || 'bg-gray-100 text-gray-600 border-gray-200';
  const hasProject = !!(task as any).projectId;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 hover:border-orange-300 hover:shadow-md transition-all group">
      <div className="flex items-start gap-3">
        {/* Ícone lateral */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${hasProject ? 'bg-indigo-50 text-indigo-600' : 'bg-orange-50 text-orange-600'}`}>
          {hasProject ? <FolderOpen className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          {/* Header: número + badges */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-extrabold text-gray-500">
              {(task as any).numeroOS || task.code || task.id.slice(0, 8)}
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${wfColor}`}>
              {WORKFLOW_LABELS[task.workflowStatus as WS] || task.workflowStatus}
            </span>
            {hasProject && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-full">
                Projeto
              </span>
            )}
            {(task as any).faturamentoPeloProjeto && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 border border-violet-200 rounded-full">
                Fat. Projeto
              </span>
            )}
            {!hasProject && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 bg-orange-100 text-orange-700 border border-orange-200 rounded-full flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" /> Avulsa
              </span>
            )}
            {statusNorm && STATUS_OS_LABELS[statusNorm] && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_OS_COLORS[statusNorm] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {STATUS_OS_LABELS[statusNorm]}
              </span>
            )}
          </div>

          {/* Título */}
          <h4 className="text-sm font-bold text-gray-900 truncate">{task.title}</h4>

          {/* Metadados */}
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
            {task.clientName && (
              <span className="flex items-center gap-0.5"><Building2 className="w-3 h-3" />{task.clientName}</span>
            )}
            {task.assigneeName && (
              <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{task.assigneeName}</span>
            )}
            {(task as any).tipoServico && (
              <span className="flex items-center gap-0.5"><ClipboardList className="w-3 h-3" />{(task as any).tipoServico}</span>
            )}
            {task.endDate && (
              <span className="flex items-center gap-0.5">
                <Calendar className="w-3 h-3" />
                {(() => { try { return format((task.endDate as any).toDate(), 'dd/MM/yy', { locale: ptBR }); } catch { return '—'; } })()}
              </span>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => onEdit(task)} title="Editar O.S."
            className="p-2 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => onPrint(task)} title="Imprimir O.S."
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Fase 7 — Relatório de conclusão por O.S. (avulsa + projeto + contrato) ───

const OSRelatorioCard: React.FC<{ task: Task; onOpen: (task: Task) => void }> = ({ task, onOpen }) => {
  const hasProject = !!(task as any).projectId;
  const enviado = (task as any).relatorioOSEnvio?.status === 'relatorio_enviado';

  return (
    <button
      onClick={() => onOpen(task)}
      className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-pink-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${enviado ? 'bg-emerald-50 text-emerald-600' : 'bg-pink-50 text-pink-600'}`}>
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] font-extrabold text-gray-500 flex items-center gap-0.5">
              <Hash className="w-2.5 h-2.5" />{(task as any).numeroOS || task.code || task.id.slice(0, 8)}
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">
              {hasProject ? 'Projeto' : 'Avulsa'}
            </span>
            {enviado ? (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Relatório enviado
              </span>
            ) : (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border bg-orange-100 text-orange-700 border-orange-200">
                Aguardando relatório
              </span>
            )}
          </div>
          <h4 className="text-sm font-bold text-gray-900 truncate">{task.title}</h4>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 flex-wrap">
            {task.clientName && <span className="flex items-center gap-0.5"><Building2 className="w-3 h-3" />{task.clientName}</span>}
            {task.assigneeName && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{task.assigneeName}</span>}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-2" />
      </div>
    </button>
  );
};

const FaseRelatorioOSList: React.FC<{
  tasks: Task[];
  loading: boolean;
  onOpen: (task: Task) => void;
}> = ({ tasks, loading, onOpen }) => {
  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>;
  }
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Relatórios de Conclusão por O.S. ({tasks.length})
      </p>
      {tasks.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <p className="text-xs text-gray-400">Nenhuma O.S. concluída aguardando relatório.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {tasks.map(task => <OSRelatorioCard key={task.id} task={task} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
};

// ── Ferramenta de manutenção: corrige O.S. concluídas com workflowStatus
// desatualizado (ex.: marcadas via painel "Mudar status" do FieldApp antes
// da correção de sincronização). Sistema ainda em fase de testes, sem O.S.
// em faturamento/pagamento real — destino é sempre CONCLUIDO; a granularidade
// de faturamento (AGUARDANDO_FATURAMENTO/AGUARDANDO_PAGAMENTO) fica para
// quando esse fluxo for desenhado e testado à parte. ──────────────────────

interface DiagnosticoItem { task: Task; atual: string; destino: WS; }

const OSDiagnosticoWorkflow: React.FC = () => {
  const [diagnostico, setDiagnostico] = useState<DiagnosticoItem[] | null>(null);
  const [rodando, setRodando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);

  const rodarDiagnostico = async () => {
    setRodando(true);
    setResultado(null);
    try {
      const snap = await getDocs(query(collection(db, CollectionName.TASKS), where('status', '==', 'completed')));
      const itens: DiagnosticoItem[] = [];
      snap.docs.forEach(d => {
        const t = { id: d.id, ...d.data() } as Task;
        if ((t as any).archived === true) return;
        const ws = t.workflowStatus;
        if (ws === WS.CONCLUIDO) return; // já correto

        itens.push({ task: t, atual: ws ? (WORKFLOW_LABELS[ws] || ws) : '(vazio)', destino: WS.CONCLUIDO });
      });
      setDiagnostico(itens);
    } finally {
      setRodando(false);
    }
  };

  const aplicarCorrecao = async () => {
    if (!diagnostico || diagnostico.length === 0) return;
    setAplicando(true);
    try {
      const CHUNK = 400;
      for (let i = 0; i < diagnostico.length; i += CHUNK) {
        const batch = writeBatch(db);
        diagnostico.slice(i, i + CHUNK).forEach(({ task, destino }) => {
          const ref = doc(db, CollectionName.TASKS, task.id);
          const extra: Record<string, any> = {};
          if (!(task as any).relatorioOSEnvio) extra.relatorioOSEnvio = { status: 'aguardando_relatorio' };
          batch.update(ref, { workflowStatus: destino, ...extra, updatedAt: Timestamp.now() });
        });
        await batch.commit();
      }
      setResultado(`${diagnostico.length} O.S. corrigida(s) com sucesso.`);
      setDiagnostico(null);
    } catch (e: any) {
      setResultado(`Erro ao corrigir: ${e.message || e}`);
    } finally {
      setAplicando(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-xs font-extrabold text-amber-800 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Manutenção — O.S. desincronizadas
          </p>
          <p className="text-[10px] text-amber-600 mt-0.5">
            Diagnostica O.S. já concluídas (status) mas presas numa fase antiga do workflow (ex.: marcadas pelo painel "Mudar status" do FieldApp antes da correção).
          </p>
        </div>
        {diagnostico === null && (
          <button onClick={rodarDiagnostico} disabled={rodando}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50 flex-shrink-0">
            {rodando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertCircle className="w-3.5 h-3.5" />}
            Diagnosticar
          </button>
        )}
      </div>

      {resultado && <p className="text-xs font-bold text-amber-800">{resultado}</p>}

      {diagnostico !== null && (
        diagnostico.length === 0 ? (
          <p className="text-xs text-amber-700">Nenhuma O.S. desincronizada encontrada. Tudo certo ✓</p>
        ) : (
          <div className="space-y-2">
            <div className="max-h-64 overflow-y-auto space-y-1.5 bg-white/60 rounded-xl p-2">
              {diagnostico.map(({ task, atual, destino }) => (
                <div key={task.id} className="flex items-center gap-2 text-[10px] px-2 py-1.5 bg-white rounded-lg border border-amber-100">
                  <span className="font-bold text-gray-500 flex-shrink-0">{(task as any).numeroOS || task.id.slice(0, 8)}</span>
                  <span className="text-gray-700 truncate flex-1">{task.title}</span>
                  <span className="text-red-500 flex-shrink-0">{atual}</span>
                  <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                  <span className="text-emerald-600 font-bold flex-shrink-0">{WORKFLOW_LABELS[destino]}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setDiagnostico(null)} disabled={aplicando}
                className="px-3 py-2 border border-amber-300 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100 disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={aplicarCorrecao} disabled={aplicando}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
                {aplicando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Corrigir {diagnostico.length} O.S.
              </button>
            </div>
          </div>
        )
      )}
    </div>
  );
};

const FaseOSList: React.FC<{
  fase: FlowFase;
  projects: ProjectV2[];
  osTasks: Task[];
  osLoading: boolean;
  search: string;
  onSearch: (v: string) => void;
  onEditOS: (task: Task) => void;
  onPrintOS: (task: Task) => void;
  onOpenProject: (projectId: string) => void;
  canManage?: boolean;
  onArchiveProject?: (project: ProjectV2) => void;
  onDeleteProject?: (project: ProjectV2) => void;
}> = ({ fase, projects, osTasks, osLoading, search, onSearch, onEditOS, onPrintOS, onOpenProject, canManage, onArchiveProject, onDeleteProject }) => {
  const navigate = useNavigate();

  // Filtro unificado por busca
  const q = search.toLowerCase();
  const filteredTasks = useMemo(() =>
    osTasks.filter(t =>
      (t.title || '').toLowerCase().includes(q)
      || (t.clientName || '').toLowerCase().includes(q)
      || ((t as any).numeroOS || '').toLowerCase().includes(q)
      || (t.assigneeName || '').toLowerCase().includes(q)
    ), [osTasks, q]);
  const filteredProjects = useMemo(() =>
    projects.filter(p => p.nome.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q)),
    [projects, q]);

  // Separar OS avulsas e OS de projeto
  const osAvulsas = useMemo(() => filteredTasks.filter(t => !(t as any).projectId), [filteredTasks]);
  const osDeProjeto = useMemo(() => filteredTasks.filter(t => !!(t as any).projectId), [filteredTasks]);

  const totalItems = filteredTasks.length + filteredProjects.length;

  // Tabs: Todas as O.S. / Projetos
  const [viewTab, setViewTab] = useState<'todas' | 'projetos'>('todas');

  return (
    <div className="space-y-4">
      {/* Barra de busca + navegação */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => onSearch(e.target.value)} placeholder="Buscar O.S. por número, título, cliente, técnico..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-400 outline-none" />
        </div>
        <button onClick={() => navigate('/app/os')}
          className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          <LayoutGrid className="w-3.5 h-3.5" /> Módulo O.S.
        </button>
      </div>

      {/* Tabs toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        <button onClick={() => setViewTab('todas')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${viewTab === 'todas' ? 'bg-white text-orange-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <Wrench className="w-3.5 h-3.5" /> Todas as O.S. <span className="text-[10px] font-extrabold bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full">{filteredTasks.length}</span>
        </button>
        <button onClick={() => setViewTab('projetos')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${viewTab === 'projetos' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          <FolderOpen className="w-3.5 h-3.5" /> Projetos <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{filteredProjects.length}</span>
        </button>
      </div>

      {/* Loading */}
      {osLoading && (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      )}

      {/* Tab: Todas as O.S. */}
      {viewTab === 'todas' && !osLoading && (
        <div className="space-y-6">
          {/* OS Avulsas */}
          {osAvulsas.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-orange-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> O.S. Avulsas <span className="text-[10px] bg-orange-100 px-1.5 py-0.5 rounded-full">{osAvulsas.length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {osAvulsas.map(task => (
                  <OSTaskCard key={task.id} task={task} onEdit={onEditOS} onPrint={onPrintOS} />
                ))}
              </div>
            </div>
          )}

          {/* OS de Projeto */}
          {osDeProjeto.length > 0 && (
            <div>
              <h3 className="text-xs font-extrabold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5" /> O.S. de Projetos <span className="text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded-full">{osDeProjeto.length}</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {osDeProjeto.map(task => (
                  <OSTaskCard key={task.id} task={task} onEdit={onEditOS} onPrint={onPrintOS} />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {filteredTasks.length === 0 && (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">{search ? 'Nenhuma O.S. encontrada' : 'Nenhuma O.S. ativa no sistema'}</p>
              <p className="text-xs text-gray-300 mt-1">Crie uma O.S. no módulo Ordens de Serviço para visualizá-la aqui.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Projetos */}
      {viewTab === 'projetos' && !osLoading && (
        <div>
          {filteredProjects.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <AlertCircle className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-gray-400">{search ? 'Nenhum projeto encontrado' : 'Nenhum projeto na fase O.S.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredProjects.map(project => (
                <ProjectMiniCard
                  key={project.id}
                  project={project}
                  fase={fase}
                  onOpen={() => onOpenProject(project.id)}
                  canManage={canManage}
                  onArchive={() => onArchiveProject?.(project)}
                  onDelete={() => onDeleteProject?.(project)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hint */}
      {totalItems > 0 && (
        <p className="text-[10px] text-gray-400 text-center">
          💡 Clique em ✏️ para editar uma O.S. com acesso completo, ou em 🖨️ para imprimir. Todas as ações do módulo O.S. estão disponíveis aqui.
        </p>
      )}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────────

const FlowAtendimento: React.FC = () => {
  const navigate = useNavigate();
  const { projects, loading } = useProject();
  const { userProfile, currentUser } = useAuth();

  const [faseSelecionada, setFaseSelecionada] = useState<FlowFaseId>('leads');
  const [search, setSearch] = useState('');
  const [openNovoLead, setOpenNovoLead] = useState(false);
  // Prancheta inline: abre o editor abaixo dos cards do flow sem navegar
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // ── Fase 6 (O.S.) — query de TODAS as OS ativas ─────────────────────────────
  const [allOSTasks, setAllOSTasks] = useState<Task[]>([]);
  const [osTasksLoading, setOsTasksLoading] = useState(false);
  const [editingOSTask, setEditingOSTask] = useState<Task | null>(null);

  useEffect(() => {
    // Carrega desde o início (não só ao entrar na fase) para que os badges de
    // contagem por fase já apareçam corretos no primeiro carregamento da tela.
    setOsTasksLoading(true);
    // Busca TODAS as tasks — filtra archived e concluídas no client-side
    // (campo 'archived' não existe na maioria dos docs, != exclui docs sem o campo)
    const q2 = query(
      collection(db, CollectionName.TASKS),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q2, snap => {
      const tasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Task))
        .filter(t => !((t as any).archived === true))    // exclui arquivadas
        .filter(t => t.workflowStatus !== WS.CONCLUIDO); // exclui concluídas
      setAllOSTasks(tasks);
      setOsTasksLoading(false);
    }, () => setOsTasksLoading(false));
    return () => unsub();
  }, []);

  // ── Fase 7 (Relatório) — TODAS as O.S. concluídas (avulsa + projeto + contrato) ──
  const [osRelatorioTasks, setOsRelatorioTasks] = useState<Task[]>([]);
  const [osRelatorioLoading, setOsRelatorioLoading] = useState(false);
  const [relatorioOSTask, setRelatorioOSTask] = useState<Task | null>(null);

  useEffect(() => {
    // Carrega desde o início (mesmo motivo do efeito de allOSTasks acima) —
    // sem isso o badge da fase Relatório fica zerado até o usuário clicar nela.
    setOsRelatorioLoading(true);
    const q3 = query(collection(db, CollectionName.TASKS), where('status', '==', 'completed'));
    const unsub = onSnapshot(q3, snap => {
      const tasks = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Task))
        .filter(t => !((t as any).archived === true))
        .sort((a, b) => {
          const aT = (a as any).relatorioFinal?.finalizadoEm?.seconds ?? (a as any).execution?.actualEndTime?.seconds ?? 0;
          const bT = (b as any).relatorioFinal?.finalizadoEm?.seconds ?? (b as any).execution?.actualEndTime?.seconds ?? 0;
          return bT - aT;
        });
      setOsRelatorioTasks(tasks);
      setOsRelatorioLoading(false);
    }, () => setOsRelatorioLoading(false));
    return () => unsub();
  }, []);

  // ── Filtros de Concluídos ────────────────────────────────────────────────────
  const [concFilterMes, setConcFilterMes] = useState<string>('');       // 'YYYY-MM'
  const [concFilterInicio, setConcFilterInicio] = useState<string>(''); // 'YYYY-MM-DD'
  const [concFilterFim, setConcFilterFim] = useState<string>('');       // 'YYYY-MM-DD'

  // ── RACI state ─────────────────────────────────────────────────────────────
  const [raciConfig, setRaciConfig] = useState<Record<string, RaciFlowEntry>>({});
  const [setores, setSetores] = useState<Sector[]>([]);
  const [raciLoading, setRaciLoading] = useState(true);

  // Somente canManageSettings pode editar a RACI
  const canEditRaci = userProfile?.role === 'admin' || userProfile?.role === 'developer'
    || !!userProfile?.permissions?.canManageSettings;

  // canManageProjects — pode arquivar e excluir projetos do flow
  const canManageProjects = userProfile?.role === 'admin' || userProfile?.role === 'developer'
    || !!userProfile?.permissions?.canManageProjects;

  // ── Confirmação de exclusão e feedback ──────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState<ProjectV2 | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const showFeedback = useCallback((msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  }, []);

  const handleArchiveProject = useCallback(async (project: ProjectV2) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, project.id), {
        archived: true,
        archivedAt: Timestamp.now(),
        archivedBy: currentUser.uid,
      });
      showFeedback(`"${project.nome}" arquivado com sucesso.`);
    } catch {
      showFeedback('Erro ao arquivar projeto. Tente novamente.');
    }
  }, [currentUser, showFeedback]);

  const handleDeleteProject = useCallback(async (project: ProjectV2) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, CollectionName.PROJECTS_V2, project.id));
      setConfirmDelete(null);
      showFeedback(`"${project.nome}" excluído permanentemente.`);
    } catch {
      setConfirmDelete(null);
      showFeedback('Erro ao excluir projeto. Tente novamente.');
    }
  }, [currentUser, showFeedback]);

  // Carrega setores (uma vez)
  useEffect(() => {
    getDocs(collection(db, CollectionName.SECTORS))
      .then(snap => setSetores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sector))))
      .catch(() => {});
  }, []);

  // Escuta o doc RACI em tempo real
  useEffect(() => {
    const ref = doc(db, CollectionName.RACI_CONFIG, RACI_DOC);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        setRaciConfig((snap.data() as RaciFlowConfig).fases || {});
      }
      setRaciLoading(false);
    }, () => setRaciLoading(false));
    return () => unsub();
  }, []);

  // Salva setor de uma fase na RACI
  const handleSaveRaci = useCallback(async (faseId: string, setorId: string, setorNome: string) => {
    if (!currentUser) return;
    const fase = FLOW_FASES.find(f => f.id === faseId);
    const entry: RaciFlowEntry = {
      faseId,
      faseLabel: fase?.label || faseId,
      setorId,
      setorNome,
      role: 'responsible',
      atualizadoPor: currentUser.uid,
      atualizadoEm: Timestamp.now(),
    };
    const ref = doc(db, CollectionName.RACI_CONFIG, RACI_DOC);
    await setDoc(ref, { fases: { ...raciConfig, [faseId]: entry } }, { merge: true });
  }, [currentUser, raciConfig]);

  // ── Dados computados ───────────────────────────────────────────────────────

  const contagemPorFase = useMemo(() => {
    const counts: Record<FlowFaseId, number> = {} as any;
    FLOW_FASES.forEach(f => { counts[f.id] = 0; });
    if (!projects) return counts;
    projects.forEach(p => {
      FLOW_FASES.forEach(f => { if (f.fases?.includes(p.fase)) counts[f.id]++; });
    });
    // Fases O.S. e Execução — incluir count de OS ativas no badge
    if (allOSTasks.length > 0) {
      counts['os'] = (counts['os'] || 0) + allOSTasks.filter(t => t.workflowStatus !== WS.EM_EXECUCAO).length;
      counts['execucao'] = (counts['execucao'] || 0) + allOSTasks.filter(t => t.workflowStatus === WS.EM_EXECUCAO).length;
    }
    // Fase Relatório — soma O.S. individuais ainda aguardando envio de relatório
    if (osRelatorioTasks.length > 0) {
      counts['relatorio'] = (counts['relatorio'] || 0)
        + osRelatorioTasks.filter(t => (t as any).relatorioOSEnvio?.status !== 'relatorio_enviado').length;
    }
    return counts;
  }, [projects, allOSTasks, osRelatorioTasks]);

  const projetosDaFase = useMemo(() => {
    if (!projects) return [];
    const fase = FLOW_FASES.find(f => f.id === faseSelecionada);
    if (!fase?.fases) return [];
    let lista = projects.filter(p => fase.fases!.includes(p.fase) && !p.archived);

    // Filtros de data apenas para Concluídos
    if (faseSelecionada === 'historico') {
      if (concFilterMes) {
        const [ano, mes] = concFilterMes.split('-').map(Number);
        lista = lista.filter(p => {
          try {
            const d = (p.updatedAt as any)?.toDate?.() || new Date((p.updatedAt as any)?.seconds * 1000);
            return d.getFullYear() === ano && d.getMonth() + 1 === mes;
          } catch { return true; }
        });
      } else if (concFilterInicio || concFilterFim) {
        lista = lista.filter(p => {
          try {
            const d = (p.updatedAt as any)?.toDate?.() || new Date((p.updatedAt as any)?.seconds * 1000);
            const dt = d.toISOString().slice(0, 10);
            const ok1 = concFilterInicio ? dt >= concFilterInicio : true;
            const ok2 = concFilterFim ? dt <= concFilterFim : true;
            return ok1 && ok2;
          } catch { return true; }
        });
      }
    }

    return lista;
  }, [projects, faseSelecionada, concFilterMes, concFilterInicio, concFilterFim]);

  const faseAtual = FLOW_FASES.find(f => f.id === faseSelecionada)!;

  // Projeto selecionado para modo inline da Prancheta
  const selectedProject = useMemo(
    () => (selectedProjectId ? projects?.find(p => p.id === selectedProjectId) ?? null : null),
    [selectedProjectId, projects]
  );

  const handleFaseChange = (id: FlowFaseId) => {
    setFaseSelecionada(id);
    setSearch('');
    setSelectedProjectId(null); // fecha editor inline ao trocar de fase
  };

  // Guard: se selectedProjectId aponta para projeto não encontrado após loading,
  // reseta para a lista — evita tela branca quando há race condition com onSnapshot.
  useEffect(() => {
    if (INLINE_FASES.includes(faseSelecionada) && !loading && selectedProjectId && !selectedProject) {
      setSelectedProjectId(null);
    }
  }, [faseSelecionada, loading, selectedProjectId, selectedProject]);

  // ── Navegação a partir do FunilConversao ou cards ─────────────────────────
  const handleNavigateToFase = (faseId: FlowFaseId, projectId?: string) => {
    if (INLINE_FASES.includes(faseId)) {
      // Todas as fases comerciais abrem inline dentro do FlowAtendimento
      setFaseSelecionada(faseId);
      setSearch('');
      setSelectedProjectId(projectId ?? null);
    } else if (projectId) {
      // Fases de execução (gantt, os, execucao…) ainda navegam para ProjectDetail
      const fase = FLOW_FASES.find(f => f.id === faseId);
      navigate(
        fase?.tabHint
          ? `/app/projetos-v2/${projectId}?tab=${fase.tabHint}&from=flow`
          : `/app/projetos-v2/${projectId}?from=flow`
      );
    } else {
      // Clique no header do estágio sem projectId → apenas troca de fase
      setFaseSelecionada(faseId);
      setSearch('');
      setSelectedProjectId(null);
    }
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
              {canEditRaci && !raciLoading && (
                <span className="ml-2 text-[9px] font-bold text-brand-500 bg-brand-50 px-1.5 py-0.5 rounded-full">
                  ✏️ Configuração RACI ativa
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => {
              setFaseSelecionada('leads');
              setOpenNovoLead(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors">
            <Plus className="w-4 h-4" /> Novo Lead
          </button>
        </div>

        {/* ── Cards de fase (scroll horizontal) ── */}
        <div className="overflow-x-auto pb-0 scrollbar-hide">
          <div className="flex gap-2 min-w-max pb-0">
            {FLOW_FASES.map(fase => {
              const isActive = faseSelecionada === fase.id;
              const count = fase.fases ? contagemPorFase[fase.id] : null;

              return (
                <button
                  key={fase.id}
                  onClick={() => handleFaseChange(fase.id)}
                  className={`
                    relative flex flex-col items-center gap-1 px-3 py-3 rounded-t-2xl border-b-2 transition-all min-w-[96px]
                    ${isActive ? `${fase.cor} border-transparent shadow-sm` : `bg-white text-gray-500 border-transparent hover:bg-gray-50 hover:text-gray-700`}
                  `}
                >
                  {/* Número da fase */}
                  <span className={`text-[8px] font-extrabold tracking-widest uppercase ${isActive ? 'opacity-70' : 'text-gray-300'}`}>
                    Fase {fase.numero}
                  </span>

                  {/* Ícone */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isActive ? 'bg-white/20' : fase.corBg}`}>
                    <fase.icon className="w-4 h-4" />
                  </div>

                  {/* Label */}
                  <span className="text-xs font-bold whitespace-nowrap">{fase.label}</span>

                  {/* RACI Setor Badge — mostrado dentro do card ativo */}
                  {isActive && (
                    <RaciSetorBadge
                      faseId={fase.id}
                      faseLabel={fase.label}
                      raciConfig={raciConfig}
                      setores={setores}
                      canEdit={canEditRaci}
                      onSave={handleSaveRaci}
                    />
                  )}

                  {/* Setor mini-label no card inativo (somente read) */}
                  {!isActive && raciConfig[fase.id]?.setorNome && (
                    <span className="text-[7px] font-bold text-gray-400 truncate max-w-[80px] px-1">
                      <Users className="w-2 h-2 inline mr-0.5" />
                      {raciConfig[fase.id].setorNome}
                    </span>
                  )}

                  {/* Badge de contagem */}
                  {count != null && count > 0 && (
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] text-[9px] font-extrabold rounded-full flex items-center justify-center px-1 ${isActive ? 'bg-white text-gray-800' : 'bg-brand-600 text-white'}`}>
                      {count}
                    </span>
                  )}

                  {/* Indicador ativo */}
                  {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />}
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
            <p className="text-xs text-gray-400 flex items-center gap-1.5">
              {faseAtual.descricao}
              {raciConfig[faseSelecionada]?.setorNome && (
                <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                  <Users className="w-2.5 h-2.5" /> {raciConfig[faseSelecionada].setorNome}
                </span>
              )}
            </p>
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
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-brand-500" /></div>
        )}


        {/* Filtros de data — somente na fase Concluídos */}
        {faseSelecionada === 'historico' && !loading && (
          <div className="mb-4 flex flex-wrap items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Filtrar por:
            </span>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-emerald-600">Mês:</label>
              <input type="month" value={concFilterMes}
                onChange={e => { setConcFilterMes(e.target.value); setConcFilterInicio(''); setConcFilterFim(''); }}
                className="border border-emerald-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-bold text-emerald-600">De:</label>
              <input type="date" value={concFilterInicio}
                onChange={e => { setConcFilterInicio(e.target.value); setConcFilterMes(''); }}
                className="border border-emerald-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
              <label className="text-[10px] font-bold text-emerald-600">Até:</label>
              <input type="date" value={concFilterFim}
                onChange={e => { setConcFilterFim(e.target.value); setConcFilterMes(''); }}
                className="border border-emerald-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-emerald-400 bg-white" />
            </div>
            {(concFilterMes || concFilterInicio || concFilterFim) && (
              <button onClick={() => { setConcFilterMes(''); setConcFilterInicio(''); setConcFilterFim(''); }}
                className="flex items-center gap-1 px-2.5 py-1 border border-emerald-300 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors">
                <XCircle className="w-3 h-3" /> Limpar
              </button>
            )}
            <span className="text-[10px] text-emerald-500 ml-auto">{projetosDaFase.length} projeto(s)</span>
          </div>
        )}

        {/* Fase 0 — Leads: CRM Funil de Leads (acima) */}
        {faseSelecionada === 'leads' && (
          <LeadsDashboard
            initialTab={openNovoLead ? 'config' : undefined}
            key={openNovoLead ? 'novo-lead' : 'leads'}
            onNavigateToFlow={handleFaseChange}
          />
        )}

        {/* ── Funil de Conversão — SOMENTE Fase 0 (Leads), ABAIXO do LeadsDashboard */}
        {faseSelecionada === 'leads' && !loading && (
          <div className="mt-6">
            <FunilConversao
              projects={projects || []}
              onNavigateToFase={handleNavigateToFase}
              faseSelecionada={faseSelecionada}
            />
          </div>
        )}

        {/* Fase 11 — Nao Aprovados */}
        {faseSelecionada === 'nao_aprovados' && !loading && <ProjectUpsell />}

        {/* ── Helper: breadcrumb de retorno para fases inline ── */}
        {INLINE_FASES.includes(faseSelecionada) && !loading && selectedProjectId && selectedProject && (
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <button
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-500 hover:text-brand-600 hover:bg-brand-50 rounded-xl border border-gray-200 hover:border-brand-200 transition-all"
            >
              <ArrowLeft className="w-4 h-4" /> {faseAtual.label}
            </button>
            <div className="flex items-center gap-1.5 min-w-0">
              <faseAtual.icon className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="text-sm font-extrabold text-gray-800 truncate">{selectedProject.nome}</span>
              <span className="text-xs text-gray-400 hidden md:block">· {selectedProject.clientName}</span>
            </div>
            <button
              onClick={() => navigate(`/app/projetos-v2/${selectedProject.id}?from=flow`)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-brand-600 hover:bg-brand-50 rounded-lg border border-brand-200 transition-all ml-auto"
            >
              <ExternalLink className="w-3 h-3" /> Projeto completo
            </button>
          </div>
        )}

        {/* Fase 1 — Prancheta: modo inline (lista de projetos → editor embarcado) */}
        {faseSelecionada === 'prancheta' && !loading && !selectedProjectId && (
          <FaseProjectList
            fase={faseAtual}
            projects={projetosDaFase}
            search={search}
            onSearch={setSearch}
            onSelectInline={setSelectedProjectId}
            canManage={canManageProjects}
            onArchiveProject={handleArchiveProject}
            onDeleteProject={setConfirmDelete}
          />
        )}
        {faseSelecionada === 'prancheta' && !loading && selectedProjectId && selectedProject && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <ProjectPrancheta
              projectId={selectedProject.id}
              prancheta={selectedProject.prancheta}
              projectName={selectedProject.nome}
              clientName={selectedProject.clientName}
              leadId={selectedProject.leadId}
              arquivosContato={selectedProject.leadData?.arquivosContato ?? undefined}
            />
          </div>
        )}

        {/* Fase 2 — Cotação: modo inline */}
        {faseSelecionada === 'cotacao' && !loading && !selectedProjectId && (
          <FaseProjectList
            fase={faseAtual}
            projects={projetosDaFase}
            search={search}
            onSearch={setSearch}
            onSelectInline={setSelectedProjectId}
            canManage={canManageProjects}
            onArchiveProject={handleArchiveProject}
            onDeleteProject={setConfirmDelete}
          />
        )}
        {faseSelecionada === 'cotacao' && !loading && selectedProjectId && selectedProject && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <ProjectCotacao
              projectId={selectedProject.id}
              leadId={selectedProject.leadId}
              categoriasCotacao={selectedProject.categoriasCotacao}
              escopoTexto={selectedProject.prancheta?.solicitacaoCotacao}
              projectName={selectedProject.nome}
              clientName={selectedProject.clientName}
            />
          </div>
        )}

        {/* Fase 3 — Proposta: modo inline */}
        {faseSelecionada === 'proposta' && !loading && !selectedProjectId && (
          <FaseProjectList
            fase={faseAtual}
            projects={projetosDaFase}
            search={search}
            onSearch={setSearch}
            onSelectInline={setSelectedProjectId}
            canManage={canManageProjects}
            onArchiveProject={handleArchiveProject}
            onDeleteProject={setConfirmDelete}
          />
        )}
        {faseSelecionada === 'proposta' && !loading && selectedProjectId && selectedProject && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <ProjectProposta project={selectedProject} />
          </div>
        )}

        {/* Fase 4 — Contrato: modo inline */}
        {faseSelecionada === 'contrato' && !loading && !selectedProjectId && (
          <FaseProjectList
            fase={faseAtual}
            projects={projetosDaFase}
            search={search}
            onSearch={setSearch}
            onSelectInline={setSelectedProjectId}
            canManage={canManageProjects}
            onArchiveProject={handleArchiveProject}
            onDeleteProject={setConfirmDelete}
          />
        )}
        {faseSelecionada === 'contrato' && !loading && selectedProjectId && selectedProject && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <ProjectContrato project={selectedProject} />
          </div>
        )}

        {/* Fases O.S. e Execução — lista unificada (avulsas + projeto) com edição inline */}
        {(faseSelecionada === 'os' || faseSelecionada === 'execucao') && !loading && (
          <>
            <FaseOSList
              fase={faseAtual}
              projects={projetosDaFase}
              osTasks={allOSTasks}
              osLoading={osTasksLoading}
              search={search}
              onSearch={setSearch}
              onEditOS={setEditingOSTask}
              onPrintOS={(task) => window.open(`/#/app/os/${task.id}/print`, '_blank')}
              onOpenProject={(projectId) => navigate(`/app/projetos-v2/${projectId}?tab=os&from=flow`)}
              canManage={canManageProjects}
              onArchiveProject={handleArchiveProject}
              onDeleteProject={setConfirmDelete}
            />
            {editingOSTask && (
              <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
                <OSEditModal
                  task={editingOSTask}
                  onClose={() => setEditingOSTask(null)}
                  onSaved={(updated) => {
                    setAllOSTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                    setEditingOSTask(null);
                  }}
                />
              </Suspense>
            )}
          </>
        )}

        {/* Fase 7 — Relatório: hub único com O.S. individuais (avulsa/projeto/contrato) + projetos com relatório final consolidado */}
        {faseSelecionada === 'relatorio' && !loading && (
          <div className="space-y-6">
            {canEditRaci && <OSDiagnosticoWorkflow />}
            <FaseRelatorioOSList
              tasks={osRelatorioTasks}
              loading={osRelatorioLoading}
              onOpen={setRelatorioOSTask}
            />
            <div>
              <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wide flex items-center gap-1.5 mb-3">
                <FolderOpen className="w-3.5 h-3.5" /> Projetos com Relatório Final
              </p>
              <FaseProjectList
                fase={faseAtual}
                projects={projetosDaFase}
                search={search}
                onSearch={setSearch}
                canManage={canManageProjects}
                onArchiveProject={handleArchiveProject}
                onDeleteProject={setConfirmDelete}
              />
            </div>
          </div>
        )}

        {/* Fases restantes (faturamento, concluídos) */}
        {!INLINE_FASES.includes(faseSelecionada) && faseSelecionada !== 'os' && faseSelecionada !== 'execucao' && faseSelecionada !== 'relatorio' && faseAtual.fases && !loading && (
          <FaseProjectList
            fase={faseAtual}
            projects={projetosDaFase}
            search={search}
            onSearch={setSearch}
            canManage={canManageProjects}
            onArchiveProject={handleArchiveProject}
            onDeleteProject={setConfirmDelete}
          />
        )}

        {relatorioOSTask && (
          <Suspense fallback={<div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-white" /></div>}>
            <OSRelatorioConclusao
              task={relatorioOSTask}
              onClose={() => setRelatorioOSTask(null)}
              onSave={updated => setRelatorioOSTask(updated)}
            />
          </Suspense>
        )}

      </div>

      {/* ── Modal de confirmação de exclusão ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-gray-900">Excluir projeto</h3>
                <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              Tem certeza que deseja excluir permanentemente o projeto{' '}
              <strong className="text-gray-900">"{confirmDelete.nome}"</strong>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteProject(confirmDelete)}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast de feedback ── */}
      {actionFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl whitespace-nowrap">
          {actionFeedback}
        </div>
      )}
    </div>
  );
};

export default FlowAtendimento;

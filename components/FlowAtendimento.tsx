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
  CalendarDays, Wrench, HardHat, FileText, CreditCard,
  Archive, XCircle, ChevronRight, Search, Plus, ArrowLeft,
  Loader2, Building2, Calendar, DollarSign,
  ArrowRight, Briefcase, AlertCircle, LayoutGrid,
  Settings, Check, Users,
} from 'lucide-react';
import {
  doc, getDoc, setDoc, collection, getDocs, onSnapshot, Timestamp,
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
import {
  ProjectV2, ProjectPhase, Sector,
  PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS,
  PROJECT_TYPES, CollectionName,
  RaciFlowEntry, RaciFlowConfig,
} from '../types';
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
  { id: 'contrato',     numero: 4,  label: 'Contrato',      descricao: 'Assinatura e gate de execução',         icon: FileSignature,cor: 'bg-amber-600 text-white',  corBg: 'bg-amber-50 text-amber-700',     fases: ['contrato_enviado', 'contrato_assinado'], tabHint: 'contrato' },
  { id: 'gantt',        numero: 5,  label: 'Gantt',         descricao: 'Planejamento executivo',                icon: CalendarDays, cor: 'bg-sky-600 text-white',    corBg: 'bg-sky-50 text-sky-700',         fases: ['em_planejamento', 'cronograma_aprovado'], tabHint: 'gantt' },
  { id: 'os',           numero: 6,  label: 'O.S.',          descricao: 'Distribuição de ordens de serviço',     icon: Wrench,       cor: 'bg-orange-600 text-white', corBg: 'bg-orange-50 text-orange-700',   fases: ['os_distribuidas'],                 tabHint: 'os' },
  { id: 'execucao',     numero: 7,  label: 'Execução',      descricao: 'Equipe em campo',                       icon: HardHat,      cor: 'bg-yellow-600 text-white', corBg: 'bg-yellow-50 text-yellow-700',   fases: ['em_execucao'],                     tabHint: 'os' },
  { id: 'relatorio',    numero: 8,  label: 'Relatório',     descricao: 'Relatório final ao cliente',            icon: FileText,     cor: 'bg-pink-600 text-white',   corBg: 'bg-pink-50 text-pink-700',       fases: ['relatorio_enviado'],               tabHint: 'relatorio' },
  { id: 'faturamento',  numero: 9,  label: 'Faturamento',   descricao: 'Cobrança e recebimento',                icon: CreditCard,   cor: 'bg-rose-600 text-white',   corBg: 'bg-rose-50 text-rose-700',       fases: ['em_faturamento', 'aguardando_recebimento'], tabHint: 'faturamento' },
  { id: 'historico',    numero: 10, label: 'Concluídos',    descricao: 'Projetos finalizados',                  icon: Archive,      cor: 'bg-emerald-600 text-white',corBg: 'bg-emerald-50 text-emerald-700', fases: ['concluido'],                       tabHint: 'historico' },
  { id: 'nao_aprovados',numero: 11, label: 'Não Aprovados', descricao: 'Upsell e reabordagem',                  icon: XCircle,      cor: 'bg-gray-600 text-white',   corBg: 'bg-gray-100 text-gray-600',      fases: null },
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

const ProjectMiniCard: React.FC<{ project: ProjectV2; fase: FlowFase; onOpen: () => void }> = ({ project, fase, onOpen }) => {
  const osProgress = project.totalOSConcluidas != null && project.totalOSPrevistas
    ? Math.round((project.totalOSConcluidas / project.totalOSPrevistas) * 100) : null;
  const phaseColor = PROJECT_PHASE_COLORS[project.fase] || 'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <button onClick={onOpen} className="w-full text-left bg-white rounded-2xl border border-gray-200 p-4 hover:border-brand-300 hover:shadow-md transition-all group">
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
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-1.5 rounded-full transition-all ${osProgress >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`} style={{ width: `${osProgress}%` }} />
              </div>
              <span className="text-[9px] font-bold text-gray-500 flex-shrink-0">{project.totalOSConcluidas}/{project.totalOSPrevistas} O.S.</span>
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-brand-500 flex-shrink-0 transition-colors mt-1" />
      </div>
    </button>
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
  onSelectInline?: (projectId: string) => void; // inline mode: só para fase prancheta
}> = ({ fase, projects, search, onSearch, onSelectInline }) => {
  const navigate = useNavigate();
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => p.nome.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q));
  }, [projects, search]);

  const handleOpen = (project: ProjectV2) => {
    if (onSelectInline) {
      onSelectInline(project.id); // abre inline (fase prancheta)
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
            <ProjectMiniCard key={project.id} project={project} fase={fase} onOpen={() => handleOpen(project)} />
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
    return counts;
  }, [projects]);

  const projetosDaFase = useMemo(() => {
    if (!projects) return [];
    const fase = FLOW_FASES.find(f => f.id === faseSelecionada);
    if (!fase?.fases) return [];
    let lista = projects.filter(p => fase.fases!.includes(p.fase));

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
          />
        )}
        {faseSelecionada === 'contrato' && !loading && selectedProjectId && selectedProject && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <ProjectContrato
              projectId={selectedProject.id}
              projectNome={selectedProject.nome}
              clientName={selectedProject.clientName}
              valorTotal={selectedProject.valorContrato}
            />
          </div>
        )}

        {/* Fases 5-10 (execução — continuam abrindo no ProjectDetail via navigate) */}
        {!INLINE_FASES.includes(faseSelecionada) && faseAtual.fases && !loading && (
          <FaseProjectList fase={faseAtual} projects={projetosDaFase} search={search} onSearch={setSearch} />
        )}

      </div>
    </div>
  );
};

export default FlowAtendimento;

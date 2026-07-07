/**
 * components/ProjectDetail.tsx — Sprint Projetos v2
 *
 * Detalhe do projeto com stepper horizontal de fases,
 * tabs de conteúdo por fase, ações de avanço e arquivamento.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, ChevronRight, ChevronDown, ArrowRight, Loader2, AlertCircle,
  XCircle, RotateCcw, Clock, Save, Briefcase, Plus, ExternalLink, Link2, Search,
  FolderOpen, Upload, FileText, Image, Trash2, ClipboardList, BarChart3,
  CheckCircle2,
} from 'lucide-react';
import {
  getDocs, collection, query, orderBy as fbOrderBy, onSnapshot,
  addDoc, deleteDoc, doc as fbDoc, serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Client, CollectionName, ProjectDocument } from '../types';

let storage: any = null;
try {
  const storageModule = require('../firebase');
  storage = storageModule.storage;
} catch { /* storage not configured */ }
import { useProject } from '../hooks/useProject';
import { useProjectOS } from '../hooks/useProjectOS';
import ProjectTaskBacklog from './ProjectTaskBacklog';
import ProjectConversas from './ProjectConversas';
import ProjectPrancheta from './ProjectPrancheta';
import ProjectCotacao from './ProjectCotacao';
import ProjectContrato from './ProjectContrato';
import ProjectFaturamento from './ProjectFaturamento';
import ProjectRelatorio from './ProjectRelatorio';
import ProjectGantt from './ProjectGantt';
import ProjectProposta from './ProjectProposta';
import ProjectActivity from './ProjectActivity';
import ProjectOSDistribuicao from './ProjectOSDistribuicao';
import ProjectAdendoMudancas from './ProjectAdendoMudancas';
import {
  ProjectPhase, PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS,
  PROJECT_PHASE_ORDER, NAO_APROVADO_MOTIVOS,
  PROJECT_TYPES,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AdendoMudanca } from './ProjectAdendoMudancas';

// ── Autocomplete de Cliente — Sprint 16 ──
const ClientAutocomplete: React.FC<{
  value: string;
  onSelect: (id: string, name: string) => void;
}> = ({ value, onSelect }) => {
  const [query2, setQuery2] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [showList, setShowList] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Carregar clientes na abertura
  const loadClients = async () => {
    if (loaded) return;
    try {
      const snap = await getDocs(
        query(collection(db, 'clients'), fbOrderBy('name', 'asc'))
      );
      setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client)));
      setLoaded(true);
    } catch { /* sem clientes */ }
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(query2.toLowerCase()) ||
    (c.contactName || '').toLowerCase().includes(query2.toLowerCase())
  ).slice(0, 8);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          value={value || query2}
          onChange={e => { setQuery2(e.target.value); if (!showList) setShowList(true); onSelect('', e.target.value); }}
          onFocus={() => { loadClients(); setShowList(true); }}
          onBlur={() => setTimeout(() => setShowList(false), 150)}
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm"
          placeholder="Buscar cliente cadastrado..."
        />
      </div>
      {showList && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {filtered.map(c => (
            <button key={c.id} type="button"
              onMouseDown={() => { onSelect(c.id, c.name); setQuery2(''); setShowList(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-brand-50 transition-colors">
              <p className="text-sm font-bold text-gray-900">{c.name}</p>
              {c.segment && <p className="text-[10px] text-gray-400">{c.segment}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Stepper Horizontal ──
const PhaseStepper: React.FC<{ currentPhase: ProjectPhase }> = ({ currentPhase }) => {
  const currentIdx = PROJECT_PHASE_ORDER.indexOf(currentPhase);
  const isNaoAprovado = currentPhase === 'nao_aprovado';

  return (
    <div className="overflow-x-auto pb-1">
      <div className="flex items-center gap-0 min-w-max">
        {PROJECT_PHASE_ORDER.map((phase, i) => {
          const done = !isNaoAprovado && i < currentIdx;
          const active = !isNaoAprovado && i === currentIdx;
          return (
            <React.Fragment key={phase}>
              <div className="flex flex-col items-center" style={{ minWidth: 60 }}>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                    active
                      ? 'border-brand-600 bg-brand-600'
                      : done
                      ? 'border-emerald-500 bg-emerald-500'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  {done && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <span
                  className={`text-[8px] mt-1 text-center leading-tight font-medium ${
                    active ? 'text-brand-700 font-bold' : done ? 'text-emerald-600' : 'text-gray-400'
                  }`}
                  style={{ maxWidth: 56 }}
                >
                  {PROJECT_PHASE_LABELS[phase]}
                </span>
              </div>
              {i < PROJECT_PHASE_ORDER.length - 1 && (
                <div className={`h-0.5 w-4 flex-shrink-0 ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
        {isNaoAprovado && (
          <>
            <div className="h-0.5 w-4 flex-shrink-0 bg-gray-200" />
            <div className="flex flex-col items-center" style={{ minWidth: 60 }}>
              <div className="w-5 h-5 rounded-full border-2 border-red-400 bg-red-400 flex items-center justify-center">
                <XCircle className="w-3 h-3 text-white" />
              </div>
              <span className="text-[8px] mt-1 text-center text-red-600 font-bold">Não Aprovado</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Timeline de histórico ──
const PhaseHistory: React.FC<{ history: any[] }> = ({ history }) => {
  if (!history || history.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
        <Clock className="w-3.5 h-3.5" /> Histórico de Fases
      </p>
      <div className="space-y-1.5">
        {[...history].reverse().map((entry, i) => {
          let ts = '—';
          try {
            const d = entry.alteradoEm?.toDate ? entry.alteradoEm.toDate() : new Date(entry.alteradoEm?.seconds * 1000);
            ts = format(d, "dd/MM/yy HH:mm", { locale: ptBR });
          } catch {}
          return (
            <div key={i} className="flex items-start gap-2 text-xs">
              <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
              <div>
                <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${PROJECT_PHASE_COLORS[entry.fase as ProjectPhase] || 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                  {PROJECT_PHASE_LABELS[entry.fase as ProjectPhase] || entry.fase}
                </span>
                <span className="text-gray-400 ml-2">{ts}</span>
                {entry.alteradoPorNome && <span className="text-gray-400 ml-1">por {entry.alteradoPorNome}</span>}
                {entry.observacao && <p className="text-gray-500 mt-0.5">{entry.observacao}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Wrapper: carrega adendos da sub-coleção e passa para o componente ──────────
const ProjectAdendoMudancasWrapper: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [adendos, setAdendos] = useState<AdendoMudanca[]>([]);

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, 'projects_v2', projectId, 'adendos'),
      fbOrderBy('criadoEm', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setAdendos(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdendoMudanca)));
    }, () => {});
    return () => unsub();
  }, [projectId]);

  return <ProjectAdendoMudancas projectId={projectId} adendos={adendos} />;
};

// ── Tabs avançadas (por fase) — Lead/Prancheta/Atividades/Histórico são seções de scroll ──
type TabKey = 'cotacao' | 'proposta' | 'contrato' | 'gantt' | 'os' | 'relatorio' | 'faturamento';

const ALL_LATER_PHASES: ProjectPhase[] = ['em_planejamento', 'cronograma_aprovado', 'os_distribuidas', 'em_execucao', 'relatorio_enviado', 'em_faturamento', 'aguardando_recebimento', 'concluido'];
const ALL_PHASES: ProjectPhase[] = ['lead_capturado', 'em_levantamento', 'em_cotacao', 'cotacao_recebida', 'proposta_enviada', 'contrato_enviado', 'contrato_assinado', ...ALL_LATER_PHASES, 'nao_aprovado'];

const ADVANCED_TABS: { key: TabKey; label: string; phases: ProjectPhase[] }[] = [
  { key: 'cotacao',     label: '💰 Cotação',   phases: ['em_cotacao', 'cotacao_recebida', 'proposta_enviada', 'contrato_enviado', 'contrato_assinado', ...ALL_LATER_PHASES] },
  { key: 'proposta',   label: '🎨 Proposta',   phases: ['proposta_enviada', 'contrato_enviado', 'contrato_assinado', ...ALL_LATER_PHASES] },
  { key: 'contrato',   label: '📝 Contrato',   phases: ['contrato_enviado', 'contrato_assinado', ...ALL_LATER_PHASES] },
  { key: 'gantt',      label: '📅 Gantt',      phases: ['contrato_assinado', ...ALL_LATER_PHASES] },
  { key: 'os',         label: '🔧 O.S.',        phases: ALL_LATER_PHASES },
  { key: 'faturamento',label: '💳 Faturamento', phases: ['em_faturamento', 'aguardando_recebimento', 'concluido'] },
  { key: 'relatorio',  label: '📋 Relatório',  phases: ['relatorio_enviado', 'em_faturamento', 'aguardando_recebimento', 'concluido'] },
];

const ProjectDetail: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const { projects, loading, archiveAsNaoAprovado, reopenProject } = useProject();
  const [searchParams] = useSearchParams();
  const fromFlow = searchParams.get('from') === 'flow';
  const backPath = fromFlow ? '/app/flow-atendimento' : '/app/projetos-v2';
  const { ordens, stats: osStats, vincularOS, desvincularOS } = useProjectOS(projectId ?? '');
  // Mapa id -> numeroOS, usado para exibir a origem dos documentos vindos de uma O.S.
  const ordensPorId = useMemo(() => new Map(ordens.map(t => [t.id, t.numeroOS ?? t.title])), [ordens]);
  const [activeTab, setActiveTab] = useState<TabKey>('cotacao');
  // Modal não aprovado
  const [showNaoAprovado, setShowNaoAprovado] = useState(false);
  const [naoMotivo, setNaoMotivo] = useState('');
  const [naoDetalhes, setNaoDetalhes] = useState('');
  // Modal reabrir
  const [showReabrir, setShowReabrir] = useState(false);
  const [reabrirAbordagem, setReabrirAbordagem] = useState('');
  // Sticky header — deve estar ANTES de qualquer return condicional
  const [showSticky, setShowSticky] = useState(false);
  // Documentos do projeto
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [soDocsDeOS, setSoDocsDeOS] = useState(false);
  // Checklist de fases expandida
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 120);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Carregar documentos do projeto
  useEffect(() => {
    if (!projectId || projectId === 'novo') return;
    const unsub = onSnapshot(
      collection(db, CollectionName.PROJECT_DOCS),
      snap => {
        setDocuments(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as ProjectDocument))
            .filter(d => d.projectId === projectId)
        );
      }
    );
    return () => unsub();
  }, [projectId]);

  const handleUploadDoc = async (file: File) => {
    if (!currentUser || !projectId || !storage) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const tipo = ext === 'pdf' ? 'pdf' : ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'imagem' : 'outro';
      const storageRef = ref(storage, `projects/${projectId}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await addDoc(collection(db, CollectionName.PROJECT_DOCS), {
        projectId,
        nome: file.name,
        tipo,
        url,
        tamanhoBytes: file.size,
        uploadPor: currentUser.uid,
        uploadPorNome: userProfile?.displayName || '',
        uploadEm: serverTimestamp(),
      });
    } catch (e) {
      console.error('Erro upload doc:', e);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Excluir este documento?')) return;
    await deleteDoc(fbDoc(db, CollectionName.PROJECT_DOCS, docId));
  };

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);

  // Determinar tabs avançadas visíveis para a fase atual
  const visibleAdvancedTabs = useMemo(() => {
    if (!project) return [];
    return ADVANCED_TABS.filter((t) => t.phases.includes(project.fase));
  }, [project]);

  // Auto-selecionar tab avançada baseada na fase
  useEffect(() => {
    if (!project) return;
    if (['em_cotacao', 'cotacao_recebida'].includes(project.fase)) setActiveTab('cotacao');
    else if (project.fase === 'proposta_enviada') setActiveTab('proposta');
    else if (['contrato_enviado', 'contrato_assinado'].includes(project.fase)) setActiveTab('contrato');
    else if (['em_planejamento', 'cronograma_aprovado'].includes(project.fase)) setActiveTab('gantt');
    else if (['os_distribuidas', 'em_execucao'].includes(project.fase)) setActiveTab('os');
    else if (project.fase === 'relatorio_enviado') setActiveTab('relatorio');
    else if (['em_faturamento', 'aguardando_recebimento', 'concluido'].includes(project.fase)) setActiveTab('faturamento');
    // Para fases base (lead_capturado, em_levantamento, nao_aprovado), não há tab avançada para selecionar
  }, [project?.fase]);


  // ── Arquivar como não aprovado ──
  const handleNaoAprovado = async () => {
    if (!project || !naoMotivo) return;
    const motivo = NAO_APROVADO_MOTIVOS.find((m) => m.id === naoMotivo);
    await archiveAsNaoAprovado(project.id, naoMotivo, motivo?.label || naoMotivo, naoDetalhes);
    setShowNaoAprovado(false);
    setNaoMotivo('');
    setNaoDetalhes('');
  };

  // ── Reabrir ──
  const handleReabrir = async () => {
    if (!project || !reabrirAbordagem.trim()) return;
    await reopenProject(project.id, reabrirAbordagem);
    setShowReabrir(false);
    setReabrirAbordagem('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  // Rota /novo — formulário de criação
  if (projectId === 'novo') {
    return <ProjectCreateForm />;
  }

  if (!project) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">Projeto não encontrado</p>
        <button onClick={() => navigate(backPath)} className="mt-3 text-brand-600 text-sm font-bold hover:underline">
          ← Voltar para Projetos
        </button>
      </div>
    );
  }

  const canArchive = ['lead_capturado', 'em_levantamento', 'em_cotacao', 'cotacao_recebida', 'proposta_enviada', 'contrato_enviado'].includes(project.fase);
  const canReopen = project.fase === 'nao_aprovado';

  return (
    <div className="max-w-6xl mx-auto pb-8 space-y-5">

      {/* ── Sticky mini-header — Sprint 11 ── */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showSticky ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
      }`}>
        <div className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <button onClick={() => navigate(backPath)}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors flex-shrink-0">
              <ArrowLeft className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <p className="font-bold text-gray-900 text-sm truncate flex-1">{project.nome}</p>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${PROJECT_PHASE_COLORS[project.fase]}`}>
              {PROJECT_PHASE_LABELS[project.fase]}
            </span>
            {project.clientName && (
              <span className="text-xs text-gray-500 hidden md:block truncate max-w-[150px]">{project.clientName}</span>
            )}
            {/* Avanço de fase removido — controlado exclusivamente pelo Flow de Atendimento */}
          </div>
        </div>
      </div>
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate(backPath)} className="mt-1 p-2 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-extrabold text-gray-900 truncate">{project.nome}</h1>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${PROJECT_PHASE_COLORS[project.fase]}`}>
              {PROJECT_PHASE_LABELS[project.fase]}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            {project.clientName} · {PROJECT_TYPES.find((t) => t.slug === project.tipoProjetoSlug)?.label || project.tipoProjetoSlug}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canArchive && (
            <button
              onClick={() => setShowNaoAprovado(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-red-200 text-red-600 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Não Aprovado
            </button>
          )}
          {canReopen && (
            <button
              onClick={() => setShowReabrir(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reabrir Projeto
            </button>
          )}
          {/* Avanço de fase removido — controlado exclusivamente pelo Flow de Atendimento */}
        </div>
      </div>


      {/* 🎉 Banner de Conclusão — Sprint 8 */}
      {project.fase === 'concluido' && (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6">
          {/* Emoji decorativos */}
          <div className="absolute top-3 right-4 text-4xl opacity-20 select-none pointer-events-none">🎉</div>
          <div className="absolute bottom-2 right-16 text-2xl opacity-15 select-none pointer-events-none">✅</div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-3xl flex-shrink-0">
              🏆
            </div>
            <div className="flex-1">
              <p className="text-base font-extrabold text-emerald-800">Projeto Concluído com Sucesso!</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                <strong>{project.clientName}</strong>
                {project.valorContrato ? ` · R$ ${project.valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                {project.osIds?.length ? ` · ${project.osIds.length} O.S.` : ''}
              </p>
              <p className="text-xs text-emerald-600 mt-1">
                Ciclo de vida completo: Lead → Levantamento → Cotação → Proposta → Contrato → Execução → Entrega ✓
              </p>
            </div>
            <button
              onClick={() => setActiveTab('relatorio')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors flex-shrink-0"
            >
              📋 Ver Relatório Final
            </button>
          </div>
        </div>
      )}

      {/* Stepper */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <PhaseStepper currentPhase={project.fase} />
      </div>

      {/* ── Dica contextual nas fases iniciais ── */}
      {['lead_capturado', 'em_levantamento'].includes(project?.fase ?? '') && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-blue-500" />
          <span>
            Preencha a <strong>Prancheta Técnica</strong> abaixo. Para avançar de fase, use o{' '}
            <strong>Flow de Atendimento</strong>.
          </span>
        </div>
      )}

      {/* ── Progresso Geral ── */}
      {osStats.total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <BarChart3 size={13} /> Progresso Geral
            </span>
            <span className="text-sm font-extrabold text-gray-900">
              {osStats.total > 0 ? Math.round((osStats.concluidas / osStats.total) * 100) : 0}%
            </span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${osStats.concluidas >= osStats.total ? 'bg-green-500' : 'bg-brand-500'}`}
              style={{ width: `${osStats.total > 0 ? Math.round((osStats.concluidas / osStats.total) * 100) : 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{osStats.concluidas} de {osStats.total} O.S. concluídas</span>
            <span>{osStats.emAndamento} em andamento · {osStats.pendentes} pendentes</span>
          </div>
        </div>
      )}

      {/* ── Descrição ── */}
      {project.descricao && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Descrição</h3>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.descricao}</p>
        </div>
      )}

      {/* ── Documentos do Projeto ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <FolderOpen size={13} /> Documentos ({documents.length})
          </h3>
          <div className="flex items-center gap-2">
            {documents.some(d => d.origemOsId) && (
              <button
                onClick={() => setSoDocsDeOS(v => !v)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-colors ${
                  soDocsDeOS ? 'bg-brand-50 border-brand-300 text-brand-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                }`}
              >
                Só de O.S.
              </button>
            )}
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-200">
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              Upload
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadDoc(f); e.target.value = ''; }} className="hidden" />
            </label>
          </div>
        </div>
        {documents.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Nenhum documento anexado.</p>
        ) : (
          <div className="space-y-2">
            {(soDocsDeOS ? documents.filter(d => d.origemOsId) : documents).map(d => {
              const osOrigem = d.origemOsId ? ordensPorId.get(d.origemOsId) : undefined;
              return (
                <div key={d.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2">
                  {d.tipo === 'pdf' ? <FileText size={16} className="text-red-500" /> : <Image size={16} className="text-blue-500" />}
                  <a href={d.url} target="_blank" rel="noreferrer" className="flex-1 text-sm font-medium text-gray-700 truncate hover:text-brand-600">{d.nome}</a>
                  {d.origemOsId && (
                    <span className="text-[9px] font-bold text-brand-600 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5 flex-shrink-0">
                      via {osOrigem ?? 'O.S.'}
                    </span>
                  )}
                  <span className="text-[9px] text-gray-400">{d.uploadEm ? format((d.uploadEm as any).toDate(), 'dd/MM/yy') : ''}</span>
                  <button onClick={() => handleDeleteDoc(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── O.S. Vinculadas (resumo) ── */}
      {ordens.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <ClipboardList size={13} /> O.S. Vinculadas ({ordens.length})
          </h3>
          <div className="space-y-1.5 max-h-72 overflow-y-auto">
            {ordens.map(t => {
              const taskProgress = t.tarefasOS && t.tarefasOS.length > 0
                ? Math.round(t.tarefasOS.filter((x: any) => x.status === 'concluida').length / t.tarefasOS.length * 100) : 0;
              return (
                <div key={t.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${t.status === 'completed' ? 'bg-green-500' : t.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{t.title}</p>
                    <p className="text-[10px] text-gray-400">
                      {t.clientName || ''}
                      {t.endDate && ` · ${format((t.endDate as any).toDate(), 'dd/MM/yyyy', { locale: ptBR })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${taskProgress >= 100 ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${taskProgress}%` }} />
                    </div>
                    <span className="text-[9px] font-bold text-gray-400">{taskProgress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Hub de Tarefas do Projeto ── */}
      <ProjectTaskBacklog
        projectId={projectId ?? ''}
        projectName={project.nome}
        clientId={(project as any).clientId}
        clientName={project.clientName}
      />

      {/* ── Conversas do Projeto (dúvidas + suporte) ── */}
      <ProjectConversas projectId={projectId ?? ''} />

      {/* ── Checklist de Fases do Flow ── */}
      {project.faseHistorico && project.faseHistorico.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <CheckCircle2 className="w-4 h-4 text-brand-600" />
            <h3 className="font-bold text-gray-800 text-sm">Fases do Projeto</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {PROJECT_PHASE_ORDER.map(phase => {
              const currentIdx = PROJECT_PHASE_ORDER.indexOf(project.fase);
              const phaseIdx = PROJECT_PHASE_ORDER.indexOf(phase);
              const isDone = phaseIdx < currentIdx;
              const isCurrent = phaseIdx === currentIdx;
              const historyEntries = (project.faseHistorico || []).filter((h: any) => h.fase === phase);
              const hasHistory = historyEntries.length > 0;
              const isExpanded = expandedPhase === phase;

              return (
                <div key={phase}>
                  <button
                    onClick={() => hasHistory ? setExpandedPhase(isExpanded ? null : phase) : undefined}
                    className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${hasHistory ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'border-emerald-500 bg-emerald-500' : isCurrent ? 'border-brand-600 bg-brand-600' : 'border-gray-200 bg-white'
                    }`}>
                      {isDone && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <span className={`text-sm flex-1 ${isDone ? 'text-emerald-700 font-medium' : isCurrent ? 'text-brand-700 font-bold' : 'text-gray-400'}`}>
                      {PROJECT_PHASE_LABELS[phase]}
                    </span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-700">Atual</span>
                    )}
                    {hasHistory && (
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                  {isExpanded && hasHistory && (
                    <div className="px-5 pb-3 pl-14 space-y-1.5">
                      {historyEntries.map((entry: any, i: number) => {
                        let ts = '';
                        try {
                          const d = entry.alteradoEm?.toDate ? entry.alteradoEm.toDate() : new Date(entry.alteradoEm?.seconds * 1000);
                          ts = format(d, "dd/MM/yy HH:mm", { locale: ptBR });
                        } catch {}
                        return (
                          <div key={i} className="text-xs text-gray-500">
                            <span className="text-gray-400">{ts}</span>
                            {entry.alteradoPorNome && <span className="ml-1">por {entry.alteradoPorNome}</span>}
                            {entry.observacao && <p className="text-gray-600 mt-0.5">{entry.observacao}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
           SEÇÕES BASE — Single Page Scroll
           Lead + Prancheta + Atividades + Histórico sempre visíveis
      ═══════════════════════════════════════════════════ */}

      {/* SEÇÃO: Lead */}
      {project.leadData && (
        <div id="section-lead" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <span className="text-base">🌐</span>
            <h3 className="font-bold text-gray-800 text-sm">Dados do Lead</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Contato',        value: project.leadData.nomeContato },
                { label: 'Empresa',        value: project.leadData.empresa },
                { label: 'Telefone',       value: project.leadData.telefone },
                { label: 'E-mail',         value: project.leadData.email },
                { label: 'Tipo de Projeto',value: project.leadData.tipoProjetoPedido },
                { label: 'Medidas Aprox.', value: project.leadData.medidasAproximadas },
                { label: 'Finalidade',     value: project.leadData.finalidade },
                { label: 'Localização',    value: project.leadData.localizacao },
              ].map((field) => (
                <div key={field.label} className="bg-gray-50 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{field.label}</p>
                  <p className="text-sm text-gray-900 font-medium mt-0.5">{field.value || '—'}</p>
                </div>
              ))}
            </div>
            {project.leadData.observacoes && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Observações</p>
                <p className="text-sm text-gray-900 mt-0.5">{project.leadData.observacoes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SEÇÃO: Prancheta */}
      <div id="section-prancheta" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <span className="text-base">📐</span>
          <h3 className="font-bold text-gray-800 text-sm">Prancheta Técnica</h3>
        </div>
        <div className="p-5">
          <ProjectPrancheta
            projectId={project.id}
            prancheta={project.prancheta}
            projectName={project.nome}
            clientName={project.clientName}
            leadId={project.leadId}
            arquivosContato={project.leadData?.arquivosContato ?? undefined}
          />
        </div>
      </div>

      {/* SEÇÃO: Atividades */}
      <div id="section-atividades" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <span className="text-base">💬</span>
          <h3 className="font-bold text-gray-800 text-sm">Atividades e Comentários</h3>
        </div>
        <div className="p-5">
          <ProjectActivity projectId={projectId ?? ''} />
        </div>
      </div>

      {/* SEÇÃO: Histórico de Fases */}
      <div id="section-historico" className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
          <span className="text-base">⏳</span>
          <h3 className="font-bold text-gray-800 text-sm">Histórico de Fases</h3>
        </div>
        <div className="p-5 space-y-4">
          {project.naoAprovadoData && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
              <p className="font-bold text-red-700 text-sm">⚠️ Projeto Não Aprovado</p>
              <p className="text-xs text-red-600">
                <strong>Motivo:</strong> {project.naoAprovadoData.motivoTexto}
                {project.naoAprovadoData.detalhes && ` — ${project.naoAprovadoData.detalhes}`}
              </p>
              <p className="text-[10px] text-red-500">
                Parou na fase: {PROJECT_PHASE_LABELS[project.naoAprovadoData.faseParou]}
              </p>
              {project.naoAprovadoData.tentativasReabertura && project.naoAprovadoData.tentativasReabertura.length > 0 && (
                <div className="mt-2 pt-2 border-t border-red-200">
                  <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">Tentativas de Reabertura</p>
                  {project.naoAprovadoData.tentativasReabertura.map((t, i) => (
                    <div key={i} className="text-xs text-red-600 mb-1">
                      <span className="font-medium">{t.porNome}</span>: {t.novaAbordagem}
                      {t.descontoOferecido && ` (desconto: ${t.descontoOferecido})`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <PhaseHistory history={project.faseHistorico} />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
           TABS AVANÇADAS — apenas quando disponíveis para a fase atual
      ═══════════════════════════════════════════════════ */}

      {visibleAdvancedTabs.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Barra de tabs avançadas */}
          <div className="border-b border-gray-100 px-2 flex gap-0 overflow-x-auto scroll-smooth"
            style={{ WebkitOverflowScrolling: 'touch' }}>
            {visibleAdvancedTabs.map((tab) => (
              <button
                key={tab.key}
                id={`tab-${tab.key}`}
                onClick={() => { setActiveTab(tab.key); document.getElementById(`tab-${tab.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }); }}
                className={`px-3 md:px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap flex-shrink-0 ${
                  activeTab === tab.key
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-5">
            {/* Cotação */}
            {activeTab === 'cotacao' && (
              <ProjectCotacao projectId={project.id} leadId={project.leadId} categoriasCotacao={project.categoriasCotacao} escopoTexto={project.prancheta?.scopeNotes} projectName={project.nome} clientName={project.clientName} />
            )}

            {/* Proposta */}
            {activeTab === 'proposta' && (
              <ProjectProposta project={project} />
            )}

            {/* Contrato */}
            {activeTab === 'contrato' && (
              <ProjectContrato project={project} />
            )}

            {/* Faturamento */}
            {activeTab === 'faturamento' && (
              <ProjectFaturamento
                projectId={project.id}
                projectNome={project.nome}
                clientId={project.clientId || ''}
                clientName={project.clientName}
                valorSugerido={project.valorContrato || 0}
              />
            )}

            {/* Relatório */}
            {activeTab === 'relatorio' && (
              <ProjectRelatorio
                projectId={project.id}
                project={project}
                onSave={() => {}}
              />
            )}

            {/* Gantt */}
            {activeTab === 'gantt' && (
              <ProjectGantt projectId={project.id} />
            )}

            {/* O.S. */}
            {activeTab === 'os' && (
              <div className="space-y-6">
                <ProjectOSDistribuicao project={project} />
                <div className="border-t border-gray-200 pt-6">
                  <ProjectAdendoMudancasWrapper projectId={project.id} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Não Aprovado */}
      {showNaoAprovado && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Arquivar como Não Aprovado</h3>
              <p className="text-xs text-gray-500 mt-1">O projeto será movido para a lista de não aprovados.</p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Motivo *</label>
                <select
                  value={naoMotivo}
                  onChange={(e) => setNaoMotivo(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {NAO_APROVADO_MOTIVOS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Detalhes (opcional)</label>
                <textarea
                  value={naoDetalhes}
                  onChange={(e) => setNaoDetalhes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                  placeholder="Informações adicionais..."
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setShowNaoAprovado(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleNaoAprovado} disabled={!naoMotivo} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50">
                Arquivar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reabrir */}
      {showReabrir && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Reabrir Projeto</h3>
              <p className="text-xs text-gray-500 mt-1">O projeto voltará para "Em Levantamento".</p>
            </div>
            <div className="p-5">
              <label className="text-xs font-bold text-gray-600 block mb-1">Nova abordagem *</label>
              <textarea
                value={reabrirAbordagem}
                onChange={(e) => setReabrirAbordagem(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none"
                placeholder="Descreva a nova estratégia de abordagem..."
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setShowReabrir(false)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={handleReabrir} disabled={!reabrirAbordagem.trim()} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" />
                Reabrir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Formulário de criação rápida — Sprint 16: com cliente real ──
const ProjectCreateForm: React.FC = () => {
  const navigate = useNavigate();
  const { createProject } = useProject();
  const [nome, setNome] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');
  const [tipo, setTipo] = useState('camara_fria');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!nome.trim() || !clientName.trim()) return;
    setSaving(true);
    try {
      const id = await createProject({
        nome,
        descricao,
        clientId: clientId || '',
        clientName,
        tipoProjetoSlug: tipo,
        fase: 'em_levantamento',
        osIds: [],
      } as any);
      navigate(`/app/projetos-v2/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto py-10">
      <button onClick={() => navigate('/app/projetos-v2')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </button>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-brand-600" />
          Novo Projeto
        </h2>

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">Nome do Projeto *</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
            placeholder="Ex: Câmara Frigorífica Industrial – Ceasa" />
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">Cliente *</label>
          <ClientAutocomplete
            value={clientName}
            onSelect={(id, name) => { setClientId(id); setClientName(name); }}
          />
          {clientId && (
            <p className="text-[10px] text-emerald-600 font-bold mt-1">✓ Cliente vinculado ao cadastro</p>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">Tipo de Projeto</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm">
            {PROJECT_TYPES.map((t) => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">Descrição (opcional)</label>
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
            placeholder="Breve descrição do projeto..." />
        </div>

        <button onClick={handleCreate} disabled={saving || !nome.trim() || !clientName.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 transition-all shadow-sm">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar Projeto
        </button>
      </div>
    </div>
  );
};

export default ProjectDetail;

/**
 * components/ProjectOSDistribuicao.tsx — Sprint B
 *
 * Painel de distribuição de O.S. vinculadas a um projeto.
 * FLUXO: O sistema SUGERE O.S. baseado nas tarefas do Gantt,
 *        o gestor revisa, edita e CONFIRMA — apenas aí as O.S. são criadas na collection tasks.
 *
 * Funcionalidades:
 * - Visualização das O.S. já vinculadas ao projeto (com status)
 * - Geração de sugestões de O.S. a partir das tarefas do Gantt
 * - Revisão e edição das sugestões antes de confirmar
 * - Confirmação individual ou em lote
 * - Link direto para a O.S. após criação
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus, Check, X, Edit3, AlertTriangle, ClipboardList,
  Calendar, User, Loader2, ChevronDown, ChevronUp,
  ExternalLink, RefreshCw, Send, Building2, Clock,
} from 'lucide-react';
import { Timestamp, addDoc, collection, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { format, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProjectOS } from '../hooks/useProjectOS';
import { useProjectGantt } from '../hooks/useProjectGantt';
import { CollectionName, ProjectV2, Task, PriorityLevel } from '../types';
import { db } from '../firebase';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface SugestaoOS {
  id: string; // ID temporário local
  titulo: string;
  descricao: string;
  responsavelNome: string;
  responsavelId: string;
  dataAgendada: string;  // 'yyyy-MM-dd'
  prioridade: PriorityLevel;
  origemGanttTaskId?: string;
  origemGanttLabel?: string;
  confirmada: boolean;
  osIdCriada?: string;   // preenchido após confirmação
}

const PRIORIDADE_OPTIONS: PriorityLevel[] = ['low', 'medium', 'high', 'critical'];
const PRIORIDADE_CONFIG: Record<PriorityLevel, { label: string; color: string }> = {
  low:      { label: 'Baixa',    color: 'bg-gray-100 text-gray-600 border-gray-200' },
  medium:   { label: 'Média',    color: 'bg-blue-100 text-blue-700 border-blue-200' },
  high:     { label: 'Alta',     color: 'bg-amber-100 text-amber-700 border-amber-200' },
  critical: { label: 'Crítica',  color: 'bg-red-100 text-red-700 border-red-200' },
};

const STATUS_OS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pendente',    color: 'bg-gray-100 text-gray-600 border-gray-200' },
  'in-progress': { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  completed:   { label: 'Concluída',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  blocked:     { label: 'Bloqueada',   color: 'bg-red-100 text-red-700 border-red-200' },
};

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'dd/MM/yy', { locale: ptBR });
  } catch { return '—'; }
};

// ── Formulário de edição de sugestão ─────────────────────────────────────────
const SugestaoForm: React.FC<{
  sugestao: SugestaoOS;
  onChange: (s: SugestaoOS) => void;
  onCancel: () => void;
}> = ({ sugestao, onChange, onCancel }) => {
  const [local, setLocal] = useState(sugestao);

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
      <div>
        <label className="text-[10px] font-bold text-gray-600 block mb-1">Título da O.S.</label>
        <input value={local.titulo} onChange={e => setLocal(s => ({ ...s, titulo: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500" />
      </div>
      <div>
        <label className="text-[10px] font-bold text-gray-600 block mb-1">Descrição</label>
        <textarea value={local.descricao} onChange={e => setLocal(s => ({ ...s, descricao: e.target.value }))}
          rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-gray-600 block mb-1">Data Prevista</label>
          <input type="date" value={local.dataAgendada} onChange={e => setLocal(s => ({ ...s, dataAgendada: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-600 block mb-1">Prioridade</label>
          <select value={local.prioridade || 'medium'} onChange={e => setLocal(s => ({ ...s, prioridade: e.target.value as Task['priority'] }))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none">
            {PRIORIDADE_OPTIONS.map(p => <option key={p} value={p}>{PRIORIDADE_CONFIG[p!].label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50">
          Cancelar
        </button>
        <button onClick={() => onChange(local)} className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-bold hover:bg-brand-700">
          Salvar Edição
        </button>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
interface Props {
  project: ProjectV2;
}

const ProjectOSDistribuicao: React.FC<Props> = ({ project }) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const { ordens, vincularOS, loading: loadingOS } = useProjectOS(project.id);
  const { tasks: ganttTasks } = useProjectGantt(project.id);

  const [sugestoes, setSugestoes] = useState<SugestaoOS[]>([]);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [showSugestoes, setShowSugestoes] = useState(true);
  const [gerando, setGerando] = useState(false);

  // Gerar sugestões a partir das tarefas do Gantt
  const gerarSugestoes = useCallback(() => {
    setGerando(true);
    const hoje = new Date();

    // Pegar tarefas MGR do Gantt que ainda não foram concluídas e têm data prevista
    const tarefasMGR = ganttTasks.filter(t =>
      t.party === 'mgr' &&
      t.status !== 'concluida' &&
      t.status !== 'cancelada' &&
      t.dataInicioPrevista &&
      !ganttTasks.some(other => other.parentId === t.id) // apenas folhas
    );

    if (tarefasMGR.length === 0) {
      // Sugestão genérica se não há Gantt
      const sugestaoDefault: SugestaoOS = {
        id: `sug_${Date.now()}`,
        titulo: `O.S. — ${project.nome}`,
        descricao: `Execução em campo — Projeto: ${project.nome} (${project.clientName})`,
        responsavelNome: userProfile?.displayName || '',
        responsavelId: currentUser?.uid || '',
        dataAgendada: format(addDays(hoje, 3), 'yyyy-MM-dd'),
        prioridade: 'medium',
        confirmada: false,
      };
      setSugestoes([sugestaoDefault]);
      setGerando(false);
      return;
    }

    const novas: SugestaoOS[] = tarefasMGR.map(t => {
      const dataInicio = t.dataInicioPrevista?.toDate
        ? t.dataInicioPrevista.toDate()
        : t.dataInicioPrevista
          ? new Date((t.dataInicioPrevista as any).seconds * 1000)
          : addDays(hoje, 3);

      return {
        id: `sug_${t.id}_${Date.now()}`,
        titulo: `${t.label} — ${project.clientName}`,
        descricao: `${t.descricao || t.label}\n\nProjeto: ${project.nome}\nTarefa WBS: ${t.wbsCode || t.label}`,
        responsavelNome: t.responsaveis?.[0]?.userName || userProfile?.displayName || '',
        responsavelId: t.responsaveis?.[0]?.userId || currentUser?.uid || '',
        dataAgendada: format(dataInicio, 'yyyy-MM-dd'),
        prioridade: t.isCritico ? 'high' : 'medium',
        origemGanttTaskId: t.id,
        origemGanttLabel: t.label,
        confirmada: false,
      };
    });

    setSugestoes(novas);
    setShowSugestoes(true);
    setGerando(false);
  }, [ganttTasks, project, currentUser, userProfile]);

  // Confirmar sugestão → criar O.S. real na Firestore
  const confirmarSugestao = useCallback(async (sug: SugestaoOS) => {
    if (!currentUser) return;
    setConfirmandoId(sug.id);
    try {
      const taskData: Partial<Task> = {
        title: sug.titulo,
        description: sug.descricao,
        clientId: project.clientId,
        clientName: project.clientName,
        assignedTo: sug.responsavelId || undefined,
        assigneeName: sug.responsavelNome || undefined,
        status: 'pending',
        priority: sug.prioridade || 'medium',
        projectId: project.id,
        createdAt: serverTimestamp() as any,
        endDate: sug.dataAgendada
          ? Timestamp.fromDate(new Date(sug.dataAgendada + 'T12:00:00'))
          : undefined,
      };

      const ref = await addDoc(collection(db, CollectionName.TASKS), taskData);

      // Vincular ao projeto
      await vincularOS(ref.id, sug.titulo);

      // Marcar sugestão como confirmada
      setSugestoes(prev => prev.map(s =>
        s.id === sug.id ? { ...s, confirmada: true, osIdCriada: ref.id } : s
      ));
    } catch (err) {
      console.error('Erro ao confirmar O.S.:', err);
    } finally {
      setConfirmandoId(null);
    }
  }, [currentUser, project, vincularOS]);

  const confirmarTodas = async () => {
    const pendentes = sugestoes.filter(s => !s.confirmada);
    for (const s of pendentes) {
      await confirmarSugestao(s);
    }
  };

  const removerSugestao = (id: string) => setSugestoes(prev => prev.filter(s => s.id !== id));

  // Stats das O.S. existentes
  const stats = {
    total: ordens.length,
    concluidas: ordens.filter(o => o.status === 'completed').length,
    emAndamento: ordens.filter(o => o.status === 'in-progress').length,
    pendentes: ordens.filter(o => o.status === 'pending').length,
    bloqueadas: ordens.filter(o => o.status === 'blocked').length,
  };

  const sugestoesPendentes = sugestoes.filter(s => !s.confirmada).length;

  return (
    <div className="space-y-5">
      {/* ── Painel de KPIs de O.S. ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {[
          { label: 'Total',      value: stats.total,        color: 'bg-gray-50 text-gray-700 border-gray-200' },
          { label: 'Pendentes',  value: stats.pendentes,    color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'Andamento',  value: stats.emAndamento,  color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'Concluídas', value: stats.concluidas,   color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          { label: 'Bloqueadas', value: stats.bloqueadas,   color: 'bg-red-50 text-red-700 border-red-200' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border p-2.5 ${k.color}`}>
            <p className="text-[9px] font-bold uppercase tracking-wide opacity-60">{k.label}</p>
            <p className="text-2xl font-extrabold">{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Geração de Sugestões ── */}
      <div className="bg-brand-50 border border-brand-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold text-brand-800 flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4" /> Distribuição de O.S. por Projeto
            </p>
            <p className="text-xs text-brand-600 mt-0.5">
              Sugestões geradas automaticamente a partir do Gantt. Revise e confirme antes de criar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {sugestoesPendentes > 0 && (
              <button onClick={confirmarTodas}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700">
                <Send className="w-3.5 h-3.5" /> Confirmar Todas ({sugestoesPendentes})
              </button>
            )}
            <button onClick={gerarSugestoes} disabled={gerando}
              className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 disabled:opacity-50">
              {gerando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {ganttTasks.length > 0 ? 'Gerar do Gantt' : 'Gerar Sugestão'}
            </button>
          </div>
        </div>

        {/* Lista de sugestões */}
        {sugestoes.length > 0 && (
          <div className="space-y-2">
            {sugestoes.map(sug => (
              <div key={sug.id} className={`bg-white rounded-xl border p-3 transition-all ${sug.confirmada ? 'border-emerald-200 opacity-70' : 'border-brand-200'}`}>
                {editandoId === sug.id ? (
                  <SugestaoForm
                    sugestao={sug}
                    onChange={updated => { setSugestoes(prev => prev.map(s => s.id === sug.id ? updated : s)); setEditandoId(null); }}
                    onCancel={() => setEditandoId(null)}
                  />
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {sug.origemGanttLabel && (
                        <p className="text-[9px] font-bold text-brand-600 uppercase tracking-wide mb-0.5 flex items-center gap-1">
                          <Building2 className="w-2.5 h-2.5" /> Gantt: {sug.origemGanttLabel}
                        </p>
                      )}
                      <p className={`text-xs font-bold ${sug.confirmada ? 'text-emerald-700 line-through' : 'text-gray-900'}`}>
                        {sug.titulo}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {sug.dataAgendada && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(sug.dataAgendada), 'dd/MM/yy', { locale: ptBR })}
                          </span>
                        )}
                        {sug.responsavelNome && (
                          <span className="flex items-center gap-0.5 text-[10px] text-gray-500">
                            <User className="w-3 h-3" />{sug.responsavelNome}
                          </span>
                        )}
                        {sug.prioridade && (
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${PRIORIDADE_CONFIG[sug.prioridade!].color}`}>
                            {PRIORIDADE_CONFIG[sug.prioridade!].label}
                          </span>
                        )}
                        {sug.confirmada && (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border-emerald-200 border flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5" /> Confirmada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {sug.confirmada ? (
                        sug.osIdCriada && (
                          <button onClick={() => navigate(`/app/os/${sug.osIdCriada}`)}
                            title="Abrir O.S." className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )
                      ) : (
                        <>
                          <button onClick={() => setEditandoId(sug.id)} title="Editar"
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => removerSugestao(sug.id)} title="Remover"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => confirmarSugestao(sug)} disabled={confirmandoId === sug.id}
                            title="Confirmar e criar O.S."
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-brand-600 text-white rounded-lg text-[10px] font-bold hover:bg-brand-700 disabled:opacity-50">
                            {confirmandoId === sug.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                            Confirmar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {sugestoes.length === 0 && (
          <div className="text-center py-4 text-brand-500 text-xs">
            Clique em "Gerar do Gantt" para criar sugestões de O.S. baseadas no cronograma do projeto.
          </div>
        )}
      </div>

      {/* ── O.S. já vinculadas ── */}
      <div>
        <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" /> O.S. Vinculadas ao Projeto ({ordens.length})
        </p>

        {loadingOS ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
        ) : ordens.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-2xl border border-gray-200">
            <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">Nenhuma O.S. vinculada ainda.</p>
            <p className="text-[10px] text-gray-300 mt-1">Use o painel acima para gerar e confirmar sugestões.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {ordens.map(os => {
              const statusConfig = STATUS_OS[os.status] || STATUS_OS.pending;
              const prioConfig = PRIORIDADE_CONFIG[os.priority || 'medium'];
              return (
                <div key={os.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 hover:shadow-sm transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-bold text-gray-900 truncate">{os.title}</p>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${prioConfig.color}`}>
                        {prioConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                      {os.assigneeName && <span className="flex items-center gap-0.5"><User className="w-3 h-3" />{os.assigneeName}</span>}
                      {os.endDate && <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" />{fmtDate(os.endDate)}</span>}
                      {os.code && <span className="font-bold text-gray-500">#{os.code}</span>}
                    </div>
                  </div>
                  <button onClick={() => navigate(`/app/os/${os.id}`)}
                    className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors flex-shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectOSDistribuicao;

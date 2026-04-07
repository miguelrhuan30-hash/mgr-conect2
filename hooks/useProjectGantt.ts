/**
 * hooks/useProjectGantt.ts — Sprint Gantt Completo
 *
 * Hook dedicado ao Gantt do projeto com:
 * - CRUD de tarefas WBS (hierarquia aninhada)
 * - Cálculo automático de Caminho Crítico (CPM — Critical Path Method)
 * - Versionamento de baselines (snapshots do cronograma)
 * - KPIs: SPI, desvio, distribuição de responsabilidade por atrasos
 * - Adversidades com efeito cascata nas dependências
 * - Persistência em Firestore: coleção 'gantt_tasks' e 'gantt_baselines'
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
  Timestamp, writeBatch, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  GanttTask, GanttBaseline, GanttKPI, GanttAdversidade,
  GanttTaskStatus, GanttPartyV2, CollectionName,
} from '../types';

// ── Helpers de data ──────────────────────────────────────────────────────────

const tsToDate = (ts: Timestamp | null | undefined): Date | null => {
  if (!ts) return null;
  try { return ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000); }
  catch { return null; }
};

const daysBetween = (a: Date, b: Date): number =>
  Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));

// ── CPM: Cálculo do Caminho Crítico ─────────────────────────────────────────
/**
 * Algoritmo CPM (Critical Path Method) simplificado:
 * 1. Forward Pass: calcula Early Start e Early Finish
 * 2. Backward Pass: calcula Late Start e Late Finish
 * 3. Folga total = LS - ES (0 = crítico)
 */
const calcularCaminhoCritico = (tasks: GanttTask[]): GanttTask[] => {
  if (tasks.length === 0) return tasks;

  // Trabalhar apenas com tarefas que têm duração definida
  const comDuracao = tasks.filter(t => t.duracaoDias && t.duracaoDias > 0);
  if (comDuracao.length === 0) return tasks;

  // Mapa de ID → task
  const taskMap = new Map<string, GanttTask & { earlyStart: number; earlyFinish: number; lateStart: number; lateFinish: number; folga: number }>();
  comDuracao.forEach(t => taskMap.set(t.id, { ...t, earlyStart: 0, earlyFinish: t.duracaoDias || 0, lateStart: 0, lateFinish: 0, folga: 0 }));

  // Forward Pass
  const processed = new Set<string>();
  const processForward = (taskId: string, depth = 0): void => {
    if (depth > 50 || processed.has(taskId)) return; // evita loop infinito
    const task = taskMap.get(taskId);
    if (!task) return;

    // Calcular ES a partir das dependências
    let maxES = 0;
    for (const dep of (task.dependencias || [])) {
      const pred = taskMap.get(dep.taskId);
      if (!pred) continue;
      processForward(dep.taskId, depth + 1);
      const lag = dep.lagDias || 0;
      if (dep.tipo === 'FS') maxES = Math.max(maxES, pred.earlyFinish + lag);
      else if (dep.tipo === 'SS') maxES = Math.max(maxES, pred.earlyStart + lag);
      else maxES = Math.max(maxES, pred.earlyFinish);
    }
    task.earlyStart = maxES;
    task.earlyFinish = maxES + (task.duracaoDias || 0);
    processed.add(taskId);
  };

  comDuracao.forEach(t => processForward(t.id));

  // Duração total do projeto
  const projectDuration = Math.max(...[...taskMap.values()].map(t => t.earlyFinish));

  // Backward Pass
  taskMap.forEach(t => { t.lateFinish = projectDuration; t.lateStart = projectDuration - (t.duracaoDias || 0); });

  const processedBack = new Set<string>();
  const processBackward = (taskId: string, depth = 0): void => {
    if (depth > 50 || processedBack.has(taskId)) return;
    const task = taskMap.get(taskId);
    if (!task) return;
    processedBack.add(taskId);

    // Atualizar predecessores
    comDuracao.forEach(other => {
      if ((other.dependencias || []).some(d => d.taskId === taskId)) {
        const otherCalc = taskMap.get(other.id);
        if (!otherCalc) return;
        processBackward(other.id, depth + 1);
        const lag = (other.dependencias || []).find(d => d.taskId === taskId)?.lagDias || 0;
        task.lateFinish = Math.min(task.lateFinish, otherCalc.lateStart - lag);
        task.lateStart = task.lateFinish - (task.duracaoDias || 0);
      }
    });
  };

  const terminais = comDuracao.filter(t =>
    !comDuracao.some(other => (other.dependencias || []).some(d => d.taskId === t.id))
  );
  terminais.forEach(t => processBackward(t.id));

  // Calcular folga e marcar caminho crítico
  return tasks.map(t => {
    const calc = taskMap.get(t.id);
    if (!calc) return t;
    const folga = calc.lateStart - calc.earlyStart;
    return {
      ...t,
      earlyStart: calc.earlyStart,
      earlyFinish: calc.earlyFinish,
      lateStart: calc.lateStart,
      lateFinish: calc.lateFinish,
      folga: Math.max(0, folga),
      isCritico: folga <= 0,
    };
  });
};

// ── Cálculo de KPIs ──────────────────────────────────────────────────────────
const calcularKPIs = (tasks: GanttTask[]): GanttKPI => {
  const hoje = new Date();
  const folhas = tasks.filter(t => !tasks.some(other => other.parentId === t.id));

  const concluidas = folhas.filter(t => t.status === 'concluida').length;
  const bloqueadas = folhas.filter(t => t.status === 'bloqueada').length;
  const criticas = folhas.filter(t => t.isCritico).length;

  // Tarefas atrasadas: previsto terminar antes de hoje mas não concluída
  const atrasadas = folhas.filter(t => {
    const fim = tsToDate(t.dataFimPrevista);
    return fim && fim < hoje && t.status !== 'concluida' && t.status !== 'cancelada';
  }).length;

  // SPI: comparar o que deveria estar concluído com o que foi concluído
  const tasksComPrazo = folhas.filter(t => t.dataInicioPrevista && t.dataFimPrevista);
  const planejadoConcluido = tasksComPrazo.filter(t => {
    const fim = tsToDate(t.dataFimPrevista);
    return fim && fim <= hoje;
  }).length;

  const pv = tasksComPrazo.length > 0 ? planejadoConcluido / tasksComPrazo.length : 0;
  const ev = tasksComPrazo.length > 0 ? concluidas / tasksComPrazo.length : 0;
  const spi = pv > 0 ? ev / pv : 1;

  // Desvio total (dias de atraso das tarefas atrasadas)
  const desvioTotal = folhas.reduce((acc, t) => {
    const fimPrev = tsToDate(t.dataFimPrevista);
    if (!fimPrev || t.status === 'concluida' || t.status === 'cancelada') return acc;
    if (fimPrev < hoje) return acc + daysBetween(fimPrev, hoje);
    return acc;
  }, 0);

  // Distribuição por responsabilidade
  const todasAdversidades = tasks.flatMap(t => t.adversidades || []);
  const atrasoPorParty = {
    mgr: todasAdversidades.filter(a => a.responsavel === 'mgr').reduce((s, a) => s + a.diasImpacto, 0),
    cliente: todasAdversidades.filter(a => a.responsavel === 'cliente').reduce((s, a) => s + a.diasImpacto, 0),
    terceiro: todasAdversidades.filter(a => a.responsavel === 'terceiro').reduce((s, a) => s + a.diasImpacto, 0),
  };

  return {
    totalTarefas: folhas.length,
    tarefasConcluidas: concluidas,
    tarefasAtrasadas: atrasadas,
    tarefasBloqueadas: bloqueadas,
    tarefasCriticas: criticas,
    spi: Math.round(spi * 100) / 100,
    ev: Math.round(ev * 100) / 100,
    pv: Math.round(pv * 100) / 100,
    desvioTotalDias: desvioTotal,
    atrasoPorParty,
    totalAdversidades: todasAdversidades.length,
    adversidadesAtivas: todasAdversidades.filter(a => !a.aplicadoCascata).length,
  };
};

// ── Hook principal ────────────────────────────────────────────────────────────
export const useProjectGantt = (projectId: string) => {
  const { currentUser, userProfile } = useAuth();
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [baselines, setBaselines] = useState<GanttBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Listener: tarefas do projeto ──
  useEffect(() => {
    if (!projectId) { setLoading(false); return; }
    const q = query(
      collection(db, CollectionName.GANTT_TASKS),
      where('projectId', '==', projectId),
      orderBy('ordem', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      const rawTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as GanttTask));
      // Recalcula caminho crítico sempre que as tasks mudam
      setTasks(calcularCaminhoCritico(rawTasks));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId]);

  // ── Listener: baselines ──
  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, CollectionName.GANTT_BASELINES),
      where('projectId', '==', projectId),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setBaselines(snap.docs.map(d => ({ id: d.id, ...d.data() } as GanttBaseline)));
    }, () => {});
    return () => unsub();
  }, [projectId]);

  // ── KPIs calculados ──
  const kpis = useMemo(() => calcularKPIs(tasks), [tasks]);

  // ── Hierarquia WBS (árvore) ──
  const taskTree = useMemo(() => {
    const roots = tasks.filter(t => !t.parentId).sort((a, b) => a.ordem - b.ordem);
    const getChildren = (parentId: string): GanttTask[] =>
      tasks.filter(t => t.parentId === parentId).sort((a, b) => a.ordem - b.ordem);
    return { roots, getChildren };
  }, [tasks]);

  // ── CRUD ──

  const addTask = useCallback(async (
    data: Omit<GanttTask, 'id' | 'criadoEm' | 'atualizadoEm' | 'criadoPor' | 'isCritico' | 'folga'>
  ): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');
    // Calcular wbsCode baseado na posição
    const sibling = tasks.filter(t => t.parentId === (data.parentId ?? null));
    const ordem = data.ordem ?? sibling.length + 1;

    const docRef = await addDoc(collection(db, CollectionName.GANTT_TASKS), {
      ...data,
      projectId,
      ordem,
      isCritico: false,
      folga: 0,
      criadoPor: currentUser.uid,
      criadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    return docRef.id;
  }, [currentUser, projectId, tasks]);

  const updateTask = useCallback(async (taskId: string, data: Partial<GanttTask>): Promise<void> => {
    await updateDoc(doc(db, CollectionName.GANTT_TASKS, taskId), {
      ...data,
      atualizadoEm: serverTimestamp(),
    });
  }, []);

  const deleteTask = useCallback(async (taskId: string): Promise<void> => {
    // Também deletar subtarefas em cascata
    const batch = writeBatch(db);
    const subtarefas = tasks.filter(t => t.parentId === taskId);
    subtarefas.forEach(sub => batch.delete(doc(db, CollectionName.GANTT_TASKS, sub.id)));
    batch.delete(doc(db, CollectionName.GANTT_TASKS, taskId));
    await batch.commit();
  }, [tasks]);

  // ── Registrar adversidade ──
  const registrarAdversidade = useCallback(async (
    taskId: string,
    adversidade: Omit<GanttAdversidade, 'id' | 'taskId' | 'registradoPor' | 'registradoPorNome' | 'registradoEm' | 'aplicadoCascata'>
  ): Promise<void> => {
    if (!currentUser) return;

    const novaAdversidade: GanttAdversidade = {
      id: `adv_${Date.now()}`,
      taskId,
      ...adversidade,
      registradoPor: currentUser.uid,
      registradoPorNome: userProfile?.displayName || '',
      registradoEm: Timestamp.now(),
      aplicadoCascata: false,
    };

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const adversidadesAtualizadas = [...(task.adversidades || []), novaAdversidade];

    // Atualizar a tarefa com a adversidade + propagar efeito cascata
    await updateTask(taskId, { adversidades: adversidadesAtualizadas });

    // Efeito cascata: adiar as datas previstas das tarefas dependentes
    if (adversidade.diasImpacto > 0) {
      await propagarCascata(taskId, adversidade.diasImpacto, novaAdversidade.id);
    }
  }, [currentUser, userProfile, tasks, updateTask]);

  // ── Propagação de cascata (efeito dominó) ──
  const propagarCascata = useCallback(async (
    taskOrigemId: string,
    diasImpacto: number,
    adversidadeId: string
  ): Promise<void> => {
    // Encontra todas as tarefas que dependem da taskOrigem (diretas e indiretas)
    const afetadas = new Set<string>();
    const encontrarDependentes = (id: string) => {
      tasks.forEach(t => {
        if ((t.dependencias || []).some(d => d.taskId === id) && !afetadas.has(t.id)) {
          afetadas.add(t.id);
          encontrarDependentes(t.id); // recursivo para cascata completa
        }
      });
    };
    encontrarDependentes(taskOrigemId);

    if (afetadas.size === 0) return;

    const batch = writeBatch(db);
    afetadas.forEach(afetadaId => {
      const task = tasks.find(t => t.id === afetadaId);
      if (!task) return;

      const novoInicio = task.dataInicioPrevista
        ? Timestamp.fromMillis(task.dataInicioPrevista.toMillis() + diasImpacto * 86400000)
        : null;
      const novoFim = task.dataFimPrevista
        ? Timestamp.fromMillis(task.dataFimPrevista.toMillis() + diasImpacto * 86400000)
        : null;

      batch.update(doc(db, CollectionName.GANTT_TASKS, afetadaId), {
        ...(novoInicio ? { dataInicioPrevista: novoInicio } : {}),
        ...(novoFim ? { dataFimPrevista: novoFim } : {}),
        atualizadoEm: serverTimestamp(),
      });
    });

    // Marcar adversidade como aplicada na cascata
    const taskOrigem = tasks.find(t => t.id === taskOrigemId);
    if (taskOrigem) {
      const adversidadesAtualizadas = (taskOrigem.adversidades || []).map(a =>
        a.id === adversidadeId ? { ...a, aplicadoCascata: true } : a
      );
      batch.update(doc(db, CollectionName.GANTT_TASKS, taskOrigemId), {
        adversidades: adversidadesAtualizadas,
        atualizadoEm: serverTimestamp(),
      });
    }

    await batch.commit();
  }, [tasks]);

  // ── Criar baseline (snapshot) ──
  const criarBaseline = useCallback(async (nome: string, descricao?: string): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');

    const snapshot: GanttBaseline = {
      id: '',
      projectId,
      nome,
      descricao,
      tasks: tasks.map(t => ({
        id: t.id,
        label: t.label,
        dataInicioPrevista: t.dataInicioPrevista ?? null,
        dataFimPrevista: t.dataFimPrevista ?? null,
        duracaoDias: t.duracaoDias,
        isCritico: t.isCritico,
      })),
      totalDias: tasks.reduce((max, t) => {
        const fim = tsToDate(t.dataFimPrevista);
        const ini = tsToDate(tasks[0]?.dataInicioPrevista);
        if (!fim || !ini) return max;
        return Math.max(max, daysBetween(ini, fim));
      }, 0),
      criadoPor: currentUser.uid,
      criadoPorNome: userProfile?.displayName || '',
      criadoEm: Timestamp.now(),
    };

    const ref = await addDoc(collection(db, CollectionName.GANTT_BASELINES), snapshot);
    return ref.id;
  }, [currentUser, userProfile, projectId, tasks]);

  const deleteBaseline = useCallback(async (baselineId: string): Promise<void> => {
    await deleteDoc(doc(db, CollectionName.GANTT_BASELINES, baselineId));
  }, []);

  // ── Reordenar tarefas (drag & drop) ──
  const reordenarTasks = useCallback(async (
    parentId: string | null,
    orderedIds: string[]
  ): Promise<void> => {
    const batch = writeBatch(db);
    orderedIds.forEach((id, i) => {
      batch.update(doc(db, CollectionName.GANTT_TASKS, id), { ordem: i + 1, atualizadoEm: serverTimestamp() });
    });
    await batch.commit();
  }, []);

  // ── Helpers de exibição ──
  const getTasksFlat = useCallback((parentId: string | null = null, depth = 0): (GanttTask & { depth: number })[] => {
    const children = tasks
      .filter(t => (t.parentId ?? null) === parentId)
      .sort((a, b) => a.ordem - b.ordem);
    return children.flatMap(t => [
      { ...t, depth },
      ...getTasksFlat(t.id, depth + 1),
    ]);
  }, [tasks]);

  return {
    tasks,
    baselines,
    kpis,
    taskTree,
    loading,
    saving,
    addTask,
    updateTask,
    deleteTask,
    registrarAdversidade,
    criarBaseline,
    deleteBaseline,
    reordenarTasks,
    getTasksFlat,
  };
};

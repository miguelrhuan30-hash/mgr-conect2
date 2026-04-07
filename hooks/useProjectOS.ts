/**
 * hooks/useProjectOS.ts — Sprint 4
 *
 * Hook para consultar e vincular Ordens de Serviço a um projeto v2.
 * OS usa a coleção 'tasks' com campo projectId (Task.projectId).
 * Também gerencia as datas previstas de cada fase do projeto (para Gantt interno).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, arrayUnion, arrayRemove,
  serverTimestamp, orderBy, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, Task } from '../types';

// ── Tipos de fase Gantt ──────────────────────────────────────────────────
export type GanttParty = 'mgr' | 'cliente';

export interface GanttFase {
  id: string;                   // ex: 'levantamento', 'aprovacao_cliente'
  label: string;
  party: GanttParty;            // 'mgr' = responsabilidade nossa | 'cliente' = do cliente
  ordem: number;
  dataInicioPrevista?: Timestamp | null;
  dataFimPrevista?: Timestamp | null;
  dataInicioReal?: Timestamp | null;
  dataFimReal?: Timestamp | null;
  observacao?: string;
}

// Fases padrão do Gantt interno de um projeto
export const GANTT_FASES_PADRAO: Omit<GanttFase, 'dataInicioPrevista' | 'dataFimPrevista' | 'dataInicioReal' | 'dataFimReal'>[] = [
  { id: 'levantamento',       label: 'Levantamento Técnico',    party: 'mgr',     ordem: 1 },
  { id: 'cotacao_mgr',        label: 'Elaboração de Cotação',   party: 'mgr',     ordem: 2 },
  { id: 'aprovacao_cliente',  label: 'Aprovação do Cliente',    party: 'cliente', ordem: 3 },
  { id: 'contrato',           label: 'Assinatura de Contrato',  party: 'cliente', ordem: 4 },
  { id: 'compra_materiais',   label: 'Compra de Materiais',     party: 'mgr',     ordem: 5 },
  { id: 'entrega_materiais',  label: 'Entrega / Recebimento',   party: 'cliente', ordem: 6 },
  { id: 'instalacao',         label: 'Instalação em Campo',     party: 'mgr',     ordem: 7 },
  { id: 'testes',             label: 'Testes e Comissionamento',party: 'mgr',     ordem: 8 },
  { id: 'entrega_final',      label: 'Entrega Final ao Cliente',party: 'mgr',     ordem: 9 },
  { id: 'pagamento_final',    label: 'Pagamento Final',         party: 'cliente', ordem: 10 },
];

export const useProjectOS = (projectId: string) => {
  const { currentUser } = useAuth();
  const [ordens, setOrdens] = useState<Task[]>([]);
  const [ganttFases, setGanttFases] = useState<GanttFase[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Carregar OS vinculadas ──
  useEffect(() => {
    if (!projectId) { setLoading(false); return; }

    const qOS = query(
      collection(db, CollectionName.TASKS),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'asc'),
    );

    const unsub = onSnapshot(qOS, snap => {
      setOrdens(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)));
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [projectId]);

  // ── Carregar dados Gantt do projeto ──
  useEffect(() => {
    if (!projectId) return;
    const unsub = onSnapshot(doc(db, CollectionName.PROJECTS_V2, projectId), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const storedFases: GanttFase[] = data.ganttFases || [];

      // Merge com fases padrão (adiciona novas fases, mantém existentes)
      const merged: GanttFase[] = GANTT_FASES_PADRAO.map(padrao => {
        const existing = storedFases.find(f => f.id === padrao.id);
        return existing ?? {
          ...padrao,
          dataInicioPrevista: null,
          dataFimPrevista: null,
          dataInicioReal: null,
          dataFimReal: null,
          observacao: '',
        };
      });
      setGanttFases(merged);
    });
    return () => unsub();
  }, [projectId]);

  // ── Vincular OS já existente ao projeto ──
  const vincularOS = useCallback(async (osId: string, osTitle: string) => {
    if (!currentUser) return;
    await updateDoc(doc(db, CollectionName.TASKS, osId), {
      projectId,
      projectName: undefined, // será atualizado externamente se necessário
    });
    await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
      osIds: arrayUnion(osId),
      atualizadoEm: serverTimestamp(),
    });
  }, [projectId, currentUser]);

  // ── Desvincular OS do projeto ──
  const desvincularOS = useCallback(async (osId: string) => {
    if (!currentUser) return;
    await updateDoc(doc(db, CollectionName.TASKS, osId), {
      projectId: null,
    });
    await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
      osIds: arrayRemove(osId),
      atualizadoEm: serverTimestamp(),
    });
  }, [projectId, currentUser]);

  // ── Salvar fases do Gantt interno ──
  const salvarGanttFases = useCallback(async (fases: GanttFase[]) => {
    if (!currentUser) return;
    await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
      ganttFases: fases,
      atualizadoEm: serverTimestamp(),
    });
  }, [projectId, currentUser]);

  // ── Métricas rápidas das OS ──
  const stats = {
    total: ordens.length,
    concluidas: ordens.filter(o => o.status === 'completed').length,
    emAndamento: ordens.filter(o => o.status === 'in-progress').length,
    pendentes: ordens.filter(o => o.status === 'pending').length,
    bloqueadas: ordens.filter(o => o.status === 'blocked').length,
  };

  return {
    ordens,
    ganttFases,
    loading,
    stats,
    vincularOS,
    desvincularOS,
    salvarGanttFases,
  };
};

/**
 * hooks/useFaturamento.ts
 * CRUD de faturamento e parcelas (project_faturamentos) — generalizado de
 * useProjectFaturamento.ts pra cobrir tanto cobrança de projeto (projectId)
 * quanto cobrança de O.S. avulsa única ou agrupada (taskIds).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp, arrayUnion, writeBatch,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ProjectFaturamento, FaturamentoParcela, FaturamentoDocumento, ParcelaStatus,
  TipoPlanoFaturamento, TipoDocumentoFaturamento, MetodoPagamento,
  CollectionName, WorkflowStatus,
} from '../types';

export type FaturamentoReferencia = { projectId: string } | { taskIds: string[] };

const isProjeto = (ref: FaturamentoReferencia): ref is { projectId: string } => 'projectId' in ref;

export const useFaturamento = (referencia: FaturamentoReferencia) => {
  const { currentUser, userProfile } = useAuth();
  const [faturamento, setFaturamento] = useState<ProjectFaturamento | null>(null);
  const [loading, setLoading] = useState(true);

  const deProjeto = isProjeto(referencia);
  const chaveId = deProjeto ? referencia.projectId : referencia.taskIds[0];
  const pastaBase = deProjeto ? `projects/${(referencia as any).projectId}/faturamento` : `os_faturamento/${chaveId}`;

  useEffect(() => {
    if (!chaveId) { setLoading(false); return; }
    const q = deProjeto
      ? query(collection(db, CollectionName.PROJECT_FATURAMENTOS), where('projectId', '==', (referencia as any).projectId))
      : query(collection(db, CollectionName.PROJECT_FATURAMENTOS), where('taskIds', 'array-contains', chaveId));
    const unsub = onSnapshot(q, snap => {
      setFaturamento(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as ProjectFaturamento);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveId, deProjeto]);

  /** Criar faturamento com parcelas iniciais. Se for O.S., já marca as tasks como AGUARDANDO_PAGAMENTO. */
  const createFaturamento = useCallback(async (
    valorTotal: number,
    tipoPlano: TipoPlanoFaturamento,
    parcelas: Omit<FaturamentoParcela, 'id' | 'numero' | 'status'>[],
    clientId: string,
    clientName: string,
    projectNome?: string,
  ): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');
    const parcelasComId: FaturamentoParcela[] = parcelas.map((p, i) => ({
      ...p,
      id: crypto.randomUUID(),
      numero: i + 1,
      status: 'pendente' as ParcelaStatus,
    }));
    const nome = userProfile?.displayName || (userProfile as any)?.nomeCompleto || '';

    const docRef = await addDoc(collection(db, CollectionName.PROJECT_FATURAMENTOS), {
      ...(deProjeto
        ? { projectId: (referencia as any).projectId, projectNome: projectNome || '' }
        : { taskIds: (referencia as any).taskIds }),
      clientId,
      clientName,
      valorTotal,
      tipoPlano,
      parcelas: parcelasComId,
      documentos: [],
      status: 'aberto',
      totalPago: 0,
      totalPendente: valorTotal,
      totalAtrasado: 0,
      criadoEm: serverTimestamp(),
      criadoPor: currentUser.uid,
      criadoPorNome: nome,
    });

    if (!deProjeto) {
      const batch = writeBatch(db);
      (referencia as { taskIds: string[] }).taskIds.forEach(taskId => {
        batch.update(doc(db, CollectionName.TASKS, taskId), {
          workflowStatus: WorkflowStatus.AGUARDANDO_PAGAMENTO,
          status: 'in-progress',
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }

    return docRef.id;
  }, [currentUser, userProfile, referencia, deProjeto]);

  /** Registrar pagamento de uma parcela — dá baixa, opcionalmente com comprovante. */
  const registrarPagamento = useCallback(async (
    faturamentoId: string,
    parcelaId: string,
    dataPagamento: Date,
    comprovanteFile?: File,
    metodoPagamento?: MetodoPagamento,
  ): Promise<void> => {
    if (!faturamento) return;

    let comprovanteUrl: string | undefined;
    if (comprovanteFile) {
      const path = `${pastaBase}/${parcelaId}_comprovante_${comprovanteFile.name}`;
      const sRef = storageRef(storage, path);
      await new Promise<void>((res, rej) => {
        const task = uploadBytesResumable(sRef, comprovanteFile, { contentType: comprovanteFile.type });
        task.on('state_changed', undefined, rej, async () => {
          comprovanteUrl = await getDownloadURL(task.snapshot.ref);
          res();
        });
      });
    }

    const parcelas = faturamento.parcelas.map(p =>
      p.id === parcelaId
        ? {
            ...p,
            status: 'pago' as ParcelaStatus,
            dataPagamento: Timestamp.fromDate(dataPagamento),
            ...(metodoPagamento ? { metodoPagamento } : {}),
            ...(comprovanteUrl ? { comprovanteUrl } : {}),
          }
        : p
    );

    const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
    const totalPendente = parcelas.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
    const totalAtrasado = parcelas.filter(p => p.status === 'atrasado').reduce((s, p) => s + p.valor, 0);
    const todasPagas = parcelas.every(p => p.status === 'pago');

    await updateDoc(doc(db, CollectionName.PROJECT_FATURAMENTOS, faturamentoId), {
      parcelas,
      totalPago,
      totalPendente,
      totalAtrasado,
      ...(todasPagas ? { status: 'concluido', concluidoEm: serverTimestamp() } : {}),
      atualizadoEm: serverTimestamp(),
    });

    // ── Auto-conclusão: 100% recebido ──
    if (deProjeto) {
      const projectId = (referencia as any).projectId;
      if (todasPagas && faturamento.valorTotal > 0) {
        await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
          fase: 'concluido',
          valorRecebido: totalPago,
          faseHistorico: arrayUnion({
            fase: 'concluido',
            timestamp: serverTimestamp(),
            nota: 'Faturamento 100% recebido — conclusão automática',
          }),
          atualizadoEm: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
          valorRecebido: totalPago,
          atualizadoEm: serverTimestamp(),
        });
      }
    } else if (todasPagas) {
      // Cobrança de O.S. (única ou agrupada): todas as O.S. envolvidas concluem juntas,
      // saindo da fase Faturamento do Flow automaticamente.
      const batch = writeBatch(db);
      (referencia as { taskIds: string[] }).taskIds.forEach(taskId => {
        batch.update(doc(db, CollectionName.TASKS, taskId), {
          workflowStatus: WorkflowStatus.CONCLUIDO,
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      });
      await batch.commit();
    }
  }, [faturamento, referencia, deProjeto, pastaBase]);

  /** Marcar parcela como atrasada */
  const marcarAtrasado = useCallback(async (faturamentoId: string, parcelaId: string) => {
    if (!faturamento) return;
    const parcelas = faturamento.parcelas.map(p =>
      p.id === parcelaId ? { ...p, status: 'atrasado' as ParcelaStatus } : p
    );
    const totalAtrasado = parcelas.filter(p => p.status === 'atrasado').reduce((s, p) => s + p.valor, 0);
    await updateDoc(doc(db, CollectionName.PROJECT_FATURAMENTOS, faturamentoId), {
      parcelas,
      totalAtrasado,
      atualizadoEm: serverTimestamp(),
    });
  }, [faturamento]);

  /** Anexar um documento (comprovante avulso, boleto ou NF) à cobrança. */
  const uploadDocumento = useCallback(async (
    faturamentoId: string,
    tipo: TipoDocumentoFaturamento,
    file: File,
    parcelaId?: string,
  ): Promise<void> => {
    if (!currentUser) return;
    const path = `${pastaBase}/${tipo}_${Date.now()}_${file.name}`;
    const sRef = storageRef(storage, path);
    const url = await new Promise<string>((res, rej) => {
      const task = uploadBytesResumable(sRef, file, { contentType: file.type });
      task.on('state_changed', undefined, rej, async () => res(await getDownloadURL(task.snapshot.ref)));
    });
    const nome = userProfile?.displayName || (userProfile as any)?.nomeCompleto || '';
    const documento: FaturamentoDocumento = {
      id: crypto.randomUUID(),
      tipo,
      url,
      nome: file.name,
      ...(parcelaId ? { parcelaId } : {}),
      enviadoEm: Timestamp.now(),
      enviadoPor: currentUser.uid,
      enviadoPorNome: nome,
    };
    await updateDoc(doc(db, CollectionName.PROJECT_FATURAMENTOS, faturamentoId), {
      documentos: arrayUnion(documento),
      atualizadoEm: serverTimestamp(),
    });
  }, [currentUser, userProfile, pastaBase]);

  const percentualRecebido = faturamento && faturamento.valorTotal > 0
    ? Math.round((faturamento.totalPago / faturamento.valorTotal) * 100)
    : 0;

  return {
    faturamento,
    loading,
    percentualRecebido,
    createFaturamento,
    registrarPagamento,
    marcarAtrasado,
    uploadDocumento,
  };
};

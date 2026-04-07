/**
 * hooks/useProjectFaturamento.ts — Sprint 2
 * CRUD de faturamento e parcelas (project_faturamentos).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ProjectFaturamento, FaturamentoParcela, ParcelaStatus, CollectionName,
} from '../types';

export const useProjectFaturamento = (projectId: string) => {
  const { currentUser, userProfile } = useAuth();
  const [faturamento, setFaturamento] = useState<ProjectFaturamento | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, CollectionName.PROJECT_FATURAMENTOS),
      where('projectId', '==', projectId),
    );
    const unsub = onSnapshot(q, snap => {
      setFaturamento(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as ProjectFaturamento);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId]);

  /** Criar faturamento com parcelas iniciais */
  const createFaturamento = useCallback(async (
    valorTotal: number,
    parcelas: Omit<FaturamentoParcela, 'id'>[],
    projectNome: string,
    clientId: string,
    clientName: string,
  ): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');
    const parcelasComId: FaturamentoParcela[] = parcelas.map((p: any, i) => ({
      ...p,
      id: crypto.randomUUID(),
      numero: i + 1,
      status: 'pendente' as ParcelaStatus,
    }));
    const docRef = await addDoc(collection(db, CollectionName.PROJECT_FATURAMENTOS), {
      projectId,
      projectNome,
      clientId,
      clientName,
      valorTotal,
      parcelas: parcelasComId,
      totalPago: 0,
      totalPendente: valorTotal,
      totalAtrasado: 0,
      criadoEm: serverTimestamp(),
      criadoPor: currentUser.uid,
      criadoPorNome: userProfile?.displayName || '',
    });
    return docRef.id;
  }, [currentUser, userProfile, projectId]);

  /** Registrar pagamento de uma parcela */
  const registrarPagamento = useCallback(async (
    faturamentoId: string,
    parcelaId: string,
    dataPagamento: Date,
    comprovanteFile?: File,
  ): Promise<void> => {
    if (!faturamento) return;

    let comprovanteUrl: string | undefined;
    if (comprovanteFile) {
      const path = `projects/${projectId}/faturamento/${parcelaId}_comprovante_${comprovanteFile.name}`;
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
            ...(comprovanteUrl ? { comprovanteUrl } : {}),
          }
        : p
    );

    const totalPago = parcelas.filter(p => p.status === 'pago').reduce((s, p) => s + p.valor, 0);
    const totalPendente = parcelas.filter(p => p.status === 'pendente').reduce((s, p) => s + p.valor, 0);
    const totalAtrasado = parcelas.filter(p => p.status === 'atrasado').reduce((s, p) => s + p.valor, 0);

    await updateDoc(doc(db, CollectionName.PROJECT_FATURAMENTOS, faturamentoId), {
      parcelas,
      totalPago,
      totalPendente,
      totalAtrasado,
      atualizadoEm: serverTimestamp(),
    });

    // ── Auto-conclusão: 100% recebido → avançar projeto para 'concluido' ──
    const todasPagas = parcelas.every(p => p.status === 'pago');
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
      // Atualiza valorRecebido mesmo sem 100%
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
        valorRecebido: totalPago,
        atualizadoEm: serverTimestamp(),
      });
    }
  }, [faturamento, projectId]);

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

  // Helpers
  const percentualRecebido = faturamento
    ? Math.round((faturamento.totalPago / faturamento.valorTotal) * 100)
    : 0;

  return {
    faturamento,
    loading,
    percentualRecebido,
    createFaturamento,
    registrarPagamento,
    marcarAtrasado,
  };
};

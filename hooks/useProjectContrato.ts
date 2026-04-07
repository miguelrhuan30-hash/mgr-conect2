/**
 * hooks/useProjectContrato.ts — Sprint 2
 * CRUD de contratos de projeto (project_contratos).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ProjectContrato, ContratoStatus, CollectionName } from '../types';

export const useProjectContrato = (projectId: string) => {
  const { currentUser, userProfile } = useAuth();
  const [contrato, setContrato] = useState<ProjectContrato | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, CollectionName.PROJECT_CONTRATOS),
      where('projectId', '==', projectId),
    );
    const unsub = onSnapshot(q, snap => {
      setContrato(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as ProjectContrato);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId]);

  /** Criar contrato com template */
  const createContrato = useCallback(async (
    data: { projectNome: string; clientId: string; clientName: string; valorContrato: number; textoContrato: string; linkPublico?: string | null; }
  ): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');
    const docRef = await addDoc(collection(db, CollectionName.PROJECT_CONTRATOS), {
      projectId,
      clientId: data.clientId || '',
      clientName: data.clientName,
      titulo: `Contrato — ${data.projectNome}`,
      conteudoHtml: data.textoContrato, // usa conteudoHtml do tipo real
      variaveis: {
        linkPublico: data.linkPublico || '',
        valorContrato: String(data.valorContrato),
      },
      status: 'rascunho' as ContratoStatus,
      criadoEm: serverTimestamp(),
      criadoPor: currentUser.uid,
      criadoPorNome: userProfile?.displayName || '',
    });
    return docRef.id;
  }, [currentUser, userProfile, projectId]);

  const updateContrato = useCallback(async (id: string, data: Partial<ProjectContrato>) => {
    await updateDoc(doc(db, CollectionName.PROJECT_CONTRATOS, id), {
      ...data,
      atualizadoEm: serverTimestamp(),
    });
  }, []);

  /** Marcar como enviado */
  const marcarEnviado = useCallback(async (id: string) => {
    await updateDoc(doc(db, CollectionName.PROJECT_CONTRATOS, id), {
      status: 'enviado' as ContratoStatus,
      enviadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  }, []);

  /** Upload de PDF do contrato assinado */
  const uploadContratoAssinado = useCallback(async (id: string, file: File): Promise<string> => {
    const path = `contratos/${projectId}/${id}_assinado_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file, { contentType: 'application/pdf' });
    return new Promise((resolve, reject) => {
      task.on('state_changed', undefined, reject, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, CollectionName.PROJECT_CONTRATOS, id), {
          status: 'assinado' as ContratoStatus,
          documentoAssinadoUrl: url,
          assinadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp(),
        });
        resolve(url);
      });
    });
  }, [projectId]);

  /** Upload de PDF original gerado */
  const uploadContratoPDF = useCallback(async (id: string, file: File): Promise<string> => {
    const path = `contratos/${projectId}/${id}_contrato.pdf`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file, { contentType: 'application/pdf' });
    return new Promise((resolve, reject) => {
      task.on('state_changed', undefined, reject, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, CollectionName.PROJECT_CONTRATOS, id), {
          documentoPdfUrl: url,
          atualizadoEm: serverTimestamp(),
        });
        resolve(url);
      });
    });
  }, [projectId]);

  return {
    contrato,
    loading,
    createContrato,
    updateContrato,
    marcarEnviado,
    uploadContratoAssinado,
    uploadContratoPDF,
  };
};

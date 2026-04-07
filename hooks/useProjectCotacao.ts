/**
 * hooks/useProjectCotacao.ts — Sprint 2
 * CRUD de cotações de projeto (project_cotacoes).
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ProjectCotacao, CotacaoItem, CollectionName } from '../types';

export const useProjectCotacao = (projectId: string) => {
  const { currentUser, userProfile } = useAuth();
  const [cotacoes, setCotacoes] = useState<ProjectCotacao[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, CollectionName.PROJECT_COTACOES),
      where('projectId', '==', projectId),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      setCotacoes(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectCotacao)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId]);

  const addCotacao = useCallback(async (
    data: Omit<ProjectCotacao, 'id' | 'criadoEm' | 'criadoPor' | 'criadoPorNome'>
  ): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');
    const docRef = await addDoc(collection(db, CollectionName.PROJECT_COTACOES), {
      ...data,
      projectId,
      selecionada: false,
      criadoEm: serverTimestamp(),
      criadoPor: currentUser.uid,
      criadoPorNome: userProfile?.displayName || '',
    });
    return docRef.id;
  }, [currentUser, userProfile, projectId]);

  const updateCotacao = useCallback(async (id: string, data: Partial<ProjectCotacao>) => {
    await updateDoc(doc(db, CollectionName.PROJECT_COTACOES, id), data);
  }, []);

  const deleteCotacao = useCallback(async (id: string) => {
    await deleteDoc(doc(db, CollectionName.PROJECT_COTACOES, id));
  }, []);

  /** Marcar uma cotação como selecionada (desmarca as demais) */
  const selecionarCotacao = useCallback(async (id: string) => {
    await Promise.all(
      cotacoes.map(c =>
        updateDoc(doc(db, CollectionName.PROJECT_COTACOES, c.id), {
          selecionada: c.id === id,
        })
      )
    );
  }, [cotacoes]);

  /** Upload de documento da cotação (PDF) */
  const uploadDocumento = useCallback(async (cotacaoId: string, file: File): Promise<string> => {
    const path = `projects/${projectId}/cotacoes/${cotacaoId}_${file.name}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file, { contentType: file.type });
    return new Promise((resolve, reject) => {
      task.on('state_changed', undefined, reject, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, CollectionName.PROJECT_COTACOES, cotacaoId), {
          documentoUrl: url,
          documentoNome: file.name,
        });
        resolve(url);
      });
    });
  }, [projectId]);

  /** Calcular total a partir dos itens */
  const calcularTotal = (itens: CotacaoItem[]): number =>
    itens.reduce((sum, item) => sum + (item.valorTotal || 0), 0);

  const cotacaoSelecionada = cotacoes.find(c => c.selecionada);
  const totalCotacoes = cotacoes.length;

  return {
    cotacoes,
    loading,
    cotacaoSelecionada,
    totalCotacoes,
    addCotacao,
    updateCotacao,
    deleteCotacao,
    selecionarCotacao,
    uploadDocumento,
    calcularTotal,
  };
};

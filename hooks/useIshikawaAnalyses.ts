/**
 * hooks/useIshikawaAnalyses.ts — Sprint IW-02
 * CRUD completo para análises Ishikawa individuais (multi-análise).
 * Coleção: hub_ishikawa_analyses
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, addDoc, updateDoc,
  onSnapshot, query, where,
  serverTimestamp, Timestamp, orderBy, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { IshikawaAnalysis, IshikawaSlot, CollectionName } from '../types';

const DEBOUNCE_MS = 800;
const MAX_ANALYSES = 50;

export function useIshikawaAnalyses() {
  const { currentUser, userProfile } = useAuth();
  const [analyses, setAnalyses] = useState<IshikawaAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Escuta análises em tempo real ─────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, CollectionName.ISHIKAWA_ANALYSES),
      where('deleted', '==', false),
      orderBy('updatedAt', 'desc'),
      limit(MAX_ANALYSES)
    );
    const unsub = onSnapshot(q, (snap) => {
      setAnalyses(
        snap.docs.map(d => ({ id: d.id, ...d.data() } as IshikawaAnalysis))
      );
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // ── Criar nova análise ────────────────────────────────────────────────────
  const createAnalysis = useCallback(async (nome: string): Promise<string> => {
    if (!currentUser) throw new Error('Usuário não autenticado');
    const safeName = nome.trim().slice(0, 120);
    if (safeName.length < 3) throw new Error('Nome deve ter pelo menos 3 caracteres');

    const ref = await addDoc(collection(db, CollectionName.ISHIKAWA_ANALYSES), {
      nome: safeName,
      problema: '',
      slots: {},
      deleted: false,
      createdBy: currentUser.uid,
      createdByName: userProfile?.displayName || 'Usuário',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });
    return ref.id;
  }, [currentUser, userProfile]);

  // ── Atualizar slot de causa com debounce ──────────────────────────────────
  const updateSlot = useCallback((
    analysisId: string,
    slot: IshikawaSlot,
    text: string
  ) => {
    if (!currentUser) return;
    const debounceKey = `${analysisId}:${slot}`;
    if (debounceRef.current[debounceKey]) clearTimeout(debounceRef.current[debounceKey]);
    debounceRef.current[debounceKey] = setTimeout(async () => {
      const safeText = text.slice(0, 2000);
      await updateDoc(doc(db, CollectionName.ISHIKAWA_ANALYSES, analysisId), {
        [`slots.${slot}`]: safeText,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    }, DEBOUNCE_MS);
  }, [currentUser]);

  // ── Atualizar problema (cabeça do peixe) com debounce ────────────────────
  const updateProblema = useCallback((analysisId: string, text: string) => {
    if (!currentUser) return;
    const debounceKey = `${analysisId}:problema`;
    if (debounceRef.current[debounceKey]) clearTimeout(debounceRef.current[debounceKey]);
    debounceRef.current[debounceKey] = setTimeout(async () => {
      const safeText = text.slice(0, 500);
      await updateDoc(doc(db, CollectionName.ISHIKAWA_ANALYSES, analysisId), {
        problema: safeText,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      });
    }, DEBOUNCE_MS);
  }, [currentUser]);

  // ── Renomear análise ──────────────────────────────────────────────────────
  const renameAnalysis = useCallback(async (analysisId: string, novoNome: string) => {
    if (!currentUser) return;
    const safeName = novoNome.trim().slice(0, 120);
    if (safeName.length < 3) throw new Error('Nome deve ter pelo menos 3 caracteres');
    await updateDoc(doc(db, CollectionName.ISHIKAWA_ANALYSES, analysisId), {
      nome: safeName,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });
  }, [currentUser]);

  // ── Soft-delete de análise ────────────────────────────────────────────────
  const deleteAnalysis = useCallback(async (analysisId: string) => {
    if (!currentUser) return;
    await updateDoc(doc(db, CollectionName.ISHIKAWA_ANALYSES, analysisId), {
      deleted: true,
      updatedAt: serverTimestamp(),
      updatedBy: currentUser.uid,
    });
  }, [currentUser]);

  return {
    analyses,
    loading,
    createAnalysis,
    updateSlot,
    updateProblema,
    renameAnalysis,
    deleteAnalysis,
  };
}

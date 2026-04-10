/**
 * hooks/useFornecedores.ts
 * CRUD reativo de fornecedores de materiais e equipamentos.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Fornecedor, CollectionName } from '../types';

export const useFornecedores = () => {
  const { currentUser } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, CollectionName.FORNECEDORES),
      orderBy('nome', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setFornecedores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Fornecedor)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const addFornecedor = useCallback(async (
    data: Omit<Fornecedor, 'id' | 'criadoEm' | 'criadoPor'>
  ): Promise<string> => {
    if (!currentUser) throw new Error('Não autenticado');
    const ref = await addDoc(collection(db, CollectionName.FORNECEDORES), {
      ...data,
      ativo: true,
      criadoEm: serverTimestamp(),
      criadoPor: currentUser.uid,
    });
    return ref.id;
  }, [currentUser]);

  const updateFornecedor = useCallback(async (id: string, data: Partial<Fornecedor>) => {
    await updateDoc(doc(db, CollectionName.FORNECEDORES, id), { ...data });
  }, []);

  const deleteFornecedor = useCallback(async (id: string) => {
    // Soft delete — mantém histórico nas cotações
    await updateDoc(doc(db, CollectionName.FORNECEDORES, id), { ativo: false });
  }, []);

  return { fornecedores, loading, addFornecedor, updateFornecedor, deleteFornecedor };
};

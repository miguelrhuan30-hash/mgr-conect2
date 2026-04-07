/**
 * hooks/useProjectActivity.ts — Sprint 12
 *
 * Gerencia o feed de atividades e comentários por projeto.
 * Cada entrada é um documento na coleção `project_activities`.
 * Tipos de entrada:
 *   - 'comentario'     — texto livre do usuário
 *   - 'fase_avancada'  — log automático ao avançar fase
 *   - 'arquivo_anexo'  — upload de arquivo avulso
 *   - 'nota_interna'   — nota técnica interna (não exibida ao cliente)
 */
import { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, deleteDoc, doc, serverTimestamp, limit,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName } from '../types';

export type AtividadeTipo = 'comentario' | 'fase_avancada' | 'arquivo_anexo' | 'nota_interna';

export interface ProjectAtividade {
  id: string;
  projectId: string;
  tipo: AtividadeTipo;
  texto: string;
  arquivoUrl?: string;
  arquivoNome?: string;
  faseAnterior?: string;
  faseNova?: string;
  criadoEm: any;
  criadoPorUid: string;
  criadoPorNome: string;
  criadoPorFoto?: string;
}

const COLLECTION = 'project_activities';

export const useProjectActivity = (projectId: string) => {
  const { currentUser, userProfile } = useAuth();
  const [atividades, setAtividades] = useState<ProjectAtividade[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  // ── Listener em tempo real ──
  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, COLLECTION),
      where('projectId', '==', projectId),
      orderBy('criadoEm', 'desc'),
      limit(80),
    );
    const unsub = onSnapshot(q, snap => {
      setAtividades(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectAtividade)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [projectId]);

  // ── Adicionar comentário ──
  const addComentario = useCallback(async (texto: string, tipo: AtividadeTipo = 'comentario') => {
    if (!currentUser || !texto.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, COLLECTION), {
        projectId,
        tipo,
        texto: texto.trim(),
        criadoEm: serverTimestamp(),
        criadoPorUid: currentUser.uid,
        criadoPorNome: userProfile?.displayName || userProfile?.email || 'Usuário',
        criadoPorFoto: userProfile?.photoURL || null,
      });
    } finally { setPosting(false); }
  }, [currentUser, userProfile, projectId]);

  // ── Log automático de fase ──
  const logFaseAvancada = useCallback(async (faseAnterior: string, faseNova: string) => {
    if (!currentUser) return;
    await addDoc(collection(db, COLLECTION), {
      projectId,
      tipo: 'fase_avancada' as AtividadeTipo,
      texto: `Fase avançada: ${faseAnterior} → ${faseNova}`,
      faseAnterior,
      faseNova,
      criadoEm: serverTimestamp(),
      criadoPorUid: currentUser.uid,
      criadoPorNome: userProfile?.displayName || userProfile?.email || 'Sistema',
      criadoPorFoto: userProfile?.photoURL || null,
    });
  }, [currentUser, userProfile, projectId]);

  // ── Remover comentário ──
  const deleteComentario = useCallback(async (atividadeId: string) => {
    await deleteDoc(doc(db, COLLECTION, atividadeId));
  }, []);

  // ── Upload de arquivo ──
  const addArquivo = useCallback(async (file: File, texto = '') => {
    if (!currentUser) return;
    setPosting(true);
    try {
      const path = `projects/${projectId}/atividades/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const url = await new Promise<string>((res, rej) => {
        const task = uploadBytesResumable(sRef, file, { contentType: file.type });
        task.on('state_changed', undefined, rej, async () => {
          res(await getDownloadURL(task.snapshot.ref));
        });
      });
      await addDoc(collection(db, COLLECTION), {
        projectId,
        tipo: 'arquivo_anexo' as AtividadeTipo,
        texto: texto || file.name,
        arquivoUrl: url,
        arquivoNome: file.name,
        criadoEm: serverTimestamp(),
        criadoPorUid: currentUser.uid,
        criadoPorNome: userProfile?.displayName || userProfile?.email || 'Usuário',
        criadoPorFoto: userProfile?.photoURL || null,
      });
    } finally { setPosting(false); }
  }, [currentUser, userProfile, projectId]);

  return {
    atividades,
    loading,
    posting,
    addComentario,
    logFaseAvancada,
    deleteComentario,
    addArquivo,
  };
};

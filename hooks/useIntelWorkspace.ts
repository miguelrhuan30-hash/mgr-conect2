/**
 * hooks/useIntelWorkspace.ts — Intel Workspace v2 (Sprint IW-01)
 * CRUD de items, links e estado de ferramentas.
 * Sem dependência de API Gemini — 100% Firestore.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, doc, addDoc, updateDoc,
  onSnapshot, query, where, getDocs,
  setDoc, serverTimestamp, Timestamp, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  IntelItem, IntelLink, IntelToolState,
  IntelToolId, IntelSlotKey, CollectionName,
} from '../types';

const DEBOUNCE_MS = 800;

export function useIntelWorkspace(activeTool: IntelToolId) {
  const { currentUser, userProfile } = useAuth();
  const [toolState, setToolState] = useState<IntelToolState | null>(null);
  const [allItems, setAllItems] = useState<IntelItem[]>([]);
  const [loadingTool, setLoadingTool] = useState(true);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Escuta estado da ferramenta ativa (tempo real) ─────────────
  useEffect(() => {
    setLoadingTool(true);
    const ref = doc(db, CollectionName.INTEL_TOOL_STATE, activeTool);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setToolState({ toolId: activeTool, ...snap.data() } as IntelToolState);
      } else {
        setToolState({
          toolId: activeTool,
          slots: {},
          updatedAt: Timestamp.now(),
          updatedBy: '',
        });
      }
      setLoadingTool(false);
    }, () => setLoadingTool(false));
    return unsub;
  }, [activeTool]);

  // ── Carrega TODOS os items para autocomplete e resolução de links ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.INTEL_ITEMS),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAllItems(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as IntelItem))
          .filter(i => !i.deleted)
      );
    }, () => {});
    return unsub;
  }, []);

  // ── Salvar texto de um slot com debounce ───────────────────────
  const saveSlot = useCallback((slotKey: IntelSlotKey, text: string) => {
    const debounceKey = `${activeTool}:${slotKey}`;
    if (debounceRef.current[debounceKey]) clearTimeout(debounceRef.current[debounceKey]);
    debounceRef.current[debounceKey] = setTimeout(async () => {
      if (!currentUser) return;
      const sanitized = text.slice(0, 2000);
      const ref = doc(db, CollectionName.INTEL_TOOL_STATE, activeTool);
      await setDoc(ref, {
        toolId: activeTool,
        slots: { [slotKey]: sanitized },
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid,
      }, { merge: true });
    }, DEBOUNCE_MS);
  }, [activeTool, currentUser]);

  // ── Criar item ─────────────────────────────────────────────────
  const createItem = useCallback(async (
    text: string,
    slotKey: IntelSlotKey
  ): Promise<IntelItem | null> => {
    if (!currentUser) return null;
    const sanitized = text.trim().slice(0, 500);
    if (!sanitized) return null;
    const ref = await addDoc(collection(db, CollectionName.INTEL_ITEMS), {
      text: sanitized,
      toolId: activeTool,
      slotKey,
      deleted: false,
      createdBy: currentUser.uid,
      createdByName: userProfile?.displayName || 'Usuário',
      createdAt: serverTimestamp(),
    });
    return {
      id: ref.id,
      text: sanitized,
      toolId: activeTool,
      slotKey,
      deleted: false,
      createdBy: currentUser.uid,
      createdByName: userProfile?.displayName || '',
      createdAt: Timestamp.now(),
    };
  }, [currentUser, userProfile, activeTool]);

  // ── Atualizar texto de item ────────────────────────────────────
  const updateItem = useCallback(async (itemId: string, text: string) => {
    const sanitized = text.trim().slice(0, 500);
    await updateDoc(doc(db, CollectionName.INTEL_ITEMS, itemId), {
      text: sanitized,
      updatedAt: serverTimestamp(),
    });
  }, []);

  // ── Soft-delete de item (preserva backlinks) ───────────────────
  const deleteItem = useCallback(async (itemId: string) => {
    await updateDoc(doc(db, CollectionName.INTEL_ITEMS, itemId), {
      deleted: true,
      updatedAt: serverTimestamp(),
    });
  }, []);

  // ── Registrar link (evita duplicatas) ─────────────────────────
  const registerLink = useCallback(async (
    sourceItemId: string,
    sourceItemText: string,
    targetSlotKey: IntelSlotKey
  ) => {
    if (!currentUser) return;
    // Verificar duplicata
    const existing = await getDocs(query(
      collection(db, CollectionName.INTEL_LINKS),
      where('sourceItemId', '==', sourceItemId),
      where('targetToolId', '==', activeTool),
      where('targetSlotKey', '==', targetSlotKey),
    ));
    if (!existing.empty) return;
    await addDoc(collection(db, CollectionName.INTEL_LINKS), {
      sourceItemId,
      sourceItemText,
      targetToolId: activeTool,
      targetSlotKey,
      createdBy: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  }, [currentUser, activeTool]);

  // ── Buscar backlinks de um item ────────────────────────────────
  const getBacklinks = useCallback(async (itemId: string): Promise<IntelLink[]> => {
    const snap = await getDocs(query(
      collection(db, CollectionName.INTEL_LINKS),
      where('sourceItemId', '==', itemId)
    ));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as IntelLink));
  }, []);

  // ── Buscar item por texto exato (para resolver [[...]]) ────────
  const findItemByText = useCallback((text: string): IntelItem | undefined => {
    const lower = text.toLowerCase().trim();
    return allItems.find(i => i.text.toLowerCase() === lower && !i.deleted);
  }, [allItems]);

  return {
    toolState,
    loadingTool,
    allItems,
    saveSlot,
    createItem,
    updateItem,
    deleteItem,
    registerLink,
    getBacklinks,
    findItemByText,
  };
}

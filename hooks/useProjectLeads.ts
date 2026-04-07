/**
 * hooks/useProjectLeads.ts — Sprint Projetos v2
 *
 * Hook de gestão de leads capturados via formulário do site / anúncios.
 * Real-time listener + ações: contatar, converter, descartar.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, updateDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ProjectLead, LeadStatus, CollectionName } from '../types';
import { useProject } from './useProject';

export const useProjectLeads = () => {
  const { currentUser, userProfile } = useAuth();
  const { createFromLead } = useProject();
  const [leads, setLeads] = useState<ProjectLead[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Real-time listener ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.PROJECT_LEADS),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLeads(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectLead)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // ── Contagem de novos ──
  const leadsNovos = useMemo(() => leads.filter((l) => l.status === 'novo').length, [leads]);

  // ── Filtro por status ──
  const filterByStatus = useCallback(
    (status: LeadStatus) => leads.filter((l) => l.status === status),
    [leads],
  );

  // ── Marcar como contatado ──
  const marcarContatado = useCallback(
    async (leadId: string): Promise<void> => {
      if (!currentUser) return;
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        status: 'contatado',
        contatadoEm: serverTimestamp(),
        contatadoPor: currentUser.uid,
        contatadoPorNome: userProfile?.displayName || '',
      });
    },
    [currentUser, userProfile],
  );

  // ── Converter em projeto ──
  const converterEmProjeto = useCallback(
    async (leadId: string): Promise<string> => {
      return await createFromLead(leadId);
    },
    [createFromLead],
  );

  // ── Descartar ──
  const descartarLead = useCallback(
    async (leadId: string, motivo: string): Promise<void> => {
      if (!currentUser) return;
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        status: 'descartado',
        motivoDescarte: motivo,
        contatadoEm: serverTimestamp(),
        contatadoPor: currentUser.uid,
        contatadoPorNome: userProfile?.displayName || '',
      });
    },
    [currentUser, userProfile],
  );

  return {
    leads,
    loading,
    leadsNovos,
    filterByStatus,
    marcarContatado,
    converterEmProjeto,
    descartarLead,
  };
};

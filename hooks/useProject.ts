/**
 * hooks/useProject.ts — Sprint Projetos v2
 *
 * Hook principal do módulo de Projetos: ciclo de vida completo.
 * CRUD + máquina de estados + transições validadas + integração com leads.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp, arrayUnion, Timestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  ProjectV2, ProjectPhase, ProjectV2PhaseEntry, ProjectV2Prancheta,
  ProjectLead, CollectionName, PROJECT_TRANSITIONS, PROJECT_PHASE_LABELS,
} from '../types';

// ── Validações de requisitos por fase destino ──
const TRANSITION_REQUIREMENTS: Partial<
  Record<ProjectPhase, (p: ProjectV2) => { valid: boolean; message?: string }>
> = {
  em_cotacao: (p) => ({
    valid: !!p.prancheta?.preenchidoEm,
    message: 'Preencha a prancheta técnica antes de avançar para cotação.',
  }),
  proposta_enviada: (p) => ({
    valid: (p.cotacaoIds?.length ?? 0) > 0,
    message: 'Cadastre pelo menos uma cotação antes de montar a proposta.',
  }),
  contrato_enviado: (p) => ({
    valid: !!p.apresentacaoId,
    message: 'Crie a apresentação/proposta antes de enviar o contrato.',
  }),
  contrato_assinado: (p) => ({
    valid: !!p.contratoId,
    message: 'Gere o contrato antes de registrar a assinatura.',
  }),
  em_execucao: (p) => ({
    valid: (p.osIds?.length ?? 0) > 0,
    message: 'Distribua as O.S. antes de iniciar a execução.',
  }),
  em_faturamento: (p) => ({
    valid: !!p.relatorioFinalUrl,
    message: 'Gere o relatório final antes de ir para faturamento.',
  }),
  nao_aprovado: () => ({ valid: true }),
};

export const useProject = () => {
  const { currentUser, userProfile } = useAuth();
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Real-time listener ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.PROJECTS_V2),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProjectV2)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // ── Queries ──
  const getProject = useCallback(
    (id: string) => projects.find((p) => p.id === id),
    [projects],
  );

  const getProjectsByClient = useCallback(
    (clientId: string) => projects.filter((p) => p.clientId === clientId),
    [projects],
  );

  const getProjectsByPhase = useCallback(
    (fase: ProjectPhase) => projects.filter((p) => p.fase === fase),
    [projects],
  );

  // ── Contadores ──
  const phaseCounters = useMemo(() => {
    const counters: Partial<Record<ProjectPhase, number>> = {};
    projects.forEach((p) => {
      counters[p.fase] = (counters[p.fase] || 0) + 1;
    });
    return counters;
  }, [projects]);

  // ── CRUD ──
  const createProject = useCallback(
    async (data: Omit<ProjectV2, 'id' | 'createdAt' | 'faseHistorico'>): Promise<string> => {
      if (!currentUser) throw new Error('Não autenticado');
      const entry: ProjectV2PhaseEntry = {
        fase: data.fase,
        alteradoEm: Timestamp.now(),
        alteradoPor: currentUser.uid,
        alteradoPorNome: userProfile?.displayName || '',
        observacao: 'Projeto criado',
      };
      const docRef = await addDoc(collection(db, CollectionName.PROJECTS_V2), {
        ...data,
        faseHistorico: [entry],
        osIds: data.osIds || [],
        createdBy: currentUser.uid,
        createdByNome: userProfile?.displayName || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    [currentUser, userProfile],
  );

  const updateProject = useCallback(
    async (id: string, data: Partial<ProjectV2>): Promise<void> => {
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    [],
  );

  const deleteProject = useCallback(
    async (id: string): Promise<void> => {
      await deleteDoc(doc(db, CollectionName.PROJECTS_V2, id));
    },
    [],
  );

  // ── Transição de fase (máquina de estados validada) ──
  const advancePhase = useCallback(
    async (
      projectId: string,
      newPhase: ProjectPhase,
      observacao?: string,
    ): Promise<{ success: boolean; error?: string }> => {
      if (!currentUser) return { success: false, error: 'Não autenticado' };

      const project = projects.find((p) => p.id === projectId);
      if (!project) return { success: false, error: 'Projeto não encontrado' };

      // Validar transição permitida
      const allowed = PROJECT_TRANSITIONS[project.fase];
      if (!allowed.includes(newPhase)) {
        return {
          success: false,
          error: `Transição de "${PROJECT_PHASE_LABELS[project.fase]}" para "${PROJECT_PHASE_LABELS[newPhase]}" não é permitida.`,
        };
      }

      // Validar requisitos
      const validator = TRANSITION_REQUIREMENTS[newPhase];
      if (validator) {
        const result = validator(project);
        if (!result.valid) return { success: false, error: result.message };
      }

      // Executar
      const entry: ProjectV2PhaseEntry = {
        fase: newPhase,
        alteradoEm: Timestamp.now(),
        alteradoPor: currentUser.uid,
        alteradoPorNome: userProfile?.displayName || '',
        observacao,
      };

      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
        fase: newPhase,
        faseHistorico: arrayUnion(entry),
        updatedAt: serverTimestamp(),
      });

      return { success: true };
    },
    [currentUser, userProfile, projects],
  );

  // ── Criar projeto a partir de Lead ──
  const createFromLead = useCallback(
    async (leadId: string): Promise<string> => {
      if (!currentUser) throw new Error('Não autenticado');

      const leadSnap = await getDoc(doc(db, CollectionName.PROJECT_LEADS, leadId));
      if (!leadSnap.exists()) throw new Error('Lead não encontrado');
      const lead = { id: leadSnap.id, ...leadSnap.data() } as ProjectLead;

      const projectId = await createProject({
        nome: `Projeto ${lead.nomeContato}${lead.empresa ? ` – ${lead.empresa}` : ''}`,
        descricao: lead.observacoes || '',
        clientId: '',
        clientName: lead.empresa || lead.nomeContato,
        tipoProjetoSlug: lead.tipoProjetoSlug,
        fase: 'lead_capturado',
        leadData: {
          origem: lead.origem === 'formulario_site' ? 'formulario_site' : 'manual',
          nomeContato: lead.nomeContato,
          telefone: lead.telefone,
          email: lead.email,
          empresa: lead.empresa,
          tipoProjetoPedido: lead.tipoProjetoTexto || lead.tipoProjetoSlug,
          medidasAproximadas: lead.medidasAproximadas,
          finalidade: lead.finalidade,
          localizacao: lead.localizacao,
          observacoes: lead.observacoes,
          recebidoEm: lead.criadoEm,
          utmSource: lead.utmSource,
          utmMedium: lead.utmMedium,
          utmCampaign: lead.utmCampaign,
        },
        leadId: leadId,
        osIds: [],
        createdBy: currentUser.uid,
        createdByNome: userProfile?.displayName || '',
      } as any);

      // Atualiza lead como convertido
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        status: 'convertido',
        projectId,
        contatadoEm: serverTimestamp(),
        contatadoPor: currentUser.uid,
        contatadoPorNome: userProfile?.displayName || '',
      });

      return projectId;
    },
    [currentUser, userProfile, createProject],
  );

  // ── Salvar prancheta ──
  const savePrancheta = useCallback(
    async (projectId: string, data: ProjectV2Prancheta): Promise<void> => {
      if (!currentUser) return;
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
        prancheta: {
          ...data,
          preenchidoPor: currentUser.uid,
          preenchidoPorNome: userProfile?.displayName || '',
          preenchidoEm: Timestamp.now(),
        },
        updatedAt: serverTimestamp(),
      });
    },
    [currentUser, userProfile],
  );

  // ── Arquivar como não aprovado ──
  const archiveAsNaoAprovado = useCallback(
    async (
      projectId: string,
      motivoId: string,
      motivoTexto: string,
      detalhes?: string,
    ): Promise<void> => {
      if (!currentUser) return;
      const project = projects.find((p) => p.id === projectId);
      if (!project) return;

      const entry: ProjectV2PhaseEntry = {
        fase: 'nao_aprovado',
        alteradoEm: Timestamp.now(),
        alteradoPor: currentUser.uid,
        alteradoPorNome: userProfile?.displayName || '',
        observacao: `Motivo: ${motivoTexto}${detalhes ? ` — ${detalhes}` : ''}`,
      };

      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
        fase: 'nao_aprovado',
        naoAprovadoData: {
          motivoId,
          motivoTexto,
          detalhes: detalhes || '',
          faseParou: project.fase,
          arquivadoEm: Timestamp.now(),
          arquivadoPor: currentUser.uid,
          arquivadoPorNome: userProfile?.displayName || '',
          tentativasReabertura: [],
        },
        faseHistorico: arrayUnion(entry),
        updatedAt: serverTimestamp(),
      });
    },
    [currentUser, userProfile, projects],
  );

  // ── Reabrir projeto não aprovado ──
  const reopenProject = useCallback(
    async (projectId: string, novaAbordagem: string): Promise<void> => {
      if (!currentUser) return;
      const project = projects.find((p) => p.id === projectId);
      if (!project || project.fase !== 'nao_aprovado') return;

      const newTentativa = {
        data: Timestamp.now(),
        por: currentUser.uid,
        porNome: userProfile?.displayName || '',
        novaAbordagem,
      };

      const entry: ProjectV2PhaseEntry = {
        fase: 'em_levantamento',
        alteradoEm: Timestamp.now(),
        alteradoPor: currentUser.uid,
        alteradoPorNome: userProfile?.displayName || '',
        observacao: `Reaberto: ${novaAbordagem}`,
      };

      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
        fase: 'em_levantamento',
        'naoAprovadoData.tentativasReabertura': arrayUnion(newTentativa),
        faseHistorico: arrayUnion(entry),
        updatedAt: serverTimestamp(),
      });
    },
    [currentUser, userProfile, projects],
  );

  return {
    projects,
    loading,
    phaseCounters,
    getProject,
    getProjectsByClient,
    getProjectsByPhase,
    createProject,
    updateProject,
    deleteProject,
    advancePhase,
    createFromLead,
    savePrancheta,
    archiveAsNaoAprovado,
    reopenProject,
  };
};

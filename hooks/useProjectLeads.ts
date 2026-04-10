/**
 * hooks/useProjectLeads.ts — CRM Funil de Vendas (Fase 0)
 *
 * Hook de gestão de leads capturados + CRM interno.
 * Real-time listener + ações: contatar, mover no funil, notas, criar manual, converter, descartar.
 * Inclui useLeadsConfig: lê/escreve /configs/leads_config (e-mail de notificação).
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection, query, orderBy, onSnapshot, updateDoc,
  addDoc, doc, serverTimestamp, getDoc, setDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { ProjectLead, LeadStatus, LeadsConfig, CollectionName, NegotiationSubStatus, ProjectPhase } from '../types';
import { useProject } from './useProject';

const CONFIGS_DOC = 'leads_config';

// ── Sanitização básica ──────────────────────────────────────────────────────
const sanitize = (s: string, max = 500): string =>
  s.replace(/[<>]/g, '').replace(/javascript:/gi, '').trim().slice(0, max);

// ── Hook principal de leads ─────────────────────────────────────────────────
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
        ultimaAtividade: serverTimestamp(),
      });
    },
    [currentUser, userProfile],
  );

  // ── Atualizar status (mover no Kanban) ──
  const atualizarStatus = useCallback(
    async (leadId: string, novoStatus: LeadStatus): Promise<void> => {
      if (!currentUser) return;
      const update: Record<string, any> = {
        status: novoStatus,
        ultimaAtividade: serverTimestamp(),
        contatadoPor: currentUser.uid,
        contatadoPorNome: userProfile?.displayName || '',
      };
      if (novoStatus === 'contatado' || novoStatus === 'em_negociacao') {
        update.contatadoEm = serverTimestamp();
      }
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), update);
    },
    [currentUser, userProfile],
  );

  // ── Salvar nota interna ──
  const salvarNota = useCallback(
    async (leadId: string, nota: string): Promise<void> => {
      if (!currentUser) return;
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        notas: sanitize(nota, 1000),
        ultimaAtividade: serverTimestamp(),
      });
    },
    [currentUser],
  );

  // ── Adicionar lead manual (pelo painel interno) ──
  const adicionarLead = useCallback(
    async (dados: {
      nomeContato: string;
      telefone: string;
      email?: string;
      empresa?: string;
      tipoProjetoSlug: string;
      localizacao?: string;
      notas?: string;
    }): Promise<string> => {
      if (!currentUser) throw new Error('Não autenticado');
      const ref = await addDoc(collection(db, CollectionName.PROJECT_LEADS), {
        nomeContato: sanitize(dados.nomeContato, 199),
        telefone: sanitize(dados.telefone, 20),
        email: dados.email ? sanitize(dados.email, 200) : null,
        empresa: dados.empresa ? sanitize(dados.empresa, 200) : null,
        tipoProjetoSlug: dados.tipoProjetoSlug,
        localizacao: dados.localizacao ? sanitize(dados.localizacao, 200) : null,
        notas: dados.notas ? sanitize(dados.notas, 1000) : null,
        origem: 'manual' as const,          // fixo — nunca vem do form
        status: 'novo' as LeadStatus,
        criadoEm: serverTimestamp(),
        ultimaAtividade: serverTimestamp(),
        criadoPor: currentUser.uid,
        criadoPorNome: userProfile?.displayName || '',
      });
      return ref.id;
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
        motivoDescarte: sanitize(motivo, 500),
        ultimaAtividade: serverTimestamp(),
        contatadoPor: currentUser.uid,
        contatadoPorNome: userProfile?.displayName || '',
      });
    },
    [currentUser, userProfile],
  );

  // ── Atualizar sub-status de negociação ──
  // Quando 'aguardando_projeto': cria ProjectV2 vinculado (fase lead_capturado)
  // sem alterar o status do lead para 'convertido' — ele continua 'em_negociacao'
  const atualizarSubStatus = useCallback(
    async (leadId: string, subStatus: NegotiationSubStatus): Promise<void> => {
      if (!currentUser) return;

      // 1. Buscar o lead atual para verificar se já tem projeto vinculado
      const leadSnap = await getDoc(doc(db, CollectionName.PROJECT_LEADS, leadId));
      if (!leadSnap.exists()) return;
      const lead = { id: leadSnap.id, ...leadSnap.data() } as ProjectLead;

      let projectId = lead.projectId;

      // 2. Se selecionou 'aguardando_projeto' e ainda NÃO tem projeto vinculado → criar
      if (subStatus === 'aguardando_projeto' && !projectId) {
        const entry = {
          fase: 'lead_capturado' as ProjectPhase,
          alteradoEm: Timestamp.now(),
          alteradoPor: currentUser.uid,
          alteradoPorNome: userProfile?.displayName || '',
          observacao: 'Replicado da negociação para análise técnica (Prancheta)',
        };

        const docRef = await addDoc(collection(db, CollectionName.PROJECTS_V2), {
          nome: `Projeto ${lead.nomeContato}${lead.empresa ? ` – ${lead.empresa}` : ''}`,
          descricao: lead.observacoes || '',
          clientId: '',
          clientName: lead.empresa || lead.nomeContato,
          tipoProjetoSlug: lead.tipoProjetoSlug,
          fase: 'lead_capturado',
          leadId: leadId,
          leadData: {
            origem: lead.origem,
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
          osIds: [],
          faseHistorico: [entry],
          createdBy: currentUser.uid,
          createdByNome: userProfile?.displayName || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        projectId = docRef.id;

        // Vincular projectId ao lead (sem mudar status para 'convertido')
        await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
          projectId,
          negotiationSubStatus: subStatus,
          ultimaAtividade: serverTimestamp(),
        });
        return;
      }

      // 3. Para os demais sub-status: apenas atualizar o campo
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        negotiationSubStatus: subStatus,
        ultimaAtividade: serverTimestamp(),
      });
    },
    [currentUser, userProfile],
  );

  // ── Sinalizar proposta enviada ao cliente ──
  const sinalizarPropostaEnviada = useCallback(
    async (leadId: string): Promise<void> => {
      if (!currentUser) return;
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        propostaEnviadaEm: serverTimestamp(),
        propostaEnviadaPor: currentUser.uid,
        propostaEnviadaPorNome: userProfile?.displayName || '',
        ultimaAtividade: serverTimestamp(),
      });
    },
    [currentUser, userProfile],
  );

  // ── Marcar como Não Aprovado ──
  const marcarNaoAprovado = useCallback(
    async (leadId: string, motivo: string): Promise<void> => {
      if (!currentUser) return;
      await updateDoc(doc(db, CollectionName.PROJECT_LEADS, leadId), {
        status: 'nao_aprovado' as LeadStatus,
        motivoNaoAprovado: sanitize(motivo, 500),
        ultimaAtividade: serverTimestamp(),
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
    atualizarStatus,
    salvarNota,
    adicionarLead,
    converterEmProjeto,
    descartarLead,
    atualizarSubStatus,
    sinalizarPropostaEnviada,
    marcarNaoAprovado,
  };
};

// ── Hook de configuração de leads (/configs/leads_config) ──────────────────
export const useLeadsConfig = () => {
  const { currentUser } = useAuth();
  const [config, setConfig] = useState<LeadsConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ref = doc(db, 'configs', CONFIGS_DOC);
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) setConfig(snap.data() as LeadsConfig);
      })
      .finally(() => setConfigLoading(false));
  }, []);

  const salvarConfig = useCallback(
    async (emailNotificacao: string, notificacaoAtiva: boolean): Promise<void> => {
      if (!currentUser) return;
      // Validação básica de e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailNotificacao)) throw new Error('E-mail inválido');

      setSaving(true);
      try {
        const ref = doc(db, 'configs', CONFIGS_DOC);
        const data: Omit<LeadsConfig, 'atualizadoEm'> & { atualizadoEm: any } = {
          emailNotificacao: emailNotificacao.trim().toLowerCase(),
          notificacaoAtiva,
          atualizadoPor: currentUser.uid,
          atualizadoEm: serverTimestamp(),
        };
        await setDoc(ref, data, { merge: true });
        setConfig(data as unknown as LeadsConfig);
      } finally {
        setSaving(false);
      }
    },
    [currentUser],
  );

  return { config, configLoading, saving, salvarConfig };
};

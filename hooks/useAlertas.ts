/**
 * hooks/useAlertas.ts — Sprint 17
 *
 * Central de alertas operacionais em tempo real para gestores.
 * Agrega alertas de todos os módulos do sistema:
 *
 * 1. 🔴 CRÍTICOS (ação imediata)
 *    - Parcelas em atraso (project_faturamentos)
 *    - Técnico solicitando suporte humano (OS_SUPORTE_MSGS)
 *
 * 2. 🟡 ATENÇÃO (ação em breve)
 *    - Leads novos sem resposta há > 24h (project_leads)
 *    - Parcelas vencem em até 7 dias (project_faturamentos)
 *
 * 3. 🟠 OPERACIONAL (contexto)
 *    - Projetos parados na mesma fase há > 7 dias (projects_v2)
 *    - Projetos com faturamento pendente (projects_v2)
 */
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, ProjectFaturamento, ProjectLead } from '../types';
import { differenceInDays, differenceInHours } from 'date-fns';

export type AlertaSeveridade = 'critico' | 'atencao' | 'operacional';
export type AlertaCategoria =
  | 'parcela_vencida'
  | 'parcela_proxima'
  | 'lead_sem_resposta'
  | 'projeto_parado'
  | 'suporte_humano';

export interface Alerta {
  id: string;
  categoria: AlertaCategoria;
  severidade: AlertaSeveridade;
  titulo: string;
  descricao: string;
  link: string;             // rota de navegação
  projectId?: string;
  criadoEm?: Date;
}

export interface AlertasResult {
  alertas: Alerta[];
  total: number;
  criticos: number;
  atencao: number;
  operacional: number;
  loading: boolean;
}

const toDate = (ts: any): Date | null => {
  if (!ts) return null;
  try { return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000); }
  catch { return null; }
};

export const useAlertas = (): AlertasResult => {
  const [faturamentos, setFaturamentos] = useState<ProjectFaturamento[]>([]);
  const [leads, setLeads] = useState<ProjectLead[]>([]);
  const [projetos, setProjetos] = useState<any[]>([]);
  const [suporteCount, setSuporteCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadCount, setLoadCount] = useState(0);

  const incrementLoad = () => setLoadCount(c => c + 1);

  // ── Faturamentos (parcelas) ──
  useEffect(() => {
    const q = query(collection(db, CollectionName.PROJECT_FATURAMENTOS));
    return onSnapshot(q, snap => {
      setFaturamentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectFaturamento)));
      incrementLoad();
    }, () => incrementLoad());
  }, []);

  // ── Leads novos (sem resposta) ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.PROJECT_LEADS),
      where('status', '==', 'novo'),
      orderBy('criadoEm', 'desc'),
    );
    return onSnapshot(q, snap => {
      setLeads(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectLead)));
      incrementLoad();
    }, () => incrementLoad());
  }, []);

  // ── Projetos ativos ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.PROJECTS_V2),
      where('fase', 'not-in', ['concluido', 'nao_aprovado']),
    );
    return onSnapshot(q, snap => {
      setProjetos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      incrementLoad();
    }, () => incrementLoad());
  }, []);

  // ── Suporte humano pendente ──
  useEffect(() => {
    if (!CollectionName.OS_SUPORTE_MSGS) { incrementLoad(); return; }
    const q = query(
      collection(db, CollectionName.OS_SUPORTE_MSGS),
      where('leitoPorGestor', '==', false),
      where('solicitouHumano', '==', true),
    );
    return onSnapshot(q, snap => {
      setSuporteCount(snap.size);
      incrementLoad();
    }, () => incrementLoad());
  }, []);

  // Loading: aguarda os 4 listeners inicializarem
  useEffect(() => {
    if (loadCount >= 4) setLoading(false);
  }, [loadCount]);

  const hoje = new Date();

  const alertas = useMemo<Alerta[]>(() => {
    const list: Alerta[] = [];

    // ── 1. SUPORTE HUMANO ──
    if (suporteCount > 0) {
      list.push({
        id: 'suporte-humano',
        categoria: 'suporte_humano',
        severidade: 'critico',
        titulo: `${suporteCount} técnico${suporteCount > 1 ? 's' : ''} aguardando suporte`,
        descricao: 'Solicitação de atendimento humano no chat de OS',
        link: '/app/pipeline',
      });
    }

    // ── 2. PARCELAS VENCIDAS ──
    faturamentos.forEach(fat => {
      (fat.parcelas || []).forEach(p => {
        if (p.status !== 'atrasado') return;
        list.push({
          id: `vencida-${fat.id}-${p.id}`,
          categoria: 'parcela_vencida',
          severidade: 'critico',
          titulo: `Parcela vencida: ${fat.projectNome}`,
          descricao: `${fat.clientName} · Parcela ${p.numero} · R$ ${(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          link: `/app/projetos-v2/${fat.projectId}`,
          projectId: fat.projectId,
        });
      });
    });

    // ── 3. PARCELAS VENCEM EM 7 DIAS ──
    faturamentos.forEach(fat => {
      (fat.parcelas || []).forEach(p => {
        if (p.status !== 'pendente') return;
        const venc = toDate(p.dataVencimento);
        if (!venc) return;
        const dias = differenceInDays(venc, hoje);
        if (dias >= 0 && dias <= 7) {
          list.push({
            id: `proxima-${fat.id}-${p.id}`,
            categoria: 'parcela_proxima',
            severidade: 'atencao',
            titulo: `Parcela vence em ${dias === 0 ? 'hoje' : `${dias}d`}: ${fat.projectNome}`,
            descricao: `${fat.clientName} · Parcela ${p.numero} · R$ ${(p.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            link: `/app/projetos-v2/${fat.projectId}`,
            projectId: fat.projectId,
          });
        }
      });
    });

    // ── 4. LEADS SEM RESPOSTA > 24H ──
    leads.forEach(lead => {
      const criado = toDate((lead as any).criadoEm);
      if (!criado) return;
      const horas = differenceInHours(hoje, criado);
      if (horas > 24) {
        list.push({
          id: `lead-${lead.id}`,
          categoria: 'lead_sem_resposta',
          severidade: 'atencao',
          titulo: `Lead sem resposta há ${Math.floor(horas / 24)}d: ${(lead as any).nomeContato || 'Lead'}`,
          descricao: `${(lead as any).empresa || ''} · ${(lead as any).telefone || ''}`,
          link: '/app/projetos-v2',
          criadoEm: criado,
        });
      }
    });

    // ── 5. PROJETOS PARADOS > 7 DIAS ──
    projetos.forEach(p => {
      const ult = toDate(p.atualizadoEm || p.updatedAt || p.createdAt);
      if (!ult) return;
      const dias = differenceInDays(hoje, ult);
      const IGNORAR = ['lead_capturado', 'concluido', 'nao_aprovado'];
      if (dias > 7 && !IGNORAR.includes(p.fase)) {
        list.push({
          id: `parado-${p.id}`,
          categoria: 'projeto_parado',
          severidade: 'operacional',
          titulo: `Projeto parado há ${dias}d: ${p.nome}`,
          descricao: `${p.clientName} · Fase: ${p.fase?.replace(/_/g, ' ')}`,
          link: `/app/projetos-v2/${p.id}`,
          projectId: p.id,
        });
      }
    });

    // Ordenar: crítico → atenção → operacional
    const ord: Record<AlertaSeveridade, number> = { critico: 0, atencao: 1, operacional: 2 };
    return list.sort((a, b) => ord[a.severidade] - ord[b.severidade]);
  }, [faturamentos, leads, projetos, suporteCount]);

  const criticos     = alertas.filter(a => a.severidade === 'critico').length;
  const atencao      = alertas.filter(a => a.severidade === 'atencao').length;
  const operacional  = alertas.filter(a => a.severidade === 'operacional').length;

  return { alertas, total: alertas.length, criticos, atencao, operacional, loading };
};

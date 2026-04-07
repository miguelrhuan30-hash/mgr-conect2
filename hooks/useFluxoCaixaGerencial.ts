/**
 * hooks/useFluxoCaixaGerencial.ts — Sprint 15
 *
 * Listener em tempo real de TODOS os faturamentos do sistema.
 * Agrega KPIs globais e timeline de parcelas por mês.
 *
 * Retorna:
 *  - kpis: { totalContratado, totalRecebido, totalPendente, totalAtrasado, percentualRecebido }
 *  - timeline: array de { mesLabel, pago, pendente, atrasado } (últimos 12 meses + próximos 3)
 *  - vencidas: parcelas em atraso, enriquecidas com projectNome e clientName
 *  - proximasVencer: parcelas pendentes com vencimento nos próximos 14 dias
 */
import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { ProjectFaturamento, FaturamentoParcela, CollectionName } from '../types';
import {
  format, startOfMonth, endOfMonth, addMonths, subMonths,
  isWithinInterval, differenceInDays,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ParcelaEnriquecida extends FaturamentoParcela {
  projectId: string;
  projectNome: string;
  clientId: string;
  clientName: string;
  faturamentoId: string;
}

export interface FluxoMes {
  mesLabel: string;      // "Jan 2026"
  mesKey: string;        // "2026-01"
  pago: number;
  pendente: number;
  atrasado: number;
  total: number;
}

export interface FluxoCaixaKPIs {
  totalContratado: number;
  totalRecebido: number;
  totalPendente: number;
  totalAtrasado: number;
  percentualRecebido: number;
  quantidadeVencidas: number;
  quantidadeProximasVencer: number;
}

export const useFluxoCaixaGerencial = () => {
  const [faturamentos, setFaturamentos] = useState<ProjectFaturamento[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Listener RT: todos os faturamentos ──
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.PROJECT_FATURAMENTOS),
      orderBy('criadoEm', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setFaturamentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProjectFaturamento)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return () => unsub();
  }, []);

  // ── Agregação ──
  const { kpis, timeline, vencidas, proximasVencer } = useMemo(() => {
    const hoje = new Date();

    // Flatten de todas as parcelas enriquecidas
    const todasParcelas: ParcelaEnriquecida[] = faturamentos.flatMap(fat =>
      (fat.parcelas || []).map(p => ({
        ...p,
        projectId: fat.projectId,
        projectNome: fat.projectNome,
        clientId: fat.clientId,
        clientName: fat.clientName,
        faturamentoId: fat.id,
      })),
    );

    // KPIs globais
    const totalContratado = faturamentos.reduce((s, f) => s + (f.valorTotal || 0), 0);
    const totalRecebido   = faturamentos.reduce((s, f) => s + (f.totalPago || 0), 0);
    const totalPendente   = faturamentos.reduce((s, f) => s + (f.totalPendente || 0), 0);
    const totalAtrasado   = faturamentos.reduce((s, f) => s + (f.totalAtrasado || 0), 0);
    const percentualRecebido = totalContratado > 0
      ? Math.round((totalRecebido / totalContratado) * 100)
      : 0;

    // Parcelas vencidas (status = atrasado)
    const vencidas = todasParcelas.filter(p => p.status === 'atrasado');

    // Próximas a vencer (pendente, vencimento em até 14 dias)
    const proximasVencer = todasParcelas.filter(p => {
      if (p.status !== 'pendente') return false;
      try {
        const venc = p.dataVencimento?.toDate ? p.dataVencimento.toDate() : new Date((p.dataVencimento as any).seconds * 1000);
        const dias = differenceInDays(venc, hoje);
        return dias >= 0 && dias <= 14;
      } catch { return false; }
    });

    // Timeline: 6 meses passados + mês atual + 5 futuros = 12 janelas
    const MESES_PASSADOS = 6;
    const MESES_FUTUROS  = 5;
    const timeline: FluxoMes[] = [];

    for (let i = -MESES_PASSADOS; i <= MESES_FUTUROS; i++) {
      const refDate  = addMonths(hoje, i);
      const inicio   = startOfMonth(refDate);
      const fim      = endOfMonth(refDate);
      const mesKey   = format(refDate, 'yyyy-MM');
      const mesLabel = format(refDate, 'MMM yy', { locale: ptBR });

      let pago = 0, pendente = 0, atrasado = 0;

      for (const p of todasParcelas) {
        try {
          const venc = p.dataVencimento?.toDate
            ? p.dataVencimento.toDate()
            : new Date((p.dataVencimento as any).seconds * 1000);

          // Parcelas pagas: usar dataPagamento se disponível, senão vencimento
          if (p.status === 'pago') {
            const dataPag = p.dataPagamento?.toDate
              ? p.dataPagamento.toDate()
              : venc;
            if (isWithinInterval(dataPag, { start: inicio, end: fim })) {
              pago += p.valor || 0;
            }
          } else if (isWithinInterval(venc, { start: inicio, end: fim })) {
            if (p.status === 'atrasado') atrasado += p.valor || 0;
            else pendente += p.valor || 0;
          }
        } catch { /* ts inválido */ }
      }

      timeline.push({ mesKey, mesLabel, pago, pendente, atrasado, total: pago + pendente + atrasado });
    }

    const kpis: FluxoCaixaKPIs = {
      totalContratado, totalRecebido, totalPendente, totalAtrasado,
      percentualRecebido,
      quantidadeVencidas: vencidas.length,
      quantidadeProximasVencer: proximasVencer.length,
    };

    return { kpis, timeline, vencidas, proximasVencer };
  }, [faturamentos]);

  return { loading, kpis, timeline, vencidas, proximasVencer, faturamentos };
};

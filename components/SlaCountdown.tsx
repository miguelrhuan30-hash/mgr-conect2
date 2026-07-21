/**
 * SlaCountdown — cronômetro regressivo ao vivo (tick 1s) pro prazo de
 * atendimento SLA. Reaproveitável em cards de chamado (Portal, painel do
 * gestor, FieldApp) e na tela de detalhe da O.S. pro técnico.
 *
 * Mesmo padrão de setInterval+cleanup já usado em FieldApp/FieldPonto.tsx
 * pros timers de ponto/almoço. Cores por prioridade reaproveitadas de
 * services/osService.ts (SLA_COR_PRIORIDADE).
 */
import React, { useEffect, useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Clock, AlertTriangle } from 'lucide-react';
import { SLA_COR_PRIORIDADE } from '../services/osService';
import type { PrioridadeSLA } from '../types';

interface SlaCountdownProps {
  prazoSlaLimite?: Timestamp | null;
  prioridade?: PrioridadeSLA;
  variant?: 'light' | 'dark';
  compact?: boolean;
}

function formatarRestante(ms: number): string {
  const abs = Math.abs(ms);
  const horas = Math.floor(abs / 3_600_000);
  const minutos = Math.floor((abs % 3_600_000) / 60_000);
  const segundos = Math.floor((abs % 60_000) / 1_000);
  const p = (n: number) => String(n).padStart(2, '0');
  return horas > 0 ? `${horas}h ${p(minutos)}m ${p(segundos)}s` : `${p(minutos)}m ${p(segundos)}s`;
}

export default function SlaCountdown({ prazoSlaLimite, prioridade, variant = 'light', compact }: SlaCountdownProps) {
  const [agora, setAgora] = useState<number | null>(prazoSlaLimite ? Date.now() : null);

  useEffect(() => {
    if (!prazoSlaLimite) return;
    setAgora(Date.now());
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [prazoSlaLimite]);

  if (!prazoSlaLimite || agora === null) return null;

  const limite = prazoSlaLimite.toDate().getTime();
  const diff = limite - agora;
  const vencido = diff < 0;
  const restante = formatarRestante(diff);
  const corPrioridade = prioridade ? SLA_COR_PRIORIDADE[prioridade] : SLA_COR_PRIORIDADE.P4;

  const corBase = vencido
    ? (variant === 'dark' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-red-600 text-white border-red-700')
    : (variant === 'dark' ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' : corPrioridade);

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold ${corBase}`}>
      {vencido ? <AlertTriangle size={compact ? 11 : 13} /> : <Clock size={compact ? 11 : 13} />}
      {!compact && prioridade && <span>{prioridade} ·</span>}
      <span>{vencido ? 'vencido há' : 'vence em'} {restante}</span>
    </div>
  );
}

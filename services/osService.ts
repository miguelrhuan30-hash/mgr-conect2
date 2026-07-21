import { db } from '../firebase';
import {
  doc, runTransaction, collection,
  addDoc, serverTimestamp
} from 'firebase/firestore';
import { format } from 'date-fns';
import { WorkflowStatus, OSStatusFinal, Task } from '../types';

/**
 * Deriva a origem da O.S. (avulsa | projeto | contrato_sla) sem exigir
 * migração de dados: usa `tipoOrigemOS` se persistido (prepara terreno para
 * o futuro fluxo de contrato SLA), senão infere pela presença de `projectId`.
 */
export function getTipoOrigemOS(task: Pick<Task, 'tipoOrigemOS' | 'projectId'>): 'avulsa' | 'projeto' | 'contrato_sla' {
  if (task.tipoOrigemOS) return task.tipoOrigemOS;
  return task.projectId ? 'projeto' : 'avulsa';
}

export interface SlaBadgeInfo { label: string; vencido: boolean; cor: string; }

/** Deduz o tipo de anexo (OSArquivoApoio) a partir da extensão do arquivo. */
export function tipoArquivoFromName(nome: string): 'pdf' | 'imagem' | 'video' | 'outro' {
  const ext = nome.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'imagem';
  if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
  return 'outro';
}

export const SLA_COR_PRIORIDADE: Record<string, string> = {
  P1: 'bg-red-100 text-red-700 border-red-200',
  P2: 'bg-orange-100 text-orange-700 border-orange-200',
  P3: 'bg-amber-100 text-amber-700 border-amber-200',
  P4: 'bg-gray-100 text-gray-600 border-gray-200',
};

/**
 * Badge de prazo de atendimento SLA (calculado no cliente, só exibição —
 * sem escalonamento/notificação automática nesta fase).
 */
export function getSlaBadgeInfo(task: Pick<Task, 'prioridadeSla' | 'prazoSlaLimite'>): SlaBadgeInfo | null {
  if (!task.prioridadeSla || !task.prazoSlaLimite) return null;
  const raw = task.prazoSlaLimite as any;
  const limite: Date = raw.toDate ? raw.toDate() : new Date(raw.seconds * 1000);
  const diffMin = Math.round((limite.getTime() - Date.now()) / 60000);
  const vencido = diffMin < 0;
  const abs = Math.abs(diffMin);
  const horas = Math.floor(abs / 60);
  const minutos = abs % 60;
  const tempo = horas > 0 ? `${horas}h${minutos > 0 ? minutos + 'min' : ''}` : `${minutos}min`;
  return {
    label: `${task.prioridadeSla} · ${vencido ? 'vencido há' : 'vence em'} ${tempo}`,
    vencido,
    cor: vencido ? 'bg-red-600 text-white border-red-700' : (SLA_COR_PRIORIDADE[task.prioridadeSla] || SLA_COR_PRIORIDADE.P4),
  };
}

// ─── Normalização de statusOS (legado lowercase → UPPERCASE) ───
const STATUS_MIGRATION_MAP: Record<string, OSStatusFinal> = {
  'concluida':                  'CONCLUIDA',
  'reagendar':                  'REAGENDAR',
  'pendente_administrativo':    'PENDENTE_ADMIN',
  'em_revisao_tecnica':         'EM_REVISAO_TECNICA',
  'concluida_nova_os_sugerida': 'CONCLUIDA_NOVA_OS_SUGERIDA',
};

/**
 * Normaliza statusOS de formato legado (lowercase) para UPPERCASE.
 * Valores já em UPPERCASE passam direto.
 */
export function normalizeStatusOS(raw?: string): OSStatusFinal | undefined {
  if (!raw) return undefined;
  return STATUS_MIGRATION_MAP[raw] ?? (raw as OSStatusFinal);
}

/**
 * Gera número de OS sequencial e atômico via transação Firestore.
 * Garante unicidade mesmo com dois usuários clicando simultaneamente.
 * Coleção auxiliar: os_counters/{anoMes}
 */
export const gerarNumeroOS = async (): Promise<string> => {
  const anoMes = format(new Date(), 'yyyy-MM');
  const counterRef = doc(db, 'os_counters', anoMes);

  return await runTransaction(db, async (transaction) => {
    const counter = await transaction.get(counterRef);
    const ultimo = counter.exists() ? (counter.data().ultimoNumero as number) : 0;
    const proximo = ultimo + 1;

    transaction.set(counterRef, {
      ultimoNumero: proximo,
      mesAno: anoMes,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    return `MGR-${anoMes}-${String(proximo).padStart(3, '0')}`;
  });
};

/**
 * Cria OS com apenas o número (Gerador Rápido — F1).
 * Retorna o ID do documento criado.
 */
export const criarOSRapida = async (params?: {
  clienteId?: string;
  clienteNome?: string;
  tecnicoId?: string;
  tecnicoNome?: string;
}): Promise<{ osId: string; numeroOS: string }> => {
  const numeroOS = await gerarNumeroOS();

  const osRef = collection(db, 'tasks');
  const docRef = await addDoc(osRef, {
    numeroOS,
    title: numeroOS,
    description: '',
    checklist: [],
    priority: 'medium',
    status: 'pending',
    criadaEm: serverTimestamp(),
    createdAt: serverTimestamp(),
    fonteAbertura: 'GERADOR_RAPIDO',
    statusOS: 'NUMERO_GERADO',
    dadosCompletos: false,
    workflowStatus: WorkflowStatus.AGUARDANDO_APROVACAO,
    ...(params?.clienteId   && { clientId:     params.clienteId   }),
    ...(params?.clienteNome && { clientName:   params.clienteNome }),
    ...(params?.tecnicoId   && { assignedTo:   params.tecnicoId   }),
    ...(params?.tecnicoNome && { assigneeName: params.tecnicoNome }),
  });

  return { osId: docRef.id, numeroOS };
};

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

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName } from '../types';

// ─── Labels para exibição ─────────────────────────────────────────────────────
export const TIPO_LABELS: Record<string, string> = {
  entry: 'Entrada',
  lunch_start: 'Ida Almoço',
  lunch_end: 'Volta Almoço',
  exit: 'Saída',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna início e fim do dia para um Date ou string "YYYY-MM-DD" */
export function getDayBounds(dateOrStr: Date | string): { inicio: Date; fim: Date } {
  const dia =
    typeof dateOrStr === 'string'
      ? dateOrStr
      : `${dateOrStr.getFullYear()}-${String(dateOrStr.getMonth() + 1).padStart(2, '0')}-${String(dateOrStr.getDate()).padStart(2, '0')}`;
  return {
    inicio: new Date(dia + 'T00:00:00'),
    fim: new Date(dia + 'T23:59:59.999'),
  };
}

/**
 * Wrapper de retry com backoff exponencial para contornar o bug
 * "FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state" do SDK v10
 * que ocorre em escritas sequenciais rápidas.
 *
 * Causa raiz: serverTimestamp() em múltiplas escritas seguidas coloca o SDK
 * em estado interno inválido. A solução é:
 *  1. Usar Timestamp.now() em vez de serverTimestamp()
 *  2. Tentar novamente com backoff se o erro persistir
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delayMs = 250): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const isAssertionError =
        typeof err?.message === 'string' && (
          err.message.includes('INTERNAL ASSERTION FAILED') ||
          err.message.includes('Unexpected state')
        );

      if (isAssertionError && attempt < retries) {
        // Backoff exponencial: 250ms → 500ms → 1000ms
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  // Nunca chega aqui, mas satisfaz o tipo
  throw new Error('Falha após múltiplas tentativas no Firestore.');
}

// ─── Adicionar registro faltante ──────────────────────────────────────────────
/**
 * Adiciona um TIME_ENTRY manual para um dia passado.
 */
export const adicionarRegistro = async (
  userId: string,
  tipo: 'entry' | 'lunch_start' | 'lunch_end' | 'exit',
  timestampManual: Date,
  adminId: string,
  adminNome: string,
  motivo: string,
): Promise<void> => {
  await withRetry(() =>
    addDoc(collection(db, CollectionName.TIME_ENTRIES), {
      userId,
      type: tipo,
      timestamp: Timestamp.fromDate(timestampManual),
      locationId: 'manual_admin',
      locationName: 'Correção manual pelo gestor',
      isManual: true,
      editedBy: adminId,
      editedByNome: adminNome,
      editReason: motivo,
      // Timestamp.now() usada para evitar conflito de estado do SDK (bug Firestore v10)
      editTimestamp: Timestamp.now(),
      biometricVerified: false,
      processingStatus: 'skipped_manual',
      photoURL: null,
      aiValidation: null,
    })
  );
};

// ─── Editar horário de registro existente ─────────────────────────────────────
/**
 * Atualiza apenas o timestamp de um TIME_ENTRY existente.
 * Não cria duplicatas — edita o documento diretamente por ID.
 */
export const editarHorarioRegistro = async (
  docId: string,
  novoTimestamp: Date,
  adminId: string,
  adminNome: string,
  motivo: string,
): Promise<void> => {
  await withRetry(() =>
    updateDoc(doc(db, CollectionName.TIME_ENTRIES, docId), {
      timestamp: Timestamp.fromDate(novoTimestamp),
      isManual: true,
      editedBy: adminId,
      editedByNome: adminNome,
      editReason: motivo,
      // Timestamp.now() usada para evitar conflito de estado do SDK (bug Firestore v10)
      editTimestamp: Timestamp.now(),
    })
  );
};

// ─── Soft delete ──────────────────────────────────────────────────────────────
/**
 * Marca um TIME_ENTRY como excluído sem deletar fisicamente o documento.
 * Preserva auditoria; o calcularTurnos() filtra registros com excluido === true.
 */
export const excluirRegistro = async (
  docId: string,
  adminId: string,
  adminNome: string,
): Promise<void> => {
  await withRetry(() =>
    updateDoc(doc(db, CollectionName.TIME_ENTRIES, docId), {
      excluido: true,
      excluidoPor: adminId,
      excluidoPorNome: adminNome,
      excluidoEm: Timestamp.now(),
    })
  );
};

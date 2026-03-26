import {
  collection,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
  serverTimestamp,
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

// ─── Adicionar registro faltante ──────────────────────────────────────────────
/**
 * Adiciona um TIME_ENTRY manual para um dia passado.
 * Lança erro se já existir um registro do mesmo tipo no mesmo dia (evita duplicata).
 */
export const adicionarRegistro = async (
  userId: string,
  tipo: 'entry' | 'lunch_start' | 'lunch_end' | 'exit',
  timestampManual: Date,
  adminId: string,
  adminNome: string,
  motivo: string,
): Promise<void> => {
  await addDoc(collection(db, CollectionName.TIME_ENTRIES), {
    userId,
    type: tipo,
    timestamp: Timestamp.fromDate(timestampManual),
    locationId: 'manual_admin',
    locationName: 'Correção manual pelo gestor',
    isManual: true,
    editedBy: adminId,
    editedByNome: adminNome,
    editReason: motivo,
    editTimestamp: serverTimestamp(),
    biometricVerified: false,
    photoURL: null,
  });
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
  await updateDoc(doc(db, CollectionName.TIME_ENTRIES, docId), {
    timestamp: Timestamp.fromDate(novoTimestamp),
    isManual: true,
    editedBy: adminId,
    editedByNome: adminNome,
    editReason: motivo,
    editTimestamp: serverTimestamp(),
  });
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
  await updateDoc(doc(db, CollectionName.TIME_ENTRIES, docId), {
    excluido: true,
    excluidoPor: adminId,
    excluidoPorNome: adminNome,
    excluidoEm: serverTimestamp(),
  });
};

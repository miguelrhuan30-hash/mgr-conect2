// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Serviço de progresso do colaborador (Fase 2)
// Cria/atualiza o doc academy_progress/{userId}_{moduleId} conforme o
// colaborador lê PDF, assiste vídeo e abre o infográfico.
// ═══════════════════════════════════════════════════════════════════════════
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { CollectionName, AcademyModule, AcademyProgress } from '../../types';

export const progressId = (userId: string, moduleId: string) => `${userId}_${moduleId}`;

/** Quais etapas de CONTEÚDO existem neste módulo (prova é separada). */
export function contentSteps(m: AcademyModule): ('pdf' | 'video' | 'infographic')[] {
  const steps: ('pdf' | 'video' | 'infographic')[] = [];
  if (m.pdfUrl) steps.push('pdf');
  if (m.videoUrl) steps.push('video');
  if (m.infographicUrl) steps.push('infographic');
  return steps;
}

/** % de conteúdo concluído (0..100) a partir do progresso. */
export function computeContentPercent(m: AcademyModule, p: AcademyProgress): number {
  const steps = contentSteps(m);
  if (steps.length === 0) return 100;
  const done = steps.filter(s => p[s].completed).length;
  return Math.round((done / steps.length) * 100);
}

/** Cria o doc de progresso se não existir e retorna o estado atual. */
export async function ensureProgress(userId: string, m: AcademyModule): Promise<AcademyProgress> {
  const id = progressId(userId, m.id);
  const ref = doc(db, CollectionName.ACADEMY_PROGRESS, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id, ...snap.data() } as AcademyProgress;

  const fresh: Omit<AcademyProgress, 'id'> = {
    userId,
    moduleId: m.id,
    pdf: { completed: false, pagesRead: [], totalPages: m.pdfTotalPages || 0 },
    video: { completed: false, watchedRatio: 0 },
    infographic: { completed: false, scrolledEnd: false, secondsViewed: 0 },
    contentPercent: 0,
    examUnlocked: contentSteps(m).length === 0,
    badge: null,
    examBlocked: false,
    attemptsCount: 0,
  };
  await setDoc(ref, { ...fresh, atualizadoEm: serverTimestamp() });
  return { id, ...fresh } as AcademyProgress;
}

/** Aplica um patch de progresso de conteúdo e recalcula contentPercent/examUnlocked. */
export async function patchContentProgress(
  m: AcademyModule,
  current: AcademyProgress,
  patch: Partial<Pick<AcademyProgress, 'pdf' | 'video' | 'infographic'>>,
): Promise<AcademyProgress> {
  const merged: AcademyProgress = { ...current, ...patch } as AcademyProgress;
  const contentPercent = computeContentPercent(m, merged);
  const examUnlocked = contentPercent === 100;
  merged.contentPercent = contentPercent;
  merged.examUnlocked = examUnlocked;

  await updateDoc(doc(db, CollectionName.ACADEMY_PROGRESS, current.id), {
    ...patch,
    contentPercent,
    examUnlocked,
    atualizadoEm: serverTimestamp(),
  } as any);
  return merged;
}

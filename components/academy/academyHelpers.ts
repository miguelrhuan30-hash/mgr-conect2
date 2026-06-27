// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Helpers compartilhados (badges, prontidão, upload, factories)
// ═══════════════════════════════════════════════════════════════════════════
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '../../firebase';
import {
  AcademyModule,
  AcademyBadgeTier,
  AcademyReadiness,
  AcademyExamConfig,
} from '../../types';

// ── Badges Bronze / Prata / Ouro (POR MÓDULO, pelo % de acertos da prova) ──
export const BADGE_TIERS: Record<AcademyBadgeTier, {
  label: string;
  emoji: string;
  min: number;          // % mínimo (inclusive)
  max: number;          // % máximo (inclusive)
  classes: string;      // tailwind p/ chips
}> = {
  bronze: { label: 'Bronze', emoji: '🥉', min: 50, max: 70,  classes: 'bg-amber-50 border-amber-300 text-amber-800' },
  silver: { label: 'Prata',  emoji: '🥈', min: 70, max: 90,  classes: 'bg-zinc-100 border-zinc-400 text-zinc-700' },
  gold:   { label: 'Ouro',   emoji: '🥇', min: 90, max: 100, classes: 'bg-yellow-50 border-yellow-400 text-yellow-800' },
};

/** Converte um % de acertos no badge correspondente (null se reprovado). */
export function tierFromScore(percent: number, passingScore = 50): AcademyBadgeTier | null {
  if (percent < passingScore) return null;
  if (percent >= 90) return 'gold';
  if (percent >= 70) return 'silver';
  if (percent >= 50) return 'bronze';
  return null;
}

// ── Config padrão de prova ──
export const DEFAULT_EXAM: AcademyExamConfig = {
  enabled: true,
  durationMinutes: 30,
  questionsPerExam: 10,
  shuffleOptions: true,
  rulesText:
    'Você terá um tempo limitado para concluir a prova.\n' +
    'Ao iniciar, o cronômetro não para — mesmo que você feche ou recarregue a página.\n' +
    'Se você sair desta tela, a prova será encerrada com as respostas que tiver dado até o momento.\n' +
    'Você não poderá refazer a prova até que o administrador libere uma nova tentativa.',
};

/** Cria um módulo em branco (rascunho) pronto para salvar. */
export function emptyModule(userId: string, order: number): Omit<AcademyModule, 'id'> {
  return {
    title: '',
    description: '',
    order,
    status: 'draft',
    sequential: true,
    freeNavigation: false,
    exam: { ...DEFAULT_EXAM },
    passingScore: 50,
    xpReward: 100,
    version: 1,
    readiness: { pdf: false, video: false, infographic: false, exam: false },
    criadoPor: userId,
    criadoEm: Timestamp.now(),
  };
}

/** Recalcula a prontidão de um módulo a partir do conteúdo + nº de questões. */
export function computeReadiness(m: Partial<AcademyModule>, questionCount: number): AcademyReadiness {
  const perExam = m.exam?.questionsPerExam ?? 0;
  return {
    pdf: !!m.pdfUrl,
    video: !!m.videoUrl,
    infographic: !!m.infographicUrl,
    exam: m.exam?.enabled ? questionCount >= perExam && perExam > 0 : true,
  };
}

/** % de prontidão (para barra na lista do adm). */
export function readinessPercent(r: AcademyReadiness): number {
  const flags = [r.pdf, r.video, r.infographic, r.exam];
  return Math.round((flags.filter(Boolean).length / flags.length) * 100);
}

// ── Upload de arquivo para o Storage com progresso ──
export interface UploadHandle {
  promise: Promise<{ url: string; path: string }>;
  cancel: () => void;
}

/**
 * Sobe um arquivo para `academy/{moduleId}/{slot}.<ext>` reportando progresso.
 * Retorna a URL pública e o path (para exclusão futura).
 */
export function uploadAcademyFile(
  moduleId: string,
  slot: 'conteudo' | 'video' | 'infografico' | 'capa',
  file: File,
  onProgress?: (pct: number) => void,
): UploadHandle {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `academy/${moduleId}/${slot}.${ext}`;
  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

  const promise = new Promise<{ url: string; path: string }>((resolve, reject) => {
    task.on(
      'state_changed',
      (snap) => {
        const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path });
      },
    );
  });

  return { promise, cancel: () => task.cancel() };
}

/** Sobe um comprovante de curso externo para `academy/external/{userId}/{ts}.<ext>`. */
export async function uploadExternalProof(userId: string, file: File, onProgress?: (pct: number) => void): Promise<{ url: string; path: string }> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40);
  const path = `academy/external/${userId}/${safe}.${ext}`;
  const task = uploadBytesResumable(ref(storage, path), file, { contentType: file.type });
  return new Promise((resolve, reject) => {
    task.on('state_changed',
      snap => onProgress?.(snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0),
      reject,
      async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path }),
    );
  });
}

/** Remove um arquivo do Storage (silencioso se já não existir). */
export async function deleteAcademyFile(path?: string): Promise<void> {
  if (!path) return;
  try {
    await deleteObject(ref(storage, path));
  } catch {
    /* ignora — arquivo pode já ter sido removido */
  }
}

// ── Detecção / normalização de URL de vídeo (YouTube / Vimeo / link) ──
export function detectVideoSource(url: string): AcademyModule['videoSource'] {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/vimeo\.com/i.test(url)) return 'vimeo';
  return 'link';
}

/** Converte uma URL de vídeo em URL embutível (iframe) quando aplicável. */
export function toEmbedUrl(url: string): string {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

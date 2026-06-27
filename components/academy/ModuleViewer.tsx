// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Leitor do Módulo (colaborador) — Fase 2 + entrada da prova
// Rastreia leitura do PDF (página a página), vídeo (anti-seek) e infográfico
// (scroll + tempo). Avança o % e destrava a prova ao concluir o conteúdo.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ref as storageRef, getBytes } from 'firebase/storage';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  ArrowLeft, FileText, Video, Image as ImageIcon, ClipboardList, CheckCircle2,
  Lock, ChevronLeft, ChevronRight, Loader2, Clock, Award, PlayCircle, Trophy,
} from 'lucide-react';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CollectionName, AcademyModule, AcademyProgress } from '../../types';
import { toEmbedUrl, BADGE_TIERS } from './academyHelpers';
import {
  ensureProgress, patchContentProgress, contentSteps, progressId,
} from './academyProgress';
import ExamRunner from './ExamRunner';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

type Step = 'pdf' | 'video' | 'infographic' | 'exam';

const ModuleViewer: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [module, setModule] = useState<AcademyModule | null>(null);
  const [progress, setProgress] = useState<AcademyProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('pdf');
  const [examOpen, setExamOpen] = useState(false);

  // Carrega módulo
  useEffect(() => {
    if (!moduleId) return;
    return onSnapshot(doc(db, CollectionName.ACADEMY_MODULES, moduleId), snap => {
      if (snap.exists()) setModule({ id: snap.id, ...snap.data() } as AcademyModule);
      setLoading(false);
    }, () => setLoading(false));
  }, [moduleId]);

  // Garante e assina o progresso
  useEffect(() => {
    if (!currentUser || !module) return;
    let unsub = () => {};
    ensureProgress(currentUser.uid, module).then(() => {
      unsub = onSnapshot(doc(db, CollectionName.ACADEMY_PROGRESS, progressId(currentUser.uid, module.id)), snap => {
        if (snap.exists()) setProgress({ id: snap.id, ...snap.data() } as AcademyProgress);
      });
    });
    return () => unsub();
  }, [currentUser, module]);

  // Define etapa inicial = primeira disponível
  const steps = useMemo(() => {
    if (!module) return [] as { key: Step; label: string; icon: React.ElementType; exists: boolean; done: boolean }[];
    return [
      { key: 'pdf' as Step,         label: 'Conteúdo',    icon: FileText,      exists: !!module.pdfUrl,         done: !!progress?.pdf.completed },
      { key: 'video' as Step,       label: 'Vídeo',       icon: Video,         exists: !!module.videoUrl,       done: !!progress?.video.completed },
      { key: 'infographic' as Step, label: 'Infográfico', icon: ImageIcon,     exists: !!module.infographicUrl, done: !!progress?.infographic.completed },
      { key: 'exam' as Step,        label: 'Prova',       icon: ClipboardList, exists: module.exam.enabled,      done: !!progress?.badge },
    ].filter(s => s.exists);
  }, [module, progress]);

  useEffect(() => {
    if (steps.length && !steps.find(s => s.key === step)) setStep(steps[0].key);
  }, [steps, step]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-brand-500" size={32} /></div>;
  if (!module || !progress) return <div className="text-center py-20 text-gray-500">Módulo não encontrado.</div>;

  // Bloqueio sequencial: etapa só libera se as etapas de conteúdo anteriores foram concluídas
  const order = contentSteps(module);
  const isStepLocked = (key: Step): boolean => {
    if (!module.sequential) return false;
    if (key === 'exam') return !progress.examUnlocked;
    const idx = order.indexOf(key as any);
    if (idx <= 0) return false;
    return !order.slice(0, idx).every(s => progress[s].completed);
  };

  const patch = (p: Parameters<typeof patchContentProgress>[2]) => patchContentProgress(module, progress, p);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => navigate('/app/academy')} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm font-medium">
          <ArrowLeft size={18} /> Academia
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-gray-500">Progresso do módulo</p>
            <p className="font-bold text-brand-700">{progress.contentPercent}%</p>
          </div>
          {progress.badge && (
            <span className={`px-3 py-1 rounded-full text-sm font-bold border ${BADGE_TIERS[progress.badge].classes}`}>
              {BADGE_TIERS[progress.badge].emoji} {BADGE_TIERS[progress.badge].label}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h1 className="font-bold text-gray-900">{module.title}</h1>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-gradient-to-r from-brand-500 to-brand-600 rounded-full transition-all" style={{ width: `${progress.contentPercent}%` }} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row min-h-[60vh]">
          {/* Sidebar etapas */}
          <aside className="sm:w-52 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 p-3 flex sm:flex-col gap-1 overflow-x-auto">
            {steps.map(s => {
              const locked = isStepLocked(s.key);
              return (
                <button key={s.key} onClick={() => !locked && setStep(s.key)} disabled={locked}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                    ${step === s.key ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-100'}
                    ${locked ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  {locked ? <Lock size={15} /> : s.done ? <CheckCircle2 size={15} className="text-green-500" /> : <s.icon size={15} />}
                  <span className="flex-1 text-left">{s.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Conteúdo da etapa */}
          <main className="flex-1 p-4 min-w-0">
            {step === 'pdf' && <PdfReader module={module} progress={progress} onComplete={(pagesRead, totalPages) => patch({ pdf: { completed: true, pagesRead, totalPages } })} onPage={(pagesRead, totalPages) => patch({ pdf: { completed: progress.pdf.completed, pagesRead, totalPages } })} />}
            {step === 'video' && <VideoStep module={module} progress={progress} onComplete={(ratio) => patch({ video: { completed: true, watchedRatio: ratio } })} onRatio={(ratio) => patch({ video: { completed: progress.video.completed, watchedRatio: ratio } })} />}
            {step === 'infographic' && <InfographicStep module={module} progress={progress} onComplete={(secs) => patch({ infographic: { completed: true, scrolledEnd: true, secondsViewed: secs } })} />}
            {step === 'exam' && <ExamStep module={module} progress={progress} onStart={() => setExamOpen(true)} />}
          </main>
        </div>
      </div>

      {examOpen && currentUser && (
        <ExamRunner
          module={module}
          onClose={() => setExamOpen(false)}
        />
      )}
    </div>
  );
};

// ── PDF: leitura página a página ──────────────────────────────────────────
const PdfReader: React.FC<{
  module: AcademyModule; progress: AcademyProgress;
  onComplete: (pagesRead: number[], totalPages: number) => void;
  onPage: (pagesRead: number[], totalPages: number) => void;
}> = ({ module, progress, onComplete, onPage }) => {
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [err, setErr] = useState('');
  const read = useRef<Set<number>>(new Set(progress.pdf.pagesRead));

  // Baixa via Storage (contorna CORS do bucket firebasestorage.app)
  useEffect(() => {
    let cancelled = false;
    if (!module.pdfPath) return;
    getBytes(storageRef(storage, module.pdfPath))
      .then(buf => { if (!cancelled) setBytes(new Uint8Array(buf)); })
      .catch(() => { if (!cancelled) setErr('Não foi possível carregar o PDF.'); });
    return () => { cancelled = true; };
  }, [module.pdfPath]);

  const file = useMemo(() => bytes ? { data: bytes } : module.pdfUrl, [bytes, module.pdfUrl]);

  const markPage = useCallback((page: number, total: number) => {
    if (read.current.has(page)) return;
    read.current.add(page);
    const arr = Array.from(read.current).sort((a, b) => a - b);
    if (total > 0 && arr.length >= total) onComplete(arr, total);
    else onPage(arr, total);
  }, [onComplete, onPage]);

  const onLoad = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    markPage(1, numPages);
  };
  const go = (n: number) => {
    const next = Math.max(1, Math.min(numPages || 1, n));
    setPageNum(next);
    markPage(next, numPages);
  };

  if (err) return <p className="text-sm text-red-500 text-center py-10">{err}</p>;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">{read.current.size}/{numPages || '—'} páginas lidas</span>
        {progress.pdf.completed && <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle2 size={14} /> Leitura concluída</span>}
      </div>
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-100 max-w-full">
        <Document file={file} onLoadSuccess={onLoad} loading={<div className="p-10"><Loader2 className="animate-spin text-brand-500" /></div>}>
          <Page pageNumber={pageNum} width={Math.min(720, typeof window !== 'undefined' ? window.innerWidth - 120 : 720)} renderTextLayer={false} renderAnnotationLayer={false} />
        </Document>
      </div>
      <div className="flex items-center gap-4 mt-3">
        <button onClick={() => go(pageNum - 1)} disabled={pageNum <= 1} className="p-2 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200"><ChevronLeft size={18} /></button>
        <span className="text-sm font-medium text-gray-700">Página {pageNum} de {numPages || '—'}</span>
        <button onClick={() => go(pageNum + 1)} disabled={pageNum >= numPages} className="p-2 bg-gray-100 rounded-lg disabled:opacity-40 hover:bg-gray-200"><ChevronRight size={18} /></button>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Avance por todas as páginas para concluir esta etapa.</p>
    </div>
  );
};

// ── Vídeo: upload com anti-seek, ou embed com confirmação ──────────────────
const VideoStep: React.FC<{
  module: AcademyModule; progress: AcademyProgress;
  onComplete: (ratio: number) => void;
  onRatio: (ratio: number) => void;
}> = ({ module, progress, onComplete, onRatio }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const watched = useRef<Set<number>>(new Set()); // buckets de segundos assistidos
  const lastTime = useRef(0);
  const [ratio, setRatio] = useState(progress.video.watchedRatio || 0);
  const [embedSeconds, setEmbedSeconds] = useState(0);

  // Embed (YouTube/Vimeo): habilita confirmação após tempo mínimo assistido
  useEffect(() => {
    if (module.videoSource === 'upload' || progress.video.completed) return;
    const t = setInterval(() => setEmbedSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [module.videoSource, progress.video.completed]);

  const onTimeUpdate = () => {
    const v = videoRef.current; if (!v) return;
    // Anti-seek: se pular muito à frente, não credita os segundos não assistidos
    if (v.currentTime - lastTime.current < 2) {
      watched.current.add(Math.floor(v.currentTime));
    }
    lastTime.current = v.currentTime;
    if (v.duration) {
      const r = Math.min(1, watched.current.size / Math.floor(v.duration));
      setRatio(r);
      if (r >= 0.95 && !progress.video.completed) onComplete(r);
    }
  };
  const onEnded = () => { if (!progress.video.completed) onComplete(Math.max(ratio, 0.95)); };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">Assistido: {Math.round(ratio * 100)}%</span>
        {progress.video.completed && <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle2 size={14} /> Vídeo concluído</span>}
      </div>

      {module.videoSource === 'upload' ? (
        <video ref={videoRef} src={module.videoUrl} controls onTimeUpdate={onTimeUpdate} onEnded={onEnded}
          onPause={() => onRatio(ratio)} className="w-full rounded-lg bg-black" />
      ) : (
        <>
          <div className="aspect-video w-full">
            <iframe title="Vídeo" src={toEmbedUrl(module.videoUrl || '')} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="w-full h-full rounded-lg border border-gray-200 bg-black" />
          </div>
          {!progress.video.completed && (
            <button onClick={() => onComplete(1)} disabled={embedSeconds < 10}
              className="mt-3 flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 disabled:opacity-50">
              <CheckCircle2 size={16} /> {embedSeconds < 10 ? `Assista para concluir (${10 - embedSeconds}s)` : 'Marcar vídeo como assistido'}
            </button>
          )}
        </>
      )}
      <p className="text-[11px] text-gray-400 mt-2">O vídeo conta como concluído ao ser assistido até o fim.</p>
    </div>
  );
};

// ── Infográfico: scroll até o fim + tempo mínimo ───────────────────────────
const INFO_MIN_SECONDS = 20;
const InfographicStep: React.FC<{
  module: AcademyModule; progress: AcademyProgress;
  onComplete: (secs: number) => void;
}> = ({ module, progress, onComplete }) => {
  const [seconds, setSeconds] = useState(progress.infographic.secondsViewed || 0);
  const [scrolledEnd, setScrolledEnd] = useState(progress.infographic.scrolledEnd || false);
  const done = progress.infographic.completed;

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [done]);

  useEffect(() => {
    if (!done && scrolledEnd && seconds >= INFO_MIN_SECONDS) onComplete(seconds);
  }, [scrolledEnd, seconds, done, onComplete]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolledEnd(true);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-500">
          {done ? 'Concluído' : `${scrolledEnd ? '✓ rolou até o fim' : 'role até o fim'} · ${Math.min(seconds, INFO_MIN_SECONDS)}/${INFO_MIN_SECONDS}s`}
        </span>
        {done && <span className="flex items-center gap-1 text-xs text-green-600 font-semibold"><CheckCircle2 size={14} /> Infográfico concluído</span>}
      </div>
      <div onScroll={onScroll} className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
        <img src={module.infographicUrl} alt="Infográfico" className="w-full" />
      </div>
      <p className="text-[11px] text-gray-400 mt-2">Abra, role até o fim e permaneça {INFO_MIN_SECONDS}s para concluir.</p>
    </div>
  );
};

// ── Etapa Prova ────────────────────────────────────────────────────────────
const ExamStep: React.FC<{ module: AcademyModule; progress: AcademyProgress; onStart: () => void }> = ({ module, progress, onStart }) => {
  if (progress.badge) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <div className={`inline-flex flex-col items-center gap-2 px-8 py-6 rounded-2xl border-2 ${BADGE_TIERS[progress.badge].classes}`}>
          <Trophy size={40} />
          <p className="text-2xl font-extrabold">{BADGE_TIERS[progress.badge].emoji} {BADGE_TIERS[progress.badge].label}</p>
          <p className="text-sm font-semibold">Você acertou {progress.scorePercent}% — módulo concluído!</p>
        </div>
        <p className="text-xs text-gray-400 mt-4">Seu badge já está no seu perfil de carreira MGR.</p>
      </div>
    );
  }
  if (progress.examBlocked) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Lock className="mx-auto text-amber-500 mb-3" size={36} />
        <p className="font-bold text-gray-900">Prova bloqueada</p>
        <p className="text-sm text-gray-500 mt-1">Sua tentativa foi encerrada. Aguarde a liberação do administrador para tentar novamente. Aproveite para revisar o conteúdo.</p>
      </div>
    );
  }
  if (!progress.examUnlocked) {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <Lock className="mx-auto text-gray-300 mb-3" size={36} />
        <p className="font-bold text-gray-900">Prova ainda bloqueada</p>
        <p className="text-sm text-gray-500 mt-1">Conclua todas as etapas de conteúdo do módulo para liberar a prova.</p>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto text-center py-10">
      <ClipboardList className="mx-auto text-brand-500 mb-3" size={40} />
      <p className="font-bold text-gray-900 text-lg">Você está pronto para a prova!</p>
      <div className="flex justify-center gap-4 text-sm text-gray-500 my-4">
        <span className="flex items-center gap-1"><Clock size={15} /> {module.exam.durationMinutes} min</span>
        <span className="flex items-center gap-1"><ClipboardList size={15} /> {module.exam.questionsPerExam} questões</span>
        <span className="flex items-center gap-1"><Award size={15} /> corte {module.passingScore}%</span>
      </div>
      <button onClick={onStart} className="inline-flex items-center gap-2 px-6 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 shadow-sm">
        <PlayCircle size={18} /> Ver regras e iniciar
      </button>
    </div>
  );
};

export default ModuleViewer;

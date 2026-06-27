// ═══════════════════════════════════════════════════════════════════════════
// MGR ACADEMY — Prova (Fase 3)
// 1) Regras obrigatórias → 2) Iniciar (startExam: sorteia + timer server-side)
// 3) Anti-abandono (sair = encerra como está, bloqueia retry) → 4) Resultado
// O colaborador vê APENAS o % de acertos — nunca o gabarito.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { updateDoc, doc } from 'firebase/firestore';
import { functions, db } from '../../firebase';
import { CollectionName, AcademyModule } from '../../types';
import {
  AlertTriangle, Clock, Loader2, Send, ShieldAlert, Trophy, CheckCircle2, XCircle,
} from 'lucide-react';
import { BADGE_TIERS } from './academyHelpers';

interface ServedQuestion { id: string; text: string; options: string[]; }
interface Props { module: AcademyModule; onClose: () => void; }

type Phase = 'rules' | 'starting' | 'running' | 'result' | 'error';

const ExamRunner: React.FC<Props> = ({ module, onClose }) => {
  const [phase, setPhase] = useState<Phase>('rules');
  const [agree, setAgree] = useState(false);
  const [scrolledRules, setScrolledRules] = useState(false);
  const [error, setError] = useState('');

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ServedQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [remaining, setRemaining] = useState<number>(0);
  const [result, setResult] = useState<{ scorePercent: number; correctCount: number; total: number; badge: string | null; passed: boolean } | null>(null);

  const submittedRef = useRef(false);
  const attemptRef = useRef<string | null>(null);

  // ── Iniciar prova ──
  const startExam = async () => {
    setPhase('starting');
    try {
      const call = httpsCallable(functions, 'startExam');
      const res: any = await call({ moduleId: module.id });
      setAttemptId(res.data.attemptId);
      attemptRef.current = res.data.attemptId;
      setQuestions(res.data.questions);
      setExpiresAt(res.data.expiresAt);
      setRemaining(Math.max(0, Math.round((res.data.expiresAt - Date.now()) / 1000)));
      setPhase('running');
    } catch (e: any) {
      setError(e?.message || 'Não foi possível iniciar a prova.');
      setPhase('error');
    }
  };

  // ── Submeter (manual, timer ou abandono) ──
  const finish = useCallback(async (fnName: 'submitExam' | 'flagAbandon') => {
    if (submittedRef.current || !attemptRef.current) return;
    submittedRef.current = true;
    try {
      const call = httpsCallable(functions, fnName);
      const res: any = await call({ attemptId: attemptRef.current });
      setResult(res.data);
      setPhase('result');
    } catch (e: any) {
      setError(e?.message || 'Erro ao enviar a prova.');
      setPhase('error');
    }
  }, []);

  // ── Timer (baseado em expiresAt do servidor — reload não dá tempo extra) ──
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      const sec = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(sec);
      if (sec <= 0) { clearInterval(t); finish('submitExam'); }
    }, 1000);
    return () => clearInterval(t);
  }, [phase, expiresAt, finish]);

  // ── Anti-abandono: sair da página/aba encerra a prova como está ──
  useEffect(() => {
    if (phase !== 'running') return;
    const onHidden = () => { if (document.visibilityState === 'hidden') finish('flagAbandon'); };
    const onUnload = () => { finish('flagAbandon'); };
    const onHashChange = () => { finish('flagAbandon'); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('hashchange', onHashChange);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('hashchange', onHashChange);
    };
  }, [phase, finish]);

  // ── Seleciona resposta e persiste no attempt (servidor corrige a partir daí) ──
  const choose = async (qId: string, idx: number) => {
    const next = { ...answers, [qId]: idx };
    setAnswers(next);
    if (attemptRef.current) {
      try { await updateDoc(doc(db, CollectionName.ACADEMY_EXAM_ATTEMPTS, attemptRef.current), { answers: next }); } catch { /* persiste no submit */ }
    }
  };

  const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const answeredCount = Object.keys(answers).length;

  // ═══════════════ RESULTADO ═══════════════
  if (phase === 'result' && result) {
    const badge = result.badge as keyof typeof BADGE_TIERS | null;
    return (
      <Overlay>
        <div className="text-center p-8">
          {result.passed && badge ? (
            <>
              <div className={`inline-flex flex-col items-center gap-2 px-10 py-6 rounded-2xl border-2 mb-4 ${BADGE_TIERS[badge].classes}`}>
                <Trophy size={48} />
                <p className="text-3xl font-extrabold">{BADGE_TIERS[badge].emoji} {BADGE_TIERS[badge].label}</p>
              </div>
              <p className="text-lg font-bold text-gray-900">Você acertou {result.scorePercent}%!</p>
              <p className="text-sm text-gray-500 mt-1">Parabéns — módulo concluído. Seu badge foi para o perfil de carreira MGR.</p>
            </>
          ) : (
            <>
              <XCircle className="mx-auto text-red-400 mb-3" size={48} />
              <p className="text-2xl font-extrabold text-gray-900">{result.scorePercent}% de acertos</p>
              <p className="text-sm text-gray-500 mt-2">Você não atingiu a nota de corte ({module.passingScore}%). A prova está bloqueada — estude o conteúdo novamente e peça ao administrador para liberar uma nova tentativa.</p>
            </>
          )}
          <p className="text-[11px] text-gray-400 mt-4">As respostas corretas não são exibidas — revise o material para evoluir.</p>
          <button onClick={onClose} className="mt-6 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700">Voltar ao módulo</button>
        </div>
      </Overlay>
    );
  }

  // ═══════════════ ERRO ═══════════════
  if (phase === 'error') {
    return (
      <Overlay>
        <div className="text-center p-8">
          <AlertTriangle className="mx-auto text-amber-500 mb-3" size={40} />
          <p className="font-bold text-gray-900">{error}</p>
          <button onClick={onClose} className="mt-5 px-6 py-2.5 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300">Fechar</button>
        </div>
      </Overlay>
    );
  }

  // ═══════════════ REGRAS ═══════════════
  if (phase === 'rules' || phase === 'starting') {
    return (
      <Overlay>
        <div className="p-6 sm:p-8 max-w-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="text-amber-500" size={24} />
            <h2 className="text-xl font-bold text-gray-900">Regras da Prova</h2>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-4">
            <span className="flex items-center gap-1 bg-gray-100 px-3 py-1 rounded-full"><Clock size={14} /> {module.exam.durationMinutes} min</span>
            <span className="bg-gray-100 px-3 py-1 rounded-full">{module.exam.questionsPerExam} questões</span>
            <span className="bg-gray-100 px-3 py-1 rounded-full">corte {module.passingScore}%</span>
          </div>
          <div
            onScroll={e => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) setScrolledRules(true); }}
            className="max-h-52 overflow-y-auto bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 whitespace-pre-line mb-2"
          >
            {module.exam.rulesText}
            {'\n\n'}⚠️ Ao iniciar, o cronômetro corre no servidor: fechar ou recarregar a página NÃO devolve tempo. Se você sair desta tela, a prova é encerrada com o que você respondeu e fica bloqueada até liberação do administrador.
          </div>
          {!scrolledRules && <p className="text-[11px] text-gray-400 mb-3">Role as regras até o fim para habilitar.</p>}
          <label className="flex items-start gap-2 text-sm text-gray-700 mb-5">
            <input type="checkbox" checked={agree} disabled={!scrolledRules} onChange={e => setAgree(e.target.checked)} className="mt-0.5" />
            Li e concordo com as regras acima.
          </label>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200">Cancelar</button>
            <button onClick={startExam} disabled={!agree || phase === 'starting'}
              className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {phase === 'starting' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />} Iniciar Prova
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  // ═══════════════ PROVA EM ANDAMENTO ═══════════════
  return (
    <div className="fixed inset-0 z-[70] bg-gray-100 flex flex-col">
      {/* Barra fixa com timer */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate text-sm">{module.title}</p>
          <p className="text-xs text-gray-500">{answeredCount}/{questions.length} respondidas</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold tabular-nums ${remaining <= 60 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-brand-50 text-brand-700'}`}>
          <Clock size={16} /> {mmss(remaining)}
        </div>
      </div>

      {/* Aviso anti-abandono */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[12px] text-amber-800 flex items-center gap-2 flex-shrink-0">
        <AlertTriangle size={14} /> Não saia desta tela: a prova será encerrada e bloqueada.
      </div>

      {/* Questões */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="font-semibold text-sm text-gray-900 mb-3">{i + 1}. {q.text}</p>
              <div className="space-y-2">
                {q.options.map((opt, oi) => (
                  <button key={oi} onClick={() => choose(q.id, oi)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-2
                      ${answers[q.id] === oi ? 'border-brand-500 bg-brand-50 text-brand-800 font-medium' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}>
                    <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${answers[q.id] === oi ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300 text-gray-400'}`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button onClick={() => finish('submitExam')}
            className="w-full py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> Enviar prova ({answeredCount}/{questions.length})
          </button>
        </div>
      </div>
    </div>
  );
};

const Overlay: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto">{children}</div>
  </div>
);

export default ExamRunner;

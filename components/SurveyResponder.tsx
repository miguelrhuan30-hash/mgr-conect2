import React, { useState, useEffect } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, getDocs, Timestamp, limit,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, Survey, SurveyQuestion, SurveyResponse, SurveyParticipation,
} from '../types';
import { ClipboardList, CheckCircle2, AlertTriangle, Loader2, Send, ChevronRight } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   PRIVACY NOTICE
───────────────────────────────────────────────────────────────────────────── */
const PrivacyNotice: React.FC = () => (
  <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-200 rounded-2xl p-5 space-y-2">
    <div className="flex items-center gap-2 text-violet-700">
      <span className="text-xl">🔒</span>
      <h3 className="font-extrabold text-sm uppercase tracking-wide">Aviso Importante de Privacidade e Anonimato Total</h3>
    </div>
    <p className="text-xs text-violet-900 leading-relaxed">
      A sua voz é o nosso ativo mais importante para evoluirmos. Garantimos que esta pesquisa é{' '}
      <strong>100% anônima e imparcial</strong>. Nenhum gestor, líder, diretoria, ou mesmo os
      desenvolvedores do sistema MGR-conect possuem acesso para vincular as respostas ao seu usuário.
      Seus dados são criptografados e tratados exclusivamente como dados agrupados. Responda com total
      franqueza: o nosso único objetivo é melhorar o seu ambiente de trabalho.{' '}
      <strong>Não há respostas certas ou erradas.</strong>
    </p>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   QUESTION RENDERER
───────────────────────────────────────────────────────────────────────────── */
interface QuestionRendererProps {
  q: SurveyQuestion;
  value: string | number | string[];
  onChange: (val: string | number | string[]) => void;
}
const QuestionRenderer: React.FC<QuestionRendererProps> = ({ q, value, onChange }) => {
  const str = typeof value === 'string' ? value : '';
  const num = typeof value === 'number' ? value : -1;

  /* eNPS / escala 0-10 */
  if (q.tipo === 'enps' || q.tipo === 'escala_0_10') {
    const max = 10;
    const color = q.tipo === 'enps'
      ? (num <= 6 ? 'bg-red-500' : num <= 8 ? 'bg-amber-400' : 'bg-green-500')
      : 'bg-violet-500';
    return (
      <div className="space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {Array.from({ length: max + 1 }, (_, i) => (
            <button key={i} onClick={() => onChange(i)}
              className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                num === i ? `${color} text-white scale-110 shadow-md` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{i}
            </button>
          ))}
        </div>
        {q.tipo === 'enps' && (
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>0 = Jamais indicaria</span><span>10 = Com certeza indicaria</span>
          </div>
        )}
        {num >= 0 && <p className="text-xs text-violet-600 font-bold">Selecionado: {num}</p>}
      </div>
    );
  }

  /* múltipla (ordenada, categórica, satisfação, dificuldade) */
  if (['multipla_ordenada','multipla_categorica','satisfacao','dificuldade_1_5'].includes(q.tipo)) {
    const selected = str;
    const opcoes = q.opcoes ?? [];
    return (
      <div className="space-y-2">
        {opcoes.map((op, i) => (
          <button key={i} onClick={() => onChange(op)}
            className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium active:scale-[0.98] ${
              selected === op
                ? 'border-violet-500 bg-violet-50 text-violet-800'
                : 'border-gray-200 bg-white text-gray-700 hover:border-violet-300 hover:bg-violet-50/30'
            }`}>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
              selected === op ? 'border-violet-500 bg-violet-500' : 'border-gray-300'
            }`}>
              {selected === op && <div className="w-2 h-2 bg-white rounded-full" />}
            </div>
            {op}
          </button>
        ))}
        {q.permitirOutro && (
          <div className="mt-1">
            <input
              value={selected?.startsWith('__outro__') ? selected.replace('__outro__', '') : ''}
              onChange={e => onChange(e.target.value ? `__outro__${e.target.value}` : '')}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400"
              placeholder="Outro (descreva)..." />
          </div>
        )}
      </div>
    );
  }

  /* campo livre */
  return (
    <textarea value={str} onChange={e => onChange(e.target.value)} rows={4}
      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-400 resize-none"
      placeholder="Escreva aqui... (este espaço é livre e seguro)" />
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const SurveyResponder: React.FC = () => {
  const { currentUser } = useAuth();

  const [pendingSurveys, setPendingSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number | string[]>>({});
  const [step, setStep] = useState<'list' | 'privacy' | 'form' | 'done'>('list');
  const [submitting, setSubmitting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0); // mobile one-at-a-time progress

  /* ── Load active surveys + filter out already responded ── */
  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, CollectionName.SURVEYS), where('status', '==', 'ativo'));
    return onSnapshot(q, async snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Survey);
      // filter: remove those the user already answered
      const pq = query(
        collection(db, CollectionName.SURVEY_PARTICIPATION),
        where('userId', '==', currentUser.uid),
      );
      const participated = await getDocs(pq);
      const done = new Set(participated.docs.map(d => d.data().surveyId));
      setPendingSurveys(all.filter(s => !done.has(s.id)));
      setLoading(false);
    }, () => setLoading(false));
  }, [currentUser]);

  const startSurvey = (sv: Survey) => {
    setActiveSurvey(sv);
    setAnswers({});
    setCurrentQ(0);
    setStep('privacy');
  };

  const handleAnswer = (qId: string, val: string | number | string[]) =>
    setAnswers(prev => ({ ...prev, [qId]: val }));

  const isValid = (q: SurveyQuestion) => {
    if (!q.obrigatorio) return true;
    const v = answers[q.id];
    if (v === undefined || v === '' || v === -1) return false;
    if (typeof v === 'number' && v < 0) return false;
    return true;
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!currentUser || !activeSurvey) return;
    setSubmitting(true);
    try {
      // 1. Save anonymous response (no userId)
      const responseData: Omit<SurveyResponse, 'id'> = {
        surveyId: activeSurvey.id,
        respostas: answers,
        respondidoEm: Timestamp.now(),
      };
      await addDoc(collection(db, CollectionName.SURVEY_RESPONSES), responseData);
      // 2. Save participation flag (with userId, no content)
      const partData: Omit<SurveyParticipation, 'id'> = {
        userId: currentUser.uid,
        surveyId: activeSurvey.id,
        respondeuEm: Timestamp.now(),
      };
      await addDoc(collection(db, CollectionName.SURVEY_PARTICIPATION), partData);
      setStep('done');
    } catch (err) {
      console.error('Erro ao enviar resposta:', err);
      alert('Erro ao enviar. Tente novamente.');
    } finally { setSubmitting(false); }
  };

  /* ─── LOADING ─── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-gray-400">
      <Loader2 size={22} className="animate-spin mr-2" /> Verificando pesquisas...
    </div>
  );

  /* ─── DONE ─── */
  if (step === 'done') return (
    <div className="max-w-lg mx-auto text-center py-16 space-y-5">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 size={44} className="text-green-500" />
      </div>
      <h2 className="text-2xl font-extrabold text-gray-900">Obrigado pela sua resposta!</h2>
      <p className="text-gray-500 text-sm leading-relaxed">
        Sua participação foi registrada de forma <strong>100% anônima</strong>. As respostas serão
        analisadas de forma agrupada para melhorar nosso ambiente de trabalho. 🙏
      </p>
      <button onClick={() => { setStep('list'); setActiveSurvey(null); setAnswers({}); }}
        className="mt-4 px-6 py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 transition-colors">
        Voltar às Pesquisas
      </button>
    </div>
  );

  /* ─── LIST ─── */
  if (step === 'list') return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="text-violet-500" size={28} /> Pesquisas Pendentes
        </h1>
        <p className="text-gray-500 text-sm mt-1">Sua voz é fundamental. Participe de forma segura e anônima.</p>
      </div>

      {pendingSurveys.length === 0 && (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center">
          <CheckCircle2 size={40} className="text-green-400 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Você está em dia!</p>
          <p className="text-sm text-gray-400 mt-1">Não há pesquisas pendentes para você no momento.</p>
        </div>
      )}

      {pendingSurveys.map(sv => (
        <button key={sv.id} onClick={() => startSurvey(sv)}
          className="w-full bg-white border-2 border-gray-200 hover:border-violet-400 rounded-2xl p-5 text-left transition-all group shadow-sm hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 group-hover:text-violet-700 transition-colors">{sv.titulo}</h3>
              {sv.descricao && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{sv.descricao}</p>}
              <p className="text-xs text-violet-500 font-medium mt-2">
                {sv.perguntas.length} pergunta{sv.perguntas.length !== 1 ? 's' : ''} · ~{Math.ceil(sv.perguntas.length * 0.5)} min
              </p>
            </div>
            <ChevronRight size={20} className="text-gray-300 group-hover:text-violet-500 flex-shrink-0 ml-4 transition-colors" />
          </div>
        </button>
      ))}
    </div>
  );

  /* ─── PRIVACY ─── */
  if (step === 'privacy' && activeSurvey) return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">{activeSurvey.titulo}</h1>
      <PrivacyNotice />
      <button onClick={() => setStep('form')}
        className="w-full py-4 bg-violet-600 text-white rounded-2xl font-bold text-base hover:bg-violet-700 transition-colors flex items-center justify-center gap-2 shadow-md active:scale-[0.98]">
        Entendi — Quero Participar <ChevronRight size={20} />
      </button>
    </div>
  );

  /* ─── FORM ─── */
  if (step === 'form' && activeSurvey) {
    const qs = activeSurvey.perguntas.sort((a, b) => a.ordem - b.ordem);
    const q = qs[currentQ];
    const isLast = currentQ === qs.length - 1;
    const canNext = isValid(q);

    return (
      <div className="max-w-xl mx-auto space-y-6">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
            <span className="font-semibold">{activeSurvey.titulo}</span>
            <span>{currentQ + 1} / {qs.length}</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="bg-violet-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQ + 1) / qs.length) * 100}%` }} />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <span className="w-7 h-7 bg-violet-100 text-violet-600 text-xs font-extrabold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              {currentQ + 1}
            </span>
            <h3 className="text-base font-semibold text-gray-900 leading-snug">{q.texto}</h3>
          </div>
          {q.obrigatorio && <p className="text-[10px] text-red-500 font-medium">* Resposta obrigatória</p>}
          <QuestionRenderer q={q} value={answers[q.id] ?? (q.tipo === 'escala_0_10' || q.tipo === 'enps' ? -1 : '')}
            onChange={v => handleAnswer(q.id, v)} />
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentQ > 0 && (
            <button onClick={() => setCurrentQ(c => c - 1)}
              className="px-5 py-3 bg-gray-100 text-gray-600 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-colors">
              ← Anterior
            </button>
          )}
          {!isLast ? (
            <button onClick={() => setCurrentQ(c => c + 1)} disabled={!canNext}
              className="flex-1 py-3 bg-violet-600 text-white rounded-xl font-bold text-sm hover:bg-violet-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2">
              Próxima <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting || !canNext}
              className="flex-1 py-4 bg-green-600 text-white rounded-xl font-extrabold text-base hover:bg-green-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 shadow-md">
              {submitting ? <><Loader2 size={18} className="animate-spin" /> Enviando...</> : <><Send size={18} /> Enviar Respostas</>}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
};

export default SurveyResponder;

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Survey, SurveyQuestion, SurveyAccessKey } from '../types';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  ShieldCheck, CheckCircle2, Loader2, AlertTriangle, ChevronRight,
  Lock, Eye, EyeOff,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────────────────── */

type Answers = Record<string, string | number | string[]>;

const SATISFACAO_OPTS = [
  'Muito Insatisfeito', 'Insatisfeito', 'Neutro', 'Satisfeito', 'Muito Satisfeito',
];
const DIFICULDADE_OPTS = [
  '1 – Muito Difícil', '2 – Difícil', '3 – Neutro', '4 – Fácil', '5 – Muito Fácil',
];

/* ─── sub-components ──────────────────────────────────────────────────────── */

function ScaleButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
      }`}
    >
      {label}
    </button>
  );
}

function QuestionCard({
  q, index, answer, onChange,
}: {
  q: SurveyQuestion;
  index: number;
  answer: string | number | string[] | undefined;
  onChange: (val: string | number | string[]) => void;
}) {
  const [outroText, setOutroText] = useState('');

  const handleMultiToggle = (opt: string) => {
    const current = (answer as string[]) ?? [];
    const next = current.includes(opt)
      ? current.filter(o => o !== opt)
      : [...current, opt];
    onChange(next);
  };

  const handleOutro = (text: string) => {
    setOutroText(text);
    const current = ((answer as string[]) ?? []).filter(o => !o.startsWith('__outro__:'));
    if (text.trim()) onChange([...current, `__outro__:${text}`]);
    else onChange(current);
  };

  const outroActive = Array.isArray(answer) && answer.some(o => o.startsWith('__outro__:'));
  const currentOutroText = outroText || (Array.isArray(answer) ? (answer.find(o => o.startsWith('__outro__:'))?.replace('__outro__:', '') ?? '') : '');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
      <p className="font-semibold text-gray-800 mb-1">
        <span className="text-blue-600 mr-2">{index + 1}.</span>
        {q.texto}
        {q.obrigatorio && <span className="text-red-500 ml-1">*</span>}
      </p>

      <div className="mt-4">
        {/* ── eNPS e Escala 0-10 ── */}
        {(q.tipo === 'enps' || q.tipo === 'escala_0_10') && (
          <div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 11 }, (_, i) => (
                <ScaleButton
                  key={i}
                  label={String(i)}
                  active={answer === i}
                  onClick={() => onChange(i)}
                />
              ))}
            </div>
            {q.tipo === 'enps' && (
              <div className="flex justify-between text-xs text-gray-400 mt-2 px-1">
                <span>0 — Muito improvável</span>
                <span>10 — Muito provável</span>
              </div>
            )}
          </div>
        )}

        {/* ── Satisfação ── */}
        {q.tipo === 'satisfacao' && (
          <div className="flex flex-wrap gap-2">
            {SATISFACAO_OPTS.map(opt => (
              <ScaleButton key={opt} label={opt} active={answer === opt} onClick={() => onChange(opt)} />
            ))}
          </div>
        )}

        {/* ── Dificuldade 1-5 ── */}
        {q.tipo === 'dificuldade_1_5' && (
          <div className="flex flex-wrap gap-2">
            {DIFICULDADE_OPTS.map(opt => (
              <ScaleButton key={opt} label={opt} active={answer === opt} onClick={() => onChange(opt)} />
            ))}
          </div>
        )}

        {/* ── Múltipla Ordenada / Categórica ── */}
        {(q.tipo === 'multipla_ordenada' || q.tipo === 'multipla_categorica') && (
          <div className="space-y-2">
            {(q.opcoes ?? []).map(opt => {
              const selected = Array.isArray(answer) && answer.includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleMultiToggle(opt)}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                    selected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
            {q.permitirOutro && (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    if (!outroActive) {
                      const current = (answer as string[]) ?? [];
                      onChange([...current, '__outro__:']);
                    } else {
                      handleOutro('');
                    }
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                    outroActive
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                  }`}
                >
                  Outro (descreva)
                </button>
                {outroActive && (
                  <input
                    type="text"
                    value={currentOutroText}
                    onChange={e => handleOutro(e.target.value)}
                    placeholder="Descreva..."
                    className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Campo Livre ── */}
        {q.tipo === 'campo_livre' && (
          <textarea
            value={(answer as string) ?? ''}
            onChange={e => onChange(e.target.value)}
            rows={4}
            placeholder="Escreva sua resposta aqui..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        )}
      </div>
    </div>
  );
}

/* ─── main component ──────────────────────────────────────────────────────── */

type Stage = 'loading' | 'invalid' | 'key_entry' | 'survey' | 'done' | 'already_used';

export default function SurveyPublico() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const [searchParams] = useSearchParams();

  const [stage, setStage] = useState<Stage>('loading');
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [keyInput, setKeyInput] = useState(searchParams.get('key') ?? '');
  const [keyDoc, setKeyDoc] = useState<SurveyAccessKey | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [showKey, setShowKey] = useState(false);

  /* load survey */
  useEffect(() => {
    if (!surveyId) { setStage('invalid'); return; }

    (async () => {
      try {
        const q = query(
          collection(db, CollectionName.SURVEYS),
          where('__name__', '==', surveyId),
        );
        const snap = await getDocs(q);
        if (snap.empty) { setStage('invalid'); return; }
        const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as Survey;

        if (!data.linkPublico || data.status !== 'ativo') {
          setStage('invalid');
          return;
        }
        setSurvey(data);

        // se veio com ?key= na URL, vai direto para validação da chave
        const urlKey = searchParams.get('key');
        if (urlKey) {
          setStage('loading');
          await validateKey(urlKey, surveyId, data);
        } else {
          setStage('key_entry');
        }
      } catch {
        setStage('invalid');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surveyId]);

  const validateKey = useCallback(async (chave: string, sid: string, sv: Survey) => {
    const trimmed = chave.trim().toUpperCase();
    if (!trimmed) { setKeyError('Informe sua chave de acesso.'); setStage('key_entry'); return; }

    try {
      const q = query(
        collection(db, CollectionName.SURVEY_ACCESS_KEYS),
        where('surveyId', '==', sid),
        where('chave', '==', trimmed),
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        setKeyError('Chave inválida. Verifique e tente novamente.');
        setStage('key_entry');
        return;
      }

      const kd = { id: snap.docs[0].id, ...snap.docs[0].data() } as SurveyAccessKey;
      if (kd.usado) {
        setStage('already_used');
        return;
      }

      setKeyDoc(kd);
      setSurvey(sv);
      setStage('survey');
    } catch {
      setKeyError('Erro ao validar chave. Tente novamente.');
      setStage('key_entry');
    }
  }, []);

  const handleKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!surveyId || !survey) return;
    setKeyError('');
    setStage('loading');
    await validateKey(keyInput, surveyId, survey);
  };

  const handleAnswer = (questionId: string, val: string | number | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!survey || !keyDoc) return;

    // valida obrigatórias
    for (const q of survey.perguntas) {
      if (!q.obrigatorio) continue;
      const ans = answers[q.id];
      if (ans === undefined || ans === '' || (Array.isArray(ans) && ans.length === 0)) {
        alert(`Por favor, responda a pergunta ${q.ordem}: "${q.texto.slice(0, 60)}..."`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. registra a resposta (sem userId — anônimo)
      await addDoc(collection(db, CollectionName.SURVEY_RESPONSES), {
        surveyId: survey.id,
        respostas: answers,
        respondidoEm: Timestamp.now(),
        chaveAcesso: keyDoc.chave,
      });

      // 2. marca a chave como usada
      await updateDoc(doc(db, CollectionName.SURVEY_ACCESS_KEYS, keyDoc.id), {
        usado: true,
        usadoEm: Timestamp.now(),
      });

      setStage('done');
    } catch {
      alert('Erro ao enviar resposta. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── renders ── */

  if (stage === 'loading') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
    </div>
  );

  if (stage === 'invalid') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <AlertTriangle className="w-14 h-14 text-amber-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Pesquisa indisponível</h1>
        <p className="text-gray-500 text-sm">
          Este link de pesquisa não está ativo ou já foi encerrado. Caso acredite que seja um erro,
          fale com o responsável que distribuiu sua chave de acesso.
        </p>
      </div>
    </div>
  );

  if (stage === 'already_used') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">Resposta já registrada</h1>
        <p className="text-gray-500 text-sm">
          Esta chave de acesso já foi utilizada para responder a pesquisa. Cada chave
          permite apenas uma resposta, garantindo o caráter anônimo do processo.
        </p>
      </div>
    </div>
  );

  if (stage === 'done') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Obrigado!</h1>
        <p className="text-gray-600 text-sm mb-4">
          Sua resposta foi registrada com sucesso. Lembre-se: suas respostas são
          completamente anônimas — nenhuma informação pessoal foi coletada.
        </p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-left">
          <p className="text-green-800 text-xs font-medium">
            ✅ Resposta salva de forma anônima<br />
            ✅ Nenhum dado pessoal registrado<br />
            ✅ Sua chave de acesso foi invalidada (uso único)
          </p>
        </div>
        <p className="text-gray-400 text-xs mt-6">Pode fechar esta página com segurança.</p>
      </div>
    </div>
  );

  if (stage === 'key_entry') return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
        {/* header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 p-6 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-white/20 rounded-full p-2">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-blue-200 uppercase tracking-wide font-semibold">Pesquisa Interna MGR</p>
              <h1 className="text-lg font-bold leading-tight">{survey?.titulo}</h1>
            </div>
          </div>
        </div>

        {/* aviso de anonimato */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4">
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-amber-800 text-xs leading-relaxed">
              <strong>100% Anônima.</strong> Suas respostas são completamente anônimas. Nenhum
              dado que possa identificar você é coletado ou armazenado. As informações são
              usadas exclusivamente para melhorias internas da empresa.
            </p>
          </div>
        </div>

        {/* form chave */}
        <form onSubmit={handleKeySubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Chave de Acesso
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Digite a chave impressa no papel que você recebeu. Cada chave é de uso único e
              garante que sua resposta seja contada apenas uma vez.
            </p>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={e => setKeyInput(e.target.value.toUpperCase())}
                placeholder="Ex: AB3X-7K9M"
                autoComplete="off"
                className={`w-full border rounded-lg px-4 py-3 text-lg font-mono tracking-widest uppercase text-center focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  keyError ? 'border-red-400 bg-red-50' : 'border-gray-300'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {keyError && (
              <p className="text-red-600 text-xs mt-2 flex items-center gap-1">
                <AlertTriangle size={12} /> {keyError}
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            Entrar na Pesquisa <ChevronRight size={18} />
          </button>

          <p className="text-center text-xs text-gray-400">
            Sem chave? Procure o responsável que distribuiu os papéis de acesso.
          </p>
        </form>
      </div>
    </div>
  );

  /* ── stage === 'survey' ── */
  if (!survey) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* header */}
        <div className="bg-gradient-to-r from-blue-700 to-blue-900 rounded-2xl p-6 text-white shadow-xl">
          <p className="text-xs text-blue-200 uppercase tracking-wide font-semibold mb-1">Pesquisa Interna MGR</p>
          <h1 className="text-2xl font-bold mb-2">{survey.titulo}</h1>
          {survey.descricao && <p className="text-blue-100 text-sm">{survey.descricao}</p>}
        </div>

        {/* banner anonimato */}
        <div className="bg-green-700 text-white rounded-xl px-5 py-4 flex items-start gap-3 shadow">
          <ShieldCheck className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm">
            <strong>Suas respostas são 100% anônimas.</strong> Não coletamos nenhuma informação
            pessoal. As respostas são utilizadas exclusivamente para melhorias internas da MGR.
            Responda com total sinceridade.
          </div>
        </div>

        {/* perguntas */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {[...survey.perguntas]
            .sort((a, b) => a.ordem - b.ordem)
            .map((q, i) => (
              <QuestionCard
                key={q.id}
                q={q}
                index={i}
                answer={answers[q.id]}
                onChange={val => handleAnswer(q.id, val)}
              />
            ))}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-lg text-lg"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Enviar Respostas</>
            )}
          </button>

          <p className="text-center text-xs text-white/50 pb-4">
            Ao enviar, sua chave de acesso será invalidada. Você não poderá responder novamente.
          </p>
        </form>
      </div>
    </div>
  );
}

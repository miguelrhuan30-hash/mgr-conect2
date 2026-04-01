import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot, getDocs, orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  CollectionName, Survey, SurveyResponse, SurveyTemplate,
} from '../types';
import {
  BarChart3, TrendingUp, Users, AlertTriangle, CheckCircle2,
  Loader2, ChevronRight, Zap, MessageSquare, Target, Activity,
  ArrowUpRight, ArrowDownRight, Minus, RefreshCw,
} from 'lucide-react';

/* ════════════════════════════════════════════════════════════════
   eNPS CALCULATION RULES (Regras mundiais)
   0–6 = Detrator | 7–8 = Neutro | 9–10 = Promotor
   eNPS = %Promotores − %Detratores  (Score −100 a +100)
   ════════════════════════════════════════════════════════════════ */

type ENPSZone = 'critica' | 'aperfeicoamento' | 'qualidade' | 'excelencia';

function classifyENPS(score: number): { zone: ENPSZone; label: string; color: string; bg: string } {
  if (score <= 0)  return { zone: 'critica',         label: 'Zona Crítica',         color: 'text-red-700',       bg: 'bg-red-500' };
  if (score <= 50) return { zone: 'aperfeicoamento', label: 'Zona de Aperfeiçoamento', color: 'text-yellow-700', bg: 'bg-yellow-500' };
  if (score <= 75) return { zone: 'qualidade',       label: 'Zona de Qualidade',    color: 'text-green-600',     bg: 'bg-green-400' };
  return                   { zone: 'excelencia',      label: 'Zona de Excelência',   color: 'text-emerald-700',   bg: 'bg-emerald-600' };
}

function calculateENPS(responses: SurveyResponse[], enpsQuestionId: string) {
  const scores = responses
    .map(r => r.respostas[enpsQuestionId])
    .filter(v => typeof v === 'number') as number[];

  if (scores.length === 0) return null;

  const total = scores.length;
  const promotores = scores.filter(s => s >= 9).length;
  const neutros    = scores.filter(s => s >= 7 && s <= 8).length;
  const detratores = scores.filter(s => s <= 6).length;
  const pctProm = (promotores / total) * 100;
  const pctDetr = (detratores / total) * 100;
  const score = Math.round(pctProm - pctDetr);

  return { score, total, promotores, neutros, detratores, pctProm, pctDetr, pctNeutro: (neutros / total) * 100 };
}

/* ════════════════════════════════════════════════════════════════
   INNOVATION KPIs
   ════════════════════════════════════════════════════════════════ */

/** Delta = Média "Depois" − Média "Antes" */
function calculateDelta(responses: SurveyResponse[], antesQId: string, depoisQId: string) {
  const antes  = responses.map(r => r.respostas[antesQId]).filter(v => typeof v === 'number') as number[];
  const depois = responses.map(r => r.respostas[depoisQId]).filter(v => typeof v === 'number') as number[];
  if (antes.length === 0 || depois.length === 0) return null;
  const mediaAntes  = antes.reduce((s, v) => s + v, 0) / antes.length;
  const mediaDepois = depois.reduce((s, v) => s + v, 0) / depois.length;
  return { delta: +(mediaDepois - mediaAntes).toFixed(2), mediaAntes: +mediaAntes.toFixed(2), mediaDepois: +mediaDepois.toFixed(2) };
}

/** Fricção = % respostas "1 - Muito Difícil" ou "2 - Difícil" */
function calculateFriction(responses: SurveyResponse[], friccaoQId: string) {
  const answers = responses.map(r => r.respostas[friccaoQId]).filter(Boolean) as string[];
  if (answers.length === 0) return null;
  const difficult = answers.filter(a => a.startsWith('1') || a.startsWith('2')).length;
  return { pct: Math.round((difficult / answers.length) * 100), total: answers.length, difficult };
}

/** Aceitação = % "Satisfeito" + "Muito Satisfeito" */
function calculateAcceptance(responses: SurveyResponse[], satisfacaoQId: string) {
  const answers = responses.map(r => r.respostas[satisfacaoQId]).filter(Boolean) as string[];
  if (answers.length === 0) return null;
  const satisfied = answers.filter(a => a.includes('Satisfeito') && !a.includes('Insatisfeito')).length;
  return { pct: Math.round((satisfied / answers.length) * 100), total: answers.length, satisfied };
}

/* ════════════════════════════════════════════════════════════════
   STACKED BAR COMPONENT (puro CSS)
   ════════════════════════════════════════════════════════════════ */
const StackedBar: React.FC<{ pctProm: number; pctNeutro: number; pctDetr: number }> = ({ pctProm, pctNeutro, pctDetr }) => (
  <div className="w-full h-8 rounded-lg overflow-hidden flex" title={`Promotores: ${pctProm.toFixed(0)}% / Neutros: ${pctNeutro.toFixed(0)}% / Detratores: ${pctDetr.toFixed(0)}%`}>
    {pctProm > 0 && <div className="bg-green-500 flex items-center justify-center text-white text-[10px] font-bold transition-all" style={{ width: `${pctProm}%` }}>{pctProm.toFixed(0)}%</div>}
    {pctNeutro > 0 && <div className="bg-gray-300 flex items-center justify-center text-gray-700 text-[10px] font-bold transition-all" style={{ width: `${pctNeutro}%` }}>{pctNeutro.toFixed(0)}%</div>}
    {pctDetr > 0 && <div className="bg-red-500 flex items-center justify-center text-white text-[10px] font-bold transition-all" style={{ width: `${pctDetr}%` }}>{pctDetr.toFixed(0)}%</div>}
  </div>
);

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════════ */
const SurveyDashboard: React.FC = () => {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [responses, setResponses] = useState<Record<string, SurveyResponse[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedHub, setSelectedHub] = useState<'clima' | 'inovacao'>('clima');
  const [selectedInnovation, setSelectedInnovation] = useState<string | null>(null);

  /* ── Load data ── */
  useEffect(() => {
    const q1 = query(collection(db, CollectionName.SURVEYS), orderBy('criadoEm', 'desc'));
    const unsub1 = onSnapshot(q1, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Survey);
      setSurveys(docs);
      setLoading(false);
      // Load responses for each survey
      docs.forEach(async sv => {
        const rq = query(collection(db, CollectionName.SURVEY_RESPONSES), where('surveyId', '==', sv.id));
        const rs = await getDocs(rq);
        const rDocs = rs.docs.map(d => ({ id: d.id, ...d.data() }) as SurveyResponse);
        setResponses(prev => ({ ...prev, [sv.id]: rDocs }));
      });
    });

    const q2 = query(collection(db, CollectionName.SURVEY_TEMPLATES), orderBy('criadoEm', 'asc'));
    const unsub2 = onSnapshot(q2, snap => {
      setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() }) as SurveyTemplate));
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  /* ── Derived: categorize surveys ── */
  const climaSurveys = useMemo(() => surveys.filter(s => s.tipo === 'pulso' || s.tipo === 'transicao'), [surveys]);
  const inovacaoSurveys = useMemo(() => surveys.filter(s => s.tipo === 'inovacao'), [surveys]);

  /* ── eNPS: find the eNPS question in each clima survey ── */
  const enpsData = useMemo(() => {
    return climaSurveys
      .filter(sv => (responses[sv.id]?.length ?? 0) > 0)
      .map(sv => {
        const enpsQ = sv.perguntas.find(q => q.tipo === 'enps');
        if (!enpsQ) return null;
        const result = calculateENPS(responses[sv.id] || [], enpsQ.id);
        if (!result) return null;
        return { survey: sv, ...result };
      })
      .filter(Boolean) as Array<{ survey: Survey; score: number; total: number; promotores: number; neutros: number; detratores: number; pctProm: number; pctNeutro: number; pctDetr: number }>;
  }, [climaSurveys, responses]);

  /* ── Climate KPIs from non-eNPS questions ── */
  const climaKPIs = useMemo(() => {
    const kpis: { label: string; values: number[]; surveyTitle: string }[] = [];
    climaSurveys.forEach(sv => {
      const resp = responses[sv.id] || [];
      if (resp.length === 0) return;
      sv.perguntas.forEach(q => {
        if (q.tipo === 'enps' || q.tipo === 'campo_livre') return;
        if (q.kpiTipo === 'percentual_favoravel' && q.opcoes && q.opcoes.length > 0) {
          const answers = resp.map(r => r.respostas[q.id]).filter(Boolean) as string[];
          if (answers.length === 0) return;
          // Last 2 options = favorable
          const favorable = q.opcoes.slice(-2);
          const pct = Math.round((answers.filter(a => favorable.includes(a)).length / answers.length) * 100);
          kpis.push({ label: q.texto.substring(0, 80) + (q.texto.length > 80 ? '...' : ''), values: [pct], surveyTitle: sv.titulo });
        }
      });
    });
    return kpis;
  }, [climaSurveys, responses]);

  /* ── Qualitative feedback wall ── */
  const qualFeedbacks = useMemo(() => {
    const feedbacks: { text: string; surveyTitle: string }[] = [];
    climaSurveys.forEach(sv => {
      const resp = responses[sv.id] || [];
      sv.perguntas.filter(q => q.tipo === 'campo_livre').forEach(q => {
        resp.forEach(r => {
          const val = r.respostas[q.id];
          if (typeof val === 'string' && val.trim()) {
            feedbacks.push({ text: val.trim(), surveyTitle: sv.titulo });
          }
        });
      });
    });
    return feedbacks;
  }, [climaSurveys, responses]);

  /* ── Innovation: detail for selected survey ── */
  const innovationDetail = useMemo(() => {
    if (!selectedInnovation) return null;
    const sv = inovacaoSurveys.find(s => s.id === selectedInnovation);
    if (!sv) return null;
    const resp = responses[sv.id] || [];
    if (resp.length === 0) return { survey: sv, delta: null, friction: null, acceptance: null, feedbacks: [] };

    // Find questions by kpiTipo
    const antesQ   = sv.perguntas.find(q => q.kpiTipo === 'delta_melhoria_antes');
    const depoisQ  = sv.perguntas.find(q => q.kpiTipo === 'delta_melhoria_depois');
    const friccaoQ = sv.perguntas.find(q => q.kpiTipo === 'indice_friccao');
    const satisfQ  = sv.perguntas.find(q => q.kpiTipo === 'taxa_satisfacao');
    const libreQs  = sv.perguntas.filter(q => q.tipo === 'campo_livre');

    const delta     = (antesQ && depoisQ) ? calculateDelta(resp, antesQ.id, depoisQ.id) : null;
    const friction  = friccaoQ ? calculateFriction(resp, friccaoQ.id) : null;
    const acceptance = satisfQ ? calculateAcceptance(resp, satisfQ.id) : null;

    const feedbacks: string[] = [];
    libreQs.forEach(q => {
      resp.forEach(r => {
        const v = r.respostas[q.id];
        if (typeof v === 'string' && v.trim()) feedbacks.push(v.trim());
      });
    });

    return { survey: sv, delta, friction, acceptance, feedbacks, totalRespostas: resp.length };
  }, [selectedInnovation, inovacaoSurveys, responses]);

  /* ── Loading ── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-gray-400">
      <Loader2 size={24} className="animate-spin mr-2" /> Carregando dashboard...
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 className="text-violet-500" size={28} /> People Analytics Dashboard
        </h1>
        <p className="text-gray-500 text-sm mt-1">Visão estratégica de clima, eNPS e avaliações de inovação</p>
      </div>

      {/* Hub Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setSelectedHub('clima')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
            selectedHub === 'clima' ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Activity size={18} /> Clima & eNPS
        </button>
        <button onClick={() => setSelectedHub('inovacao')}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all ${
            selectedHub === 'inovacao' ? 'bg-violet-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <Zap size={18} /> Inovações
        </button>
      </div>

      {/* ═══ HUB 1: CLIMA & eNPS ═══ */}
      {selectedHub === 'clima' && (
        <div className="space-y-6">
          {enpsData.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <Activity size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sem dados de eNPS disponíveis.</p>
              <p className="text-sm mt-1">Publique e colete respostas de uma Pesquisa de Pulso para ver os resultados aqui.</p>
            </div>
          ) : (
            <>
              {/* Latest eNPS Gauge */}
              {enpsData.length > 0 && (() => {
                const latest = enpsData[0];
                const zone = classifyENPS(latest.score);
                return (
                  <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-lg font-bold text-gray-900">eNPS Atual</h2>
                      <span className="text-xs text-gray-400">{latest.total} respondentes</span>
                    </div>

                    {/* Score + Zone */}
                    <div className="flex items-center gap-6">
                      <div className={`w-28 h-28 rounded-2xl ${zone.bg} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-4xl font-black text-white">{latest.score > 0 ? '+' : ''}{latest.score}</span>
                      </div>
                      <div>
                        <p className={`text-lg font-bold ${zone.color}`}>{zone.label}</p>
                        <div className="flex gap-6 mt-3">
                          <div className="text-center">
                            <span className="text-xl font-black text-green-600">{latest.promotores}</span>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Promotores</p>
                            <p className="text-xs text-gray-400">{latest.pctProm.toFixed(0)}%</p>
                          </div>
                          <div className="text-center">
                            <span className="text-xl font-black text-gray-500">{latest.neutros}</span>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Neutros</p>
                            <p className="text-xs text-gray-400">{latest.pctNeutro.toFixed(0)}%</p>
                          </div>
                          <div className="text-center">
                            <span className="text-xl font-black text-red-600">{latest.detratores}</span>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Detratores</p>
                            <p className="text-xs text-gray-400">{latest.pctDetr.toFixed(0)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stacked bar */}
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Composição</p>
                      <StackedBar pctProm={latest.pctProm} pctNeutro={latest.pctNeutro} pctDetr={latest.pctDetr} />
                      <div className="flex items-center gap-4 mt-2 text-[10px] text-gray-500">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Promotores (9-10)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-300 rounded-full" /> Neutros (7-8)</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /> Detratores (0-6)</span>
                      </div>
                    </div>

                    {/* Zone reference scale */}
                    <div className="border-t border-gray-100 pt-4">
                      <p className="text-xs font-bold text-gray-500 uppercase mb-2">Escala de Referência</p>
                      <div className="flex rounded-lg overflow-hidden h-5 text-[9px] font-bold text-white">
                        <div className="bg-red-500 flex-1 flex items-center justify-center">-100 a 0</div>
                        <div className="bg-yellow-500 flex-1 flex items-center justify-center">1 a 50</div>
                        <div className="bg-green-400 flex-1 flex items-center justify-center">51 a 75</div>
                        <div className="bg-emerald-600 flex-1 flex items-center justify-center">76 a 100</div>
                      </div>
                      <div className="flex text-[9px] text-gray-400 mt-1">
                        <span className="flex-1 text-center">Crítica</span>
                        <span className="flex-1 text-center">Aperfeiçoamento</span>
                        <span className="flex-1 text-center">Qualidade</span>
                        <span className="flex-1 text-center">Excelência</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* eNPS trend/history */}
              {enpsData.length > 1 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><TrendingUp size={16} /> Histórico eNPS</h3>
                  <div className="space-y-3">
                    {[...enpsData].reverse().map((d, i) => {
                      const zone = classifyENPS(d.score);
                      return (
                        <div key={d.survey.id} className="flex items-center gap-3">
                          <span className="text-xs text-gray-400 w-24 text-right truncate flex-shrink-0">
                            {d.survey.edicao ? `Ed. ${d.survey.edicao}` : d.survey.criadoEm?.toDate?.()?.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) || `#${i + 1}`}
                          </span>
                          <div className={`w-12 text-center font-bold text-sm rounded-lg py-1 ${zone.bg} text-white`}>
                            {d.score > 0 ? '+' : ''}{d.score}
                          </div>
                          <div className="flex-1">
                            <StackedBar pctProm={d.pctProm} pctNeutro={d.pctNeutro} pctDetr={d.pctDetr} />
                          </div>
                          <span className="text-xs text-gray-400 w-12 text-right">{d.total}r</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Climate KPI cards */}
              {climaKPIs.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Target size={16} /> KPIs de Clima</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {climaKPIs.map((kpi, i) => (
                      <div key={i} className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                        <p className="text-xs text-gray-500 leading-snug mb-2">{kpi.label}</p>
                        <div className="flex items-end gap-2">
                          <span className={`text-2xl font-black ${kpi.values[0] >= 70 ? 'text-green-600' : kpi.values[0] >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {kpi.values[0]}%
                          </span>
                          <span className="text-xs text-gray-400 mb-1">favorável</span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">Fonte: {kpi.surveyTitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Qualitative wall */}
              {qualFeedbacks.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-6 space-y-4">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><MessageSquare size={16} /> Mural Qualitativo ({qualFeedbacks.length} comentários)</h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {qualFeedbacks.map((fb, i) => (
                      <div key={i} className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                        <p className="text-sm text-gray-800 leading-relaxed italic">"{fb.text}"</p>
                        <p className="text-[10px] text-violet-500 mt-1 font-medium">{fb.surveyTitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══ HUB 2: INOVAÇÕES ═══ */}
      {selectedHub === 'inovacao' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: innovation list */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Projetos de Inovação</p>
            {inovacaoSurveys.length === 0 && (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
                <Zap size={24} className="mx-auto mb-2 opacity-30" />
                Nenhuma avaliação de inovação criada.
              </div>
            )}
            {inovacaoSurveys.map(sv => (
              <button key={sv.id} onClick={() => setSelectedInnovation(sv.id)}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  selectedInnovation === sv.id
                    ? 'border-violet-500 bg-violet-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-violet-300'
                }`}>
                <p className="text-sm font-bold text-gray-900 truncate">{sv.titulo}</p>
                <p className="text-xs text-gray-400 mt-0.5">{(responses[sv.id]?.length ?? 0)} respostas</p>
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2">
            {!selectedInnovation ? (
              <div className="bg-white border border-dashed border-gray-200 rounded-xl p-10 text-center text-gray-400">
                <ChevronRight size={36} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">Selecione uma inovação para ver os KPIs.</p>
              </div>
            ) : innovationDetail ? (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-gray-900">{innovationDetail.survey.titulo}</h2>
                <p className="text-xs text-gray-400">{innovationDetail.totalRespostas ?? 0} respondentes</p>

                {(innovationDetail.totalRespostas ?? 0) === 0 ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-800">Nenhuma resposta coletada. Publique e aguarde as respostas.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Delta */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase">Delta de Melhoria</p>
                      {innovationDetail.delta ? (
                        <>
                          <div className="flex items-center gap-2">
                            {innovationDetail.delta.delta > 0 ? <ArrowUpRight size={20} className="text-green-600" /> :
                             innovationDetail.delta.delta < 0 ? <ArrowDownRight size={20} className="text-red-600" /> :
                             <Minus size={20} className="text-gray-400" />}
                            <span className={`text-3xl font-black ${
                              innovationDetail.delta.delta > 0 ? 'text-green-600' :
                              innovationDetail.delta.delta < 0 ? 'text-red-600' : 'text-gray-500'
                            }`}>
                              {innovationDetail.delta.delta > 0 ? '+' : ''}{innovationDetail.delta.delta}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 space-y-1">
                            <p>Antes: <span className="font-bold text-gray-700">{innovationDetail.delta.mediaAntes}</span>/10</p>
                            <p>Depois: <span className="font-bold text-gray-700">{innovationDetail.delta.mediaDepois}</span>/10</p>
                          </div>
                          <p className={`text-[10px] font-bold ${
                            innovationDetail.delta.delta > 0 ? 'text-green-600' :
                            innovationDetail.delta.delta < 0 ? 'text-red-600' : 'text-gray-400'
                          }`}>
                            {innovationDetail.delta.delta > 0 ? '✅ Sucesso! Processo melhorou.' :
                             innovationDetail.delta.delta < 0 ? '🚨 Alerta! Processo piorou.' :
                             '⚠️ Impacto neutro.'}
                          </p>
                        </>
                      ) : <p className="text-xs text-gray-400">Sem dados</p>}
                    </div>

                    {/* Friction */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase">Índice de Fricção</p>
                      {innovationDetail.friction ? (
                        <>
                          <span className={`text-3xl font-black ${
                            innovationDetail.friction.pct > 20 ? 'text-red-600' : 'text-green-600'
                          }`}>{innovationDetail.friction.pct}%</span>
                          <p className="text-xs text-gray-500">{innovationDetail.friction.difficult} de {innovationDetail.friction.total} tiveram dificuldade</p>
                          {innovationDetail.friction.pct > 20 && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                              <p className="text-[10px] text-red-700 font-bold">🚨 Fricção &gt; 20% — necessidade de treinamento imediato!</p>
                            </div>
                          )}
                          {innovationDetail.friction.pct <= 20 && (
                            <p className="text-[10px] text-green-600 font-bold">✅ Adaptação bem sucedida!</p>
                          )}
                        </>
                      ) : <p className="text-xs text-gray-400">Sem dados</p>}
                    </div>

                    {/* Acceptance */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                      <p className="text-xs font-bold text-gray-500 uppercase">Taxa de Aceitação</p>
                      {innovationDetail.acceptance ? (
                        <>
                          <span className={`text-3xl font-black ${
                            innovationDetail.acceptance.pct >= 70 ? 'text-green-600' :
                            innovationDetail.acceptance.pct >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`}>{innovationDetail.acceptance.pct}%</span>
                          <p className="text-xs text-gray-500">{innovationDetail.acceptance.satisfied} de {innovationDetail.acceptance.total} satisfeitos</p>
                          <p className={`text-[10px] font-bold ${
                            innovationDetail.acceptance.pct >= 70 ? 'text-green-600' :
                            innovationDetail.acceptance.pct >= 40 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {innovationDetail.acceptance.pct >= 70 ? '✅ Alta aceitação da equipe.' :
                             innovationDetail.acceptance.pct >= 40 ? '⚠️ Aceitação moderada.' :
                             '🚨 Baixa aceitação — revisar comunicação.'}
                          </p>
                        </>
                      ) : <p className="text-xs text-gray-400">Sem dados</p>}
                    </div>
                  </div>
                )}

                {/* Qualitative feedbacks for innovation */}
                {innovationDetail.feedbacks.length > 0 && (
                  <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                    <p className="text-xs font-bold text-gray-500 uppercase">Mural de Sugestões ({innovationDetail.feedbacks.length})</p>
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      {innovationDetail.feedbacks.map((fb, i) => (
                        <div key={i} className="bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5">
                          <p className="text-sm text-gray-800 leading-relaxed italic">"{fb}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyDashboard;

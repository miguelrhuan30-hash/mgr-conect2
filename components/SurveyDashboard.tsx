import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, Survey, SurveyResponse } from '../types';
import { BarChart3, TrendingUp, TrendingDown, Minus, Users, MessageCircle, AlertTriangle, CheckCircle2, Loader2, ChevronRight } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function eNPSZone(score: number): { label: string; color: string; bg: string } {
  if (score <= 0)  return { label: 'Crítico',         color: 'text-red-700',    bg: 'bg-red-100'    };
  if (score <= 50) return { label: 'Aperfeiçoamento', color: 'text-amber-700',  bg: 'bg-amber-100'  };
  if (score <= 75) return { label: 'Qualidade',       color: 'text-green-700',  bg: 'bg-green-100'  };
  return             { label: 'Excelência',           color: 'text-emerald-700',bg: 'bg-emerald-100'};
}

interface KpiCardProps { label: string; value: string | number; subtitle?: string; color?: string; trend?: 'up' | 'down' | 'flat' }
const KpiCard: React.FC<KpiCardProps> = ({ label, value, subtitle, color = 'text-violet-700', trend }) => (
  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
    <div className="flex items-end gap-2">
      <p className={`text-3xl font-extrabold ${color}`}>{value}</p>
      {trend === 'up'   && <TrendingUp size={18} className="text-green-500 mb-1" />}
      {trend === 'down' && <TrendingDown size={18} className="text-red-500 mb-1" />}
      {trend === 'flat' && <Minus size={18} className="text-gray-400 mb-1" />}
    </div>
    {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   ENPS GAUGE
───────────────────────────────────────────────────────────────────────────── */
const ENPSGauge: React.FC<{ score: number; promotores: number; neutros: number; detratores: number; total: number }> = ({
  score, promotores, neutros, detratores, total,
}) => {
  const zone = eNPSZone(score);
  const pPct = total > 0 ? Math.round((promotores / total) * 100) : 0;
  const nPct = total > 0 ? Math.round((neutros / total) * 100) : 0;
  const dPct = total > 0 ? Math.round((detratores / total) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">Score eNPS</h3>
        <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${zone.bg} ${zone.color}`}>{zone.label}</span>
      </div>
      <div className="text-center">
        <p className={`text-6xl font-black ${zone.color}`}>{score > 0 ? `+${score}` : score}</p>
        <p className="text-xs text-gray-400 mt-1">{total} respondentes</p>
      </div>
      {/* Stacked bar */}
      {total > 0 && (
        <div>
          <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
            <div className="bg-green-500 transition-all duration-500" style={{ width: `${pPct}%` }} title={`Promotores ${pPct}%`} />
            <div className="bg-amber-300 transition-all duration-500" style={{ width: `${nPct}%` }} title={`Neutros ${nPct}%`} />
            <div className="bg-red-400 transition-all duration-500" style={{ width: `${dPct}%` }} title={`Detratores ${dPct}%`} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-500 mt-1.5">
            <span>🟢 Promotores {pPct}%</span>
            <span>🟡 Neutros {nPct}%</span>
            <span>🔴 Detratores {dPct}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   INOVATION PANEL
───────────────────────────────────────────────────────────────────────────── */
interface InovacaoStats {
  delta: number | null;
  friccao: number | null;
  aceitacao: number | null;
  comentarios: string[];
  total: number;
}

const InovacaoPanel: React.FC<{ survey: Survey; responses: SurveyResponse[] }> = ({ survey, responses }) => {
  const stats: InovacaoStats = useMemo(() => {
    const total = responses.length;
    if (total === 0) return { delta: null, friccao: null, aceitacao: null, comentarios: [], total: 0 };

    const qAntes   = survey.perguntas.find(q => q.kpiTipo === 'delta_melhoria_antes');
    const qDepois  = survey.perguntas.find(q => q.kpiTipo === 'delta_melhoria_depois');
    const qFric    = survey.perguntas.find(q => q.kpiTipo === 'indice_friccao');
    const qAceit   = survey.perguntas.find(q => q.kpiTipo === 'taxa_satisfacao');
    const qComent  = survey.perguntas.find(q => q.kpiTipo === 'mural_qualitativo');

    const avg = (qId: string) => {
      const vals = responses.map(r => Number(r.respostas[qId])).filter(v => !isNaN(v) && v >= 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const delta = (qAntes && qDepois)
      ? (() => { const a = avg(qAntes.id); const d = avg(qDepois.id); return a !== null && d !== null ? +(d - a).toFixed(1) : null; })()
      : null;

    // Fricção: % respondentes que escolheram opção 1 ou 2 (texto começa com "1" ou "2")
    let friccao: number | null = null;
    if (qFric) {
      const vals = responses.map(r => String(r.respostas[qFric.id] ?? ''));
      const hard = vals.filter(v => v.startsWith('1') || v.startsWith('2')).length;
      friccao = vals.length > 0 ? Math.round((hard / vals.length) * 100) : null;
    }

    // Aceitação: % "Satisfeito" ou "Muito Satisfeito"
    let aceitacao: number | null = null;
    if (qAceit) {
      const vals = responses.map(r => String(r.respostas[qAceit.id] ?? ''));
      const pos = vals.filter(v => v === 'Satisfeito' || v === 'Muito Satisfeito').length;
      aceitacao = vals.length > 0 ? Math.round((pos / vals.length) * 100) : null;
    }

    // Comentários
    const comentarios = qComent
      ? responses.map(r => String(r.respostas[qComent.id] ?? '')).filter(c => c.trim().length > 0)
      : [];

    return { delta, friccao, aceitacao, comentarios, total };
  }, [survey, responses]);

  const deltaColor = stats.delta === null ? 'text-gray-400'
    : stats.delta > 0  ? 'text-green-600'
    : stats.delta === 0 ? 'text-amber-500'
    : 'text-red-600';

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">{stats.total} respondente{stats.total !== 1 ? 's' : ''}</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Delta */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">⭐ Delta de Melhoria</p>
          <p className={`text-4xl font-black ${deltaColor}`}>
            {stats.delta === null ? '—' : stats.delta > 0 ? `+${stats.delta}` : stats.delta}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats.delta === null ? '' : stats.delta > 0 ? '✅ Melhora percebida' : stats.delta === 0 ? '⚠️ Impacto neutro' : '🔴 Requer revisão'}
          </p>
        </div>

        {/* Fricção */}
        <div className={`rounded-2xl p-4 shadow-sm text-center border ${(stats.friccao ?? 0) > 20 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Índice de Fricção</p>
          <p className={`text-4xl font-black ${(stats.friccao ?? 0) > 20 ? 'text-red-600' : 'text-gray-800'}`}>
            {stats.friccao !== null ? `${stats.friccao}%` : '—'}
          </p>
          {(stats.friccao ?? 0) > 20 && (
            <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center justify-center gap-1">
              <AlertTriangle size={10} /> Treinamento indicado
            </p>
          )}
        </div>

        {/* Aceitação */}
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm text-center">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Taxa de Aceitação</p>
          <p className={`text-4xl font-black ${(stats.aceitacao ?? 0) >= 70 ? 'text-green-600' : (stats.aceitacao ?? 0) >= 50 ? 'text-amber-500' : 'text-red-600'}`}>
            {stats.aceitacao !== null ? `${stats.aceitacao}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">
            {stats.aceitacao !== null && (stats.aceitacao >= 70 ? '✅ Boa aceitação' : stats.aceitacao >= 50 ? '⚠️ Aceitação moderada' : '🔴 Resistência significativa')}
          </p>
        </div>
      </div>

      {/* Mural qualitativo */}
      {stats.comentarios.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><MessageCircle size={14} /> Mural de Sugestões ({stats.comentarios.length})</h4>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {stats.comentarios.map((c, i) => (
              <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 text-sm text-gray-700 leading-relaxed">
                "{c}"
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────────────────────────────────────── */
const SurveyDashboard: React.FC = () => {
  const [surveys, setSurveys]   = useState<Survey[]>([]);
  const [responses, setResponses] = useState<Record<string, SurveyResponse[]>>({});
  const [loading, setLoading]   = useState(true);
  const [hub, setHub]           = useState<'clima' | 'inovacoes'>('clima');
  const [activeProject, setActiveProject] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const snap = await getDocs(collection(db, CollectionName.SURVEYS));
        const svs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Survey);
        setSurveys(svs);
        // load responses per survey
        const allResponses: Record<string, SurveyResponse[]> = {};
        await Promise.all(svs.map(async sv => {
          const rq = query(collection(db, CollectionName.SURVEY_RESPONSES), where('surveyId', '==', sv.id));
          const rs = await getDocs(rq);
          allResponses[sv.id] = rs.docs.map(d => ({ id: d.id, ...d.data() }) as SurveyResponse);
        }));
        setResponses(allResponses);
      } catch (err) {
        console.error('Erro ao carregar dashboard:', err);
      } finally { setLoading(false); }
    };
    run();
  }, []);

  /* ── Compute eNPS from all 'pulso' + 'transicao' surveys ── */
  const { enpsScore, promotores, neutros, detratores, totalENPS, kpiSummary } = useMemo(() => {
    const climaSurveys = surveys.filter(s => s.tipo !== 'inovacao');
    let p = 0, n = 0, d = 0;
    const recursosCounts: Record<string, number> = {};
    const bemEstarCounts: Record<string, number> = {};
    const segPsiCounts:   Record<string, number> = {};

    climaSurveys.forEach(sv => {
      const rs = responses[sv.id] ?? [];
      const enpsQ = sv.perguntas.find(q => q.kpiTipo === 'enps_score');
      if (enpsQ) {
        rs.forEach(r => {
          const v = Number(r.respostas[enpsQ.id]);
          if (isNaN(v)) return;
          if (v <= 6) d++; else if (v <= 8) n++; else p++;
        });
      }
      // Sum other KPIs
      sv.perguntas.forEach(q => {
        rs.forEach(r => {
          const val = String(r.respostas[q.id] ?? '');
          if (!val) return;
          if (q.kpiTipo === 'percentual_favoravel' && q.texto.toLowerCase().includes('recurso')) {
            recursosCounts[val] = (recursosCounts[val] ?? 0) + 1;
          }
          if (q.kpiTipo === 'percentual_favoravel' && q.texto.toLowerCase().includes('volume')) {
            bemEstarCounts[val] = (bemEstarCounts[val] ?? 0) + 1;
          }
          if (q.kpiTipo === 'percentual_favoravel' && q.texto.toLowerCase().includes('segur')) {
            segPsiCounts[val] = (segPsiCounts[val] ?? 0) + 1;
          }
        });
      });
    });

    const total = p + n + d;
    const score = total > 0 ? Math.round(((p - d) / total) * 100) : 0;

    // quick favorable % helper
    const favPct = (counts: Record<string, number>, posKeys: string[]) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const pos = posKeys.reduce((sum, k) => sum + (counts[k] ?? 0), 0);
      return total > 0 ? Math.round((pos / total) * 100) : null;
    };

    return {
      enpsScore: score, promotores: p, neutros: n, detratores: d, totalENPS: total,
      kpiSummary: {
        recursos: favPct(recursosCounts, ['Na maioria das vezes sim', 'Sim, tive tudo o que precisei']),
        bemEstar: favPct(bemEstarCounts, ['Volume adequado e equilibrado', 'Volume baixo, poderia assumir mais demandas']),
        segPsi:   favPct(segPsiCounts,   ['Provavelmente sim', 'Definitivamente sim']),
      }
    };
  }, [surveys, responses]);

  const inovacaoSurveys = surveys.filter(s => s.tipo === 'inovacao');

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px] text-gray-400">
      <Loader2 size={22} className="animate-spin mr-2" /> Carregando dashboard...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="text-violet-500" size={28} /> Dashboard People Analytics
          </h1>
          <p className="text-gray-500 text-sm mt-1">Dados agrupados e anônimos · {surveys.length} pesquisas registradas</p>
        </div>
        {/* HUB selector */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          {(['clima', 'inovacoes'] as const).map(h => (
            <button key={h} onClick={() => setHub(h)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${hub === h ? 'bg-white shadow text-violet-700' : 'text-gray-500 hover:text-gray-700'}`}>
              {h === 'clima' ? '🌡️ Clima & eNPS' : '🚀 Inovações'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── HUB 1: CLIMA & eNPS ─── */}
      {hub === 'clima' && (
        <div className="space-y-5">
          {totalENPS === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400">
              <BarChart3 size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma resposta de clima ainda.</p>
              <p className="text-sm mt-1">Publique uma pesquisa de Pulso ou Transição para ver os dados.</p>
            </div>
          ) : (
            <>
              <ENPSGauge score={enpsScore} promotores={promotores} neutros={neutros} detratores={detratores} total={totalENPS} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <KpiCard label="Índice de Recursos"
                  value={kpiSummary.recursos !== null ? `${kpiSummary.recursos}%` : '—'}
                  subtitle="% favorável" color={kpiSummary.recursos !== null && kpiSummary.recursos >= 70 ? 'text-green-600' : 'text-amber-500'}
                  trend={kpiSummary.recursos !== null && kpiSummary.recursos >= 70 ? 'up' : 'flat'} />
                <KpiCard label="Índice de Bem-Estar"
                  value={kpiSummary.bemEstar !== null ? `${kpiSummary.bemEstar}%` : '—'}
                  subtitle="% com volume adequado" color={kpiSummary.bemEstar !== null && kpiSummary.bemEstar >= 70 ? 'text-green-600' : 'text-amber-500'}
                  trend={kpiSummary.bemEstar !== null && kpiSummary.bemEstar >= 70 ? 'up' : 'flat'} />
                <KpiCard label="Segurança Psicológica"
                  value={kpiSummary.segPsi !== null ? `${kpiSummary.segPsi}%` : '—'}
                  subtitle="% se sentem seguros" color={kpiSummary.segPsi !== null && kpiSummary.segPsi >= 70 ? 'text-green-600' : 'text-red-500'}
                  trend={kpiSummary.segPsi !== null && kpiSummary.segPsi >= 70 ? 'up' : 'down'} />
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── HUB 2: INOVAÇÕES ─── */}
      {hub === 'inovacoes' && (
        <div className="flex gap-4 flex-col sm:flex-row">
          {/* Project list */}
          <div className="sm:w-56 flex-shrink-0 space-y-2">
            <p className="text-xs font-bold text-gray-500 uppercase px-1">Projetos</p>
            {inovacaoSurveys.length === 0 && (
              <p className="text-xs text-gray-400 px-1">Nenhuma avaliação de inovação criada ainda.</p>
            )}
            {inovacaoSurveys.map(sv => (
              <button key={sv.id} onClick={() => setActiveProject(sv.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  activeProject === sv.id
                    ? 'border-violet-500 bg-violet-50 text-violet-800'
                    : 'border-gray-200 text-gray-700 hover:border-violet-300 bg-white'
                }`}>
                <p className="truncate">{sv.titulo}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{(responses[sv.id] ?? []).length} respostas</p>
              </button>
            ))}
          </div>
          {/* Project detail */}
          <div className="flex-1 min-w-0">
            {activeProject ? (
              (() => {
                const sv = inovacaoSurveys.find(s => s.id === activeProject);
                if (!sv) return null;
                return (
                  <div className="space-y-3">
                    <h2 className="text-base font-bold text-gray-900">{sv.titulo}</h2>
                    <InovacaoPanel survey={sv} responses={responses[sv.id] ?? []} />
                  </div>
                );
              })()
            ) : (
              <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-12 text-center text-gray-400 h-full flex flex-col items-center justify-center">
                <ChevronRight size={28} className="mb-2 opacity-30" />
                <p className="text-sm">Selecione um projeto à esquerda</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SurveyDashboard;

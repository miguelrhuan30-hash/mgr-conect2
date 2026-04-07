/**
 * components/ProjectUpsell.tsx — Sprint Projetos v2
 *
 * Dashboard de projetos não aprovados com estratégia de reabordagem.
 * Filtros, KPIs, timeline de tentativas, ações de reabertura.
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XCircle, RotateCcw, Search, Loader2, Briefcase,
  TrendingUp, DollarSign, Clock, Filter, ChevronRight, PieChart, Download,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import {
  PROJECT_PHASE_LABELS, NAO_APROVADO_MOTIVOS, PROJECT_TYPES,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts?.seconds * 1000);
    return format(d, "dd/MM/yy", { locale: ptBR });
  } catch { return '—'; }
};

const ProjectUpsell: React.FC = () => {
  const navigate = useNavigate();
  const { projects, reopenProject } = useProject();
  const [search, setSearch] = useState('');
  const [motivoFilter, setMotivoFilter] = useState('todos');
  const [showReabrir, setShowReabrir] = useState<string | null>(null);
  const [reabrirAbordagem, setReabrirAbordagem] = useState('');
  const [reabrirLoading, setReabrirLoading] = useState(false);

  // Filtrar projetos não aprovados
  const naoAprovados = useMemo(() => {
    let result = projects.filter((p) => p.fase === 'nao_aprovado');
    if (motivoFilter !== 'todos') {
      result = result.filter((p) => p.naoAprovadoData?.motivoId === motivoFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) => p.nome.toLowerCase().includes(q) || p.clientName.toLowerCase().includes(q),
      );
    }
    return result;
  }, [projects, motivoFilter, search]);

  // KPIs
  const totalNaoAprovados = projects.filter((p) => p.fase === 'nao_aprovado').length;
  const valorPotencial = projects
    .filter((p) => p.fase === 'nao_aprovado')
    .reduce((sum, p) => sum + (p.valorContrato || 0), 0);
  const totalReabertos = projects.filter(
    (p) => p.naoAprovadoData?.tentativasReabertura && p.naoAprovadoData.tentativasReabertura.length > 0,
  ).length;
  // Taxa de recuperação: projetos que foram reabertos E agora estão em fase ativa (não nao_aprovado)
  const recuperados = projects.filter(
    (p) => p.naoAprovadoData?.tentativasReabertura?.length && p.fase !== 'nao_aprovado'
  ).length;
  const taxaRecuperacao = totalReabertos + recuperados > 0
    ? Math.round((recuperados / (totalReabertos + recuperados)) * 100)
    : 0;

  // Motivos com contagem
  const motivoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.filter((p) => p.fase === 'nao_aprovado').forEach((p) => {
      const motivo = p.naoAprovadoData?.motivoId || 'desconhecido';
      counts[motivo] = (counts[motivo] || 0) + 1;
    });
    return counts;
  }, [projects]);

  // Motivos ranqueados por ocorrência
  const motivosRanked = useMemo(() =>
    Object.entries(motivoCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => ({
        id, count,
        label: NAO_APROVADO_MOTIVOS.find(m => m.id === id)?.label || id,
        pct: totalNaoAprovados > 0 ? Math.round((count / totalNaoAprovados) * 100) : 0,
      }))
  , [motivoCounts, totalNaoAprovados]);

  // Export CSV
  const exportarCSV = () => {
    const rows = [
      ['Projeto', 'Cliente', 'Tipo', 'Motivo', 'Valor', 'Fase Parou', 'Tentativas', 'Data Não Aprovado'],
      ...naoAprovados.map((p: any) => [
        p.nome, p.clientName,
        PROJECT_TYPES.find(t => t.slug === p.tipoProjetoSlug)?.label || p.tipoProjetoSlug,
        NAO_APROVADO_MOTIVOS.find(m => m.id === p.naoAprovadoData?.motivoId)?.label || '',
        p.valorContrato || 0,
        (PROJECT_PHASE_LABELS as Record<string, string>)[p.naoAprovadoData?.faseParou || ''] || '',
        p.naoAprovadoData?.tentativasReabertura?.length || 0,
        p.naoAprovadoData?.registradoEm ? format((p.naoAprovadoData.registradoEm.toDate ? p.naoAprovadoData.registradoEm.toDate() : new Date()), 'dd/MM/yyyy') : '',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `nao_aprovados_${format(new Date(), 'yyyyMMdd')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const handleReabrir = async () => {
    if (!showReabrir || !reabrirAbordagem.trim()) return;
    setReabrirLoading(true);
    await reopenProject(showReabrir, reabrirAbordagem);
    setReabrirLoading(false);
    setShowReabrir(null);
    setReabrirAbordagem('');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <XCircle className="w-6 h-6 text-gray-500" />
            Projetos Não Aprovados
          </h1>
          <p className="text-sm text-gray-500">Estratégias de reabordagem e upsell · {naoAprovados.length} exibidos de {totalNaoAprovados}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={() => navigate('/app/projetos-v2')}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50"
          >
            <Briefcase className="w-4 h-4" />
            Todos os Projetos
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="w-4 h-4 text-gray-500" />
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Total</span>
          </div>
          <p className="text-2xl font-extrabold text-gray-900">{totalNaoAprovados}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">não aprovados</p>
        </div>
        <div className="bg-rose-50 rounded-2xl p-4 border border-rose-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-rose-600" />
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide">Valor Perdido</span>
          </div>
          <p className="text-lg font-extrabold text-rose-700">
            R$ {(valorPotencial / 1000).toFixed(0)}k
          </p>
          <p className="text-[10px] text-rose-400 mt-0.5">em projetos perdidos</p>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Reabertos</span>
          </div>
          <p className="text-2xl font-extrabold text-emerald-700">{totalReabertos}</p>
          <p className="text-[10px] text-emerald-400 mt-0.5">tentativas de reabordagem</p>
        </div>
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <PieChart className="w-4 h-4 text-blue-600" />
            <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Recuperação</span>
          </div>
          <p className="text-2xl font-extrabold text-blue-700">{taxaRecuperacao}%</p>
          <p className="text-[10px] text-blue-400 mt-0.5">{recuperados} proj. recuperados</p>
        </div>
      </div>

      {/* Análise por Motivo — Sprint 9 */}
      {motivosRanked.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-extrabold text-gray-900 mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-gray-500" /> Principais Motivos de Não Aprovado
          </p>
          <div className="space-y-2.5">
            {motivosRanked.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3">
                <span className="text-[10px] font-bold text-gray-400 w-5 text-right">{i + 1}.</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-700">{m.label}</span>
                    <span className="text-xs font-extrabold text-gray-900">{m.count} ({m.pct}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-rose-400 transition-all"
                      style={{ width: `${m.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center gap-2 flex-shrink-0">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={motivoFilter}
            onChange={(e) => setMotivoFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-medium"
          >
            <option value="todos">Todos os motivos</option>
            {NAO_APROVADO_MOTIVOS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({motivoCounts[m.id] || 0})
              </option>
            ))}
          </select>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar projeto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl"
          />
        </div>
      </div>

      {/* Lista */}
      {naoAprovados.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <XCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">Nenhum projeto não aprovado encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {naoAprovados.map((project) => {
            const motivo = NAO_APROVADO_MOTIVOS.find((m) => m.id === project.naoAprovadoData?.motivoId);
            const tentativas = project.naoAprovadoData?.tentativasReabertura || [];
            return (
              <div key={project.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{project.nome}</h3>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">
                        {motivo?.label || 'Motivo não informado'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {project.clientName} · {PROJECT_TYPES.find((t) => t.slug === project.tipoProjetoSlug)?.label || project.tipoProjetoSlug}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {project.valorContrato != null && project.valorContrato > 0 && (
                      <p className="text-sm font-extrabold text-gray-900">
                        R$ {project.valorContrato.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400">
                      Parou em: {PROJECT_PHASE_LABELS[project.naoAprovadoData?.faseParou || 'lead_capturado']}
                    </p>
                  </div>
                </div>

                {project.naoAprovadoData?.detalhes && (
                  <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg p-2">
                    💬 {project.naoAprovadoData.detalhes}
                  </p>
                )}

                {/* Tentativas de reabertura */}
                {tentativas.length > 0 && (
                  <div className="mb-3 border-l-2 border-emerald-200 pl-3 space-y-1">
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">
                      Tentativas de Reabertura ({tentativas.length})
                    </p>
                    {tentativas.map((t, i) => (
                      <p key={i} className="text-xs text-gray-500">
                        {fmtDate(t.data)} — <span className="font-medium">{t.porNome}:</span> {t.novaAbordagem}
                      </p>
                    ))}
                  </div>
                )}

                {/* Ações */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setShowReabrir(project.id); setReabrirAbordagem(''); }}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reabrir
                  </button>
                  <button
                    onClick={() => navigate(`/app/projetos-v2/${project.id}`)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50"
                  >
                    Ver Detalhes
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Reabrir */}
      {showReabrir && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                Reabrir Projeto
              </h3>
              <p className="text-xs text-gray-500 mt-1">O projeto voltará para "Em Levantamento".</p>
            </div>
            <div className="p-5">
              <label className="text-xs font-bold text-gray-600 block mb-1">Nova abordagem / Estratégia *</label>
              <textarea
                value={reabrirAbordagem}
                onChange={(e) => setReabrirAbordagem(e.target.value)}
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
                placeholder="Ex: Cliente retomou contato, oferecemos 10% de desconto no valor total..."
              />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
              <button onClick={() => setShowReabrir(null)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={handleReabrir}
                disabled={!reabrirAbordagem.trim() || reabrirLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
              >
                {reabrirLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Reabrir Projeto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectUpsell;

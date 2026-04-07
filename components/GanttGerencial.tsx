/**
 * components/GanttGerencial.tsx — Sprint 4
 *
 * Visão macro de todos os projetos ativos em execução.
 * Cada linha = 1 projeto com suas fases planejadas mapeadas como barras.
 * Permite ver sobreposição de projetos, identificar gargalos de equipe.
 * Filtros: mês/trimestre/semestre. Código de cor por fase do projeto.
 */
import React, { useState, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, RefreshCw, Filter,
  Building2, ExternalLink, Download, Printer,
} from 'lucide-react';
import {
  collection, onSnapshot, query, where, orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  format, startOfMonth, endOfMonth, addMonths, subMonths,
  differenceInDays, startOfDay, isBefore, isAfter, addDays, parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { CollectionName, ProjectV2, PROJECT_PHASE_LABELS, PROJECT_PHASE_COLORS } from '../types';
import type { GanttFase } from '../hooks/useProjectOS';

interface ProjectWithGantt extends ProjectV2 {
  ganttFases?: GanttFase[];
}

// ── Helpers ──
const toDate = (ts: Timestamp | any | null | undefined): Date | null => {
  if (!ts) return null;
  try { return ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000); }
  catch { return null; }
};

const Phase = () => null; // unused

// ── Calcular span visível ──
const calcSpan = (startRef: Date, days: number) => ({
  start: startRef,
  end: addDays(startRef, days),
  totalDays: days,
});

// ── Tooltip de projeto ──
const GanttTooltip: React.FC<{
  projeto: ProjectWithGantt;
  x: number; y: number;
}> = ({ projeto, x, y }) => {
  const fases = projeto.ganttFases || [];
  const concluidas = fases.filter(f => !!f.dataFimReal).length;
  const pct = fases.length > 0 ? Math.round((concluidas / fases.length) * 100) : null;
  const ini = fases.length > 0 ? toDate(fases[0].dataInicioPrevista) : toDate(projeto.createdAt);
  const fim = fases.length > 0 ? toDate(fases[fases.length - 1].dataFimPrevista) : null;
  return (
    <div className="fixed z-[9999] pointer-events-none"
      style={{ left: Math.min(x + 12, window.innerWidth - 230), top: Math.max(y - 80, 8) }}>
      <div className="bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 p-3 w-52 text-left">
        <p className="text-xs font-extrabold truncate">{projeto.nome}</p>
        <p className="text-[10px] text-gray-300 truncate mt-0.5">{projeto.clientName}</p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Fase</span>
            <span className="font-bold text-gray-100">{PROJECT_PHASE_LABELS[projeto.fase]}</span>
          </div>
          {ini && <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Início</span>
            <span className="font-bold text-gray-100">{format(ini, 'dd/MM/yy')}</span>
          </div>}
          {fim && <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Prev. Fim</span>
            <span className="font-bold text-gray-100">{format(fim, 'dd/MM/yy')}</span>
          </div>}
          {projeto.valorContrato ? <div className="flex justify-between text-[10px]">
            <span className="text-gray-400">Valor</span>
            <span className="font-bold text-emerald-400">R$ {(projeto.valorContrato/1000).toFixed(0)}k</span>
          </div> : null}
          {pct !== null && (
            <div className="mt-1.5">
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-gray-400">Progresso</span>
                <span className="font-bold text-gray-100">{pct}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div className="h-1.5 rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Bar do projeto ──
const ProjectBar: React.FC<{
  projeto: ProjectWithGantt;
  span: { start: Date; end: Date; totalDays: number };
  onClick: () => void;
  onHover: (projeto: ProjectWithGantt | null, x: number, y: number) => void;
}> = ({ projeto, span, onClick, onHover }) => {
  const { ganttFases = [] } = projeto;
  const hoje = new Date();

  // Se não tiver fases Gantt, usa a criação e previsão do projeto
  if (ganttFases.length === 0) {
    const criacao = toDate(projeto.createdAt);
    if (!criacao) return null;
    const estimado = addDays(criacao, 60);
    const left = Math.max(0, differenceInDays(criacao, span.start));
    const width = Math.max(2, differenceInDays(estimado, criacao));
    const leftPct = (left / span.totalDays) * 100;
    const widthPct = (width / span.totalDays) * 100;
    if (leftPct > 100 || leftPct + widthPct < 0) return null;

    const phaseColor = (PROJECT_PHASE_COLORS[projeto.fase] || '#6366f1');
    return (
      <div className="absolute top-1 bottom-1 rounded-lg opacity-80 cursor-pointer hover:opacity-100 transition-opacity flex items-center overflow-hidden"
        style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`, backgroundColor: phaseColor }}
        onClick={onClick}
        onMouseEnter={e => onHover(projeto, e.clientX, e.clientY)}
        onMouseMove={e => onHover(projeto, e.clientX, e.clientY)}
        onMouseLeave={() => onHover(null, 0, 0)}
        title={`${projeto.clientName} — ${PROJECT_PHASE_LABELS[projeto.fase]}`}>
        <span className="text-white text-[10px] font-bold px-2 truncate">{projeto.clientName}</span>
      </div>
    );
  }

  // Renderiza barras por cada fase do Gantt
  return (
    <>
      {ganttFases.map(f => {
        const ini = toDate(f.dataInicioPrevista) ?? toDate(f.dataInicioReal);
        const fim = toDate(f.dataFimPrevista) ?? toDate(f.dataFimReal);
        if (!ini || !fim) return null;

        const left = differenceInDays(ini, span.start);
        const width = Math.max(1, differenceInDays(fim, ini));
        const leftPct = (left / span.totalDays) * 100;
        const widthPct = (width / span.totalDays) * 100;
        if (leftPct > 100 || leftPct + widthPct < 0) return null;

        const isReal = !!f.dataFimReal;
        const atrasado = !isReal && fim < hoje;
        const bgColor = f.party === 'mgr'
          ? isReal ? '#10b981' : atrasado ? '#ef4444' : '#6366f1'
          : isReal ? '#10b981' : '#f97316';

        return (
          <div key={f.id}
            className="absolute top-2 bottom-2 rounded opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
            style={{
              left: `${Math.max(0, leftPct)}%`,
              width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%`,
              backgroundColor: bgColor,
            }}
            onClick={onClick}
            title={`${projeto.clientName} — ${f.label} (${f.party === 'mgr' ? 'MGR' : 'Cliente'})`}>
          </div>
        );
      })}
    </>
  );
};

// ── Componente principal ──
const GanttGerencial: React.FC = () => {
  const navigate = useNavigate();
  const [projetos, setProjetos] = useState<ProjectWithGantt[]>([]);
  const [loading, setLoading] = useState(true);
  const [mesBase, setMesBase] = useState(new Date());
  const [periodo, setPeriodo] = useState<30 | 90 | 180>(90);
  const [filtroFase, setFiltroFase] = useState<string>('');
  const [tooltip, setTooltip] = useState<{ projeto: ProjectWithGantt; x: number; y: number } | null>(null);
  const handleHover = (projeto: ProjectWithGantt | null, x: number, y: number) => {
    setTooltip(projeto ? { projeto, x, y } : null);
  };

  // Carregar projetos ativos
  React.useEffect(() => {
    const unwantedFases = ['concluido', 'nao_aprovado', 'lead_capturado'];
    const q = query(
      collection(db, CollectionName.PROJECTS_V2),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as ProjectWithGantt))
        .filter(p => !unwantedFases.includes(p.fase));
      setProjetos(list);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  const span = useMemo(() => {
    const start = startOfDay(startOfMonth(mesBase));
    return calcSpan(start, periodo);
  }, [mesBase, periodo]);

  const projetosFiltrados = filtroFase
    ? projetos.filter(p => p.fase === filtroFase)
    : projetos;

  // Cabeçalho de meses/semanas
  const monthHeaders = useMemo(() => {
    const months: { label: string; widthPct: number }[] = [];
    let cursor = span.start;
    while (isBefore(cursor, span.end)) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const endSlice = isAfter(nextMonth, span.end) ? span.end : nextMonth;
      const days = differenceInDays(endSlice, cursor);
      months.push({
        label: format(cursor, 'MMM yyyy', { locale: ptBR }),
        widthPct: (days / span.totalDays) * 100,
      });
      cursor = nextMonth;
    }
    return months;
  }, [span]);

  const hojeLeft = ((differenceInDays(new Date(), span.start) / span.totalDays) * 100);

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportGanttCSV = () => {
    const rows: string[][] = [
      ['Projeto', 'Cliente', 'Fase', 'Tipo', 'Início Previsto', 'Fim Previsto', 'Progresso (%)'],
      ...projetosFiltrados.map(p => {
        const fases = p.ganttFases || [];
        const ini = fases.length > 0 ? toDate(fases[0].dataInicioPrevista) : toDate(p.createdAt);
        const fim = fases.length > 0 ? toDate(fases[fases.length - 1].dataFimPrevista) : null;
        const concluidas = fases.filter(f => !!f.dataFimReal).length;
        const pct = fases.length > 0 ? Math.round((concluidas / fases.length) * 100) : 0;
        return [
          p.nome, p.clientName,
          PROJECT_PHASE_LABELS[p.fase] || p.fase,
          p.tipoProjetoSlug,
          ini ? format(ini, 'dd/MM/yyyy') : '',
          fim ? format(fim, 'dd/MM/yyyy') : '',
          String(pct),
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `gantt_gerencial_${format(new Date(), 'yyyyMMdd')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // ── Print / PDF ─────────────────────────────────────────────────────────────
  const printGantt = () => {
    const hoje = format(new Date(), "dd/MM/yyyy");
    const rows = projetosFiltrados.map(p => {
      const fases = p.ganttFases || [];
      const ini = fases.length > 0 ? toDate(fases[0].dataInicioPrevista) : toDate(p.createdAt);
      const fim = fases.length > 0 ? toDate(fases[fases.length - 1].dataFimPrevista) : null;
      const concluidas = fases.filter(f => !!f.dataFimReal).length;
      const pct = fases.length > 0 ? Math.round((concluidas / fases.length) * 100) : 0;
      return `<tr style="border-bottom:1px solid #f0f0f0">
        <td style="padding:6px 8px;font-size:12px;font-weight:600">${p.nome}</td>
        <td style="padding:6px 8px;font-size:12px">${p.clientName}</td>
        <td style="padding:6px 8px;font-size:12px">${PROJECT_PHASE_LABELS[p.fase] || p.fase}</td>
        <td style="padding:6px 8px;font-size:12px">${ini ? format(ini, 'dd/MM/yy') : '—'}</td>
        <td style="padding:6px 8px;font-size:12px">${fim ? format(fim, 'dd/MM/yy') : '—'}</td>
        <td style="padding:6px 8px;font-size:12px;text-align:center">
          <div style="width:100%;background:#f0f0f0;border-radius:4px;height:8px">
            <div style="width:${pct}%;background:#10b981;height:8px;border-radius:4px"></div>
          </div>
          <span style="font-size:10px;color:#6b7280">${pct}%</span>
        </td>
      </tr>`;
    }).join('');
    const html = `<!DOCTYPE html>
    <html lang="pt-BR"><head><meta charset="UTF-8"/><title>Gantt Gerencial - ${hoje}</title>
    <style>@page{size:A4 landscape;margin:15mm 10mm}body{font-family:system-ui,sans-serif;color:#111}
    table{width:100%;border-collapse:collapse}th{background:#f9fafb;font-size:11px;text-transform:uppercase;letter-spacing:.5px;padding:8px;text-align:left;border-bottom:2px solid #e5e7eb}
    @media print{button{display:none!important}}</style></head>
    <body>
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #2563eb;padding-bottom:12px;margin-bottom:20px">
        <div><div style="font-size:18px;font-weight:900;color:#2563eb">MGR Refrigeração</div>
          <div style="font-size:14px;font-weight:700;margin-top:4px">Gantt Gerencial</div></div>
        <div style="font-size:11px;color:#6b7280">Emitido em: ${hoje} · ${projetosFiltrados.length} projetos</div>
      </div>
      <table><thead><tr><th>Projeto</th><th>Cliente</th><th>Fase</th><th>Início</th><th>Fim</th><th>Progresso</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`;
    const win = window.open('', '_blank', 'width=1000,height=700');
    if (win) { win.document.write(html); win.document.close(); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <RefreshCw className="w-6 h-6 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header + Controlers */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
            📊 Gantt Gerencial
          </h2>
          <p className="text-xs text-gray-500">{projetosFiltrados.length} projetos ativos</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Export + Print */}
          <button onClick={exportGanttCSV}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={printGantt}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Imprimir
          </button>
          {/* Filtro fase */}
          <select value={filtroFase} onChange={e => setFiltroFase(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold text-gray-600 outline-none focus:ring-2 focus:ring-brand-500">
            <option value="">Todas as fases</option>
            {['em_levantamento', 'em_cotacao', 'contrato_assinado', 'em_planejamento', 'os_distribuidas', 'em_execucao'].map(f => (
              <option key={f} value={f}>{PROJECT_PHASE_LABELS[f as keyof typeof PROJECT_PHASE_LABELS] || f}</option>
            ))}
          </select>

          {/* Período */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-bold">
            {([30, 90, 180] as const).map(p => (
              <button key={p} onClick={() => setPeriodo(p)}
                className={`px-3 py-2 transition-colors ${periodo === p ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {p === 30 ? '1 mês' : p === 90 ? '3 meses' : '6 meses'}
              </button>
            ))}
          </div>

          {/* Navegação mês */}
          <div className="flex items-center gap-1">
            <button onClick={() => setMesBase(prev => subMonths(prev, 1))}
              className="w-8 h-8 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-gray-700 min-w-[70px] text-center">
              {format(mesBase, 'MMM/yy', { locale: ptBR })}
            </span>
            <button onClick={() => setMesBase(prev => addMonths(prev, 1))}
              className="w-8 h-8 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-[10px] flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-500 inline-block" />MGR (planejado)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-orange-500 inline-block" />Cliente (planejado)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500 inline-block" />Concluído</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500 inline-block" />Atrasado</span>
        <span className="flex items-center gap-1.5"><span className="w-px h-4 bg-red-400 inline-block" />Hoje</span>
      </div>

      {/* Grade Gantt */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
        {/* Cabeçalho meses */}
        <div className="grid border-b border-gray-200 bg-gray-50 sticky top-0 z-10" style={{ gridTemplateColumns: '180px 1fr' }}>
          <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200">Projeto</div>
          <div className="flex">
            {monthHeaders.map((m, i) => (
              <div key={i} className="text-center text-[10px] font-bold text-gray-500 py-2 border-r border-gray-100 last:border-0 capitalize"
                style={{ width: `${m.widthPct}%` }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        {/* Linhas de projetos */}
        {projetosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            Nenhum projeto ativo no período selecionado.
          </div>
        ) : (
          projetosFiltrados.map((projeto, idx) => {
            const phaseColor = PROJECT_PHASE_COLORS[projeto.fase] || '#6366f1';
            return (
              <div key={projeto.id}
                className={`grid border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                style={{ gridTemplateColumns: '180px 1fr', minHeight: '44px' }}>
                {/* Label */}
                <div className="px-3 py-2 border-r border-gray-200 flex items-center gap-2 min-w-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phaseColor }} />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">{projeto.clientName}</p>
                    <p className="text-[10px] text-gray-400 truncate">
                      {PROJECT_PHASE_LABELS[projeto.fase] || projeto.fase}
                    </p>
                  </div>
                  <button onClick={() => navigate(`/app/projetos-v2/${projeto.id}`)}
                    className="ml-auto flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors">
                    <ExternalLink className="w-3 h-3 text-gray-400" />
                  </button>
                </div>

                {/* Barra Gantt */}
                <div className="relative" style={{ minHeight: '44px' }}>
                  {/* Grades mensais */}
                  {monthHeaders.map((m, i) => (
                    <div key={i} className="absolute top-0 bottom-0 border-r border-gray-100"
                      style={{ left: `${monthHeaders.slice(0, i + 1).reduce((acc, h) => acc + h.widthPct, 0)}%` }} />
                  ))}

                  {/* Linha hoje */}
                  {hojeLeft >= 0 && hojeLeft <= 100 && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-400/60 z-10"
                      style={{ left: `${hojeLeft}%` }} />
                  )}

                  <ProjectBar projeto={projeto} span={span}
                    onClick={() => navigate(`/app/projetos-v2/${projeto.id}`)}
                    onHover={handleHover} />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tooltip flutuante */}
      {tooltip && <GanttTooltip projeto={tooltip.projeto} x={tooltip.x} y={tooltip.y} />}
    </div>
  );
};

export default GanttGerencial;

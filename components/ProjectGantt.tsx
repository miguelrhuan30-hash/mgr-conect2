/**
 * components/ProjectGantt.tsx — Sprint 4
 *
 * Gantt INTERNO de um projeto:
 * - Duas lanes: fases MGR (azul) e fases do Cliente (laranja)
 * - Edição inline de datas previstas + reais
 * - Barra de progresso proporcional ao timeline
 * - Auto-salva no Firestore via useProjectOS.salvarGanttFases
 */
import React, { useState, useMemo } from 'react';
import {
  Calendar, Check, Edit3, Save, Loader2, Clock,
  User, Building2, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { format, differenceInDays, startOfDay, addDays, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { GanttFase } from '../hooks/useProjectOS';

interface Props {
  projectId: string;
  fases: GanttFase[];
  onSave: (fases: GanttFase[]) => Promise<void>;
}

// ── Helpers ──
const tsToStr = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000);
    return format(d, 'yyyy-MM-dd');
  } catch { return ''; }
};

const strToTs = (s: string): Timestamp | null => {
  if (!s) return null;
  try { return Timestamp.fromDate(new Date(s + 'T12:00:00')); }
  catch { return null; }
};

const fmtDate = (ts: Timestamp | null | undefined) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000);
    return format(d, 'dd/MM/yy', { locale: ptBR });
  } catch { return '—'; }
};

const toDate = (ts: Timestamp | null | undefined): Date | null => {
  if (!ts) return null;
  try { return ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000); }
  catch { return null; }
};

// ── Calcular o span do projeto (min e max datas) ──
const calcProjectSpan = (fases: GanttFase[]): { start: Date; end: Date } => {
  const allDates: Date[] = [];
  fases.forEach(f => {
    [f.dataInicioPrevista, f.dataFimPrevista, f.dataInicioReal, f.dataFimReal].forEach(ts => {
      const d = toDate(ts);
      if (d) allDates.push(d);
    });
  });
  if (allDates.length === 0) {
    const today = new Date();
    return { start: today, end: addDays(today, 90) };
  }
  const sorted = [...allDates].sort((a, b) => a.getTime() - b.getTime());
  return {
    start: addDays(sorted[0], -3),
    end: addDays(sorted[sorted.length - 1], 3),
  };
};

// ── Linha do Gantt ──
const GanttRow: React.FC<{
  fase: GanttFase;
  span: { start: Date; end: Date };
  totalDays: number;
  editing: boolean;
  onEdit: () => void;
  onChange: (f: Partial<GanttFase>) => void;
}> = ({ fase, span, totalDays, editing, onEdit, onChange }) => {
  const prevIni = toDate(fase.dataInicioPrevista);
  const prevFim = toDate(fase.dataFimPrevista);
  const realIni = toDate(fase.dataInicioReal);
  const realFim = toDate(fase.dataFimReal);

  const bar = (ini: Date | null, fim: Date | null, color: string, opacity = 1) => {
    if (!ini || !fim) return null;
    const left = Math.max(0, differenceInDays(ini, span.start));
    const width = Math.max(1, differenceInDays(fim, ini));
    const leftPct = (left / totalDays) * 100;
    const widthPct = (width / totalDays) * 100;
    return (
      <div
        className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-full ${color}`}
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, opacity }}
        title={`${format(ini, 'dd/MM/yy')} → ${format(fim, 'dd/MM/yy')}`}
      />
    );
  };

  const isCompleto = !!realFim;
  const hoje = new Date();
  const atrasado = prevFim && !realFim && isBefore(prevFim, hoje);

  return (
    <div className={`border-b border-gray-100 last:border-0 ${editing ? 'bg-blue-50/40' : 'hover:bg-gray-50'} transition-colors`}>
      {/* Label + ações */}
      <div className="grid grid-cols-[200px_1fr] items-center">
        <div className="px-3 py-2 flex items-start gap-1.5 min-w-0">
          <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-bold ${
            fase.party === 'mgr' ? 'bg-brand-500' : 'bg-orange-400'
          }`}>
            {fase.party === 'mgr' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-bold truncate ${isCompleto ? 'text-emerald-700 line-through' : atrasado ? 'text-red-600' : 'text-gray-800'}`}>
              {fase.label}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              {isCompleto && <Check className="w-3 h-3 text-emerald-500" />}
              {atrasado && <Clock className="w-3 h-3 text-red-400" />}
              <span className="text-[10px] text-gray-400">{fmtDate(fase.dataInicioPrevista)} → {fmtDate(fase.dataFimPrevista)}</span>
            </div>
          </div>
          <button onClick={onEdit} className="ml-auto flex-shrink-0 p-1 rounded hover:bg-gray-200 transition-colors">
            <Edit3 className="w-3 h-3 text-gray-400" />
          </button>
        </div>

        {/* Barra Gantt */}
        <div className="relative h-8 border-l border-gray-200">
          {bar(prevIni, prevFim, 'bg-brand-200', 0.7)}
          {bar(realIni, realFim, 'bg-emerald-500', 1)}
        </div>
      </div>

      {/* Form de edição */}
      {editing && (
        <div className="px-3 pb-3 pt-1 grid grid-cols-2 md:grid-cols-4 gap-3 bg-blue-50/60 border-t border-blue-100">
          {([
            { label: 'Início Previsto', key: 'dataInicioPrevista' },
            { label: 'Fim Previsto', key: 'dataFimPrevista' },
            { label: 'Início Real', key: 'dataInicioReal' },
            { label: 'Fim Real', key: 'dataFimReal' },
          ] as { label: string; key: keyof GanttFase }[]).map(({ label, key }) => (
            <div key={key}>
              <label className="text-[10px] font-bold text-gray-500 block mb-1">{label}</label>
              <input type="date" value={tsToStr(fase[key] as any)}
                onChange={e => onChange({ [key]: strToTs(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          ))}
          <div className="col-span-2 md:col-span-4">
            <label className="text-[10px] font-bold text-gray-500 block mb-1">Observação</label>
            <input type="text" value={fase.observacao || ''}
              onChange={e => onChange({ observacao: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-brand-500"
              placeholder="Ex: aguardando aprovação do cliente..." />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Cabeçalho de meses ──
const MonthHeader: React.FC<{ span: { start: Date; end: Date }; totalDays: number }> = ({ span, totalDays }) => {
  const months: { label: string; widthPct: number }[] = [];
  let cursor = startOfDay(span.start);
  while (isBefore(cursor, span.end)) {
    const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    const endOfPeriod = isAfter(nextMonth, span.end) ? span.end : nextMonth;
    const days = differenceInDays(endOfPeriod, cursor);
    months.push({
      label: format(cursor, 'MMM/yy', { locale: ptBR }),
      widthPct: (days / totalDays) * 100,
    });
    cursor = nextMonth;
  }
  return (
    <div className="grid grid-cols-[200px_1fr] border-b border-gray-200 bg-gray-50">
      <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Fase</div>
      <div className="flex border-l border-gray-200">
        {months.map((m, i) => (
          <div key={i} className="text-center text-[10px] font-bold text-gray-500 py-2 border-r border-gray-100 last:border-0 uppercase"
            style={{ width: `${m.widthPct}%` }}>
            {m.label}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Componente principal ──
const ProjectGantt: React.FC<Props> = ({ fases, onSave }) => {
  const [local, setLocal] = useState<GanttFase[]>(fases);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMGR, setShowMGR] = useState(true);
  const [showCliente, setShowCliente] = useState(true);

  // Sincroniza quando fases externas mudam
  React.useEffect(() => { setLocal(fases); }, [fases]);

  const span = useMemo(() => calcProjectSpan(local), [local]);
  const totalDays = Math.max(1, differenceInDays(span.end, span.start));

  const updateFase = (id: string, patch: Partial<GanttFase>) => {
    setLocal(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  };

  const fasesGrupos = {
    mgr: local.filter(f => f.party === 'mgr').sort((a, b) => a.ordem - b.ordem),
    cliente: local.filter(f => f.party === 'cliente').sort((a, b) => a.ordem - b.ordem),
  };

  const hoje = new Date();
  const hojeLeft = ((differenceInDays(hoje, span.start) / totalDays) * 100);
  const progresso = local.filter(f => f.dataFimReal).length;
  const totalFases = local.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
            📅 Gantt do Projeto
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {progresso}/{totalFases} fases concluídas
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Legenda */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-brand-200 inline-block" />
              <span className="text-gray-500">Previsto</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
              <span className="text-gray-500">Realizado</span>
            </span>
          </div>
          <button onClick={handleSave} disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              saved ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'
            } disabled:opacity-50`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Barra de progresso */}
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full bg-emerald-500 transition-all"
          style={{ width: `${totalFases > 0 ? (progresso / totalFases) * 100 : 0}%` }} />
      </div>

      {/* Gráfico Gantt — wrap em scroll horizontal para mobile */}
      <div className="overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div style={{ minWidth: '600px' }}>
          <div className="border border-gray-200 rounded-2xl overflow-hidden text-sm relative">
            <MonthHeader span={span} totalDays={totalDays} />

            {/* Linha "hoje" */}
            {hojeLeft >= 0 && hojeLeft <= 100 && (
              <div className="absolute top-10 bottom-0 z-10 pointer-events-none"
                style={{ left: `calc(200px + ${hojeLeft}% * (100% - 200px) / 100)` }}>
                <div className="w-px h-full bg-red-400 opacity-60" />
                <div className="absolute -top-0 -translate-x-1/2 text-[9px] font-bold text-red-500 bg-white px-1 rounded">HOJE</div>
              </div>
            )}

            {/* Fases MGR */}
            <div>
              <button onClick={() => setShowMGR(!showMGR)}
                className="w-full px-3 py-2 flex items-center gap-2 bg-brand-50 border-y border-brand-100 hover:bg-brand-100 transition-colors">
                <Building2 className="w-3.5 h-3.5 text-brand-600" />
                <span className="text-xs font-extrabold text-brand-700 uppercase tracking-wide">Fases MGR</span>
                {showMGR ? <ChevronUp className="w-3.5 h-3.5 text-brand-400 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-brand-400 ml-auto" />}
              </button>
              {showMGR && fasesGrupos.mgr.map(f => (
                <GanttRow key={f.id} fase={f} span={span} totalDays={totalDays}
                  editing={editingId === f.id}
                  onEdit={() => setEditingId(editingId === f.id ? null : f.id)}
                  onChange={patch => updateFase(f.id, patch)} />
              ))}
            </div>

            {/* Fases Cliente */}
            <div>
              <button onClick={() => setShowCliente(!showCliente)}
                className="w-full px-3 py-2 flex items-center gap-2 bg-orange-50 border-y border-orange-100 hover:bg-orange-100 transition-colors">
                <User className="w-3.5 h-3.5 text-orange-600" />
                <span className="text-xs font-extrabold text-orange-700 uppercase tracking-wide">Fases do Cliente</span>
                {showCliente ? <ChevronUp className="w-3.5 h-3.5 text-orange-400 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 text-orange-400 ml-auto" />}
              </button>
              {showCliente && fasesGrupos.cliente.map(f => (
                <GanttRow key={f.id} fase={f} span={span} totalDays={totalDays}
                  editing={editingId === f.id}
                  onEdit={() => setEditingId(editingId === f.id ? null : f.id)}
                  onChange={patch => updateFase(f.id, patch)} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 text-center">
        Clique no ✏️ de cada fase para editar datas. Azul = previsto · Verde = realizado · Linha vermelha = hoje.
        {' '}<span className="md:hidden">← Deslize para ver o gráfico completo →</span>
      </p>
    </div>
  );
};

export default ProjectGantt;

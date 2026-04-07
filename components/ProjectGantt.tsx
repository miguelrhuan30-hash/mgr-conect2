/**
 * components/ProjectGantt.tsx — Sprint Gantt Completo
 *
 * Gantt INTERNO de um projeto com:
 * - WBS (Work Breakdown Structure) com subtarefas aninhadas
 * - Caminho Crítico destacado visualmente (band vermelha)
 * - Adversidades com evidência obrigatória + efeito cascata
 * - Versionamento de baselines (snapshots do cronograma)
 * - KPIs: SPI, desvio acumulado, distribuição de responsabilidade
 * - Vista de barras Gantt + Vista WBS em lista
 * - Adição e edição inline de tarefas
 */
import React, { useState, useMemo, useRef } from 'react';
import {
  Plus, Save, Loader2, Check, AlertTriangle, BarChart2,
  ChevronRight, ChevronDown, Trash2, Edit3, Camera,
  GitBranch, Layers, Clock, Building2, User, Users,
  BookOpen, Archive, Flag, X, Info, AlertCircle, Upload, Image as ImageIcon,
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import {
  format, differenceInDays, startOfDay, addDays,
  isBefore, isAfter,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProjectGantt } from '../hooks/useProjectGantt';
import { GanttTask, GanttPartyV2, GanttTaskStatus, GanttAdversidade } from '../types';

interface Props {
  projectId: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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

const toDate = (ts: Timestamp | null | undefined): Date | null => {
  if (!ts) return null;
  try { return ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000); }
  catch { return null; }
};

const fmtDate = (ts: Timestamp | null | undefined) => {
  const d = toDate(ts);
  if (!d) return '—';
  return format(d, 'dd/MM/yy', { locale: ptBR });
};

const STATUS_CONFIG: Record<GanttTaskStatus, { label: string; color: string; dot: string }> = {
  nao_iniciada: { label: 'Não Iniciada', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-300' },
  em_andamento: { label: 'Em Andamento', color: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  concluida:    { label: 'Concluída',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  bloqueada:    { label: 'Bloqueada',    color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  cancelada:    { label: 'Cancelada',    color: 'bg-gray-100 text-gray-400 border-gray-200', dot: 'bg-gray-300' },
};

const PARTY_CONFIG: Record<GanttPartyV2, { label: string; icon: React.ReactNode; color: string }> = {
  mgr:      { label: 'MGR',      icon: <Building2 className="w-3 h-3" />, color: 'text-brand-600 bg-brand-50 border-brand-200' },
  cliente:  { label: 'Cliente',  icon: <User className="w-3 h-3" />,      color: 'text-orange-600 bg-orange-50 border-orange-200' },
  terceiro: { label: 'Terceiro', icon: <Users className="w-3 h-3" />,      color: 'text-purple-600 bg-purple-50 border-purple-200' },
};

// ── Calcular span de datas do projeto ────────────────────────────────────────
const calcProjectSpan = (tasks: GanttTask[]) => {
  const today = new Date();
  const allDates: Date[] = [today];
  tasks.forEach(t => {
    [t.dataInicioPrevista, t.dataFimPrevista, t.dataInicioReal, t.dataFimReal].forEach(ts => {
      const d = toDate(ts);
      if (d) allDates.push(d);
    });
  });
  const sorted = [...allDates].sort((a, b) => a.getTime() - b.getTime());
  return {
    start: addDays(sorted[0], -5),
    end: addDays(sorted[sorted.length - 1], 5),
  };
};

// ── Componente KPI Card ───────────────────────────────────────────────────────
const KpiCard: React.FC<{ label: string; value: string | number; color: string; sub?: string; icon?: React.ReactNode }> = ({ label, value, color, sub, icon }) => (
  <div className={`rounded-2xl border p-3 ${color} flex items-start gap-2`}>
    {icon && <div className="mt-0.5 flex-shrink-0">{icon}</div>}
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-xl font-extrabold leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── Barra Gantt individual ────────────────────────────────────────────────────
const GanttBar: React.FC<{
  task: GanttTask;
  span: { start: Date; end: Date };
  totalDays: number;
}> = ({ task, span, totalDays }) => {
  const hoje = new Date();

  const bar = (ini: Date | null, fim: Date | null, className: string, title: string) => {
    if (!ini || !fim || totalDays <= 0) return null;
    const left = Math.max(0, differenceInDays(ini, span.start));
    const width = Math.max(1, differenceInDays(fim, ini));
    const leftPct = (left / totalDays) * 100;
    const widthPct = (width / totalDays) * 100;
    if (leftPct > 100 || leftPct + widthPct < 0) return null;
    return (
      <div
        title={title}
        className={`absolute top-1/2 -translate-y-1/2 h-4 rounded-full ${className}`}
        style={{ left: `${Math.max(0, leftPct)}%`, width: `${Math.min(widthPct, 100 - Math.max(0, leftPct))}%` }}
      />
    );
  };

  const prevIni = toDate(task.dataInicioPrevista);
  const prevFim = toDate(task.dataFimPrevista);
  const realIni = toDate(task.dataInicioReal);
  const realFim = toDate(task.dataFimReal);
  const atrasado = prevFim && !task.dataFimReal && isBefore(prevFim, hoje);

  return (
    <div className="relative h-8 flex-1 min-w-0">
      {bar(prevIni, prevFim,
        task.isCritico
          ? 'bg-red-200 opacity-80'
          : atrasado
            ? 'bg-amber-200 opacity-80'
            : 'bg-brand-200 opacity-80',
        `Previsto: ${fmtDate(task.dataInicioPrevista)} → ${fmtDate(task.dataFimPrevista)}`
      )}
      {bar(realIni, realFim || (task.status === 'em_andamento' ? hoje : null),
        'bg-emerald-500 opacity-90',
        `Realizado: ${fmtDate(task.dataInicioReal)} → ${task.dataFimReal ? fmtDate(task.dataFimReal) : 'em andamento'}`
      )}
    </div>
  );
};

// ── Formulário de Adversidade ─────────────────────────────────────────────────
const AdversidadeModal: React.FC<{
  taskLabel: string;
  projectId: string;
  onSave: (data: Omit<GanttAdversidade, 'id' | 'taskId' | 'registradoPor' | 'registradoPorNome' | 'registradoEm' | 'aplicadoCascata'>) => Promise<void>;
  onClose: () => void;
}> = ({ taskLabel, projectId, onSave, onClose }) => {
  const [descricao, setDescricao] = useState('');
  const [responsavel, setResponsavel] = useState<GanttPartyV2>('mgr');
  const [diasImpacto, setDiasImpacto] = useState(1);
  const [evidenciaUrl, setEvidenciaUrl] = useState<string | null>(null);
  const [uploadingEvidencia, setUploadingEvidencia] = useState(false);
  const [saving, setSaving] = useState(false);
  const evidenciaRef = useRef<HTMLInputElement>(null);

  const handleUploadEvidencia = async (file: File) => {
    setUploadingEvidencia(true);
    try {
      const path = `projects/${projectId}/adversidades/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', undefined, reject, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setEvidenciaUrl(url);
          resolve();
        });
      });
    } finally { setUploadingEvidencia(false); }
  };

  const canSave = descricao.trim().length > 0 && diasImpacto > 0 && !!evidenciaUrl;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ descricao, responsavel, diasImpacto, evidenciaUrl: evidenciaUrl! });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Registrar Adversidade</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">Tarefa: {taskLabel}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Descrição da Adversidade *</label>
            <textarea
              value={descricao} onChange={e => setDescricao(e.target.value)} rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-brand-500 outline-none"
              placeholder="Descreva o que ocorreu e o impacto no cronograma..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Responsável</label>
              <select value={responsavel} onChange={e => setResponsavel(e.target.value as GanttPartyV2)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                <option value="mgr">MGR</option>
                <option value="cliente">Cliente</option>
                <option value="terceiro">Terceiro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Impacto (dias)</label>
              <input type="number" min={0} max={365} value={diasImpacto}
                onChange={e => setDiasImpacto(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
          </div>

          {/* Evidência fotógrafica OBRIGATÓRIA */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-red-500" />
              Evidência Fotógrafica <span className="text-red-500">*</span>
            </label>
            {evidenciaUrl ? (
              <div className="relative rounded-xl overflow-hidden border border-emerald-200 bg-emerald-50">
                <img src={evidenciaUrl} alt="Evidência" className="w-full h-32 object-cover" />
                <div className="absolute top-1 right-1 flex gap-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-full flex items-center gap-0.5">
                    <Check className="w-2.5 h-2.5" /> Enviada
                  </span>
                  <button onClick={() => setEvidenciaUrl(null)}
                    className="w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => evidenciaRef.current?.click()} disabled={uploadingEvidencia}
                className="w-full border-2 border-dashed border-red-200 rounded-xl p-4 flex flex-col items-center gap-2 hover:bg-red-50 transition-colors group">
                {uploadingEvidencia
                  ? <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
                  : <Camera className="w-6 h-6 text-red-300 group-hover:text-red-500 transition-colors" />}
                <span className="text-xs font-bold text-red-400 group-hover:text-red-600">
                  {uploadingEvidencia ? 'Enviando...' : 'Fotografar ou anexar evidência'}
                </span>
                <span className="text-[10px] text-red-300">Obrigatória para registrar adversidade</span>
              </button>
            )}
            <input ref={evidenciaRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadEvidencia(f); e.target.value = ''; }} />
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              O impacto de <strong>{diasImpacto} dia{diasImpacto !== 1 ? 's' : ''}</strong> será propagado
              automaticamente para todas as tarefas dependentes desta (efeito cascata).
            </p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !canSave}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            {!evidenciaUrl ? 'Foto de evidência obrigatória' : 'Registrar + Aplicar Cascata'}
          </button>
        </div>
      </div>
    </div>
  );
};


// ── Formulário de criação/edição de tarefa ────────────────────────────────────
interface TaskFormData {
  label: string;
  descricao: string;
  party: GanttPartyV2;
  status: GanttTaskStatus;
  dataInicioPrevista: string;
  dataFimPrevista: string;
  duracaoDias: number;
  observacao: string;
}

const TaskFormModal: React.FC<{
  initial?: Partial<TaskFormData & { id: string }>;
  parentLabel?: string;
  onSave: (data: TaskFormData) => Promise<void>;
  onClose: () => void;
  isEdit?: boolean;
}> = ({ initial, parentLabel, onSave, onClose, isEdit }) => {
  const [form, setForm] = useState<TaskFormData>({
    label: initial?.label || '',
    descricao: initial?.descricao || '',
    party: initial?.party || 'mgr',
    status: initial?.status || 'nao_iniciada',
    dataInicioPrevista: initial?.dataInicioPrevista || '',
    dataFimPrevista: initial?.dataFimPrevista || '',
    duracaoDias: initial?.duracaoDias || 0,
    observacao: initial?.observacao || '',
  });
  const [saving, setSaving] = useState(false);

  // Auto-calcular duração quando as datas mudam
  React.useEffect(() => {
    if (form.dataInicioPrevista && form.dataFimPrevista) {
      const days = differenceInDays(
        new Date(form.dataFimPrevista),
        new Date(form.dataInicioPrevista)
      );
      if (days > 0) setForm(f => ({ ...f, duracaoDias: days }));
    }
  }, [form.dataInicioPrevista, form.dataFimPrevista]);

  const handleSave = async () => {
    if (!form.label.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-900">{isEdit ? 'Editar Tarefa' : 'Nova Tarefa'}</h3>
            {parentLabel && <p className="text-xs text-gray-500 mt-0.5">↳ Subtarefa de: {parentLabel}</p>}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Descrição da Tarefa *</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Ex: Instalação dos compressores" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Responsabilidade</label>
              <select value={form.party} onChange={e => setForm(f => ({ ...f, party: e.target.value as GanttPartyV2 }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                <option value="mgr">MGR</option>
                <option value="cliente">Cliente</option>
                <option value="terceiro">Terceiro</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as GanttTaskStatus }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Início Previsto</label>
              <input type="date" value={form.dataInicioPrevista}
                onChange={e => setForm(f => ({ ...f, dataInicioPrevista: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Fim Previsto</label>
              <input type="date" value={form.dataFimPrevista}
                onChange={e => setForm(f => ({ ...f, dataFimPrevista: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
          </div>

          {form.duracaoDias > 0 && (
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Duração calculada: <strong>{form.duracaoDias} dias</strong>
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
            <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none"
              placeholder="Informações adicionais..." />
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving || !form.label.trim()}
            className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? 'Salvar' : 'Criar Tarefa'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Linha da WBS ──────────────────────────────────────────────────────────────
const WBSRow: React.FC<{
  task: GanttTask & { depth: number };
  span: { start: Date; end: Date };
  totalDays: number;
  showGantt: boolean;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddChild: () => void;
  onAdversidade: () => void;
}> = ({ task, span, totalDays, showGantt, hasChildren, isExpanded, onToggle, onEdit, onDelete, onAddChild, onAdversidade }) => {
  const status = STATUS_CONFIG[task.status];
  const party = PARTY_CONFIG[task.party];
  const hoje = new Date();
  const atrasado = task.dataFimPrevista && !task.dataFimReal &&
    isBefore(toDate(task.dataFimPrevista) || hoje, hoje) &&
    task.status !== 'concluida' && task.status !== 'cancelada';

  return (
    <div className={`border-b border-gray-100 last:border-0 group transition-colors ${
      task.isCritico && task.status !== 'concluida' ? 'bg-red-50/30' : 'hover:bg-gray-50/50'
    }`}>
      <div className="flex items-center min-h-[44px]">
        {/* Indentação + Toggle */}
        <div className="flex items-center flex-shrink-0" style={{ paddingLeft: `${task.depth * 20 + 12}px` }}>
          <button onClick={onToggle} className="w-5 h-5 flex items-center justify-center text-gray-400 flex-shrink-0">
            {hasChildren
              ? (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)
              : <span className="w-3 h-px bg-gray-200 inline-block" />
            }
          </button>
        </div>

        {/* Caminho Crítico indicator */}
        {task.isCritico && task.status !== 'concluida' && (
          <div className="w-1 h-8 bg-red-400 rounded-full flex-shrink-0 mr-1" title="Caminho Crítico" />
        )}

        {/* Info da tarefa */}
        <div className="flex-1 min-w-0 flex items-center gap-2 pr-2 py-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-bold truncate ${task.status === 'cancelada' ? 'line-through text-gray-400' : task.status === 'concluida' ? 'text-emerald-700' : atrasado ? 'text-red-700' : 'text-gray-900'}`}>
                {task.wbsCode && <span className="text-gray-400 mr-1">{task.wbsCode}</span>}
                {task.label}
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${status.color}`}>
                {status.label}
              </span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 flex items-center gap-0.5 ${party.color}`}>
                {party.icon}{party.label}
              </span>
              {task.isCritico && task.status !== 'concluida' && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 flex-shrink-0">
                  ⚡ Crítico
                </span>
              )}
              {(task.adversidades?.length ?? 0) > 0 && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600 border border-amber-200 flex-shrink-0">
                  ⚠️ {task.adversidades!.length} adv.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
              {task.dataInicioPrevista && <span>{fmtDate(task.dataInicioPrevista)} → {fmtDate(task.dataFimPrevista)}</span>}
              {task.duracaoDias && task.duracaoDias > 0 && <span>· {task.duracaoDias}d</span>}
              {task.folga !== undefined && <span>· Folga: {task.folga}d</span>}
            </div>
          </div>

          {/* Barra Gantt inline */}
          {showGantt && totalDays > 0 && (
            <div className="w-48 flex-shrink-0 hidden md:block">
              <GanttBar task={task} span={span} totalDays={totalDays} />
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button onClick={onAddChild} title="Adicionar subtarefa"
              className="p-1.5 rounded-lg hover:bg-brand-50 text-gray-400 hover:text-brand-600 transition-colors">
              <Plus className="w-3 h-3" />
            </button>
            <button onClick={onAdversidade} title="Registrar adversidade"
              className="p-1.5 rounded-lg hover:bg-amber-50 text-gray-400 hover:text-amber-600 transition-colors">
              <AlertTriangle className="w-3 h-3" />
            </button>
            <button onClick={onEdit} title="Editar"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
              <Edit3 className="w-3 h-3" />
            </button>
            <button onClick={onDelete} title="Excluir"
              className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const ProjectGantt: React.FC<Props> = ({ projectId }) => {
  const {
    tasks, baselines, kpis, loading,
    addTask, updateTask, deleteTask,
    registrarAdversidade, criarBaseline, deleteBaseline,
    getTasksFlat,
  } = useProjectGantt(projectId);

  // UI state
  const [view, setView] = useState<'wbs' | 'gantt' | 'kpis'>('wbs');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingTask, setAddingTask] = useState<{ parentId: string | null } | null>(null);
  const [editingTask, setEditingTask] = useState<GanttTask | null>(null);
  const [adversidadeTask, setAdversidadeTask] = useState<GanttTask | null>(null);
  const [showBaselines, setShowBaselines] = useState(false);
  const [savingBaseline, setSavingBaseline] = useState(false);
  const [baselineName, setBaselineName] = useState('');

  // Span de datas para a barra gantt
  const span = useMemo(() => {
    if (tasks.length === 0) {
      const t = new Date();
      return { start: addDays(t, -5), end: addDays(t, 85) };
    }
    return calcProjectSpan(tasks);
  }, [tasks]);
  const totalDays = Math.max(1, differenceInDays(span.end, span.start));

  // Lista flat para renderização WBS (respeitando collapse)
  const flatTasks = useMemo(() => {
    const all = getTasksFlat(null, 0);
    const result: (GanttTask & { depth: number })[] = [];
    for (const t of all) {
      result.push(t);
    }
    return result;
  }, [getTasksFlat]);

  // Filtro de tarefas visíveis (collapse de subtarefas)
  const visibleTasks = useMemo(() => {
    const visible: (GanttTask & { depth: number })[] = [];
    const hiddenParents = new Set<string>();
    for (const t of flatTasks) {
      let hidden = false;
      let checkId = t.parentId;
      while (checkId) {
        if (!expanded.has(checkId)) { hidden = true; break; }
        const parent = tasks.find(p => p.id === checkId);
        checkId = parent?.parentId ?? null;
      }
      if (!hidden) visible.push(t);
    }
    return visible;
  }, [flatTasks, expanded, tasks]);

  const hasChildren = (taskId: string) => tasks.some(t => t.parentId === taskId);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // Ações de task
  const handleAddTask = async (form: any, parentId: string | null) => {
    const siblingCount = tasks.filter(t => (t.parentId ?? null) === parentId).length;
    await addTask({
      label: form.label,
      descricao: form.descricao,
      party: form.party,
      status: form.status,
      progresso: 0,
      nivel: parentId ? (tasks.find(t => t.id === parentId)?.nivel ?? 0) + 1 : 0,
      ordem: siblingCount + 1,
      parentId: parentId,
      projectId,
      dataInicioPrevista: strToTs(form.dataInicioPrevista),
      dataFimPrevista: strToTs(form.dataFimPrevista),
      duracaoDias: form.duracaoDias || undefined,
      observacao: form.observacao,
      dependencias: [],
      adversidades: [],
    });
    if (parentId) setExpanded(prev => new Set([...prev, parentId]));
  };

  const handleEditTask = async (form: any) => {
    if (!editingTask) return;
    await updateTask(editingTask.id, {
      label: form.label,
      descricao: form.descricao,
      party: form.party,
      status: form.status,
      dataInicioPrevista: strToTs(form.dataInicioPrevista),
      dataFimPrevista: strToTs(form.dataFimPrevista),
      duracaoDias: form.duracaoDias || undefined,
      observacao: form.observacao,
    });
  };

  const handleSaveBaseline = async () => {
    if (!baselineName.trim()) return;
    setSavingBaseline(true);
    try {
      await criarBaseline(baselineName.trim());
      setBaselineName('');
    } finally { setSavingBaseline(false); }
  };

  // Cabeçalho de meses para a grade Gantt
  const monthHeaders = useMemo(() => {
    const months: { label: string; widthPct: number }[] = [];
    let cursor = startOfDay(span.start);
    while (isBefore(cursor, span.end)) {
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const endSlice = isAfter(nextMonth, span.end) ? span.end : nextMonth;
      const days = differenceInDays(endSlice, cursor);
      months.push({ label: format(cursor, 'MMM/yy', { locale: ptBR }), widthPct: (days / totalDays) * 100 });
      cursor = nextMonth;
    }
    return months;
  }, [span, totalDays]);

  const hojeLeft = ((differenceInDays(new Date(), span.start) / totalDays) * 100);
  const progresso = tasks.length > 0
    ? Math.round((tasks.filter(t => t.status === 'concluida').length / tasks.filter(t => !tasks.some(o => o.parentId === t.id)).length) * 100)
    : 0;

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2">
            📅 Cronograma do Projeto
          </h3>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-40 bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-emerald-500 transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <span className="text-xs text-gray-500">{progresso}% concluído · {tasks.filter(t => !tasks.some(o => o.parentId === t.id)).length} tarefas</span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle View */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-bold">
            {([
              { k: 'wbs', label: '📋 WBS' },
              { k: 'gantt', label: '📊 Gantt' },
              { k: 'kpis', label: '📈 KPIs' },
            ] as { k: 'wbs' | 'gantt' | 'kpis'; label: string }[]).map(({ k, label }) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-3 py-2 transition-colors ${view === k ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {label}
              </button>
            ))}
          </div>

          {/* Baselines */}
          <button onClick={() => setShowBaselines(!showBaselines)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-colors ${showBaselines ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            <Archive className="w-3.5 h-3.5" /> Baselines {baselines.length > 0 && `(${baselines.length})`}
          </button>

          {/* Nova tarefa */}
          <button onClick={() => setAddingTask({ parentId: null })}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Nova Tarefa
          </button>
        </div>
      </div>

      {/* ── Painel de Baselines ── */}
      {showBaselines && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-extrabold text-purple-700 uppercase tracking-wide flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" /> Baselines de Cronograma
          </p>
          <div className="flex items-center gap-2">
            <input value={baselineName} onChange={e => setBaselineName(e.target.value)}
              className="flex-1 border border-purple-200 rounded-xl px-3 py-2 text-sm outline-none bg-white"
              placeholder="Nome do baseline (ex: Revisão 1)" />
            <button onClick={handleSaveBaseline} disabled={savingBaseline || !baselineName.trim()}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 disabled:opacity-50">
              {savingBaseline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar Snapshot
            </button>
          </div>
          {baselines.length > 0 && (
            <div className="space-y-1.5">
              {baselines.map(b => (
                <div key={b.id} className="bg-white border border-purple-100 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-gray-900">{b.nome}</p>
                    <p className="text-[10px] text-gray-400">
                      {b.criadoPorNome} · {b.criadoEm?.toDate ? format(b.criadoEm.toDate(), 'dd/MM/yy HH:mm') : '—'} · {b.tasks.length} tarefas
                    </p>
                  </div>
                  <button onClick={() => deleteBaseline(b.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Vista KPIs ── */}
      {view === 'kpis' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="SPI" value={kpis.spi.toFixed(2)}
              color={kpis.spi >= 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : kpis.spi >= 0.8 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'}
              sub={kpis.spi >= 1 ? 'No prazo ou adiantado' : kpis.spi >= 0.8 ? 'Levemente atrasado' : 'Atenção: atrasos significativos'}
              icon={<BarChart2 className="w-4 h-4" />}
            />
            <KpiCard label="Tarefas Concluídas" value={`${kpis.tarefasConcluidas}/${kpis.totalTarefas}`}
              color="bg-blue-50 text-blue-700 border-blue-200"
              sub={`${kpis.totalTarefas > 0 ? Math.round((kpis.tarefasConcluidas / kpis.totalTarefas) * 100) : 0}% do total`}
              icon={<Check className="w-4 h-4" />}
            />
            <KpiCard label="Desvio Total" value={`${kpis.desvioTotalDias}d`}
              color={kpis.desvioTotalDias === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}
              sub={`${kpis.tarefasAtrasadas} tarefa(s) atrasada(s)`}
              icon={<Clock className="w-4 h-4" />}
            />
            <KpiCard label="Caminho Crítico" value={kpis.tarefasCriticas}
              color="bg-red-50 text-red-700 border-red-200"
              sub="tarefas críticas (folga 0)"
              icon={<Flag className="w-4 h-4" />}
            />
          </div>

          {/* Distribuição de responsabilidade por atrasos */}
          {kpis.totalAdversidades > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wide">Distribuição de Responsabilidade por Impactos</p>
              {[
                { label: 'MGR', dias: kpis.atrasoPorParty.mgr, color: 'bg-brand-500' },
                { label: 'Cliente', dias: kpis.atrasoPorParty.cliente, color: 'bg-orange-400' },
                { label: 'Terceiros', dias: kpis.atrasoPorParty.terceiro, color: 'bg-purple-400' },
              ].map(({ label, dias, color }) => {
                const total = kpis.atrasoPorParty.mgr + kpis.atrasoPorParty.cliente + kpis.atrasoPorParty.terceiro;
                const pct = total > 0 ? Math.round((dias / total) * 100) : 0;
                return (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-700">{label}</span>
                      <span className="font-bold text-gray-900">{dias}d ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Vista WBS + Gantt ── */}
      {(view === 'wbs' || view === 'gantt') && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          {/* Cabeçalho de meses (só na vista gantt) */}
          {view === 'gantt' && (
            <div className="flex border-b border-gray-200 bg-gray-50">
              <div className="w-64 flex-shrink-0 px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wide border-r border-gray-200">
                Tarefa
              </div>
              <div className="flex-1 flex relative overflow-hidden">
                {monthHeaders.map((m, i) => (
                  <div key={i} className="text-center text-[10px] font-bold text-gray-500 py-2 border-r border-gray-100 last:border-0 capitalize overflow-hidden whitespace-nowrap"
                    style={{ width: `${m.widthPct}%` }}>
                    {m.label}
                  </div>
                ))}
                {hojeLeft >= 0 && hojeLeft <= 100 && (
                  <div className="absolute top-0 bottom-0 w-px bg-red-400/60 pointer-events-none"
                    style={{ left: `${hojeLeft}%` }} />
                )}
              </div>
            </div>
          )}

          {/* Legenda */}
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/50 flex items-center gap-4 text-[10px] flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-brand-200 inline-block" />Previsto</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />Realizado</span>
            <span className="flex items-center gap-1.5"><span className="w-1 h-4 bg-red-400 inline-block rounded-full" />Caminho Crítico</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded-full bg-red-200 inline-block" />Crítico/Atrasado</span>
          </div>

          {/* Linhas */}
          {visibleTasks.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">Nenhuma tarefa cadastrada.</p>
              <button onClick={() => setAddingTask({ parentId: null })}
                className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700">
                <Plus className="w-3.5 h-3.5" /> Criar primeira tarefa
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: view === 'gantt' ? '700px' : undefined }}>
                {visibleTasks.map(task => (
                  <WBSRow
                    key={task.id}
                    task={task}
                    span={span}
                    totalDays={totalDays}
                    showGantt={view === 'gantt'}
                    hasChildren={hasChildren(task.id)}
                    isExpanded={expanded.has(task.id)}
                    onToggle={() => toggleExpand(task.id)}
                    onEdit={() => setEditingTask(task)}
                    onDelete={() => {
                      if (window.confirm(`Excluir "${task.label}"${hasChildren(task.id) ? ' e todas as subtarefas' : ''}?`)) {
                        deleteTask(task.id);
                      }
                    }}
                    onAddChild={() => setAddingTask({ parentId: task.id })}
                    onAdversidade={() => setAdversidadeTask(task)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modais ── */}
      {addingTask !== null && (
        <TaskFormModal
          parentLabel={addingTask.parentId ? tasks.find(t => t.id === addingTask.parentId)?.label : undefined}
          onSave={form => handleAddTask(form, addingTask.parentId)}
          onClose={() => setAddingTask(null)}
        />
      )}

      {editingTask && (
        <TaskFormModal
          isEdit
          initial={{
            id: editingTask.id,
            label: editingTask.label,
            descricao: editingTask.descricao,
            party: editingTask.party,
            status: editingTask.status,
            dataInicioPrevista: tsToStr(editingTask.dataInicioPrevista),
            dataFimPrevista: tsToStr(editingTask.dataFimPrevista),
            duracaoDias: editingTask.duracaoDias || 0,
            observacao: editingTask.observacao,
          }}
          onSave={form => handleEditTask(form)}
          onClose={() => setEditingTask(null)}
        />
      )}

      {adversidadeTask && (
        <AdversidadeModal
          taskLabel={adversidadeTask.label}
          projectId={projectId}
          onSave={data => registrarAdversidade(adversidadeTask.id, data)}
          onClose={() => setAdversidadeTask(null)}
        />
      )}

      <p className="text-[10px] text-gray-400 text-center">
        💡 Hover nas tarefas para ver ações. Barra vermelha lateral = tarefa no caminho crítico.
        {view !== 'gantt' && <span className="md:hidden"> ← Alterne para vista Gantt para ver o gráfico de barras.</span>}
      </p>
    </div>
  );
};

export default ProjectGantt;

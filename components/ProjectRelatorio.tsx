/**
 * components/ProjectRelatorio.tsx — Sprint C (Relatório Final Consolidado)
 *
 * Relatório de conclusão de projeto com:
 * - Consolidação de TODAS as O.S. vinculadas (status, técnico, data)
 * - Checklist de conclusão com progresso
 * - Comparativo baseline vs. real (Gantt)
 * - Fotos pós-obra com upload
 * - Distribuição de responsabilidade por atrasos (adversidades)
 * - Observações técnicas e link para documentação
 * - Export PDF com layout MGR profissional
 * - Envio via WhatsApp
 */
import React, { useState, useMemo } from 'react';
import {
  CheckSquare, Square, Upload, Image, FileText, Loader2,
  Send, Check, Trash2, Printer, Share2, ExternalLink,
  ClipboardList, BarChart2, AlertTriangle, Clock,
  Building2, User, Users, ChevronDown, ChevronUp,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, ProjectV2 } from '../types';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useProjectOS } from '../hooks/useProjectOS';
import { useProjectGantt } from '../hooks/useProjectGantt';

interface Props {
  projectId: string;
  project: ProjectV2;
  onSave: () => void;
}

export interface ProjectRelatorioData {
  checklistConclusao: { item: string; feito: boolean }[];
  fotosPostObra: string[];
  observacoesTecnicas: string;
  linkRelatorio?: string;
  enviadoAoCliente: boolean;
  enviadoEm?: any;
}

const CHECKLIST_PADRAO = [
  'Equipamentos instalados e testados',
  'Sistemas elétricos verificados (NR-10)',
  'Gás carregado e pressão testada',
  'Isolamento aplicado corretamente',
  'Limpeza e organização do local',
  'Treinamento do operador realizado',
  'Documentação entregue ao cliente',
  'Fotos da conclusão registradas',
  'Medição de temperatura realizada',
  'Relatório entregue e aprovado pelo cliente',
];

const STATUS_OS_LABELS: Record<string, { label: string; cor: string }> = {
  pending:     { label: 'Pendente',    cor: 'text-amber-600 bg-amber-50 border-amber-200' },
  'in-progress': { label: 'Andamento', cor: 'text-blue-600 bg-blue-50 border-blue-200' },
  completed:   { label: 'Concluída',   cor: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  blocked:     { label: 'Bloqueada',   cor: 'text-red-600 bg-red-50 border-red-200' },
  cancelled:   { label: 'Cancelada',   cor: 'text-gray-500 bg-gray-50 border-gray-200' },
};

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, 'dd/MM/yy', { locale: ptBR });
  } catch { return '—'; }
};

// ── Geração de PDF/Print com layout MGR ────────────────────────────────────
const gerarPDF = (
  project: ProjectV2,
  checklist: { item: string; feito: boolean }[],
  fotos: string[],
  observacoes: string,
  linkRelatorio: string,
  osResumo: { titulo: string; status: string; tecnico: string; data: string }[],
  kpiGantt: { spi: number; desvio: number; atrasoPorParty: { mgr: number; cliente: number; terceiro: number } } | null,
) => {
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const concluidas = checklist.filter(c => c.feito).length;

  const checkHTML = checklist.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f3f4f6">
      <div style="width:18px;height:18px;border-radius:3px;border:2px solid ${c.feito ? '#059669' : '#d1d5db'};background:${c.feito ? '#059669' : '#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${c.feito ? '<span style="color:white;font-size:12px;font-weight:bold">✓</span>' : ''}
      </div>
      <span style="font-size:12px;color:${c.feito ? '#374151' : '#9ca3af'};${c.feito ? '' : 'text-decoration:line-through'}">${c.item}</span>
    </div>
  `).join('');

  const osHTML = osResumo.length > 0 ? osResumo.map(os => `
    <tr>
      <td style="padding:5px 8px;font-size:11px">${os.titulo}</td>
      <td style="padding:5px 8px;font-size:11px">${os.tecnico || '—'}</td>
      <td style="padding:5px 8px;font-size:11px">${os.data}</td>
      <td style="padding:5px 8px;font-size:11px">${os.status}</td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="text-align:center;color:#9ca3af;padding:8px;font-size:11px">Nenhuma O.S. registrada</td></tr>';

  const fotosHTML = fotos.slice(0, 6).map(url =>
    `<img src="${url}" style="width:31%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb" />`
  ).join('');

  const kpiHTML = kpiGantt ? `
    <h2>Desempenho do Cronograma</h2>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:10px 0">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">SPI (Índice de Prazo)</div>
        <div style="font-size:22px;font-weight:900;color:${kpiGantt.spi>=1?'#059669':'#dc2626'}">${kpiGantt.spi.toFixed(2)}</div>
        <div style="font-size:10px;color:#9ca3af">${kpiGantt.spi>=1?'No prazo':'Abaixo do prazo'}</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px">Desvio Total</div>
        <div style="font-size:22px;font-weight:900;color:${kpiGantt.desvio===0?'#059669':'#d97706'}">${kpiGantt.desvio}d</div>
        <div style="font-size:10px;color:#9ca3af">dias de atraso</div>
      </div>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;font-size:11px">
        <div style="font-weight:bold;margin-bottom:6px;color:#374151">Responsab. por Atrasos</div>
        <div>MGR: <strong>${kpiGantt.atrasoPorParty.mgr}d</strong></div>
        <div>Cliente: <strong>${kpiGantt.atrasoPorParty.cliente}d</strong></div>
        <div>Terceiros: <strong>${kpiGantt.atrasoPorParty.terceiro}d</strong></div>
      </div>
    </div>
  ` : '';

  const html = `<!DOCTYPE html>
    <html lang="pt-BR"><head><meta charset="UTF-8"/>
    <title>Relatório de Conclusão — ${project.nome}</title>
    <style>
      @page { size: A4; margin: 18mm 15mm; }
      * { box-sizing: border-box; }
      body { font-family: system-ui, Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
      .header { border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
      .logo { font-size: 18px; font-weight: 900; color: #2563eb; }
      h1 { font-size: 16px; margin: 4px 0; }
      .meta { font-size: 11px; color: #6b7280; margin-top: 6px; }
      h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 18px 0 8px; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      th { background: #f9fafb; border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; }
      td { border: 1px solid #e5e7eb; }
      .obs { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; font-size: 12px; white-space: pre-wrap; }
      .fotos { display: flex; flex-wrap: wrap; gap: 8px; }
      .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
      .progress-bar { background: #e5e7eb; height: 8px; border-radius: 4px; }
      .progress-fill { background: ${concluidas === checklist.length ? '#059669' : '#2563eb'}; height: 8px; border-radius: 4px; width: ${Math.round((concluidas / checklist.length) * 100)}%; }
      @media print { button { display: none !important; } }
    </style></head>
    <body>
      <div class="header">
        <div>
          <div class="logo">MGR Refrigeração</div>
          <h1>Relatório de Conclusão de Projeto</h1>
          <div class="meta">
            <strong>Projeto:</strong> ${project.nome} &nbsp;|&nbsp;
            <strong>Cliente:</strong> ${project.clientName} &nbsp;|&nbsp;
            <strong>Data:</strong> ${hoje}
          </div>
        </div>
        <div style="text-align:right;font-size:11px;color:#9ca3af">
          <div>${concluidas}/${checklist.length} itens concluídos</div>
          <div class="progress-bar" style="width:100px;margin-top:4px"><div class="progress-fill" /></div>
        </div>
      </div>

      <h2>Ordens de Serviço Vinculadas</h2>
      <table><thead><tr><th>O.S.</th><th>Técnico</th><th>Data Prevista</th><th>Status</th></tr></thead>
      <tbody>${osHTML}</tbody></table>

      ${kpiHTML}

      <h2>Checklist de Conclusão (${concluidas}/${checklist.length})</h2>
      ${checkHTML}

      ${observacoes ? `<h2>Observações Técnicas</h2><div class="obs">${observacoes}</div>` : ''}

      ${fotos.length > 0 ? `<h2>Fotos Pós-Obra (${fotos.length})</h2><div class="fotos">${fotosHTML}</div>` : ''}

      ${linkRelatorio ? `<h2>Documentação</h2><p style="font-size:12px"><a href="${linkRelatorio}">${linkRelatorio}</a></p>` : ''}

      <div class="footer">
        MGR Refrigeração — Relatório gerado em ${hoje} · Projeto: ${project.nome} · Cliente: ${project.clientName}
      </div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) { win.document.write(html); win.document.close(); }
};

// ── Componente principal ──────────────────────────────────────────────────────
const ProjectRelatorio: React.FC<Props> = ({ projectId, project, onSave }) => {
  const { ordens } = useProjectOS(projectId);
  const { kpis } = useProjectGantt(projectId);

  // Dados do relatório persistido no projeto
  const relatorio = (project as any).relatorioFinal as ProjectRelatorioData | undefined;

  const [checklist, setChecklist] = useState<{ item: string; feito: boolean }[]>(
    relatorio?.checklistConclusao || CHECKLIST_PADRAO.map(item => ({ item, feito: false }))
  );
  const [fotos, setFotos] = useState<string[]>(relatorio?.fotosPostObra || []);
  const [observacoes, setObservacoes] = useState(relatorio?.observacoesTecnicas || '');
  const [linkRelatorio, setLinkRelatorio] = useState(relatorio?.linkRelatorio || '');
  const [enviado, setEnviado] = useState(relatorio?.enviadoAoCliente || false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showOS, setShowOS] = useState(true);
  const [showGanttKpi, setShowGanttKpi] = useState(true);
  const fotoRef = React.useRef<HTMLInputElement>(null);

  const itensConcluidos = checklist.filter(c => c.feito).length;
  const progresso = Math.round((itensConcluidos / checklist.length) * 100);

  // Resumo das O.S. para o relatório
  const osResumo = useMemo(() => ordens.map(os => ({
    titulo: os.title,
    status: STATUS_OS_LABELS[os.status]?.label || os.status,
    tecnico: os.assigneeName || '—',
    data: fmtDate(os.endDate || os.scheduling?.dataPrevista),
  })), [ordens]);

  const toggleItem = (i: number) => {
    setChecklist(prev => prev.map((c, idx) => idx === i ? { ...c, feito: !c.feito } : c));
    setSaved(false);
  };

  const handleUploadFoto = async (file: File) => {
    setUploadingFoto(true);
    try {
      const path = `projects/${projectId}/relatorio/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', undefined, reject, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setFotos(prev => [...prev, url]);
          setSaved(false);
          resolve();
        });
      });
    } finally { setUploadingFoto(false); }
  };

  const removeFoto = (i: number) => {
    setFotos(prev => prev.filter((_, idx) => idx !== i));
    setSaved(false);
  };

  const handleSave = async (marcarEnviado = false) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, projectId), {
        relatorioFinal: {
          checklistConclusao: checklist,
          fotosPostObra: fotos,
          observacoesTecnicas: observacoes,
          linkRelatorio: linkRelatorio.trim() || null,
          enviadoAoCliente: marcarEnviado || enviado,
          ...(marcarEnviado ? { enviadoEm: serverTimestamp() } : {}),
        },
        atualizadoEm: serverTimestamp(),
      });
      if (marcarEnviado) setEnviado(true);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSave();
    } finally { setSaving(false); }
  };

  const kpiGanttForPDF = kpis.totalTarefas > 0 ? {
    spi: kpis.spi,
    desvio: kpis.desvioTotalDias,
    atrasoPorParty: kpis.atrasoPorParty,
  } : null;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">📋 Relatório de Conclusão</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {enviado && (
            <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Enviado ao Cliente
            </span>
          )}
          <button
            onClick={() => gerarPDF(project, checklist, fotos, observacoes, linkRelatorio, osResumo, kpiGanttForPDF)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors">
            <Printer className="w-3.5 h-3.5" /> Exportar PDF
          </button>
          {(linkRelatorio || fotos.length > 0) && (
            <button onClick={() => {
              const concluidasCount = checklist.filter(c => c.feito).length;
              const msg = encodeURIComponent(
                `Olá ${project.clientName}! 👋\n\nSegue o relatório de conclusão do projeto *${project.nome}*.\n\n` +
                `✅ ${concluidasCount}/${checklist.length} itens do checklist concluídos\n\n` +
                `${linkRelatorio ? `📎 Relatório completo: ${linkRelatorio}\n\n` : ''}` +
                `Qualquer dúvida estou à disposição. Obrigado pela confiança! 🙏`
              );
              window.open(`https://wa.me/?text=${msg}`, '_blank');
            }}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors">
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </button>
          )}
          <button onClick={() => handleSave(false)} disabled={saving}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${saved ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'} disabled:opacity-50`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Salvo ✓' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* ── Consolidação de O.S. ── */}
      <div className="border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setShowOS(!showOS)}
          className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
          <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-brand-600" />
            Ordens de Serviço ({ordens.length})
          </p>
          {showOS ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>
        {showOS && (
          ordens.length === 0 ? (
            <div className="py-6 text-center text-xs text-gray-400">Nenhuma O.S. vinculada ao projeto.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {/* Resumo de status */}
              <div className="px-4 py-2 flex items-center gap-3 flex-wrap bg-white">
                {Object.entries(STATUS_OS_LABELS).map(([status, cfg]) => {
                  const count = ordens.filter(o => o.status === status).length;
                  if (count === 0) return null;
                  return (
                    <span key={status} className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.cor}`}>
                      {cfg.label}: {count}
                    </span>
                  );
                })}
              </div>
              {ordens.map(os => {
                const cfg = STATUS_OS_LABELS[os.status] || STATUS_OS_LABELS.pending;
                return (
                  <div key={os.id} className="px-4 py-2.5 flex items-center gap-3 bg-white">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {os.code && <span className="text-[10px] font-bold text-gray-400">{os.code}</span>}
                        <span className="text-xs font-bold text-gray-900 truncate">{os.title}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${cfg.cor}`}>{cfg.label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                        {os.assigneeName && <span className="flex items-center gap-0.5"><User className="w-2.5 h-2.5" />{os.assigneeName}</span>}
                        {(os.endDate || os.scheduling?.dataPrevista) && (
                          <span>· {fmtDate(os.endDate || os.scheduling?.dataPrevista)}</span>
                        )}
                      </div>
                    </div>
                    {os.status === 'completed' ? (
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    ) : os.status === 'blocked' ? (
                      <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* ── KPIs do Gantt (baseline vs. real) ── */}
      {kpis.totalTarefas > 0 && (
        <div className="border border-gray-200 rounded-2xl overflow-hidden">
          <button onClick={() => setShowGanttKpi(!showGanttKpi)}
            className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors">
            <p className="text-xs font-extrabold text-gray-700 uppercase tracking-wide flex items-center gap-1.5">
              <BarChart2 className="w-3.5 h-3.5 text-brand-600" /> Desempenho do Cronograma
            </p>
            {showGanttKpi ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showGanttKpi && (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                {
                  label: 'SPI', value: kpis.spi.toFixed(2),
                  color: kpis.spi >= 1 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
                  sub: kpis.spi >= 1 ? 'no prazo' : 'abaixo do prazo',
                },
                {
                  label: 'Desvio Total', value: `${kpis.desvioTotalDias}d`,
                  color: kpis.desvioTotalDias === 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200',
                  sub: `${kpis.tarefasAtrasadas} tarefa(s) atrasada(s)`,
                },
                {
                  label: 'Concluídas', value: `${kpis.tarefasConcluidas}/${kpis.totalTarefas}`,
                  color: 'bg-blue-50 text-blue-700 border-blue-200',
                  sub: `${kpis.totalTarefas > 0 ? Math.round((kpis.tarefasConcluidas / kpis.totalTarefas) * 100) : 0}%`,
                },
                {
                  label: 'Adversidades', value: kpis.totalAdversidades,
                  color: kpis.totalAdversidades === 0 ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-red-50 text-red-700 border-red-200',
                  sub: 'registradas',
                },
              ].map(k => (
                <div key={k.label} className={`rounded-xl border p-3 ${k.color}`}>
                  <p className="text-[9px] font-bold uppercase tracking-wide opacity-60">{k.label}</p>
                  <p className="text-2xl font-extrabold">{k.value}</p>
                  <p className="text-[10px] opacity-60 mt-0.5">{k.sub}</p>
                </div>
              ))}

              {/* Distribuição de responsabilidade */}
              {kpis.totalAdversidades > 0 && (
                <div className="col-span-2 md:col-span-4 bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
                  <p className="text-[10px] font-extrabold text-gray-600 uppercase tracking-wide">Responsabilidade por Atrasos</p>
                  {[
                    { label: 'MGR', dias: kpis.atrasoPorParty.mgr, color: 'bg-brand-500', icon: <Building2 className="w-3 h-3" /> },
                    { label: 'Cliente', dias: kpis.atrasoPorParty.cliente, color: 'bg-orange-400', icon: <User className="w-3 h-3" /> },
                    { label: 'Terceiros', dias: kpis.atrasoPorParty.terceiro, color: 'bg-purple-400', icon: <Users className="w-3 h-3" /> },
                  ].map(({ label, dias, color, icon }) => {
                    const total = kpis.atrasoPorParty.mgr + kpis.atrasoPorParty.cliente + kpis.atrasoPorParty.terceiro;
                    const pct = total > 0 ? Math.round((dias / total) * 100) : 0;
                    return (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5 w-20 flex-shrink-0">{icon}{label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-gray-700 w-16 text-right flex-shrink-0">{dias}d ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Checklist de conclusão ── */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-gray-600">Checklist de Conclusão</span>
          <span className="text-sm font-extrabold text-gray-900">{itensConcluidos}/{checklist.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div className={`h-2 rounded-full transition-all ${progresso === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
            style={{ width: `${progresso}%` }} />
        </div>
        <div className="space-y-1.5">
          {checklist.map((c, i) => (
            <button key={i} onClick={() => toggleItem(i)}
              className="w-full flex items-center gap-3 text-left hover:bg-white rounded-lg p-1.5 transition-colors group">
              {c.feito
                ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                : <Square className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-600" />}
              <span className={`text-sm ${c.feito ? 'line-through text-gray-400' : 'text-gray-700'}`}>{c.item}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Fotos pós-obra ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" /> Fotos Pós-Obra ({fotos.length})
          </p>
          <button onClick={() => fotoRef.current?.click()} disabled={uploadingFoto}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">
            {uploadingFoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
          </button>
        </div>
        {fotos.length > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
            {fotos.map((url, i) => (
              <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-white">
                <img src={url} alt={`Pós-obra ${i + 1}`} className="w-full h-full object-cover" />
                <button onClick={() => removeFoto(i)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 text-center py-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Nenhuma foto adicionada
          </p>
        )}
        <input ref={fotoRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadFoto(f); e.target.value = ''; }} />
      </div>

      {/* ── Observações técnicas ── */}
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Observações Técnicas de Conclusão</label>
        <textarea value={observacoes} onChange={e => { setObservacoes(e.target.value); setSaved(false); }} rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Anotações sobre a entrega, pendências, garantias, recomendações..." />
      </div>

      {/* ── Link do relatório ── */}
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Link do Relatório (PDF externo ou drive)</label>
        <input value={linkRelatorio} onChange={e => { setLinkRelatorio(e.target.value); setSaved(false); }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="https://..." />
      </div>

      {/* ── Ação: Enviar ao cliente ── */}
      {!enviado && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-blue-900">Relatório pronto para envio?</p>
            <p className="text-xs text-blue-600 mt-0.5">
              {progresso < 100
                ? `Ainda faltam ${checklist.length - itensConcluidos} item(ns) no checklist.`
                : 'Checklist completo! Pronto para marcar como entregue.'}
            </p>
          </div>
          <button onClick={() => handleSave(true)} disabled={saving || progresso < 100}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 flex-shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Marcar como Enviado
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectRelatorio;

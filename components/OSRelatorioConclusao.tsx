/**
 * components/OSRelatorioConclusao.tsx
 *
 * Relatório de conclusão de O.S. avulsa (corretiva/preventiva pontual, sem projeto).
 * Modelado no mesmo padrão visual/estrutural de ProjectRelatorio.tsx, mas operando
 * sobre uma única Task em vez de um ProjectV2 com várias O.S. vinculadas.
 * Os dados já vêm prontos da execução do técnico (FieldOSEncerramentoModal) —
 * este componente só apresenta, exporta em PDF e rastreia o envio ao cliente.
 */
import React, { useState } from 'react';
import {
  Printer, Share2, Check, Send, Loader2, User, Building2, Save,
  Calendar, Wrench, AlertTriangle, MessageSquare, Image as ImageIcon, Hash,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task, OSItemTarefa, OSObservacao } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  task: Task;
  onClose: () => void;
  onSave?: (updated: Task) => void;
}

const fmtDateTime = (ts: any): string => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), "dd/MM/yy 'às' HH:mm", { locale: ptBR }); }
  catch { return '—'; }
};
interface FotoComComentario { url: string; comentario?: string; }

// Evidências de tarefa vêm de até 3 formatos, dependendo de onde a O.S. foi
// executada: web novo (fotosEvidencia, com slot), web legado (fotos, Record) e
// FieldApp — técnico em campo (fotosApp + observacaoApp, fase atual da tarefa;
// fasesAnteriores guarda fotos de execuções anteriores quando a tarefa foi refeita).
const getFotosDaTarefa = (t: OSItemTarefa): FotoComComentario[] => {
  const doSlots = (t.fotosEvidencia || []).map(f => ({ url: f.url, comentario: f.descricaoGeral || undefined }));
  const doLegado = t.fotos ? Object.values(t.fotos).map(f => ({ url: f.url, comentario: f.comentarioTecnico || undefined })) : [];
  const doAppAtual = (t.fotosApp || []).map(url => ({ url, comentario: t.observacaoApp || undefined }));
  const doAppAnterior = (t.fasesAnteriores || []).flatMap(fase =>
    (fase.fotos || []).map(url => ({ url, comentario: fase.observacao || undefined }))
  );
  return [...doSlots, ...doLegado, ...doAppAtual, ...doAppAnterior];
};

interface ConteudoEditavel { descricaoServico: string; pendencia: string; recomendacao: string; }

// ── Geração de PDF/Print com layout MGR (mesmo padrão de ProjectRelatorio.gerarPDF) ──
const gerarPDF = (task: Task, conteudo: ConteudoEditavel) => {
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const numeroOS = (task as any).numeroOS || task.code || task.id.slice(0, 8).toUpperCase();

  const fotosAntes: string[] = (task as any).execution?.evidencias || [];
  const fotosDepois: string[] = (task as any).fotosFinais || [];
  const tarefas = ((task as any).tarefasOS || []) as OSItemTarefa[];
  const observacoes = ((task as any).observacoes || []) as OSObservacao[];
  const inicio = (task as any).execution?.actualStartTime;
  const fim = (task as any).execution?.actualEndTime;

  const fotosHTML = (urls: string[]) => urls.slice(0, 6).map(url =>
    `<img src="${url}" style="width:31%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb" />`
  ).join('');

  const horarioHTML = (inicio || fim) ? `
    <h2>Horário de Atendimento</h2>
    <div class="obs"><strong>Início:</strong> ${fmtDateTime(inicio)} &nbsp;|&nbsp; <strong>Finalização:</strong> ${fmtDateTime(fim)}</div>
  ` : '';

  const tarefasHTML = tarefas.length > 0 ? `
    <h2>Itens Executados (${tarefas.length})</h2>
    ${tarefas.map(t => {
      const fotos = getFotosDaTarefa(t);
      const comentarios = [...new Set(fotos.map(f => f.comentario).filter(Boolean))];
      return `
      <div style="margin-bottom:10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:16px;height:16px;border-radius:3px;border:2px solid ${t.status === 'concluida' ? '#059669' : '#d1d5db'};background:${t.status === 'concluida' ? '#059669' : '#fff'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
            ${t.status === 'concluida' ? '<span style="color:white;font-size:11px;font-weight:bold">✓</span>' : ''}
          </div>
          <span style="font-size:12px;font-weight:600;color:#374151">${t.descricao}</span>
        </div>
        ${comentarios.map(c => `<p style="font-size:11px;color:#6b7280;margin:4px 0 0 24px;font-style:italic">"${c}"</p>`).join('')}
        ${fotos.length > 0 ? `<div class="fotos" style="margin:6px 0 0 24px">${fotosHTML(fotos.map(f => f.url))}</div>` : ''}
      </div>`;
    }).join('')}
  ` : '';

  const observacoesHTML = observacoes.length > 0 ? `
    <h2>Observações Gerais (${observacoes.length})</h2>
    ${observacoes.map(o => `
      <div class="obs" style="margin-bottom:6px">
        <strong>${o.autorNome}</strong> — ${fmtDateTime(o.criadaEm)}<br/>${o.texto}
      </div>
    `).join('')}
  ` : '';

  const html = `<!DOCTYPE html>
    <html lang="pt-BR"><head><meta charset="UTF-8"/>
    <title>Relatório de Conclusão — ${numeroOS}</title>
    <style>
      @page { size: A4; margin: 18mm 15mm; }
      * { box-sizing: border-box; }
      body { font-family: system-ui, Arial, sans-serif; color: #111827; margin: 0; font-size: 13px; }
      .header { border-bottom: 3px solid #2563eb; padding-bottom: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
      .logo { font-size: 18px; font-weight: 900; color: #2563eb; }
      .numero { font-size: 20px; font-weight: 900; color: #111827; letter-spacing: 0.5px; }
      h1 { font-size: 16px; margin: 4px 0; }
      .meta { font-size: 11px; color: #6b7280; margin-top: 6px; }
      h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 18px 0 8px; }
      .obs { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; font-size: 12px; white-space: pre-wrap; }
      .fotos { display: flex; flex-wrap: wrap; gap: 8px; }
      .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 10px; color: #9ca3af; text-align: center; }
      @media print { button { display: none !important; } }
    </style></head>
    <body>
      <div class="header">
        <div>
          <div class="logo">MGR Refrigeração</div>
          <h1>Relatório de Conclusão de O.S.</h1>
          <div class="meta">
            <strong>Cliente:</strong> ${task.clientName || '—'} &nbsp;|&nbsp;
            <strong>Técnico:</strong> ${task.assigneeName || '—'} &nbsp;|&nbsp;
            <strong>Data:</strong> ${hoje}
          </div>
        </div>
        <div style="text-align:right">
          <div class="numero">${numeroOS}</div>
        </div>
      </div>

      <h2>Serviço</h2>
      <div class="obs">
        ${(task as any).tipoServico ? `<strong>Tipo:</strong> ${(task as any).tipoServico}<br/>` : ''}
        ${task.title ? `<strong>Título:</strong> ${task.title}<br/>` : ''}
        ${conteudo.descricaoServico ? `<strong>Descrição:</strong> ${conteudo.descricaoServico}` : ''}
      </div>

      ${horarioHTML}

      ${tarefasHTML}

      ${fotosAntes.length > 0 ? `<h2>Fotos — Antes (${fotosAntes.length})</h2><div class="fotos">${fotosHTML(fotosAntes)}</div>` : ''}
      ${fotosDepois.length > 0 ? `<h2>Fotos — Depois (${fotosDepois.length})</h2><div class="fotos">${fotosHTML(fotosDepois)}</div>` : ''}

      ${observacoesHTML}

      ${conteudo.pendencia ? `<h2>Pendência</h2><div class="obs">${conteudo.pendencia}</div>` : ''}
      ${conteudo.recomendacao ? `<h2>Recomendação ao Cliente</h2><div class="obs">${conteudo.recomendacao}</div>` : ''}

      <div class="footer">
        MGR Refrigeração — Relatório gerado em ${hoje} · O.S. ${numeroOS} · Cliente: ${task.clientName || '—'}
      </div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) { win.document.write(html); win.document.close(); }
};

const OSRelatorioConclusao: React.FC<Props> = ({ task, onClose, onSave }) => {
  const { currentUser, userProfile } = useAuth() as any;
  const [saving, setSaving] = useState(false);
  const [salvo, setSalvo] = useState(false);

  const numeroOS = (task as any).numeroOS || task.code || task.id.slice(0, 8).toUpperCase();
  const envio = (task as any).relatorioOSEnvio as { status: 'aguardando_relatorio' | 'relatorio_enviado'; enviadoEm?: any } | undefined;
  const enviado = envio?.status === 'relatorio_enviado';
  const relatorio = (task as any).relatorioFinal as { pendencia: string | null; recomendacao: string | null } | undefined;
  const conteudoSalvo = (task as any).relatorioOSConteudo as { descricaoServico?: string; pendencia?: string; recomendacao?: string } | undefined;
  const fotosAntes: string[] = (task as any).execution?.evidencias || [];
  const fotosDepois: string[] = (task as any).fotosFinais || [];
  const tarefas = ((task as any).tarefasOS || []) as OSItemTarefa[];
  const observacoes = ((task as any).observacoes || []) as OSObservacao[];
  const inicio = (task as any).execution?.actualStartTime;
  const fim = (task as any).execution?.actualEndTime;

  // Texto editável do relatório — pré-preenchido com o que já foi salvo (se houver)
  // ou derivado dos dados brutos de execução. Editar aqui NÃO altera o registro
  // técnico original (relatorioFinal), só o texto final que vai pro relatório.
  const [descricaoServico, setDescricaoServico] = useState(
    conteudoSalvo?.descricaoServico ?? task.description ?? task.title ?? ''
  );
  const [pendencia, setPendencia] = useState(conteudoSalvo?.pendencia ?? relatorio?.pendencia ?? '');
  const [recomendacao, setRecomendacao] = useState(conteudoSalvo?.recomendacao ?? relatorio?.recomendacao ?? '');

  const salvarConteudo = async (): Promise<Record<string, any>> => {
    const nome = userProfile?.nomeCompleto || userProfile?.displayName || 'Gestor';
    const relatorioOSConteudo = {
      descricaoServico, pendencia, recomendacao,
      editadoPor: currentUser?.uid, editadoPorNome: nome, editadoEm: serverTimestamp(),
    };
    await updateDoc(doc(db, 'tasks', task.id), { relatorioOSConteudo });
    return { ...task, relatorioOSConteudo } as any;
  };

  const handleSalvar = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const updated = await salvarConteudo();
      onSave?.(updated as Task);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2500);
    } finally { setSaving(false); }
  };

  const handleMarcarEnviado = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const nome = userProfile?.nomeCompleto || userProfile?.displayName || 'Gestor';
      await salvarConteudo();
      await updateDoc(doc(db, 'tasks', task.id), {
        relatorioOSEnvio: {
          status: 'relatorio_enviado',
          enviadoEm: serverTimestamp(),
          enviadoPor: currentUser.uid,
          enviadoPorNome: nome,
        },
      });
      onSave?.({ ...task, relatorioOSEnvio: { status: 'relatorio_enviado', enviadoPor: currentUser.uid, enviadoPorNome: nome } } as Task);
    } finally { setSaving(false); }
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      `Olá ${task.clientName || ''}! 👋\n\nSegue o relatório de conclusão da O.S. *${numeroOS}*.\n\n` +
      `${task.title ? `Serviço: ${task.title}\n\n` : ''}` +
      `Qualquer dúvida estou à disposição. Obrigado pela confiança! 🙏`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1">
              <Hash className="w-3 h-3" /> {numeroOS}
            </p>
            <h3 className="font-bold text-gray-900">Relatório de Conclusão de O.S.</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">×</button>
        </div>

        <div className="p-5 space-y-4">
          {enviado && (
            <div className="flex items-center gap-2 text-xs font-bold px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl">
              <Check className="w-3.5 h-3.5" /> Relatório enviado ao cliente {envio?.enviadoEm && `em ${fmtDateTime(envio.enviadoEm)}`}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400" /> {task.clientName || '—'}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4 text-gray-400" /> {task.assigneeName || '—'}
            </div>
            {(task as any).tipoServico && (
              <div className="flex items-center gap-2 text-gray-600">
                <Wrench className="w-4 h-4 text-gray-400" /> {(task as any).tipoServico}
              </div>
            )}
            {(inicio || fim) && (
              <div className="col-span-2 flex items-center gap-2 text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                Início: {fmtDateTime(inicio)} &nbsp;·&nbsp; Finalização: {fmtDateTime(fim)}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Serviço Executado</p>
            <textarea value={descricaoServico} onChange={e => setDescricaoServico(e.target.value)} rows={3}
              className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          {tarefas.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Itens Executados ({tarefas.length})</p>
              <div className="space-y-2">
                {tarefas.map(t => {
                  const fotos = getFotosDaTarefa(t);
                  const comentarios = [...new Set(fotos.map(f => f.comentario).filter(Boolean))];
                  return (
                    <div key={t.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex items-center gap-2">
                        {t.status === 'concluida'
                          ? <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                          : <div className="w-3.5 h-3.5 rounded border border-gray-300 flex-shrink-0" />}
                        <span className="text-sm font-semibold text-gray-800">{t.descricao}</span>
                      </div>
                      {comentarios.map((c, i) => (
                        <p key={i} className="text-xs text-gray-500 italic mt-1 ml-5">"{c}"</p>
                      ))}
                      {fotos.length > 0 && (
                        <div className="grid grid-cols-4 gap-1.5 mt-2 ml-5">
                          {fotos.map((f, i) => (
                            <img key={i} src={f.url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(fotosAntes.length > 0 || fotosDepois.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {fotosAntes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Antes ({fotosAntes.length})
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {fotosAntes.map((url, i) => (
                      <img key={i} src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                    ))}
                  </div>
                </div>
              )}
              {fotosDepois.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Depois ({fotosDepois.length})
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {fotosDepois.map((url, i) => (
                      <img key={i} src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {observacoes.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Observações Gerais ({observacoes.length})</p>
              <div className="space-y-1.5">
                {observacoes.map(o => (
                  <div key={o.id} className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                    <p className="text-xs font-bold text-gray-600">{o.autorNome} <span className="font-normal text-gray-400">— {fmtDateTime(o.criadaEm)}</span></p>
                    <p className="text-sm text-gray-700 mt-0.5">{o.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-xs font-bold text-orange-700 mb-1">Pendência</p>
              <textarea value={pendencia} onChange={e => setPendencia(e.target.value)} rows={2}
                placeholder="Sem pendências registradas"
                className="w-full text-sm text-orange-800 bg-white/60 border border-orange-200 rounded-lg p-2 resize-none outline-none focus:ring-2 focus:ring-orange-300 placeholder:text-orange-300" />
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <p className="text-xs font-bold text-blue-700 mb-1">Recomendação ao Cliente</p>
              <textarea value={recomendacao} onChange={e => setRecomendacao(e.target.value)} rows={2}
                placeholder="Sem recomendação registrada"
                className="w-full text-sm text-blue-800 bg-white/60 border border-blue-200 rounded-lg p-2 resize-none outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-blue-300" />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center gap-2 flex-wrap">
          <button onClick={handleSalvar} disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${salvo ? 'bg-emerald-100 text-emerald-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : salvo ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {salvo ? 'Salvo' : 'Salvar'}
          </button>
          <button onClick={() => gerarPDF(task, { descricaoServico, pendencia, recomendacao })}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50">
            <Printer className="w-3.5 h-3.5" /> Exportar PDF
          </button>
          <button onClick={handleWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700">
            <Share2 className="w-3.5 h-3.5" /> WhatsApp
          </button>
          {!enviado && (
            <button onClick={handleMarcarEnviado} disabled={saving}
              className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Marcar como Enviado
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OSRelatorioConclusao;

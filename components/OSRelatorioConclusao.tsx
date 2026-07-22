/**
 * components/OSRelatorioConclusao.tsx
 *
 * Relatório de conclusão de O.S. (avulsa, de projeto ou de contrato). Modelado
 * no mesmo padrão visual/estrutural de ProjectRelatorio.tsx.
 *
 * Existem DOIS "relatórios": o registro técnico bruto da execução (tarefasOS,
 * execution.evidencias, fotosFinais, relatorioFinal — nunca alterado aqui) e o
 * "relatório final editado" (Task.relatorioOSConteudo), uma cópia livre que o
 * gestor pode reescrever, adicionar/remover itens e fotos antes de enviar ao
 * cliente. Na primeira abertura, a cópia editável é derivada do registro bruto;
 * depois de salva, edições futuras partem sempre da última versão salva.
 */
import React, { useState } from 'react';
import {
  Printer, Share2, Check, Send, Loader2, User, Building2, Save, Plus, Trash2, X,
  Calendar, Wrench, AlertTriangle, MessageSquare, Image as ImageIcon, Hash,
} from 'lucide-react';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task, OSItemTarefa, OSObservacao, CollectionName } from '../types';
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

interface ItemRelatorio { id: string; descricao: string; comentario: string; fotos: string[]; }
export interface ConteudoEditavel {
  descricaoServico: string;
  pendencia: string;
  recomendacao: string;
  itens: ItemRelatorio[];
  fotosAntes: string[];
  fotosDepois: string[];
}

// Deriva a cópia editável inicial do registro técnico bruto — só roda na
// primeira vez (sem relatorioOSConteudo salvo ainda).
const derivarConteudoOriginal = (task: Task): ConteudoEditavel => {
  const relatorio = (task as any).relatorioFinal as { pendencia: string | null; recomendacao: string | null } | undefined;
  const tarefas = ((task as any).tarefasOS || []) as OSItemTarefa[];
  const itens: ItemRelatorio[] = tarefas.map(t => {
    const fotos = getFotosDaTarefa(t);
    const comentario = [...new Set(fotos.map(f => f.comentario).filter(Boolean))].join(' · ');
    return { id: t.id, descricao: t.descricao, comentario, fotos: fotos.map(f => f.url) };
  });
  return {
    descricaoServico: task.description || task.title || '',
    pendencia: relatorio?.pendencia || '',
    recomendacao: relatorio?.recomendacao || '',
    itens,
    fotosAntes: (task as any).execution?.evidencias || [],
    fotosDepois: (task as any).fotosFinais || [],
  };
};

const getConteudoInicial = (task: Task): ConteudoEditavel => {
  const salvo = (task as any).relatorioOSConteudo;
  if (!salvo) return derivarConteudoOriginal(task);
  return {
    descricaoServico: salvo.descricaoServico ?? task.description ?? task.title ?? '',
    pendencia: salvo.pendencia ?? '',
    recomendacao: salvo.recomendacao ?? '',
    itens: salvo.itens ?? derivarConteudoOriginal(task).itens,
    fotosAntes: salvo.fotosAntes ?? ((task as any).execution?.evidencias || []),
    fotosDepois: salvo.fotosDepois ?? ((task as any).fotosFinais || []),
  };
};

// ── Geração de PDF/Print com layout MGR (mesmo padrão de ProjectRelatorio.gerarPDF) ──
const gerarPDF = (task: Task, c: ConteudoEditavel) => {
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const numeroOS = (task as any).numeroOS || task.code || task.id.slice(0, 8).toUpperCase();
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

  const itensHTML = c.itens.length > 0 ? `
    <h2>Itens Executados (${c.itens.length})</h2>
    ${c.itens.map(item => `
      <div style="margin-bottom:10px;padding:8px 10px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa">
        <span style="font-size:12px;font-weight:600;color:#374151">${item.descricao}</span>
        ${item.comentario ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0;font-style:italic">"${item.comentario}"</p>` : ''}
        ${item.fotos.length > 0 ? `<div class="fotos" style="margin:6px 0 0">${fotosHTML(item.fotos)}</div>` : ''}
      </div>`).join('')}
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
        ${c.descricaoServico ? `<strong>Descrição:</strong> ${c.descricaoServico}` : ''}
      </div>

      ${horarioHTML}

      ${itensHTML}

      ${c.fotosAntes.length > 0 ? `<h2>Fotos — Antes (${c.fotosAntes.length})</h2><div class="fotos">${fotosHTML(c.fotosAntes)}</div>` : ''}
      ${c.fotosDepois.length > 0 ? `<h2>Fotos — Depois (${c.fotosDepois.length})</h2><div class="fotos">${fotosHTML(c.fotosDepois)}</div>` : ''}

      ${observacoesHTML}

      ${c.pendencia ? `<h2>Pendência</h2><div class="obs">${c.pendencia}</div>` : ''}
      ${c.recomendacao ? `<h2>Recomendação ao Cliente</h2><div class="obs">${c.recomendacao}</div>` : ''}

      <div class="footer">
        MGR Refrigeração — Relatório gerado em ${hoje} · O.S. ${numeroOS} · Cliente: ${task.clientName || '—'}
      </div>
      <script>window.onload=()=>window.print();<\/script>
    </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) { win.document.write(html); win.document.close(); }
};

// ── Visão somente leitura do registro original (bruto) da execução ───────────
// Também reaproveitada pelo Portal do Cliente (RelatoriosDoAtivo, em
// Assets.tsx) pra mostrar o relatório curado — mesmo shape (ConteudoEditavel).
export const ConteudoSomenteLeitura: React.FC<{ c: ConteudoEditavel }> = ({ c }) => (
  <div className="space-y-4">
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Serviço Executado</p>
      <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 whitespace-pre-wrap">{c.descricaoServico || '—'}</p>
    </div>

    {c.itens.length > 0 && (
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Itens Executados ({c.itens.length})</p>
        <div className="space-y-2">
          {c.itens.map(item => (
            <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-gray-800">{item.descricao}</p>
              {item.comentario && <p className="text-xs text-gray-500 italic mt-1">"{item.comentario}"</p>}
              {item.fotos.length > 0 && (
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {item.fotos.map((url, i) => (
                    <img key={i} src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {(c.fotosAntes.length > 0 || c.fotosDepois.length > 0) && (
      <div className="grid grid-cols-2 gap-3">
        {c.fotosAntes.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Antes ({c.fotosAntes.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {c.fotosAntes.map((url, i) => <img key={i} src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />)}
            </div>
          </div>
        )}
        {c.fotosDepois.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <ImageIcon className="w-3.5 h-3.5" /> Depois ({c.fotosDepois.length})
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {c.fotosDepois.map((url, i) => <img key={i} src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />)}
            </div>
          </div>
        )}
      </div>
    )}

    {c.pendencia && (
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
        <div><p className="text-xs font-bold text-orange-700 mb-0.5">Pendência</p><p className="text-sm text-orange-800 whitespace-pre-wrap">{c.pendencia}</p></div>
      </div>
    )}
    {c.recomendacao && (
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-start gap-2">
        <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
        <div><p className="text-xs font-bold text-blue-700 mb-0.5">Recomendação ao Cliente</p><p className="text-sm text-blue-800 whitespace-pre-wrap">{c.recomendacao}</p></div>
      </div>
    )}
  </div>
);

const OSRelatorioConclusao: React.FC<Props> = ({ task, onClose, onSave }) => {
  const { currentUser, userProfile } = useAuth() as any;
  const [saving, setSaving] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [aba, setAba] = useState<'editado' | 'original'>('editado');
  const original = derivarConteudoOriginal(task);

  const numeroOS = (task as any).numeroOS || task.code || task.id.slice(0, 8).toUpperCase();
  const envio = (task as any).relatorioOSEnvio as { status: 'aguardando_relatorio' | 'relatorio_enviado'; enviadoEm?: any } | undefined;
  const enviado = envio?.status === 'relatorio_enviado';
  const observacoes = ((task as any).observacoes || []) as OSObservacao[];
  const inicio = (task as any).execution?.actualStartTime;
  const fim = (task as any).execution?.actualEndTime;

  const inicial = getConteudoInicial(task);
  const [descricaoServico, setDescricaoServico] = useState(inicial.descricaoServico);
  const [pendencia, setPendencia] = useState(inicial.pendencia);
  const [recomendacao, setRecomendacao] = useState(inicial.recomendacao);
  const [itens, setItens] = useState<ItemRelatorio[]>(inicial.itens);
  const [fotosAntes, setFotosAntes] = useState<string[]>(inicial.fotosAntes);
  const [fotosDepois, setFotosDepois] = useState<string[]>(inicial.fotosDepois);

  const conteudoAtual = (): ConteudoEditavel => ({ descricaoServico, pendencia, recomendacao, itens, fotosAntes, fotosDepois });

  const addItem = () => setItens(prev => [...prev, { id: `novo_${Date.now()}`, descricao: '', comentario: '', fotos: [] }]);
  const removeItem = (idx: number) => setItens(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ItemRelatorio>) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  const removeFotoDoItem = (idx: number, fotoIdx: number) =>
    setItens(prev => prev.map((it, i) => i === idx ? { ...it, fotos: it.fotos.filter((_, fi) => fi !== fotoIdx) } : it));

  // Espelha só os campos seguros (sem financeiro/identidade de técnico/notas
  // internas) na coleção que o Portal do Cliente lê — ver RelatoriosDoAtivo
  // em components/Assets.tsx. Chamado ao marcar como enviado, e de novo em
  // qualquer "Salvar" posterior (mantém o relatório do cliente atualizado).
  const sincronizarRelatorioCliente = async (conteudo: ConteudoEditavel, nome: string) => {
    const clientId = (task as any).clientId;
    if (!clientId) return;
    await setDoc(doc(db, CollectionName.RELATORIOS_OS, task.id), {
      id: task.id,
      taskId: task.id,
      clientId,
      clientName: task.clientName || null,
      ativoId: (task as any).ativoId || null,
      ativoNome: (task as any).ativoNome || null,
      numeroOS,
      titulo: task.title || null,
      tipoServico: (task as any).tipoServico || null,
      assigneeName: task.assigneeName || null,
      inicio: (task as any).execution?.actualStartTime || null,
      fim: (task as any).execution?.actualEndTime || null,
      conteudo,
      enviadoEm: serverTimestamp(),
      enviadoPor: currentUser?.uid,
      enviadoPorNome: nome,
    }, { merge: true });
  };

  const salvarConteudo = async (): Promise<Task> => {
    const nome = userProfile?.nomeCompleto || userProfile?.displayName || 'Gestor';
    const relatorioOSConteudo = {
      ...conteudoAtual(),
      editadoPor: currentUser?.uid, editadoPorNome: nome, editadoEm: serverTimestamp(),
    };
    await updateDoc(doc(db, 'tasks', task.id), { relatorioOSConteudo });
    if (enviado) await sincronizarRelatorioCliente(conteudoAtual(), nome);
    return { ...task, relatorioOSConteudo } as any as Task;
  };

  const handleSalvar = async () => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const updated = await salvarConteudo();
      onSave?.(updated);
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
      await sincronizarRelatorioCliente(conteudoAtual(), nome);
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
            <p className="text-[10px] text-gray-400 mt-0.5">
              {aba === 'editado' ? 'Edite livremente — nada aqui altera o registro original da O.S.' : 'Registro original da execução, somente leitura.'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2">×</button>
        </div>

        <div className="flex gap-1 p-1 mx-5 mt-3 bg-gray-100 rounded-xl">
          <button onClick={() => setAba('editado')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${aba === 'editado' ? 'bg-white text-brand-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Editado para Envio
          </button>
          <button onClick={() => setAba('original')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${aba === 'original' ? 'bg-white text-gray-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Original da O.S.
          </button>
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

          {aba === 'original' ? (
            <ConteudoSomenteLeitura c={original} />
          ) : (
          <>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Serviço Executado</p>
            <textarea value={descricaoServico} onChange={e => setDescricaoServico(e.target.value)} rows={3}
              className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl p-3 resize-none outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Itens Executados ({itens.length})</p>
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-700">
                <Plus className="w-3.5 h-3.5" /> Adicionar item
              </button>
            </div>
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <input value={item.descricao} onChange={e => updateItem(idx, { descricao: e.target.value })}
                      placeholder="Descrição do item"
                      className="flex-1 text-sm font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-brand-400" />
                    <button onClick={() => removeItem(idx)} title="Remover item"
                      className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea value={item.comentario} onChange={e => updateItem(idx, { comentario: e.target.value })} rows={1}
                    placeholder="Comentário (opcional)"
                    className="w-full text-xs text-gray-600 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-2 focus:ring-brand-400" />
                  {item.fotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5">
                      {item.fotos.map((url, fi) => (
                        <div key={fi} className="relative group">
                          <img src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                          <button onClick={() => removeFotoDoItem(idx, fi)} title="Remover foto"
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {itens.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">Nenhum item — clique em "Adicionar item"</p>
              )}
            </div>
          </div>

          {(fotosAntes.length > 0 || fotosDepois.length > 0) && (
            <div className="grid grid-cols-2 gap-3">
              {fotosAntes.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <ImageIcon className="w-3.5 h-3.5" /> Antes ({fotosAntes.length})
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {fotosAntes.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                        <button onClick={() => setFotosAntes(prev => prev.filter((_, idx) => idx !== i))} title="Remover foto"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
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
                      <div key={i} className="relative group">
                        <img src={url} className="aspect-square object-cover rounded-lg border border-gray-200" />
                        <button onClick={() => setFotosDepois(prev => prev.filter((_, idx) => idx !== i))} title="Remover foto"
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </>
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

          {aba === 'editado' && (
          <>
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
          </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center gap-2 flex-wrap">
          {aba === 'editado' ? (
            <button onClick={handleSalvar} disabled={saving}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${salvo ? 'bg-emerald-100 text-emerald-700' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : salvo ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {salvo ? 'Salvo' : 'Salvar'}
            </button>
          ) : (
            <p className="text-[10px] text-gray-400">Somente leitura — mude para "Editado para Envio" para alterar.</p>
          )}
          <button onClick={() => gerarPDF(task, aba === 'editado' ? conteudoAtual() : original)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50">
            <Printer className="w-3.5 h-3.5" /> Exportar PDF
          </button>
          <button onClick={handleWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700">
            <Share2 className="w-3.5 h-3.5" /> WhatsApp
          </button>
          {aba === 'editado' && !enviado && (
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

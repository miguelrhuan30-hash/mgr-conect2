/**
 * components/ProjectRelatorio.tsx — Sprint 2
 *
 * Relatório final do projeto: checklist de conclusão,
 * fotos pós-obra, observações técnicas, link para PDF e envio ao cliente.
 */
import React, { useState } from 'react';
import {
  CheckSquare, Square, Upload, Image, FileText,
  Loader2, Send, Check, Trash2, Printer, Share2, ExternalLink,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  projectId: string;
  projectNome?: string;
  clientName?: string;
  relatorio?: ProjectRelatorioData;
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
];

// ── Geração de HTML para impressão/PDF ──────────────────────────────────────
const gerarPrintWindow = (
  projectNome: string,
  clientName: string,
  checklist: { item: string; feito: boolean }[],
  fotos: string[],
  observacoes: string,
  linkRelatorio: string,
) => {
  const hoje = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const checkHTML = checklist.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f0f0f0">
      <div style="width:20px;height:20px;border-radius:4px;border:2px solid ${c.feito ? '#059669' : '#d1d5db'};background:${c.feito ? '#059669' : 'white'};display:flex;align-items:center;justify-content:center;flex-shrink:0">
        ${c.feito ? '<span style="color:white;font-size:14px;font-weight:bold;">&#10003;</span>' : ''}
      </div>
      <span style="font-size:13px;color:${c.feito ? '#374151' : '#9ca3af'};${c.feito ? '' : 'text-decoration:line-through'};">${c.item}</span>
    </div>
  `).join('');
  const fotosHTML = fotos.slice(0, 6).map(url =>
    `<img src="${url}" style="width:31%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;border:1px solid #e5e7eb" />`
  ).join('');
  const conteudo = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <title>Relatório de Conclusão — ${projectNome}</title>
      <style>
        @page { size: A4; margin: 20mm 15mm; }
        * { box-sizing: border-box; }
        body { font-family: system-ui, sans-serif; color: #111827; margin: 0; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
        .logo { font-size: 20px; font-weight: 900; color: #2563eb; letter-spacing: -0.5px; }
        h1 { font-size: 18px; margin: 8px 0 4px; }
        .meta { font-size: 11px; color: #6b7280; }
        h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 20px 0 10px; }
        .obs { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 13px; white-space: pre-wrap; }
        .fotos { display: flex; flex-wrap: wrap; gap: 8px; }
        .footer { margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9ca3af; text-align: center; }
        @media print { button { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">MGR Refrigeração</div>
        <h1>Relatório de Conclusão de Projeto</h1>
        <div class="meta">
          <strong>Projeto:</strong> ${projectNome} &nbsp;|&nbsp;
          <strong>Cliente:</strong> ${clientName} &nbsp;|&nbsp;
          <strong>Data:</strong> ${hoje}
        </div>
      </div>

      <h2>Checklist de Conclusão</h2>
      ${checkHTML}

      ${observacoes ? `<h2>Observações Técnicas</h2><div class="obs">${observacoes}</div>` : ''}

      ${fotos.length > 0 ? `<h2>Fotos Pós-Obra</h2><div class="fotos">${fotosHTML}</div>` : ''}

      ${linkRelatorio ? `<h2>Documentação</h2><p style="font-size:12px;"><a href="${linkRelatorio}">${linkRelatorio}</a></p>` : ''}

      <div class="footer">
        MGR Refrigeração &mdash; Relatório gerado em ${hoje} via MGR Connect
      </div>
      <script>window.onload = () => window.print();<\/script>
    </body>
    </html>
  `;
  const win = window.open('', '_blank', 'width=900,height=700');
  if (win) { win.document.write(conteudo); win.document.close(); }
};

const ProjectRelatorio: React.FC<Props> = ({ projectId, projectNome = 'Projeto', clientName = 'Cliente', relatorio, onSave }) => {
  const [checklist, setChecklist] = useState<{ item: string; feito: boolean }[]>(
    relatorio?.checklistConclusao ||
    CHECKLIST_PADRAO.map(item => ({ item, feito: false }))
  );
  const [fotos, setFotos] = useState<string[]>(relatorio?.fotosPostObra || []);
  const [observacoes, setObservacoes] = useState(relatorio?.observacoesTecnicas || '');
  const [linkRelatorio, setLinkRelatorio] = useState(relatorio?.linkRelatorio || '');
  const [enviado, setEnviado] = useState(relatorio?.enviadoAoCliente || false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const fotoRef = React.useRef<HTMLInputElement>(null);

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

  const itensConcluidos = checklist.filter(c => c.feito).length;
  const progresso = Math.round((itensConcluidos / checklist.length) * 100);

  return (
    <div className="space-y-5">
      {/* Header com ações */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">📋 Relatório de Conclusão</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {enviado && (
            <span className="text-[9px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Enviado ao Cliente
            </span>
          )}
          {/* Imprimir / PDF */}
          <button
            onClick={() => gerarPrintWindow(projectNome, clientName, checklist, fotos, observacoes, linkRelatorio)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
          </button>
          {/* WhatsApp */}
          {(linkRelatorio || fotos.length > 0) && (
            <button
              onClick={() => {
                const msg = encodeURIComponent(
                  `Olá! Segue o relatório de conclusão do projeto *${projectNome}*.${
                    linkRelatorio ? `\n\n📎 Relatório: ${linkRelatorio}` : ''
                  }\n\nQualquer dúvida estou à disposição.`
                );
                window.open(`https://wa.me/?text=${msg}`, '_blank');
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-bold hover:bg-green-700 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" /> WhatsApp
            </button>
          )}
          <button onClick={() => handleSave(false)} disabled={saving}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${
              saved ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-600 text-white hover:bg-brand-700'
            } disabled:opacity-50`}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : null}
            {saved ? 'Salvo ✓' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Progresso do checklist */}
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-gray-600">Checklist de Conclusão</span>
          <span className="text-sm font-extrabold text-gray-900">{itensConcluidos}/{checklist.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div
            className={`h-2 rounded-full transition-all ${progresso === 100 ? 'bg-emerald-500' : 'bg-brand-600'}`}
            style={{ width: `${progresso}%` }}
          />
        </div>
        <div className="space-y-2">
          {checklist.map((c, i) => (
            <button key={i} onClick={() => toggleItem(i)}
              className="w-full flex items-center gap-3 text-left hover:bg-white rounded-lg p-1.5 transition-colors group">
              {c.feito
                ? <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                : <Square className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-gray-600" />}
              <span className={`text-sm ${c.feito ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                {c.item}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Fotos pós-obra */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Image className="w-3.5 h-3.5" /> Fotos Pós-Obra
          </p>
          <button onClick={() => fotoRef.current?.click()} disabled={uploadingFoto}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">
            {uploadingFoto ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload Foto
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

      {/* Observações técnicas */}
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Observações Técnicas de Conclusão</label>
        <textarea value={observacoes} onChange={e => { setObservacoes(e.target.value); setSaved(false); }} rows={4}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none"
          placeholder="Anotações sobre a entrega, pendências, garantias, etc..." />
      </div>

      {/* Link do relatório PDF */}
      <div>
        <label className="text-xs font-bold text-gray-600 block mb-1">Link do Relatório (PDF externo ou drive)</label>
        <input value={linkRelatorio} onChange={e => { setLinkRelatorio(e.target.value); setSaved(false); }}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm"
          placeholder="https://..." />
      </div>

      {/* Ação: Enviar ao cliente */}
      {!enviado && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-blue-900">Relatório pronto para envio?</p>
            <p className="text-xs text-blue-600">Isso marcará o projeto como entregue.</p>
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

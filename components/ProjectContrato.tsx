/**
 * components/ProjectContrato.tsx
 *
 * Painel da Fase 4 (Contrato) — opera sobre `project.propostaDocumento`.
 *
 * Sub-status (em propostaDocumento.status):
 *   publicado → aguardando aprovação do cliente
 *   aceito    → cliente aprovou, aguardando assinatura
 *   assinado  → contrato assinado (auto-avança para fase contrato_assinado)
 *
 * Toda ação que o cliente pode fazer no link público tem espelho aqui (admin
 * executando em nome do cliente — cobre fluxos de WhatsApp/presencial).
 *
 * Também suporta o retrocesso "🔄 Cliente pediu ajustes" → volta para Proposta.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  FileText, CheckCircle2, AlertCircle, Loader2, ExternalLink,
  Download, Pen, Upload, RefreshCw, ArrowRight, ArrowLeft, Info, X,
} from 'lucide-react';
import {
  doc, updateDoc, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { CollectionName, ProjectV2, AssinaturaCampo } from '../types';
import { useProject } from '../hooks/useProject';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SignaturePadModal from './SignaturePadModal';
import ContratoSignatureFieldEditor from './ContratoSignatureFieldEditor';

interface Props {
  project: ProjectV2;
}

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try { return format(ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); }
  catch { return '—'; }
};

type SubStatus = 'publicado' | 'aceito' | 'assinado';

const STATUS_CONFIG: Record<SubStatus, { label: string; color: string; descricao: string }> = {
  publicado: { label: 'Aguardando aprovação',      color: 'bg-blue-100 text-blue-700 border-blue-200',          descricao: 'Cliente pode ver a apresentação e clicar em "Aceitar Proposta" no link público.' },
  aceito:    { label: 'Aceito — aguardando assinatura', color: 'bg-amber-100 text-amber-700 border-amber-200',  descricao: 'Cliente aprovou a proposta. Falta assinar o contrato (virtualmente ou via upload).' },
  assinado:  { label: 'Contrato assinado',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200', descricao: 'Tudo pronto. O card avança automaticamente para Planejamento.' },
};

const ProjectContrato: React.FC<Props> = ({ project }) => {
  const { advancePhase } = useProject();
  const propostaDoc = project.propostaDocumento;
  const status: SubStatus = (propostaDoc?.status === 'aceito' || propostaDoc?.status === 'assinado')
    ? propostaDoc.status
    : 'publicado';

  const [busy, setBusy] = useState<string | null>(null);
  const [showSignPad, setShowSignPad] = useState(false);
  const [showCampoEditor, setShowCampoEditor] = useState(false);
  const [showVoltar, setShowVoltar] = useState(false);
  const [voltarMotivo, setVoltarMotivo] = useState('');
  const [showAceiteModal, setShowAceiteModal] = useState(false);
  const [aceiteNome, setAceiteNome] = useState(project.clientName || '');
  const [aceiteEmail, setAceiteEmail] = useState('');

  const uploadAssinadoRef = useRef<HTMLInputElement>(null);

  const projectRef = doc(db, CollectionName.PROJECTS_V2, project.id);
  const linkPublico = propostaDoc?.slug
    ? `${window.location.origin}/#/proposta/${propostaDoc.slug}`
    : '';

  // ── Auto-avanço quando status vira 'assinado' ──────────────────────────────
  useEffect(() => {
    if (project.fase === 'contrato_enviado' && propostaDoc?.status === 'assinado') {
      advancePhase(project.id, 'contrato_assinado', 'Contrato assinado — avanço automático');
    }
  }, [propostaDoc?.status, project.fase, project.id, advancePhase]);

  // ── Ações da retaguarda (espelhos das ações do cliente) ────────────────────
  const handleRegistrarAceite = async () => {
    if (!aceiteNome.trim()) return;
    setBusy('aceite');
    try {
      await updateDoc(projectRef, {
        'propostaDocumento.status': 'aceito',
        'propostaDocumento.aceitoEm': Timestamp.now(),
        'propostaDocumento.aceitoPor': aceiteNome.trim(),
        'propostaDocumento.aceitoPorEmail': aceiteEmail.trim(),
        updatedAt: serverTimestamp(),
      });
      setShowAceiteModal(false);
    } finally {
      setBusy(null);
    }
  };

  const handleVirtualSignedSaved = async ({ contratoFinalUrl, contratoFinalPath, imagemDataUrl }: {
    contratoFinalUrl: string; contratoFinalPath: string; imagemDataUrl: string;
  }) => {
    await updateDoc(projectRef, {
      'propostaDocumento.contratoFinalUrl': contratoFinalUrl,
      'propostaDocumento.contratoFinalPath': contratoFinalPath,
      'propostaDocumento.assinaturaDesenho': {
        imagemDataUrl,
        assinadoEm: Timestamp.now(),
        assinadoPor: propostaDoc?.aceitoPor || project.clientName,
        assinadoPorEmail: propostaDoc?.aceitoPorEmail || '',
      },
      'propostaDocumento.status': 'assinado',
      'propostaDocumento.assinadoEm': Timestamp.now(),
      updatedAt: serverTimestamp(),
    });
    setShowSignPad(false);
  };

  const handleUploadAssinadoExterno = async (file: File) => {
    setBusy('upload-assinado');
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const path = `projects/${project.id}/contrato_assinado/${Date.now()}.${ext}`;
      const ref = storageRef(storage, path);
      await uploadBytes(ref, file);
      const url = await getDownloadURL(ref);
      const urlsAnteriores = propostaDoc?.contratoAssinadoUrls || [];
      await updateDoc(projectRef, {
        'propostaDocumento.contratoAssinadoUrls': [...urlsAnteriores, url],
        'propostaDocumento.status': 'assinado',
        'propostaDocumento.assinadoEm': Timestamp.now(),
        updatedAt: serverTimestamp(),
      });
    } finally {
      setBusy(null);
    }
  };

  const handleVoltarParaProposta = async () => {
    if (!voltarMotivo.trim()) return;
    setBusy('voltar');
    try {
      // Reseta sub-status e zera assinatura virtual (se houve) — preserva contratoPdfUrl
      const updates: Record<string, any> = {
        'propostaDocumento.status': 'publicado',
        updatedAt: serverTimestamp(),
      };
      if (propostaDoc?.assinaturaDesenho) updates['propostaDocumento.assinaturaDesenho'] = null;
      if (propostaDoc?.contratoFinalUrl) {
        updates['propostaDocumento.contratoFinalUrl'] = null;
        updates['propostaDocumento.contratoFinalPath'] = null;
      }
      if (propostaDoc?.assinadoEm) updates['propostaDocumento.assinadoEm'] = null;
      await updateDoc(projectRef, updates);

      const result = await advancePhase(
        project.id, 'proposta_enviada',
        `Cliente pediu ajustes na proposta: ${voltarMotivo}`,
      );
      if (!result.success) {
        alert(`Erro ao retornar para Proposta: ${result.error}`);
      }
      setShowVoltar(false);
      setVoltarMotivo('');
    } finally {
      setBusy(null);
    }
  };

  const handleSaveAssinaturaCampo = async (campo: AssinaturaCampo) => {
    await updateDoc(projectRef, {
      'propostaDocumento.assinaturaCampo': campo,
      updatedAt: serverTimestamp(),
    });
    setShowCampoEditor(false);
  };

  const handleAvancarManual = async () => {
    setBusy('avancar');
    try {
      const result = await advancePhase(project.id, 'contrato_assinado', 'Avanço manual após assinatura');
      if (!result.success) alert(result.error || 'Erro');
    } finally {
      setBusy(null);
    }
  };

  // ── Estado: sem propostaDocumento ──────────────────────────────────────────
  if (!propostaDoc || !propostaDoc.slug) {
    return (
      <div className="text-center py-10 text-gray-500">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-amber-400" />
        <p className="text-sm font-medium">Este projeto não tem documento de proposta vinculado.</p>
        <p className="text-xs text-gray-400 mt-1">Volte para a Fase Proposta e suba o contrato no Passo 3 antes de avançar.</p>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[status];

  return (
    <div className="space-y-5">

      {/* Header com status */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-base">
            📝 Contrato
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{project.nome} · {project.clientName}</p>
        </div>
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      {/* Banner descritivo do status */}
      <div className="rounded-2xl p-4 bg-gray-50 border border-gray-200 flex items-start gap-3">
        <Info className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-gray-700 leading-relaxed">{statusCfg.descricao}</div>
      </div>

      {/* Timeline */}
      <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-5 py-3">
        {(['publicado', 'aceito', 'assinado'] as SubStatus[]).map((s, i, arr) => {
          const idx = ['publicado', 'aceito', 'assinado'].indexOf(status);
          const done = i <= idx;
          return (
            <React.Fragment key={s}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 ${done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-bold hidden sm:block truncate ${done ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {STATUS_CONFIG[s].label}
                </span>
              </div>
              {i < arr.length - 1 && <div className={`h-0.5 flex-1 max-w-12 rounded-full ${i < idx ? 'bg-emerald-300' : 'bg-gray-100'}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Resumo das datas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: 'Publicado', value: fmtDate(propostaDoc.publicadoEm) },
          ...(propostaDoc.aceitoEm ? [{ label: 'Aceito por',    value: `${propostaDoc.aceitoPor || '—'} · ${fmtDate(propostaDoc.aceitoEm)}` }] : []),
          ...(propostaDoc.assinadoEm ? [{ label: 'Assinado em', value: fmtDate(propostaDoc.assinadoEm) }] : []),
        ].map(f => (
          <div key={f.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{f.label}</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5 break-words">{f.value}</p>
          </div>
        ))}
      </div>

      {/* Link público + contrato PDF */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-700">Link público do cliente</p>
        {linkPublico ? (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
            <span className="text-xs font-mono text-indigo-700 truncate flex-1">{linkPublico}</span>
            <button onClick={() => navigator.clipboard.writeText(linkPublico)}
              className="text-[10px] font-bold text-indigo-700 hover:underline flex-shrink-0">
              Copiar
            </button>
            <a href={linkPublico} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-600 flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            Slug não definido. Volte para a Proposta e publique o documento.
          </p>
        )}

        {propostaDoc.contratoPdfUrl ? (
          <div className="flex items-center gap-2 flex-wrap">
            <a href={propostaDoc.contratoPdfUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-50">
              <Download className="w-3.5 h-3.5" /> Baixar Contrato Original
            </a>
            <button onClick={() => setShowCampoEditor(true)}
              className="flex items-center gap-1.5 px-3 py-2 border border-purple-200 text-purple-700 rounded-xl text-xs font-bold hover:bg-purple-50">
              <Pen className="w-3.5 h-3.5" />
              {propostaDoc.assinaturaCampo ? 'Redesenhar campo de assinatura' : 'Marcar campo de assinatura'}
            </button>
            {propostaDoc.contratoFinalUrl && (
              <a href={propostaDoc.contratoFinalUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5" /> Contrato Assinado (virtual)
              </a>
            )}
            {(propostaDoc.contratoAssinadoUrls || []).map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5" /> Anexo Assinado #{i + 1}
              </a>
            ))}
          </div>
        ) : (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
            ⚠️ Sem PDF de contrato vinculado. Volte para a Proposta (Passo 3) e suba o contrato.
          </p>
        )}
      </div>

      {/* Ações da retaguarda — espelhos das ações do cliente */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-700">
          Ações da retaguarda
          <span className="text-[10px] font-normal text-gray-400 ml-2">
            (use quando o cliente fechar por WhatsApp / presencialmente)
          </span>
        </p>

        <div className="flex flex-wrap gap-2">
          {/* Registrar aceite externo */}
          {status === 'publicado' && (
            <button onClick={() => setShowAceiteModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700">
              <CheckCircle2 className="w-3.5 h-3.5" /> Registrar aceite (em nome do cliente)
            </button>
          )}

          {/* Assinar virtualmente em nome do cliente */}
          {status === 'aceito' && propostaDoc.contratoPdfUrl && (
            <button onClick={() => setShowSignPad(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700">
              <Pen className="w-3.5 h-3.5" /> Assinar virtualmente (em nome do cliente)
            </button>
          )}

          {/* Upload de contrato assinado externo */}
          {(status === 'aceito' || status === 'publicado') && (
            <>
              <input ref={uploadAssinadoRef} type="file" accept="application/pdf,image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadAssinadoExterno(f); e.target.value = ''; }} />
              <button onClick={() => uploadAssinadoRef.current?.click()} disabled={busy === 'upload-assinado'}
                className="flex items-center gap-1.5 px-3 py-2 border border-emerald-300 text-emerald-700 bg-white rounded-xl text-xs font-bold hover:bg-emerald-50 disabled:opacity-50">
                {busy === 'upload-assinado'
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Upload className="w-3.5 h-3.5" />}
                Upload contrato assinado (externo)
              </button>
            </>
          )}

          {/* Cliente pediu ajustes — sempre disponível */}
          <button onClick={() => setShowVoltar(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 text-amber-700 bg-white rounded-xl text-xs font-bold hover:bg-amber-50">
            <RefreshCw className="w-3.5 h-3.5" /> 🔄 Cliente pediu ajustes
          </button>

          {/* Avanço manual quando assinado (fallback) */}
          {status === 'assinado' && project.fase === 'contrato_enviado' && (
            <button onClick={handleAvancarManual} disabled={busy === 'avancar'}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
              {busy === 'avancar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              Avançar para Planejamento
            </button>
          )}
        </div>

        {/* Painel "voltar para Proposta" */}
        {showVoltar && (
          <div className="rounded-xl p-3 bg-amber-50 border border-amber-200 space-y-2">
            <p className="text-xs font-bold text-amber-900">O que o cliente pediu para ajustar?</p>
            <textarea value={voltarMotivo} onChange={e => setVoltarMotivo(e.target.value)}
              rows={2} placeholder="Ex: alteração de prazo, escopo a mais, condição de pagamento..."
              className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleVoltarParaProposta} disabled={!voltarMotivo.trim() || busy === 'voltar'}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 disabled:opacity-50">
                {busy === 'voltar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                Voltar para Proposta
              </button>
              <button onClick={() => { setShowVoltar(false); setVoltarMotivo(''); }}
                className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-xs">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            </div>
            {status === 'assinado' && (
              <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5">
                ⚠️ Este contrato já foi assinado. Voltar agora <strong>resetará</strong> a assinatura virtual e o status (mantém anexos externos no histórico).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Modal de aceite (em nome do cliente) */}
      {showAceiteModal && (
        <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-gray-900">Registrar Aceite</h3>
              <button onClick={() => setShowAceiteModal(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Use isto quando o cliente confirmou a aceitação fora do sistema (WhatsApp, telefone, presencial).
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Nome de quem aceitou *</label>
                <input value={aceiteNome} onChange={e => setAceiteNome(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">E-mail (opcional)</label>
                <input value={aceiteEmail} onChange={e => setAceiteEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setShowAceiteModal(false)}
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm">
                Cancelar
              </button>
              <button onClick={handleRegistrarAceite} disabled={!aceiteNome.trim() || busy === 'aceite'}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50">
                {busy === 'aceite' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Registrar Aceite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modais de assinatura/campo */}
      {showSignPad && propostaDoc.contratoPdfUrl && (
        <SignaturePadModal
          projectId={project.id}
          contratoPdfUrl={propostaDoc.contratoPdfUrl}
          assinaturaCampo={propostaDoc.assinaturaCampo}
          signerNome={propostaDoc.aceitoPor || project.clientName}
          onClose={() => setShowSignPad(false)}
          onSigned={handleVirtualSignedSaved}
        />
      )}

      {showCampoEditor && propostaDoc.contratoPdfUrl && (
        <ContratoSignatureFieldEditor
          contratoPdfUrl={propostaDoc.contratoPdfUrl}
          contratoPdfPath={propostaDoc.contratoPdfPath ?? undefined}
          initial={propostaDoc.assinaturaCampo}
          onClose={() => setShowCampoEditor(false)}
          onSave={handleSaveAssinaturaCampo}
        />
      )}
    </div>
  );
};

export default ProjectContrato;

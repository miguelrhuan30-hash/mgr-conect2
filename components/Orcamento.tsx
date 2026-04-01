/**
 * components/Orcamento.tsx — Sprint 47 → Sprint 51
 *
 * Módulo de Orçamento — CRUD de orçamentos com itens, status,
 * integração pipeline (PRE_ORCAMENTO / ORCAMENTO_FINAL).
 * Sprint 51: Upload de PDF + Link público compartilhável para clientes.
 * 3 abas: Em Aberto, Aprovados, Rejeitados.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, Timestamp, getDocs, increment,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, Orcamento, OrcamentoItem, Client, Task,
  WorkflowStatus as WS,
} from '../types';
import {
  FileSpreadsheet, Plus, Loader2, X, Save, Trash2,
  CheckCircle2, XCircle, Send, Eye, Search,
  Clock, AlertCircle, Copy, Link2, Upload, FileText,
  Download, Check, ExternalLink, Share2, Paperclip,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatBRL = (v?: number) =>
  v != null ? `R$ ${v.toFixed(2).replace('.', ',')}` : '—';

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

type TabType = 'abertos' | 'aprovados' | 'rejeitados';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type?: 'success' | 'error' | 'info'; onClose: () => void }> = ({ msg, type = 'success', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-medium ${colors[type]} animate-fade-in-up`}>
      {type === 'success' ? <Check size={16} /> : type === 'error' ? <AlertCircle size={16} /> : <Link2 size={16} />}
      {msg}
      <button onClick={onClose} className="ml-2 text-white/70 hover:text-white"><X size={14} /></button>
    </div>
  );
};

/* ─── PDF Upload Section ──────────────────────────────────────────────────── */
const PDFUploadSection: React.FC<{
  orcamento: Orcamento;
  onUpdateOrcamento: (data: Partial<Orcamento>) => Promise<void>;
}> = ({ orcamento, onUpdateOrcamento }) => {
  const [uploading, setUploading]     = useState(false);
  const [uploadPct, setUploadPct]     = useState(0);
  const [sharing, setSharing]         = useState(false);
  const [toast, setToast]             = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const fileInputRef                  = useRef<HTMLInputElement>(null);

  const publicUrl = `https://mgrrefrigeracao.com.br/orcamentos/${orcamento.id}`;

  // ── Upload PDF ──
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setToast({ msg: 'Apenas arquivos PDF são aceitos.', type: 'error' });
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      setToast({ msg: 'O arquivo deve ter no máximo 30 MB.', type: 'error' });
      return;
    }

    setUploading(true);
    setUploadPct(0);

    try {
      // Remover PDF antigo se existir
      if (orcamento.pdfUrl) {
        try {
          const oldRef = storageRef(storage, `orcamentos/${orcamento.id}/${orcamento.pdfNome}`);
          await deleteObject(oldRef);
        } catch { /* ignore — may not exist */ }
      }

      const fileRef = storageRef(storage, `orcamentos/${orcamento.id}/${file.name}`);
      const uploadTask = uploadBytesResumable(fileRef, file, { contentType: 'application/pdf' });

      uploadTask.on('state_changed',
        (snap) => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (_err) => {
          setUploading(false);
          setToast({ msg: 'Erro ao fazer upload do PDF.', type: 'error' });
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          await onUpdateOrcamento({
            pdfUrl: downloadUrl,
            pdfNome: file.name,
            pdfTamanhoBytes: file.size,
            pdfUploadEm: Timestamp.now(),
          });
          setUploading(false);
          setToast({ msg: 'PDF enviado com sucesso!', type: 'success' });
        }
      );
    } catch {
      setUploading(false);
      setToast({ msg: 'Erro ao fazer upload. Tente novamente.', type: 'error' });
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Ativar link público + copiar ──
  const handleShare = async () => {
    setSharing(true);
    try {
      // Ativa o link público se ainda não estiver ativo
      if (!orcamento.linkPublicoAtivo) {
        await onUpdateOrcamento({ linkPublicoAtivo: true });
      }
      // Copia URL para clipboard
      await navigator.clipboard.writeText(publicUrl);
      setToast({ msg: 'Link copiado! Compartilhe com o cliente.', type: 'info' });
    } catch {
      // Fallback: mostrar a URL
      setToast({ msg: `Link: ${publicUrl}`, type: 'info' });
    } finally {
      setSharing(false);
    }
  };

  // ── Desativar link público ──
  const handleRevokeLink = async () => {
    if (!confirm('Desativar o link público? O cliente não conseguirá mais acessar.')) return;
    await onUpdateOrcamento({ linkPublicoAtivo: false });
    setToast({ msg: 'Link público desativado.', type: 'success' });
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Sem PDF: botão Anexar ── */}
      {!orcamento.pdfUrl && !uploading && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 text-gray-500 rounded-xl text-xs font-medium hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 transition-all w-full justify-center"
        >
          <Paperclip size={13} />
          Anexar PDF do Orçamento
        </button>
      )}

      {/* ── Upload em andamento ── */}
      {uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="flex items-center gap-1.5"><Upload size={12} className="animate-bounce" /> Enviando PDF...</span>
            <span className="font-bold">{uploadPct}%</span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-300"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── PDF existente ── */}
      {orcamento.pdfUrl && !uploading && (
        <div className="bg-gray-50 rounded-xl p-3 space-y-3">
          {/* Info do arquivo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <FileText size={16} className="text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-800 truncate">{orcamento.pdfNome || 'orcamento.pdf'}</p>
              <p className="text-[10px] text-gray-400">
                {formatFileSize(orcamento.pdfTamanhoBytes)}
                {orcamento.pdfUploadEm &&
                  ` · Enviado em ${format((orcamento.pdfUploadEm as any).toDate(), 'dd/MM/yy', { locale: ptBR })}`}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <a
                href={orcamento.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                title="Ver PDF"
              >
                <Eye size={13} />
              </a>
              <a
                href={orcamento.pdfUrl}
                download={orcamento.pdfNome || 'orcamento.pdf'}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                title="Baixar PDF"
              >
                <Download size={13} />
              </a>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-brand-600 hover:border-brand-300 transition-colors"
                title="Substituir PDF"
              >
                <Upload size={13} />
              </button>
            </div>
          </div>

          {/* Linha de compartilhamento */}
          <div className="flex items-center gap-2">
            {/* Botão compartilhar */}
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold transition-colors"
            >
              {sharing
                ? <Loader2 size={12} className="animate-spin" />
                : <Share2 size={12} />}
              {orcamento.linkPublicoAtivo ? 'Copiar Link' : 'Compartilhar por Link'}
            </button>

            {/* Status do link público */}
            {orcamento.linkPublicoAtivo && (
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 text-[10px] text-green-700 bg-green-100 px-2 py-1 rounded-full font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                  Link ativo
                </span>
                {(orcamento.linkPublicoViews ?? 0) > 0 && (
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Eye size={10} />
                    {orcamento.linkPublicoViews}
                  </span>
                )}
                <button
                  onClick={handleRevokeLink}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  title="Desativar link"
                >
                  <XCircle size={13} />
                </button>
              </div>
            )}
          </div>

          {/* URL preview */}
          {orcamento.linkPublicoAtivo && (
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5">
              <Link2 size={11} className="text-brand-600 flex-shrink-0" />
              <span className="text-[10px] text-gray-500 truncate flex-1">{publicUrl}</span>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 hover:text-brand-700 flex-shrink-0"
                title="Abrir link"
              >
                <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

/* ─── Orcamento Form Modal ──────────────────────────────────────────────── */
const OrcamentoFormModal: React.FC<{
  orcamento?: Orcamento | null;
  clients: Client[];
  tasks: Task[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}> = ({ orcamento, clients, tasks, onSave, onClose }) => {
  const [titulo,      setTitulo]      = useState(orcamento?.titulo || '');
  const [descricao,   setDescricao]   = useState(orcamento?.descricao || '');
  const [clientId,    setClientId]    = useState(orcamento?.clientId || '');
  const [clientName,  setClientName]  = useState(orcamento?.clientName || '');
  const [taskId,      setTaskId]      = useState(orcamento?.taskId || '');
  const [taskCode,    setTaskCode]    = useState(orcamento?.taskCode || '');
  const [validoAte,   setValidoAte]   = useState(() => {
    if (orcamento?.validoAte) return new Date((orcamento.validoAte as any).toMillis()).toISOString().slice(0, 10);
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [observacoes, setObservacoes] = useState(orcamento?.observacoes || '');
  const [itens, setItens] = useState<OrcamentoItem[]>(orcamento?.itens || []);
  const [saving, setSaving] = useState(false);

  const addItem = () => setItens(prev => [...prev, {
    id: `item_${Date.now()}`, descricao: '', quantidade: 1, valorUnitario: 0, valorTotal: 0,
  }]);

  const updateItem = (id: string, field: string, value: any) => {
    setItens(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'quantidade' || field === 'valorUnitario') {
        updated.valorTotal = (updated.quantidade || 0) * (updated.valorUnitario || 0);
      }
      return updated;
    }));
  };

  const removeItem = (id: string) => setItens(prev => prev.filter(i => i.id !== id));
  const valorTotal = itens.reduce((s, i) => s + (i.valorTotal || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !clientId) return;
    setSaving(true);
    try {
      await onSave({
        titulo, descricao, clientId, clientName,
        taskId: taskId || undefined, taskCode: taskCode || undefined,
        itens, valorTotal, observacoes,
        validoAte: validoAte ? Timestamp.fromDate(new Date(validoAte)) : undefined,
        status: orcamento?.status || 'rascunho',
      });
      onClose();
    } finally { setSaving(false); }
  };

  const clientTasks = tasks.filter(t =>
    (t as any).clientId === clientId && !(t as any).archived
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '96vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-600" />
            {orcamento ? 'Editar Orçamento' : 'Novo Orçamento'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Título *</label>
            <input required value={titulo} onChange={e => setTitulo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              placeholder="Ex: Orçamento de manutenção preventiva" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">Cliente *</label>
              <select required value={clientId} onChange={e => {
                const c = clients.find(x => x.id === e.target.value);
                setClientId(e.target.value); setClientName(c?.name || '');
                setTaskId(''); setTaskCode('');
              }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Selecione...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">O.S. Vinculada (opcional)</label>
              <select value={taskId} onChange={e => {
                const t = tasks.find(x => x.id === e.target.value);
                setTaskId(e.target.value); setTaskCode(t?.code || '');
              }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm">
                <option value="">Nenhuma</option>
                {clientTasks.map(t => <option key={t.id} value={t.id}>{t.code || t.id.slice(0, 8)} — {t.title}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Descrição</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Validade</label>
            <input type="date" value={validoAte} onChange={e => setValidoAte(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </div>

          {/* Items */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-600 uppercase tracking-wide">Itens do Orçamento</label>
              <button type="button" onClick={addItem}
                className="flex items-center gap-1 px-2 py-1 bg-brand-50 text-brand-700 rounded-lg text-xs font-bold hover:bg-brand-100">
                <Plus size={12} /> Adicionar Item
              </button>
            </div>
            {itens.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Adicione itens ao orçamento.</p>
            )}
            {itens.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl p-2">
                <input value={item.descricao} onChange={e => updateItem(item.id, 'descricao', e.target.value)}
                  placeholder={`Item ${idx + 1}`}
                  className="col-span-5 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                <input type="number" min={1} step={1} value={item.quantidade}
                  onChange={e => updateItem(item.id, 'quantidade', Number(e.target.value))}
                  className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-center" />
                <input type="number" min={0} step={0.01} value={item.valorUnitario}
                  onChange={e => updateItem(item.id, 'valorUnitario', Number(e.target.value))}
                  placeholder="R$"
                  className="col-span-2 border border-gray-200 rounded-lg px-2 py-1.5 text-xs" />
                <span className="col-span-2 text-xs font-bold text-gray-700 text-right">{formatBRL(item.valorTotal)}</span>
                <button type="button" onClick={() => removeItem(item.id)}
                  className="col-span-1 text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
              </div>
            ))}
            {itens.length > 0 && (
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <span className="text-sm font-extrabold text-gray-900">Total: {formatBRL(valorTotal)}</span>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Observações</label>
            <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
          </div>
        </form>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end bg-white flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => document.querySelector<HTMLFormElement>('form')?.requestSubmit()} disabled={saving || !titulo.trim() || !clientId}
            className="px-5 py-2 rounded-xl bg-brand-600 text-white text-sm font-bold hover:bg-brand-700 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {orcamento ? 'Salvar' : 'Criar Orçamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Main Orcamento ────────────────────────────────────────────────────── */
const OrcamentoModule: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [clients,    setClients]    = useState<Client[]>([]);
  const [tasks,      setTasks]      = useState<Task[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<TabType>('abertos');
  const [search,     setSearch]     = useState('');
  const [showForm,   setShowForm]   = useState(false);
  const [editOrc,    setEditOrc]    = useState<Orcamento | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, CollectionName.OS_ORCAMENTOS), orderBy('criadoEm', 'desc')),
      snap => { setOrcamentos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Orcamento))); setLoading(false); },
      () => setLoading(false)
    );
    getDocs(collection(db, CollectionName.CLIENTS))
      .then(snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))))
      .catch(() => {});
    const unsub2 = onSnapshot(
      query(collection(db, CollectionName.TASKS), orderBy('createdAt', 'desc')),
      snap => setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Task)))
    );
    return () => { unsub(); unsub2(); };
  }, []);

  const filtered = orcamentos.filter(o => {
    const matchSearch = o.titulo.toLowerCase().includes(search.toLowerCase()) ||
      o.clientName?.toLowerCase().includes(search.toLowerCase());
    if (tab === 'abertos')    return matchSearch && (o.status === 'rascunho' || o.status === 'enviado');
    if (tab === 'aprovados')  return matchSearch && o.status === 'aprovado';
    if (tab === 'rejeitados') return matchSearch && o.status === 'rejeitado';
    return matchSearch;
  });

  const handleSave = async (data: any) => {
    if (!currentUser) return;
    if (editOrc) {
      await updateDoc(doc(db, CollectionName.OS_ORCAMENTOS, editOrc.id), {
        ...data, atualizadoEm: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, CollectionName.OS_ORCAMENTOS), {
        ...data,
        criadoPor: currentUser.uid,
        criadoPorNome: userProfile?.displayName || '',
        criadoEm: serverTimestamp(),
        linkPublicoAtivo: false,
        linkPublicoViews: 0,
      });
    }
    setEditOrc(null); setShowForm(false);
  };

  // ── Atualizar campos do orçamento (usado pelo PDFUploadSection) ──
  const handleUpdateOrcamento = async (orcId: string, data: Partial<Orcamento>) => {
    await updateDoc(doc(db, CollectionName.OS_ORCAMENTOS, orcId), {
      ...data,
      atualizadoEm: serverTimestamp(),
    });
  };

  const enviar = async (orc: Orcamento) => {
    await updateDoc(doc(db, CollectionName.OS_ORCAMENTOS, orc.id), {
      status: 'enviado', atualizadoEm: serverTimestamp(),
    });
  };

  const aprovar = async (orc: Orcamento) => {
    if (!currentUser) return;
    await updateDoc(doc(db, CollectionName.OS_ORCAMENTOS, orc.id), {
      status: 'aprovado',
      aprovadoPor: currentUser.uid,
      aprovadoPorNome: userProfile?.displayName || '',
      aprovadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
    if (orc.taskId) {
      const task = tasks.find(t => t.id === orc.taskId);
      if (task && (task.workflowStatus === WS.PRE_ORCAMENTO || task.workflowStatus === WS.ORCAMENTO_FINAL)) {
        await updateDoc(doc(db, CollectionName.TASKS, orc.taskId), {
          workflowStatus: WS.AGUARDANDO_APROVACAO,
          orcamentoId: orc.id,
          updatedAt: serverTimestamp(),
        });
      }
    }
  };

  const rejeitar = async (orc: Orcamento) => {
    const motivo = window.prompt('Motivo da rejeição:');
    if (!motivo) return;
    if (!currentUser) return;
    await updateDoc(doc(db, CollectionName.OS_ORCAMENTOS, orc.id), {
      status: 'rejeitado',
      rejeitadoPor: currentUser.uid,
      rejeitadoMotivo: motivo,
      rejeitadoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp(),
    });
  };

  const tabs: { value: TabType; label: string; icon: React.ReactNode }[] = [
    { value: 'abertos',    label: 'Em Aberto',  icon: <Clock size={13} /> },
    { value: 'aprovados',  label: 'Aprovados',  icon: <CheckCircle2 size={13} /> },
    { value: 'rejeitados', label: 'Rejeitados', icon: <XCircle size={13} /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-brand-600" /> Orçamentos
          </h1>
          <p className="text-sm text-gray-500">Crie, gerencie e compartilhe orçamentos com clientes</p>
        </div>
        <button onClick={() => { setEditOrc(null); setShowForm(true); }}
          className="flex items-center px-4 py-2 bg-brand-600 text-white rounded-xl hover:bg-brand-700 text-sm font-bold shadow-sm">
          <Plus className="w-4 h-4 mr-1.5" /> Novo Orçamento
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex p-1 gap-0.5 bg-gray-100/80 rounded-xl overflow-x-auto flex-shrink-0">
          {tabs.map(t => (
            <button key={t.value} onClick={() => setTab(t.value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap flex items-center gap-1
              ${tab === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.icon} {t.label}
              <span className="text-[9px] bg-gray-200 px-1.5 rounded-full font-extrabold">
                {orcamentos.filter(o => {
                  if (t.value === 'abertos') return o.status === 'rascunho' || o.status === 'enviado';
                  if (t.value === 'aprovados') return o.status === 'aprovado';
                  return o.status === 'rejeitado';
                }).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input type="text" placeholder="Buscar orçamento..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white" />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          Nenhum orçamento {tab === 'abertos' ? 'em aberto' : tab === 'aprovados' ? 'aprovado' : 'rejeitado'}.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(orc => {
            const isRascunho = orc.status === 'rascunho';
            const isEnviado  = orc.status === 'enviado';
            return (
              <div key={orc.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-sm transition-all">
                {/* ── Header do card ── */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-gray-900 truncate">{orc.titulo}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{orc.clientName}</p>
                    {orc.taskCode && <p className="text-[10px] text-gray-400 mt-0.5">O.S.: {orc.taskCode}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-lg font-extrabold text-gray-900">{formatBRL(orc.valorTotal)}</span>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                      orc.status === 'rascunho' ? 'bg-gray-100 text-gray-600 border-gray-200' :
                      orc.status === 'enviado'  ? 'bg-blue-100 text-blue-700 border-blue-200' :
                      orc.status === 'aprovado' ? 'bg-green-100 text-green-700 border-green-200' :
                                                  'bg-red-100 text-red-700 border-red-200'
                    }`}>
                      {orc.status === 'rascunho' ? 'Rascunho' : orc.status === 'enviado' ? 'Enviado' :
                       orc.status === 'aprovado' ? 'Aprovado' : 'Rejeitado'}
                    </span>
                  </div>
                </div>

                {orc.itens && orc.itens.length > 0 && (
                  <div className="text-[10px] text-gray-400 mb-3">
                    {orc.itens.length} {orc.itens.length === 1 ? 'item' : 'itens'}
                    {orc.validoAte && ` · Válido até ${format((orc.validoAte as any).toDate(), 'dd/MM/yyyy', { locale: ptBR })}`}
                  </div>
                )}

                {orc.rejeitadoMotivo && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3 text-xs text-red-700">
                    <strong>Motivo:</strong> {orc.rejeitadoMotivo}
                  </div>
                )}

                {/* ── Ações de status ── */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {isRascunho && (
                    <>
                      <button onClick={() => { setEditOrc(orc); setShowForm(true); }}
                        className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-50">Editar</button>
                      <button onClick={() => enviar(orc)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1">
                        <Send size={11} /> Enviar
                      </button>
                    </>
                  )}
                  {isEnviado && (
                    <>
                      <button onClick={() => aprovar(orc)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 flex items-center gap-1">
                        <CheckCircle2 size={11} /> Aprovar
                      </button>
                      <button onClick={() => rejeitar(orc)}
                        className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-600 flex items-center gap-1">
                        <XCircle size={11} /> Rejeitar
                      </button>
                    </>
                  )}
                </div>

                {/* ── Seção de PDF + Link Compartilhável ── */}
                <PDFUploadSection
                  orcamento={orc}
                  onUpdateOrcamento={(data) => handleUpdateOrcamento(orc.id, data)}
                />
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <OrcamentoFormModal orcamento={editOrc} clients={clients} tasks={tasks}
          onSave={handleSave} onClose={() => { setShowForm(false); setEditOrc(null); }} />
      )}
    </div>
  );
};

export default OrcamentoModule;

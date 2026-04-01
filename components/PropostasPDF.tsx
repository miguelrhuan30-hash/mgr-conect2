/**
 * components/PropostasPDF.tsx — Sprint 51
 *
 * Módulo de Propostas em PDF — Upload de arquivos PDF de orçamentos/propostas
 * e geração de link público exclusivo para envio a clientes.
 *
 * Link compartilhável: www.mgrrefrigeracao.com.br/orcamentos/{id}
 * Diferente do módulo de Orçamentos (com itens/valores), este módulo
 * foca em documentos PDF prontos gerados externamente.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc, updateDoc,
  doc, serverTimestamp, Timestamp, getDocs, deleteDoc, increment,
} from 'firebase/firestore';
import {
  ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CollectionName, Client } from '../types';
import {
  FileText, Upload, Plus, Loader2, X, Search, Trash2,
  Share2, Link2, Eye, ExternalLink, Download, Check,
  AlertCircle, Clock, CheckCircle2, XCircle, ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Tipos locais ─────────────────────────────────────────────────────────────
interface PropostaPDF {
  id: string;
  titulo: string;
  clientId: string;
  clientName: string;
  descricao?: string;
  pdfUrl: string;
  pdfNome: string;
  pdfTamanhoBytes?: number;
  pdfUploadEm: Timestamp;
  linkPublicoAtivo: boolean;
  linkPublicoViews: number;
  status: 'ativo' | 'arquivado';
  criadoPor: string;
  criadoPorNome: string;
  criadoEm: Timestamp;
  atualizadoEm?: Timestamp;
}

const COLLECTION = 'os_orcamentos'; // reutiliza a mesma coleção com campo tipo='pdf'

const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast: React.FC<{ msg: string; type?: 'success' | 'error' | 'info'; onClose: () => void }> = ({ msg, type = 'success', onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const colors = { success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600' };
  const icons  = { success: <Check size={15} />, error: <AlertCircle size={15} />, info: <Link2 size={15} /> };
  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-medium ${colors[type]} transition-all`}>
      {icons[type]} {msg}
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
};

// ─── Modal: Nova Proposta ─────────────────────────────────────────────────────
const NovaProposta: React.FC<{
  clients: Client[];
  onSave: (data: { titulo: string; clientId: string; clientName: string; descricao: string; file: File }) => Promise<void>;
  onClose: () => void;
}> = ({ clients, onSave, onClose }) => {
  const [titulo,    setTitulo]    = useState('');
  const [clientId,  setClientId]  = useState('');
  const [clientName,setClientName]= useState('');
  const [descricao, setDescricao] = useState('');
  const [file,      setFile]      = useState<File | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.type !== 'application/pdf') { alert('Apenas arquivos PDF.'); return; }
    if (f.size > 30 * 1024 * 1024)   { alert('Máximo 30 MB.'); return; }
    setFile(f);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !clientId || !file) return;
    setSaving(true);
    try {
      await onSave({ titulo, clientId, clientName, descricao, file });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden" style={{ maxHeight: '96vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b bg-gradient-to-r from-orange-50 to-amber-50 flex-shrink-0">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <FileText size={14} className="text-white" />
            </div>
            Nova Proposta PDF
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Título */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Título da Proposta *</label>
            <input required value={titulo} onChange={e => setTitulo(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none"
              placeholder="Ex: Proposta de Manutenção Preventiva — Janeiro" />
          </div>

          {/* Cliente */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Cliente *</label>
            <select required value={clientId} onChange={e => {
              const c = clients.find(x => x.id === e.target.value);
              setClientId(e.target.value); setClientName(c?.name || '');
            }} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-orange-300 outline-none">
              <option value="">Selecione o cliente...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">Observações (opcional)</label>
            <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-orange-300 outline-none"
              placeholder="Ex: Proposta válida por 30 dias, inclui mão de obra e peças." />
          </div>

          {/* Upload PDF */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-2">Arquivo PDF *</label>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleFile} />

            {!file ? (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full border-2 border-dashed border-orange-200 rounded-2xl p-8 flex flex-col items-center gap-3 hover:border-orange-400 hover:bg-orange-50 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 group-hover:bg-orange-200 flex items-center justify-center transition-colors">
                  <Upload size={22} className="text-orange-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-700">Clique para selecionar o PDF</p>
                  <p className="text-xs text-gray-400 mt-0.5">Máximo 30 MB</p>
                </div>
              </button>
            ) : (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-800 truncate">{file.name}</p>
                  <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0"><X size={16} /></button>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t flex gap-2 justify-end bg-gray-50 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button
            onClick={() => document.querySelector<HTMLFormElement>('.proposta-form')?.requestSubmit()}
            disabled={saving || !titulo.trim() || !clientId || !file}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
            {saving ? `Enviando... ${uploadPct}%` : 'Fazer Upload e Criar'}
          </button>
        </div>
      </div>
      {/* tricky: use a hidden form with class to call requestSubmit */}
      <form className="proposta-form hidden" onSubmit={e => {
        e.preventDefault();
        if (!titulo || !clientId || !file) return;
        setSaving(true);
        onSave({ titulo, clientId, clientName, descricao, file }).then(onClose).finally(() => setSaving(false));
      }} />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const PropostasPDF: React.FC = () => {
  const { currentUser, userProfile } = useAuth();
  const [propostas, setPropostas] = useState<PropostaPDF[]>([]);
  const [clients,   setClients]   = useState<Client[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [search,    setSearch]    = useState('');
  const [showForm,  setShowForm]  = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);

  // Carrega propostas PDF (distingue do orçamento tradicional pelo campo tipo)
  useEffect(() => {
    const q = query(
      collection(db, 'propostas_pdf'),
      orderBy('criadoEm', 'desc')
    );
    const unsub = onSnapshot(q, snap => {
      setPropostas(snap.docs.map(d => ({ id: d.id, ...d.data() } as PropostaPDF)));
      setLoading(false);
    }, () => setLoading(false));

    getDocs(collection(db, CollectionName.CLIENTS))
      .then(snap => setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as Client))))
      .catch(() => {});

    return () => unsub();
  }, []);

  const filtered = propostas.filter(p =>
    p.titulo.toLowerCase().includes(search.toLowerCase()) ||
    p.clientName?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Upload + criar proposta ──
  const handleCreate = async (data: { titulo: string; clientId: string; clientName: string; descricao: string; file: File }) => {
    if (!currentUser) return;
    setUploading(true);
    setUploadPct(0);

    try {
      // 1. Criar doc no Firestore primeiro para obter o ID
      const docRef = await addDoc(collection(db, 'propostas_pdf'), {
        titulo: data.titulo,
        clientId: data.clientId,
        clientName: data.clientName,
        descricao: data.descricao || '',
        pdfUrl: '',
        pdfNome: data.file.name,
        pdfTamanhoBytes: data.file.size,
        pdfUploadEm: serverTimestamp(),
        linkPublicoAtivo: false,
        linkPublicoViews: 0,
        status: 'ativo',
        criadoPor: currentUser.uid,
        criadoPorNome: userProfile?.displayName || '',
        criadoEm: serverTimestamp(),
      });

      // 2. Upload do PDF com o ID do doc no caminho
      const fileRef = storageRef(storage, `orcamentos/${docRef.id}/${data.file.name}`);
      const task = uploadBytesResumable(fileRef, data.file, { contentType: 'application/pdf' });

      await new Promise<void>((resolve, reject) => {
        task.on('state_changed',
          snap => setUploadPct(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            await updateDoc(docRef, { pdfUrl: url });
            resolve();
          }
        );
      });

      setToast({ msg: 'Proposta criada com sucesso!', type: 'success' });
    } catch {
      setToast({ msg: 'Erro ao criar proposta. Tente novamente.', type: 'error' });
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  };

  // ── Ativar link público + copiar ──
  const handleShare = async (p: PropostaPDF) => {
    const url = `https://mgrrefrigeracao.com.br/orcamentos/${p.id}`;
    if (!p.linkPublicoAtivo) {
      await updateDoc(doc(db, 'propostas_pdf', p.id), {
        linkPublicoAtivo: true,
        atualizadoEm: serverTimestamp(),
      });
    }
    try {
      await navigator.clipboard.writeText(url);
      setToast({ msg: 'Link copiado! Envie ao cliente.', type: 'info' });
    } catch {
      setToast({ msg: `Link: ${url}`, type: 'info' });
    }
  };

  // ── Revogar link ──
  const handleRevoke = async (p: PropostaPDF) => {
    if (!confirm('Desativar o link? O cliente não poderá mais acessar.')) return;
    await updateDoc(doc(db, 'propostas_pdf', p.id), {
      linkPublicoAtivo: false,
      atualizadoEm: serverTimestamp(),
    });
    setToast({ msg: 'Link desativado.', type: 'success' });
  };

  // ── Arquivar ──
  const handleArchive = async (p: PropostaPDF) => {
    if (!confirm(`Arquivar "${p.titulo}"?`)) return;
    await updateDoc(doc(db, 'propostas_pdf', p.id), {
      status: 'arquivado',
      linkPublicoAtivo: false,
      atualizadoEm: serverTimestamp(),
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Propostas PDF</h1>
              <p className="text-sm text-gray-500">Envie propostas em PDF diretamente para seus clientes via link</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={uploading}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold text-sm shadow-md transition-all disabled:opacity-50"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          {uploading ? `Enviando ${uploadPct}%` : 'Nova Proposta PDF'}
        </button>
      </div>

      {/* ── Upload progress bar ── */}
      {uploading && (
        <div className="bg-white rounded-2xl border border-orange-200 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-orange-700 font-medium">
              <Upload size={14} className="animate-bounce" /> Fazendo upload do PDF...
            </span>
            <span className="font-bold text-orange-700">{uploadPct}%</span>
          </div>
          <div className="w-full h-2.5 bg-orange-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-300"
              style={{ width: `${uploadPct}%` }} />
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="bg-white p-3 rounded-2xl border border-gray-200 shadow-sm">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Buscar proposta ou cliente..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:ring-2 focus:ring-orange-200 outline-none transition-all" />
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border-2 border-dashed border-gray-200 p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-orange-300" />
          </div>
          <p className="text-gray-500 font-medium">Nenhuma proposta PDF cadastrada</p>
          <p className="text-gray-400 text-sm mt-1">Clique em "Nova Proposta PDF" para começar</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.filter(p => p.status !== 'arquivado').map(p => {
            const publicUrl = `https://mgrrefrigeracao.com.br/orcamentos/${p.id}`;
            return (
              <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Ícone PDF */}
                    <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
                      <FileText size={22} className="text-red-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-900 truncate text-base">{p.titulo}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{p.clientName}</p>
                          {p.descricao && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{p.descricao}</p>}
                        </div>
                        {/* Link status badge */}
                        {p.linkPublicoAtivo && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex-shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                            Link ativo
                          </span>
                        )}
                      </div>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-400 flex-wrap">
                        <span>{p.pdfNome}</span>
                        {p.pdfTamanhoBytes && <span>{formatFileSize(p.pdfTamanhoBytes)}</span>}
                        {p.pdfUploadEm && (
                          <span>
                            {format((p.pdfUploadEm as any).toDate?.() ?? new Date(), 'dd/MM/yyyy', { locale: ptBR })}
                          </span>
                        )}
                        {p.linkPublicoAtivo && (p.linkPublicoViews ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye size={10} /> {p.linkPublicoViews} visualiz.
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* URL preview quando ativo */}
                  {p.linkPublicoAtivo && (
                    <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2">
                      <Link2 size={13} className="text-emerald-600 flex-shrink-0" />
                      <span className="text-xs text-gray-600 truncate flex-1 font-mono">{publicUrl}</span>
                      <a href={publicUrl} target="_blank" rel="noopener noreferrer"
                        className="text-emerald-600 hover:text-emerald-700 flex-shrink-0" title="Abrir link">
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex items-center gap-2 mt-4 flex-wrap">
                    {/* Ver PDF */}
                    {p.pdfUrl && (
                      <a href={p.pdfUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors">
                        <Eye size={12} /> Ver PDF
                      </a>
                    )}

                    {/* Baixar */}
                    {p.pdfUrl && (
                      <a href={p.pdfUrl} download={p.pdfNome}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-50 transition-colors">
                        <Download size={12} /> Baixar
                      </a>
                    )}

                    {/* Compartilhar */}
                    <button onClick={() => handleShare(p)}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-colors">
                      <Share2 size={12} />
                      {p.linkPublicoAtivo ? 'Copiar Link' : 'Compartilhar por Link'}
                    </button>

                    {/* Revogar link */}
                    {p.linkPublicoAtivo && (
                      <button onClick={() => handleRevoke(p)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors">
                        <XCircle size={12} /> Desativar Link
                      </button>
                    )}

                    {/* Arquivar */}
                    <button onClick={() => handleArchive(p)}
                      className="ml-auto flex items-center gap-1 px-2 py-1.5 text-gray-300 hover:text-red-400 transition-colors rounded-lg"
                      title="Arquivar proposta">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Arquivadas */}
          {propostas.some(p => p.status === 'arquivado') && (
            <details className="mt-2">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 font-medium py-2">
                Ver propostas arquivadas ({propostas.filter(p => p.status === 'arquivado').length})
              </summary>
              <div className="mt-2 space-y-2 opacity-60">
                {propostas.filter(p => p.status === 'arquivado' && p.titulo.toLowerCase().includes(search.toLowerCase())).map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <FileText size={16} className="text-gray-400 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-600 font-medium truncate">{p.titulo}</p>
                      <p className="text-xs text-gray-400">{p.clientName}</p>
                    </div>
                    <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold">Arquivado</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Modal nova proposta */}
      {showForm && (
        <NovaProposta
          clients={clients}
          onSave={handleCreate}
          onClose={() => setShowForm(false)}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default PropostasPDF;

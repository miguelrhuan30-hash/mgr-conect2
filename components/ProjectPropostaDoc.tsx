/**
 * components/ProjectPropostaDoc.tsx
 *
 * Editor inline de documento de proposta com banco de cláusulas.
 * Usado dentro do Flow de Atendimento (fase proposta_enviada).
 *
 * Funcionalidades:
 *  A — Lista e edição inline de cláusulas
 *  B — Adicionar cláusulas (avulso ou importando do banco de modelos)
 *  C — Publicar documento (gera slug, salva no Firestore)
 *  D — Status de aceite
 *  E — Gerenciar banco de modelos (add/edit/delete + importar padrões)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  updateDoc, deleteDoc, doc, getDocs, serverTimestamp,
  Timestamp, where,
} from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import {
  CollectionName, ProjectV2, PropostaDocumento, PropostaClausula, ClausulaModelo,
} from '../types';
import {
  Save, Check, Loader2, Plus, Trash2, ChevronUp, ChevronDown,
  Globe, Copy, ExternalLink, Book, ChevronRight, X, AlertCircle,
  Edit2, GripVertical, Upload, FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  project: ProjectV2;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const fmtDate = (ts: Timestamp | undefined): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date((ts as any).seconds * 1000);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
};

// ─── generateSlug — verifica unicidade em PROJECTS_V2.propostaDocumento.slug ──
async function generateSlug(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => chars[b % chars.length]).join('');
    const slug = `mgr-${rand}`;
    const q = query(
      collection(db, CollectionName.PROJECTS_V2),
      where('propostaDocumento.slug', '==', slug),
    );
    const snap = await getDocs(q);
    if (snap.empty) return slug;
  }
  return `mgr-${Date.now().toString(36)}`;
}

// ─── Modelos padrão ──────────────────────────────────────────────────────────
const MODELOS_PADRAO: Omit<ClausulaModelo, 'id' | 'criadoEm' | 'criadoPor' | 'criadoPorNome' | 'ativo'>[] = [
  {
    titulo: 'Do Objeto',
    corpo: 'O presente instrumento tem como objeto a execução do projeto denominado [PROJETO], conforme especificações técnicas apresentadas na proposta comercial aprovada.',
    categoria: 'Geral',
    ordem: 1,
  },
  {
    titulo: 'Do Prazo',
    corpo: 'O prazo de execução será definido em cronograma aprovado entre as partes, a contar da data de assinatura e recebimento do sinal.',
    categoria: 'Execução',
    ordem: 2,
  },
  {
    titulo: 'Do Valor e Forma de Pagamento',
    corpo: 'O valor total dos serviços será pago conforme cronograma de parcelas estabelecido na proposta aprovada.',
    categoria: 'Pagamento',
    ordem: 3,
  },
  {
    titulo: 'Das Obrigações do Contratante',
    corpo: 'O Contratante obriga-se a fornecer acesso às instalações, efetuar os pagamentos nas datas acordadas e designar responsável para acompanhamento da obra.',
    categoria: 'Obrigações',
    ordem: 4,
  },
  {
    titulo: 'Das Obrigações da Contratada',
    corpo: 'A Contratada obriga-se a executar os serviços com qualidade, dentro das especificações técnicas, respeitando as normas de segurança (NR-10, NR-18) e emitindo relatório fotográfico de conclusão.',
    categoria: 'Obrigações',
    ordem: 5,
  },
  {
    titulo: 'Da Garantia',
    corpo: 'Os equipamentos instalados possuem garantia conforme especificação do fabricante. Os serviços de instalação são garantidos por 6 (seis) meses a partir da entrega.',
    categoria: 'Garantia',
    ordem: 6,
  },
  {
    titulo: 'Do Foro',
    corpo: 'As partes elegem o foro da comarca de Indaiatuba/SP para dirimir quaisquer controvérsias oriundas do presente instrumento.',
    categoria: 'Geral',
    ordem: 7,
  },
];

// ─── Toast interno ────────────────────────────────────────────────────────────
interface ToastMsg { id: number; msg: string; type: 'success' | 'error' | 'info' }

const ToastItem: React.FC<{ toast: ToastMsg; onClose: (id: number) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), 3500);
    return () => clearTimeout(t);
  }, [toast.id, onClose]);
  const bg = toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600';
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium shadow-lg ${bg}`}>
      {toast.type === 'success' ? <Check size={15} /> : toast.type === 'error' ? <AlertCircle size={15} /> : <Globe size={15} />}
      <span>{toast.msg}</span>
      <button onClick={() => onClose(toast.id)} className="ml-2 opacity-70 hover:opacity-100"><X size={13} /></button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectPropostaDoc: React.FC<Props> = ({ project }) => {
  const { currentUser } = useAuth();

  // ── Estado local de cláusulas ─────────────────────────────────────────────
  const [clausulas, setClausulas] = useState<PropostaClausula[]>([]);
  const [titulo, setTitulo] = useState('');

  // ── Sync do estado local com project.propostaDocumento ────────────────────
  useEffect(() => {
    const doc_ = project.propostaDocumento;
    if (doc_) {
      setClausulas([...(doc_.clausulas || [])].sort((a, b) => a.ordem - b.ordem));
      setTitulo(doc_.titulo || '');
    } else {
      setClausulas([]);
      setTitulo('');
    }
  }, [project.propostaDocumento]);

  // ── Estado de salvamento ─────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Painel "Importar do Banco de Modelos" ────────────────────────────────
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [modelosDb, setModelosDb] = useState<ClausulaModelo[]>([]);
  const [selectedModelos, setSelectedModelos] = useState<Set<string>>(new Set());

  // ── Painel "Gerenciar Banco de Modelos" ──────────────────────────────────
  const [showGerenciar, setShowGerenciar] = useState(false);
  const [importandoPadrao, setImportandoPadrao] = useState(false);

  // ── Edição de modelo ─────────────────────────────────────────────────────
  const [editandoModelo, setEditandoModelo] = useState<Partial<ClausulaModelo> | null>(null);
  const [savingModelo, setSavingModelo] = useState(false);

  // ── Upload Contrato PDF ──────────────────────────────────────────────────
  const [uploadProgressContrato, setUploadProgressContrato] = useState<number | null>(null);
  const [uploadErrorContrato, setUploadErrorContrato] = useState('');
  const fileInputContratoRef = useRef<HTMLInputElement>(null);

  // ── Toasts ───────────────────────────────────────────────────────────────
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastCounter = useRef(0);
  const addToast = useCallback((msg: string, type: ToastMsg['type'] = 'success') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, msg, type }]);
  }, []);
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Carregar banco de modelos ─────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, CollectionName.CLAUSULAS_MODELOS),
      orderBy('categoria'),
      orderBy('ordem'),
    );
    const unsub = onSnapshot(q, snap => {
      setModelosDb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ClausulaModelo)));
    });
    return unsub;
  }, []);

  // ── Referência ao doc Firestore do projeto ────────────────────────────────
  const projectRef = doc(db, CollectionName.PROJECTS_V2, project.id);

  // ─────────────────────────────────────────────────────────────────────────
  // A — Edição inline de cláusulas
  // ─────────────────────────────────────────────────────────────────────────
  const updateClausula = (id: string, field: 'titulo' | 'corpo', value: string) => {
    setClausulas(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const moveClausula = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= clausulas.length) return;
    setClausulas(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((c, i) => ({ ...c, ordem: i }));
    });
  };

  const removeClausula = (id: string) => {
    setClausulas(prev => prev.filter(c => c.id !== id).map((c, i) => ({ ...c, ordem: i })));
  };

  const addClausulaVazia = () => {
    const nova: PropostaClausula = {
      id: uid(),
      titulo: `Cláusula ${clausulas.length + 1}`,
      corpo: '',
      ordem: clausulas.length,
    };
    setClausulas(prev => [...prev, nova]);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Salvar documento no Firestore
  // ─────────────────────────────────────────────────────────────────────────
  const handleSalvar = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const existing = project.propostaDocumento;
      const normalized = clausulas.map((c, i) => ({ ...c, ordem: i }));
      const updated: PropostaDocumento = {
        slug: existing?.slug || '',
        titulo,
        clausulas: normalized,
        status: existing?.status || 'rascunho',
        publicadoEm: existing?.publicadoEm,
        aceitoEm: existing?.aceitoEm,
        aceitoPor: existing?.aceitoPor,
        aceitoPorEmail: existing?.aceitoPorEmail,
        mensagemProxPassos: existing?.mensagemProxPassos,
        contratoPdfUrl: existing?.contratoPdfUrl,
        contratoPdfPath: existing?.contratoPdfPath,
      };
      await updateDoc(projectRef, { propostaDocumento: updated });
      addToast('Documento salvo com sucesso!');
    } catch (err) {
      console.error(err);
      addToast('Erro ao salvar documento.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // B — Importar do banco de modelos
  // ─────────────────────────────────────────────────────────────────────────
  const handleImportarSelecionados = () => {
    const toAdd = modelosDb
      .filter(m => selectedModelos.has(m.id))
      .map((m, i) => ({
        id: uid(),
        titulo: m.titulo,
        corpo: m.corpo,
        ordem: clausulas.length + i,
        modeloId: m.id,
      } as PropostaClausula));
    setClausulas(prev => [...prev, ...toAdd]);
    setSelectedModelos(new Set());
    setShowImportPanel(false);
    addToast(`${toAdd.length} cláusula(s) importada(s).`);
  };

  const toggleModelo = (id: string) => {
    setSelectedModelos(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // Agrupa modelos por categoria
  const modelosPorCategoria = modelosDb.reduce<Record<string, ClausulaModelo[]>>((acc, m) => {
    const cat = m.categoria || 'Geral';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(m);
    return acc;
  }, {});

  // ─────────────────────────────────────────────────────────────────────────
  // C — Publicar documento
  // ─────────────────────────────────────────────────────────────────────────
  const handlePublicar = async () => {
    if (publishing || clausulas.length === 0) return;
    setPublishing(true);
    try {
      const existing = project.propostaDocumento;
      const normalized = clausulas.map((c, i) => ({ ...c, ordem: i }));
      const slug = existing?.slug || (await generateSlug());
      const updated: PropostaDocumento = {
        slug,
        titulo,
        clausulas: normalized,
        status: existing?.status === 'aceito' ? 'aceito' : 'publicado',
        publicadoEm: existing?.publicadoEm || Timestamp.now(),
        aceitoEm: existing?.aceitoEm,
        aceitoPor: existing?.aceitoPor,
        aceitoPorEmail: existing?.aceitoPorEmail,
        mensagemProxPassos: existing?.mensagemProxPassos,
        contratoPdfUrl: existing?.contratoPdfUrl,
        contratoPdfPath: existing?.contratoPdfPath,
      };
      await updateDoc(projectRef, { propostaDocumento: updated });
      addToast('Documento publicado! Link gerado.', 'info');
    } catch (err) {
      console.error(err);
      addToast('Erro ao publicar documento.', 'error');
    } finally {
      setPublishing(false);
    }
  };

  const propostaLink = project.propostaDocumento?.slug
    ? `${window.location.origin}/#/proposta/${project.propostaDocumento.slug}`
    : '';

  const handleCopiarLink = async () => {
    if (!propostaLink) return;
    try {
      await navigator.clipboard.writeText(propostaLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      addToast('Link copiado!');
    } catch {
      addToast('Não foi possível copiar.', 'error');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // E — Banco de Modelos: add/edit/delete/importar padrão
  // ─────────────────────────────────────────────────────────────────────────
  const handleSalvarModelo = async () => {
    if (!editandoModelo || savingModelo) return;
    const { titulo: mTitulo, corpo: mCorpo, categoria: mCat, ordem: mOrdem } = editandoModelo;
    if (!mTitulo?.trim() || !mCorpo?.trim()) {
      addToast('Título e corpo são obrigatórios.', 'error');
      return;
    }
    setSavingModelo(true);
    try {
      if (editandoModelo.id) {
        // update
        const ref = doc(db, CollectionName.CLAUSULAS_MODELOS, editandoModelo.id);
        await updateDoc(ref, {
          titulo: mTitulo.trim(),
          corpo: mCorpo.trim(),
          categoria: mCat || 'Geral',
          ordem: mOrdem || 0,
        });
        addToast('Modelo atualizado!');
      } else {
        // create
        await addDoc(collection(db, CollectionName.CLAUSULAS_MODELOS), {
          titulo: mTitulo.trim(),
          corpo: mCorpo.trim(),
          categoria: mCat || 'Geral',
          ordem: mOrdem || modelosDb.length + 1,
          ativo: true,
          criadoEm: serverTimestamp(),
          criadoPor: currentUser?.uid || '',
          criadoPorNome: currentUser?.displayName || '',
        });
        addToast('Modelo criado!');
      }
      setEditandoModelo(null);
    } catch (err) {
      console.error(err);
      addToast('Erro ao salvar modelo.', 'error');
    } finally {
      setSavingModelo(false);
    }
  };

  const handleDeleteModelo = async (id: string) => {
    if (!window.confirm('Remover este modelo do banco?')) return;
    try {
      await deleteDoc(doc(db, CollectionName.CLAUSULAS_MODELOS, id));
      addToast('Modelo removido.');
    } catch {
      addToast('Erro ao remover modelo.', 'error');
    }
  };

  const handleImportarPadrao = async () => {
    if (modelosDb.length > 0) {
      addToast('O banco já possui modelos. Limpe-o antes de importar os padrões.', 'error');
      return;
    }
    setImportandoPadrao(true);
    try {
      for (const m of MODELOS_PADRAO) {
        await addDoc(collection(db, CollectionName.CLAUSULAS_MODELOS), {
          ...m,
          ativo: true,
          criadoEm: serverTimestamp(),
          criadoPor: currentUser?.uid || '',
          criadoPorNome: currentUser?.displayName || '',
        });
      }
      addToast(`${MODELOS_PADRAO.length} modelos padrão importados!`);
    } catch (err) {
      console.error(err);
      addToast('Erro ao importar modelos padrão.', 'error');
    } finally {
      setImportandoPadrao(false);
    }
  };

  // ── Upload Contrato PDF ───────────────────────────────────────────────────
  const handleUploadContrato = (file: File) => {
    if (!file) return;
    setUploadErrorContrato('');
    setUploadProgressContrato(0);
    const path = `projects/${project.id}/contrato.pdf`;
    const ref = storageRef(storage, path);
    const task = uploadBytesResumable(ref, file, { contentType: 'application/pdf' });
    task.on(
      'state_changed',
      snap => setUploadProgressContrato(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { setUploadErrorContrato(err.message); setUploadProgressContrato(null); },
      async () => {
        const url = await getDownloadURL(ref);
        const existing = project.propostaDocumento;
        const updated: PropostaDocumento = {
          slug: existing?.slug || '',
          titulo: existing?.titulo || '',
          clausulas: existing?.clausulas || [],
          status: existing?.status || 'rascunho',
          publicadoEm: existing?.publicadoEm,
          aceitoEm: existing?.aceitoEm,
          aceitoPor: existing?.aceitoPor,
          aceitoPorEmail: existing?.aceitoPorEmail,
          mensagemProxPassos: existing?.mensagemProxPassos,
          contratoPdfUrl: url,
          contratoPdfPath: path,
        };
        await updateDoc(projectRef, { propostaDocumento: updated });
        setUploadProgressContrato(null);
        addToast('Contrato vinculado com sucesso!');
      },
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  const doc_ = project.propostaDocumento;
  const isAceito = doc_?.status === 'aceito';
  const isPublicado = doc_?.status === 'publicado' || isAceito;
  // Pode publicar com cláusulas OU com contrato PDF vinculado
  const canPublish = clausulas.length > 0 || !!doc_?.contratoPdfUrl;

  return (
    <div className="space-y-4">

      {/* ── Toasts ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={removeToast} />)}
      </div>

      {/* ── D — Banner de Aceite ────────────────────────────────────── */}
      {isAceito && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Check size={16} className="text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-emerald-800 text-sm">Proposta aceita</p>
            <p className="text-emerald-700 text-sm mt-0.5">
              Aceita por <strong>{doc_?.aceitoPor || '—'}</strong>
              {doc_?.aceitoPorEmail && <> ({doc_.aceitoPorEmail})</>}
              {' '}em <strong>{fmtDate(doc_?.aceitoEm)}</strong>
            </p>
          </div>
        </div>
      )}

      {/* ── Upload Contrato para Assinatura ────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${doc_?.contratoPdfUrl ? 'bg-emerald-100' : 'bg-orange-50'}`}>
            <FileText className={`w-3.5 h-3.5 ${doc_?.contratoPdfUrl ? 'text-emerald-600' : 'text-orange-500'}`} />
          </div>
          <span className="text-sm font-bold text-gray-800">Contrato para Assinatura (PDF)</span>
          {doc_?.contratoPdfUrl
            ? <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Vinculado</span>
            : <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-bold">Recomendado</span>}
        </div>
        <p className="text-xs text-gray-500">
          Suba o contrato em PDF. Ele será exibido ao cliente antes de aprovar a proposta — o cliente revisa e confirma a assinatura online.
        </p>
        {doc_?.contratoPdfUrl && (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
            <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="text-xs text-emerald-700 flex-1 truncate">Contrato vinculado ✓</span>
            <a href={doc_.contratoPdfUrl} target="_blank" rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 flex-shrink-0">
              <ExternalLink size={13} />
            </a>
          </div>
        )}
        <input type="file" accept=".pdf" ref={fileInputContratoRef} className="hidden"
          onChange={e => { if (e.target.files?.[0]) handleUploadContrato(e.target.files[0]); }} />
        <button
          onClick={() => fileInputContratoRef.current?.click()}
          disabled={uploadProgressContrato !== null}
          className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition-all w-full justify-center"
        >
          {uploadProgressContrato !== null
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando {uploadProgressContrato}%</>
            : <><Upload className="w-4 h-4" /> {doc_?.contratoPdfUrl ? 'Substituir Contrato' : 'Upload Contrato PDF'}</>}
        </button>
        {uploadErrorContrato && <p className="text-xs text-red-600">{uploadErrorContrato}</p>}
      </div>

      {/* ── Header: título + botões principais ─────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 mb-1">Título do Documento</label>
            <input
              type="text"
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Proposta Comercial — Câmara Fria"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {/* Salvar */}
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </button>
            {/* Publicar */}
            <button
              onClick={handlePublicar}
              disabled={publishing || !canPublish}
              title={!canPublish ? 'Adicione um contrato PDF ou pelo menos 1 cláusula' : undefined}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {publishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              {isPublicado ? 'Republicar' : 'Publicar'}
            </button>
          </div>
        </div>

        {/* Link público após publicação */}
        {isPublicado && propostaLink && (
          <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-xs text-gray-500 truncate flex-1">{propostaLink}</span>
            <button
              onClick={handleCopiarLink}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 font-medium flex-shrink-0 transition-colors"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <a
              href={propostaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0 transition-colors"
            >
              <ExternalLink size={13} />
              Ver
            </a>
          </div>
        )}
      </div>

      {/* ── A — Lista de Cláusulas ──────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold">
              {clausulas.length}
            </span>
            Cláusulas do Documento
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImportPanel(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 font-medium transition-colors"
            >
              <Book size={13} />
              Importar Modelos
            </button>
            <button
              onClick={addClausulaVazia}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 hover:bg-orange-100 font-medium transition-colors"
            >
              <Plus size={13} />
              Adicionar
            </button>
          </div>
        </div>

        {/* Painel de Importação ─────────────────────────────────────── */}
        {showImportPanel && (
          <div className="border-b border-gray-100 bg-blue-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-blue-800 flex items-center gap-1.5">
                <Book size={14} />
                Banco de Modelos
              </h4>
              <button onClick={() => setShowImportPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X size={15} />
              </button>
            </div>

            {modelosDb.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Banco vazio. Use "Gerenciar Banco de Modelos" abaixo para criar templates.
              </p>
            ) : (
              <>
                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {Object.entries(modelosPorCategoria).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{cat}</p>
                      <div className="space-y-1">
                        {items.map(m => (
                          <label key={m.id} className="flex items-start gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={selectedModelos.has(m.id)}
                              onChange={() => toggleModelo(m.id)}
                              className="mt-0.5 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-800 group-hover:text-orange-700 transition-colors">{m.titulo}</p>
                              <p className="text-xs text-gray-500 line-clamp-2">{m.corpo}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={handleImportarSelecionados}
                    disabled={selectedModelos.size === 0}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors"
                  >
                    Importar Selecionados ({selectedModelos.size})
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Lista ─────────────────────────────────────────────────────── */}
        {clausulas.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-gray-400">Nenhuma cláusula adicionada.</p>
            <p className="text-xs text-gray-400 mt-1">Use os botões acima para adicionar ou importar cláusulas do banco de modelos.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {clausulas.map((c, idx) => (
              <div key={c.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* Indicador de número */}
                  <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                    <GripVertical size={14} className="text-gray-300" />
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                      {idx + 1}
                    </span>
                  </div>

                  {/* Conteúdo editável */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <input
                      type="text"
                      value={c.titulo}
                      onChange={e => updateClausula(c.id, 'titulo', e.target.value)}
                      placeholder="Título da cláusula"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                    <textarea
                      value={c.corpo}
                      onChange={e => updateClausula(c.id, 'corpo', e.target.value)}
                      placeholder="Texto da cláusula..."
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 resize-y focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>

                  {/* Ações */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveClausula(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      title="Mover para cima"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => moveClausula(idx, 1)}
                      disabled={idx === clausulas.length - 1}
                      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 disabled:opacity-30 transition-colors"
                      title="Mover para baixo"
                    >
                      <ChevronDown size={15} />
                    </button>
                    <button
                      onClick={() => removeClausula(c.id)}
                      className="p-1 rounded text-red-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Remover cláusula"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Rodapé — botão salvar inline */}
        {clausulas.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              onClick={handleSalvar}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar Documento
            </button>
          </div>
        )}
      </div>

      {/* ── E — Gerenciar Banco de Modelos ─────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowGerenciar(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Book size={15} className="text-gray-400" />
            Gerenciar Banco de Modelos
            <span className="text-xs font-normal text-gray-400">({modelosDb.length} templates)</span>
          </span>
          <ChevronRight
            size={16}
            className={`text-gray-400 transition-transform duration-200 ${showGerenciar ? 'rotate-90' : ''}`}
          />
        </button>

        {showGerenciar && (
          <div className="border-t border-gray-100 p-4 space-y-4">

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleImportarPadrao}
                disabled={importandoPadrao || modelosDb.length > 0}
                title={modelosDb.length > 0 ? 'Banco já possui modelos' : undefined}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 font-medium disabled:opacity-50 transition-colors"
              >
                {importandoPadrao ? <Loader2 size={13} className="animate-spin" /> : <Book size={13} />}
                Importar Modelos Padrão
              </button>
              <button
                onClick={() => setEditandoModelo({ titulo: '', corpo: '', categoria: 'Geral', ordem: modelosDb.length + 1 })}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700 hover:bg-orange-100 font-medium transition-colors"
              >
                <Plus size={13} />
                Novo Template
              </button>
            </div>

            {/* Form de edição de modelo */}
            {editandoModelo && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-blue-800">
                  {editandoModelo.id ? 'Editar Template' : 'Novo Template'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Título *</label>
                    <input
                      type="text"
                      value={editandoModelo.titulo || ''}
                      onChange={e => setEditandoModelo(p => ({ ...p!, titulo: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Ex: Da Garantia"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Categoria</label>
                    <select
                      value={editandoModelo.categoria || 'Geral'}
                      onChange={e => setEditandoModelo(p => ({ ...p!, categoria: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option>Geral</option>
                      <option>Execução</option>
                      <option>Pagamento</option>
                      <option>Garantia</option>
                      <option>Obrigações</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Ordem</label>
                    <input
                      type="number"
                      value={editandoModelo.ordem ?? ''}
                      onChange={e => setEditandoModelo(p => ({ ...p!, ordem: Number(e.target.value) }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">Corpo *</label>
                    <textarea
                      value={editandoModelo.corpo || ''}
                      onChange={e => setEditandoModelo(p => ({ ...p!, corpo: e.target.value }))}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Texto da cláusula..."
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditandoModelo(null)}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSalvarModelo}
                    disabled={savingModelo}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium disabled:opacity-60 transition-colors"
                  >
                    {savingModelo ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Salvar
                  </button>
                </div>
              </div>
            )}

            {/* Lista de templates */}
            {modelosDb.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-4">
                Banco vazio. Crie templates ou importe os modelos padrão.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(modelosPorCategoria).map(([cat, items]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{cat}</p>
                    <div className="space-y-1">
                      {items.map(m => (
                        <div
                          key={m.id}
                          className="flex items-start gap-3 p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800">{m.titulo}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.corpo}</p>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              onClick={() => setEditandoModelo({ ...m })}
                              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Editar"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteModelo(m.id)}
                              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Remover"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectPropostaDoc;

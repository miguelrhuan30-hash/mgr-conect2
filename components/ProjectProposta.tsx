/**
 * components/ProjectProposta.tsx
 *
 * Módulo completo de Proposta Comercial — fluxo inline no Flow de Atendimento.
 *
 * Passo 1 — 🎨 Apresentação em Slides
 *   Cria uma apresentação no módulo de Apresentações pré-preenchida com dados
 *   do projeto (cliente, título, cronograma, valores). Abre o editor em nova aba.
 *
 * Passo 2 — 📄 Documento PDF
 *   Upload do PDF final da proposta para o Firebase Storage.
 *
 * Passo 3 — 📱 Envio ao Cliente
 *   Texto editável simples (sem detalhes financeiros no corpo) com link dos
 *   slides e do PDF. Envia via WhatsApp ou copia.
 *
 * Passo 4 — ✅ Aprovação / Revisão
 *   Aprovação → avança para Contrato.
 *   Revisão → volta para Cotação ou Prancheta.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Save, Check, Loader2, Send, Copy, ExternalLink, Link2,
  MessageCircle, ArrowRight, ArrowLeft, RefreshCw, AlertCircle,
  ChevronDown, ChevronUp, Upload, FileText, Play, Plus,
  Presentation as PresentIcon, X, Trash2, Eye,
} from 'lucide-react';
import {
  collection, query, orderBy, onSnapshot, addDoc,
  doc, updateDoc, arrayUnion, serverTimestamp, getDocs, where, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useProject } from '../hooks/useProject';
import {
  CollectionName, ProjectV2, ProjectPhase,
  PropostaDados, PropostaStatus, ProjectV2PropostaVersao,
  CoverData, OverviewData, DeliverablesData, TimelineData, ClosingData,
  SlideData, PresentationTema,
} from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProjectPropostaDoc from './ProjectPropostaDoc';

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  project: ProjectV2;
  onSinalizarEnviado?: () => Promise<void>;
  onConverterProposta?: () => Promise<void>;
}

// ── Utils ─────────────────────────────────────────────────────────────────────
const fmtCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (ts: any) => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000);
    return format(d, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
  } catch { return '—'; }
};

const STATUS_CONFIG: Record<PropostaStatus, { label: string; color: string; dot: string }> = {
  rascunho: { label: 'Rascunho',           color: 'bg-gray-100 text-gray-600 border-gray-200',          dot: 'bg-gray-400'    },
  enviado:  { label: 'Enviado ao Cliente', color: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-500'    },
  aprovado: { label: 'Aprovado ✓',         color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  revisao:  { label: 'Em Revisão',         color: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-500'   },
};

// ── Gera slug único para a apresentação ───────────────────────────────────────
async function generateSlug(): Promise<string> {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => chars[b % chars.length]).join('');
    const slug = `mgr-${rand}`;
    const q = query(collection(db, CollectionName.PRESENTATIONS), where('slug', '==', slug));
    const snap = await getDocs(q);
    if (snap.empty) return slug;
  }
  return `mgr-${Date.now().toString(36)}`;
}

// ── Monta slides pré-preenchidos com dados do projeto ─────────────────────────
function buildSlidesFromProject(project: ProjectV2): SlideData[] {
  const servicos = project.prancheta?.servicosExecucao || [];
  const totalDias = servicos.reduce(
    (s, srv) => s + srv.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0), 0,
  );
  const totalMdo = servicos.reduce((s, srv) => s + (srv.valorMaoDeObra || 0), 0);

  // Slide Cronograma — usa as fases do primeiro serviço (ou todos se só 1)
  const fasesCrono = servicos.length === 1
    ? servicos[0].fases.map(f => ({
        id: f.id,
        nome: f.nome,
        prazo: `${f.diasExecucao} dia${f.diasExecucao !== 1 ? 's' : ''}`,
        descricao: '',
      }))
    : servicos.map(srv => ({
        id: srv.id,
        nome: srv.nome,
        prazo: `${srv.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0)} dias`,
        descricao: '',
      }));

  // Slide Entregas — um item por serviço
  const entregas = servicos.length > 0
    ? servicos.map(srv => ({ id: srv.id, categoria: srv.nome, descricao: 'A definir' }))
    : [{ id: '1', categoria: 'Exemplo', descricao: 'Descrição da entrega' }];

  return [
    {
      type: 'cover', order: 0, visible: true,
      data: {
        titulo: project.nome,
        subtitulo: 'Proposta Comercial',
        clienteNome: project.clientName,
        dataValidade: '',
        usarLogoMGR: true,
      } as CoverData,
    },
    {
      type: 'overview', order: 1, visible: true,
      data: {
        descricao: project.descricao || project.prancheta?.observacoesTecnicas || '',
        localizacao: project.leadData?.localizacao || '',
        temperatura: '',
        finalidade: project.leadData?.finalidade || '',
        metragem: project.prancheta?.metragem || '',
      } as OverviewData,
    },
    {
      type: 'deliverables', order: 2, visible: true,
      data: { items: entregas } as DeliverablesData,
    },
    {
      type: 'timeline', order: 3, visible: true,
      data: {
        fases: fasesCrono.length > 0
          ? fasesCrono
          : [
              { id: '1', nome: 'Fase 1', prazo: '—', descricao: '' },
              { id: '2', nome: 'Fase 2', prazo: '—', descricao: '' },
            ],
        totalDias: totalDias > 0 ? `${totalDias} dias corridos` : '',
      } as TimelineData,
    },
    {
      // Slide de encerramento — CTA direciona para o PDF com valores e condições
      type: 'closing', order: 4, visible: true,
      data: {
        textoCTA: 'Ver proposta comercial completa (PDF)',
        textoFechamento: 'Agradecemos a confiança e estamos à disposição para esclarecer qualquer dúvida sobre a solução apresentada.',
        exibirContato: true,
      } as ClosingData,
    },
  ];
}

// ── Componente Principal ──────────────────────────────────────────────────────
const ProjectProposta: React.FC<Props> = ({ project }) => {
  const { currentUser, userProfile } = useAuth();
  const { projects, advancePhase, updateProject } = useProject();

  // Fase atual em tempo real
  const projectAtual = projects?.find(p => p.id === project.id);
  const faseAtual = projectAtual?.fase || project.fase;

  // Dados da proposta salvos
  const [dados, setDados] = useState<PropostaDados>({
    valorMateriais: 0, valorMaoDeObra: 0, desconto: 0, valorTotal: 0,
    condicoesPagamento: '', prazoExecucao: '', validadeAte: '',
    observacoesCliente: '', status: 'rascunho',
    ...project.propostaDados,
  });

  // Link da apresentação
  const [apresentacaoInfo, setApresentacaoInfo] = useState<{
    id: string; slug?: string; projetoTitulo?: string; clienteNome?: string; pdfUrl?: string | null;
  } | null>(null);

  useEffect(() => {
    if (!project.apresentacaoId) return;
    const unsub = onSnapshot(
      doc(db, CollectionName.PRESENTATIONS, project.apresentacaoId),
      snap => {
        if (snap.exists()) {
          const d = snap.data();
          setApresentacaoInfo({ id: snap.id, slug: d.slug, projetoTitulo: d.projetoTitulo, clienteNome: d.clienteNome, pdfUrl: d.pdfUrl });
        }
      },
    );
    return () => unsub();
  }, [project.apresentacaoId]);

  const linkSlides = useMemo(() => {
    if (!apresentacaoInfo) return null;
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
    return apresentacaoInfo.slug
      ? `${window.location.origin}/#/apresentacao/${apresentacaoInfo.slug}`
      : null;
  }, [apresentacaoInfo]);

  const pdfUrl = apresentacaoInfo?.pdfUrl || dados.pdfUrl || null;

  // ── Estado UI ──────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [savedLocal, setSavedLocal] = useState(false);
  const [criandoApres, setCriandoApres] = useState(false);
  const [secaoSlides, setSecaoSlides] = useState(true);
  const [secaoPdf, setSecaoPdf] = useState(true);
  const [secaoDoc, setSecaoDoc] = useState(true);
  const [secaoEnvio, setSecaoEnvio] = useState(true);
  const [secaoAprovacao, setSecaoAprovacao] = useState(true);

  // Upload PDF
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [pdfExternalUrl, setPdfExternalUrl] = useState(dados.pdfUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mensagem
  const [mensagem, setMensagem] = useState('');
  const [telefoneWa, setTelefoneWa] = useState(
    (project.leadData?.telefone || '').replace(/\D/g, ''),
  );
  const [copied, setCopied] = useState(false);
  const [avancandoContrato, setAvancandoContrato] = useState(false);
  const [contratoAvancado, setContratoAvancado] = useState(false);
  const [voltando, setVoltando] = useState(false);
  const [showVoltarOpcoes, setShowVoltarOpcoes] = useState(false);
  const [revisaoMotivo, setRevisaoMotivo] = useState('');

  // Link do documento de proposta HTML (cláusulas)
  const propostaDocLink = useMemo(() => {
    const slug = project.propostaDocumento?.slug;
    const status = project.propostaDocumento?.status;
    if (!slug || status === 'rascunho') return '';
    return `${window.location.origin}/#/proposta/${slug}`;
  }, [project.propostaDocumento?.slug, project.propostaDocumento?.status]);

  // Gera mensagem default
  const gerarMensagemDefault = useCallback(() => {
    const linhas: string[] = [
      `Olá${project.clientName ? `, *${project.clientName}*` : ''}! 👋`,
      '',
      `Segue sua proposta comercial para o projeto *${project.nome}*.`,
      '',
    ];
    if (linkSlides) {
      linhas.push(`🎨 *Apresentação completa:*`);
      linhas.push(linkSlides);
      linhas.push('');
    }
    if (propostaDocLink) {
      linhas.push(`📋 *Documento comercial (cláusulas + aceite):*`);
      linhas.push(propostaDocLink);
      linhas.push('');
    }
    if (pdfUrl) {
      linhas.push(`📄 *Documento PDF:*`);
      linhas.push(pdfUrl);
      linhas.push('');
    }
    linhas.push('Ficamos à disposição para qualquer dúvida. Aguardamos sua aprovação! 🙏');
    return linhas.join('\n');
  }, [project.clientName, project.nome, linkSlides, propostaDocLink, pdfUrl]);

  // Atualiza mensagem quando links mudam (só se ainda não foi editada manualmente)
  const mensagemEditada = useRef(false);
  useEffect(() => {
    if (!mensagemEditada.current) {
      setMensagem(gerarMensagemDefault());
    }
  }, [gerarMensagemDefault]);

  // ── Criar apresentação pré-preenchida ──────────────────────────────────────
  const handleCriarApresentacao = async () => {
    if (!currentUser) return;
    setCriandoApres(true);
    try {
      const slug = await generateSlug();
      const slides = buildSlidesFromProject(project);
      const docRef = await addDoc(collection(db, CollectionName.PRESENTATIONS), {
        slug,
        clienteNome: project.clientName,
        projetoTitulo: project.nome,
        responsavel: userProfile?.displayName || '',
        responsavelEmail: '',
        responsavelTelefone: '',
        pdfUrl: null,
        pdfStoragePath: null,
        logoClienteUrl: null,
        logoClienteStoragePath: null,
        status: 'rascunho' as const,
        tema: 'mgr-classic' as PresentationTema,
        slides,
        slideAutoplay: false,
        slideDelayMs: 5000,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser.uid,
      });

      // Salva no projeto
      const novaVersao: ProjectV2PropostaVersao = {
        versao: (project.propostaVersoes?.length || 0) + 1,
        apresentacaoId: docRef.id,
        slug,
        criadaEm: Timestamp.now(),
      };
      await updateDoc(doc(db, CollectionName.PROJECTS_V2, project.id), {
        apresentacaoId: docRef.id,
        propostaVersoes: arrayUnion(novaVersao),
        updatedAt: serverTimestamp(),
      });

      // Abre o editor em nova aba
      window.open(`#/app/apresentacoes?id=${docRef.id}`, '_blank');
    } catch (err: any) {
      alert(`Erro ao criar apresentação: ${err?.message || String(err)}`);
    } finally {
      setCriandoApres(false);
    }
  };

  // ── Upload PDF ─────────────────────────────────────────────────────────────
  const handleUploadPdf = (file: File) => {
    if (!file || !project.apresentacaoId) return;
    setUploadError('');
    setUploadProgress(0);
    const path = `presentations/${project.apresentacaoId}/proposta.pdf`;
    const ref = storageRef(storage, path);
    const task = uploadBytesResumable(ref, file, { contentType: 'application/pdf' });
    task.on(
      'state_changed',
      snap => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { setUploadError(err.message); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(ref);
        // Salva no doc da apresentação e no projeto
        await Promise.all([
          updateDoc(doc(db, CollectionName.PRESENTATIONS, project.apresentacaoId!), {
            pdfUrl: url, pdfStoragePath: path, updatedAt: serverTimestamp(),
          }),
          updateProject(project.id, { propostaDados: { ...dados, pdfUrl: url } as any }),
        ]);
        setDados(prev => ({ ...prev, pdfUrl: url }));
        setPdfExternalUrl(url);
        setUploadProgress(null);
        setSavedLocal(true);
      },
    );
  };

  const handleSavePdfUrl = async () => {
    if (!pdfExternalUrl.trim()) return;
    setSaving(true);
    try {
      const newDados = { ...dados, pdfUrl: pdfExternalUrl.trim() };
      setDados(newDados);
      await updateProject(project.id, { propostaDados: newDados as any });
      if (project.apresentacaoId) {
        await updateDoc(doc(db, CollectionName.PRESENTATIONS, project.apresentacaoId), {
          pdfUrl: pdfExternalUrl.trim(), updatedAt: serverTimestamp(),
        });
      }
      setSavedLocal(true);
    } finally { setSaving(false); }
  };

  // ── Enviar WhatsApp ────────────────────────────────────────────────────────
  const handleEnviarWhatsApp = async () => {
    const tel = telefoneWa.replace(/\D/g, '');
    const url = tel
      ? `https://wa.me/${tel.startsWith('55') ? tel : '55' + tel}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
    window.open(url, '_blank');

    const novoDados: PropostaDados = {
      ...dados, status: 'enviado', enviadoEm: Timestamp.now() as any,
    };
    setDados(novoDados);
    await updateProject(project.id, { propostaDados: novoDados as any });
    setSavedLocal(true);
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(mensagem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Aprovação → Contrato ───────────────────────────────────────────────────
  const handleAvançarContrato = async () => {
    if (!window.confirm('Confirmar aprovação do cliente? O projeto avançará para a fase de Contrato.')) return;
    setAvancandoContrato(true);
    try {
      const novoDados: PropostaDados = {
        ...dados, status: 'aprovado', aprovadoEm: Timestamp.now() as any,
      };
      await updateProject(project.id, { propostaDados: novoDados as any });
      setDados(novoDados);

      const result = await advancePhase(
        project.id, 'contrato_enviado',
        'Proposta aprovada pelo cliente — avançando para Contrato',
      );
      if (!result.success) {
        alert(`Não foi possível avançar: ${result.error || 'Erro desconhecido'}`);
        return;
      }
      setContratoAvancado(true);
    } catch (err: any) {
      alert(`Erro: ${err?.message || String(err)}`);
    } finally {
      setAvancandoContrato(false);
    }
  };

  // ── Revisão → Voltar ───────────────────────────────────────────────────────
  const handleVoltar = async (fase: ProjectPhase) => {
    if (!revisaoMotivo.trim()) {
      alert('Descreva o que o cliente pediu para ajustar.');
      return;
    }
    setVoltando(true);
    try {
      const novoDados: PropostaDados = { ...dados, status: 'revisao', revisaoMotivo };
      await updateProject(project.id, { propostaDados: novoDados as any });
      setDados(novoDados);

      const label = fase === 'cotacao_recebida' ? 'Cotação' : 'Prancheta';
      const result = await advancePhase(
        project.id, fase,
        `Revisão — retornando para ${label}: ${revisaoMotivo}`,
      );
      if (!result.success) alert(`Erro ao retornar: ${result.error}`);
    } catch (err: any) {
      alert(`Erro: ${err?.message || String(err)}`);
    } finally {
      setVoltando(false);
      setShowVoltarOpcoes(false);
    }
  };

  // ── Confirmação final ──────────────────────────────────────────────────────
  if (contratoAvancado) {
    return (
      <div className="rounded-2xl p-6 bg-emerald-50 border border-emerald-300 flex items-center gap-4">
        <Check className="w-8 h-8 text-emerald-600 flex-shrink-0" />
        <div>
          <p className="text-base font-extrabold text-emerald-800">🎉 Proposta aprovada! Avançando para Contrato.</p>
          <p className="text-sm text-emerald-600 mt-1">Acesse a fase de Contrato para gerar e enviar o contrato ao cliente.</p>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[dados.status || 'rascunho'];
  const temApresentacao = !!project.apresentacaoId;
  const temPdf = !!(pdfUrl);
  const temSlideLink = !!linkSlides;
  const temDocPublicado = !!project.propostaDocumento?.slug &&
    project.propostaDocumento.status !== 'rascunho';

  // ── Passos de progresso ────────────────────────────────────────────────────
  const steps = [
    { n: 1, label: 'Slides',    done: temApresentacao,                                            icon: '🎨' },
    { n: 2, label: 'PDF',       done: temPdf,                                                     icon: '📄' },
    { n: 3, label: 'Documento', done: temDocPublicado,                                            icon: '📋' },
    { n: 4, label: 'Envio',     done: dados.status === 'enviado' || dados.status === 'aprovado',  icon: '📱' },
    { n: 5, label: 'Aprovação', done: dados.status === 'aprovado',                               icon: '✅' },
  ];

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm py-2 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-extrabold text-gray-900 flex items-center gap-2 text-base">
            🎨 Proposta Comercial
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">{project.nome} · {project.clientName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusCfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
        </div>
      </div>

      {/* ── Barra de progresso ── */}
      <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-5 py-3">
        {steps.map((s, i) => (
          <React.Fragment key={s.n}>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold flex-shrink-0 transition-colors ${
                s.done ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {s.done ? <Check className="w-3.5 h-3.5" /> : s.n}
              </div>
              <span className={`text-xs font-bold hidden sm:block truncate ${s.done ? 'text-emerald-700' : 'text-gray-400'}`}>
                {s.icon} {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 max-w-8 rounded-full transition-colors ${s.done ? 'bg-emerald-300' : 'bg-gray-100'}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Banner revisão ── */}
      {dados.status === 'revisao' && dados.revisaoMotivo && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex items-start gap-3">
          <RefreshCw className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-800">Proposta em revisão</p>
            <p className="text-xs text-amber-700 mt-0.5">{dados.revisaoMotivo}</p>
          </div>
        </div>
      )}

      {/* ══ PASSO 1: Apresentação em Slides ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoSlides(!secaoSlides)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${temApresentacao ? 'bg-emerald-100' : 'bg-brand-100'}`}>
              <PresentIcon className={`w-3.5 h-3.5 ${temApresentacao ? 'text-emerald-600' : 'text-brand-600'}`} />
            </div>
            <span className="text-sm font-bold text-gray-800">Passo 1 — Apresentação em Slides</span>
            {temApresentacao
              ? <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Criada</span>
              : <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">Pendente</span>}
          </div>
          {secaoSlides ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoSlides && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

            {!temApresentacao ? (
              /* — Criar nova — */
              <div className="space-y-3">
                <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                  <p className="text-sm font-bold text-brand-900 mb-1">Criar apresentação de slides</p>
                  <p className="text-xs text-brand-700">
                    Uma apresentação será criada automaticamente pré-preenchida com os dados
                    do projeto (cliente, cronograma, serviços). O editor abrirá em nova aba.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={handleCriarApresentacao} disabled={criandoApres}
                    className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 disabled:opacity-60 transition-colors shadow-sm">
                    {criandoApres
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</>
                      : <><Plus className="w-4 h-4" /> Criar Apresentação</>}
                  </button>
                </div>
              </div>
            ) : (
              /* — Apresentação criada — */
              <div className="space-y-3">

                {/* Card da apresentação */}
                <div className="flex items-center gap-3 p-4 bg-brand-50 border border-brand-200 rounded-xl">
                  <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <PresentIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-brand-900 truncate">
                      {apresentacaoInfo?.projetoTitulo || project.nome}
                    </p>
                    <p className="text-xs text-brand-600 truncate">
                      {apresentacaoInfo?.clienteNome || project.clientName}
                    </p>
                    {linkSlides && (
                      <p className="text-[10px] text-brand-400 font-mono mt-0.5 truncate">{linkSlides}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => window.open(`#/app/apresentacoes?id=${project.apresentacaoId}`, '_blank')}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-bold hover:bg-brand-700 transition-colors">
                      <Play className="w-3 h-3" /> Editar Slides
                    </button>
                    {linkSlides && (
                      <a href={linkSlides} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-white border border-brand-200 hover:bg-brand-50 text-brand-600 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Copiar link dos slides */}
                {linkSlides && (
                  <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    <Link2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="text-xs text-gray-600 flex-1 truncate font-mono">{linkSlides}</span>
                    <button onClick={async () => {
                      await navigator.clipboard.writeText(linkSlides);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold border rounded-lg transition-colors bg-white text-gray-600 border-gray-200 hover:bg-gray-100">
                      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      Copiar
                    </button>
                  </div>
                )}

                {/* Aviso se não tem slide link ainda */}
                {!linkSlides && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <p className="text-xs text-yellow-800">
                      Apresentação criada mas ainda sem link público. Abra o editor e publique a apresentação para gerar o link.
                    </p>
                  </div>
                )}

                {/* Criar nova versão */}
                <button
                  onClick={handleCriarApresentacao}
                  disabled={criandoApres}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  <Plus className="w-3 h-3" />
                  {criandoApres ? 'Criando...' : 'Criar nova versão dos slides'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══ PASSO 2: PDF da Proposta ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoPdf(!secaoPdf)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${temPdf ? 'bg-emerald-100' : 'bg-red-100'}`}>
              <FileText className={`w-3.5 h-3.5 ${temPdf ? 'text-emerald-600' : 'text-red-500'}`} />
            </div>
            <span className="text-sm font-bold text-gray-800">Passo 2 — Documento PDF</span>
            {temPdf
              ? <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Vinculado</span>
              : <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">Opcional</span>}
          </div>
          {secaoPdf ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoPdf && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

            {/* PDF atual */}
            {temPdf && (
              <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span className="text-xs text-emerald-700 flex-1 truncate font-mono">{pdfUrl}</span>
                <a href={pdfUrl!} target="_blank" rel="noopener noreferrer"
                  className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-600 transition-colors flex-shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Upload */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">Upload do PDF</p>
              {!temApresentacao && (
                <p className="text-xs text-amber-600 mb-2">Crie a apresentação em slides (Passo 1) antes de fazer o upload do PDF.</p>
              )}
              <input
                type="file" accept=".pdf" ref={fileInputRef}
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) handleUploadPdf(e.target.files[0]); }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!temApresentacao || uploadProgress !== null}
                className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-600 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50 disabled:opacity-50 transition-all w-full justify-center">
                {uploadProgress !== null
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando {uploadProgress}%</>
                  : <><Upload className="w-4 h-4" /> Selecionar PDF</>}
              </button>
              {uploadError && <p className="text-xs text-red-600 mt-1">{uploadError}</p>}
            </div>

            {/* OU URL externa */}
            <div>
              <p className="text-xs font-bold text-gray-600 mb-2">ou colar link externo do PDF</p>
              <div className="flex gap-2">
                <input
                  value={pdfExternalUrl}
                  onChange={e => setPdfExternalUrl(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
                <button
                  onClick={handleSavePdfUrl}
                  disabled={saving || !pdfExternalUrl.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-bold hover:bg-gray-700 disabled:opacity-40 transition-colors">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ PASSO 3: Documento Comercial (Cláusulas HTML) ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoDoc(!secaoDoc)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${temDocPublicado ? 'bg-emerald-100' : 'bg-purple-100'}`}>
              <FileText className={`w-3.5 h-3.5 ${temDocPublicado ? 'text-emerald-600' : 'text-purple-500'}`} />
            </div>
            <span className="text-sm font-bold text-gray-800">Passo 3 — Documento Comercial</span>
            {temDocPublicado
              ? <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">✓ Publicado</span>
              : project.propostaDocumento?.clausulas?.length
                ? <span className="text-[9px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full font-bold">Rascunho</span>
                : <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">Cláusulas + Aceite</span>
            }
          </div>
          {secaoDoc ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoDoc && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4">
            <p className="text-xs text-gray-500 mb-4">
              Crie o documento com cláusulas personalizadas, publique e envie o link ao cliente para leitura e aceite formal online.
            </p>
            <ProjectPropostaDoc project={project} />
          </div>
        )}
      </div>

      {/* ══ PASSO 4: Envio ao Cliente ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoEnvio(!secaoEnvio)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageCircle className="w-3.5 h-3.5 text-green-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Passo 4 — Envio ao Cliente</span>
            {(dados.status === 'enviado' || dados.status === 'aprovado') && (
              <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                {dados.enviadoEm ? `Enviado em ${fmtDate(dados.enviadoEm)}` : 'Enviado'}
              </span>
            )}
          </div>
          {secaoEnvio ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoEnvio && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

            {/* Aviso se não tem link */}
            {!temSlideLink && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-800">
                  A mensagem ficará mais completa após criar a apresentação (Passo 1), vincular o PDF (Passo 2) e publicar o documento comercial (Passo 3).
                  Você pode enviar mesmo assim.
                </p>
              </div>
            )}

            {/* Área de texto editável */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-bold text-gray-600">Mensagem para o WhatsApp</p>
                <button onClick={() => { mensagemEditada.current = false; setMensagem(gerarMensagemDefault()); }}
                  className="text-[10px] text-brand-600 font-bold hover:underline">
                  ↺ Regenerar
                </button>
              </div>
              <textarea
                value={mensagem}
                onChange={e => { mensagemEditada.current = true; setMensagem(e.target.value); }}
                rows={10}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none outline-none focus:ring-2 focus:ring-green-400 font-mono leading-relaxed" />
            </div>

            {/* Telefone + ações */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1.5">
                WhatsApp do Cliente
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  value={telefoneWa}
                  onChange={e => setTelefoneWa(e.target.value)}
                  placeholder="5511999999999"
                  className="flex-1 min-w-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-green-400" />
                <button onClick={handleEnviarWhatsApp}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition-colors shadow-sm flex-shrink-0">
                  <MessageCircle className="w-4 h-4" /> Enviar via WhatsApp
                </button>
                <button onClick={handleCopyMessage}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all flex-shrink-0 ${
                    copied ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ PASSO 4: Aprovação ══ */}
      {faseAtual === 'proposta_enviada' && dados.status !== 'aprovado' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button onClick={() => setSecaoAprovacao(!secaoAprovacao)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-sm font-bold text-gray-800">Passo 5 — Aprovação do Cliente</span>
            </div>
            {secaoAprovacao ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {secaoAprovacao && (
            <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

              {/* Aprovar */}
              <div className="rounded-xl p-4 bg-emerald-50 border border-emerald-200 space-y-3">
                <div>
                  <p className="text-sm font-bold text-emerald-900">✅ Cliente aprovou a proposta?</p>
                  <p className="text-xs text-emerald-700 mt-0.5">Registre a aprovação para avançar para a fase de Contrato.</p>
                </div>
                <button onClick={handleAvançarContrato} disabled={avancandoContrato}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
                  {avancandoContrato
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Avançando...</>
                    : <><ArrowRight className="w-4 h-4" /> Cliente Aprovou — Avançar para Contrato</>}
                </button>
              </div>

              {/* Revisão */}
              <div className="rounded-xl p-4 bg-amber-50 border border-amber-200 space-y-3">
                <div>
                  <p className="text-sm font-bold text-amber-900">🔄 Cliente pediu ajustes?</p>
                  <p className="text-xs text-amber-700 mt-0.5">Volte para a fase adequada, ajuste e reenvie uma nova proposta.</p>
                </div>

                {!showVoltarOpcoes ? (
                  <button onClick={() => setShowVoltarOpcoes(true)}
                    className="flex items-center gap-2 px-4 py-2.5 border border-amber-300 text-amber-700 bg-white rounded-xl text-sm font-bold hover:bg-amber-100 transition-colors">
                    <RefreshCw className="w-4 h-4" /> Solicitar Revisão
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-amber-800 block mb-1.5">O que o cliente pediu para ajustar? *</label>
                      <textarea
                        value={revisaoMotivo}
                        onChange={e => setRevisaoMotivo(e.target.value)}
                        rows={2}
                        placeholder="Ex: Prazo de pagamento diferente; Incluir mais serviços..."
                        className="w-full border border-amber-200 rounded-xl px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-amber-300 bg-white" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleVoltar('cotacao_recebida')} disabled={voltando || !revisaoMotivo.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 disabled:opacity-50 transition-colors">
                        {voltando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                        ← Revisar Cotações
                      </button>
                      <button onClick={() => handleVoltar('em_levantamento')} disabled={voltando || !revisaoMotivo.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                        {voltando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowLeft className="w-4 h-4" />}
                        ← Revisar Prancheta
                      </button>
                      <button onClick={() => { setShowVoltarOpcoes(false); setRevisaoMotivo(''); }}
                        className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                        <X className="w-4 h-4" /> Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status aprovado */}
      {dados.status === 'aprovado' && (
        <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 flex items-center gap-3">
          <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">Proposta aprovada pelo cliente</p>
            {dados.aprovadoEm && (
              <p className="text-xs text-emerald-600 mt-0.5">{fmtDate(dados.aprovadoEm)}</p>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default ProjectProposta;

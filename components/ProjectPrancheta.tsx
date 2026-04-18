/**
 * components/ProjectPrancheta.tsx — Prancheta Digital do Técnico
 *
 * Bloco de notas livre para o técnico descrever o escopo de projeto,
 * com transcrição de áudio via Web Speech API e gerador de escopo formatado
 * para envio a fornecedores para cotação de materiais.
 *
 * Seções:
 *  1. Dados técnicos rápidos (dimensões, equipamento, etc.)
 *  2. Bloco de notas livre — com suporte a transcrição de áudio
 *  3. Itens para cotação (lista estruturada)
 *  4. Escopo gerado — texto final pronto para envio
 *  5. Fotos e croquis
 *  6. Botão "Projeto Pronto" → avança para Cotação
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Save, Upload, Loader2, Trash2, Image, FileText, Check,
  Mic, MicOff, Plus, X, Copy, Download, ChevronDown, ChevronUp,
  ClipboardList, Pencil, Volume2, Send, Paperclip,
  HardHat, Calendar, DollarSign, ChevronRight,
} from 'lucide-react';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from '../firebase';
import { useProject } from '../hooks/useProject';
import {
  ProjectV2Prancheta, ProjectV2PranchetaItemCotacao, ArquivoContato,
  FaseExecucaoPrancheta, ServicoExecucaoPrancheta,
} from '../types';

// ── Tipos locais ────────────────────────────────────────────────────────────
interface Props {
  projectId: string;
  prancheta?: ProjectV2Prancheta;
  projectName?: string;
  clientName?: string;
  leadId?: string;         // vindo do project.leadId para atualizar sub-status
  arquivosContato?: ArquivoContato[];  // arquivos enviados pelo cliente durante o contato
}

// ── Constantes de configuração técnica ─────────────────────────────────────
const VOLTAGENS = ['110V', '220V', '380V', '440V'];
const GASES = ['R-22', 'R-134a', 'R-404A', 'R-407C', 'R-410A', 'R-290', 'R-600a', 'Outro'];
const ISOLAMENTOS = ['EPS (Isopor)', 'PUR (Poliuretano)', 'PIR (Poliisocianurato)', 'Lã de Rocha', 'XPS', 'Outro'];

// ── Declaração da Web Speech API ───────────────────────────────────────────
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

// ── Componente Principal ───────────────────────────────────────────────────
const ProjectPrancheta: React.FC<Props> = ({ projectId, prancheta, projectName, clientName, leadId, arquivosContato }) => {
  const { savePrancheta, sinalizarProjetoPronto, advancePhase } = useProject();

  // ── Form state ──
  const [form, setForm] = useState<ProjectV2Prancheta>({
    dimensoes: '',
    tipoEquipamento: '',
    capacidadeBTU: null as any,
    voltagem: '',
    tipoGas: '',
    isolamento: '',
    estruturaExistente: '',
    temperaturaAlvo: '',
    finalidade: '',
    localizacao: '',
    metragem: '',
    observacoesTecnicas: '',
    scopeNotes: '',
    solicitacaoCotacao: '',
    itensCotacao: [],
    fotosLevantamento: [],
    croquis: [],
    ...prancheta,
  });

  // ── UI state ──
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<'foto' | 'croqui'>('foto');
  const [savingPronto, setSavingPronto] = useState(false);
  const [projetoPronto, setProjetoPronto] = useState(false);
  const [enviandoCotacao, setEnviandoCotacao] = useState(false);
  const [cotacaoEnviada, setCotacaoEnviada] = useState(false);
  const [secaoDados, setSecaoDados] = useState(true);
  const [secaoEscopo, setSecaoEscopo] = useState(true);
  const [secaoCotacao, setSecaoCotacao] = useState(true);
  const [secaoFotos, setSecaoFotos] = useState(true);
  const [copiedScope, setCopiedScope] = useState(false);

  // ── Transcrição de áudio (Web Speech API) ──
  const [isListening, setIsListening] = useState(false);
  const [speechTarget, setSpeechTarget] = useState<'scopeNotes' | 'observacoesTecnicas'>('scopeNotes');
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Novo item de cotação ──
  const [novoItem, setNovoItem] = useState<ProjectV2PranchetaItemCotacao>({ descricao: '', quantidade: '', unidade: '', observacao: '' });

  // ── Plano de Execução ──
  const [secaoExecucao, setSecaoExecucao] = useState(true);
  const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  const addServico = () => {
    const novo: ServicoExecucaoPrancheta = { id: makeId(), nome: 'Novo Serviço', fases: [], valorMaoDeObra: 0 };
    setForm(prev => ({ ...prev, servicosExecucao: [...(prev.servicosExecucao || []), novo] }));
    setSaved(false);
  };

  const updateServico = (sId: string, field: keyof ServicoExecucaoPrancheta, value: any) => {
    setForm(prev => ({
      ...prev,
      servicosExecucao: (prev.servicosExecucao || []).map(s => s.id === sId ? { ...s, [field]: value } : s),
    }));
    setSaved(false);
  };

  const removeServico = (sId: string) => {
    setForm(prev => ({ ...prev, servicosExecucao: (prev.servicosExecucao || []).filter(s => s.id !== sId) }));
    setSaved(false);
  };

  const addFase = (sId: string) => {
    const nova: FaseExecucaoPrancheta = { id: makeId(), nome: '', diasExecucao: 1 };
    setForm(prev => ({
      ...prev,
      servicosExecucao: (prev.servicosExecucao || []).map(s =>
        s.id === sId ? { ...s, fases: [...s.fases, nova] } : s
      ),
    }));
    setSaved(false);
  };

  const updateFase = (sId: string, fId: string, field: keyof FaseExecucaoPrancheta, value: any) => {
    setForm(prev => ({
      ...prev,
      servicosExecucao: (prev.servicosExecucao || []).map(s =>
        s.id === sId
          ? { ...s, fases: s.fases.map(f => f.id === fId ? { ...f, [field]: value } : f) }
          : s
      ),
    }));
    setSaved(false);
  };

  const removeFase = (sId: string, fId: string) => {
    setForm(prev => ({
      ...prev,
      servicosExecucao: (prev.servicosExecucao || []).map(s =>
        s.id === sId ? { ...s, fases: s.fases.filter(f => f.id !== fId) } : s
      ),
    }));
    setSaved(false);
  };

  useEffect(() => {
    if (prancheta) setForm((prev) => ({ ...prev, ...prancheta }));
  }, [prancheta]);

  const update = (field: keyof ProjectV2Prancheta, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  // ── Web Speech API ──────────────────────────────────────────────────────
  const speechSupported = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const startListening = useCallback((target: 'scopeNotes' | 'observacoesTecnicas') => {
    if (!speechSupported) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SpeechRecognition();
    recog.lang = 'pt-BR';
    recog.continuous = true;
    recog.interimResults = true;

    let finalTranscript = '';
    recog.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t + ' ';
        else interim += t;
      }
      // Append ao campo existente
      setForm((prev) => ({
        ...prev,
        [target]: (prancheta?.[target] || prev[target] || '') + finalTranscript + (interim ? `[…${interim}]` : ''),
      }));
    };

    recog.onerror = () => { setIsListening(false); };
    recog.onend = () => {
      setIsListening(false);
      // Limpar os indicadores de interim
      setForm((prev) => ({
        ...prev,
        [target]: (prev[target] || '').replace(/\[…[^\]]*\]/g, '').trim(),
      }));
      setSaved(false);
    };

    recognitionRef.current = recog;
    setSpeechTarget(target);
    setIsListening(true);
    recog.start();
  }, [speechSupported, prancheta]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  // ── Gerador de Escopo ───────────────────────────────────────────────────
  // Gera o texto, atualiza o form E já salva no Firestore automaticamente.
  // Assim o usuário não precisa clicar em "Salvar" após gerar.
  const gerarEscopo = async () => {
    const linhas: string[] = [];
    const today = new Date().toLocaleDateString('pt-BR');

    linhas.push(`SOLICITAÇÃO DE COTAÇÃO DE MATERIAIS`);
    linhas.push(`Data: ${today}`);
    if (clientName) linhas.push(`Cliente: ${clientName}`);
    if (projectName) linhas.push(`Projeto: ${projectName}`);
    linhas.push('');
    linhas.push('═'.repeat(60));
    linhas.push('ESCOPO DO PROJETO');
    linhas.push('═'.repeat(60));

    if (form.finalidade) linhas.push(`\nFinalidade: ${form.finalidade}`);
    if (form.localizacao) linhas.push(`Localização: ${form.localizacao}`);
    if (form.metragem) linhas.push(`Metragem: ${form.metragem}`);
    if (form.temperaturaAlvo) linhas.push(`Temperatura Alvo: ${form.temperaturaAlvo}`);
    if (form.dimensoes) linhas.push(`Dimensões: ${form.dimensoes}`);
    if (form.tipoEquipamento) linhas.push(`Equipamento: ${form.tipoEquipamento}`);
    if (form.capacidadeBTU) linhas.push(`Capacidade: ${form.capacidadeBTU.toLocaleString('pt-BR')} BTU`);
    if (form.voltagem) linhas.push(`Voltagem: ${form.voltagem}`);
    if (form.tipoGas) linhas.push(`Gás Refrigerante: ${form.tipoGas}`);
    if (form.isolamento) linhas.push(`Isolamento: ${form.isolamento}`);
    if (form.estruturaExistente) linhas.push(`Estrutura Existente: ${form.estruturaExistente}`);

    if (form.scopeNotes?.trim()) {
      linhas.push('');
      linhas.push('─'.repeat(60));
      linhas.push('DESCRIÇÃO TÉCNICA DO TÉCNICO RESPONSÁVEL');
      linhas.push('─'.repeat(60));
      linhas.push(form.scopeNotes.trim());
    }

    if (form.itensCotacao && form.itensCotacao.length > 0) {
      linhas.push('');
      linhas.push('─'.repeat(60));
      linhas.push('ITENS PARA COTAÇÃO');
      linhas.push('─'.repeat(60));
      form.itensCotacao.forEach((item, idx) => {
        const qtd = item.quantidade ? `${item.quantidade}${item.unidade ? ` ${item.unidade}` : ''}` : '';
        const obs = item.observacao ? ` (${item.observacao})` : '';
        linhas.push(`${idx + 1}. ${item.descricao}${qtd ? ` — Qtd: ${qtd}` : ''}${obs}`);
      });
    }

    if (form.servicosExecucao && form.servicosExecucao.length > 0) {
      linhas.push('');
      linhas.push('─'.repeat(60));
      linhas.push('PLANO DE EXECUÇÃO');
      linhas.push('─'.repeat(60));
      let totalGeralDias = 0;
      let totalGeralMdo = 0;
      form.servicosExecucao.forEach((srv, si) => {
        const totalDias = srv.fases.reduce((acc, f) => acc + (f.diasExecucao || 0), 0);
        totalGeralDias += totalDias;
        totalGeralMdo += srv.valorMaoDeObra || 0;
        linhas.push(`\nServiço ${si + 1}: ${srv.nome}`);
        if (srv.fases.length > 0) {
          srv.fases.forEach((fase, fi) => {
            linhas.push(`   ${fi + 1}. ${fase.nome} — ${fase.diasExecucao} dia(s)`);
          });
          linhas.push(`   ► Total estimado: ${totalDias} dia(s)`);
        }
        if (srv.valorMaoDeObra > 0) {
          linhas.push(`   ► Mão de obra: R$ ${srv.valorMaoDeObra.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        }
      });
      if (form.servicosExecucao.length > 1) {
        linhas.push('');
        linhas.push(`TOTAL GERAL: ${totalGeralDias} dia(s) | Mão de obra: R$ ${totalGeralMdo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      }
    }

    if (form.observacoesTecnicas?.trim()) {
      linhas.push('');
      linhas.push('─'.repeat(60));
      linhas.push('OBSERVAÇÕES ADICIONAIS');
      linhas.push('─'.repeat(60));
      linhas.push(form.observacoesTecnicas.trim());
    }

    linhas.push('');
    linhas.push('═'.repeat(60));
    linhas.push('Por favor, enviar cotação detalhada com prazo de entrega.');
    linhas.push('═'.repeat(60));

    const texto = linhas.join('\n');
    const escopoGeradoEm = Timestamp.now();

    // Atualiza state local
    const formAtualizado = { ...form, solicitacaoCotacao: texto, escopoGeradoEm: escopoGeradoEm as any };
    setForm(formAtualizado);
    setSecaoCotacao(true);
    setSaved(false);

    // Auto-salva imediatamente com o escopo gerado — sem precisar clicar em Salvar
    setSaving(true);
    try {
      await savePrancheta(projectId, formAtualizado);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  // ── Salvar ──────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await savePrancheta(projectId, form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleProjetoPronto = async () => {
    setSavingPronto(true);
    try {
      await savePrancheta(projectId, form);
      const result = await sinalizarProjetoPronto(projectId);
      if (result.success) setProjetoPronto(true);
      else alert(result.error || 'Erro ao sinalizar projeto pronto');
    } finally {
      setSavingPronto(false);
    }
  };

  const handleEnviarCotacao = async () => {
    if (!form.scopeNotes?.trim() && !form.solicitacaoCotacao?.trim()) {
      if (!window.confirm('Nenhum escopo foi preenchido ainda. Deseja avançar para a aba Cotação mesmo assim?')) return;
    }
    setEnviandoCotacao(true);
    try {
      // 1. Salvar prancheta (grava preenchidoEm no Firestore)
      await savePrancheta(projectId, form);
      setSaved(true);

      // 2. Avançar fase — advancePhase agora faz getDoc se o state local ainda não atualizou
      const result = await advancePhase(projectId, 'em_cotacao', 'Prancheta concluída — card avançado para aba Cotação');
      if (!result.success) {
        alert(result.error || 'Erro ao avançar para cotação. Tente novamente.');
        return;
      }
      setCotacaoEnviada(true);
    } catch (err: any) {
      alert(`Erro: ${err?.message || String(err)}`);
    } finally {
      setEnviandoCotacao(false);
    }
  };

  // ── Upload de arquivos ──────────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) return;
    if (file.size > 10 * 1024 * 1024) { alert('Arquivo muito grande (máx 10MB)'); return; }
    setUploading(true);
    try {
      const path = `projects/${projectId}/${uploadType}s/${Date.now()}_${file.name}`;
      const task = uploadBytesResumable(storageRef(storage, path), file, { contentType: file.type });
      await new Promise<void>((resolve, reject) => {
        task.on('state_changed', undefined, reject, async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          if (uploadType === 'foto') {
            setForm((prev) => ({ ...prev, fotosLevantamento: [...(prev.fotosLevantamento || []), url] }));
          } else {
            setForm((prev) => ({ ...prev, croquis: [...(prev.croquis || []), url] }));
          }
          setSaved(false);
          resolve();
        });
      });
    } finally { setUploading(false); }
  };

  const removeFile = (type: 'foto' | 'croqui', idx: number) => {
    if (type === 'foto') {
      setForm((prev) => ({ ...prev, fotosLevantamento: (prev.fotosLevantamento || []).filter((_, i) => i !== idx) }));
    } else {
      setForm((prev) => ({ ...prev, croquis: (prev.croquis || []).filter((_, i) => i !== idx) }));
    }
    setSaved(false);
  };

  // ── Items de Cotação ────────────────────────────────────────────────────
  const adicionarItem = () => {
    if (!novoItem.descricao.trim()) return;
    setForm((prev) => ({ ...prev, itensCotacao: [...(prev.itensCotacao || []), { ...novoItem }] }));
    setNovoItem({ descricao: '', quantidade: '', unidade: '', observacao: '' });
    setSaved(false);
  };

  const removerItem = (idx: number) => {
    setForm((prev) => ({ ...prev, itensCotacao: (prev.itensCotacao || []).filter((_, i) => i !== idx) }));
    setSaved(false);
  };

  // ── Copiar/Download escopo ──────────────────────────────────────────────
  const copiarEscopo = () => {
    if (!form.solicitacaoCotacao) return;
    navigator.clipboard.writeText(form.solicitacaoCotacao).then(() => {
      setCopiedScope(true);
      setTimeout(() => setCopiedScope(false), 2000);
    });
  };

  const downloadEscopo = () => {
    if (!form.solicitacaoCotacao) return;
    const blob = new Blob([form.solicitacaoCotacao], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escopo_cotacao_${projectId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
            <Pencil className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">Prancheta do Técnico</h3>
            <p className="text-[10px] text-gray-400">Escopo de projeto + solicitação de cotação</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            saved ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  : 'bg-brand-600 text-white hover:bg-brand-700'
          }`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saving ? 'Salvando...' : saved ? 'Salvo ✓' : 'Salvar'}
        </button>
      </div>

      {/* ══ SEÇÃO 0: Documentos do Cliente (do contato inicial) ══ */}
      {arquivosContato && arquivosContato.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-blue-100">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-blue-800">Documentos Recebidos do Cliente</p>
              <p className="text-[10px] text-blue-500">Arquivos enviados durante o contato comercial</p>
            </div>
            <span className="ml-auto text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
              {arquivosContato.length} arquivo{arquivosContato.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {arquivosContato.map((arq, i) => (
                <a
                  key={i}
                  href={arq.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-blue-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  {arq.tipo === 'foto'
                    ? <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    : arq.tipo === 'pdf'
                      ? <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                      : <Upload className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <span className="text-xs text-gray-700 truncate flex-1 group-hover:text-blue-700">{arq.nome}</span>
                  <Download className="w-3 h-3 text-gray-300 group-hover:text-blue-400 flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ SEÇÃO 4: Fotos e Croquis ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoFotos(!secaoFotos)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Image className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Fotos e Croquis</span>
            {((form.fotosLevantamento?.length ?? 0) + (form.croquis?.length ?? 0)) > 0 && (
              <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-bold">
                {(form.fotosLevantamento?.length ?? 0) + (form.croquis?.length ?? 0)} arquivo(s)
              </span>
            )}
          </div>
          {secaoFotos ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoFotos && (
          <div className="px-5 pb-5 space-y-5 border-t border-gray-100 pt-4">
            {/* Fotos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><Image className="w-3.5 h-3.5" /> Fotos de Levantamento</p>
                <button onClick={() => { setUploadType('foto'); fileRef.current?.click(); }} disabled={uploading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">
                  {uploading && uploadType === 'foto' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Adicionar Foto
                </button>
              </div>
              {(form.fotosLevantamento?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {form.fotosLevantamento!.map((url, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-white">
                      <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                      <button onClick={() => removeFile('foto', i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400 text-center py-4">Nenhuma foto adicionada</p>}
            </div>

            {/* Croquis */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Croquis / Desenhos / PDFs</p>
                <button onClick={() => { setUploadType('croqui'); fileRef.current?.click(); }} disabled={uploading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100">
                  {uploading && uploadType === 'croqui' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                  Upload
                </button>
              </div>
              {(form.croquis?.length ?? 0) > 0 ? (
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                  {form.croquis!.map((url, i) => (
                    <div key={i} className="relative group rounded-xl overflow-hidden border border-gray-200 aspect-square bg-white">
                      {url.endsWith('.pdf')
                        ? <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50"><FileText className="w-8 h-8 text-gray-400" /><span className="text-[9px] text-gray-400 mt-1">PDF</span></div>
                        : <img src={url} alt={`Croqui ${i + 1}`} className="w-full h-full object-cover" />}
                      <button onClick={() => removeFile('croqui', i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-gray-400 text-center py-4">Nenhum croqui adicionado</p>}
            </div>
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 1: Dados Técnicos ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoDados(!secaoDados)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Dados Técnicos</span>
            {(form.finalidade || form.tipoEquipamento) && (
              <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">Preenchido</span>
            )}
          </div>
          {secaoDados ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoDados && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <Field label="Finalidade *" value={form.finalidade || ''} onChange={(v) => update('finalidade', v)} placeholder="Ex: Armazenamento de perecíveis" />
              <Field label="Localização" value={form.localizacao || ''} onChange={(v) => update('localizacao', v)} placeholder="Ex: Indaiatuba, SP" />
              <Field label="Metragem / Dimensões gerais" value={form.metragem || ''} onChange={(v) => update('metragem', v)} placeholder="Ex: 120 m²" />
              <Field label="Temperatura Alvo" value={form.temperaturaAlvo || ''} onChange={(v) => update('temperaturaAlvo', v)} placeholder="Ex: -18°C" />
              <Field label="Dimensões detalhadas" value={form.dimensoes || ''} onChange={(v) => update('dimensoes', v)} placeholder="Ex: 10 x 8 x 4m (C x L x A)" />
              <Field label="Tipo de Equipamento" value={form.tipoEquipamento || ''} onChange={(v) => update('tipoEquipamento', v)} placeholder="Ex: Split, Monobloco, Central" />
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">Capacidade (BTU)</label>
                <input type="number" value={form.capacidadeBTU || ''} placeholder="Ex: 60000"
                  onChange={(e) => update('capacidadeBTU', e.target.value ? Number(e.target.value) : null as any)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <SelectField label="Voltagem" value={form.voltagem || ''} onChange={(v) => update('voltagem', v)} options={VOLTAGENS} />
              <SelectField label="Tipo de Gás" value={form.tipoGas || ''} onChange={(v) => update('tipoGas', v)} options={GASES} />
              <SelectField label="Isolamento" value={form.isolamento || ''} onChange={(v) => update('isolamento', v)} options={ISOLAMENTOS} />
              <Field label="Estrutura Existente" value={form.estruturaExistente || ''} onChange={(v) => update('estruturaExistente', v)} placeholder="Ex: Galpão metálico com pé-direito 6m" />
            </div>
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 2: Bloco de Notas Livre (Escopo) ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoEscopo(!secaoEscopo)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-amber-100 rounded-lg flex items-center justify-center">
              <Pencil className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">📝 Bloco de Notas — Escopo do Projeto</span>
            {form.scopeNotes?.trim() && (
              <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                {form.scopeNotes.trim().split(' ').length} palavras
              </span>
            )}
          </div>
          {secaoEscopo ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoEscopo && (
          <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">

            {/* Info contextual */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
              <strong>Como usar:</strong> Descreva livremente o projeto de execução — solução pensada, necessidades técnicas, condições do local, requisitos do cliente. Você pode <strong>falar</strong> e o texto será transcrito automaticamente.
            </div>

            {/* Barra de transcrição de áudio */}
            {speechSupported && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => isListening && speechTarget === 'scopeNotes' ? stopListening() : startListening('scopeNotes')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    isListening && speechTarget === 'scopeNotes'
                      ? 'bg-red-500 text-white border-red-500 animate-pulse'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                  }`}
                >
                  {isListening && speechTarget === 'scopeNotes'
                    ? <><MicOff className="w-3.5 h-3.5" /> Parar Gravação</>
                    : <><Mic className="w-3.5 h-3.5" /> 🎙️ Transcrever Áudio</>}
                </button>
                {isListening && speechTarget === 'scopeNotes' && (
                  <span className="text-xs text-red-500 font-bold flex items-center gap-1">
                    <Volume2 className="w-3 h-3 animate-pulse" /> Gravando... fale normalmente em português
                  </span>
                )}
              </div>
            )}

            {/* Textarea de notas */}
            <textarea
              value={form.scopeNotes || ''}
              onChange={(e) => update('scopeNotes', e.target.value)}
              rows={10}
              placeholder={`Descreva o projeto aqui...

Exemplo:
• Projeto de câmara fria para armazenamento de hortifrúti
• Local: galpão existente com estrutura metálica, pé-direito 5m
• Dimensões necessárias: 6m x 4m x 3m (altura livre)
• Temperatura de projeto: 2°C a 8°C
• Sistema: monobloco externo com condensador a ar
• Necessidades: isolamento em PUR 100mm, porta de correr com visor...
• Pontos de atenção: instalação elétrica bifásica 220V disponível`}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm resize-none focus:ring-2 focus:ring-amber-400 outline-none leading-relaxed font-mono"
            />

            {/* Observações adicionais */}
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1.5 flex items-center gap-1.5">
                Observações Adicionais
                {speechSupported && (
                  <button
                    onClick={() => isListening && speechTarget === 'observacoesTecnicas' ? stopListening() : startListening('observacoesTecnicas')}
                    className={`ml-1 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold border transition-all ${
                      isListening && speechTarget === 'observacoesTecnicas'
                        ? 'bg-red-500 text-white border-red-500 animate-pulse'
                        : 'bg-gray-100 text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}
                  >
                    <Mic className="w-2.5 h-2.5" />
                    {isListening && speechTarget === 'observacoesTecnicas' ? 'Parar' : 'Ditado'}
                  </button>
                )}
              </label>
              <textarea
                value={form.observacoesTecnicas || ''}
                onChange={(e) => update('observacoesTecnicas', e.target.value)}
                rows={3}
                placeholder="Itens importantes: acesso ao local, prazo de execução, restrições..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:ring-2 focus:ring-gray-400 outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 2B: Plano de Execução ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoExecucao(!secaoExecucao)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
              <HardHat className="w-3.5 h-3.5 text-orange-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">🏗️ Plano de Execução</span>
            {(form.servicosExecucao?.length ?? 0) > 0 && (() => {
              const totalDias = (form.servicosExecucao || []).reduce((acc, s) => acc + s.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0), 0);
              const totalMdo = (form.servicosExecucao || []).reduce((acc, s) => acc + (s.valorMaoDeObra || 0), 0);
              return (
                <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-bold">
                  {form.servicosExecucao!.length} serviço(s) · {totalDias}d · {totalMdo > 0 ? `R$ ${totalMdo.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}` : 'sem valor'}
                </span>
              );
            })()}
          </div>
          {secaoExecucao ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoExecucao && (
          <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-4">

            {/* Info contextual */}
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-800">
              <strong>Para o comercial:</strong> Cadastre os serviços que serão executados, as fases de cada serviço com os dias estimados e o valor total da mão de obra. Estas informações serão usadas na apresentação da proposta.
            </div>

            {/* Lista de serviços */}
            {(form.servicosExecucao || []).map((srv, sIdx) => {
              const totalDias = srv.fases.reduce((acc, f) => acc + (f.diasExecucao || 0), 0);
              return (
                <div key={srv.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                  {/* Header do serviço */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <span className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center text-[10px] font-extrabold text-orange-700 flex-shrink-0">
                      {sIdx + 1}
                    </span>
                    <input
                      value={srv.nome}
                      onChange={e => updateServico(srv.id, 'nome', e.target.value)}
                      placeholder="Nome do serviço (ex: Câmara Fria, Sistema de Refrigeração)"
                      className="flex-1 bg-transparent text-sm font-bold text-gray-800 outline-none placeholder:text-gray-400 placeholder:font-normal border-b border-transparent focus:border-orange-300 transition-colors"
                    />
                    <button onClick={() => removeServico(srv.id)}
                      className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="px-4 py-4 space-y-3">
                    {/* Fases do serviço */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400" /> Fases de Execução
                        </p>
                        <button onClick={() => addFase(srv.id)}
                          className="flex items-center gap-1 px-2.5 py-1 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg text-xs font-bold hover:bg-orange-100 transition-colors">
                          <Plus className="w-3 h-3" /> Fase
                        </button>
                      </div>

                      {srv.fases.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-xl">
                          Clique em "+ Fase" para adicionar etapas de execução
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {srv.fases.map((fase, fIdx) => (
                            <div key={fase.id} className="flex items-center gap-2 group">
                              <span className="text-[10px] font-extrabold text-gray-400 w-5 text-center flex-shrink-0">{fIdx + 1}</span>
                              <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                              <input
                                value={fase.nome}
                                onChange={e => updateFase(srv.id, fase.id, 'nome', e.target.value)}
                                placeholder="Nome da fase (ex: Fundação e piso, Isolamento, Instalação elétrica)"
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                              />
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <input
                                  type="number"
                                  min={1}
                                  value={fase.diasExecucao}
                                  onChange={e => updateFase(srv.id, fase.id, 'diasExecucao', Math.max(1, Number(e.target.value)))}
                                  className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-xs text-center outline-none focus:ring-2 focus:ring-orange-300"
                                />
                                <span className="text-[10px] text-gray-400 font-medium w-7">dia{fase.diasExecucao !== 1 ? 's' : ''}</span>
                              </div>
                              <button onClick={() => removeFase(srv.id, fase.id)}
                                className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 rounded-lg transition-all flex-shrink-0">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}

                          {/* Subtotal de dias */}
                          <div className="flex items-center gap-2 pt-1 pl-8 border-t border-gray-100">
                            <Calendar className="w-3 h-3 text-orange-500" />
                            <span className="text-xs font-bold text-orange-700">
                              Total estimado: {totalDias} dia{totalDias !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Valor de Mão de Obra */}
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <DollarSign className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <label className="text-xs font-bold text-gray-700 flex-shrink-0">Valor total da Mão de Obra:</label>
                      <div className="flex items-center gap-1 flex-1">
                        <span className="text-xs font-bold text-gray-500">R$</span>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={srv.valorMaoDeObra || ''}
                          onChange={e => updateServico(srv.id, 'valorMaoDeObra', Number(e.target.value))}
                          placeholder="0,00"
                          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-300"
                        />
                      </div>
                      {srv.valorMaoDeObra > 0 && (
                        <span className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex-shrink-0">
                          {srv.valorMaoDeObra.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Botão adicionar serviço */}
            <button onClick={addServico}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-orange-200 text-orange-500 rounded-2xl text-sm font-bold hover:border-orange-400 hover:bg-orange-50 transition-all">
              <Plus className="w-4 h-4" /> Adicionar Serviço
            </button>

            {/* Totais gerais (quando há mais de 1 serviço) */}
            {(form.servicosExecucao || []).length > 1 && (() => {
              const totalDias = (form.servicosExecucao || []).reduce((acc, s) => acc + s.fases.reduce((a, f) => a + (f.diasExecucao || 0), 0), 0);
              const totalMdo = (form.servicosExecucao || []).reduce((acc, s) => acc + (s.valorMaoDeObra || 0), 0);
              return (
                <div className="flex items-center gap-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-2xl">
                  <HardHat className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-extrabold text-orange-800">Totais do Projeto</p>
                    <p className="text-[10px] text-orange-600 mt-0.5">
                      {(form.servicosExecucao || []).length} serviços · {totalDias} dia{totalDias !== 1 ? 's' : ''} de execução
                    </p>
                  </div>
                  {totalMdo > 0 && (
                    <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                      {totalMdo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ══ SEÇÃO 3: Itens para Cotação ══ */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <button onClick={() => setSecaoCotacao(!secaoCotacao)}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center">
              <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-sm font-bold text-gray-800">Lista de Itens para Cotação</span>
            {(form.itensCotacao?.length ?? 0) > 0 && (
              <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                {form.itensCotacao!.length} {form.itensCotacao!.length === 1 ? 'item' : 'itens'}
              </span>
            )}
          </div>
          {secaoCotacao ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {secaoCotacao && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">

            {/* Formulário para novo item */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-600">Adicionar Item</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <input value={novoItem.descricao} onKeyDown={(e) => e.key === 'Enter' && adicionarItem()}
                    onChange={(e) => setNovoItem((p) => ({ ...p, descricao: e.target.value }))}
                    placeholder="Descrição do item (obrigatório) — Enter para adicionar"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                </div>
                <div className="flex gap-2">
                  <input value={novoItem.quantidade || ''} onChange={(e) => setNovoItem((p) => ({ ...p, quantidade: e.target.value }))}
                    placeholder="Qtd" className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 text-center" />
                  <input value={novoItem.unidade || ''} onChange={(e) => setNovoItem((p) => ({ ...p, unidade: e.target.value }))}
                    placeholder="Un" className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400 text-center" />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <input value={novoItem.observacao || ''} onChange={(e) => setNovoItem((p) => ({ ...p, observacao: e.target.value }))}
                  placeholder="Observação específica (opcional)"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-400" />
                <button onClick={adicionarItem} disabled={!novoItem.descricao.trim()}
                  className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-40 transition-colors flex-shrink-0">
                  <Plus className="w-4 h-4" /> Adicionar
                </button>
              </div>
            </div>

            {/* Lista de itens */}
            {(form.itensCotacao?.length ?? 0) > 0 ? (
              <div className="space-y-2">
                {form.itensCotacao!.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 group">
                    <span className="text-xs font-extrabold text-gray-400 w-5 text-center flex-shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{item.descricao}</p>
                      <div className="flex gap-3 text-[10px] text-gray-400 mt-0.5">
                        {item.quantidade && <span>Qtd: {item.quantidade} {item.unidade}</span>}
                        {item.observacao && <span className="truncate italic">{item.observacao}</span>}
                      </div>
                    </div>
                    <button onClick={() => removerItem(idx)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 flex items-center justify-center bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4">
                Adicione os materiais e equipamentos que precisam de cotação.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ══ Botão Gerar Escopo (independente — abaixo de todos os dados e itens) ══ */}
      <button onClick={gerarEscopo}
        className="flex items-center gap-2 px-4 py-3.5 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 transition-all w-full justify-center shadow-sm hover:shadow-md active:scale-[0.98]">
        <ClipboardList className="w-5 h-5" />
        ✨ Gerar Escopo para Cotação
      </button>

      {/* ══ Escopo Gerado (externo às seções colapsáveis) ══ */}
      {form.solicitacaoCotacao && (
        <div className="bg-gray-900 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <p className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Escopo Gerado — Pronto para Envio
            </p>
            <div className="flex gap-2">
              <button onClick={copiarEscopo}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                  copiedScope ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}>
                {copiedScope ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copiedScope ? 'Copiado!' : 'Copiar'}
              </button>
              <button onClick={downloadEscopo}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                <Download className="w-3 h-3" /> .txt
              </button>
              <button onClick={gerarEscopo}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-700 text-blue-100 hover:bg-blue-600 transition-colors">
                <ClipboardList className="w-3 h-3" /> Regenerar
              </button>
            </div>
          </div>
          <pre className="px-4 py-4 text-[11px] text-gray-100 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
            {form.solicitacaoCotacao}
          </pre>
        </div>
      )}



      {/* ══ Botão Avançar para Cotação ══ */}
      <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 ${
        cotacaoEnviada ? 'bg-cyan-100 border border-cyan-300' : 'bg-cyan-50 border border-cyan-200'
      }`}>
        <div>
          <p className="text-sm font-bold text-cyan-900">
            {cotacaoEnviada ? '🚀 Card avançado para a aba Cotação!' : '📂 Prancheta concluída?'}
          </p>
          <p className="text-xs text-cyan-600 mt-0.5">
            {cotacaoEnviada
              ? 'Prancheta salva. Vá para a aba Cotação para registrar fornecedores e solicitar cotações.'
              : 'Salva a prancheta e avança o card para a etapa de Cotação. A solicitação de cotação à fornecedores é feita diretamente na aba Cotação.'}
          </p>
        </div>
        {!cotacaoEnviada && (
          <button onClick={handleEnviarCotacao} disabled={enviandoCotacao}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-sm font-bold hover:bg-cyan-700 disabled:opacity-50 flex-shrink-0 transition-colors">
            {enviandoCotacao ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Avançar para Cotação
          </button>
        )}
      </div>

      {/* ══ Botão Projeto Pronto (legado: pula direto para Proposta) ══ */}
      <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 ${
        projetoPronto ? 'bg-emerald-100 border border-emerald-300' : 'bg-gray-50 border border-gray-200'
      }`}>
        <div>
          <p className="text-sm font-bold text-gray-700">
            {projetoPronto ? '✅ Projeto sinalizado como Pronto!' : 'Pular cotação e ir direto para Proposta?'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {projetoPronto
              ? 'Lead avançou para "Aguardando Proposta".'
              : 'Use somente se não precisar de cotação de materiais.'}
          </p>
        </div>
        {!projetoPronto && (
          <button onClick={handleProjetoPronto} disabled={savingPronto || !form.finalidade?.trim()}
            className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-xl text-sm font-bold hover:bg-gray-100 disabled:opacity-50 flex-shrink-0 transition-colors">
            {savingPronto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Pular para Proposta
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(file); e.target.value = ''; }} />
    </div>
  );
};

// ── Sub-componentes ─────────────────────────────────────────────────────────
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400" />
  </div>
);

const SelectField: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: string[] }> = ({ label, value, onChange, options }) => (
  <div>
    <label className="text-xs font-bold text-gray-600 block mb-1">{label}</label>
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-400">
      <option value="">Selecione...</option>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

export default ProjectPrancheta;
